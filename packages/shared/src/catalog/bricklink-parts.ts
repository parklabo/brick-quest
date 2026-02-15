import type { BrickShape, BrickType } from '../types/index.js';

/**
 * Maps (shape, type, width, length) -> BrickLink part ID.
 * Key format: "shape:type:WxL" (identical to ldraw-part-map.ts keys).
 *
 * BrickLink part IDs == LDraw part IDs (without .dat suffix).
 */
const BRICKLINK_PART_TABLE: Record<string, string> = {
  // ── Bricks (rectangle) ──────────────────────
  'rectangle:brick:1x1': '3005',
  'rectangle:brick:1x2': '3004',
  'rectangle:brick:1x3': '3622',
  'rectangle:brick:1x4': '3010',
  'rectangle:brick:1x6': '3009',
  'rectangle:brick:1x8': '3008',
  'rectangle:brick:2x2': '3003',
  'rectangle:brick:2x3': '3002',
  'rectangle:brick:2x4': '3001',
  'rectangle:brick:2x6': '2456',
  'rectangle:brick:2x8': '3007',
  'rectangle:brick:2x10': '3006',

  // ── Plates (rectangle) ──────────────────────
  'rectangle:plate:1x1': '3024',
  'rectangle:plate:1x2': '3023',
  'rectangle:plate:1x3': '3623',
  'rectangle:plate:1x4': '3710',
  'rectangle:plate:1x6': '3666',
  'rectangle:plate:1x8': '3460',
  'rectangle:plate:2x2': '3022',
  'rectangle:plate:2x3': '3021',
  'rectangle:plate:2x4': '3020',
  'rectangle:plate:2x6': '3795',
  'rectangle:plate:2x8': '3034',

  // ── Tiles (rectangle) ───────────────────────
  'rectangle:tile:1x1': '3070b',
  'rectangle:tile:1x2': '3069b',
  'rectangle:tile:1x3': '63864',
  'rectangle:tile:1x4': '2431',
  'rectangle:tile:1x6': '6636',
  'rectangle:tile:1x8': '4162',
  'rectangle:tile:2x2': '3068b',
  'rectangle:tile:2x4': '87079',

  // ── Round ───────────────────────────────────
  'round:brick:1x1': '3062b',
  'round:brick:2x2': '3941',
  'round:plate:1x1': '4073',
  'round:plate:2x2': '4032',
  'round:tile:1x1': '98138',

  // ── Slopes ──────────────────────────────────
  'slope_33:slope:1x3': '4286',
  'slope_45:slope:2x2': '3039',
  'slope_45:slope:1x2': '3040',
  'slope_45:slope:2x3': '3038',
  'slope_65:slope:1x2': '60481',
  'slope_75:slope:2x2': '3684',
  'slope_inverted:slope:2x2': '3660',
  'slope_inverted:slope:1x2': '3665',
  'curved_slope:slope:2x2': '15068',

  // ── Arch ────────────────────────────────────
  'arch:brick:1x4': '3659',
  'arch:brick:1x6': '3455',

  // ── Cone ────────────────────────────────────
  'cone:brick:1x1': '4589',
  'cone:brick:2x2': '3942c',

  // ── Corner (L-shape) ───────────────────────
  'corner:plate:2x2': '2420',
  'corner:plate:3x3': '2450',

  // ── Wedge plate ─────────────────────────────
  'wedge_plate:plate:2x2': '24307',
  'wedge_plate:plate:2x3': '43722',
  'wedge_plate:plate:2x4': '51739',

  // ── Technic beam ────────────────────────────
  'technic_beam:technic:1x5': '32316',
  'technic_beam:technic:1x7': '32524',
};

/**
 * Resolve BrickLink part ID for a BrickQuest part.
 * Returns null if no mapping exists (caller should fall back to search URL).
 */
export function resolveBrickLinkPartId(
  shape: BrickShape,
  type: BrickType,
  width: number,
  length: number,
): string | null {
  const key = `${shape}:${type}:${width}x${length}`;
  return BRICKLINK_PART_TABLE[key] ?? null;
}
