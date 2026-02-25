import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { config, LIMITS } from '../config.js';
import { logger } from 'firebase-functions';
import type { DesignResult, DesignDetail, BuildStepBlock, VoxelGrid } from '@brick-quest/shared';
import { validateVoxelGrid, voxelGridToBricks, buildVoxelDesignPrompt } from '@brick-quest/shared';
import { withTimeout } from '../utils/with-timeout.js';
import { getAI, getThinkingConfig } from './gemini-client.js';

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
    simple: 'Use large bricks (2x4, 2x6). Simplified blocky shape, about 25-50 bricks total.',
    standard: 'Mix of standard bricks, plates, and slopes. About 80-150 bricks total.',
    detailed: 'Use small bricks (1x1, 1x2) for fine pixel detail. About 150-300 bricks total.',
  };

  return `STEP 1 — ANALYZE THE REFERENCE PHOTO:
Before generating anything, carefully study the reference photo and identify:
- The character/subject's EXACT colors (hair, skin, clothing, accessories)
- Distinctive features (glasses, hat, ears, tail, wings, logos, patterns, facial expression)
- Body proportions (head-to-body ratio, limb positions)
- Key accessories or held items
- Color palette — list the top 5 colors and where they appear

STEP 2 — DESIGN A SINGLE 3D LEGO MODEL:
Design ONE definitive LEGO Brickheadz model that captures ALL the distinctive features identified above. This model must be fully resolved in 3D — every brick placement is decided BEFORE rendering any view. Think of it as a real physical LEGO model sitting on a table.

STEP 3 — RENDER 4 VIEWS of that SINGLE model into a 2×2 grid image:

LAYOUT — 2×2 grid, each quadrant clearly separated by a thin white gap:
┌──────────────────┬──────────────────┐
│    TOP-LEFT      │    TOP-RIGHT     │
│    3/4 Hero      │    Front View    │
│    Angle         │    (straight-on) │
├──────────────────┼──────────────────┤
│   BOTTOM-LEFT    │   BOTTOM-RIGHT   │
│   Right Side     │    Back View     │
│   View           │                  │
└──────────────────┴──────────────────┘

VIEW DESCRIPTIONS:
• TOP-LEFT (Hero): Classic LEGO box art 3/4 angle — camera slightly above and to the left. Shows front + top + left side. This is the "money shot."
• TOP-RIGHT (Front): Straight-on front view, camera at eye level. ALL facial features, chest details, and front colors must be sharp and detailed — this view is just as important as the hero shot.
• BOTTOM-LEFT (Side): 90° to the right of front. Profile/silhouette must show correct depth, arm positions, and side details with EQUAL quality to the hero shot.
• BOTTOM-RIGHT (Back): 180° from front. Must show rear details (back of head, clothing back, tail if any) with EQUAL quality and detail.

ABSOLUTE REQUIREMENTS — CONSISTENCY:
All 4 quadrants show the EXACT SAME physical LEGO model. Imagine one real LEGO model on a turntable, photographed from 4 angles under identical studio lighting.
- SAME brick colors in EVERY view (a red brick on the front must be red from the side too)
- SAME proportions and silhouette from all angles
- SAME level of brick detail and stud visibility in ALL 4 views
- SAME lighting, shadows, and background across all quadrants
- If the character has asymmetric features (e.g., a logo on one side), they must appear in the correct views

QUALITY RULE: Views 2, 3, and 4 must have IDENTICAL rendering quality to the hero view. Do NOT reduce detail, blur, or simplify any view. Every view is a hero shot from a different angle.

CHARACTER FIDELITY:
- The LEGO model must be INSTANTLY RECOGNIZABLE as the character in the reference photo
- Capture the character's most iconic features FIRST (e.g., if they wear glasses → glasses must be prominent)
- Match the reference photo's color palette as closely as possible using LEGO brick colors
- Preserve the character's personality and expression in the blocky LEGO style

REAL LEGO BUILDABILITY (CRITICAL):
This model must look like it could ACTUALLY BE BUILT with real LEGO parts you can buy.
- Use ONLY real LEGO brick types: standard bricks (1x1, 1x2, 1x3, 1x4, 2x2, 2x3, 2x4, 2x6), plates, tiles, slopes (25°, 33°, 45°, 65°), curved slopes, arches, round bricks/plates, cones, domes
- Every brick must be a standard LEGO size — NO custom-cut or impossible shapes
- Bricks must connect via standard LEGO stud-and-tube connections — NO floating parts, NO glue
- Colors must be real LEGO production colors (bright red, blue, white, black, tan, dark bluish gray, light bluish gray, bright green, yellow, orange, dark red, dark blue, dark green, medium nougat, reddish brown, etc.)
- Visible connection points: cylindrical studs on top of bricks, anti-studs (tubes) underneath
- Brick seams and stud patterns must follow a consistent grid — all bricks aligned to the same stud grid

BUILD STYLE:
- Brickheadz / nanoblock style — a chunky, blocky 3D sculpture made by stacking real LEGO bricks
- Individual bricks must be clearly distinguishable — you can count the studs
- Sharp, crisp brick edges with visible seams between every brick
- Stepped/pixelated surfaces like 3D pixel art — NOT smooth, NOT rounded
- Studs must be uniform cylindrical bumps on a regular grid
- ${detailInstructions[detail]}

DO NOT: smooth or rounded surfaces, organic curves, minifigure style, stickers, printed tiles, non-LEGO parts, flat 2D look, lower quality on any view, invented/impossible brick shapes, bricks floating without connection, custom colors not in LEGO palette

STYLE: Official LEGO Brickheadz product photo — as if photographed for the LEGO.com product page. White/light gray background per quadrant. Soft studio lighting showing depth and shadows. High resolution, sharp brick edges and visible studs in ALL views.${userPrompt ? `\n\nUser note: "${userPrompt}"` : ''}`;
}

function isRetryableModelError(error: any): boolean {
  const msg = String(error?.message || '');
  return /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out/i.test(msg);
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
  onProgress?: (msg: string) => Promise<void>
): Promise<{ result: DesignResult; usedFallbackModel: boolean }> {
  const ai = getAI();

  // Voxel grid schema — much simpler than brick-placement schema
  const voxelSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      referenceDescription: { type: Type.STRING, description: 'Describe what you see in the photo (1-2 sentences)' },
      title: { type: Type.STRING, description: 'Name of the LEGO creation' },
      description: { type: Type.STRING, description: 'Short description of the model' },
      lore: { type: Type.STRING, description: 'A creative backstory for this LEGO version' },
      width: { type: Type.INTEGER, description: 'Grid width in studs (X axis)' },
      depth: { type: Type.INTEGER, description: 'Grid depth in studs (Z axis)' },
      layers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            y: { type: Type.INTEGER, description: 'Layer index (0 = ground)' },
            heightType: { type: Type.STRING, enum: ['brick', 'plate'], description: 'brick=1.2 units, plate=0.4 units' },
            grid: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: 'Hex color (e.g. "#FF0000") or "" for empty' },
              },
              description: 'grid[z][x] — rows front→back, columns left→right',
            },
          },
          required: ['y', 'heightType', 'grid'],
        },
      },
    },
    required: ['referenceDescription', 'title', 'description', 'lore', 'width', 'depth', 'layers'],
  };

  const outputConfig: Record<DesignDetail, { maxOutput: number; thinkingLevel: 'low' | 'medium' | 'high' }> = {
    simple: { maxOutput: 40000, thinkingLevel: 'low' },
    standard: { maxOutput: 100000, thinkingLevel: 'medium' },
    detailed: { maxOutput: 200000, thinkingLevel: 'high' },
  };

  const cfg = outputConfig[detail];
  const prompt = buildVoxelDesignPrompt(detail, userPrompt, !!compositeView);

  // Track best result across agent iterations
  let bestResult: { result: DesignResult; brickCount: number; qualityScore: number } | null = null;
  let feedbackPrompt = '';
  const modelChain = config.gemini.modelChain;
  let modelIndex = 0;
  let useModel = modelChain[0];
  let usedFallback = false;
  let prevQualityScore = 0;
  const agentStart = Date.now();

  for (let iteration = 1; iteration <= AGENT_MAX_ITERATIONS; iteration++) {
    const elapsed = Date.now() - agentStart;
    const remaining = AGENT_BUDGET_MS - elapsed;

    if (remaining < 60_000 && bestResult) {
      logger.info(`Agent: ${Math.round(elapsed / 1000)}s elapsed, using best result (${bestResult.brickCount} bricks)`);
      break;
    }

    logger.info(`Agent iteration ${iteration}/${AGENT_MAX_ITERATIONS} (model: ${useModel}, ${Math.round(remaining / 1000)}s remaining)`);

    if (onProgress && iteration > 1) {
      await onProgress(`Improving build (attempt ${iteration}/${AGENT_MAX_ITERATIONS})...`);
    }

    const currentPrompt = feedbackPrompt ? `${prompt}\n\n${feedbackPrompt}` : prompt;

    // Inner parse-retry loop
    const PARSE_RETRIES = 5;
    const PER_CALL_TIMEOUT = 90_000;
    let lastError: Error | null = null;
    let iterationSteps: BuildStepBlock[] | null = null;
    let iterationMeta: { title: string; description: string; lore: string; referenceDescription: string } | null = null;
    let iterationVoxelGrid: VoxelGrid | null = null;
    for (let attempt = 1; attempt <= PARSE_RETRIES; attempt++) {
      const budgetRemaining = AGENT_BUDGET_MS - (Date.now() - agentStart);
      if (budgetRemaining < 30_000) {
        logger.warn(`  Skipping attempt ${attempt} — only ${Math.round(budgetRemaining / 1000)}s remaining`);
        break;
      }

      try {
        logger.info(`  Parse attempt ${attempt}/${PARSE_RETRIES}`);

        const contentParts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [
          { inlineData: { mimeType, data: base64Image } },
        ];
        if (compositeView) {
          contentParts.push(
            { text: '[Composite Views: hero 3/4, front, right side, back — 2×2 grid]' },
            { inlineData: { mimeType: compositeView.mimeType, data: compositeView.data } }
          );
        }
        contentParts.push({ text: currentPrompt });

        const callTimeout = Math.min(PER_CALL_TIMEOUT, budgetRemaining - 5_000);

        const response = await withTimeout(
          ai.models.generateContent({
            model: useModel,
            contents: contentParts,
            config: {
              responseMimeType: 'application/json',
              responseSchema: voxelSchema,
              maxOutputTokens: cfg.maxOutput,
              thinkingConfig: getThinkingConfig(useModel, cfg.thinkingLevel),
              systemInstruction:
                'You are an award-winning LEGO Master Builder. Output a 3D color grid (voxel grid) representing the LEGO model. Each layer is a 2D array of hex color strings.',
            },
          }),
          callTimeout,
          'Voxel grid generation'
        );

        if (!response.text) {
          lastError = new Error('Empty response');
          continue;
        }

        const raw = JSON.parse(response.text);

        if (!Array.isArray(raw.layers) || raw.layers.length === 0) {
          lastError = new Error('No valid layers in voxel grid');
          continue;
        }

        // Validate and normalize the voxel grid
        const voxelGrid: VoxelGrid = validateVoxelGrid({
          title: raw.title || 'LEGO Creation',
          description: raw.description || 'A LEGO recreation',
          lore: raw.lore || 'Inspired by real life.',
          referenceDescription: raw.referenceDescription,
          width: raw.width || 8,
          depth: raw.depth || 8,
          layers: raw.layers,
        });

        if (voxelGrid.layers.length === 0) {
          lastError = new Error('All layers empty after validation');
          continue;
        }

        // Convert voxel grid to brick placements — deterministic, no physics needed
        const { steps, report } = voxelGridToBricks(voxelGrid);

        logger.info(
          `  Voxel conversion: ${report.totalVoxels} voxels → ${report.totalBricks} bricks ` +
            `(avg size ${report.averageBrickSize.toFixed(1)}, ${report.layerCount} layers)`
        );

        if (steps.length === 0) {
          lastError = new Error('Voxel conversion produced 0 bricks');
          continue;
        }

        iterationSteps = steps;
        iterationVoxelGrid = voxelGrid;
        iterationMeta = {
          title: voxelGrid.title,
          description: voxelGrid.description,
          lore: voxelGrid.lore,
          referenceDescription: voxelGrid.referenceDescription || 'An object from the photo.',
        };
        break;
      } catch (error: any) {
        logger.error(`  Parse attempt ${attempt} failed:`, error.message);
        lastError = error;
        if (isRetryableModelError(error)) {
          // Switch model immediately instead of burning a full agent iteration
          if (modelIndex < modelChain.length - 1) {
            modelIndex++;
            useModel = modelChain[modelIndex];
            usedFallback = modelIndex > 0;
            logger.info(`Switching to next model in chain: ${useModel} (${modelIndex + 1}/${modelChain.length})`);
            if (onProgress) {
              await onProgress(`Switched to ${useModel} (model ${modelIndex + 1}/${modelChain.length})`);
            }
            continue;
          }
          break; // All models exhausted
        }
        if (attempt < PARSE_RETRIES) {
          await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
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
    let qualityFeedback = '';
    let evaluation: BuildEvaluation | null = null;

    if (compositeView) {
      const evalRemaining = AGENT_BUDGET_MS - (Date.now() - agentStart);
      if (evalRemaining > EVAL_TIMEOUT + 30_000) {
        try {
          evaluation = await evaluateBuildQuality(compositeView, iterationSteps);
          qualityScore = evaluation.overallScore;
          qualityFeedback = evaluation.improvements;

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
    const scorePlateau = iteration > 1 && qualityScore - prevQualityScore < 1;
    prevQualityScore = qualityScore;

    if (qualityAcceptable || scorePlateau) {
      const reason = qualityAcceptable
        ? `quality ${qualityScore}/10 ≥ ${QUALITY_ACCEPT_THRESHOLD}`
        : `quality plateaued (${prevQualityScore} → ${qualityScore})`;
      logger.info(`Agent iteration ${iteration}: accepted — ${iterationSteps.length} bricks, ${reason}`);
      break;
    }

    // Build quality feedback for next iteration (no physics feedback needed)
    if (iteration < AGENT_MAX_ITERATIONS) {
      if (qualityFeedback) {
        const missingStr = evaluation?.missingFeatures.length ? `\nMISSING FEATURES: ${evaluation.missingFeatures.join(', ')}` : '';
        feedbackPrompt = `QUALITY EVALUATION (score: ${qualityScore}/10):${missingStr}\n\n${qualityFeedback}\n\nFix the issues above in your next voxel grid. Keep the same grid format.`;
        logger.info(`Agent iteration ${iteration}: quality ${qualityScore}/10, retrying with visual feedback`);
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
  return { result, usedFallbackModel: usedFallback };
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
