import type { BuildStepBlock } from '../types/brick.js';
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
 * Try nudging a brick by ±1 stud on X or Z to resolve an overlap.
 * Returns true if a valid position was found and the step was modified.
 */
function tryNudgeBrick(step: BuildStepBlock, placed: { box: BoundingBox }[]): boolean {
  const offsets = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 },
  ];

  const origX = step.position.x;
  const origZ = step.position.z;

  for (const { dx, dz } of offsets) {
    step.position.x = origX + dx;
    step.position.z = origZ + dz;
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
 * Fix physics issues in a build plan:
 * Phase 0: Snap dimensions and positions to the LEGO stud grid
 * Phase 1: Sort by Y ascending (bottom-up processing)
 * Phase 2: Gravity snap-down to nearest support surface
 * Phase 3: Overlap check with nudge fallback (try to preserve bricks)
 * Phase 4: Re-number stepIds sequentially
 */
export function fixBuildPhysics(steps: BuildStepBlock[]): BuildStepBlock[] {
  if (steps.length === 0) return steps;

  // Phase 0: Snap dimensions and grid positions
  for (const step of steps) {
    snapDimensions(step);
    snapToStudGrid(step);
  }

  // Phase 1: Sort by Y ascending so we process bottom-up
  const sorted = [...steps].sort((a, b) => a.position.y - b.position.y);

  const placed: { step: BuildStepBlock; box: BoundingBox }[] = [];

  for (const step of sorted) {
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
      step.position.y = supportY;
    }

    // Recalculate bounding box after snap
    const correctedBox = getFootprint(step);

    // Phase 3: Overlap check with nudge fallback
    if (hasOverlap(correctedBox, placed)) {
      // Try nudging ±1 stud before giving up
      if (tryNudgeBrick(step, placed)) {
        // Recalculate support after nudge (Y may need updating)
        const nudgedBox = getFootprint(step);
        let nudgeSupportY = 0;
        for (const p of placed) {
          if (xzOverlapArea(nudgedBox, p.box) >= MIN_SUPPORT_OVERLAP) {
            nudgeSupportY = Math.max(nudgeSupportY, p.box.maxY);
          }
        }
        step.position.y = nudgeSupportY;
        placed.push({ step, box: getFootprint(step) });
      }
      // If nudge also failed, brick is dropped (removed)
    } else {
      placed.push({ step, box: correctedBox });
    }
  }

  // Phase 4: Re-number stepIds
  placed.forEach(({ step }, i) => {
    step.stepId = i + 1;
  });

  return placed.map(({ step }) => step);
}
