/**
 * Maps color names -> BrickLink color IDs.
 * Source: https://www.bricklink.com/catalogColors.asp
 */
const BRICKLINK_COLOR_TABLE: Record<string, number> = {
  white: 1,
  tan: 2,
  yellow: 3,
  orange: 4,
  red: 5,
  green: 6,
  blue: 7,
  black: 11,
  'dark red': 59,
  'dark blue': 63,
  'dark green': 80,
  'dark gray': 85,
  'light gray': 86,
  brown: 88,
};

/**
 * Resolve BrickLink color ID from a color name.
 * Case-insensitive, trimmed lookup.
 * Returns null if no mapping exists.
 */
export function resolveBrickLinkColorId(colorName: string): number | null {
  const key = colorName.trim().toLowerCase();
  return BRICKLINK_COLOR_TABLE[key] ?? null;
}
