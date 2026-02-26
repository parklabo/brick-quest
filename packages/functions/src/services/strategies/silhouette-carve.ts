import { Type } from '@google/genai';
import type { Schema, GoogleGenAI } from '@google/genai';
import { logger } from 'firebase-functions';
import type { VoxelGrid, VoxelLayer, DesignDetail, SubjectRecognition } from '@brick-quest/shared';
import { validateVoxelGrid, voxelGridToBricks } from '@brick-quest/shared';
import { config } from '../../config.js';
import { withTimeout } from '../../utils/with-timeout.js';
import { getThinkingConfig } from '../gemini-client.js';
import type { ImageData } from '../geminiDesign.js';
import type { FullGridConfig, VoxelGenMeta, VoxelGenResult } from './full-grid.js';
import { extractGridsFromComposite, type PixelExtractionResult } from './pixel-extract.js';

// ─────────────────────────────────────────────────────────────────────────────
// Silhouette Carving Strategy
//
// Instead of asking Gemini to imagine 3D coordinates (which it's terrible at),
// we ask it to do two EASY 2D tasks:
//   1. Read the FRONT view → 2D color grid[y][x]
//   2. Read the SIDE view  → 2D color grid[y][z]
//
// Then CODE (not AI) intersects the two silhouettes to create the 3D voxel grid.
// This is deterministic — no hallucinated coordinates, no flat walls.
//
// Output tokens: ~4K (two 2D grids) vs ~100K (full 3D grid) → 25x more efficient
// Shape accuracy: deterministic from silhouettes → always matches the views
// ─────────────────────────────────────────────────────────────────────────────

const GRID_LIMITS: Record<DesignDetail, { maxW: number; maxD: number; maxH: number }> = {
  simple: { maxW: 12, maxD: 12, maxH: 16 },
  standard: { maxW: 20, maxD: 18, maxH: 28 },
  detailed: { maxW: 28, maxD: 24, maxH: 36 },
};

/** Timeout for the view extraction call (Flash model, should be fast) */
const EXTRACTION_TIMEOUT = 60_000;

// ─── JSON schema for dual-view extraction ──────────────────────────────────

const viewExtractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    referenceDescription: { type: Type.STRING, description: 'One-sentence description of the subject' },
    title: { type: Type.STRING, description: 'Creative LEGO set name' },
    description: { type: Type.STRING, description: 'Short build description' },
    lore: { type: Type.STRING, description: 'Fun backstory for the model' },
    width: { type: Type.INTEGER, description: 'Stud columns counted from FRONT view (X axis, max limit given in prompt)' },
    depth: { type: Type.INTEGER, description: 'Stud columns counted from SIDE view (Z axis, max limit given in prompt)' },
    totalLayers: { type: Type.INTEGER, description: 'Layer count bottom to top (Y axis, max limit given in prompt)' },
    frontGrid: {
      type: Type.ARRAY,
      items: { type: Type.ARRAY, items: { type: Type.STRING } },
      description: 'FRONT view: grid[y][x]. y=0 is bottom row. Each cell: LEGO hex color "#RRGGBB" or "" for empty/background.',
    },
    sideGrid: {
      type: Type.ARRAY,
      items: { type: Type.ARRAY, items: { type: Type.STRING } },
      description: 'RIGHT SIDE view: grid[y][z]. y=0 is bottom. z=0 is front of model (left side of view), z=max is back. Each cell: hex or "".',
    },
  },
  required: ['referenceDescription', 'title', 'description', 'lore', 'width', 'depth', 'totalLayers', 'frontGrid', 'sideGrid'],
};

// ─── Extraction prompt ─────────────────────────────────────────────────────

function extractionPrompt(detail: DesignDetail, userPrompt: string, recognition?: SubjectRecognition): string {
  const lim = GRID_LIMITS[detail];

  // Build a concrete proportion guideline from recognition data if available
  let proportionGuide = '';
  if (recognition?.proportions) {
    const { widthToHeight, depthToWidth } = recognition.proportions;
    const exampleW = Math.round(lim.maxW * 0.85);
    const expectedH = Math.round(exampleW / Math.max(0.2, Math.min(3.0, widthToHeight)));
    const expectedD = Math.round(exampleW * Math.max(0.2, Math.min(2.0, depthToWidth)));
    proportionGuide = `
★★★ RECOGNIZED SUBJECT: "${recognition.subject}" ★★★
Pre-analysis determined these proportions:
  Width:Height ratio = ${widthToHeight.toFixed(2)} → For width=${exampleW}, totalLayers should be ≈${expectedH}
  Depth:Width ratio = ${depthToWidth.toFixed(2)} → For width=${exampleW}, depth should be ≈${expectedD}
YOU MUST USE THESE PROPORTIONS. Do NOT override with your own estimate.
`;
  }

  return `You are a pixel-art analyst. Convert 2 views of a LEGO model into 2D color grids.

COMPOSITE IMAGE LAYOUT (2×2 grid):
┌─────────────┬─────────────┐
│  TOP-LEFT   │  TOP-RIGHT  │
│  Hero 3/4   │   FRONT     │
│  (reference)│   VIEW      │
├─────────────┼─────────────┤
│ BOTTOM-LEFT │ BOTTOM-RIGHT│
│  RIGHT SIDE │   BACK      │
│  VIEW       │   VIEW      │
└─────────────┴─────────────┘

═══ STEP 0: PROPORTION ANALYSIS (do this FIRST) ═══
${proportionGuide}
Look at the HERO view (top-left). Determine the subject's proportions:
- Is it WIDE and FLAT (turtle, car, boat)? → width >> totalLayers
- Is it TALL and NARROW (person, tree, tower)? → totalLayers >> width
- Is it CUBIC (house, cube, bear)? → width ≈ totalLayers

The HEIGHT:WIDTH ratio MUST match the views. A flat turtle should have totalLayers ≈ 40-60% of width.
A cubic bear/box should have totalLayers ≈ 80-120% of width.
DO NOT set totalLayers to the maximum (${lim.maxH}) unless the subject is genuinely that tall relative to its width.

═══ STEP 1: EXTRACT FRONT VIEW GRID (top-right quadrant) ═══

1. Set "width" = number of stud columns at the WIDEST point (max ${lim.maxW}).
2. Set "totalLayers" = number of stud rows from bottom to top (proportional to width per Step 0).
3. Create frontGrid[y][x] — y=0 is bottom, x=0 is left.

★★★ SILHOUETTE ACCURACY IS CRITICAL ★★★
The OUTLINE (which cells are filled vs empty) defines the 3D shape.
If the model has a DOME or CURVED top, upper layers MUST be NARROWER:
  - Wide layer:  ["", "#E4CD9E", "#E4CD9E", "#E4CD9E", "#E4CD9E", "#E4CD9E", "#E4CD9E", ""]
  - Narrow layer: ["", "", "#E4CD9E", "#E4CD9E", "#E4CD9E", "#E4CD9E", "", ""]
  - Tip layer:    ["", "", "", "#E4CD9E", "#E4CD9E", "", "", ""]

❌ WRONG: Filling every column in every row → produces a RECTANGULAR BOX
✅ RIGHT: Empty ("") on the edges where the model curves inward → produces the real shape

For each layer y, look at the FRONT VIEW and ask: "How wide is the model AT THIS HEIGHT?"
If the model is narrower at this height, the edges MUST be empty ("").

═══ STEP 2: EXTRACT SIDE VIEW GRID (bottom-left quadrant) ═══

1. Set "depth" = stud columns at the DEEPEST point (max ${lim.maxD}).
2. sideGrid[y][z] — z=0 is FRONT of model (left in the view), z=max is BACK.
3. SAME totalLayers as Step 1.
4. Apply the SAME silhouette accuracy rules — taper the edges for curved/dome shapes.

═══ COLOR REFERENCE ═══
#FF0000 red, #B40000 dark red, #0055BF blue, #237841 green, #184632 dark green,
#FEC401 yellow, #F97B22 orange, #E4CD9E tan, #958A73 dark tan, #AA7D55 medium nougat,
#7C503A reddish brown, #352100 dark brown, #000000 black, #FFFFFF white,
#A0A5A9 light gray, #6C6E68 dark gray, #C870A0 pink, #75B5D4 medium azure

═══ RULES ═══
• Count STUDS, not pixels. Each visible stud = 1 grid cell.
• Both grids MUST have exactly totalLayers rows.
• frontGrid rows = exactly "width" entries. sideGrid rows = exactly "depth" entries.
• Include ALL details: eyes (#000000), patterns, color bands, accessories.
• Use consistent colors between views (same part = same hex).
• EDGES: Put "" where the model doesn't exist at that height. This is what makes the shape correct.
• A dome/round shape MUST taper — fewer filled cells in upper layers.
${userPrompt ? `\nSUBJECT NOTE: "${userPrompt}"` : ''}

Return valid JSON matching the schema.`;
}

// ─── Silhouette carving algorithm ──────────────────────────────────────────

type Grid3D = string[][][]; // [y][z][x]

function createGrid3D(width: number, depth: number, totalLayers: number): Grid3D {
  return Array.from({ length: totalLayers }, () =>
    Array.from({ length: depth }, () => new Array<string>(width).fill(''))
  );
}

/**
 * Determine color for a voxel based on its position relative to front/side faces.
 * Voxels near the front face use the front view color; near the right side, the side color.
 */
function colorForVoxel(
  x: number,
  z: number,
  frontColor: string,
  sideColor: string,
  width: number,
  depth: number
): string {
  // How close is this voxel to the front face (z=0)? 1 = at front, 0 = at back
  const frontProximity = depth > 1 ? 1 - z / (depth - 1) : 1;
  // How close to the right side (x=width-1)? 1 = at right, 0 = at left
  const sideProximity = width > 1 ? x / (width - 1) : 0;

  // Use color from the view whose face this voxel is closest to.
  // Front view is the "primary" view (tiebreaker).
  return frontProximity >= sideProximity ? frontColor : sideColor;
}

/**
 * Intersect front and side silhouettes to produce a 3D voxel grid.
 * A voxel at (y, z, x) exists IFF both front[y][x] and side[y][z] are non-empty.
 * Pure function — no side effects.
 */
export function silhouetteCarve(
  frontGrid: string[][],
  sideGrid: string[][],
  width: number,
  depth: number,
  totalLayers: number
): Grid3D {
  const grid = createGrid3D(width, depth, totalLayers);

  for (let y = 0; y < totalLayers; y++) {
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const fc = (frontGrid[y]?.[x] || '').trim();
        const sc = (sideGrid[y]?.[z] || '').trim();

        if (fc !== '' && sc !== '') {
          grid[y][z][x] = colorForVoxel(x, z, fc, sc, width, depth);
        }
      }
    }
  }

  // Post-process: apply ellipsoid rounding to remove boxy corners.
  // Silhouette carving produces the visual hull (maximum volume), which is always
  // more rectangular than the actual object. This step carves away corners using
  // an ellipsoid equation per layer, making domes and curves look natural.
  applyEllipsoidRounding(grid, width, depth, totalLayers);

  return grid;
}

/**
 * For each layer, compute the filled bounding box, then remove voxels outside
 * an ellipse inscribed in that bounding box. This rounds rectangular cross-sections
 * into elliptical ones — much more natural for organic shapes.
 *
 * The rounding strength increases for narrower layers (near the top of a dome),
 * so wide base layers stay rectangular while upper dome layers become round.
 */
function applyEllipsoidRounding(grid: Grid3D, width: number, depth: number, totalLayers: number): void {
  // First pass: find the widest layer (the "equator" of the model)
  let maxLayerArea = 0;
  let equatorY = 0;

  for (let y = 0; y < totalLayers; y++) {
    let area = 0;
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][z][x] !== '') area++;
      }
    }
    if (area > maxLayerArea) {
      maxLayerArea = area;
      equatorY = y;
    }
  }

  // Second pass: apply ellipsoid rounding per layer
  for (let y = 0; y < totalLayers; y++) {
    let minX = width, maxX = -1, minZ = depth, maxZ = -1;
    let filledCount = 0;

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][z][x] !== '') {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);
          filledCount++;
        }
      }
    }

    if (filledCount === 0) continue;

    const layerW = maxX - minX + 1;
    const layerD = maxZ - minZ + 1;

    // Skip small features (legs, eyes, head protrusions)
    if (layerW < 5 || layerD < 5) continue;

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    // Distance from equator determines rounding strength.
    // At equator: gentle rounding (factor=0.55, keeps ~90% of area)
    // Far from equator (top/bottom): aggressive rounding (factor=0.40, keeps ~60%)
    // This creates dome/taper shapes from rectangular silhouettes.
    const distFromEquator = totalLayers > 1 ? Math.abs(y - equatorY) / (totalLayers - 1) : 0;
    const factor = 0.55 - distFromEquator * 0.18; // 0.55 at equator → 0.37 at extremes

    const rx = layerW * factor;
    const rz = layerD * factor;

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (grid[y][z][x] === '') continue;

        const dx = (x - cx) / rx;
        const dz = (z - cz) / rz;

        if (dx * dx + dz * dz > 1.0) {
          grid[y][z][x] = '';
        }
      }
    }
  }
}

/** Convert internal Grid3D to VoxelGrid format */
function grid3DToVoxelGrid(
  grid: Grid3D,
  meta: VoxelGenMeta,
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
      layers.push({ y, heightType: 'brick', grid: layerGrid });
    }
  }

  return { ...meta, width, depth, layers };
}

// ─── Normalize extracted grids ─────────────────────────────────────────────

/** Ensure grid has exactly the declared dimensions, padding or clipping as needed */
function normalizeGrid(grid: string[][], rows: number, cols: number): string[][] {
  const result: string[][] = [];
  for (let y = 0; y < rows; y++) {
    const srcRow = grid[y] || [];
    const row: string[] = [];
    for (let x = 0; x < cols; x++) {
      const cell = (srcRow[x] || '').trim();
      // Normalize: ensure # prefix for non-empty cells
      if (cell && !cell.startsWith('#')) {
        row.push(`#${cell}`);
      } else {
        row.push(cell);
      }
    }
    result.push(row);
  }
  return result;
}

/** Count non-empty cells in a 2D grid */
function countFilled(grid: string[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell && cell !== '') count++;
    }
  }
  return count;
}

// ─── Proportion enforcement ────────────────────────────────────────────────

/**
 * Trim rows that are completely empty in BOTH grids (synchronized).
 * Returns the trimmed grids and the new totalLayers.
 */
function trimEmptyRows(
  frontGrid: string[][],
  sideGrid: string[][],
  totalLayers: number
): { front: string[][]; side: string[][]; newLayers: number; trimmedTop: number; trimmedBottom: number } {
  let topTrim = 0;
  let bottomTrim = 0;

  // Trim from top (highest y values)
  for (let y = totalLayers - 1; y >= 0; y--) {
    const frontEmpty = !frontGrid[y]?.some((c) => c !== '');
    const sideEmpty = !sideGrid[y]?.some((c) => c !== '');
    if (frontEmpty && sideEmpty) topTrim++;
    else break;
  }

  // Trim from bottom (y=0)
  for (let y = 0; y < totalLayers - topTrim; y++) {
    const frontEmpty = !frontGrid[y]?.some((c) => c !== '');
    const sideEmpty = !sideGrid[y]?.some((c) => c !== '');
    if (frontEmpty && sideEmpty) bottomTrim++;
    else break;
  }

  const newLayers = totalLayers - topTrim - bottomTrim;
  if (newLayers === totalLayers) {
    return { front: frontGrid, side: sideGrid, newLayers: totalLayers, trimmedTop: 0, trimmedBottom: 0 };
  }

  return {
    front: frontGrid.slice(bottomTrim, totalLayers - topTrim),
    side: sideGrid.slice(bottomTrim, totalLayers - topTrim),
    newLayers,
    trimmedTop: topTrim,
    trimmedBottom: bottomTrim,
  };
}

/**
 * Nearest-neighbor resample a 2D grid to a different number of rows.
 * Used when proportion enforcement requires changing totalLayers.
 */
function resampleGrid(grid: string[][], targetRows: number): string[][] {
  const sourceRows = grid.length;
  if (sourceRows === targetRows) return grid;

  const result: string[][] = [];
  for (let targetY = 0; targetY < targetRows; targetY++) {
    const sourceY = Math.min(Math.round((targetY * (sourceRows - 1)) / Math.max(1, targetRows - 1)), sourceRows - 1);
    result.push([...grid[sourceY]]);
  }
  return result;
}

/**
 * Analyze silhouette quality — detect if grids are nearly rectangular (useless silhouette).
 * Returns the fraction of rows that are >85% filled across their bounding box.
 */
function silhouetteQuality(grid: string[][], label: string): { avgFillRatio: number; rectangularRows: number; totalRows: number } {
  let rectangularRows = 0;
  let totalFillRatio = 0;
  let contentRows = 0;

  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    const filled = row.filter((c) => c !== '').length;
    if (filled === 0) continue;

    contentRows++;
    const fillRatio = filled / row.length;
    totalFillRatio += fillRatio;
    if (fillRatio > 0.85) rectangularRows++;
  }

  const avgFillRatio = contentRows > 0 ? totalFillRatio / contentRows : 0;
  if (rectangularRows > contentRows * 0.7) {
    logger.warn(
      `  [silhouette] ${label} grid is nearly rectangular: ` +
        `${rectangularRows}/${contentRows} rows >85% filled (avg ${(avgFillRatio * 100).toFixed(0)}%). Silhouette shaping will be minimal.`
    );
  }

  return { avgFillRatio, rectangularRows, totalRows: contentRows };
}

/**
 * Enforce proportions using recognition data.
 * If the extracted totalLayers is disproportionate to width, resample to correct height.
 *
 * Recognition provides widthToHeight (width as fraction of height):
 *   expectedHeight = width / widthToHeight
 *
 * We allow up to 30% deviation before enforcing, to tolerate BrickHeadz-style exaggeration.
 */
function enforceProportions(
  frontGrid: string[][],
  sideGrid: string[][],
  width: number,
  depth: number,
  totalLayers: number,
  recognition: SubjectRecognition | undefined
): { front: string[][]; side: string[][]; totalLayers: number; enforced: boolean } {
  if (!recognition?.proportions) {
    return { front: frontGrid, side: sideGrid, totalLayers, enforced: false };
  }

  const { widthToHeight, depthToWidth } = recognition.proportions;

  // widthToHeight = width / height → height = width / widthToHeight
  // Clamp to sane range to prevent division issues
  const clampedRatio = Math.max(0.2, Math.min(3.0, widthToHeight));
  const expectedHeight = Math.round(width / clampedRatio);

  // Also validate depth while we're at it
  const clampedDepthRatio = Math.max(0.2, Math.min(2.0, depthToWidth));
  const expectedDepth = Math.round(width * clampedDepthRatio);

  logger.info(
    `  [silhouette] Proportion check: extracted ${width}W×${depth}D×${totalLayers}H, ` +
      `recognition expects ~${width}W×${expectedDepth}D×${expectedHeight}H ` +
      `(widthToHeight=${widthToHeight.toFixed(2)}, depthToWidth=${depthToWidth.toFixed(2)})`
  );

  // Allow 40% overshoot before enforcing (generous margin for stylistic exaggeration)
  const maxAllowedHeight = Math.round(expectedHeight * 1.4);

  if (totalLayers <= maxAllowedHeight) {
    logger.info(`  [silhouette] Proportions OK (${totalLayers} ≤ ${maxAllowedHeight} max allowed)`);
    return { front: frontGrid, side: sideGrid, totalLayers, enforced: false };
  }

  // Clamp height and resample both grids
  const targetLayers = Math.max(6, maxAllowedHeight);
  logger.info(
    `  [silhouette] ★ ENFORCING proportions: ${totalLayers} layers → ${targetLayers} layers ` +
      `(expected ~${expectedHeight}, max allowed ${maxAllowedHeight})`
  );

  return {
    front: resampleGrid(frontGrid, targetLayers),
    side: resampleGrid(sideGrid, targetLayers),
    totalLayers: targetLayers,
    enforced: true,
  };
}

// ─── Common carve-to-result pipeline ─────────────────────────────────────────

/**
 * Shared pipeline: take extracted 2D grids → carve → voxelize → bricks.
 * Used by both sharp (Tier 1) and Flash (Tier 2) extraction paths.
 */
function gridsToResult(
  frontGrid: string[][],
  sideGrid: string[][],
  width: number,
  depth: number,
  totalLayers: number,
  meta: VoxelGenMeta,
  minBricks: number,
  label: string
): VoxelGenResult | null {
  const grid3d = silhouetteCarve(frontGrid, sideGrid, width, depth, totalLayers);

  let voxelCount = 0;
  for (let y = 0; y < totalLayers; y++) {
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        if (grid3d[y][z][x] !== '') voxelCount++;
      }
    }
  }

  logger.info(`  [${label}] Carved ${voxelCount} voxels from silhouette intersection`);

  if (voxelCount < 20) {
    logger.warn(`  [${label}] Too few voxels after carving: ${voxelCount}`);
    return null;
  }

  const rawVoxelGrid = grid3DToVoxelGrid(grid3d, meta, width, depth);
  const voxelGrid = validateVoxelGrid(rawVoxelGrid);

  if (voxelGrid.layers.length === 0) {
    logger.warn(`  [${label}] All layers empty after conversion`);
    return null;
  }

  const { steps, report } = voxelGridToBricks(voxelGrid);

  logger.info(
    `  [${label}] Brick conversion: ${report.totalVoxels} voxels → ${report.totalBricks} bricks ` +
      `(avg size ${report.averageBrickSize.toFixed(1)}, ${report.layerCount} layers)`
  );

  if (steps.length === 0 || steps.length < minBricks) {
    logger.warn(`  [${label}] Too few bricks: ${steps.length} (min: ${minBricks})`);
    return null;
  }

  return { voxelGrid, steps, meta };
}

// ─── Main strategy entry point ─────────────────────────────────────────────

/**
 * Silhouette Carving Strategy (2-tier extraction):
 *
 * Tier 1 (Sharp — deterministic): Read pixels directly from composite image.
 *   - 100% accurate silhouettes, 0 tokens, ~200ms
 *   - Proportions derived from image bounding box or recognition data
 *
 * Tier 2 (Gemini Flash — LLM fallback): Ask Flash to extract 2D grids.
 *   - Falls back here if sharp extraction fails (e.g., unusual image format)
 *   - Uses the existing prompt-based extraction
 *
 * Then CODE (not AI) intersects the two silhouettes to create the 3D voxel grid.
 *
 * REQUIRES composite views. Falls back to build commands if no views available.
 */
export async function generateSilhouetteVoxelGrid(params: {
  ai: GoogleGenAI;
  compositeView: ImageData;
  detail: DesignDetail;
  userPrompt: string;
  cfg: FullGridConfig;
  recognition?: SubjectRecognition;
  isRetry: boolean;
  feedbackPrompt: string;
  agentStart: number;
  agentBudgetMs: number;
  onProgress?: (msg: string) => Promise<void>;
}): Promise<{ result: VoxelGenResult | null; lastError: Error | null; pixelExtraction?: PixelExtractionResult }> {
  const { ai, compositeView, detail, userPrompt, cfg, recognition, feedbackPrompt, agentStart, agentBudgetMs, onProgress } = params;
  const lim = GRID_LIMITS[detail];
  let lastError: Error | null = null;

  // ─── Tier 1: Sharp pixel extraction (deterministic, no AI) ─────────────
  let pixelExtraction: PixelExtractionResult | undefined;
  try {
    logger.info(`  [silhouette] Tier 1: Sharp pixel extraction`);
    if (onProgress) await onProgress('Extracting pixels from views (sharp)...');

    pixelExtraction = await extractGridsFromComposite(compositeView.data, compositeView.mimeType, detail, recognition);

    let { frontGrid, sideGrid, width, depth, totalLayers } = pixelExtraction;

    const rawFrontFilled = countFilled(frontGrid);
    const rawSideFilled = countFilled(sideGrid);

    logger.info(
      `  [silhouette] Sharp extraction: ${width}W × ${depth}D × ${totalLayers}H, ` +
        `front: ${rawFrontFilled} cells, side: ${rawSideFilled} cells (${pixelExtraction.extractionMs}ms)`
    );

    if (rawFrontFilled < 10 || rawSideFilled < 10) {
      throw new Error(`Grids too sparse: front=${rawFrontFilled}, side=${rawSideFilled}`);
    }

    // Trim empty rows
    const trimResult = trimEmptyRows(frontGrid, sideGrid, totalLayers);
    if (trimResult.trimmedTop > 0 || trimResult.trimmedBottom > 0) {
      logger.info(
        `  [silhouette] Trimmed ${trimResult.trimmedBottom} bottom + ${trimResult.trimmedTop} top empty rows → ${trimResult.newLayers} layers`
      );
      frontGrid = trimResult.front;
      sideGrid = trimResult.side;
      totalLayers = trimResult.newLayers;
    }

    // Silhouette quality check
    silhouetteQuality(frontGrid, 'front');
    silhouetteQuality(sideGrid, 'side');

    // Enforce proportions from recognition data
    const propResult = enforceProportions(frontGrid, sideGrid, width, depth, totalLayers, recognition);
    if (propResult.enforced) {
      frontGrid = propResult.front;
      sideGrid = propResult.side;
      totalLayers = propResult.totalLayers;
    }

    logger.info(
      `  [silhouette] Final grids: ${width}W × ${depth}D × ${totalLayers}H, ` +
        `front: ${countFilled(frontGrid)} cells, side: ${countFilled(sideGrid)} cells`
    );

    if (onProgress) await onProgress('Carving 3D shape from silhouettes...');

    // Use placeholder meta — text fields will come from recognition or defaults
    const meta: VoxelGenMeta = {
      title: recognition ? `LEGO ${recognition.subject}` : 'LEGO Creation',
      description: recognition ? `A LEGO voxel art model of ${recognition.subject}` : 'A LEGO model',
      lore: recognition ? `Inspired by the iconic ${recognition.subject}.` : 'Built with bricks.',
      referenceDescription: recognition?.subject || 'An object from the photo.',
    };

    const result = gridsToResult(frontGrid, sideGrid, width, depth, totalLayers, meta, cfg.minBricks, 'silhouette-sharp');

    if (result) {
      logger.info(`  [silhouette] ★ Sharp extraction succeeded — ${result.steps.length} bricks`);
      return { result, lastError: null, pixelExtraction };
    }

    lastError = new Error('Sharp extraction produced insufficient bricks');
    logger.info(`  [silhouette] Sharp extraction result insufficient, falling back to Flash`);
  } catch (error: any) {
    logger.warn(`  [silhouette] Tier 1 (sharp) failed: ${error.message}`);
    lastError = error;
  }

  // ─── Tier 2: Gemini Flash extraction (LLM fallback) ────────────────────
  const PARSE_RETRIES = 3;

  const prompt = extractionPrompt(detail, userPrompt, recognition);
  const currentPrompt = feedbackPrompt ? `${prompt}\n\n${feedbackPrompt}` : prompt;

  for (let attempt = 1; attempt <= PARSE_RETRIES; attempt++) {
    const budgetRemaining = agentBudgetMs - (Date.now() - agentStart);
    if (budgetRemaining < 30_000) {
      logger.warn(`  [silhouette] Skipping Flash attempt ${attempt} — only ${Math.round(budgetRemaining / 1000)}s remaining`);
      break;
    }

    try {
      logger.info(`  [silhouette] Tier 2: Flash extraction attempt ${attempt}/${PARSE_RETRIES}`);
      if (onProgress) await onProgress(`Extracting view grids via Flash (attempt ${attempt})...`);

      const systemParts = [
        'You are a LEGO model analyst. Extract 2D color grids from composite view images. Be precise — count studs carefully.',
      ];
      if (cfg.recognitionContext) {
        systemParts.push(cfg.recognitionContext);
      }

      const response = await withTimeout(
        ai.models.generateContent({
          model: config.gemini.fastModel,
          contents: [
            { inlineData: { mimeType: compositeView.mimeType, data: compositeView.data } },
            { text: currentPrompt },
          ],
          config: {
            temperature: 0.5,
            responseMimeType: 'application/json',
            responseSchema: viewExtractionSchema,
            maxOutputTokens: 32768,
            thinkingConfig: getThinkingConfig(config.gemini.fastModel, 'low'),
            systemInstruction: systemParts.join('\n\n'),
          },
        }),
        EXTRACTION_TIMEOUT,
        'View grid extraction'
      );

      if (!response.text) {
        lastError = new Error('Empty extraction response');
        continue;
      }

      const raw = JSON.parse(response.text);

      const width = Math.max(1, Math.min(lim.maxW, Math.round(raw.width || 8)));
      const depth = Math.max(1, Math.min(lim.maxD, Math.round(raw.depth || 8)));
      let totalLayers = Math.max(1, Math.min(lim.maxH, Math.round(raw.totalLayers || 12)));

      if (!Array.isArray(raw.frontGrid) || !Array.isArray(raw.sideGrid)) {
        lastError = new Error('Missing frontGrid or sideGrid in response');
        continue;
      }

      let frontGrid = normalizeGrid(raw.frontGrid, totalLayers, width);
      let sideGrid = normalizeGrid(raw.sideGrid, totalLayers, depth);

      const rawFrontFilled = countFilled(frontGrid);
      const rawSideFilled = countFilled(sideGrid);

      logger.info(
        `  [silhouette] Flash extraction: ${width}W × ${depth}D × ${totalLayers}H, ` +
          `front: ${rawFrontFilled} cells, side: ${rawSideFilled} cells`
      );

      if (rawFrontFilled < 10 || rawSideFilled < 10) {
        lastError = new Error(`Grids too sparse: front=${rawFrontFilled}, side=${rawSideFilled}`);
        logger.warn(`  [silhouette] ${lastError.message}`);
        continue;
      }

      const trimResult = trimEmptyRows(frontGrid, sideGrid, totalLayers);
      if (trimResult.trimmedTop > 0 || trimResult.trimmedBottom > 0) {
        logger.info(
          `  [silhouette] Trimmed ${trimResult.trimmedBottom} bottom + ${trimResult.trimmedTop} top empty rows → ${trimResult.newLayers} layers`
        );
        frontGrid = trimResult.front;
        sideGrid = trimResult.side;
        totalLayers = trimResult.newLayers;
      }

      silhouetteQuality(frontGrid, 'front');
      silhouetteQuality(sideGrid, 'side');

      const propResult = enforceProportions(frontGrid, sideGrid, width, depth, totalLayers, recognition);
      if (propResult.enforced) {
        frontGrid = propResult.front;
        sideGrid = propResult.side;
        totalLayers = propResult.totalLayers;
      }

      logger.info(
        `  [silhouette] Final grids: ${width}W × ${depth}D × ${totalLayers}H, ` +
          `front: ${countFilled(frontGrid)} cells, side: ${countFilled(sideGrid)} cells`
      );

      if (onProgress) await onProgress('Carving 3D shape from silhouettes...');

      const meta: VoxelGenMeta = {
        title: raw.title || 'LEGO Creation',
        description: raw.description || 'A LEGO model',
        lore: raw.lore || 'Built with bricks.',
        referenceDescription: raw.referenceDescription || 'An object from the photo.',
      };

      const result = gridsToResult(frontGrid, sideGrid, width, depth, totalLayers, meta, cfg.minBricks, 'silhouette-flash');

      if (result) {
        return { result, lastError: null, pixelExtraction };
      }

      lastError = new Error('Flash extraction produced insufficient bricks');
    } catch (error: any) {
      logger.error(`  [silhouette] Flash attempt ${attempt} failed:`, error.message);
      lastError = error;

      if (attempt < PARSE_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
      }
    }
  }

  return { result: null, lastError, pixelExtraction };
}
