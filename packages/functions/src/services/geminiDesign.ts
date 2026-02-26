import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { config, LIMITS } from '../config.js';
import { logger } from 'firebase-functions';
import type { DesignResult, DesignDetail, DesignStrategy, BuildStepBlock, VoxelGrid } from '@brick-quest/shared';
import { buildVoxelDesignPrompt } from '@brick-quest/shared';
import { withTimeout } from '../utils/with-timeout.js';
import { getAI, getThinkingConfig } from './gemini-client.js';
import { generateFullGridVoxelGrid, type ModelChainState } from './strategies/full-grid.js';
import { generateBuildCommands } from './strategies/build-commands.js';
import { generateSilhouetteVoxelGrid } from './strategies/silhouette-carve.js';
import { generateDirectVoxelGrid } from './strategies/direct-voxel.js';
import { recognizeSubject, buildRecognitionContext } from './recognize-subject.js';
import { saveDesignDebug } from './design-debug.js';
import type { PixelExtractionResult } from './strategies/pixel-extract.js';

const DESIGN_TIMEOUT = 8 * 60 * 1000;
/** Short timeout for image gen — Pro model either responds in ~30s or is overloaded */
const IMAGE_GEN_TIMEOUT = 90_000;
/** Total time budget for the agent loop — leaves margin for preview gen + Firestore writes */
const AGENT_BUDGET_MS = 500_000;
const { AGENT_MAX_ITERATIONS } = LIMITS;

/** Evaluation timeout — Flash model is fast, 30s is plenty */
const EVAL_TIMEOUT = 30_000;

/** Minimum acceptable quality score (1-10) to accept without retry */
const QUALITY_ACCEPT_THRESHOLD = 7;

interface BuildEvaluation {
  shapeAccuracy: number;
  colorAccuracy: number;
  completeness: number;
  overallScore: number;
  missingFeatures: string[];
  improvements: string;
}

const evaluationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    shapeAccuracy: { type: Type.INTEGER, description: 'Silhouette and proportion match (1-10)' },
    colorAccuracy: { type: Type.INTEGER, description: 'Color placement correctness (1-10)' },
    completeness: { type: Type.INTEGER, description: 'Key features present (eyes, accessories, etc) (1-10)' },
    overallScore: { type: Type.INTEGER, description: 'Would someone recognize this as matching the views? (1-10)' },
    missingFeatures: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Features visible in views but missing from build (e.g. "ears", "glasses", "tail")',
    },
    improvements: { type: Type.STRING, description: 'Specific actionable improvement instructions for the builder' },
  },
  required: ['shapeAccuracy', 'colorAccuracy', 'completeness', 'overallScore', 'missingFeatures', 'improvements'],
};

/**
 * Summarize a build plan into a spatial description for the evaluator.
 * Includes bounding box, layer-by-layer breakdown, and color distribution.
 */
function summarizeBuildPlan(steps: BuildStepBlock[]): string {
  if (steps.length === 0) return 'Empty build plan (0 bricks)';

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;

  const layers = new Map<number, { count: number; colors: Map<string, number>; minX: number; maxX: number; minZ: number; maxZ: number }>();
  const colorCounts = new Map<string, number>();

  for (const step of steps) {
    const { x, y, z } = step.position;
    const w = step.size.width;
    const h = step.size.height;
    const l = step.size.length;

    minX = Math.min(minX, x - w / 2);
    maxX = Math.max(maxX, x + w / 2);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + h);
    minZ = Math.min(minZ, z - l / 2);
    maxZ = Math.max(maxZ, z + l / 2);

    const layerY = Math.round(y * 10) / 10;
    if (!layers.has(layerY)) {
      layers.set(layerY, { count: 0, colors: new Map(), minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    }
    const layer = layers.get(layerY)!;
    layer.count++;
    layer.colors.set(step.color, (layer.colors.get(step.color) || 0) + 1);
    layer.minX = Math.min(layer.minX, x - w / 2);
    layer.maxX = Math.max(layer.maxX, x + w / 2);
    layer.minZ = Math.min(layer.minZ, z - l / 2);
    layer.maxZ = Math.max(layer.maxZ, z + l / 2);

    colorCounts.set(step.color, (colorCounts.get(step.color) || 0) + 1);
  }

  const sortedLayers = [...layers.entries()].sort((a, b) => a[0] - b[0]);
  const total = steps.length;

  const colorSummary = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([color, count]) => `${color}: ${count} (${Math.round((count / total) * 100)}%)`)
    .join(', ');

  const layerLines = sortedLayers
    .map(([y, layer]) => {
      const w = Math.round(layer.maxX - layer.minX);
      const d = Math.round(layer.maxZ - layer.minZ);
      const topColors = [...layer.colors.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c, n]) => `${c}×${n}`)
        .join(', ');
      return `  Y=${y}: ${layer.count} bricks, ${w}×${d} footprint [${topColors}]`;
    })
    .join('\n');

  return `Total: ${total} bricks across ${sortedLayers.length} layers
Bounding box: ${Math.round(maxX - minX)}W × ${Math.round(maxZ - minZ)}D × ${(maxY - minY).toFixed(1)}H
Colors: ${colorSummary}
Layers (bottom → top):
${layerLines}`;
}

/**
 * Use Flash model to evaluate how well a build plan matches the composite views.
 * Returns quality scores and specific improvement feedback.
 */
async function evaluateBuildQuality(compositeView: ImageData, steps: BuildStepBlock[]): Promise<BuildEvaluation> {
  const ai = getAI();
  const summary = summarizeBuildPlan(steps);

  const response = await withTimeout(
    ai.models.generateContent({
      model: config.gemini.fastModel,
      contents: [
        {
          text: 'You are a LEGO build quality inspector. Compare this build plan against the target composite views.\n\nCOMPOSITE VIEWS (2×2 grid — top-left: hero 3/4, top-right: front, bottom-left: right side, bottom-right: back):',
        },
        { inlineData: { mimeType: compositeView.mimeType, data: compositeView.data } },
        {
          text: `BUILD PLAN SPATIAL SUMMARY:\n${summary}\n\nEVALUATE how accurately this build plan reproduces the model shown in the 4 views above:\n\n1. shapeAccuracy (1-10): Does the build's bounding box, layer widths, and silhouette progression match the views? Check head-to-body ratio, overall proportions.\n2. colorAccuracy (1-10): Are the right colors in the right layers? Compare the color distribution against what each view shows (e.g., skin color on face layers, hair color on top layers).\n3. completeness (1-10): Are key recognizable features present? Check for eyes, mouth, ears, hair, accessories, clothing details visible in the views.\n4. overallScore (1-10): If someone built this and viewed it from the same 4 angles, would it be recognizable as the same model?\n\nList specific MISSING features and provide actionable IMPROVEMENTS.`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: evaluationSchema,
        maxOutputTokens: 4096,
        thinkingConfig: getThinkingConfig(config.gemini.fastModel, 'low'),
      },
    }),
    EVAL_TIMEOUT,
    'Build quality evaluation'
  );

  return JSON.parse(response.text || '{}');
}

export interface ImageData {
  data: string; // base64
  mimeType: string;
  usedFallback?: boolean;
}

function compositeViewPrompt(detail: DesignDetail, userPrompt: string): string {
  const detailInstructions: Record<DesignDetail, string> = {
    simple: 'Use 1x1 and 1x2 bricks/plates. About 12 studs wide, 16 layers tall. Simple chunky shape.',
    standard: 'Use 1x1, 1x2, 2x2 bricks/plates. About 16-20 studs wide, 24 layers tall. Clear features.',
    detailed: 'Use mostly 1x1 bricks/plates for maximum pixel detail. About 20-28 studs wide, 28-36 layers tall. Every feature visible.',
  };

  return `STEP 1 — ANALYZE THE REFERENCE PHOTO:
Study the reference photo and identify:
- What the subject IS (be specific: "golden retriever", "red sports car", "Mario")
- The subject's EXACT colors (map each to a LEGO color)
- Distinctive features that make it recognizable (ears, tail, horn, glasses, hat, etc.)
- Body proportions (height:width:depth ratio)
- Body sections from bottom to top (feet → legs → body → head → top features)

STEP 2 — DESIGN A 3D VOXEL-ART LEGO MODEL:
Design a 3D PIXEL ART / VOXEL ART sculpture using ONLY rectangular bricks and plates.
Think of it as a 3D Minecraft build or a LEGO Brickheadz set — EVERY surface is a staircase of flat rectangular steps. NO curves, NO slopes, NO rounded pieces.

The model is built on a STRICT STUD GRID:
- Every brick sits on an integer grid position
- All surfaces are STEPPED/PIXELATED — curved shapes are approximated by staircase steps
- You can literally count the studs in each row to know exact dimensions
- This is 3D PIXEL ART, not a realistic sculpture

STEP 3 — RENDER 4 VIEWS of that SINGLE model into a 2×2 grid image:

LAYOUT — 2×2 grid, each quadrant clearly separated:
┌──────────────────┬──────────────────┐
│    TOP-LEFT      │    TOP-RIGHT     │
│    3/4 Hero      │    Front View    │
│    Angle         │    (straight-on) │
├──────────────────┼──────────────────┤
│   BOTTOM-LEFT    │   BOTTOM-RIGHT   │
│   Right Side     │    Back View     │
│   View           │                  │
└──────────────────┴──────────────────┘

VIEW REQUIREMENTS:
• TOP-LEFT (Hero): 3/4 angle from above-left. Shows the 3D blocky shape clearly. You can see the stud grid on top and the stepped surfaces on two sides.
• TOP-RIGHT (Front): Straight-on front view. This is the MOST IMPORTANT view — it will be used as a pixel map. Each stud column = 1 grid position. Eyes, face, chest details must be clearly visible as distinct colored studs/plates.
• BOTTOM-LEFT (Right Side): 90° from front. Shows profile depth. Must be EQUALLY DETAILED — you can count the studs from front to back.
• BOTTOM-RIGHT (Back): 180° from front. Shows rear details with EQUAL quality.

ABSOLUTE REQUIREMENTS:
- All 4 views show the EXACT SAME model from different angles
- SAME colors, proportions, and details in every view
- Every view must be EQUALLY sharp and detailed
- Studs must be visible and countable in ALL views
- Views must be usable as a PIXEL MAP — each stud position corresponds to a grid cell

BRICK RULES (CRITICAL — STRICTLY FOLLOW):
✅ ONLY USE: Standard rectangular bricks (1x1, 1x2, 1x3, 1x4, 2x2, 2x3, 2x4) and plates (same sizes, thinner)
✅ Every surface must be FLAT and STEPPED — like staircase steps
✅ All bricks aligned to a regular stud grid
✅ Visible cylindrical studs on top surfaces
✅ Sharp 90° edges everywhere
✅ Seams between bricks clearly visible

❌ ABSOLUTELY NO: slopes, curved slopes, arches, round bricks, cones, domes, half-cylinders, wedges, or ANY non-rectangular piece
❌ NO smooth surfaces — ALL curves must be STAIRCASE-STEPPED
❌ NO organic shapes — everything is BLOCKY and PIXELATED
❌ NO printed/stickered tiles
❌ NO minifigure style

Think: Minecraft build, NOT a realistic LEGO MOC.

A turtle shell? → Stepped dome made of flat rectangular layers, each slightly smaller than the one below.
A round head? → Stepped cube/cylinder made of rectangular layers.
Ears? → Small rectangular columns sticking up from the top layers.

STYLE: ${detailInstructions[detail]}
Render as a product photo on a clean white/light gray background. Soft studio lighting. High resolution showing every individual stud and brick seam.${userPrompt ? `\n\nUser note: "${userPrompt}"` : ''}`;
}

/** Returns true for errors where switching to a different model may help.
 *  Includes server errors (503/429), network failures (fetch failed), and our timeouts. */
function isRetryableModelError(error: any): boolean {
  const msg = String(error?.message || '');
  return /499|503|429|CANCELLED|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg);
}

/**
 * Generate a single composite image with 4 views (hero, front, side, back) of a LEGO model.
 * Uses a single Gemini image generation call for consistency across views.
 *
 * Strategy: Try Pro model twice with SHORT timeout (90s) → immediate fallback to Flash.
 * Pro model either responds in ~30s or is overloaded — no point waiting 5+ minutes.
 */
export async function generateOrthographicViews(
  base64Image: string,
  mimeType: string,
  detail: DesignDetail = 'standard',
  userPrompt = ''
): Promise<ImageData> {
  const ai = getAI();
  const prompt = compositeViewPrompt(detail, userPrompt);
  const contentParts = [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }];

  // Phase 1: Try primary (pro) image model — 2 attempts, 90s timeout each
  const PRO_RETRIES = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= PRO_RETRIES; attempt++) {
    try {
      logger.info(`Generating composite views (pro), attempt ${attempt}/${PRO_RETRIES}`);

      const response = await withTimeout(
        ai.models.generateContent({
          model: config.gemini.imageModel,
          contents: contentParts,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio: '1:1', imageSize: '2K' },
          },
        }),
        IMAGE_GEN_TIMEOUT,
        'composite views generation'
      );

      const candidates = response.candidates;
      if (!candidates?.[0]?.content?.parts) {
        lastError = new Error('No parts in composite views response');
        continue;
      }

      for (const part of candidates[0].content.parts) {
        if (part.inlineData?.data) {
          logger.info('Composite views generated successfully (pro model)');
          return {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
          };
        }
      }

      lastError = new Error('No image data in composite views response');
    } catch (error: any) {
      logger.error(`Composite views pro attempt ${attempt} failed:`, error.message);
      lastError = error;
      // On retryable error (503/429), skip remaining Pro retries → go straight to fallback
      if (isRetryableModelError(error)) break;
      if (attempt < PRO_RETRIES) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  // Phase 2: Fallback to flash image model — always try if Pro failed
  logger.info(`Pro image model failed, falling back to ${config.gemini.fallbackImageModel}`);
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: config.gemini.fallbackImageModel,
        contents: contentParts,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
      DESIGN_TIMEOUT,
      'composite views generation (fallback)'
    );

    const candidates = response.candidates;
    if (candidates?.[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData?.data) {
          logger.info('Composite views generated successfully (fallback model)');
          return {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
            usedFallback: true,
          };
        }
      }
    }
  } catch (fallbackError: any) {
    logger.error('Fallback model also failed:', fallbackError.message);
  }

  throw lastError || new Error('Failed to generate composite views');
}

export async function generateDesignFromPhoto(
  base64Image: string,
  mimeType: string,
  detail: DesignDetail = 'standard',
  userPrompt = '',
  compositeView?: ImageData,
  onProgress?: (msg: string) => Promise<void>,
  strategy: DesignStrategy = 'full-grid',
  jobId?: string
): Promise<{ result: DesignResult; usedFallbackModel: boolean }> {
  const ai = getAI();

  // maxOutput varies by model: Flash 3.x caps at 65K, Pro supports 100K+.
  // We set a higher ceiling here — getThinkingConfig handles per-model constraints.
  // minBricks raised proportionally to expected grid volume to reject sparse outputs.
  const outputConfig: Record<DesignDetail, { maxOutput: number; thinkingLevel: 'low' | 'medium' | 'high'; minBricks: number }> = {
    simple: { maxOutput: 40000, thinkingLevel: 'low', minBricks: 50 },
    standard: { maxOutput: 100000, thinkingLevel: 'medium', minBricks: 150 },
    detailed: { maxOutput: 100000, thinkingLevel: 'high', minBricks: 250 },
  };

  const cfg = outputConfig[detail];

  // --- Object Recognition Pre-step (Flash model, ~2-5s) ---
  // Research shows pre-identifying the subject improves voxel generation quality by 20-30%
  // (VoT NeurIPS 2024, SPP, 3DAxisPrompt ICLR 2025, LEGO-Maker ICCV 2025)
  let recognitionContext: string | undefined;
  let recognitionResult: Awaited<ReturnType<typeof recognizeSubject>> = null;
  if (strategy === 'full-grid' || strategy === 'direct-voxel') {
    if (onProgress) await onProgress('Analyzing subject...');
    recognitionResult = await recognizeSubject(ai, base64Image, mimeType, userPrompt);
    if (recognitionResult) {
      recognitionContext = buildRecognitionContext(recognitionResult);
      logger.info(`Subject pre-analysis: "${recognitionResult.subject}" (${recognitionResult.category}), features: ${recognitionResult.keyFeatures.join(', ')}`);
      logger.info(`  Proportions: widthToHeight=${recognitionResult.proportions.widthToHeight}, depthToWidth=${recognitionResult.proportions.depthToWidth}`);
      if (onProgress) await onProgress(`Identified: ${recognitionResult.subject}`);
    }
  }

  // Track best result across agent iterations
  let bestResult: { result: DesignResult; brickCount: number; qualityScore: number } | null = null;
  let feedbackPrompt = '';
  // Track pixel extraction for debug artifacts
  let pixelExtraction: PixelExtractionResult | undefined;
  let winningStrategy: 'sharp' | 'flash' | 'build-commands' | 'full-grid' | 'direct-voxel' = 'full-grid';
  // Once direct-voxel fails, skip it on subsequent agent iterations (fallback is deterministic)
  let directVoxelFailed = false;
  // Voxel generation model chain: Pro first for quality, Flash as fallback.
  // Pro models produce much better 3D structure understanding from composite views.
  // Flash is fast but struggles with complex spatial reasoning → flat/featureless builds.
  // If Pro times out (499/503), we fall back to Flash immediately.
  const voxelModelChain = config.gemini.modelChain;
  const modelState: ModelChainState = {
    modelIndex: 0,
    useModel: voxelModelChain[0],
    usedFallback: false,
  };
  let prevQualityScore = 0;
  const agentStart = Date.now();

  for (let iteration = 1; iteration <= AGENT_MAX_ITERATIONS; iteration++) {
    const elapsed = Date.now() - agentStart;
    const remaining = AGENT_BUDGET_MS - elapsed;

    if (remaining < 60_000 && bestResult) {
      logger.info(`Agent: ${Math.round(elapsed / 1000)}s elapsed, using best result (${bestResult.brickCount} bricks)`);
      break;
    }

    logger.info(`Agent iteration ${iteration}/${AGENT_MAX_ITERATIONS} (model: ${modelState.useModel}, ${Math.round(remaining / 1000)}s remaining)`);

    if (onProgress && iteration > 1) {
      await onProgress(`Improving build (attempt ${iteration}/${AGENT_MAX_ITERATIONS})...`);
    }

    // On retry iterations, omit the worked example to save ~400 tokens
    const prompt = buildVoxelDesignPrompt(detail, userPrompt, !!compositeView, iteration > 1);
    const currentPrompt = feedbackPrompt ? `${prompt}\n\n${feedbackPrompt}` : prompt;

    // --- Generate VoxelGrid using chosen strategy ---
    let lastError: Error | null = null;
    let iterationSteps: BuildStepBlock[] | null = null;
    let iterationMeta: { title: string; description: string; lore: string; referenceDescription: string } | null = null;
    let iterationVoxelGrid: VoxelGrid | null = null;

    if (strategy === 'direct-voxel') {
      // Direct-voxel strategy: flat {x,y,z,color}[] array (voxel-toy-box approach)
      // Only attempt on first iteration — if it failed before, go straight to fallback.
      if (!directVoxelFailed) {
        const dvResult = await generateDirectVoxelGrid({
          ai,
          base64Image,
          mimeType,
          compositeView,
          detail,
          userPrompt,
          feedbackPrompt,
          cfg: { ...cfg, recognitionContext, recognizedSubject: recognitionResult?.subject },
          agentStart,
          agentBudgetMs: AGENT_BUDGET_MS,
        });

        if (dvResult.result) {
          winningStrategy = 'direct-voxel';
          logger.info(`  ★ Direct-voxel succeeded — ${dvResult.result.steps.length} bricks`);
          if (onProgress) await onProgress(`Direct voxel: ${dvResult.result.steps.length} bricks`);
          iterationSteps = dvResult.result.steps;
          iterationVoxelGrid = dvResult.result.voxelGrid;
          iterationMeta = dvResult.result.meta;
        } else {
          directVoxelFailed = true;
          logger.info(`  ✗ Direct-voxel failed (${dvResult.lastError?.message}), falling back to full-grid cascade`);
          lastError = dvResult.lastError;
        }
      }

      // Fallback: full-grid 3-tier cascade (always if direct-voxel failed or was skipped)
      if (!iterationSteps) {
        if (onProgress) await onProgress('Falling back to standard strategy...');

        if (compositeView) {
          const silResult = await generateSilhouetteVoxelGrid({
            ai,
            compositeView,
            detail,
            userPrompt,
            feedbackPrompt,
            cfg: { ...cfg, recognitionContext },
            recognition: recognitionResult ?? undefined,
            isRetry: iteration > 1,
            agentStart,
            agentBudgetMs: AGENT_BUDGET_MS,
            onProgress,
          });
          if (silResult.pixelExtraction) pixelExtraction = silResult.pixelExtraction;
          if (silResult.result) {
            winningStrategy = silResult.pixelExtraction && !silResult.lastError ? 'sharp' : 'flash';
            iterationSteps = silResult.result.steps;
            iterationVoxelGrid = silResult.result.voxelGrid;
            iterationMeta = silResult.result.meta;
          }
        }

        if (!iterationSteps) {
          const cmdResult = await generateBuildCommands({
            ai,
            base64Image,
            mimeType,
            compositeView,
            detail,
            userPrompt,
            feedbackPrompt,
            cfg: { ...cfg, recognitionContext },
            modelChain: voxelModelChain,
            modelState,
            agentStart,
            agentBudgetMs: AGENT_BUDGET_MS,
            isRetry: iteration > 1,
            onProgress,
          });
          if (cmdResult.result) {
            winningStrategy = 'build-commands';
            iterationSteps = cmdResult.result.steps;
            iterationVoxelGrid = cmdResult.result.voxelGrid;
            iterationMeta = cmdResult.result.meta;
          }
        }

        if (!iterationSteps) {
          const genResult = await generateFullGridVoxelGrid({
            ai,
            base64Image,
            mimeType,
            compositeView,
            prompt: currentPrompt,
            cfg: { ...cfg, recognitionContext },
            modelChain: voxelModelChain,
            modelState,
            agentStart,
            agentBudgetMs: AGENT_BUDGET_MS,
            onProgress,
          });
          lastError = genResult.lastError;
          if (genResult.result) {
            winningStrategy = 'full-grid';
            iterationSteps = genResult.result.steps;
            iterationVoxelGrid = genResult.result.voxelGrid;
            iterationMeta = genResult.result.meta;
          }
        }
      }
    } else if (strategy === '2d-slice' && compositeView) {
      // 2D slice strategy: analyze views → generate 2D faces → code assembly
      try {
        const { generate2DSliceVoxelGrid } = await import('./strategies/slice2d.js');
        const sliceResult = await generate2DSliceVoxelGrid({
          ai,
          compositeView,
          base64Image,
          mimeType,
          detail,
          userPrompt,
          feedbackPrompt,
          budgetMs: remaining,
          agentStart,
          onProgress,
        });
        iterationSteps = sliceResult.steps;
        iterationVoxelGrid = sliceResult.voxelGrid;
        iterationMeta = sliceResult.meta;
      } catch (error: any) {
        logger.error(`  2D-slice generation failed:`, error.message);
        lastError = error;
      }
    } else {
      // Full-grid strategy: 3-tier cascade
      //   1. Silhouette carving (if composite views available) — deterministic 3D from 2D grids
      //   2. Build commands DSL — token-efficient 3D generation
      //   3. Raw JSON grid — original fallback

      // Tier 1: Silhouette carving (primary when composite views exist)
      if (compositeView) {
        const silResult = await generateSilhouetteVoxelGrid({
          ai,
          compositeView,
          detail,
          userPrompt,
          feedbackPrompt,
          cfg: { ...cfg, recognitionContext },
          recognition: recognitionResult ?? undefined,
          isRetry: iteration > 1,
          agentStart,
          agentBudgetMs: AGENT_BUDGET_MS,
          onProgress,
        });

        // Capture pixel extraction for debug regardless of success
        if (silResult.pixelExtraction) pixelExtraction = silResult.pixelExtraction;

        if (silResult.result) {
          // Determine if sharp or flash produced the result
          winningStrategy = silResult.pixelExtraction && !silResult.lastError ? 'sharp' : 'flash';
          logger.info(`  ★ Silhouette carving succeeded (${winningStrategy}) — ${silResult.result.steps.length} bricks`);
          if (onProgress) await onProgress(`Silhouette carving (${winningStrategy}): ${silResult.result.steps.length} bricks`);
          iterationSteps = silResult.result.steps;
          iterationVoxelGrid = silResult.result.voxelGrid;
          iterationMeta = silResult.result.meta;
        } else {
          logger.info(`  ✗ Silhouette carving failed (${silResult.lastError?.message}), trying build commands...`);
        }
      }

      // Tier 2: Build commands DSL (if silhouette failed or no composite views)
      if (!iterationSteps) {
        const cmdResult = await generateBuildCommands({
          ai,
          base64Image,
          mimeType,
          compositeView,
          detail,
          userPrompt,
          feedbackPrompt,
          cfg: { ...cfg, recognitionContext },
          modelChain: voxelModelChain,
          modelState,
          agentStart,
          agentBudgetMs: AGENT_BUDGET_MS,
          isRetry: iteration > 1,
          onProgress,
        });

        if (cmdResult.result) {
          winningStrategy = 'build-commands';
          logger.info(`  ★ Build commands succeeded — ${cmdResult.result.steps.length} bricks`);
          if (onProgress) await onProgress(`Build commands: ${cmdResult.result.steps.length} bricks`);
          iterationSteps = cmdResult.result.steps;
          iterationVoxelGrid = cmdResult.result.voxelGrid;
          iterationMeta = cmdResult.result.meta;
        } else {
          logger.info(`  ✗ Build commands failed (${cmdResult.lastError?.message}), falling back to raw grid`);
        }
      }

      // Tier 3: Raw JSON grid (last resort)
      if (!iterationSteps) {
        if (onProgress) await onProgress('Falling back to raw grid strategy...');
        const genResult = await generateFullGridVoxelGrid({
          ai,
          base64Image,
          mimeType,
          compositeView,
          prompt: currentPrompt,
          cfg: { ...cfg, recognitionContext },
          modelChain: voxelModelChain,
          modelState,
          agentStart,
          agentBudgetMs: AGENT_BUDGET_MS,
          onProgress,
        });
        lastError = genResult.lastError;
        if (genResult.result) {
          winningStrategy = 'full-grid';
          iterationSteps = genResult.result.steps;
          iterationVoxelGrid = genResult.result.voxelGrid;
          iterationMeta = genResult.result.meta;
        }
      }
    }

    // If all parse attempts failed, continue or use best
    if (!iterationSteps || !iterationMeta) {
      logger.warn(`Agent iteration ${iteration} failed to produce valid voxel grid`);

      if (bestResult) break;
      if (iteration === AGENT_MAX_ITERATIONS) {
        throw lastError || new Error('Failed to generate design after multiple attempts.');
      }
      continue;
    }

    // Build requiredParts from the converted steps
    const partsMap = new Map<string, any>();
    for (const step of iterationSteps) {
      const key = [step.type, step.shape, step.color, step.hexColor, `${step.size.width}x${step.size.length}`].join('|');
      const existing = partsMap.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        partsMap.set(key, {
          name: step.partName || `${step.size.width}x${step.size.length} ${step.type}`,
          shape: step.shape,
          type: step.type,
          color: step.color,
          hexColor: step.hexColor,
          dimensions: { width: step.size.width, length: step.size.length },
          quantity: 1,
        });
      }
    }

    const iterationResult: DesignResult = {
      buildPlan: {
        ...iterationMeta,
        steps: iterationSteps,
        agentIterations: iteration,
        ...(iterationVoxelGrid && { voxelGrid: iterationVoxelGrid }),
      },
      requiredParts: Array.from(partsMap.values()),
      referenceDescription: iterationMeta.referenceDescription,
    };

    // --- Visual quality evaluation (Flash model) ---
    let qualityScore = 10;
    let evaluation: BuildEvaluation | null = null;

    if (compositeView) {
      const evalRemaining = AGENT_BUDGET_MS - (Date.now() - agentStart);
      if (evalRemaining > EVAL_TIMEOUT + 30_000) {
        try {
          evaluation = await evaluateBuildQuality(compositeView, iterationSteps);
          qualityScore = evaluation.overallScore;

          logger.info(
            `Agent iteration ${iteration} evaluation: ` +
              `shape=${evaluation.shapeAccuracy}, color=${evaluation.colorAccuracy}, ` +
              `completeness=${evaluation.completeness}, overall=${qualityScore}/10`
          );
          if (evaluation.missingFeatures.length > 0) {
            logger.info(`  Missing: ${evaluation.missingFeatures.join(', ')}`);
          }

          if (onProgress) {
            const scoreMsg = `Quality: ${qualityScore}/10 (shape: ${evaluation.shapeAccuracy}, color: ${evaluation.colorAccuracy}, detail: ${evaluation.completeness})`;
            await onProgress(scoreMsg);
            if (evaluation.missingFeatures.length > 0) {
              await onProgress(`Missing: ${evaluation.missingFeatures.join(', ')}`);
            }
          }
        } catch (error: any) {
          logger.warn(`Quality evaluation failed (non-critical): ${error.message}`);
          qualityScore = 10;
        }
      } else {
        logger.info(`Agent iteration ${iteration}: skipping evaluation (${Math.round(evalRemaining / 1000)}s remaining)`);
      }
    }

    // Track best result (prefer highest quality score, break ties by brick count)
    if (
      !bestResult ||
      qualityScore > bestResult.qualityScore ||
      (qualityScore === bestResult.qualityScore && iterationSteps.length > bestResult.brickCount)
    ) {
      bestResult = { result: iterationResult, brickCount: iterationSteps.length, qualityScore };
    }

    // --- Decide whether to retry (quality-only, no physics check needed) ---
    const qualityAcceptable = qualityScore >= QUALITY_ACCEPT_THRESHOLD;
    // Only accept plateau if score is at least passable (4/10) — prevents accepting garbage
    const scorePlateau = iteration > 1 && qualityScore >= 4 && qualityScore - prevQualityScore < 1;
    prevQualityScore = qualityScore;

    if (qualityAcceptable || scorePlateau) {
      const reason = qualityAcceptable
        ? `quality ${qualityScore}/10 ≥ ${QUALITY_ACCEPT_THRESHOLD}`
        : `quality plateaued (${prevQualityScore} → ${qualityScore})`;
      logger.info(`Agent iteration ${iteration}: accepted — ${iterationSteps.length} bricks, ${reason}`);
      break;
    }

    // Build quality feedback for next iteration — ADDITIVE only.
    // Previous attempts showed that generic "make it bigger" feedback destroys the model.
    // Only provide specific, actionable feedback from the evaluator.
    // Include previous build summary as context so the model can refine rather than restart.
    if (iteration < AGENT_MAX_ITERATIONS && evaluation) {
      const missing = evaluation.missingFeatures;
      const feedbackParts: string[] = [];
      if (missing.length > 0) {
        feedbackParts.push(`ADD these missing features: ${missing.join(', ')}`);
      }
      if (evaluation.shapeAccuracy < 5) {
        feedbackParts.push('FIX proportions — check head-to-body ratio against the composite views');
      }
      if (evaluation.colorAccuracy < 5) {
        feedbackParts.push('FIX colors — compare your palette against the composite views more carefully');
      }
      if (evaluation.completeness < 5) {
        feedbackParts.push('ADD MORE DETAIL — use plate layers for fine features (eyes, mouth, accessories)');
      }
      if (feedbackParts.length > 0) {
        // Include previous build spatial summary so model can refine instead of starting from scratch
        const prevSummary = summarizeBuildPlan(iterationSteps);
        feedbackPrompt =
          `PREVIOUS ATTEMPT scored ${qualityScore}/10 (shape: ${evaluation.shapeAccuracy}, color: ${evaluation.colorAccuracy}, completeness: ${evaluation.completeness}).\n\n` +
          `PREVIOUS BUILD SUMMARY (use as starting point — refine, don't restart):\n${prevSummary}\n\n` +
          `SPECIFIC FIXES NEEDED:\n` +
          feedbackParts.map((p) => `• ${p}`).join('\n') +
          `\n\nIMPORTANT: Do NOT reduce the model size. Keep at least ${iterationSteps.length} bricks and ${iterationVoxelGrid!.layers.length} layers. Build on the previous attempt's structure.`;
        logger.info(`Agent iteration ${iteration}: quality ${qualityScore}/10, retrying with specific feedback`);
      } else {
        // Evaluator gave low score but no actionable feedback — don't retry
        logger.info(`Agent iteration ${iteration}: quality ${qualityScore}/10 but no actionable feedback, accepting`);
        break;
      }
    } else {
      logger.info(
        `Agent iteration ${iteration}: final iteration, using best result (${iterationSteps.length} bricks, quality ${qualityScore}/10)`
      );
    }
  }

  if (!bestResult) {
    throw new Error('Failed to generate design after multiple attempts.');
  }

  const { result, qualityScore: finalScore } = bestResult;
  logger.info(
    `Design generated: ${result.buildPlan.steps.length} steps, ${result.requiredParts.length} unique parts ` +
      `(${result.buildPlan.agentIterations} iteration(s), quality ${finalScore}/10)`
  );

  // Save debug artifacts (non-blocking — fire and forget)
  if (jobId) {
    saveDesignDebug({
      jobId,
      pixelExtraction,
      voxelGrid: result.buildPlan.voxelGrid,
      strategy: winningStrategy,
      totalMs: Date.now() - agentStart,
      qualityScore: finalScore,
      recognizedSubject: recognitionResult?.subject,
    }).catch(() => {});
  }

  return { result, usedFallbackModel: modelState.usedFallback };
}

/**
 * Generate a LEGO-style preview image from a reference photo.
 * Uses Gemini image generation to transform the real object into a LEGO-style rendering.
 * Returns base64-encoded PNG image data, or null if generation fails.
 */
export async function generateLegoPreview(
  base64Image: string,
  mimeType: string,
  referenceDescription: string
): Promise<{ data: string; mimeType: string } | null> {
  const ai = getAI();

  const prompt = `Transform this photo into a LEGO brick art style.
The subject is: ${referenceDescription}

Rules:
- Make it look like it's built from real LEGO bricks
- Keep the same pose, composition, and color palette as the original photo
- Show visible LEGO studs and brick edges
- Use a clean, simple background
- The result should look like a professional LEGO set box art render`;

  const modelsToTry = [config.gemini.imageModel, config.gemini.fallbackImageModel];

  for (const model of modelsToTry) {
    const isFallback = model !== config.gemini.imageModel;
    const timeout = isFallback ? DESIGN_TIMEOUT : IMAGE_GEN_TIMEOUT;
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }],
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            ...(isFallback ? {} : { imageConfig: { imageSize: '2K' } }),
          },
        }),
        timeout,
        'LEGO preview generation'
      );

      const candidates = response.candidates;
      if (!candidates?.[0]?.content?.parts) {
        logger.warn(`No image parts in preview response (${model})`);
        continue;
      }

      for (const part of candidates[0].content.parts) {
        if (part.inlineData?.data) {
          logger.info(`LEGO preview image generated (${model})`);
          return {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
          };
        }
      }

      logger.warn(`No inline image data in preview response (${model})`);
    } catch (error: any) {
      logger.warn(`LEGO preview generation failed with ${model}: ${error.message}`);
      if (!isRetryableModelError(error)) break; // non-retryable error, skip fallback
    }
  }

  logger.warn('LEGO preview generation failed on all models (non-critical)');
  return null;
}
