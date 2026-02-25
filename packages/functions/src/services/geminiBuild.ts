import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { config, LIMITS } from '../config.js';
import { logger } from 'firebase-functions';
import type { DetectedPart, BuildPlan, BuildStepBlock, Difficulty, VoxelGrid } from '@brick-quest/shared';
import { validateVoxelGrid, voxelGridToBricks, buildVoxelBuildPrompt } from '@brick-quest/shared';
import { withTimeout } from '../utils/with-timeout.js';
import { getAI, getThinkingConfig } from './gemini-client.js';

/** Total time budget for the agent loop — leaves margin for Firestore writes */
const AGENT_BUDGET_MS = 8 * 60 * 1000;
const { AGENT_MAX_ITERATIONS } = LIMITS;

function isRetryableModelError(error: any): boolean {
  const msg = String(error?.message || '');
  return /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out/i.test(msg);
}

export async function generateBuildPlan(parts: DetectedPart[], difficulty: Difficulty = 'normal', userPrompt = '', onProgress?: (msg: string) => Promise<void>): Promise<{ plan: BuildPlan; usedFallbackModel: boolean }> {
  const ai = getAI();

  // Voxel grid schema — AI outputs a color grid, not brick coordinates
  const voxelSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Name of the creation' },
      description: { type: Type.STRING, description: 'Short description of the model' },
      lore: { type: Type.STRING, description: 'A creative backstory for this model' },
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
    required: ['title', 'description', 'lore', 'width', 'depth', 'layers'],
  };

  // Extract unique colors from inventory for the prompt
  const colorMap = new Map<string, string>();
  for (const p of parts) {
    if (!colorMap.has(p.hexColor)) {
      colorMap.set(p.hexColor, p.color);
    }
  }
  const availableColors = [...colorMap.entries()].map(([hex, name]) => ({ hex, name }));

  // Build inventory constraint: map of "WxL" → total available count
  const inventoryConstraint = new Map<string, number>();
  for (const p of parts) {
    const w = Math.min(p.dimensions.width, p.dimensions.length);
    const l = Math.max(p.dimensions.width, p.dimensions.length);
    const key = `${w}x${l}`;
    inventoryConstraint.set(key, (inventoryConstraint.get(key) || 0) + p.count);
  }

  const outputConfig: Record<Difficulty, { maxOutput: number; thinkingLevel: 'low' | 'medium' | 'high' }> = {
    beginner: { maxOutput: 40000, thinkingLevel: 'low' },
    normal: { maxOutput: 100000, thinkingLevel: 'medium' },
    expert: { maxOutput: 200000, thinkingLevel: 'high' },
  };

  const cfg = outputConfig[difficulty];
  const basePrompt = buildVoxelBuildPrompt(difficulty, userPrompt, availableColors);

  // Track best result across agent iterations
  let bestResult: { plan: BuildPlan; brickCount: number } | null = null;
  const modelChain = config.gemini.modelChain;
  let modelIndex = 0;
  let useModel = modelChain[0];
  let usedFallback = false;
  const agentStart = Date.now();

  for (let iteration = 1; iteration <= AGENT_MAX_ITERATIONS; iteration++) {
    const elapsed = Date.now() - agentStart;
    const remaining = AGENT_BUDGET_MS - elapsed;

    if (remaining < 60_000 && bestResult) {
      logger.info(`Agent: ${Math.round(elapsed / 1000)}s elapsed, using best result`);
      break;
    }

    logger.info(`Agent iteration ${iteration}/${AGENT_MAX_ITERATIONS} (model: ${useModel}, ${Math.round(remaining / 1000)}s remaining)`);

    const prompt = basePrompt;

    // Inner parse-retry loop
    const PARSE_RETRIES = 3;
    const PER_CALL_TIMEOUT = 150_000;
    let lastError: Error | null = null;
    let iterationSteps: BuildStepBlock[] | null = null;
    let iterationMeta: { title: string; description: string; lore: string } | null = null;
    let iterationVoxelGrid: VoxelGrid | null = null;
    let hitRetryableError = false;

    for (let attempt = 1; attempt <= PARSE_RETRIES; attempt++) {
      const budgetRemaining = AGENT_BUDGET_MS - (Date.now() - agentStart);
      if (budgetRemaining < 30_000) {
        logger.warn(`  Skipping attempt ${attempt} — only ${Math.round(budgetRemaining / 1000)}s remaining`);
        break;
      }

      try {
        logger.info(`  Parse attempt ${attempt}/${PARSE_RETRIES}`);

        const callTimeout = Math.min(PER_CALL_TIMEOUT, budgetRemaining - 5_000);

        const response = await withTimeout(
          ai.models.generateContent({
            model: useModel,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: voxelSchema,
              maxOutputTokens: cfg.maxOutput,
              thinkingConfig: getThinkingConfig(useModel, cfg.thinkingLevel),
              systemInstruction:
                'You are an award-winning LEGO Master Builder. Output a 3D color grid (voxel grid) using ONLY the provided inventory colors.',
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
          description: raw.description || 'A custom LEGO build',
          lore: raw.lore || 'Built with creativity and imagination.',
          width: raw.width || 8,
          depth: raw.depth || 8,
          layers: raw.layers,
        });

        if (voxelGrid.layers.length === 0) {
          lastError = new Error('All layers empty after validation');
          continue;
        }

        // Convert voxel grid to bricks with inventory constraint
        const { steps, report } = voxelGridToBricks(voxelGrid, inventoryConstraint);

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
        };
        break;
      } catch (error: any) {
        logger.error(`  Parse attempt ${attempt} failed:`, error.message);
        lastError = error;
        if (isRetryableModelError(error)) {
          hitRetryableError = true;
          break;
        }
        if (attempt < PARSE_RETRIES) {
          await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
        }
      }
    }

    // If all parse attempts failed, continue to next or use best
    if (!iterationSteps || !iterationMeta) {
      logger.warn(`Agent iteration ${iteration} failed to produce valid voxel grid`);

      if (hitRetryableError && modelIndex < modelChain.length - 1) {
        modelIndex++;
        useModel = modelChain[modelIndex];
        usedFallback = modelIndex > 0;
        logger.info(`Switching to next model in chain: ${useModel} (${modelIndex + 1}/${modelChain.length})`);
        if (onProgress) {
          await onProgress(`Switched to ${useModel} (model ${modelIndex + 1}/${modelChain.length})`);
        }
      }

      if (bestResult) break;
      if (iteration === AGENT_MAX_ITERATIONS) {
        throw lastError || new Error('Failed to generate build plan after multiple attempts.');
      }
      continue;
    }

    // No physics correction needed — voxel conversion produces valid placements

    // Track result
    bestResult = {
      plan: { ...iterationMeta, steps: iterationSteps, agentIterations: iteration, ...(iterationVoxelGrid && { voxelGrid: iterationVoxelGrid }) },
      brickCount: iterationSteps.length,
    };

    // Accept on first successful iteration (no physics issues to retry for)
    logger.info(`Agent iteration ${iteration}: accepted — ${iterationSteps.length} bricks`);
    if (onProgress) {
      await onProgress(`Build generated: ${iterationSteps.length} bricks`);
    }
    break;
  }

  if (!bestResult) {
    throw new Error('Failed to generate build plan after multiple attempts.');
  }

  logger.info(`Build plan generated: ${bestResult.plan.steps.length} steps (${bestResult.plan.agentIterations} agent iteration(s))`);
  return { plan: bestResult.plan, usedFallbackModel: usedFallback };
}
