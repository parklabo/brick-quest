import type { BuildStepBlock, PhysicsCorrectionEntry, PhysicsResult } from '../types/brick.js';
import { getBrickHeight } from '../registry/shape-registry.js';

const EPSILON = 0.01;
const MIN_SUPPORT_OVERLAP = 0.5;
/** Smallest LEGO height unit (plate/tile) */
const PLATE_HEIGHT = 0.4;

interface BoundingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

function normalizeRotationY(y: number): number {
  const mod = ((y % 360) + 360) % 360;
  // Snap to nearest 90
  if (mod < 45) return 0;
  if (mod < 135) return 90;
  if (mod < 225) return 180;
  if (mod < 315) return 270;
  return 0;
}

function getFootprint(step: BuildStepBlock): BoundingBox {
  const rotY = normalizeRotationY(step.rotation.y);
  const swapped = rotY === 90 || rotY === 270;

  const halfW = (swapped ? step.size.length : step.size.width) / 2;
  const halfL = (swapped ? step.size.width : step.size.length) / 2;

  return {
    minX: step.position.x - halfW,
    maxX: step.position.x + halfW,
    minZ: step.position.z - halfL,
    maxZ: step.position.z + halfL,
    minY: step.position.y,
    maxY: step.position.y + step.size.height,
  };
}

function xzOverlapArea(a: BoundingBox, b: BoundingBox): number {
  const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const overlapZ = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
  return overlapX * overlapZ;
}

function yOverlaps(a: BoundingBox, b: BoundingBox): boolean {
  return a.minY < b.maxY - EPSILON && b.minY < a.maxY - EPSILON;
}

/**
 * Snap a single axis value to the stud grid.
 * Even dimension → center at .5 (0.5, 1.5, 2.5, …)
 * Odd dimension  → center at integer (0, 1, 2, …)
 */
function snapAxis(value: number, dimension: number): number {
  if (dimension % 2 === 0) {
    // Even: snap to nearest 0.5
    return Math.round(value - 0.5) + 0.5;
  }
  // Odd: snap to nearest integer
  return Math.round(value);
}

/**
 * Snap Y to the nearest plate-height multiple (0.4 units), clamp >= 0.
 */
function snapY(y: number): number {
  return Math.max(0, Math.round(y / PLATE_HEIGHT) * PLATE_HEIGHT);
}

/**
 * Round dimensions to nearest positive integer and recalculate height.
 */
function snapDimensions(step: BuildStepBlock): void {
  step.size.width = Math.max(1, Math.round(step.size.width));
  step.size.length = Math.max(1, Math.round(step.size.length));
  step.size.height = getBrickHeight(step.shape, step.type);
}

/**
 * Snap position and rotation to the LEGO stud grid.
 * - X/Z snapped based on even/odd dimension rules
 * - Y snapped to plate-height multiples
 * - Rotation: only Y rotation allowed (X/Z forced to 0), Y snapped to 90-degree increments
 */
function snapToStudGrid(step: BuildStepBlock): void {
  const rotY = normalizeRotationY(step.rotation.y);
  step.rotation = { x: 0, y: rotY, z: 0 };

  const swapped = rotY === 90 || rotY === 270;
  const effectiveW = swapped ? step.size.length : step.size.width;
  const effectiveL = swapped ? step.size.width : step.size.length;

  step.position.x = snapAxis(step.position.x, effectiveW);
  step.position.z = snapAxis(step.position.z, effectiveL);
  step.position.y = snapY(step.position.y);
}

/**
 * Check if a brick overlaps with any already-placed brick.
 */
function hasOverlap(box: BoundingBox, placed: { box: BoundingBox }[]): boolean {
  for (const p of placed) {
    if (xzOverlapArea(box, p.box) > EPSILON && yOverlaps(box, p.box)) {
      return true;
    }
  }
  return false;
}

/**
 * Nudge offsets: 8 directions (cardinal + diagonal) × 2 distances (1 and 2 studs) = 16 attempts.
 * Sorted by Manhattan distance so we prefer smaller nudges.
 */
const NUDGE_OFFSETS = [
  // Distance 1 — cardinal
  { dx: 1, dz: 0 },
  { dx: -1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: 0, dz: -1 },
  // Distance 1 — diagonal
  { dx: 1, dz: 1 },
  { dx: 1, dz: -1 },
  { dx: -1, dz: 1 },
  { dx: -1, dz: -1 },
  // Distance 2 — cardinal
  { dx: 2, dz: 0 },
  { dx: -2, dz: 0 },
  { dx: 0, dz: 2 },
  { dx: 0, dz: -2 },
  // Distance 2 — diagonal
  { dx: 2, dz: 1 },
  { dx: 2, dz: -1 },
  { dx: -2, dz: 1 },
  { dx: -2, dz: -1 },
  { dx: 1, dz: 2 },
  { dx: 1, dz: -2 },
  { dx: -1, dz: 2 },
  { dx: -1, dz: -2 },
  { dx: 2, dz: 2 },
  { dx: 2, dz: -2 },
  { dx: -2, dz: 2 },
  { dx: -2, dz: -2 },
];

/**
 * Try nudging a brick by up to ±2 studs on X/Z to resolve an overlap.
 * 8 directions × 2 distances = up to 24 attempts, sorted by Manhattan distance.
 * Nudged positions are re-snapped to the stud grid.
 * Returns true if a valid position was found and the step was modified.
 */
function tryNudgeBrick(step: BuildStepBlock, placed: { box: BoundingBox }[]): boolean {
  const origX = step.position.x;
  const origZ = step.position.z;

  const rotY = normalizeRotationY(step.rotation.y);
  const swapped = rotY === 90 || rotY === 270;
  const effectiveW = swapped ? step.size.length : step.size.width;
  const effectiveL = swapped ? step.size.width : step.size.length;

  for (const { dx, dz } of NUDGE_OFFSETS) {
    step.position.x = snapAxis(origX + dx, effectiveW);
    step.position.z = snapAxis(origZ + dz, effectiveL);
    const nudgedBox = getFootprint(step);
    if (!hasOverlap(nudgedBox, placed)) {
      return true;
    }
  }

  // Restore original position — nudge failed
  step.position.x = origX;
  step.position.z = origZ;
  return false;
}

/**
 * Find the support Y for a given brick position among placed bricks.
 */
function findSupportY(box: BoundingBox, placed: { box: BoundingBox }[]): number {
  let supportY = 0;
  for (const p of placed) {
    if (xzOverlapArea(box, p.box) >= MIN_SUPPORT_OVERLAP) {
      supportY = Math.max(supportY, p.box.maxY);
    }
  }
  return supportY;
}

/**
 * Fix physics issues in a build plan with detailed correction reporting.
 * Phase 0: Snap dimensions and positions to the LEGO stud grid
 * Phase 1: Sort by Y ascending (bottom-up processing)
 * Phase 2: Gravity snap-down to nearest support surface
 * Phase 3: Overlap check with nudge fallback (try to preserve bricks)
 * Phase 3.5: Re-placement pass — try to recover dropped bricks
 * Phase 4: Re-number stepIds sequentially
 */
export function fixBuildPhysicsWithReport(steps: BuildStepBlock[]): PhysicsResult {
  const corrections: PhysicsCorrectionEntry[] = [];
  const inputCount = steps.length;

  if (steps.length === 0) {
    return {
      steps,
      report: {
        inputCount: 0,
        outputCount: 0,
        droppedCount: 0,
        gravitySnappedCount: 0,
        nudgedCount: 0,
        replacedCount: 0,
        droppedPercentage: 0,
        corrections: [],
      },
    };
  }

  // Phase 0: Snap dimensions and grid positions
  for (const step of steps) {
    snapDimensions(step);
    snapToStudGrid(step);
  }

  // Phase 1: Sort by Y ascending so we process bottom-up
  const sorted = [...steps].sort((a, b) => a.position.y - b.position.y);

  const placed: { step: BuildStepBlock; box: BoundingBox }[] = [];
  const droppedSteps: { step: BuildStepBlock; originalPos: { x: number; y: number; z: number } }[] = [];

  for (const step of sorted) {
    const originalPos = { ...step.position };
    const box = getFootprint(step);

    // Phase 2: Gravity snap-down — find the highest support surface below
    let supportY = 0; // ground is default support
    for (const p of placed) {
      if (xzOverlapArea(box, p.box) >= MIN_SUPPORT_OVERLAP) {
        supportY = Math.max(supportY, p.box.maxY);
      }
    }

    // Correct Y if it doesn't match support surface
    if (Math.abs(step.position.y - supportY) > EPSILON) {
      corrections.push({
        stepId: step.stepId,
        partName: step.partName,
        originalPosition: originalPos,
        size: { ...step.size },
        action: 'gravity_snapped',
        reason: `y ${originalPos.y.toFixed(1)} → ${supportY.toFixed(1)}`,
      });
      step.position.y = supportY;
    }

    // Recalculate bounding box after snap
    const correctedBox = getFootprint(step);

    // Phase 3: Overlap check with nudge fallback
    if (hasOverlap(correctedBox, placed)) {
      // Try nudging before giving up
      if (tryNudgeBrick(step, placed)) {
        // Recalculate support after nudge (Y may need updating)
        const nudgedBox = getFootprint(step);
        const nudgeSupportY = findSupportY(nudgedBox, placed);
        step.position.y = nudgeSupportY;
        corrections.push({
          stepId: step.stepId,
          partName: step.partName,
          originalPosition: originalPos,
          size: { ...step.size },
          action: 'nudged',
          reason: `overlap resolved by nudge to (${step.position.x}, ${step.position.z})`,
        });
        placed.push({ step, box: getFootprint(step) });
      } else {
        // Nudge failed — collect for re-placement attempt
        droppedSteps.push({ step, originalPos });
      }
    } else {
      placed.push({ step, box: correctedBox });
    }
  }

  // Phase 3.5: Re-placement pass — try to recover dropped bricks
  let replacedCount = 0;
  for (const { step, originalPos } of droppedSteps) {
    let recovered = false;

    const rotY = normalizeRotationY(step.rotation.y);
    const swapped = rotY === 90 || rotY === 270;
    const effectiveW = swapped ? step.size.length : step.size.width;
    const effectiveL = swapped ? step.size.width : step.size.length;

    // Strategy 1: Same XZ, try different Y levels (scan from ground up)
    const origX = step.position.x;
    const origZ = step.position.z;

    // Collect all occupied Y levels to try gaps
    const yLevels = new Set<number>();
    yLevels.add(0);
    for (const p of placed) {
      yLevels.add(Math.round(p.box.maxY * 10) / 10);
    }

    for (const tryY of [...yLevels].sort((a, b) => a - b)) {
      step.position.x = origX;
      step.position.z = origZ;
      step.position.y = tryY;
      const tryBox = getFootprint(step);
      if (!hasOverlap(tryBox, placed)) {
        // Verify support
        const supportY = findSupportY(tryBox, placed);
        if (Math.abs(tryY - supportY) < EPSILON || tryY === 0) {
          recovered = true;
          corrections.push({
            stepId: step.stepId,
            partName: step.partName,
            originalPosition: originalPos,
            size: { ...step.size },
            action: 'replaced',
            reason: `recovered at same XZ, Y=${tryY.toFixed(1)}`,
          });
          placed.push({ step, box: tryBox });
          replacedCount++;
          break;
        }
      }
    }

    if (recovered) continue;

    // Strategy 2: Nudge XZ at original Y level with gravity re-snap
    step.position.x = origX;
    step.position.z = origZ;
    step.position.y = originalPos.y;

    for (const { dx, dz } of NUDGE_OFFSETS) {
      step.position.x = snapAxis(origX + dx, effectiveW);
      step.position.z = snapAxis(origZ + dz, effectiveL);
      const nudgedBox = getFootprint(step);
      // Find support at this new XZ
      const supportY = findSupportY(nudgedBox, placed);
      step.position.y = supportY;
      const finalBox = getFootprint(step);
      if (!hasOverlap(finalBox, placed)) {
        recovered = true;
        corrections.push({
          stepId: step.stepId,
          partName: step.partName,
          originalPosition: originalPos,
          size: { ...step.size },
          action: 'replaced',
          reason: `recovered at (${step.position.x}, ${step.position.y.toFixed(1)}, ${step.position.z})`,
        });
        placed.push({ step, box: finalBox });
        replacedCount++;
        break;
      }
    }

    if (!recovered) {
      // Truly dropped — no recovery possible
      corrections.push({
        stepId: step.stepId,
        partName: step.partName,
        originalPosition: originalPos,
        size: { ...step.size },
        action: 'dropped',
        reason: 'overlap could not be resolved',
      });
    }
  }

  // Phase 4: Re-number stepIds
  placed.forEach(({ step }, i) => {
    step.stepId = i + 1;
  });

  const outputSteps = placed.map(({ step }) => step);
  const droppedCount = inputCount - outputSteps.length;
  const gravitySnappedCount = corrections.filter((c) => c.action === 'gravity_snapped').length;
  const nudgedCount = corrections.filter((c) => c.action === 'nudged').length;

  return {
    steps: outputSteps,
    report: {
      inputCount,
      outputCount: outputSteps.length,
      droppedCount,
      gravitySnappedCount,
      nudgedCount,
      replacedCount,
      droppedPercentage: inputCount > 0 ? (droppedCount / inputCount) * 100 : 0,
      corrections,
    },
  };
}

/**
 * Fix physics issues in a build plan (backward-compatible wrapper).
 */
export function fixBuildPhysics(steps: BuildStepBlock[]): BuildStepBlock[] {
  return fixBuildPhysicsWithReport(steps).steps;
}
