import { Type } from '@google/genai';
import type { Schema, GoogleGenAI } from '@google/genai';
import { logger } from 'firebase-functions';
import type { VoxelGrid, BuildStepBlock } from '@brick-quest/shared';
import { validateVoxelGrid, voxelGridToBricks } from '@brick-quest/shared';
import { withTimeout } from '../../utils/with-timeout.js';
import { getThinkingConfig } from '../gemini-client.js';
import type { ImageData } from '../geminiDesign.js';

export interface FullGridConfig {
  maxOutput: number;
  thinkingLevel: 'low' | 'medium' | 'high';
  minBricks: number;
  /** Pre-identified subject context injected into system instruction */
  recognitionContext?: string;
}

/** Mutable state for model chain fallback — persists across agent iterations. */
export interface ModelChainState {
  modelIndex: number;
  useModel: string;
  usedFallback: boolean;
}

export interface VoxelGenMeta {
  title: string;
  description: string;
  lore: string;
  referenceDescription: string;
}

export interface VoxelGenResult {
  voxelGrid: VoxelGrid;
  steps: BuildStepBlock[];
  meta: VoxelGenMeta;
}

const voxelSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    referenceDescription: { type: Type.STRING, description: 'One-sentence description of the subject for future reference' },
    title: { type: Type.STRING, description: 'Creative LEGO set name' },
    description: { type: Type.STRING, description: 'Short build description' },
    lore: { type: Type.STRING, description: 'Fun backstory for the model' },
    width: { type: Type.INTEGER, description: 'Grid width in studs (X axis)' },
    depth: { type: Type.INTEGER, description: 'Grid depth in studs (Z axis, front=0 to back)' },
    layers: {
      type: Type.ARRAY,
      description: 'Layers ordered bottom to top. Each layer is a 2D color grid.',
      items: {
        type: Type.OBJECT,
        properties: {
          y: { type: Type.INTEGER, description: 'Layer height position (0 = ground)' },
          heightType: { type: Type.STRING, enum: ['brick', 'plate'], description: 'brick=1.2 units tall, plate=0.4 units tall' },
          grid: {
            type: Type.ARRAY,
            description: 'grid[z][x]: 2D array where z=front-to-back rows, x=left-to-right columns. Each cell is a hex color string or "" for empty.',
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
        required: ['y', 'heightType', 'grid'],
      },
    },
  },
  required: ['referenceDescription', 'title', 'description', 'lore', 'width', 'depth', 'layers'],
};

/** Returns true for errors where switching to a different model may help. */
function isRetryableModelError(error: any): boolean {
  const msg = String(error?.message || '');
  return /499|503|429|CANCELLED|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg);
}

/**
 * Full-grid strategy: ask Gemini for the entire 3D voxel grid in a single call.
 * Includes a parse-retry loop with model chain fallback.
 * Mutates `modelState` to track model chain progression across agent iterations.
 */
export async function generateFullGridVoxelGrid(params: {
  ai: GoogleGenAI;
  base64Image: string;
  mimeType: string;
  compositeView?: ImageData;
  prompt: string;
  cfg: FullGridConfig;
  modelChain: string[];
  modelState: ModelChainState;
  agentStart: number;
  agentBudgetMs: number;
  onProgress?: (msg: string) => Promise<void>;
}): Promise<{ result: VoxelGenResult | null; lastError: Error | null }> {
  const { ai, base64Image, mimeType, compositeView, prompt, cfg, modelChain, modelState, agentStart, agentBudgetMs, onProgress } = params;

  const PARSE_RETRIES = 4;
  const PER_CALL_TIMEOUT = 240_000;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= PARSE_RETRIES; attempt++) {
    const budgetRemaining = agentBudgetMs - (Date.now() - agentStart);
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
      contentParts.push({ text: prompt });

      const callTimeout = Math.min(PER_CALL_TIMEOUT, budgetRemaining - 10_000);

      // Flash models cap at 65K output tokens; Pro supports higher limits
      const isFlash = modelState.useModel.includes('flash');
      const maxOutput = isFlash ? Math.min(cfg.maxOutput, 65000) : cfg.maxOutput;

      const systemParts = [
        'You are an award-winning LEGO Master Builder and voxel sculptor. Output a 3D color grid (voxel grid) representing the LEGO model. Each layer is a 2D array of hex color strings.',
      ];
      if (cfg.recognitionContext) {
        systemParts.push(cfg.recognitionContext);
      }

      const response = await withTimeout(
        ai.models.generateContent({
          model: modelState.useModel,
          contents: contentParts,
          config: {
            temperature: 1.0,
            responseMimeType: 'application/json',
            responseSchema: voxelSchema,
            maxOutputTokens: maxOutput,
            thinkingConfig: getThinkingConfig(modelState.useModel, cfg.thinkingLevel),
            systemInstruction: systemParts.join('\n\n'),
          },
        }),
        callTimeout,
        'Voxel grid generation'
      );

      if (!response.text) {
        logger.warn(`  Attempt ${attempt}: empty response from model`);
        lastError = new Error('Empty response');
        continue;
      }

      const raw = JSON.parse(response.text);

      if (!Array.isArray(raw.layers) || raw.layers.length === 0) {
        logger.warn(`  Attempt ${attempt}: no valid layers in response (keys: ${Object.keys(raw).join(', ')})`);
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
        logger.warn(`  Attempt ${attempt}: all layers empty after validation`);
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
        logger.warn(`  Attempt ${attempt}: voxel conversion produced 0 bricks`);
        lastError = new Error('Voxel conversion produced 0 bricks');
        continue;
      }

      // Reject grids that are too sparse — the model sometimes returns nearly empty layers
      if (steps.length < cfg.minBricks) {
        logger.warn(`  Attempt ${attempt}: only ${steps.length} bricks (min: ${cfg.minBricks}), ${report.layerCount} layers, ${report.totalVoxels} voxels — retrying`);
        lastError = new Error(`Too few bricks: ${steps.length} < ${cfg.minBricks}`);
        continue;
      }

      return {
        result: {
          voxelGrid,
          steps,
          meta: {
            title: voxelGrid.title,
            description: voxelGrid.description,
            lore: voxelGrid.lore,
            referenceDescription: voxelGrid.referenceDescription || 'An object from the photo.',
          },
        },
        lastError: null,
      };
    } catch (error: any) {
      logger.error(`  Parse attempt ${attempt} failed:`, error.message);
      lastError = error;
      if (isRetryableModelError(error)) {
        // Switch model immediately instead of burning a full agent iteration
        if (modelState.modelIndex < modelChain.length - 1) {
          modelState.modelIndex++;
          modelState.useModel = modelChain[modelState.modelIndex];
          modelState.usedFallback = modelState.modelIndex > 0;
          logger.info(`Switching to next model in chain: ${modelState.useModel} (${modelState.modelIndex + 1}/${modelChain.length})`);
          if (onProgress) {
            await onProgress(`Switched to ${modelState.useModel} (model ${modelState.modelIndex + 1}/${modelChain.length})`);
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

  return { result: null, lastError };
}
