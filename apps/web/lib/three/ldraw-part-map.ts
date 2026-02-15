import type { BrickShape, BrickType } from '@brick-quest/shared';

/**
 * Maps (shape, type, width, length) → LDraw .dat filename.
 * Key format: "shape:type:WxL" (e.g., "rectangle:brick:2x4" → "3001.dat")
 *
 * Source: LDraw parts library — common LEGO parts only.
 */
const LDRAW_PART_TABLE: Record<string, string> = {
  // ── Bricks (rectangle) ──────────────────────
  'rectangle:brick:1x1': '3005.dat',
  'rectangle:brick:1x2': '3004.dat',
  'rectangle:brick:1x3': '3622.dat',
  'rectangle:brick:1x4': '3010.dat',
  'rectangle:brick:1x6': '3009.dat',
  'rectangle:brick:1x8': '3008.dat',
  'rectangle:brick:2x2': '3003.dat',
  'rectangle:brick:2x3': '3002.dat',
  'rectangle:brick:2x4': '3001.dat',
  'rectangle:brick:2x6': '2456.dat',
  'rectangle:brick:2x8': '3007.dat',
  'rectangle:brick:2x10': '3006.dat',

  // ── Plates (rectangle) ──────────────────────
  'rectangle:plate:1x1': '3024.dat',
  'rectangle:plate:1x2': '3023.dat',
  'rectangle:plate:1x3': '3623.dat',
  'rectangle:plate:1x4': '3710.dat',
  'rectangle:plate:1x6': '3666.dat',
  'rectangle:plate:1x8': '3460.dat',
  'rectangle:plate:2x2': '3022.dat',
  'rectangle:plate:2x3': '3021.dat',
  'rectangle:plate:2x4': '3020.dat',
  'rectangle:plate:2x6': '3795.dat',
  'rectangle:plate:2x8': '3034.dat',

  // ── Tiles (rectangle) ───────────────────────
  'rectangle:tile:1x1': '3070b.dat',
  'rectangle:tile:1x2': '3069b.dat',
  'rectangle:tile:1x4': '2431.dat',
  'rectangle:tile:1x6': '6636.dat',
  'rectangle:tile:2x2': '3068b.dat',
  'rectangle:tile:2x4': '87079.dat',

  // ── Round ───────────────────────────────────
  'round:brick:1x1': '3062b.dat',
  'round:brick:2x2': '3941.dat',
  'round:plate:1x1': '4073.dat',
  'round:plate:2x2': '4032.dat',
  'round:tile:1x1': '98138.dat',

  // ── Slopes ──────────────────────────────────
  'slope_33:slope:1x3': '4286.dat',
  'slope_45:slope:2x2': '3039.dat',
  'slope_45:slope:1x2': '3040.dat',
  'slope_45:slope:2x3': '3038.dat',
  'slope_65:slope:1x2': '60481.dat',
  'slope_75:slope:2x2': '3684.dat',
  'slope_inverted:slope:2x2': '3660.dat',
  'slope_inverted:slope:1x2': '3665.dat',
  'curved_slope:slope:2x2': '15068.dat',

  // ── Arch ────────────────────────────────────
  'arch:brick:1x4': '3659.dat',
  'arch:brick:1x6': '3455.dat',

  // ── Cone ────────────────────────────────────
  'cone:brick:1x1': '4589.dat',
  'cone:brick:2x2': '3942c.dat',

  // ── Corner (L-shape) ───────────────────────
  'corner:plate:2x2': '2420.dat',
  'corner:plate:3x3': '2450.dat',

  // ── Wedge plate ─────────────────────────────
  'wedge_plate:plate:2x2': '24307.dat',
  'wedge_plate:plate:2x3': '43722.dat',
  'wedge_plate:plate:2x4': '51739.dat',

  // ── Technic beam ────────────────────────────
  'technic_beam:technic:1x5': '32316.dat',
  'technic_beam:technic:1x7': '32524.dat',
};

/**
 * Resolve LDraw .dat filename for a BrickQuest part.
 * Returns null if no mapping exists (fallback to procedural geometry).
 */
export function resolveLDrawPart(
  shape: BrickShape,
  type: BrickType,
  width: number,
  length: number,
): string | null {
  const key = `${shape}:${type}:${width}x${length}`;
  return LDRAW_PART_TABLE[key] ?? null;
}
