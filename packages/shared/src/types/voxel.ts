/** A single horizontal layer in the voxel grid */
export interface VoxelLayer {
  /** Layer index (0 = ground level) */
  y: number;
  /** Height type: brick = 1.2 units, plate = 0.4 units */
  heightType: 'brick' | 'plate';
  /** grid[z][x] = hex color string (e.g. "#FF0000") or "" for empty */
  grid: string[][];
}

/** 3D color grid representing a LEGO model as stud positions */
export interface VoxelGrid {
  title: string;
  description: string;
  lore: string;
  /** Description of the reference image (design flow only) */
  referenceDescription?: string;
  /** X axis studs */
  width: number;
  /** Z axis studs */
  depth: number;
  /** Ordered layers from bottom to top */
  layers: VoxelLayer[];
}

/** Statistics from the voxel-to-bricks conversion */
export interface VoxelConversionReport {
  totalVoxels: number;
  totalBricks: number;
  averageBrickSize: number;
  sizeDistribution: Record<string, number>;
  layerCount: number;
}
