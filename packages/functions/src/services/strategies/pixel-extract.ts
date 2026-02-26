import sharp from 'sharp';
import { logger } from 'firebase-functions';
import type { DesignDetail, SubjectRecognition } from '@brick-quest/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Sharp-based Pixel Extraction
//
// Reads pixel data directly from the composite image using sharp.
// No LLM involved → 100% deterministic, 0 tokens, accurate silhouettes.
//
// Pipeline:
//   composite → crop quadrants → gradient-based model mask →
//   bounding box → resize → mask-aware pixel grid → LEGO colors
//
// Key: Uses gradient (edge) detection instead of color to find the model.
// This works for ALL subjects including white/light-colored ones.
// ─────────────────────────────────────────────────────────────────────────────

const GRID_LIMITS: Record<DesignDetail, { maxW: number; maxD: number; maxH: number }> = {
  simple: { maxW: 12, maxD: 12, maxH: 16 },
  standard: { maxW: 20, maxD: 18, maxH: 28 },
  detailed: { maxW: 28, maxD: 24, maxH: 36 },
};

/** LEGO color palette — same 32 colors from voxel-to-bricks.ts HEX_COLOR_MAP */
const LEGO_PALETTE: Array<{ hex: string; r: number; g: number; b: number }> = [
  { hex: '#FFFFFF', r: 255, g: 255, b: 255 },
  { hex: '#000000', r: 0, g: 0, b: 0 },
  { hex: '#FF0000', r: 255, g: 0, b: 0 },
  { hex: '#B40000', r: 180, g: 0, b: 0 },
  { hex: '#0055BF', r: 0, g: 85, b: 191 },
  { hex: '#003DA5', r: 0, g: 61, b: 165 },
  { hex: '#237841', r: 35, g: 120, b: 65 },
  { hex: '#184632', r: 24, g: 70, b: 50 },
  { hex: '#FEC401', r: 254, g: 196, b: 1 },
  { hex: '#F5CD2F', r: 245, g: 205, b: 47 },
  { hex: '#F97B22', r: 249, g: 123, b: 34 },
  { hex: '#E76318', r: 231, g: 99, b: 24 },
  { hex: '#C870A0', r: 200, g: 112, b: 160 },
  { hex: '#FF698F', r: 255, g: 105, b: 143 },
  { hex: '#A5499B', r: 165, g: 73, b: 155 },
  { hex: '#A0A5A9', r: 160, g: 165, b: 169 },
  { hex: '#6C6E68', r: 108, g: 110, b: 104 },
  { hex: '#958A73', r: 149, g: 138, b: 115 },
  { hex: '#E4CD9E', r: 228, g: 205, b: 158 },
  { hex: '#CDA4DE', r: 205, g: 164, b: 222 },
  { hex: '#75B5D4', r: 117, g: 181, b: 212 },
  { hex: '#36AEBF', r: 54, g: 174, b: 191 },
  { hex: '#078BC9', r: 7, g: 139, b: 201 },
  { hex: '#88C7DB', r: 136, g: 199, b: 219 },
  { hex: '#AA7D55', r: 170, g: 125, b: 85 },
  { hex: '#7C503A', r: 124, g: 80, b: 58 },
  { hex: '#D09168', r: 208, g: 145, b: 104 },
  { hex: '#FCC39E', r: 252, g: 195, b: 158 },
  { hex: '#AAFF00', r: 170, g: 255, b: 0 },
  { hex: '#4B9F4A', r: 75, g: 159, b: 74 },
  { hex: '#582A12', r: 88, g: 42, b: 18 },
];

export interface PixelExtractionResult {
  frontGrid: string[][];
  sideGrid: string[][];
  width: number;
  depth: number;
  totalLayers: number;
  /** Extraction timing in ms */
  extractionMs: number;
  /** Bounding boxes detected in the views */
  bounds: {
    front: { x: number; y: number; w: number; h: number };
    side: { x: number; y: number; w: number; h: number };
  };
}

// ─── Morphological operations ───────────────────────────────────────────────

interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Shrink foreground by N pixels (4-connected). */
function erodeMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const total = width * height;
  let current = mask;

  for (let p = 0; p < radius; p++) {
    const next = new Uint8Array(total);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (
          current[i] &&
          current[i - 1] && current[i + 1] &&
          current[i - width] && current[i + width]
        ) {
          next[i] = 1;
        }
      }
    }
    current = next;
  }

  return current;
}

/** Expand foreground by N pixels (4-connected). */
function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const total = width * height;
  let current = mask;

  for (let p = 0; p < radius; p++) {
    const next = new Uint8Array(total);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (current[i]) { next[i] = 1; continue; }
        if (x > 0 && current[i - 1]) { next[i] = 1; continue; }
        if (x < width - 1 && current[i + 1]) { next[i] = 1; continue; }
        if (y > 0 && current[i - width]) { next[i] = 1; continue; }
        if (y < height - 1 && current[i + width]) { next[i] = 1; continue; }
      }
    }
    current = next;
  }

  return current;
}

// ─── Gradient-based model mask ──────────────────────────────────────────────

/**
 * Compute a binary model mask using gradient (edge) detection.
 *
 * Unlike color-based detection (HSL), this works for ANY subject color
 * including white. It detects the model by finding its BOUNDARY (edges)
 * rather than its color.
 *
 * Steps:
 *   1. Compute gradient magnitude at each pixel (central differences)
 *   2. Threshold to binary edge mask
 *   3. Dilate edges to close small gaps (studs, seams)
 *   4. Flood-fill from image borders through non-edge pixels → exterior
 *   5. Model = NOT exterior
 *   6. Also include clearly-colored pixels (HSL saturation) as bonus
 */
function computeModelMask(
  pixels: Buffer,
  imgWidth: number,
  imgHeight: number
): Uint8Array {
  const total = imgWidth * imgHeight;

  // Step 1: Gradient magnitude (central differences, max of RGB channels)
  const gradient = new Float32Array(total);
  for (let y = 1; y < imgHeight - 1; y++) {
    for (let x = 1; x < imgWidth - 1; x++) {
      const i = y * imgWidth + x;
      const li = (i - 1) * 4;  // left
      const ri = (i + 1) * 4;  // right
      const ti = (i - imgWidth) * 4;  // top
      const bi = (i + imgWidth) * 4;  // bottom

      // Horizontal gradient (max across RGB)
      const gx = Math.max(
        Math.abs(pixels[ri] - pixels[li]),
        Math.abs(pixels[ri + 1] - pixels[li + 1]),
        Math.abs(pixels[ri + 2] - pixels[li + 2])
      );
      // Vertical gradient
      const gy = Math.max(
        Math.abs(pixels[bi] - pixels[ti]),
        Math.abs(pixels[bi + 1] - pixels[ti + 1]),
        Math.abs(pixels[bi + 2] - pixels[ti + 2])
      );

      gradient[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Step 2: Threshold to edge mask
  const EDGE_THRESHOLD = 12;
  const edgeMask = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (gradient[i] > EDGE_THRESHOLD) edgeMask[i] = 1;
  }

  // Step 3: Dilate edges to close stud/seam gaps (~1% of image width)
  const dilationRadius = Math.max(3, Math.ceil(imgWidth * 0.01));
  const dilatedEdges = dilateMask(edgeMask, imgWidth, imgHeight, dilationRadius);

  // Step 4: Flood-fill from borders through non-edge pixels → exterior
  const exterior = new Uint8Array(total);
  const queue: number[] = [];

  for (let x = 0; x < imgWidth; x++) {
    if (!dilatedEdges[x] && !exterior[x]) { queue.push(x); exterior[x] = 1; }
    const b = (imgHeight - 1) * imgWidth + x;
    if (!dilatedEdges[b] && !exterior[b]) { queue.push(b); exterior[b] = 1; }
  }
  for (let y = 1; y < imgHeight - 1; y++) {
    const l = y * imgWidth;
    if (!dilatedEdges[l] && !exterior[l]) { queue.push(l); exterior[l] = 1; }
    const r = y * imgWidth + imgWidth - 1;
    if (!dilatedEdges[r] && !exterior[r]) { queue.push(r); exterior[r] = 1; }
  }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const x = idx % imgWidth;
    const y = Math.floor(idx / imgWidth);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= imgWidth || ny < 0 || ny >= imgHeight) continue;
      const ni = ny * imgWidth + nx;
      if (exterior[ni] || dilatedEdges[ni]) continue;
      exterior[ni] = 1;
      queue.push(ni);
    }
  }

  // Step 5: Model = NOT exterior (includes edge pixels themselves)
  const modelMask = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (!exterior[i]) modelMask[i] = 1;
  }

  // Step 6: Also include clearly-colored pixels (high saturation = definitely model)
  // This catches colored parts that might be outside a gap in the edge boundary
  for (let i = 0; i < total; i++) {
    if (modelMask[i]) continue;
    const off = i * 4;
    if (pixels[off + 3] < 128) continue; // transparent
    const r = pixels[off], g = pixels[off + 1], b = pixels[off + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    // High chroma = clearly not background
    if (d > 40) modelMask[i] = 1;
  }

  return modelMask;
}

// ─── Model bounds detection ─────────────────────────────────────────────────

/**
 * Detect model bounds and return a model mask.
 *
 * Uses gradient-based edge detection for the model mask (works for any color),
 * then erosion + largest connected component for bounding box (excludes icons).
 */
function detectModelBoundsWithMask(
  pixels: Buffer,
  imgWidth: number,
  imgHeight: number
): { bounds: BoundingBox; modelMask: Uint8Array } {
  const totalPixels = imgWidth * imgHeight;

  // Compute gradient-based model mask
  const modelMask = computeModelMask(pixels, imgWidth, imgHeight);

  // Count foreground pixels
  let fgCount = 0;
  for (let i = 0; i < totalPixels; i++) if (modelMask[i]) fgCount++;

  // If mask covers >90% of image, gradient detection likely failed → fallback to full quadrant
  if (fgCount > totalPixels * 0.9) {
    logger.warn(`  [pixel-extract] Gradient mask covers ${(fgCount / totalPixels * 100).toFixed(0)}% — using full quadrant`);
    return {
      bounds: { x: 0, y: 0, w: imgWidth, h: imgHeight },
      modelMask,
    };
  }

  // Erode to break thin connections between main model and peripheral objects
  const erosionRadius = Math.max(4, Math.ceil(imgWidth * 0.02));
  const erodedMask = erodeMask(modelMask, imgWidth, imgHeight, erosionRadius);

  // Find largest connected component on eroded mask
  const labels = new Int32Array(totalPixels);
  let nextLabel = 1;
  const componentSizes = new Map<number, number>();

  for (let i = 0; i < totalPixels; i++) {
    if (erodedMask[i] === 0 || labels[i] !== 0) continue;

    const label = nextLabel++;
    const componentQueue: number[] = [i];
    labels[i] = label;
    let size = 0;

    while (componentQueue.length > 0) {
      const ci = componentQueue.pop()!;
      size++;
      const cx = ci % imgWidth;
      const cy = Math.floor(ci / imgWidth);

      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
        if (nx < 0 || nx >= imgWidth || ny < 0 || ny >= imgHeight) continue;
        const ni = ny * imgWidth + nx;
        if (labels[ni] !== 0 || erodedMask[ni] === 0) continue;
        labels[ni] = label;
        componentQueue.push(ni);
      }
    }

    componentSizes.set(label, size);
  }

  let largestLabel = 0;
  let largestSize = 0;
  for (const [label, size] of componentSizes) {
    if (size > largestSize) { largestSize = size; largestLabel = label; }
  }

  // Bounding box of largest eroded component + expand by erosion radius
  let minX = imgWidth, minY = imgHeight, maxX = -1, maxY = -1;
  for (let i = 0; i < totalPixels; i++) {
    if (labels[i] === largestLabel) {
      const x = i % imgWidth;
      const y = Math.floor(i / imgWidth);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) {
    return {
      bounds: { x: 0, y: 0, w: imgWidth, h: imgHeight },
      modelMask,
    };
  }

  // Expand by erosion radius, clamped to image bounds
  minX = Math.max(0, minX - erosionRadius);
  minY = Math.max(0, minY - erosionRadius);
  maxX = Math.min(imgWidth - 1, maxX + erosionRadius);
  maxY = Math.min(imgHeight - 1, maxY + erosionRadius);

  return {
    bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    modelMask,
  };
}

// ─── Nearest LEGO color ──────────────────────────────────────────────────────

function nearestLegoColor(r: number, g: number, b: number): string {
  let bestHex = '#FFFFFF';
  let bestDist = Infinity;

  for (const c of LEGO_PALETTE) {
    const dr = r - c.r;
    const dg = g - c.g;
    const db = b - c.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestHex = c.hex;
    }
  }

  return bestHex;
}

// ─── Pixel buffer → LEGO grid ────────────────────────────────────────────────

/**
 * Convert an RGBA pixel buffer to a 2D LEGO color grid, using a binary mask
 * to determine foreground/background.
 *
 * The mask is computed at full resolution using gradient detection (works for
 * any subject color including white), then resized to grid dimensions.
 *
 * Y-axis is flipped: image y=0 is top, grid y=0 is bottom.
 */
function pixelsToGrid(
  pixels: Buffer,
  mask: Buffer,
  targetW: number,
  targetH: number
): string[][] {
  const grid: string[][] = [];

  for (let gridY = 0; gridY < targetH; gridY++) {
    const row: string[] = [];
    const imgY = targetH - 1 - gridY;

    for (let x = 0; x < targetW; x++) {
      const pixelIdx = imgY * targetW + x;
      const offset = pixelIdx * 4;
      const a = pixels[offset + 3];
      const maskVal = mask[pixelIdx]; // 0 = background, >0 = model

      if (a < 128 || maskVal === 0) {
        row.push('');
      } else {
        row.push(nearestLegoColor(pixels[offset], pixels[offset + 1], pixels[offset + 2]));
      }
    }

    grid.push(row);
  }

  return grid;
}

// ─── Grid cleanup ───────────────────────────────────────────────────────────

/**
 * Trim sparse edge columns from a 2D grid.
 * Removes peripheral objects (logos, icons) that appear as sparse columns.
 * Only operates on columns (x-axis) to keep y-axis aligned between grids.
 */
function trimSparseColumns(grid: string[][], threshold = 0.45): string[][] {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  if (h === 0 || w === 0) return grid;

  const colFill = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let filled = 0;
    for (let y = 0; y < h; y++) if (grid[y][x] !== '') filled++;
    colFill[x] = filled / h;
  }

  let left = 0;
  while (left < w && colFill[left] < threshold) left++;
  let right = w - 1;
  while (right > left && colFill[right] < threshold) right--;

  if (left === 0 && right === w - 1) return grid;

  return grid.map(row =>
    row.map((c, x) => (x >= left && x <= right) ? c : '')
  );
}

// ─── Main extraction function ────────────────────────────────────────────────

/**
 * Extract 2D LEGO color grids from a composite view image using sharp.
 *
 * Composite layout:
 * ┌──────────┬──────────┐
 * │ Hero 3/4 │  FRONT   │  ← top-right: front view
 * │ (skip)   │  VIEW    │
 * ├──────────┼──────────┤
 * │  SIDE    │  BACK    │  ← bottom-left: side view
 * │  VIEW    │ (skip)   │
 * └──────────┴──────────┘
 */
export async function extractGridsFromComposite(
  compositeBase64: string,
  _mimeType: string,
  detail: DesignDetail,
  recognition?: SubjectRecognition
): Promise<PixelExtractionResult> {
  const start = Date.now();
  const lim = GRID_LIMITS[detail];

  const compositeBuffer = Buffer.from(compositeBase64, 'base64');
  const metadata = await sharp(compositeBuffer).metadata();
  const fullW = metadata.width || 2048;
  const fullH = metadata.height || 2048;
  const halfW = Math.floor(fullW / 2);
  const halfH = Math.floor(fullH / 2);

  logger.info(`  [pixel-extract] Composite image: ${fullW}×${fullH}, detail=${detail}`);

  // Crop quadrants in parallel (raw RGBA pixels for mask computation)
  const [frontRaw, sideRaw] = await Promise.all([
    sharp(compositeBuffer)
      .extract({ left: halfW, top: 0, width: halfW, height: halfH })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(compositeBuffer)
      .extract({ left: 0, top: halfH, width: halfW, height: halfH })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  // Detect model bounds + mask using gradient-based edge detection
  const frontResult = detectModelBoundsWithMask(frontRaw.data, frontRaw.info.width, frontRaw.info.height);
  const sideResult = detectModelBoundsWithMask(sideRaw.data, sideRaw.info.width, sideRaw.info.height);
  const frontBounds = frontResult.bounds;
  const sideBounds = sideResult.bounds;

  logger.info(
    `  [pixel-extract] Front bounds: ${frontBounds.w}×${frontBounds.h} at (${frontBounds.x},${frontBounds.y})`
  );
  logger.info(
    `  [pixel-extract] Side bounds: ${sideBounds.w}×${sideBounds.h} at (${sideBounds.x},${sideBounds.y})`
  );

  // Calculate grid dimensions from image proportions
  let width: number;
  let depth: number;
  let totalLayers: number;

  if (recognition?.proportions) {
    const { widthToHeight, depthToWidth } = recognition.proportions;
    const clampedWH = Math.max(0.2, Math.min(3.0, widthToHeight));
    const clampedDW = Math.max(0.2, Math.min(2.0, depthToWidth));

    width = Math.min(lim.maxW, Math.max(6, Math.round(lim.maxW * 0.85)));
    totalLayers = Math.min(lim.maxH, Math.max(6, Math.round(width / clampedWH)));
    depth = Math.min(lim.maxD, Math.max(4, Math.round(width * clampedDW)));

    logger.info(
      `  [pixel-extract] Using recognition proportions: ${width}W × ${depth}D × ${totalLayers}H ` +
        `(wh=${widthToHeight.toFixed(2)}, dw=${depthToWidth.toFixed(2)})`
    );
  } else {
    width = lim.maxW;
    const pixelsPerStud = frontBounds.w / width;
    totalLayers = Math.min(lim.maxH, Math.max(6, Math.round(frontBounds.h / pixelsPerStud)));
    depth = Math.min(lim.maxD, Math.max(4, Math.round(sideBounds.w / pixelsPerStud)));

    logger.info(
      `  [pixel-extract] Derived from image: ${width}W × ${depth}D × ${totalLayers}H ` +
        `(pps=${pixelsPerStud.toFixed(1)})`
    );
  }

  // Crop model masks to bounding box areas, then resize to grid dimensions
  // We extract the mask region as a single-channel grayscale image via sharp
  const qW = frontRaw.info.width;

  const frontMaskCropped = cropMask(frontResult.modelMask, qW, frontBounds);
  const sideMaskCropped = cropMask(sideResult.modelMask, sideRaw.info.width, sideBounds);

  const [frontMaskResized, sideMaskResized] = await Promise.all([
    sharp(Buffer.from(frontMaskCropped), { raw: { width: frontBounds.w, height: frontBounds.h, channels: 1 } })
      .resize(width, totalLayers, { fit: 'fill', kernel: 'nearest' })
      .raw()
      .toBuffer(),
    sharp(Buffer.from(sideMaskCropped), { raw: { width: sideBounds.w, height: sideBounds.h, channels: 1 } })
      .resize(depth, totalLayers, { fit: 'fill', kernel: 'nearest' })
      .raw()
      .toBuffer(),
  ]);

  // Crop + resize image pixels to grid dimensions
  const [frontPixels, sidePixels] = await Promise.all([
    sharp(compositeBuffer)
      .extract({ left: halfW + frontBounds.x, top: frontBounds.y, width: frontBounds.w, height: frontBounds.h })
      .resize(width, totalLayers, { fit: 'fill', kernel: 'nearest' })
      .ensureAlpha()
      .raw()
      .toBuffer(),
    sharp(compositeBuffer)
      .extract({ left: sideBounds.x, top: halfH + sideBounds.y, width: sideBounds.w, height: sideBounds.h })
      .resize(depth, totalLayers, { fit: 'fill', kernel: 'nearest' })
      .ensureAlpha()
      .raw()
      .toBuffer(),
  ]);

  // Convert to LEGO grids using the mask (not color-based background detection)
  let frontGrid = pixelsToGrid(frontPixels, frontMaskResized, width, totalLayers);
  let sideGrid = pixelsToGrid(sidePixels, sideMaskResized, depth, totalLayers);

  // Trim sparse edge columns
  frontGrid = trimSparseColumns(frontGrid, 0.45);
  sideGrid = trimSparseColumns(sideGrid, 0.45);

  // Count filled cells
  let frontFilled = 0;
  let sideFilled = 0;
  for (const row of frontGrid) for (const c of row) if (c !== '') frontFilled++;
  for (const row of sideGrid) for (const c of row) if (c !== '') sideFilled++;

  const extractionMs = Date.now() - start;

  logger.info(
    `  [pixel-extract] Grids extracted in ${extractionMs}ms: ` +
      `front=${frontFilled}/${width * totalLayers} cells, ` +
      `side=${sideFilled}/${depth * totalLayers} cells`
  );

  return {
    frontGrid,
    sideGrid,
    width,
    depth,
    totalLayers,
    extractionMs,
    bounds: {
      front: frontBounds,
      side: sideBounds,
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Crop a 1D mask array to a bounding box region. */
function cropMask(mask: Uint8Array, maskWidth: number, bounds: BoundingBox): Uint8Array {
  const cropped = new Uint8Array(bounds.w * bounds.h);
  for (let y = 0; y < bounds.h; y++) {
    const srcOffset = (bounds.y + y) * maskWidth + bounds.x;
    const dstOffset = y * bounds.w;
    for (let x = 0; x < bounds.w; x++) {
      cropped[dstOffset + x] = mask[srcOffset + x];
    }
  }
  return cropped;
}
