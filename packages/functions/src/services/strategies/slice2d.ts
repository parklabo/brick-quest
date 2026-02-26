import { Type } from '@google/genai';
import type { Schema, GoogleGenAI } from '@google/genai';
import { logger } from 'firebase-functions';
import type { VoxelGrid, VoxelLayer, DesignDetail } from '@brick-quest/shared';
import { validateVoxelGrid, voxelGridToBricks, buildSliceAnalysisPrompt, buildSliceFacePrompt } from '@brick-quest/shared';
import type { SliceFace } from '@brick-quest/shared';
import { withTimeout } from '../../utils/with-timeout.js';
import { getThinkingConfig } from '../gemini-client.js';
import type { ImageData } from '../geminiDesign.js';
import type { VoxelGenMeta, VoxelGenResult } from './full-grid.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SliceAnalysis {
  width: number;
  depth: number;
  totalLayers: number;
  palette: { hex: string; name: string }[];
  sections: {
    name: string;
    layerStart: number;
    layerEnd: number;
    dominantColor: string;
    widthAtSection: number;
    depthAtSection: number;
  }[];
  title: string;
  description: string;
  lore: string;
  referenceDescription: string;
}

/** A 2D face grid: [layer][column] = hex color or "" */
type Face2D = string[][];

// ---------------------------------------------------------------------------
// JSON Schemas for Gemini structured output
// ---------------------------------------------------------------------------

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    width: { type: Type.INTEGER },
    depth: { type: Type.INTEGER },
    totalLayers: { type: Type.INTEGER },
    palette: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hex: { type: Type.STRING },
          name: { type: Type.STRING },
        },
        required: ['hex', 'name'],
      },
    },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          layerStart: { type: Type.INTEGER },
          layerEnd: { type: Type.INTEGER },
          dominantColor: { type: Type.STRING },
          widthAtSection: { type: Type.INTEGER },
          depthAtSection: { type: Type.INTEGER },
        },
        required: ['name', 'layerStart', 'layerEnd', 'dominantColor', 'widthAtSection', 'depthAtSection'],
      },
    },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    lore: { type: Type.STRING },
    referenceDescription: { type: Type.STRING },
  },
  required: ['width', 'depth', 'totalLayers', 'palette', 'sections', 'title', 'description', 'lore', 'referenceDescription'],
};

const face2dSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.ARRAY,
    items: { type: Type.STRING },
  },
};

// ---------------------------------------------------------------------------
// Gemini calls
// ---------------------------------------------------------------------------

const CALL_TIMEOUT = 120_000;

async function analyzeCompositeViews(
  ai: GoogleGenAI,
  compositeView: ImageData,
  base64Image: string,
  mimeType: string,
  detail: DesignDetail,
  userPrompt: string,
): Promise<SliceAnalysis> {
  const prompt = buildSliceAnalysisPrompt(detail, userPrompt);

  const response = await withTimeout(
    ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { inlineData: { mimeType, data: base64Image } },
        { text: '[Composite Views: hero 3/4, front, right side, back — 2×2 grid]' },
        { inlineData: { mimeType: compositeView.mimeType, data: compositeView.data } },
        { text: prompt },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: analysisSchema,
        maxOutputTokens: 8192,
        thinkingConfig: getThinkingConfig('gemini-3-flash-preview', 'medium'),
      },
    }),
    CALL_TIMEOUT,
    'Slice analysis'
  );

  const raw = JSON.parse(response.text || '{}');

  // Clamp to reasonable bounds
  raw.width = Math.max(4, Math.min(raw.width || 12, 28));
  raw.depth = Math.max(4, Math.min(raw.depth || 8, 24));
  raw.totalLayers = Math.max(4, Math.min(raw.totalLayers || 16, 36));

  // Sanity check: depth should not exceed width for most subjects (characters, animals).
  // If depth > width, the analysis likely included a background panel.
  // Clamp depth to at most 80% of width as a safety measure.
  const maxReasonableDepth = Math.max(6, Math.ceil(raw.width * 0.8));
  if (raw.depth > maxReasonableDepth) {
    logger.warn(`2D-slice: clamping depth from ${raw.depth} to ${maxReasonableDepth} (width=${raw.width})`);
    raw.depth = maxReasonableDepth;
    // Also clamp section depthAtSection values
    for (const s of raw.sections || []) {
      if (s.depthAtSection > raw.depth) s.depthAtSection = raw.depth;
    }
  }

  return raw as SliceAnalysis;
}

async function generateFace(
  ai: GoogleGenAI,
  compositeView: ImageData,
  face: SliceFace,
  analysis: SliceAnalysis,
  detail: DesignDetail,
): Promise<Face2D> {
  const prompt = buildSliceFacePrompt(face, analysis, detail);

  const response = await withTimeout(
    ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: '[Composite Views: hero 3/4, front, right side, back — 2×2 grid]' },
        { inlineData: { mimeType: compositeView.mimeType, data: compositeView.data } },
        { text: prompt },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: face2dSchema,
        maxOutputTokens: 32000,
        thinkingConfig: getThinkingConfig('gemini-3-flash-preview', 'low'),
      },
    }),
    CALL_TIMEOUT,
    `Face generation (${face})`
  );

  const grid = JSON.parse(response.text || '[]') as Face2D;

  // Validate dimensions: rows = totalLayers, cols vary by face
  const expectedCols = face === 'side' ? analysis.depth : analysis.width;
  for (let r = 0; r < grid.length; r++) {
    if (!Array.isArray(grid[r])) grid[r] = [];
    // Pad or trim to expected column count
    while (grid[r].length < expectedCols) grid[r].push('');
    if (grid[r].length > expectedCols) grid[r].length = expectedCols;
  }
  // Pad or trim to expected row count
  while (grid.length < analysis.totalLayers) grid.push(new Array(expectedCols).fill(''));
  if (grid.length > analysis.totalLayers) grid.length = analysis.totalLayers;

  return grid;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count non-empty cells in a Face2D grid */
function countFaceCells(face: Face2D): number {
  let count = 0;
  for (const row of face) {
    for (const cell of row) {
      if (cell && cell !== '') count++;
    }
  }
  return count;
}

/** Find the range of non-empty entries in a boolean mask */
function findExtent(mask: boolean[]): { min: number; max: number } {
  let min = -1;
  let max = -1;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      if (min === -1) min = i;
      max = i;
    }
  }
  return { min, max };
}

/** Get the color from a face row, returning '' if empty */
function faceColor(row: string[], idx: number): string {
  const c = row[idx];
  return (c && c !== '') ? c : '';
}

// ---------------------------------------------------------------------------
// 3D Assembly: deterministic code, no AI calls
// ---------------------------------------------------------------------------

/**
 * Assemble a 3D VoxelGrid from three 2D face grids.
 *
 * Algorithm per layer:
 * 1. Build silhouette masks from face grids
 * 2. Find the actual model extent from masks (not grid edges)
 * 3. Constrain cross-section using section widthAtSection / depthAtSection
 * 4. Apply superellipse carving for rounded corners
 * 5. Color cells using depth-ratio blending (front→fill→back, side overrides)
 */
function assemble3DFromFaces(
  front: Face2D,
  side: Face2D,
  back: Face2D,
  analysis: SliceAnalysis,
): VoxelGrid {
  const { width, depth, totalLayers, sections } = analysis;

  // Robust fallback color: first palette color or default gray
  const defaultFillColor = analysis.palette[0]?.hex || '#A0A5A9';

  const layers: VoxelLayer[] = [];

  for (let y = 0; y < totalLayers; y++) {
    // Determine height type
    const isDetailLayer = sections.some(
      (s) =>
        y >= s.layerStart &&
        y <= s.layerEnd &&
        (y === s.layerStart || y === s.layerEnd ||
         s.name.toLowerCase().includes('eye') ||
         s.name.toLowerCase().includes('face') ||
         s.name.toLowerCase().includes('mouth'))
    );
    const heightType = isDetailLayer ? 'plate' as const : 'brick' as const;

    // Build silhouette masks from the face grids
    const frontRow = front[y] || [];
    const sideRow = side[y] || [];
    const backRow = back[y] || [];

    const frontMask: boolean[] = [];
    const backMask: boolean[] = [];
    for (let x = 0; x < width; x++) {
      frontMask[x] = !!(frontRow[x] && frontRow[x] !== '');
      backMask[x] = !!(backRow[x] && backRow[x] !== '');
    }

    const sideMask: boolean[] = [];
    for (let z = 0; z < depth; z++) {
      sideMask[z] = !!(sideRow[z] && sideRow[z] !== '');
    }

    // Combined X mask
    const xMask: boolean[] = [];
    for (let x = 0; x < width; x++) {
      xMask[x] = frontMask[x] || backMask[x];
    }

    // Find actual model extent from masks
    const zExtent = findExtent(sideMask);
    const xExtent = findExtent(xMask);

    // Empty layer — no content in any face
    if (zExtent.min === -1 && xExtent.min === -1) {
      layers.push({ y, heightType, grid: Array.from({ length: depth }, () => new Array(width).fill('')) });
      continue;
    }

    const zMin = zExtent.min !== -1 ? zExtent.min : 0;
    const zMax = zExtent.max !== -1 ? zExtent.max : depth - 1;
    const xMin = xExtent.min !== -1 ? xExtent.min : 0;
    const xMax = xExtent.max !== -1 ? xExtent.max : width - 1;

    // Section-based shape constraints
    const section = sections.find((s) => y >= s.layerStart && y <= s.layerEnd);
    const fillColor = (section?.dominantColor && section.dominantColor !== '') ? section.dominantColor : defaultFillColor;

    // Use section dimensions to constrain the cross-section (capped by mask extent)
    const maskW = xMax - xMin + 1;
    const maskD = zMax - zMin + 1;
    const sectionW = section ? Math.min(section.widthAtSection, maskW) : maskW;
    const sectionD = section ? Math.min(section.depthAtSection, maskD) : maskD;

    // Center of the model at this layer
    const xCenter = (xMin + xMax) / 2;
    const zCenter = (zMin + zMax) / 2;
    const halfW = sectionW / 2;
    const halfD = sectionD / 2;

    // Depth range for color blending
    const depthRange = zMax - zMin;

    // Build the 2D grid for this layer: grid[z][x]
    const grid: string[][] = [];
    for (let z = 0; z < depth; z++) {
      const row: string[] = [];
      for (let x = 0; x < width; x++) {
        // --- Existence check ---
        // Use superellipse for rounded shape: |dx|^n + |dz|^n <= 1
        // n=3 gives a "squircle" — rounder than rectangle, less aggressive than ellipse
        const dx = halfW > 0 ? Math.abs(x - xCenter) / halfW : 0;
        const dz = halfD > 0 ? Math.abs(z - zCenter) / halfD : 0;
        const superDist = dx * dx * dx + dz * dz * dz; // n=3 superellipse
        const inShape = superDist <= 1.0;

        // Also include explicit face boundary cells even if slightly outside shape
        const isFrontBoundary = z === zMin && frontMask[x];
        const isBackBoundary = z === zMax && backMask[x];
        const isRightBoundary = x === xMax && sideMask[z];
        const isLeftBoundary = x === xMin && sideMask[z];

        const exists = inShape || isFrontBoundary || isBackBoundary || isRightBoundary || isLeftBoundary;

        if (!exists) {
          row.push('');
          continue;
        }

        // --- Color assignment using depth-ratio blending ---
        // depthRatio: 0.0 = front face, 1.0 = back face
        const depthRatio = depthRange > 0 ? (z - zMin) / depthRange : 0.5;
        // widthRatio: 0.0 = left edge, 1.0 = right edge
        const widthRange = xMax - xMin;
        const widthRatio = widthRange > 0 ? (x - xMin) / widthRange : 0.5;

        let color = fillColor;

        // Priority 1: Side face override at left/right edges
        if (widthRatio <= 0.15 && faceColor(sideRow, z)) {
          color = faceColor(sideRow, z);
        } else if (widthRatio >= 0.85 && faceColor(sideRow, z)) {
          color = faceColor(sideRow, z);
        }
        // Priority 2: Front/back face based on depth ratio
        else if (depthRatio <= 0.35) {
          // Front zone — use front face color
          color = faceColor(frontRow, x) || fillColor;
        } else if (depthRatio >= 0.65) {
          // Back zone — use back face color
          color = faceColor(backRow, x) || fillColor;
        }
        // Priority 3: Interior — use section fill color (already set)

        // Final fallback
        if (!color || color === '') {
          color = fillColor;
        }

        row.push(color);
      }
      grid.push(row);
    }

    layers.push({ y, heightType, grid });
  }

  return {
    title: analysis.title || 'LEGO Creation',
    description: analysis.description || 'A LEGO recreation',
    lore: analysis.lore || 'Inspired by real life.',
    referenceDescription: analysis.referenceDescription,
    width,
    depth,
    layers,
  };
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function generate2DSliceVoxelGrid(params: {
  ai: GoogleGenAI;
  compositeView: ImageData;
  base64Image: string;
  mimeType: string;
  detail: DesignDetail;
  userPrompt: string;
  feedbackPrompt: string;
  budgetMs: number;
  agentStart: number;
  onProgress?: (msg: string) => Promise<void>;
}): Promise<VoxelGenResult> {
  const { ai, compositeView, base64Image, mimeType, detail, userPrompt, onProgress } = params;

  // Step 1: Analyze composite views → dimensions, palette, sections
  if (onProgress) await onProgress('Analyzing views (2D-slice)...');
  logger.info('2D-slice: analyzing composite views');

  const analysis = await analyzeCompositeViews(ai, compositeView, base64Image, mimeType, detail, userPrompt);

  logger.info(
    `2D-slice analysis: ${analysis.width}W × ${analysis.depth}D × ${analysis.totalLayers}L, ` +
      `${analysis.palette.length} colors, ${analysis.sections.length} sections`
  );

  // Step 2: Generate all three 2D faces in parallel
  if (onProgress) await onProgress('Generating 2D faces (front/side/back)...');
  logger.info('2D-slice: generating 3 faces in parallel');

  const [front, side, back] = await Promise.all([
    generateFace(ai, compositeView, 'front', analysis, detail),
    generateFace(ai, compositeView, 'side', analysis, detail),
    generateFace(ai, compositeView, 'back', analysis, detail),
  ]);

  const frontCells = countFaceCells(front);
  const sideCells = countFaceCells(side);
  const backCells = countFaceCells(back);

  logger.info(
    `2D-slice faces: front=${front.length}×${front[0]?.length || 0} (${frontCells} filled), ` +
      `side=${side.length}×${side[0]?.length || 0} (${sideCells} filled), ` +
      `back=${back.length}×${back[0]?.length || 0} (${backCells} filled)`
  );

  // Log sample face data for debugging
  if (frontCells === 0 && sideCells === 0 && backCells === 0) {
    logger.warn('2D-slice: ALL face grids are empty — model returned no colors');
    // Log first row of each face for debugging
    logger.warn(`front[0] sample: ${JSON.stringify(front[0]?.slice(0, 5))}`);
    logger.warn(`side[0] sample: ${JSON.stringify(side[0]?.slice(0, 5))}`);
    logger.warn(`back[0] sample: ${JSON.stringify(back[0]?.slice(0, 5))}`);
  }

  // Log section coverage
  logger.info(`2D-slice sections: ${JSON.stringify(analysis.sections.map(s => ({
    name: s.name, layers: `${s.layerStart}-${s.layerEnd}`, color: s.dominantColor
  })))}`);

  // Step 3: Assemble 3D grid from faces (pure code, deterministic)
  if (onProgress) await onProgress('Assembling 3D model from faces...');
  logger.info('2D-slice: assembling 3D grid from faces');

  const rawGrid = assemble3DFromFaces(front, side, back, analysis);

  // Log raw grid stats before validation
  let rawFilledCells = 0;
  let rawNonEmptyLayers = 0;
  for (const layer of rawGrid.layers) {
    let layerHasContent = false;
    for (const row of layer.grid) {
      for (const cell of row) {
        if (cell && cell !== '') {
          rawFilledCells++;
          layerHasContent = true;
        }
      }
    }
    if (layerHasContent) rawNonEmptyLayers++;
  }
  logger.info(`2D-slice raw grid: ${rawFilledCells} filled cells, ${rawNonEmptyLayers}/${rawGrid.layers.length} non-empty layers`);

  // Step 4: Validate and convert to bricks
  const voxelGrid = validateVoxelGrid(rawGrid);

  if (voxelGrid.layers.length === 0) {
    throw new Error('2D-slice assembly produced empty grid');
  }

  const { steps, report } = voxelGridToBricks(voxelGrid);

  logger.info(
    `2D-slice result: ${report.totalVoxels} voxels → ${report.totalBricks} bricks ` +
      `(avg size ${report.averageBrickSize.toFixed(1)}, ${report.layerCount} layers)`
  );

  if (steps.length === 0) {
    throw new Error('2D-slice: voxel conversion produced 0 bricks');
  }

  const meta: VoxelGenMeta = {
    title: voxelGrid.title,
    description: voxelGrid.description,
    lore: voxelGrid.lore,
    referenceDescription: voxelGrid.referenceDescription || 'An object from the photo.',
  };

  return { voxelGrid, steps, meta };
}
