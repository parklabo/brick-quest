import { GoogleGenAI, Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { config } from '../config.js';
import { logger } from 'firebase-functions';
import type { DetectedPart, BuildPlan, Difficulty } from '@brick-quest/shared';
import { getBrickHeight, fromLegacyShape, getGeminiShapeEnum, getGeminiShapeDescriptions, fixBuildPhysics } from '@brick-quest/shared';

const getAI = () => new GoogleGenAI({ apiKey: config.gemini.apiKey });

const BUILD_TIMEOUT = 8 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${operation} timed out after ${Math.round(timeoutMs / 1000 / 60)} minutes`)), timeoutMs);
    promise.then((r) => { clearTimeout(id); resolve(r); }).catch((e) => { clearTimeout(id); reject(e); });
  });
}

export async function generateBuildPlan(
  parts: DetectedPart[],
  difficulty: Difficulty = 'normal',
  userPrompt = '',
): Promise<BuildPlan> {
  const ai = getAI();

  const buildSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Name of the creation' },
      description: { type: Type.STRING, description: 'Short description of the model' },
      lore: { type: Type.STRING, description: 'A creative backstory for this model' },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            stepId: { type: Type.INTEGER },
            inventoryIndex: { type: Type.INTEGER, description: 'Index of the part in the INVENTORY list (0-based)' },
            partName: { type: Type.STRING },
            color: { type: Type.STRING },
            hexColor: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['brick', 'plate', 'tile', 'slope', 'technic', 'minifig', 'other'] },
            shape: { type: Type.STRING, enum: getGeminiShapeEnum() },
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
            size: {
              type: Type.OBJECT,
              properties: {
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER, description: 'MUST be 1.2 for Brick, 0.4 for Plate' },
                length: { type: Type.NUMBER },
              },
              required: ['width', 'height', 'length'],
            },
            description: { type: Type.STRING },
          },
          required: ['stepId', 'inventoryIndex', 'position', 'size', 'description'],
        },
      },
    },
    required: ['title', 'description', 'lore', 'steps'],
  };

  const inventoryLines = parts.map((p, idx) =>
    `[${idx}] ${p.count}x ${p.color} ${p.name} (${p.dimensions.width}x${p.dimensions.length} studs, type: ${p.type}, shape: ${p.shape})`
  );

  let complexityInstruction = '';
  let maxSteps = 80;
  if (difficulty === 'beginner') {
    complexityInstruction = 'Create a simple, sturdy model. Use 20-40 parts.';
    maxSteps = 40;
  } else if (difficulty === 'expert') {
    complexityInstruction = 'Create a MASTERPIECE. Use 100-150+ parts. MAXIMIZE inventory usage (90%+).';
    maxSteps = 150;
  } else {
    complexityInstruction = 'Create a recognizable, detailed model. Use 50-80 parts (70%+ of inventory).';
    maxSteps = 80;
  }

  const creativeInstruction = userPrompt
    ? `USER REQUEST: Build "${userPrompt}". Follow this theme strictly.`
    : 'Choose a creative theme based on the parts. Surprise the user.';

  const prompt = `You are a world-class LEGO Master Builder.
Design an IMPRESSIVE, STABLE, and CREATIVE model.

INVENTORY (use inventoryIndex to reference):
${inventoryLines.join('\n')}

DESIGN BRIEF:
${creativeInstruction}
DIFFICULTY: ${difficulty.toUpperCase()}
${complexityInstruction}
TARGET: Maximum ${maxSteps} build steps.

SHAPES (use exact shape IDs in your response):
${getGeminiShapeDescriptions()}

3D RULES (CRITICAL — follow precisely):
- Grid: 1 stud = 1 unit. Even dimensions → .5 positions, odd → integer
- y = bottom of part. Height: brick/slope = 1.2, plate/tile = 0.4
- STACKING: Calculate y = sum of heights below.
  Example: ground brick (h=1.2) at y=0 → next brick on top: y=1.2
  Example: plate (h=0.4) at y=0 → plate on top: y=0.4 → brick on top: y=0.8
  Example: two bricks stacked: y=0, y=1.2, y=2.4
- NO floating: every part (except y=0) MUST rest on another part
- NO clipping: parts cannot overlap in 3D space
- Support: at least 1 stud of XZ overlap with the part below
- Build BOTTOM-UP: place foundation first, then stack upward

Keep step descriptions SHORT (3-8 words).
Return ONLY valid JSON.`;

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`Build attempt ${attempt}/${MAX_RETRIES}`);

      const response = await withTimeout(
        ai.models.generateContent({
          model: config.gemini.model,
          contents: { text: prompt },
          config: {
            responseMimeType: 'application/json',
            responseSchema: buildSchema,
            maxOutputTokens: 32768,
            thinkingConfig: { thinkingBudget: 8192 },
            systemInstruction: 'You are an award-winning LEGO Master Builder with expertise in 3D spatial reasoning. Complete the entire JSON response.',
          },
        }),
        BUILD_TIMEOUT,
        'Build plan generation',
      );

      if (!response.text) {
        lastError = new Error('Empty response');
        continue;
      }

      const rawPlan = JSON.parse(response.text);

      if (!Array.isArray(rawPlan.steps) || rawPlan.steps.length === 0) {
        lastError = new Error('No valid steps');
        continue;
      }

      // Enrich steps with inventory data
      rawPlan.steps = rawPlan.steps.filter((step: any) => {
        if (typeof step.inventoryIndex !== 'number') return false;
        const part = parts[step.inventoryIndex];
        if (!part) return false;

        step.partName = step.partName || part.name;
        step.color = part.color;
        step.hexColor = part.hexColor;
        step.type = part.type;
        step.shape = fromLegacyShape(step.shape || part.shape || 'rectangle', part.type);

        if (!step.size) step.size = {};
        step.size.width = part.dimensions.width;
        step.size.length = part.dimensions.length;
        step.size.height = getBrickHeight(step.shape, part.type);

        if (!step.rotation) step.rotation = { x: 0, y: 0, z: 0 };
        if (!step.position) step.position = { x: 0, y: 0, z: 0 };

        return true;
      });

      if (rawPlan.steps.length === 0) {
        lastError = new Error('All steps invalid after filtering');
        continue;
      }

      // Physics correction: snap floating bricks down, remove overlaps
      const beforeCount = rawPlan.steps.length;
      rawPlan.steps = fixBuildPhysics(rawPlan.steps);
      if (rawPlan.steps.length < beforeCount) {
        logger.info(`Physics fix removed ${beforeCount - rawPlan.steps.length} overlapping steps`);
      }

      rawPlan.title = rawPlan.title || 'LEGO Creation';
      rawPlan.description = rawPlan.description || 'A custom LEGO build';
      rawPlan.lore = rawPlan.lore || 'Built with creativity and imagination.';

      logger.info(`Build plan generated: ${rawPlan.steps.length} steps`);
      return rawPlan as BuildPlan;
    } catch (error: any) {
      logger.error(`Attempt ${attempt} failed:`, error.message);
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
      }
    }
  }

  throw lastError || new Error('Failed to generate build plan after multiple attempts.');
}
