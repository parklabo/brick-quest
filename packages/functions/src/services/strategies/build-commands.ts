import { Type } from '@google/genai';
import type { Schema, GoogleGenAI } from '@google/genai';
import { logger } from 'firebase-functions';
import type { VoxelGrid, VoxelLayer } from '@brick-quest/shared';
import { validateVoxelGrid, voxelGridToBricks } from '@brick-quest/shared';
import { buildCommandsDesignPrompt } from '@brick-quest/shared';
import { withTimeout } from '../../utils/with-timeout.js';
import { getThinkingConfig } from '../gemini-client.js';
import type { ImageData } from '../geminiDesign.js';
import type { FullGridConfig, ModelChainState, VoxelGenMeta, VoxelGenResult } from './full-grid.js';

// ─────────────────────────────────────────────────────────────────────────────
// DSL Interpreter — parse and execute build commands into a 3D voxel array
// ─────────────────────────────────────────────────────────────────────────────

/** Internal 3D grid: grid[y][z][x] = hex color or '' */
type Grid3D = string[][][];

/** Set of layer indices marked as plate type */
type PlateSet = Set<number>;

function createGrid3D(width: number, depth: number, totalLayers: number): Grid3D {
  const grid: Grid3D = [];
  for (let y = 0; y < totalLayers; y++) {
    const layer: string[][] = [];
    for (let z = 0; z < depth; z++) {
      layer.push(new Array(width).fill(''));
    }
    grid.push(layer);
  }
  return grid;
}

/** Safely set a voxel, clipping out-of-bounds coordinates */
function setVoxel(grid: Grid3D, x: number, y: number, z: number, color: string): void {
  const totalLayers = grid.length;
  const depth = totalLayers > 0 ? grid[0].length : 0;
  const width = depth > 0 ? grid[0][0].length : 0;

  if (y < 0 || y >= totalLayers) return;
  if (z < 0 || z >= depth) return;
  if (x < 0 || x >= width) return;

  grid[y][z][x] = color;
}

/** FILL x y z w h d color — fill a rectangular box */
function executeFill(grid: Grid3D, args: number[], color: string): void {
  const [x, y, z, w, h, d] = args;
  for (let dy = 0; dy < h; dy++) {
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        setVoxel(grid, x + dx, y + dy, z + dz, color);
      }
    }
  }
}

/** SET x y z color — set a single voxel */
function executeSet(grid: Grid3D, args: number[], color: string): void {
  const [x, y, z] = args;
  setVoxel(grid, x, y, z, color);
}

/** DOME cx cy cz rx ry rz color — half-ellipsoid (upper half, y >= cy) */
function executeDome(grid: Grid3D, args: number[], color: string): void {
  const [cx, cy, cz, rx, ry, rz] = args;
  if (rx <= 0 || ry <= 0 || rz <= 0) return;

  for (let dy = 0; dy <= ry; dy++) {
    for (let dz = -rz; dz <= rz; dz++) {
      for (let dx = -rx; dx <= rx; dx++) {
        const nx = dx / rx;
        const ny = dy / ry;
        const nz = dz / rz;
        if (nx * nx + ny * ny + nz * nz <= 1.0) {
          setVoxel(grid, cx + dx, cy + dy, cz + dz, color);
        }
      }
    }
  }
}

/** TAPER x y z w1 d1 w2 d2 h color — tapered box (bottom wide, top narrow) */
function executeTaper(grid: Grid3D, args: number[], color: string): void {
  const [x, y, z, w1, d1, w2, d2, h] = args;
  if (h <= 0) return;

  for (let layer = 0; layer < h; layer++) {
    const t = h > 1 ? layer / (h - 1) : 0;
    const w = Math.round(w1 + (w2 - w1) * t);
    const d = Math.round(d1 + (d2 - d1) * t);
    const xOff = Math.round((w1 - w) / 2);
    const zOff = Math.round((d1 - d) / 2);

    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        setVoxel(grid, x + xOff + dx, y + layer, z + zOff + dz, color);
      }
    }
  }
}

/** Parse a single command string into { command, numericArgs, color } */
function parseCommand(cmd: string): { command: string; args: number[]; color: string } | null {
  const trimmed = cmd.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;

  const command = parts[0].toUpperCase();

  if (command === 'PLATE') {
    // PLATE y1 [y2] — no color arg
    const nums = parts.slice(1).map(Number).filter((n) => !isNaN(n));
    return { command, args: nums, color: '' };
  }

  // Last token is color (hex string) for FILL, SET, DOME, TAPER
  const colorToken = parts[parts.length - 1];
  const numericTokens = parts.slice(1, -1);
  const args = numericTokens.map(Number);

  // Validate all numeric args parsed correctly
  if (args.some((n) => isNaN(n))) return null;

  // Normalize color: ensure # prefix
  const color = colorToken.startsWith('#') ? colorToken : `#${colorToken}`;

  return { command, args, color };
}

/**
 * Interpret an array of build commands into a VoxelGrid.
 * Pure function — no side effects.
 */
export function interpretCommands(
  commands: string[],
  width: number,
  depth: number,
  totalLayers: number
): { grid: Grid3D; plateSet: PlateSet } {
  const grid = createGrid3D(width, depth, totalLayers);
  const plateSet: PlateSet = new Set();

  for (const cmd of commands) {
    const parsed = parseCommand(cmd);
    if (!parsed) continue;

    switch (parsed.command) {
      case 'FILL':
        if (parsed.args.length >= 6) executeFill(grid, parsed.args, parsed.color);
        break;
      case 'SET':
        if (parsed.args.length >= 3) executeSet(grid, parsed.args, parsed.color);
        break;
      case 'DOME':
        if (parsed.args.length >= 6) executeDome(grid, parsed.args, parsed.color);
        break;
      case 'TAPER':
        if (parsed.args.length >= 8) executeTaper(grid, parsed.args, parsed.color);
        break;
      case 'PLATE':
        if (parsed.args.length >= 2) {
          // Range: PLATE y1 y2
          const [y1, y2] = parsed.args;
          for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            plateSet.add(y);
          }
        } else if (parsed.args.length === 1) {
          plateSet.add(parsed.args[0]);
        }
        break;
      default:
        // Unknown command — skip silently
        break;
    }
  }

  return { grid, plateSet };
}

/**
 * Convert a 3D grid array + plate set into a VoxelGrid structure.
 * Removes empty layers.
 */
export function grid3DToVoxelGrid(
  grid: Grid3D,
  plateSet: PlateSet,
  meta: { title: string; description: string; lore: string; referenceDescription: string },
  width: number,
  depth: number
): VoxelGrid {
  const layers: VoxelLayer[] = [];

  for (let y = 0; y < grid.length; y++) {
    const layerGrid: string[][] = [];
    let hasContent = false;

    for (let z = 0; z < depth; z++) {
      const row: string[] = [];
      for (let x = 0; x < width; x++) {
        const cell = grid[y]?.[z]?.[x] || '';
        row.push(cell);
        if (cell !== '') hasContent = true;
      }
      layerGrid.push(row);
    }

    if (hasContent) {
      layers.push({
        y,
        heightType: plateSet.has(y) ? 'plate' : 'brick',
        grid: layerGrid,
      });
    }
  }

  return {
    ...meta,
    width,
    depth,
    layers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini call — generate build commands via structured JSON output
// ─────────────────────────────────────────────────────────────────────────────

const buildCommandsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    referenceDescription: { type: Type.STRING, description: 'One-sentence description of the subject' },
    title: { type: Type.STRING, description: 'Creative LEGO set name' },
    description: { type: Type.STRING, description: 'Short build description' },
    lore: { type: Type.STRING, description: 'Fun backstory for the model' },
    width: { type: Type.INTEGER, description: 'Grid width in studs (X axis)' },
    depth: { type: Type.INTEGER, description: 'Grid depth in studs (Z axis)' },
    totalLayers: { type: Type.INTEGER, description: 'Total number of Y layers' },
    commands: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Array of build command strings (FILL, SET, DOME, TAPER, PLATE)',
    },
  },
  required: ['referenceDescription', 'title', 'description', 'lore', 'width', 'depth', 'totalLayers', 'commands'],
};

/** Returns true for errors where switching to a different model may help. */
function isRetryableModelError(error: any): boolean {
  const msg = String(error?.message || '');
  return /499|503|429|CANCELLED|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg);
}

/**
 * Build commands strategy: ask Gemini for a compact DSL command list.
 * The commands are interpreted into a VoxelGrid, then converted to bricks.
 *
 * Same interface as generateFullGridVoxelGrid — drop-in replacement.
 * Output tokens: ~3-5K (vs ~100K for raw grid) → 20-50x more efficient.
 */
export async function generateBuildCommands(params: {
  ai: GoogleGenAI;
  base64Image: string;
  mimeType: string;
  compositeView?: ImageData;
  detail: import('@brick-quest/shared').DesignDetail;
  userPrompt: string;
  feedbackPrompt: string;
  cfg: FullGridConfig;
  modelChain: string[];
  modelState: ModelChainState;
  agentStart: number;
  agentBudgetMs: number;
  isRetry: boolean;
  onProgress?: (msg: string) => Promise<void>;
}): Promise<{ result: VoxelGenResult | null; lastError: Error | null }> {
  const {
    ai,
    base64Image,
    mimeType,
    compositeView,
    detail,
    userPrompt,
    feedbackPrompt,
    cfg,
    modelChain,
    modelState,
    agentStart,
    agentBudgetMs,
    isRetry,
    onProgress,
  } = params;

  const PARSE_RETRIES = 4;
  const PER_CALL_TIMEOUT = 180_000; // 3 min — commands are much shorter output
  let lastError: Error | null = null;

  const prompt = buildCommandsDesignPrompt(detail, userPrompt, !!compositeView, isRetry);
  const currentPrompt = feedbackPrompt ? `${prompt}\n\n${feedbackPrompt}` : prompt;

  for (let attempt = 1; attempt <= PARSE_RETRIES; attempt++) {
    const budgetRemaining = agentBudgetMs - (Date.now() - agentStart);
    if (budgetRemaining < 30_000) {
      logger.warn(`  [build-commands] Skipping attempt ${attempt} — only ${Math.round(budgetRemaining / 1000)}s remaining`);
      break;
    }

    try {
      logger.info(`  [build-commands] Parse attempt ${attempt}/${PARSE_RETRIES} (model: ${modelState.useModel})`);

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

      const callTimeout = Math.min(PER_CALL_TIMEOUT, budgetRemaining - 10_000);

      // Build commands output is small (~3-5K tokens) — cap maxOutput conservatively
      const maxOutput = 16384;

      const systemParts = [
        'You are an award-winning LEGO Master Builder and voxel sculptor. Output BUILD COMMANDS to construct a 3D LEGO model. The commands will be interpreted into a voxel grid programmatically.',
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
            responseSchema: buildCommandsSchema,
            maxOutputTokens: maxOutput,
            thinkingConfig: getThinkingConfig(modelState.useModel, cfg.thinkingLevel),
            systemInstruction: systemParts.join('\n\n'),
          },
        }),
        callTimeout,
        'Build commands generation'
      );

      if (!response.text) {
        logger.warn(`  [build-commands] Attempt ${attempt}: empty response`);
        lastError = new Error('Empty response');
        continue;
      }

      const raw = JSON.parse(response.text);

      if (!Array.isArray(raw.commands) || raw.commands.length === 0) {
        logger.warn(`  [build-commands] Attempt ${attempt}: no commands in response`);
        lastError = new Error('No commands in response');
        continue;
      }

      const width = Math.max(1, Math.round(raw.width || 8));
      const depth = Math.max(1, Math.round(raw.depth || 8));
      const totalLayers = Math.max(1, Math.round(raw.totalLayers || 16));

      logger.info(
        `  [build-commands] Interpreting ${raw.commands.length} commands into ${width}×${depth}×${totalLayers} grid`
      );

      // Interpret commands into 3D grid
      const { grid, plateSet } = interpretCommands(raw.commands, width, depth, totalLayers);

      // Convert to VoxelGrid
      const meta: VoxelGenMeta = {
        title: raw.title || 'LEGO Creation',
        description: raw.description || 'A LEGO recreation',
        lore: raw.lore || 'Inspired by real life.',
        referenceDescription: raw.referenceDescription || 'An object from the photo.',
      };

      const rawVoxelGrid = grid3DToVoxelGrid(grid, plateSet, meta, width, depth);

      // Validate and normalize
      const voxelGrid = validateVoxelGrid(rawVoxelGrid);

      if (voxelGrid.layers.length === 0) {
        logger.warn(`  [build-commands] Attempt ${attempt}: all layers empty after interpretation`);
        lastError = new Error('All layers empty after command interpretation');
        continue;
      }

      // Convert to brick placements
      const { steps, report } = voxelGridToBricks(voxelGrid);

      logger.info(
        `  [build-commands] Voxel conversion: ${report.totalVoxels} voxels → ${report.totalBricks} bricks ` +
          `(avg size ${report.averageBrickSize.toFixed(1)}, ${report.layerCount} layers)`
      );

      if (steps.length === 0) {
        logger.warn(`  [build-commands] Attempt ${attempt}: voxel conversion produced 0 bricks`);
        lastError = new Error('Voxel conversion produced 0 bricks');
        continue;
      }

      if (steps.length < cfg.minBricks) {
        logger.warn(
          `  [build-commands] Attempt ${attempt}: only ${steps.length} bricks (min: ${cfg.minBricks}) — retrying`
        );
        lastError = new Error(`Too few bricks: ${steps.length} < ${cfg.minBricks}`);
        continue;
      }

      return {
        result: { voxelGrid, steps, meta },
        lastError: null,
      };
    } catch (error: any) {
      logger.error(`  [build-commands] Parse attempt ${attempt} failed:`, error.message);
      lastError = error;

      if (isRetryableModelError(error)) {
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
