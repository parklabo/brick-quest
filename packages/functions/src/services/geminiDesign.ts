import { GoogleGenAI, Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { config } from '../config.js';
import { logger } from 'firebase-functions';
import type { DesignResult, DesignDetail } from '@brick-quest/shared';
import { getBrickHeight, fromLegacyShape, getGeminiShapeEnum, getGeminiShapeDescriptions, fixBuildPhysics } from '@brick-quest/shared';

const getAI = () => new GoogleGenAI({ apiKey: config.gemini.apiKey });

const DESIGN_TIMEOUT = 8 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${operation} timed out after ${Math.round(timeoutMs / 1000 / 60)} minutes`)), timeoutMs);
    promise.then((r) => { clearTimeout(id); resolve(r); }).catch((e) => { clearTimeout(id); reject(e); });
  });
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

  const complexityConfig: Record<DesignDetail, { instruction: string; minBricks: number; brickRange: string; maxOutput: number; thinking: number }> = {
    simple: {
      instruction: 'Simplified build — capture the basic silhouette and key colors. Use larger bricks (2x4, 2x6) predominantly.',
      minBricks: 25,
      brickRange: '25-50 bricks, 2x4/2x6 predominantly',
      maxOutput: 32768,
      thinking: 8192,
    },
    standard: {
      instruction: 'Standard Brickheadz-style build — solid, complete model with all key features, colors, and proportions. No gaps or holes in the surface.',
      minBricks: 80,
      brickRange: '80-150 bricks, mix of 2x4 structure + 1x2 detail',
      maxOutput: 65536,
      thinking: 16384,
    },
    detailed: {
      instruction: 'Maximum detail — capture fine details, textures, facial features, accessories, and patterns. Use small bricks (1x1, 1x2) for pixel-art precision.',
      minBricks: 150,
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
    ? `\nCOMPOSITE VIEW PROVIDED: You have been given a single image containing a 2×2 grid of 4 views (hero 3/4 angle, front, right side, back) of the LEGO model. Use all 4 views to design accurate building instructions. The views show the exact shape, proportions, and color placement from each angle. Match your build plan to these views precisely.\n`
    : '';

  const prompt = `You are a world-class LEGO Master Builder designing a Brickheadz-style model.
${viewsInstruction}
TASK:
1. Describe what you see in the photo (1-2 sentences)
2. Design a SOLID, COMPLETE Brickheadz-style LEGO model with NO gaps or holes
3. Generate step-by-step 3D assembly instructions — LAYER BY LAYER from bottom to top

${themeInstruction}
DETAIL LEVEL: ${detail.toUpperCase()}
${complexityInstruction}
TARGET: ${cfg.brickRange}. Do NOT generate fewer than ${cfg.minBricks} bricks — an incomplete model is worse than no model.

SHAPES (use exact shape IDs):
${getGeminiShapeDescriptions()}

BRICKHEADZ BUILD STRATEGY:
The model is a chunky, blocky character built on a roughly 6x6 to 10x10 stud footprint.
Think of the model as a stack of LAYERS. Each layer is a horizontal slice at a certain Y height.

TYPICAL STRUCTURE (bottom to top):
- Y=0.0 to Y=2.4: FEET/BASE — 2-3 layers of bricks forming a solid rectangular base
- Y=2.4 to Y=6.0: BODY/TORSO — 3-4 layers, slightly wider, with color details (shirt, logo, arms)
- Y=6.0 to Y=10.8: HEAD — 4-5 layers, large cubic head with face details (eyes, mouth, nose)
- Y=10.8+: TOP — hair, hat, ears, accessories on top of head

EACH LAYER should:
- Fill the ENTIRE footprint for that section (no missing bricks = no gaps in the surface)
- Use multiple bricks side by side to cover the width and depth
- Example: a 6-wide body layer at Y=2.4 might need: 2x4 brick at x=1, 2x2 brick at x=5 (filling the row)

PART SELECTION RULES:
- Prefer LARGER bricks (2x4, 2x6, 2x3) to fill areas efficiently
- Use 1x1, 1x2 bricks for color details and fine adjustments
- Use plates (height=0.4) for thin color stripes or eyes
- Use slopes for head top, shoulders, feet angles
- Use round/dome for eyes or rounded features
- Match colors to the reference photo/views

3D COORDINATE RULES (CRITICAL):
- Grid: 1 stud = 1 unit on X (left-right) and Z (front-back)
- Y axis = vertical (up). y value = BOTTOM of the part
- Heights: brick/slope = 1.2 units, plate/tile = 0.4 units

POSITION FORMULA — center of the brick:
- Even dimension → position = n + 0.5 (where n is an integer: 0.5, 1.5, 2.5, …)
- Odd dimension  → position = n (where n is an integer: 0, 1, 2, 3, …)
EXAMPLES:
- 2x4 brick: W=2(even)→x=0.5 or 1.5, L=4(even)→z=1.5 or 3.5
- 1x1 brick: W=1(odd)→x=0 or 1 or 2, L=1(odd)→z=0 or 1 or 2
- 1x2 plate: W=1(odd)→x=3, L=2(even)→z=0.5
- 2x2 brick: W=2(even)→x=2.5, L=2(even)→z=2.5

STACKING (calculate Y carefully):
- Layer 0: y=0.0 (ground level, bricks)
- Layer 1: y=1.2 (on top of layer 0 bricks)
- Layer 2: y=2.4 (on top of layer 1 bricks)
- Layer 3: y=3.6, Layer 4: y=4.8, Layer 5: y=6.0, etc.
- If using plates: y increments by 0.4 instead of 1.2

WORKED EXAMPLE — filling a 6×6 base layer at y=0.0:
  stepId=1: 2x4 brick at x=0.5, z=1.5 (covers studs 0-1 wide, 0-3 deep)
  stepId=2: 2x4 brick at x=0.5, z=5.5 (covers studs 0-1 wide, 4-7 deep — error: too far! should be z=4.5 → 3-5)
  CORRECTED stepId=2: 2x4 brick at x=0.5, z=4.5 (studs 0-1 wide, 3-5 deep — no overlap with step 1)
  stepId=3: 2x4 brick at x=2.5, z=1.5
  stepId=4: 2x4 brick at x=2.5, z=4.5
  stepId=5: 2x4 brick at x=4.5, z=1.5
  stepId=6: 2x4 brick at x=4.5, z=4.5
  → 6 bricks tile a 6×6 base with NO gaps and NO overlaps.

PLANNING PROCESS — follow these steps mentally before generating:
1. Decide the bounding box (e.g., 6 wide × 6 deep × 12 tall)
2. Divide into layers at each Y increment (0.0, 1.2, 2.4, …)
3. For each layer, decide what shape/color fills each region
4. Generate all steps for that layer before moving to the next

BRICK COUNT: ${cfg.brickRange}
You MUST generate at least ${cfg.minBricks} bricks. A model with fewer bricks will look incomplete and broken.

VALIDATION RULES:
- NO floating parts — every part (except y=0) must rest on parts below
- NO overlapping — parts at the same Y cannot share the same XZ space
- SOLID model — from any viewing angle, you should NOT see through the model
- BUILD ORDER — strictly bottom-to-top, layer by layer (low Y first, high Y last)

Keep step descriptions SHORT (3-8 words).
Return ONLY valid JSON.`;

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`Design attempt ${attempt}/${MAX_RETRIES}`);

      const contentParts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [
        { inlineData: { mimeType, data: base64Image } },
      ];
      if (compositeView) {
        contentParts.push(
          { text: '[Composite Views: hero 3/4, front, right side, back — 2×2 grid]' },
          { inlineData: { mimeType: compositeView.mimeType, data: compositeView.data } },
        );
      }
      contentParts.push({ text: prompt });

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

        step.shape = fromLegacyShape(step.shape || 'rectangle', step.type);

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

      // Physics correction
      const beforeCount = raw.steps.length;
      raw.steps = fixBuildPhysics(raw.steps);
      if (raw.steps.length < beforeCount) {
        logger.info(`Physics fix removed ${beforeCount - raw.steps.length} overlapping steps (${raw.steps.length} remaining)`);
      }

      // Build requiredParts from the final steps
      const partsMap = new Map<string, any>();
      for (const step of raw.steps) {
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

      const result: DesignResult = {
        buildPlan: {
          title: raw.title || 'LEGO Creation',
          description: raw.description || 'A LEGO recreation',
          lore: raw.lore || 'Inspired by real life.',
          steps: raw.steps,
        },
        requiredParts: Array.from(partsMap.values()),
        referenceDescription: raw.referenceDescription || 'An object from the photo.',
      };

      logger.info(`Design generated: ${result.buildPlan.steps.length} steps, ${result.requiredParts.length} unique parts`);
      return result;
    } catch (error: any) {
      logger.error(`Attempt ${attempt} failed:`, error.message);
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
      }
    }
  }

  throw lastError || new Error('Failed to generate design after multiple attempts.');
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
