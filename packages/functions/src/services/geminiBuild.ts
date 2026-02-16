import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { config, LIMITS } from '../config.js';
import { logger } from 'firebase-functions';
import type { DetectedPart, BuildPlan, BuildStepBlock, Difficulty } from '@brick-quest/shared';
import { getBrickHeight, resolveShape, getGeminiShapeEnum, getGeminiShapeDescriptions, fixBuildPhysicsWithReport, COORDINATE_SYSTEM_PROMPT, CRITICAL_RULES_PROMPT } from '@brick-quest/shared';
import { withTimeout } from '../utils/with-timeout.js';
import { needsAgentRetry, buildPhysicsFeedback } from '../utils/physics-feedback.js';
import { getAI } from './gemini-client.js';

const BUILD_TIMEOUT = 8 * 60 * 1000;
const { AGENT_MAX_ITERATIONS } = LIMITS;

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

  const difficultyConfig: Record<Difficulty, { instruction: string; maxSteps: number; maxOutput: number; thinking: number }> = {
    beginner: {
      instruction: 'Create a simple, sturdy model. Use 20-40 parts. Use larger bricks (2x4, 2x6) predominantly.',
      maxSteps: 40,
      maxOutput: 32768,
      thinking: 8192,
    },
    normal: {
      instruction: 'Create a recognizable, detailed model. Use 50-80 parts (70%+ of inventory). Mix large structural bricks with smaller detail bricks.',
      maxSteps: 80,
      maxOutput: 65536,
      thinking: 16384,
    },
    expert: {
      instruction: 'Create a MASTERPIECE. Use 100-150+ parts. MAXIMIZE inventory usage (90%+). Use small bricks (1x1, 1x2) for fine detail and larger bricks for structure.',
      maxSteps: 150,
      maxOutput: 131072,
      thinking: 32768,
    },
  };

  const cfg = difficultyConfig[difficulty];

  const creativeInstruction = userPrompt
    ? `USER REQUEST: Build "${userPrompt}". The model MUST be INSTANTLY RECOGNIZABLE as this subject. Capture its most iconic features, silhouette, and proportions.`
    : 'Choose a creative theme based on the available parts. Surprise the user with a recognizable, impressive model.';

  const basePrompt = `You are a world-class LEGO Master Builder. Your job is to design a SOLID, RECOGNIZABLE 3D LEGO model with PRECISE brick-by-brick assembly instructions using ONLY the parts from the user's inventory.

INVENTORY (use inventoryIndex to reference):
${inventoryLines.join('\n')}

DESIGN BRIEF:
${creativeInstruction}
DIFFICULTY: ${difficulty.toUpperCase()}
${cfg.instruction}
TARGET: Maximum ${cfg.maxSteps} build steps.

SHAPES (use exact shape IDs in your response):
${getGeminiShapeDescriptions()}

═══════════════════════════════════════
STEP 1 — PLAN THE MODEL SHAPE
═══════════════════════════════════════
Before placing ANY bricks, you MUST mentally plan:
- What is the subject? What are its KEY FEATURES that make it recognizable?
- What is the bounding box? (width in X, depth in Z, height in layers)
- What does each layer's SILHOUETTE look like from above?
- Where do colors change? (e.g., body vs. head vs. eyes vs. accessories)

Example for a CAT:
- Bounding box: ~6 wide × 4 deep × 8 layers tall
- Layers 0-1: feet/base (4 small legs or a flat base)
- Layers 2-4: body (oval/rectangular, main body color)
- Layers 5-7: head (wider than body, with ears poking up at layer 7)
- Details: eyes (1x1 black on front of head), nose (1x1 pink), whiskers, tail extending from back

${COORDINATE_SYSTEM_PROMPT}

═══════════════════════════════════════
LAYER-BY-LAYER BUILD METHOD (MANDATORY)
═══════════════════════════════════════
You MUST build the model as a stack of horizontal layers. Each layer is at a specific Y height.

FOR EACH LAYER (from bottom Y=0.0 upward):
a) Determine the FOOTPRINT of this layer (which stud positions are filled)
b) Determine the COLOR of each stud position based on the model's design
c) TILE the footprint completely with bricks from the inventory — NO gaps allowed
d) Use larger bricks (2x4, 2x3, 2x2) first, fill remaining gaps with 1x2 and 1x1
e) Pick inventory parts by inventoryIndex — respect available counts

TILING RULE: For each layer, mentally draw a grid of the footprint. EVERY cell must be covered by exactly one brick. If you can't fit a large brick, use smaller ones.

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
    step 1: inventoryIndex=0, 2x4 blue brick → x=0.5, y=0.0, z=1.5 (covers X:0-1, Z:0-3) ✓
    step 2: inventoryIndex=0, 2x4 blue brick → x=2.5, y=0.0, z=1.5 (covers X:2-3, Z:0-3) ✓
  CHECK: 2 bricks × 8 studs = 16 studs = 4×4 footprint ✓ No gaps ✓

LAYER 1 (y=1.2) — blue body with white face stripe:
  Grid:  [B B B B]
         [W W W W]   ← white face row at Z=1
         [W W W W]   ← white face row at Z=2
         [B B B B]
  Tiling:
    step 3: inventoryIndex=1, 2x1 blue brick → x=0.5, y=1.2, z=0
    step 4: inventoryIndex=1, 2x1 blue brick → x=2.5, y=1.2, z=0
    step 5: inventoryIndex=2, 2x2 white brick → x=0.5, y=1.2, z=1.5
    step 6: inventoryIndex=2, 2x2 white brick → x=2.5, y=1.2, z=1.5
    step 7: inventoryIndex=1, 2x1 blue brick → x=0.5, y=1.2, z=3
    step 8: inventoryIndex=1, 2x1 blue brick → x=2.5, y=1.2, z=3
  CHECK: covers all 16 studs ✓ Colors match grid ✓

LAYER 2 (y=2.4) — eyes on white face:
  Grid:  [B B B B]
         [B K B K]   ← K = black 1x1 eyes at (1,1) and (3,1)
         [W W W W]
         [B B B B]
  Tiling:
    step 9:  inventoryIndex=1, 2x1 blue brick → x=0.5, y=2.4, z=0
    step 10: inventoryIndex=1, 2x1 blue brick → x=2.5, y=2.4, z=0
    step 11: inventoryIndex=3, 1x1 blue brick → x=0, y=2.4, z=1
    step 12: inventoryIndex=4, 1x1 black brick → x=1, y=2.4, z=1 ← LEFT EYE
    step 13: inventoryIndex=3, 1x1 blue brick → x=2, y=2.4, z=1
    step 14: inventoryIndex=4, 1x1 black brick → x=3, y=2.4, z=1 ← RIGHT EYE
    step 15: inventoryIndex=5, 2x1 white brick → x=0.5, y=2.4, z=2
    step 16: inventoryIndex=5, 2x1 white brick → x=2.5, y=2.4, z=2
    step 17: inventoryIndex=1, 2x1 blue brick → x=0.5, y=2.4, z=3
    step 18: inventoryIndex=1, 2x1 blue brick → x=2.5, y=2.4, z=3
  CHECK: 10 bricks, all 16 studs covered ✓ Eyes placed correctly ✓

${CRITICAL_RULES_PROMPT}
5. RECOGNIZABLE SHAPE: The model MUST look like the requested subject from multiple angles.
6. COLOR GROUPING: Use colors intentionally — group same colors for body parts, use contrasting colors for details (eyes, nose, patterns).
7. INVENTORY RESPECT: Only use parts from the inventory. Track counts — do NOT exceed available quantity per part.
8. SELF-CHECK: After mentally placing all bricks in a layer, verify total stud coverage = footprint area.

Keep step descriptions SHORT (3-8 words).
Return ONLY valid JSON.`;

  // Track best result across agent iterations
  let bestResult: { plan: BuildPlan; survivingCount: number } | null = null;
  let feedbackPrompt = '';

  for (let iteration = 1; iteration <= AGENT_MAX_ITERATIONS; iteration++) {
    logger.info(`Agent iteration ${iteration}/${AGENT_MAX_ITERATIONS}`);

    const prompt = feedbackPrompt
      ? `${basePrompt}\n\n${feedbackPrompt}`
      : basePrompt;

    // Inner parse-retry loop
    const PARSE_RETRIES = 3;
    let lastError: Error | null = null;
    let iterationSteps: BuildStepBlock[] | null = null;
    let iterationMeta: { title: string; description: string; lore: string } | null = null;

    for (let attempt = 1; attempt <= PARSE_RETRIES; attempt++) {
      try {
        logger.info(`  Parse attempt ${attempt}/${PARSE_RETRIES}`);

        const response = await withTimeout(
          ai.models.generateContent({
            model: config.gemini.model,
            contents: { text: prompt },
            config: {
              responseMimeType: 'application/json',
              responseSchema: buildSchema,
              maxOutputTokens: cfg.maxOutput,
              thinkingConfig: { thinkingBudget: cfg.thinking },
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
          step.shape = resolveShape(step.shape || part.shape || 'rectangle', part.type);

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

        iterationSteps = rawPlan.steps;
        iterationMeta = {
          title: rawPlan.title || 'LEGO Creation',
          description: rawPlan.description || 'A custom LEGO build',
          lore: rawPlan.lore || 'Built with creativity and imagination.',
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

    // If all parse attempts failed for this iteration, continue to next or use best
    if (!iterationSteps || !iterationMeta) {
      logger.warn(`Agent iteration ${iteration} failed to produce valid steps`);
      if (bestResult) break; // use best from previous iteration
      if (iteration === AGENT_MAX_ITERATIONS) {
        throw lastError || new Error('Failed to generate build plan after multiple attempts.');
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

    // Track best result (most surviving bricks)
    if (!bestResult || fixedSteps.length > bestResult.survivingCount) {
      bestResult = {
        plan: { ...iterationMeta, steps: fixedSteps, agentIterations: iteration },
        survivingCount: fixedSteps.length,
      };
    }

    // Check if physics results are acceptable
    if (!needsAgentRetry(report)) {
      logger.info(`Agent iteration ${iteration}: physics acceptable, done`);
      break;
    }

    // Build feedback for next iteration
    if (iteration < AGENT_MAX_ITERATIONS) {
      feedbackPrompt = buildPhysicsFeedback(report);
      logger.info(`Agent iteration ${iteration}: ${report.droppedCount} bricks dropped, requesting improvement`);
    }
  }

  if (!bestResult) {
    throw new Error('Failed to generate build plan after multiple attempts.');
  }

  logger.info(`Build plan generated: ${bestResult.plan.steps.length} steps (${bestResult.plan.agentIterations} agent iteration(s))`);
  return bestResult.plan;
}
