import { Type } from '@google/genai';
import type { Schema, GoogleGenAI } from '@google/genai';
import { logger } from 'firebase-functions';
import type { VoxelGrid, VoxelLayer, DesignDetail } from '@brick-quest/shared';
import { validateVoxelGrid, voxelGridToBricks } from '@brick-quest/shared';
import { withTimeout } from '../../utils/with-timeout.js';
import type { ImageData } from '../geminiDesign.js';
import type { VoxelGenResult, VoxelGenMeta } from './full-grid.js';

/** Flat voxel as returned by Gemini (voxel-toy-box format) */
interface FlatVoxel {
  x: number;
  y: number;
  z: number;
  color: string;
}

export interface DirectVoxelConfig {
  maxOutput: number;
  recognitionContext?: string;
  /** Subject name from recognition (used for metadata when schema has no metadata fields) */
  recognizedSubject?: string;
}

/** Voxel count ranges by detail level (based on voxel-toy-box benchmarks).
 *  min is intentionally low — the prompt already requests the target range,
 *  and the model may produce fewer voxels for simpler subjects. We only reject
 *  truly degenerate outputs (< 50 voxels). */
const VOXEL_RANGES: Record<DesignDetail, { min: number; max: number }> = {
  simple: { min: 50, max: 400 },
  standard: { min: 50, max: 800 },
  detailed: { min: 50, max: 1200 },
};

const LEGO_COLOR_PALETTE = `Standard LEGO hex colors:
#FFFFFF (white), #000000 (black), #FF0000 (red), #0055BF (blue), #237841 (green),
#FEC401 (yellow), #F97B22 (orange), #AA7D55 (medium nougat), #E4CD9E (tan),
#A0A5A9 (light gray), #6C6E68 (dark gray), #7C503A (reddish brown), #D09168 (nougat/flesh),
#B40000 (dark red), #009624 (dark green), #352100 (dark brown), #003DA5 (dark blue),
#75B5D4 (medium azure), #C870A0 (bright pink), #958A73 (dark tan)`;

/** Schema: pure voxel array — identical to voxel-toy-box demo.
 *  All output tokens go to voxel generation, no metadata overhead. */
const directVoxelSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      x: { type: Type.INTEGER },
      y: { type: Type.INTEGER },
      z: { type: Type.INTEGER },
      color: { type: Type.STRING, description: 'Hex color code e.g. #FF5500' },
    },
    required: ['x', 'y', 'z', 'color'],
  },
};

/**
 * Build the system instruction for the direct-voxel strategy.
 */
function buildSystemInstruction(recognitionContext?: string): string {
  const parts = [
    'You are an expert 3D voxel artist and LEGO Master Builder. Generate a 3D voxel art model as a flat array of {x, y, z, color} coordinates. Each voxel is a 1×1×1 cube. Think of it as building a detailed 3D pixel art sculpture — like Minecraft builds or LEGO Brickheadz.',
    LEGO_COLOR_PALETTE,
  ];
  if (recognitionContext) {
    parts.push(recognitionContext);
  }
  return parts.join('\n\n');
}

/**
 * Build the user prompt for the direct-voxel strategy.
 */
function buildDirectVoxelPrompt(
  detail: DesignDetail,
  userPrompt: string,
  hasCompositeView: boolean,
  feedbackPrompt?: string
): string {
  const range = VOXEL_RANGES[detail];

  const viewsSection = hasCompositeView
    ? `COMPOSITE VIEWS (2×2 grid — top-left: hero 3/4, top-right: front, bottom-left: right side, bottom-right: back):
Use these views as your blueprint. Match the silhouette, proportions, and color placement from each angle.
- FRONT view (top-right) → determines colors and features visible from the front
- SIDE view (bottom-left) → determines depth and profile shape
- BACK view (bottom-right) → determines rear details
- HERO view (top-left) → confirms overall 3D shape\n\n`
    : '';

  const userNote = userPrompt ? `\nUser note: "${userPrompt}"\n` : '';

  const rules = `Generate a 3D voxel art model matching the reference photo. Return ONLY a JSON array of voxel objects.

${viewsSection}Rules:
1. Use approximately ${range.max} voxels. More voxels = more detail and depth.
2. Model centered at x≈0, z≈0.
3. Bottom of model at y=0.
4. All coordinates are integers.
5. Use ONLY hex colors from the LEGO palette provided in the system instruction.
6. Front face should be at z=max (model faces the +z direction).
7. The model must be SOLID — no floating voxels or hollow interiors.
8. Every distinctive feature of the subject must be present (eyes, ears, tail, accessories, etc.).
9. Be consistent with colors — once you pick a hex for a body area, use that EXACT hex everywhere for that area.
10. Use contrasting colors for features (dark eyes on light face, etc.).${userNote}`;

  if (feedbackPrompt) {
    return `${rules}\n\n${feedbackPrompt}`;
  }
  return rules;
}

/**
 * Convert a flat voxel array to VoxelGrid format.
 * Deterministic transformation — no AI involved.
 */
export function flatToVoxelGrid(voxels: FlatVoxel[], meta: VoxelGenMeta): VoxelGrid {
  if (voxels.length === 0) {
    return {
      title: meta.title,
      description: meta.description,
      lore: meta.lore,
      referenceDescription: meta.referenceDescription,
      width: 1,
      depth: 1,
      layers: [],
    };
  }

  // 1. Normalize coordinates so all are non-negative
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  for (const v of voxels) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.z < minZ) minZ = v.z;
  }

  const normalized = voxels.map((v) => ({
    x: v.x - minX,
    y: v.y - minY,
    z: v.z - minZ,
    color: normalizeHexColor(v.color),
  }));

  // 2. Calculate dimensions
  let maxX = 0, maxY = 0, maxZ = 0;
  for (const v of normalized) {
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
    if (v.z > maxZ) maxZ = v.z;
  }
  const width = maxX + 1;
  const depth = maxZ + 1;

  // 3. Group by Y level
  const yGroups = new Map<number, typeof normalized>();
  for (const v of normalized) {
    const group = yGroups.get(v.y);
    if (group) {
      group.push(v);
    } else {
      yGroups.set(v.y, [v]);
    }
  }

  // 4. Build layers sorted by Y (bottom to top)
  const sortedYs = [...yGroups.keys()].sort((a, b) => a - b);
  const layers: VoxelLayer[] = sortedYs.map((y) => {
    const group = yGroups.get(y)!;

    // Create empty grid[z][x]
    const grid: string[][] = [];
    for (let z = 0; z < depth; z++) {
      grid.push(new Array(width).fill(''));
    }

    // Fill in voxel colors
    for (const v of group) {
      if (v.z >= 0 && v.z < depth && v.x >= 0 && v.x < width) {
        grid[v.z][v.x] = v.color;
      }
    }

    return {
      y,
      heightType: 'brick' as const,
      grid,
    };
  });

  return {
    title: meta.title,
    description: meta.description,
    lore: meta.lore,
    referenceDescription: meta.referenceDescription,
    width,
    depth,
    layers,
  };
}

/** Normalize hex color to uppercase #XXXXXX format */
function normalizeHexColor(color: string): string {
  let hex = color.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  hex = hex.toUpperCase();
  // Expand 3-char hex to 6-char
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  // Validate — fallback to gray if invalid
  if (!/^#[0-9A-F]{6}$/.test(hex)) {
    return '#A0A5A9';
  }
  return hex;
}

/**
 * Direct-voxel strategy: ask Gemini to produce a flat {x,y,z,color}[] array
 * (inspired by Google's voxel-toy-box demo), then deterministically convert
 * to VoxelGrid for the existing brick pipeline.
 *
 * Single-shot call to gemini-3-pro-preview (same model as voxel-toy-box demo).
 * On failure, returns null so the caller can fall back to silhouette extraction.
 */
export async function generateDirectVoxelGrid(params: {
  ai: GoogleGenAI;
  base64Image: string;
  mimeType: string;
  compositeView?: ImageData;
  detail: DesignDetail;
  userPrompt: string;
  feedbackPrompt: string;
  cfg: DirectVoxelConfig;
  agentStart: number;
  agentBudgetMs: number;
}): Promise<{ result: VoxelGenResult | null; lastError: Error | null }> {
  const {
    ai, base64Image, mimeType, compositeView, detail, userPrompt,
    feedbackPrompt, cfg,
    agentStart, agentBudgetMs,
  } = params;

  // Use gemini-3-pro-preview directly — same model as voxel-toy-box demo.
  // 3.1 Pro keeps failing with fetch errors; 3.0 Pro is proven for this task.
  const DIRECT_VOXEL_MODEL = 'gemini-3-pro-preview';
  // ONE shot. If it fails, bail fast to fallback.
  const PARSE_RETRIES = 1;
  // voxel-toy-box demo takes ~5 min. Give generous timeout for the single attempt.
  const PER_CALL_TIMEOUT = 420_000; // 7 minutes
  // Cap total time spent on direct-voxel to leave room for fallback + result saving.
  // Silhouette fallback needs ~2s, result saving ~10s. Reserve 60s as generous margin.
  const STRATEGY_BUDGET_MS = agentBudgetMs - 60_000;
  let lastError: Error | null = null;

  const range = VOXEL_RANGES[detail];

  for (let attempt = 1; attempt <= PARSE_RETRIES; attempt++) {
    const elapsed = Date.now() - agentStart;
    const strategyRemaining = STRATEGY_BUDGET_MS - elapsed;
    if (strategyRemaining < 30_000) {
      logger.warn(`  [direct-voxel] Skipping — strategy budget exhausted (${Math.round(strategyRemaining / 1000)}s remaining)`);
      break;
    }

    try {
      logger.info(`  [direct-voxel] Attempt ${attempt}/${PARSE_RETRIES} (model: ${DIRECT_VOXEL_MODEL})`);

      const contentParts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [
        { inlineData: { mimeType, data: base64Image } },
      ];
      if (compositeView) {
        contentParts.push(
          { text: '[Composite Views: hero 3/4, front, right side, back — 2×2 grid]' },
          { inlineData: { mimeType: compositeView.mimeType, data: compositeView.data } }
        );
      }

      const prompt = buildDirectVoxelPrompt(detail, userPrompt, !!compositeView, feedbackPrompt || undefined);
      contentParts.push({ text: prompt });

      const callTimeout = Math.min(PER_CALL_TIMEOUT, strategyRemaining - 10_000);

      const response = await withTimeout(
        ai.models.generateContent({
          model: DIRECT_VOXEL_MODEL,
          contents: contentParts,
          config: {
            temperature: 1.0,
            responseMimeType: 'application/json',
            responseSchema: directVoxelSchema,
            maxOutputTokens: cfg.maxOutput,
            systemInstruction: buildSystemInstruction(cfg.recognitionContext),
          },
        }),
        callTimeout,
        'Direct voxel generation'
      );

      if (!response.text) {
        logger.warn(`  [direct-voxel] Attempt ${attempt}: empty response`);
        lastError = new Error('Empty response');
        continue;
      }

      // Schema is Type.ARRAY — response is a flat voxel array directly
      const voxels: FlatVoxel[] = JSON.parse(response.text);

      if (!Array.isArray(voxels) || voxels.length === 0) {
        logger.warn(`  [direct-voxel] Attempt ${attempt}: no voxels in response`);
        lastError = new Error('No voxels in response');
        continue;
      }

      logger.info(`  [direct-voxel] Received ${voxels.length} voxels from model`);

      // Reject only truly degenerate outputs
      if (voxels.length < range.min) {
        logger.warn(`  [direct-voxel] Attempt ${attempt}: only ${voxels.length} voxels (min: ${range.min})`);
        lastError = new Error(`Too few voxels: ${voxels.length} < ${range.min}`);
        continue;
      }

      // Build metadata from recognition context (schema no longer includes metadata)
      const subject = cfg.recognizedSubject || 'creation';
      const meta: VoxelGenMeta = {
        title: `LEGO ${subject.charAt(0).toUpperCase() + subject.slice(1)}`,
        description: `A LEGO voxel art recreation of a ${subject}.`,
        lore: `Inspired by a real-life ${subject}, captured in brick form.`,
        referenceDescription: `A ${subject} from the reference photo.`,
      };

      const rawGrid = flatToVoxelGrid(voxels, meta);

      // Validate and normalize
      const voxelGrid = validateVoxelGrid(rawGrid);

      if (voxelGrid.layers.length === 0) {
        logger.warn(`  [direct-voxel] Attempt ${attempt}: all layers empty after validation`);
        lastError = new Error('All layers empty after validation');
        continue;
      }

      // Convert to bricks
      const { steps, report } = voxelGridToBricks(voxelGrid);

      logger.info(
        `  [direct-voxel] Conversion: ${voxels.length} voxels → ${report.totalBricks} bricks ` +
          `(avg size ${report.averageBrickSize.toFixed(1)}, ${report.layerCount} layers, ${voxelGrid.width}W × ${voxelGrid.depth}D)`
      );

      if (steps.length === 0) {
        logger.warn(`  [direct-voxel] Attempt ${attempt}: conversion produced 0 bricks`);
        lastError = new Error('Voxel conversion produced 0 bricks');
        continue;
      }

      // NOTE: No minBricks check here. Voxel count is validated above (range.min).
      // voxelGridToBricks() merges adjacent same-color voxels into larger bricks,
      // so fewer bricks with higher avg size is expected and desirable.

      return {
        result: {
          voxelGrid,
          steps,
          meta,
        },
        lastError: null,
      };
    } catch (error: any) {
      logger.error(`  [direct-voxel] Attempt ${attempt} failed: ${error.message}`);
      lastError = error;
      // No model chain switching — we use gemini-3-pro-preview only.
      // On failure, bail immediately to let the silhouette fallback run.
      break;
    }
  }

  return { result: null, lastError };
}
