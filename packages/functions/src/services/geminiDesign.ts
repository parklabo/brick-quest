import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { config, LIMITS } from '../config.js';
import { logger } from 'firebase-functions';
import type { DesignResult, DesignDetail, BuildStepBlock } from '@brick-quest/shared';
import { getBrickHeight, resolveShape, getGeminiShapeEnum, getGeminiShapeDescriptions, fixBuildPhysicsWithReport, COORDINATE_SYSTEM_PROMPT, CRITICAL_RULES_PROMPT } from '@brick-quest/shared';
import { withTimeout } from '../utils/with-timeout.js';
import { needsAgentRetry, buildPhysicsFeedback } from '../utils/physics-feedback.js';
import { getAI } from './gemini-client.js';

const DESIGN_TIMEOUT = 8 * 60 * 1000;
const { AGENT_MAX_ITERATIONS } = LIMITS;

function buildCountFeedback(actualCount: number, targetMin: number, brickRange: string): string {
  return `BRICK COUNT FEEDBACK — You only generated ${actualCount} bricks. The MINIMUM target is ${targetMin} and the ideal range is ${brickRange}.

INSTRUCTIONS TO GENERATE MORE BRICKS:
- Build MORE LAYERS. A typical Brickheadz needs 10-14 layers of bricks stacked vertically.
- Each layer must FULLY TILE its footprint — an 8×6 footprint needs 8-12 bricks per layer.
- Add fine details: eyes, mouth, accessories, hair, ears, patterns using 1x1 and 1x2 bricks.
- Add feet/base layers (2-3 layers), body layers (3-4 layers), head layers (4-6 layers), and top features (1-2 layers).
- Do NOT leave gaps — every stud position in the model's silhouette must be covered by a brick.
- You MUST generate at LEAST ${targetMin} bricks total. Count your bricks before finishing.`;
}

export interface ImageData {
  data: string;      // base64
  mimeType: string;
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

/**
 * Generate a single composite image with 4 views (hero, front, side, back) of a LEGO model.
 * Uses a single Gemini image generation call for consistency across views.
 */
export async function generateOrthographicViews(
  base64Image: string,
  mimeType: string,
  detail: DesignDetail = 'standard',
  userPrompt = '',
): Promise<ImageData> {
  const ai = getAI();
  const prompt = compositeViewPrompt(detail, userPrompt);

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`Generating composite views, attempt ${attempt}/${MAX_RETRIES}`);

      const response = await withTimeout(
        ai.models.generateContent({
          model: config.gemini.imageModel,
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64Image } },
              { text: prompt },
            ],
          },
          config: {
            responseModalities: ['IMAGE', 'TEXT'],
          },
        }),
        DESIGN_TIMEOUT,
        'composite views generation',
      );

      const candidates = response.candidates;
      if (!candidates?.[0]?.content?.parts) {
        lastError = new Error('No parts in composite views response');
        continue;
      }

      for (const part of candidates[0].content.parts) {
        if (part.inlineData?.data) {
          logger.info('Composite views generated successfully');
          return {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
          };
        }
      }

      lastError = new Error('No image data in composite views response');
    } catch (error: any) {
      logger.error(`Composite views attempt ${attempt} failed:`, error.message);
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
      }
    }
  }

  throw lastError || new Error('Failed to generate composite views');
}

export async function generateDesignFromPhoto(
  base64Image: string,
  mimeType: string,
  detail: DesignDetail = 'standard',
  userPrompt = '',
  compositeView?: ImageData,
): Promise<DesignResult> {
  const ai = getAI();

  const designSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      referenceDescription: { type: Type.STRING, description: 'Describe what you see in the photo (1-2 sentences)' },
      title: { type: Type.STRING, description: 'Name of the LEGO creation' },
      description: { type: Type.STRING, description: 'Short description of the model' },
      lore: { type: Type.STRING, description: 'A creative backstory for this LEGO version' },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            stepId: { type: Type.INTEGER },
            partName: { type: Type.STRING },
            color: { type: Type.STRING },
            hexColor: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['brick', 'plate', 'tile', 'slope', 'technic', 'minifig', 'other'] },
            shape: { type: Type.STRING, enum: getGeminiShapeEnum() },
            width: { type: Type.INTEGER, description: 'Width in studs (shorter side)' },
            length: { type: Type.INTEGER, description: 'Length in studs (longer side)' },
            position: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                z: { type: Type.NUMBER },
              },
              required: ['x', 'y', 'z'],
            },
            rotation: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                z: { type: Type.NUMBER },
              },
              required: ['x', 'y', 'z'],
            },
            description: { type: Type.STRING },
          },
          required: ['stepId', 'partName', 'color', 'hexColor', 'type', 'shape', 'width', 'length', 'position', 'description'],
        },
      },
    },
    required: ['referenceDescription', 'title', 'description', 'lore', 'steps'],
  };

  const complexityConfig: Record<DesignDetail, { instruction: string; minBricks: number; targetMin: number; brickRange: string; maxOutput: number; thinking: number }> = {
    simple: {
      instruction: 'Simplified build — capture the basic silhouette and key colors. Use larger bricks (2x4, 2x6) predominantly.',
      minBricks: 25,
      targetMin: 35,
      brickRange: '25-50 bricks, 2x4/2x6 predominantly',
      maxOutput: 32768,
      thinking: 8192,
    },
    standard: {
      instruction: 'Standard Brickheadz-style build — solid, complete model with all key features, colors, and proportions. No gaps or holes in the surface.',
      minBricks: 80,
      targetMin: 100,
      brickRange: '80-150 bricks, mix of 2x4 structure + 1x2 detail',
      maxOutput: 65536,
      thinking: 16384,
    },
    detailed: {
      instruction: 'Maximum detail — capture fine details, textures, facial features, accessories, and patterns. Use small bricks (1x1, 1x2) for pixel-art precision.',
      minBricks: 150,
      targetMin: 200,
      brickRange: '150-300 bricks, 1x1/1x2 for pixel precision',
      maxOutput: 131072,
      thinking: 32768,
    },
  };

  const cfg = complexityConfig[detail];
  const complexityInstruction = cfg.instruction;

  const themeInstruction = userPrompt
    ? `USER NOTE: "${userPrompt}". Consider this when designing.`
    : '';

  const viewsInstruction = compositeView
    ? `
COMPOSITE VIEW PROVIDED:
You have a 2×2 grid image showing 4 views of the target LEGO model:
- Top-left: Hero 3/4 angle (overall shape + depth)
- Top-right: Front view (face details, front colors)
- Bottom-left: Right side view (profile, depth, side features)
- Bottom-right: Back view (rear details)

BEFORE generating any bricks, analyze these views carefully:
1. FRONT VIEW → determines what you see on the Z=0 face (colors, eyes, mouth, details per X column)
2. SIDE VIEW → determines what you see on the X=max face (depth, profile shape per Z column)
3. BACK VIEW → determines what you see on the Z=max face (back details, colors)
4. HERO VIEW → confirms overall 3D shape, proportions, and color placement
Use these views as your BLUEPRINT. Every layer you generate must match what the views show at that Y height.
`
    : '';

  const prompt = `You are a LEGO Master Builder. Your job is to convert the reference image into a SOLID Brickheadz-style LEGO model with PRECISE brick-by-brick assembly instructions.
${viewsInstruction}
${themeInstruction}
DETAIL LEVEL: ${detail.toUpperCase()}
${complexityInstruction}
TARGET: ${cfg.brickRange}. Do NOT generate fewer than ${cfg.minBricks} bricks.

SHAPES (use exact shape IDs):
${getGeminiShapeDescriptions()}

═══════════════════════════════════════
COORDINATE SYSTEM
═══════════════════════════════════════
- X axis = left-right, Z axis = front-back, Y axis = up
- 1 stud = 1 unit on X and Z
- Y value = BOTTOM of the brick
- Brick height = 1.2 units, Plate/tile height = 0.4 units
- Position = CENTER of the brick

POSITION RULES (center-based):
  Even dimension → x or z ends in .5 (examples: 0.5, 1.5, 2.5)
  Odd dimension  → x or z is integer (examples: 0, 1, 2, 3)

COVERAGE: a brick at position (px, pz) with size WxL covers:
  X range: [px - W/2, px + W/2]
  Z range: [pz - L/2, pz + L/2]

═══════════════════════════════════════
LAYER-BY-LAYER BUILD METHOD (MANDATORY)
═══════════════════════════════════════
You MUST build the model as a stack of horizontal layers. Each layer is at a specific Y height.

STEP 1 — DEFINE THE MODEL:
- Bounding box: decide width (X), depth (Z), and height (number of layers)
- Typical Brickheadz: 8 wide × 6 deep × 10-12 layers tall
- Sections: feet (2 layers) → body (3-4 layers) → head (4-5 layers) → top features

STEP 2 — FOR EACH LAYER (from bottom Y=0.0 upward):
a) Determine the FOOTPRINT of this layer (which stud positions are filled)
b) Determine the COLOR of each stud position (match the reference views)
c) TILE the footprint completely with bricks — NO gaps allowed
d) Use larger bricks (2x4, 2x3, 2x2) first, fill remaining gaps with 1x2 and 1x1

TILING RULE: For each layer, mentally draw a grid of the footprint. EVERY cell must be covered by exactly one brick. If you can't fit a large brick, use smaller ones.

STEP 3 — ADD DETAILS:
- Eyes: use 1x1 plates or tiles at the correct Y height on the front face
- Accessories: glasses, hair, hats, ears — add as extra bricks on the appropriate layer

═══════════════════════════════════════
COMPLETE WORKED EXAMPLE — 4×4 base, 3 layers
═══════════════════════════════════════
Model footprint: 4 wide (X: 0-3) × 4 deep (Z: 0-3)

LAYER 0 (y=0.0) — fill entire 4×4 with blue bricks:
  Grid:  [B B B B]   (B = blue, each cell = 1 stud)
         [B B B B]
         [B B B B]
         [B B B B]
  Tiling with 2x4 bricks:
    step 1: 2x4 blue brick → x=0.5, y=0.0, z=1.5 (covers X:0-1, Z:0-3) ✓
    step 2: 2x4 blue brick → x=2.5, y=0.0, z=1.5 (covers X:2-3, Z:0-3) ✓
  CHECK: 2 bricks × 8 studs = 16 studs = 4×4 footprint ✓ No gaps ✓

LAYER 1 (y=1.2) — fill 4×4 with blue, white face stripe:
  Grid:  [B B B B]
         [W W W W]   ← white face row at Z=1
         [W W W W]   ← white face row at Z=2
         [B B B B]
  Tiling:
    step 3: 1x4 blue brick → x=0.5, y=1.2, z=0 (covers X:0-1, Z:0) — WAIT, 1x4 means W=1,L=4 → x=integer, z=.5
    CORRECT: step 3: 2x1 blue brick → x=0.5, y=1.2, z=0 (covers X:0-1, Z:0)
    step 4: 2x1 blue brick → x=2.5, y=1.2, z=0 (covers X:2-3, Z:0)
    step 5: 2x2 white brick → x=0.5, y=1.2, z=1.5 (covers X:0-1, Z:1-2)
    step 6: 2x2 white brick → x=2.5, y=1.2, z=1.5 (covers X:2-3, Z:1-2)
    step 7: 2x1 blue brick → x=0.5, y=1.2, z=3 (covers X:0-1, Z:3)
    step 8: 2x1 blue brick → x=2.5, y=1.2, z=3 (covers X:2-3, Z:3)
  CHECK: covers all 16 studs ✓ Colors match grid ✓

LAYER 2 (y=2.4) — eyes on white face:
  Grid:  [B B B B]
         [B K B K]   ← K = black 1x1 eyes at (1,1) and (3,1)
         [W W W W]
         [B B B B]
  Tiling:
    step 9:  2x1 blue brick → x=0.5, y=2.4, z=0
    step 10: 2x1 blue brick → x=2.5, y=2.4, z=0
    step 11: 1x1 blue brick → x=0, y=2.4, z=1
    step 12: 1x1 black brick → x=1, y=2.4, z=1 ← LEFT EYE
    step 13: 1x1 blue brick → x=2, y=2.4, z=1
    step 14: 1x1 black brick → x=3, y=2.4, z=1 ← RIGHT EYE
    step 15: 2x2 white brick → x=0.5, y=2.4, z=2.5 — WAIT, Z:2-3 but row Z=3 should be blue
    CORRECT:
    step 15: 2x1 white brick → x=0.5, y=2.4, z=2
    step 16: 2x1 white brick → x=2.5, y=2.4, z=2
    step 17: 2x1 blue brick → x=0.5, y=2.4, z=3
    step 18: 2x1 blue brick → x=2.5, y=2.4, z=3
  CHECK: 10 bricks, all 16 studs covered ✓ Eyes placed correctly ✓

═══════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════
1. ZERO GAPS: Every stud position within the layer footprint MUST be covered. Count the studs!
2. ZERO OVERLAPS: No two bricks on the same layer can cover the same stud position.
3. LAYER STACKING: Each layer must sit on the previous layer. Y increments: +1.2 for bricks, +0.4 for plates.
4. SOLID FROM ALL SIDES: Looking at the model from front, back, left, right — no holes visible.
5. MATCH THE REFERENCE: Colors and features must match the reference photo/views at each layer height.
6. SELF-CHECK: After mentally placing all bricks in a layer, verify total stud coverage = footprint area.

BRICK COUNT: ${cfg.brickRange}
You MUST generate at least ${cfg.minBricks} bricks.

Keep step descriptions SHORT (3-8 words).
Return ONLY valid JSON.`;

  // Track best result across agent iterations
  let bestResult: { result: DesignResult; survivingCount: number } | null = null;
  let feedbackPrompt = '';

  for (let iteration = 1; iteration <= AGENT_MAX_ITERATIONS; iteration++) {
    logger.info(`Agent iteration ${iteration}/${AGENT_MAX_ITERATIONS}`);

    const currentPrompt = feedbackPrompt
      ? `${prompt}\n\n${feedbackPrompt}`
      : prompt;

    // Inner parse-retry loop
    const PARSE_RETRIES = 3;
    let lastError: Error | null = null;
    let iterationSteps: BuildStepBlock[] | null = null;
    let iterationMeta: { title: string; description: string; lore: string; referenceDescription: string } | null = null;

    for (let attempt = 1; attempt <= PARSE_RETRIES; attempt++) {
      try {
        logger.info(`  Parse attempt ${attempt}/${PARSE_RETRIES}`);

        const contentParts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [
          { inlineData: { mimeType, data: base64Image } },
        ];
        if (compositeView) {
          contentParts.push(
            { text: '[Composite Views: hero 3/4, front, right side, back — 2×2 grid]' },
            { inlineData: { mimeType: compositeView.mimeType, data: compositeView.data } },
          );
        }
        contentParts.push({ text: currentPrompt });

        const response = await withTimeout(
          ai.models.generateContent({
            model: config.gemini.model,
            contents: {
              parts: contentParts,
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: designSchema,
              maxOutputTokens: cfg.maxOutput,
              thinkingConfig: { thinkingBudget: cfg.thinking },
              systemInstruction: 'You are an award-winning LEGO Master Builder who specializes in recreating real-world objects as LEGO models. You have expert-level 3D spatial reasoning.',
            },
          }),
          DESIGN_TIMEOUT,
          'Design generation',
        );

        if (!response.text) {
          lastError = new Error('Empty response');
          continue;
        }

        const raw = JSON.parse(response.text);

        if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
          lastError = new Error('No valid steps');
          continue;
        }

        // Enrich steps with computed fields
        raw.steps = raw.steps.filter((step: any) => {
          if (!step.type || !step.position) return false;

          step.shape = resolveShape(step.shape || 'rectangle', step.type);

          const width = step.width || 2;
          const length = step.length || 2;
          const height = getBrickHeight(step.shape, step.type);

          step.size = { width, height, length };

          if (!step.rotation) step.rotation = { x: 0, y: 0, z: 0 };

          return true;
        });

        if (raw.steps.length === 0) {
          lastError = new Error('All steps invalid after filtering');
          continue;
        }

        // Check minimum brick count before physics
        if (raw.steps.length < cfg.minBricks) {
          logger.warn(`Only ${raw.steps.length} bricks generated (minimum: ${cfg.minBricks}), retrying`);
          lastError = new Error(`Too few bricks: ${raw.steps.length} < ${cfg.minBricks}`);
          continue;
        }

        iterationSteps = raw.steps;
        iterationMeta = {
          title: raw.title || 'LEGO Creation',
          description: raw.description || 'A LEGO recreation',
          lore: raw.lore || 'Inspired by real life.',
          referenceDescription: raw.referenceDescription || 'An object from the photo.',
        };
        break;
      } catch (error: any) {
        logger.error(`  Parse attempt ${attempt} failed:`, error.message);
        lastError = error;
        if (attempt < PARSE_RETRIES) {
          await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
        }
      }
    }

    // If all parse attempts failed for this iteration, continue or use best
    if (!iterationSteps || !iterationMeta) {
      logger.warn(`Agent iteration ${iteration} failed to produce valid steps`);
      if (bestResult) break;
      if (iteration === AGENT_MAX_ITERATIONS) {
        throw lastError || new Error('Failed to generate design after multiple attempts.');
      }
      continue;
    }

    // Physics correction with report
    const { steps: fixedSteps, report } = fixBuildPhysicsWithReport(iterationSteps);

    logger.info(
      `Agent iteration ${iteration}: ${report.inputCount} input → ${report.outputCount} output ` +
      `(${report.droppedCount} dropped=${report.droppedPercentage.toFixed(1)}%, ` +
      `${report.gravitySnappedCount} gravity-snapped, ${report.nudgedCount} nudged)`,
    );

    // Build requiredParts from the final steps
    const partsMap = new Map<string, any>();
    for (const step of fixedSteps) {
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
        steps: fixedSteps,
        agentIterations: iteration,
      },
      requiredParts: Array.from(partsMap.values()),
      referenceDescription: iterationMeta.referenceDescription,
    };

    // Track best result (most surviving bricks)
    if (!bestResult || fixedSteps.length > bestResult.survivingCount) {
      bestResult = { result: iterationResult, survivingCount: fixedSteps.length };
    }

    // Check if results are acceptable (both count and physics)
    const needsMoreBricks = fixedSteps.length < cfg.targetMin;
    const needsPhysicsFix = needsAgentRetry(report);

    if (!needsMoreBricks && !needsPhysicsFix) {
      logger.info(`Agent iteration ${iteration}: acceptable (${fixedSteps.length} bricks, physics OK), done`);
      break;
    }

    // Build feedback for next iteration
    if (iteration < AGENT_MAX_ITERATIONS) {
      const feedbackParts: string[] = [];
      if (needsMoreBricks) {
        feedbackParts.push(buildCountFeedback(fixedSteps.length, cfg.targetMin, cfg.brickRange));
        logger.info(`Agent iteration ${iteration}: only ${fixedSteps.length} bricks (target: ${cfg.targetMin}), requesting more`);
      }
      if (needsPhysicsFix) {
        feedbackParts.push(buildPhysicsFeedback(report));
        logger.info(`Agent iteration ${iteration}: ${report.droppedCount} bricks dropped, requesting improvement`);
      }
      feedbackPrompt = feedbackParts.join('\n\n');
    } else {
      logger.info(`Agent iteration ${iteration}: final iteration, using best result (${fixedSteps.length} bricks)`);
    }
  }

  if (!bestResult) {
    throw new Error('Failed to generate design after multiple attempts.');
  }

  const { result } = bestResult;
  logger.info(`Design generated: ${result.buildPlan.steps.length} steps, ${result.requiredParts.length} unique parts (${result.buildPlan.agentIterations} agent iteration(s))`);
  return result;
}

/**
 * Generate a LEGO-style preview image from a reference photo.
 * Uses Gemini image generation to transform the real object into a LEGO-style rendering.
 * Returns base64-encoded PNG image data, or null if generation fails.
 */
export async function generateLegoPreview(
  base64Image: string,
  mimeType: string,
  referenceDescription: string,
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

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: config.gemini.imageModel,
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: prompt },
          ],
        },
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
      DESIGN_TIMEOUT,
      'LEGO preview generation',
    );

    // Extract generated image from response parts
    const candidates = response.candidates;
    if (!candidates?.[0]?.content?.parts) {
      logger.warn('No image parts in preview response');
      return null;
    }

    for (const part of candidates[0].content.parts) {
      if (part.inlineData?.data) {
        logger.info('LEGO preview image generated');
        return {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
        };
      }
    }

    logger.warn('No inline image data found in preview response');
    return null;
  } catch (error: any) {
    // Preview is non-critical — log and continue without it
    logger.warn(`LEGO preview generation failed (non-critical): ${error.message}`);
    return null;
  }
}
