// Shape Registry — single source of truth for all LEGO brick shape definitions

import type { BrickShape, BrickType } from '../types/brick.js';
export type { BrickShape, BrickType };

export type GeometryKind =
  | 'box'
  | 'cylinder'
  | 'l_shape'
  | 'wedge'
  | 'inverted_wedge'
  | 'curved_wedge'
  | 'arch'
  | 'cone'
  | 'triangular_plate'
  | 'dome'
  | 'half_cylinder'
  | 'beam_with_holes';

export type ShapeCategory = 'basic' | 'slope' | 'curved' | 'special' | 'technic';

export interface GeometryParams {
  kind: GeometryKind;
  slopeAngleDeg?: number;
  curveSegments?: number;
}

export interface StudConfig {
  hasStuds: boolean;
  layout: 'grid' | 'single_center' | 'none';
}

export interface Icon2DConfig {
  borderRadius: string;
  gradient?: string;
  clipPath?: string;
}

export interface ShapeDefinition {
  id: BrickShape;
  label: string;
  description: string;
  category: ShapeCategory;
  tier: 1 | 2;
  geometry: GeometryParams;
  studs: StudConfig;
  heights: { brick: number; plate: number; tile: number };
  geminiAliases: string[];
  compatibleTypes: BrickType[];
  icon2d: Icon2DConfig;
}

const definitions: ShapeDefinition[] = [
  // ── Basic ───────────────────────────────────────────────
  {
    id: 'rectangle',
    label: 'Rectangle',
    description: 'Standard rectangular brick/plate. The most common LEGO element.',
    category: 'basic',
    tier: 1,
    geometry: { kind: 'box' },
    studs: { hasStuds: true, layout: 'grid' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['rectangle', 'rect', 'standard', 'basic', 'square'],
    compatibleTypes: ['brick', 'plate', 'tile', 'technic', 'minifig', 'other'],
    icon2d: { borderRadius: '1px' },
  },
  {
    id: 'corner',
    label: 'Corner / L-Shape',
    description: 'L-shaped plate or brick. Two joined rectangular sections forming a right angle.',
    category: 'basic',
    tier: 1,
    geometry: { kind: 'l_shape' },
    studs: { hasStuds: true, layout: 'grid' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['corner', 'l-shape', 'l_shape', 'angle'],
    compatibleTypes: ['brick', 'plate', 'tile'],
    icon2d: { borderRadius: '1px', clipPath: 'polygon(0 0, 100% 0, 100% 50%, 50% 50%, 50% 100%, 0 100%)' },
  },
  {
    id: 'round',
    label: 'Round',
    description: 'Cylindrical brick or plate. Round cross-section, typically 1x1.',
    category: 'basic',
    tier: 1,
    geometry: { kind: 'cylinder', curveSegments: 32 },
    studs: { hasStuds: true, layout: 'single_center' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['round', 'cylinder', 'circular', 'round_1x1'],
    compatibleTypes: ['brick', 'plate', 'tile'],
    icon2d: { borderRadius: '50%' },
  },

  // ── Slopes ──────────────────────────────────────────────
  {
    id: 'slope_25',
    label: '25\u00b0 Slope',
    description: 'Gentle slope at 25 degrees. Used for gradual inclines and roofs.',
    category: 'slope',
    tier: 1,
    geometry: { kind: 'wedge', slopeAngleDeg: 25 },
    studs: { hasStuds: false, layout: 'none' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['slope_25', 'slope25', 'gentle_slope', 'slope 25'],
    compatibleTypes: ['slope'],
    icon2d: { borderRadius: '1px', gradient: 'linear-gradient(160deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.2) 100%)' },
  },
  {
    id: 'slope_33',
    label: '33\u00b0 Slope',
    description: 'Medium slope at 33 degrees. Common roof slope angle.',
    category: 'slope',
    tier: 1,
    geometry: { kind: 'wedge', slopeAngleDeg: 33 },
    studs: { hasStuds: false, layout: 'none' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['slope_33', 'slope33', 'medium_slope', 'slope 33'],
    compatibleTypes: ['slope'],
    icon2d: { borderRadius: '1px', gradient: 'linear-gradient(150deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.2) 100%)' },
  },
  {
    id: 'slope_45',
    label: '45\u00b0 Slope',
    description: 'Standard 45-degree slope. The most common slope angle in LEGO sets.',
    category: 'slope',
    tier: 1,
    geometry: { kind: 'wedge', slopeAngleDeg: 45 },
    studs: { hasStuds: false, layout: 'none' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['slope_45', 'slope45', 'slope', 'standard_slope', 'slope 45'],
    compatibleTypes: ['slope'],
    icon2d: { borderRadius: '1px', gradient: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.2) 100%)' },
  },
  {
    id: 'slope_65',
    label: '65\u00b0 Slope',
    description: 'Steep slope at 65 degrees. Used for near-vertical surfaces and walls.',
    category: 'slope',
    tier: 1,
    geometry: { kind: 'wedge', slopeAngleDeg: 65 },
    studs: { hasStuds: false, layout: 'none' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['slope_65', 'slope65', 'steep_slope', 'slope 65'],
    compatibleTypes: ['slope'],
    icon2d: { borderRadius: '1px', gradient: 'linear-gradient(120deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.2) 100%)' },
  },
  {
    id: 'slope_75',
    label: '75\u00b0 Slope',
    description: 'Very steep slope at 75 degrees. Nearly vertical wedge element.',
    category: 'slope',
    tier: 2,
    geometry: { kind: 'wedge', slopeAngleDeg: 75 },
    studs: { hasStuds: false, layout: 'none' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['slope_75', 'slope75', 'very_steep_slope', 'slope 75'],
    compatibleTypes: ['slope'],
    icon2d: { borderRadius: '1px', gradient: 'linear-gradient(110deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.2) 100%)' },
  },
  {
    id: 'slope_inverted',
    label: 'Inverted Slope',
    description: 'Inverted 45-degree slope. Slants inward from bottom, used under overhangs.',
    category: 'slope',
    tier: 1,
    geometry: { kind: 'inverted_wedge', slopeAngleDeg: 45 },
    studs: { hasStuds: true, layout: 'grid' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['slope_inverted', 'inverted_slope', 'inv_slope', 'inverse_slope'],
    compatibleTypes: ['slope'],
    icon2d: { borderRadius: '1px', gradient: 'linear-gradient(315deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.2) 100%)' },
  },

  // ── Curved ──────────────────────────────────────────────
  {
    id: 'curved_slope',
    label: 'Curved Slope',
    description: 'Smooth curved slope surface. Used for organic shapes and aerodynamic forms.',
    category: 'curved',
    tier: 1,
    geometry: { kind: 'curved_wedge', curveSegments: 12 },
    studs: { hasStuds: false, layout: 'none' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['curved_slope', 'curved', 'smooth_slope', 'curve'],
    compatibleTypes: ['slope'],
    icon2d: { borderRadius: '1px 50% 1px 1px', gradient: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(0,0,0,0.15) 100%)' },
  },
  {
    id: 'arch',
    label: 'Arch',
    description: 'Brick with a semicircular cutout at the bottom. Used for doorways and bridges.',
    category: 'curved',
    tier: 1,
    geometry: { kind: 'arch', curveSegments: 16 },
    studs: { hasStuds: true, layout: 'grid' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['arch', 'archway', 'bridge_arch'],
    compatibleTypes: ['brick'],
    icon2d: { borderRadius: '1px', gradient: 'radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.3) 0%, transparent 60%)' },
  },
  {
    id: 'cone',
    label: 'Cone',
    description: 'Tapered cylinder that narrows to a point. Used for towers and decorative tips.',
    category: 'curved',
    tier: 1,
    geometry: { kind: 'cone', curveSegments: 32 },
    studs: { hasStuds: true, layout: 'single_center' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['cone', 'tapered', 'pointed'],
    compatibleTypes: ['brick'],
    icon2d: { borderRadius: '50%', gradient: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5) 0%, transparent 60%)' },
  },
  {
    id: 'dome',
    label: 'Dome',
    description: 'Hemisphere shape. Used for cockpits, domes, and rounded tops.',
    category: 'curved',
    tier: 2,
    geometry: { kind: 'dome', curveSegments: 24 },
    studs: { hasStuds: false, layout: 'none' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['dome', 'hemisphere', 'half_sphere', 'rounded_top'],
    compatibleTypes: ['brick'],
    icon2d: { borderRadius: '50% 50% 10% 10%', gradient: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.6) 0%, transparent 70%)' },
  },
  {
    id: 'half_cylinder',
    label: 'Half Cylinder',
    description: 'Half-pipe shape. Used for tunnels, troughs, and cylindrical walls.',
    category: 'curved',
    tier: 2,
    geometry: { kind: 'half_cylinder', curveSegments: 16 },
    studs: { hasStuds: false, layout: 'none' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['half_cylinder', 'half_pipe', 'half_round', 'tunnel'],
    compatibleTypes: ['brick'],
    icon2d: { borderRadius: '50% 50% 1px 1px' },
  },

  // ── Special ─────────────────────────────────────────────
  {
    id: 'wedge_plate',
    label: 'Wedge Plate',
    description: 'Triangular flat plate. Used for wing shapes and angular details.',
    category: 'special',
    tier: 2,
    geometry: { kind: 'triangular_plate' },
    studs: { hasStuds: true, layout: 'grid' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['wedge_plate', 'wing_plate', 'triangular_plate', 'wedge'],
    compatibleTypes: ['plate'],
    icon2d: { borderRadius: '1px', clipPath: 'polygon(0 0, 100% 0, 0 100%)' },
  },

  // ── Technic ─────────────────────────────────────────────
  {
    id: 'technic_beam',
    label: 'Technic Beam',
    description: 'Beam with pin holes along its length. Used for mechanical structures and axles.',
    category: 'technic',
    tier: 2,
    geometry: { kind: 'beam_with_holes' },
    studs: { hasStuds: false, layout: 'none' },
    heights: { brick: 1.2, plate: 0.4, tile: 0.4 },
    geminiAliases: ['technic_beam', 'beam', 'technic_bar', 'liftarm'],
    compatibleTypes: ['technic'],
    icon2d: { borderRadius: '4px' },
  },
];

// ── Registry Map ─────────────────────────────────────────

export const SHAPE_REGISTRY: ReadonlyMap<BrickShape, ShapeDefinition> = new Map(
  definitions.map((d) => [d.id, d]),
);

export const ALL_BRICK_SHAPES: readonly BrickShape[] = definitions.map((d) => d.id);

export const ALL_BRICK_TYPES: readonly BrickType[] = [
  'brick', 'plate', 'tile', 'slope', 'technic', 'minifig', 'other',
];

// ── Helper Functions ─────────────────────────────────────

/** Look up a shape definition. Falls back to 'rectangle' for unknown shapes. */
export function getShapeDefinition(shape: BrickShape): ShapeDefinition {
  return SHAPE_REGISTRY.get(shape) ?? SHAPE_REGISTRY.get('rectangle')!;
}

/** Get the 3D height for a shape + type combination. */
export function getBrickHeight(shape: BrickShape, type: BrickType): number {
  const def = SHAPE_REGISTRY.get(shape);
  if (!def) return 1.2; // safe fallback

  if (type === 'plate' || type === 'tile') return def.heights.plate;
  return def.heights.brick;
}

/** Resolve a shape string (including legacy aliases) to a valid BrickShape ID. */
export function resolveShape(
  shape: string,
  type?: string,
): BrickShape {
  // If it's already a valid shape ID in the registry, pass through as-is
  if (SHAPE_REGISTRY.has(shape as BrickShape)) {
    return shape as BrickShape;
  }

  // Check all geminiAliases for a match
  for (const def of definitions) {
    if (def.geminiAliases.includes(shape)) {
      return def.id;
    }
  }

  // Legacy alias: bare "slope" → standard 45°
  if (shape === 'slope') return 'slope_45';

  // Type-based fallback
  if (type === 'technic') return 'technic_beam';

  return 'rectangle';
}

/** @deprecated Use `resolveShape` instead. */
export const fromLegacyShape = resolveShape;

/** Generate the enum array for Gemini response schema. */
export function getGeminiShapeEnum(): string[] {
  return definitions.map((d) => d.id);
}

/** Generate shape description text for Gemini prompts. */
export function getGeminiShapeDescriptions(): string {
  return definitions
    .map((d) => `- ${d.id}: ${d.description} Aliases: ${d.geminiAliases.join(', ')}`)
    .join('\n');
}
