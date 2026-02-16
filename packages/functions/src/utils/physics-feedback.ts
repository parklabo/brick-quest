import type { PhysicsValidationReport } from '@brick-quest/shared';
import { LIMITS } from '../config.js';

export function needsAgentRetry(report: PhysicsValidationReport): boolean {
  return report.droppedPercentage > LIMITS.DROP_THRESHOLD_PCT || report.droppedCount > LIMITS.DROP_THRESHOLD_ABS;
}

export function buildPhysicsFeedback(report: PhysicsValidationReport): string {
  const dropped = report.corrections.filter((c) => c.action === 'dropped');
  const lines = dropped.map(
    (c) => `- Step ${c.stepId} "${c.partName}" at (${c.originalPosition.x},${c.originalPosition.y},${c.originalPosition.z}) size ${c.size.width}x${c.size.length}: ${c.reason}`,
  );
  return `PHYSICS FEEDBACK — ${report.droppedCount} bricks were REMOVED because they overlapped and could not be nudged.
The surviving build has ${report.outputCount} bricks (${report.droppedPercentage.toFixed(1)}% dropped).

Dropped bricks:
${lines.join('\n')}

INSTRUCTIONS FOR IMPROVEMENT:
- Re-place these bricks at VALID positions that don't overlap existing bricks
- Ensure every brick (except ground level) rests on a brick below with ≥1 stud XZ overlap
- Calculate Y positions precisely: brick height=1.2, plate height=0.4
- Keep the same creative design but fix the spatial conflicts`;
}
