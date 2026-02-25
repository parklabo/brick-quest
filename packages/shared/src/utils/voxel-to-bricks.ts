import type { BuildStepBlock, BrickType } from '../types/brick.js';
import type { VoxelGrid, VoxelLayer, VoxelConversionReport } from '../types/voxel.js';
import { getBrickHeight } from '../registry/shape-registry.js';

/**
 * Valid LEGO brick sizes to try, ordered largest-first for greedy packing.
 * Each entry is [width, length] in studs.
 */
const BRICK_SIZES: [number, number][] = [
  [4, 6],
  [4, 4],
  [2, 6],
  [2, 4],
  [2, 3],
  [2, 2],
  [1, 6],
  [1, 4],
  [1, 3],
  [1, 2],
  [1, 1],
];

/** Common hex → color name mapping for LEGO colors */
const HEX_COLOR_MAP: Record<string, string> = {
  '#FFFFFF': 'White',
  '#000000': 'Black',
  '#FF0000': 'Red',
  '#B40000': 'Dark Red',
  '#0055BF': 'Blue',
  '#003DA5': 'Dark Blue',
  '#237841': 'Green',
  '#184632': 'Dark Green',
  '#FEC401': 'Yellow',
  '#F5CD2F': 'Bright Light Yellow',
  '#F97B22': 'Orange',
  '#E76318': 'Dark Orange',
  '#C870A0': 'Bright Pink',
  '#FF698F': 'Coral',
  '#A5499B': 'Medium Lavender',
  '#A0A5A9': 'Light Bluish Gray',
  '#6C6E68': 'Dark Bluish Gray',
  '#958A73': 'Dark Tan',
  '#E4CD9E': 'Tan',
  '#CDA4DE': 'Lavender',
  '#75B5D4': 'Medium Azure',
  '#36AEBF': 'Dark Turquoise',
  '#078BC9': 'Dark Azure',
  '#88C7DB': 'Light Azure',
  '#AA7D55': 'Medium Nougat',
  '#7C503A': 'Reddish Brown',
  '#D09168': 'Nougat',
  '#FCC39E': 'Light Nougat',
  '#AAFF00': 'Lime',
  '#4B9F4A': 'Bright Green',
  '#582A12': 'Dark Brown',
  '#FFFFFF00': 'Trans-Clear',
};

/**
 * Map a hex color string to a human-readable LEGO color name.
 * Falls back to the hex value itself if no match is found.
 */
export function hexToColorName(hex: string): string {
  const normalized = hex.toUpperCase().trim();
  if (HEX_COLOR_MAP[normalized]) return HEX_COLOR_MAP[normalized];

  // Try closest match by Euclidean distance in RGB space
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return normalized;

  let bestName = normalized;
  let bestDist = Infinity;
  for (const [mapHex, name] of Object.entries(HEX_COLOR_MAP)) {
    const mr = parseInt(mapHex.slice(1, 3), 16);
    const mg = parseInt(mapHex.slice(3, 5), 16);
    const mb = parseInt(mapHex.slice(5, 7), 16);
    const dist = (r - mr) ** 2 + (g - mg) ** 2 + (b - mb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestName = name;
    }
  }

  // Only use closest match if reasonably close (distance < 50 per channel avg)
  return bestDist < 7500 ? bestName : normalized;
}

/**
 * Validate and normalize a VoxelGrid:
 * - Pad ragged rows to declared width
 * - Clamp grid to declared dimensions
 * - Remove fully empty layers
 */
export function validateVoxelGrid(grid: VoxelGrid): VoxelGrid {
  const width = Math.max(1, Math.round(grid.width));
  const depth = Math.max(1, Math.round(grid.depth));

  const layers: VoxelLayer[] = [];
  for (const layer of grid.layers) {
    const normalizedGrid: string[][] = [];

    // Ensure grid has exactly `depth` rows
    for (let z = 0; z < depth; z++) {
      const row = layer.grid[z] || [];
      const normalizedRow: string[] = [];
      for (let x = 0; x < width; x++) {
        const cell = (row[x] || '').trim();
        // Normalize hex: ensure # prefix for non-empty cells
        if (cell && !cell.startsWith('#')) {
          normalizedRow.push(`#${cell}`);
        } else {
          normalizedRow.push(cell);
        }
      }
      normalizedGrid.push(normalizedRow);
    }

    // Check if layer has any non-empty cells
    const hasContent = normalizedGrid.some((row) => row.some((cell) => cell !== ''));
    if (hasContent) {
      layers.push({
        y: layer.y,
        heightType: layer.heightType === 'plate' ? 'plate' : 'brick',
        grid: normalizedGrid,
      });
    }
  }

  return {
    ...grid,
    width,
    depth,
    layers,
  };
}

/**
 * Try to fit a rectangle of the given size at (startX, startZ) in the grid.
 * All cells must be the same color, non-empty, and unvisited.
 */
function tryFitRect(
  grid: string[][],
  visited: boolean[][],
  startX: number,
  startZ: number,
  w: number,
  l: number,
  maxX: number,
  maxZ: number
): boolean {
  if (startX + w > maxX || startZ + l > maxZ) return false;

  const targetColor = grid[startZ][startX];
  for (let z = startZ; z < startZ + l; z++) {
    for (let x = startX; x < startX + w; x++) {
      if (visited[z][x] || grid[z][x] !== targetColor) return false;
    }
  }
  return true;
}

/** Mark cells in a rectangle as visited */
function markVisited(visited: boolean[][], startX: number, startZ: number, w: number, l: number): void {
  for (let z = startZ; z < startZ + l; z++) {
    for (let x = startX; x < startX + w; x++) {
      visited[z][x] = true;
    }
  }
}

/**
 * Convert a VoxelGrid into BuildStepBlock[] using greedy rectangle packing.
 *
 * For each layer, scans left→right, front→back. For each unvisited colored cell,
 * tries the largest valid LEGO brick size first, in both orientations.
 *
 * @param grid - Validated VoxelGrid
 * @param inventoryConstraint - Optional map of `${width}x${length}` → available count.
 *   When provided, the algorithm only uses sizes that have remaining inventory.
 *   Falls back to smaller bricks when a size is exhausted.
 */
export function voxelGridToBricks(
  grid: VoxelGrid,
  inventoryConstraint?: Map<string, number>
): { steps: BuildStepBlock[]; report: VoxelConversionReport } {
  const steps: BuildStepBlock[] = [];
  const sizeDistribution: Record<string, number> = {};
  let totalVoxels = 0;
  let stepId = 1;

  // Track accumulated Y position from stacking layers
  let currentY = 0;

  for (const layer of grid.layers) {
    const { grid: layerGrid, heightType } = layer;
    const height = getBrickHeight('rectangle', heightType === 'plate' ? 'plate' : 'brick');
    const maxZ = layerGrid.length;
    const maxX = maxZ > 0 ? Math.max(...layerGrid.map((row) => row.length)) : 0;

    // Build visited grid
    const visited: boolean[][] = layerGrid.map((row) => row.map((cell) => cell === ''));

    // Count voxels in this layer
    for (let z = 0; z < maxZ; z++) {
      for (let x = 0; x < maxX; x++) {
        if (layerGrid[z]?.[x] && layerGrid[z][x] !== '') {
          totalVoxels++;
        }
      }
    }

    // Clone inventory constraint for this layer (if provided)
    const layerInventory = inventoryConstraint ? new Map(inventoryConstraint) : undefined;

    // Greedy packing: scan left→right, front→back
    for (let z = 0; z < maxZ; z++) {
      for (let x = 0; x < maxX; x++) {
        if (visited[z][x]) continue;

        const color = layerGrid[z][x];
        if (!color || color === '') {
          visited[z][x] = true;
          continue;
        }

        // Try each brick size, largest first
        let placed = false;
        for (const [bw, bl] of BRICK_SIZES) {
          // Try both orientations: WxL and LxW
          const orientations: [number, number][] = bw === bl ? [[bw, bl]] : [[bw, bl], [bl, bw]];

          for (const [w, l] of orientations) {
            // Check inventory constraint
            const sizeKey = `${Math.min(w, l)}x${Math.max(w, l)}`;
            if (layerInventory) {
              const remaining = layerInventory.get(sizeKey) ?? 0;
              if (remaining <= 0) continue;
            }

            if (tryFitRect(layerGrid, visited, x, z, w, l, maxX, maxZ)) {
              markVisited(visited, x, z, w, l);

              // Compute center position (automatically satisfies even/odd rules)
              const posX = x + (w - 1) / 2;
              const posZ = z + (l - 1) / 2;

              const colorName = hexToColorName(color);
              const type: BrickType = heightType === 'plate' ? 'plate' : 'brick';

              steps.push({
                stepId: stepId++,
                partName: `${w}x${l} ${type}`,
                color: colorName,
                hexColor: color.toUpperCase(),
                type,
                shape: 'rectangle',
                position: { x: posX, y: currentY, z: posZ },
                rotation: { x: 0, y: 0, z: 0 },
                size: { width: w, height, length: l },
                description: `Place ${colorName} ${w}x${l}`,
              });

              // Update tracking
              sizeDistribution[sizeKey] = (sizeDistribution[sizeKey] || 0) + 1;
              if (layerInventory) {
                const remaining = layerInventory.get(sizeKey) ?? 0;
                layerInventory.set(sizeKey, remaining - 1);
              }

              placed = true;
              break;
            }
          }
          if (placed) break;
        }

        // Should never reach here if grid is valid, but mark as visited just in case
        if (!placed) {
          visited[z][x] = true;
        }
      }
    }

    currentY += height;
  }

  const report: VoxelConversionReport = {
    totalVoxels,
    totalBricks: steps.length,
    averageBrickSize: steps.length > 0 ? totalVoxels / steps.length : 0,
    sizeDistribution,
    layerCount: grid.layers.length,
  };

  return { steps, report };
}
