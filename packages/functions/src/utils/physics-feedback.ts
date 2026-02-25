import type { PhysicsValidationReport } from '@brick-quest/shared';
import { LIMITS } from '../config.js';

export function needsAgentRetry(report: PhysicsValidationReport): boolean {
  return report.droppedPercentage > LIMITS.DROP_THRESHOLD_PCT || report.droppedCount > LIMITS.DROP_THRESHOLD_ABS;
}

export function buildPhysicsFeedback(report: PhysicsValidationReport): string {
  const dropped = report.corrections.filter((c) => c.action === 'dropped');
  const nudged = report.corrections.filter((c) => c.action === 'nudged');

  // Group dropped bricks by Y-layer
  const layerGroups = new Map<number, typeof dropped>();
  for (const c of dropped) {
    const y = Math.round(c.originalPosition.y * 10) / 10;
    if (!layerGroups.has(y)) layerGroups.set(y, []);
    layerGroups.get(y)!.push(c);
  }

  // Build per-layer summaries with bounding boxes and concentration detection
  const layerLines: string[] = [];
  for (const [y, bricks] of [...layerGroups.entries()].sort((a, b) => a[0] - b[0])) {
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const b of bricks) {
      const hw = b.size.width / 2;
      const hl = b.size.length / 2;
      minX = Math.min(minX, b.originalPosition.x - hw);
      maxX = Math.max(maxX, b.originalPosition.x + hw);
      minZ = Math.min(minZ, b.originalPosition.z - hl);
      maxZ = Math.max(maxZ, b.originalPosition.z + hl);
    }
    const area = (maxX - minX) * (maxZ - minZ);
    const density = bricks.length / Math.max(area, 1);
    const congested = density > 0.5;

    layerLines.push(
      `  Y=${y}: ${bricks.length} dropped in X=[${minX.toFixed(1)},${maxX.toFixed(1)}] Z=[${minZ.toFixed(1)},${maxZ.toFixed(1)}]${congested ? ' ⚠ CONGESTED — too many bricks in a small area, spread them out or use fewer larger bricks' : ''}`
    );

    // List individual dropped bricks for this layer
    for (const c of bricks) {
      layerLines.push(
        `    - "${c.partName}" ${c.size.width}x${c.size.length} at (${c.originalPosition.x},${c.originalPosition.z}): ${c.reason}`
      );
    }
  }

  // Nudged bricks summary (so AI knows positions shifted)
  let nudgeSection = '';
  if (nudged.length > 0) {
    const nudgeLines = nudged.map(
      (c) => `  - "${c.partName}" ${c.size.width}x${c.size.length}: moved from (${c.originalPosition.x},${c.originalPosition.y},${c.originalPosition.z}) — ${c.reason}`
    );
    nudgeSection = `\nNUDGED BRICKS (${nudged.length} bricks shifted to avoid overlaps — their positions changed):
${nudgeLines.join('\n')}
NOTE: These bricks survived but moved. Account for their NEW positions when re-placing dropped bricks.\n`;
  }

  // Replaced bricks summary (if any)
  const replaced = report.corrections.filter((c) => c.action === 'replaced');
  let replacedSection = '';
  if (replaced.length > 0) {
    replacedSection = `\nRECOVERED BRICKS (${replaced.length} bricks were re-placed at alternative positions after initial drop).\n`;
  }

  return `PHYSICS FEEDBACK — ${report.droppedCount} bricks were REMOVED because they overlapped and could not be resolved.
The surviving build has ${report.outputCount} bricks (${report.droppedPercentage.toFixed(1)}% dropped).

DROPPED BRICKS BY LAYER:
${layerLines.join('\n')}
${nudgeSection}${replacedSection}
INSTRUCTIONS FOR IMPROVEMENT:
- Layers with CONGESTED warnings have too many bricks competing for the same space. Use fewer, LARGER bricks (2x4, 2x3) instead of many small ones.
- Re-place dropped bricks at VALID positions that don't overlap existing bricks.
- Ensure every brick (except ground level) rests on a brick below with ≥1 stud XZ overlap.
- Calculate Y positions precisely: brick height=1.2, plate height=0.4.
- For each layer, TILE the footprint systematically left-to-right, front-to-back. Do not place bricks randomly.
- Keep the same creative design but fix the spatial conflicts.`;
}
