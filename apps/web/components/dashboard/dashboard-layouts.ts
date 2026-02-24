import type { BrickShape, BrickType } from '@brick-quest/shared';

export interface DashboardBrickDef {
  shape: BrickShape;
  type: BrickType;
  width: number;
  length: number;
  color: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Design Station — simple stacked tower in warm colors.
 * All positions are stud-grid aligned with proper brick heights.
 */
export const DESIGN_ISLAND: DashboardBrickDef[] = [
  // Base 3×3 plate
  { shape: 'rectangle', type: 'plate', width: 3, length: 3, color: '#F5CD2F', position: [0, 0, 0] },
  // Layer 1: 2×2 brick
  { shape: 'rectangle', type: 'brick', width: 2, length: 2, color: '#E4A020', position: [0, 0.4, 0] },
  // Layer 2: 2×1 brick
  { shape: 'rectangle', type: 'brick', width: 2, length: 1, color: '#F57D20', position: [0, 1.6, 0] },
  // Top: 1×1 round
  { shape: 'round', type: 'brick', width: 1, length: 1, color: '#E84C38', position: [0, 2.8, 0] },
];

/**
 * Scan Station — simple stacked tower in cool colors.
 */
export const MYBRICKS_ISLAND: DashboardBrickDef[] = [
  // Base 3×3 plate
  { shape: 'rectangle', type: 'plate', width: 3, length: 3, color: '#069D9F', position: [0, 0, 0] },
  // Layer 1: 2×2 brick
  { shape: 'rectangle', type: 'brick', width: 2, length: 2, color: '#0D69AC', position: [0, 0.4, 0] },
  // Layer 2: 2×1 brick
  { shape: 'rectangle', type: 'brick', width: 1, length: 2, color: '#3498DB', position: [0, 1.6, 0] },
  // Top: 1×1 round
  { shape: 'round', type: 'brick', width: 1, length: 1, color: '#F5CD2F', position: [0, 2.8, 0] },
];
