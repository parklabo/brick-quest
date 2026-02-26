import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import type { VoxelGrid } from '@brick-quest/shared';
import type { PixelExtractionResult } from './strategies/pixel-extract.js';

// ─────────────────────────────────────────────────────────────────────────────
// Design Debug Artifacts
//
// Saves intermediate data to Storage for debugging and quality inspection.
// All saves are non-blocking — failures are logged but never throw.
//
// Storage path: designs/{jobId}/debug/
// ─────────────────────────────────────────────────────────────────────────────

export interface DesignDebugData {
  jobId: string;
  /** Sharp pixel extraction result (if available) */
  pixelExtraction?: PixelExtractionResult;
  /** Final voxel grid (after carving + brick conversion) */
  voxelGrid?: VoxelGrid;
  /** Which extraction strategy produced the final result */
  strategy: 'sharp' | 'flash' | 'build-commands' | 'full-grid' | 'direct-voxel';
  /** Total time for the design generation */
  totalMs: number;
  /** Quality evaluation score (1-10) */
  qualityScore?: number;
  /** Recognition result subject */
  recognizedSubject?: string;
}

/** Single-character color abbreviations for ASCII visualization */
const COLOR_ABBREVS: Record<string, string> = {
  '#FFFFFF': 'W',
  '#000000': 'K',
  '#FF0000': 'R',
  '#B40000': 'r',
  '#0055BF': 'B',
  '#003DA5': 'b',
  '#237841': 'G',
  '#184632': 'g',
  '#FEC401': 'Y',
  '#F5CD2F': 'y',
  '#F97B22': 'O',
  '#E76318': 'o',
  '#C870A0': 'P',
  '#FF698F': 'p',
  '#A5499B': 'V',
  '#A0A5A9': 'L',
  '#6C6E68': 'D',
  '#958A73': 't',
  '#E4CD9E': 'T',
  '#CDA4DE': 'v',
  '#75B5D4': 'A',
  '#36AEBF': 'Q',
  '#078BC9': 'a',
  '#88C7DB': 'l',
  '#AA7D55': 'N',
  '#7C503A': 'n',
  '#D09168': 'U',
  '#FCC39E': 'u',
  '#AAFF00': 'X',
  '#4B9F4A': 'x',
  '#582A12': 'd',
};

function colorAbbrev(hex: string): string {
  return COLOR_ABBREVS[hex.toUpperCase()] || '?';
}

/**
 * Format a VoxelGrid as ASCII art, one layer at a time.
 * Each layer shows a 2D grid with single-character color codes.
 */
export function formatLayersAscii(voxelGrid: VoxelGrid): string {
  const lines: string[] = [];

  // Legend
  const usedColors = new Set<string>();
  for (const layer of voxelGrid.layers) {
    for (const row of layer.grid) {
      for (const cell of row) {
        if (cell) usedColors.add(cell.toUpperCase());
      }
    }
  }

  lines.push('=== COLOR LEGEND ===');
  for (const hex of usedColors) {
    lines.push(`  ${colorAbbrev(hex)} = ${hex}`);
  }
  lines.push('');

  // Layers (bottom to top)
  for (const layer of voxelGrid.layers) {
    lines.push(`=== Layer ${layer.y} (y=${layer.y}, ${layer.heightType}) ===`);
    // Print rows from top to bottom visually (highest z first)
    for (let z = layer.grid.length - 1; z >= 0; z--) {
      const row = layer.grid[z];
      const chars = row.map((cell) => (cell ? colorAbbrev(cell) : '.'));
      lines.push(chars.join(' '));
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Save debug artifacts to Firebase Storage.
 * Non-blocking — catches and logs all errors.
 */
export async function saveDesignDebug(data: DesignDebugData): Promise<void> {
  try {
    const bucket = getStorage().bucket();
    const prefix = `designs/${data.jobId}/debug`;

    const saves: Promise<void>[] = [];

    // 1. Extraction metadata
    const extractionMeta = {
      strategy: data.strategy,
      totalMs: data.totalMs,
      qualityScore: data.qualityScore,
      recognizedSubject: data.recognizedSubject,
      timestamp: new Date().toISOString(),
      ...(data.pixelExtraction && {
        pixelExtraction: {
          width: data.pixelExtraction.width,
          depth: data.pixelExtraction.depth,
          totalLayers: data.pixelExtraction.totalLayers,
          extractionMs: data.pixelExtraction.extractionMs,
          bounds: data.pixelExtraction.bounds,
        },
      }),
    };
    saves.push(
      bucket
        .file(`${prefix}/extraction.json`)
        .save(JSON.stringify(extractionMeta, null, 2), { contentType: 'application/json' })
    );

    // 2. Front and side grids (if pixel extraction available)
    if (data.pixelExtraction) {
      saves.push(
        bucket
          .file(`${prefix}/front-grid.json`)
          .save(JSON.stringify(data.pixelExtraction.frontGrid), { contentType: 'application/json' })
      );
      saves.push(
        bucket
          .file(`${prefix}/side-grid.json`)
          .save(JSON.stringify(data.pixelExtraction.sideGrid), { contentType: 'application/json' })
      );
    }

    // 3. ASCII layer visualization (if voxel grid available)
    if (data.voxelGrid) {
      const ascii = formatLayersAscii(data.voxelGrid);
      saves.push(bucket.file(`${prefix}/layers-ascii.txt`).save(ascii, { contentType: 'text/plain' }));
    }

    await Promise.all(saves);
    logger.info(`  [design-debug] Saved ${saves.length} debug artifacts to ${prefix}/`);
  } catch (error: any) {
    logger.warn(`  [design-debug] Failed to save debug artifacts: ${error.message}`);
  }
}
