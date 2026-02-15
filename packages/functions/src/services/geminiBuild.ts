import { GoogleGenAI, Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { config } from '../config.js';
import { logger } from 'firebase-functions';
import type { DetectedPart, BuildPlan, BuildStepBlock, Difficulty, PhysicsValidationReport } from '@brick-quest/shared';
import { getBrickHeight, fromLegacyShape, getGeminiShapeEnum, getGeminiShapeDescriptions, fixBuildPhysicsWithReport } from '@brick-quest/shared';

const getAI = () => new GoogleGenAI({ apiKey: config.gemini.apiKey });

const BUILD_TIMEOUT = 8 * 60 * 1000;
const AGENT_MAX_ITERATIONS = 3;
const DROP_THRESHOLD_PCT = 15;
const DROP_THRESHOLD_ABS = 5;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${operation} timed out after ${Math.round(timeoutMs / 1000 / 60)} minutes`)), timeoutMs);
    promise.then((r) => { clearTimeout(id); resolve(r); }).catch((e) => { clearTimeout(id); reject(e); });
  });
}

function needsAgentRetry(report: PhysicsValidationReport): boolean {
  return report.droppedPercentage > DROP_THRESHOLD_PCT || report.droppedCount > DROP_THRESHOLD_ABS;
}

function buildPhysicsFeedback(report: PhysicsValidationReport): string {
  const dropped = report.corrections.filter((c) => c.action === 'dropped');
  const lines = dropped.map(
    (c) => `- Step ${c.stepId} "${c.partName}" at (${c.originalPosition.x},${c.originalPosition.y},${c.originalPosition.z}) size ${c.size.width}x${c.size.length}: ${c.reason}`,
  );
  return `PHYSICS FEEDBACK — ${report.droppedCount} bricks were REMOVED because they overlapped and could not be nudged.
The surviving build has ${report.outputCount} bricks (${report.droppedPercentage.toFixed(1)}% dropped).

Dropped bricks:
${lines.join('\n')}

INSTRUCTIONS FOR IMPROVEMENT:
- Re-place these bricks at VALID positions that don't overlap existing bricks
- Ensure every brick (except ground level) rests on a brick below with ≥1 stud XZ overlap
- Calculate Y positions precisely: brick height=1.2, plate height=0.4
- Keep the same creative design but fix the spatial conflicts`;
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

  const basePrompt = `You are a world-class LEGO Master Builder.
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
