import * as THREE from 'three';
import type { GeometryKind, GeometryParams } from '@brick-quest/shared';

/**
 * Create a Three.js BufferGeometry for the given GeometryKind.
 *
 * @param params - shape geometry params from the registry
 * @param width  - brick width in studs
 * @param height - brick height in units (1.2 for brick, 0.4 for plate)
 * @param length - brick length in studs
 */
export function createBrickGeometry(
  params: GeometryParams,
  width: number,
  height: number,
  length: number,
): THREE.BufferGeometry {
  const factory = GEOMETRY_FACTORIES[params.kind];
  if (!factory) return createBox(width, height, length);
  return factory(params, width, height, length);
}

// ── Per-kind factory functions ────────────────────────────

function createBox(w: number, h: number, l: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w - 0.05, h, l - 0.05);
}

function createCylinder(
  _params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  const radius = Math.min(w, l) / 2 - 0.05;
  return new THREE.CylinderGeometry(radius, radius, h, 32);
}

function createLShape(
  _params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  // Two boxes merged: full-width bottom row + 1-stud-wide column
  const part1 = new THREE.BoxGeometry(w - 0.05, h, 1 - 0.05);
  part1.translate(0, 0, -(l / 2) + 0.5);

  if (l > 1) {
    const part2Length = l - 1;
    const part2 = new THREE.BoxGeometry(1 - 0.05, h, part2Length - 0.05);
    part2.translate(-(w / 2) + 0.5, 0, 0.5);
    return mergeGeometries([part1, part2]);
  }
  return part1;
}

function createWedge(
  params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  const angleDeg = params.slopeAngleDeg ?? 45;
  const angleRad = (angleDeg * Math.PI) / 180;

  // Triangle cross-section: base = length, height based on angle
  // We extrude along the width axis
  const slopeHeight = h;
  const slopeRun = slopeHeight / Math.tan(angleRad);
  const clampedRun = Math.min(slopeRun, l);

  const shape = new THREE.Shape();
  // Bottom-left
  shape.moveTo(-l / 2, -h / 2);
  // Bottom-right
  shape.lineTo(l / 2, -h / 2);
  // Top-right (full height at the back)
  shape.lineTo(l / 2, h / 2);
  // Slope: from top-right, go left by clampedRun, down to bottom
  shape.lineTo(l / 2 - clampedRun, -h / 2);

  // Close if the run doesn't cover the full length
  if (clampedRun < l) {
    shape.lineTo(-l / 2, -h / 2);
  }

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: w - 0.05,
    bevelEnabled: false,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center on X axis (extrude goes along +Z, we want it along X)
  geo.rotateY(Math.PI / 2);
  geo.translate(0, 0, 0);
  // Re-center the extrusion
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    const cy = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;
    const cz = (geo.boundingBox.min.z + geo.boundingBox.max.z) / 2;
    geo.translate(-cx, -cy, -cz);
  }

  return geo;
}

function createInvertedWedge(
  params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  const angleDeg = params.slopeAngleDeg ?? 45;
  const angleRad = (angleDeg * Math.PI) / 180;
  const slopeRun = Math.min(h / Math.tan(angleRad), l);

  // Inverted: flat on top, slope on the bottom
  const shape = new THREE.Shape();
  shape.moveTo(-l / 2, h / 2);
  shape.lineTo(l / 2, h / 2);
  shape.lineTo(l / 2, -h / 2);
  shape.lineTo(l / 2 - slopeRun, h / 2);
  if (slopeRun < l) {
    shape.lineTo(-l / 2, h / 2);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: w - 0.05,
    bevelEnabled: false,
  });

  geo.rotateY(Math.PI / 2);
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    const cy = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;
    const cz = (geo.boundingBox.min.z + geo.boundingBox.max.z) / 2;
    geo.translate(-cx, -cy, -cz);
  }

  return geo;
}

function createCurvedWedge(
  params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  const segments = params.curveSegments ?? 12;

  // Curved slope: smooth curve from top-back down to bottom-front
  const shape = new THREE.Shape();
  shape.moveTo(-l / 2, -h / 2);
  shape.lineTo(l / 2, -h / 2);
  shape.lineTo(l / 2, h / 2);

  // Bezier curve for the slope surface
  shape.bezierCurveTo(
    l / 2 - l * 0.3, h / 2,
    -l / 2 + l * 0.1, -h / 2 + h * 0.1,
    -l / 2, -h / 2,
  );

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: w - 0.05,
    bevelEnabled: false,
    curveSegments: segments,
  });

  geo.rotateY(Math.PI / 2);
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    const cy = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;
    const cz = (geo.boundingBox.min.z + geo.boundingBox.max.z) / 2;
    geo.translate(-cx, -cy, -cz);
  }

  return geo;
}

function createArch(
  params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  const segments = params.curveSegments ?? 16;

  // Arch: rectangular box with a semicircular cutout at the bottom
  const shape = new THREE.Shape();
  shape.moveTo(-l / 2, -h / 2);
  shape.lineTo(l / 2, -h / 2);
  shape.lineTo(l / 2, h / 2);
  shape.lineTo(-l / 2, h / 2);
  shape.lineTo(-l / 2, -h / 2);

  // Semicircular hole
  const archRadius = Math.min(l / 2 - 0.1, h / 2);
  const hole = new THREE.Path();
  hole.absarc(0, -h / 2, archRadius, 0, Math.PI, false);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: w - 0.05,
    bevelEnabled: false,
    curveSegments: segments,
  });

  geo.rotateY(Math.PI / 2);
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    const cy = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;
    const cz = (geo.boundingBox.min.z + geo.boundingBox.max.z) / 2;
    geo.translate(-cx, -cy, -cz);
  }

  return geo;
}

function createCone(
  params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  const radius = Math.min(w, l) / 2 - 0.05;
  const segments = params.curveSegments ?? 32;
  return new THREE.ConeGeometry(radius, h, segments);
}

function createTriangularPlate(
  _params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -l / 2);
  shape.lineTo(w / 2, -l / 2);
  shape.lineTo(-w / 2, l / 2);
  shape.lineTo(-w / 2, -l / 2);

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: h,
    bevelEnabled: false,
  });

  // Rotate so depth is along Y
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    const cy = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;
    const cz = (geo.boundingBox.min.z + geo.boundingBox.max.z) / 2;
    geo.translate(-cx, -cy, -cz);
  }

  return geo;
}

function createDome(
  params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  const radius = Math.min(w, l) / 2 - 0.05;
  const segments = params.curveSegments ?? 24;
  // Half sphere — only the top half (phi from 0 to PI/2)
  return new THREE.SphereGeometry(radius, segments, segments / 2, 0, Math.PI * 2, 0, Math.PI / 2);
}

function createHalfCylinder(
  params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  const radius = h / 2;
  const segments = params.curveSegments ?? 16;

  // Half cylinder: semicircular cross-section extruded along length
  const geo = new THREE.CylinderGeometry(radius, radius, l - 0.05, segments, 1, false, 0, Math.PI);
  geo.rotateZ(Math.PI / 2);
  geo.rotateY(Math.PI / 2);

  return geo;
}

function createBeamWithHoles(
  _params: GeometryParams,
  w: number,
  h: number,
  l: number,
): THREE.BufferGeometry {
  // Simplified: box with visual representation. True holes would need CSG.
  // We add rounded ends for the technic beam look.
  const shape = new THREE.Shape();
  const halfH = h / 2;
  const halfL = l / 2;
  const r = Math.min(halfH, 0.4); // end cap radius

  shape.moveTo(-halfL + r, -halfH);
  shape.lineTo(halfL - r, -halfH);
  shape.quadraticCurveTo(halfL, -halfH, halfL, -halfH + r);
  shape.lineTo(halfL, halfH - r);
  shape.quadraticCurveTo(halfL, halfH, halfL - r, halfH);
  shape.lineTo(-halfL + r, halfH);
  shape.quadraticCurveTo(-halfL, halfH, -halfL, halfH - r);
  shape.lineTo(-halfL, -halfH + r);
  shape.quadraticCurveTo(-halfL, -halfH, -halfL + r, -halfH);

  // Add pin holes
  const holeCount = Math.max(1, Math.round(l));
  for (let i = 0; i < holeCount; i++) {
    const cx = -halfL + 0.5 + i;
    if (cx > halfL - 0.3) break;
    const hole = new THREE.Path();
    hole.absarc(cx, 0, 0.2, 0, Math.PI * 2, false);
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: w - 0.05,
    bevelEnabled: false,
  });

  geo.rotateY(Math.PI / 2);
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    const cy = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;
    const cz = (geo.boundingBox.min.z + geo.boundingBox.max.z) / 2;
    geo.translate(-cx, -cy, -cz);
  }

  return geo;
}

// ── Factory Lookup ────────────────────────────────────────

type GeometryFactory = (
  params: GeometryParams,
  w: number,
  h: number,
  l: number,
) => THREE.BufferGeometry;

const GEOMETRY_FACTORIES: Record<GeometryKind, GeometryFactory> = {
  box: (_p, w, h, l) => createBox(w, h, l),
  cylinder: createCylinder,
  l_shape: createLShape,
  wedge: createWedge,
  inverted_wedge: createInvertedWedge,
  curved_wedge: createCurvedWedge,
  arch: createArch,
  cone: createCone,
  triangular_plate: createTriangularPlate,
  dome: createDome,
  half_cylinder: createHalfCylinder,
  beam_with_holes: createBeamWithHoles,
};

// ── Geometry Cache ────────────────────────────────────────

const geometryCache = new Map<string, THREE.BufferGeometry>();

/**
 * Get or create a cached geometry for the given params + dimensions.
 * The cache key includes all parameters that affect the resulting geometry.
 */
export function getCachedGeometry(
  params: GeometryParams,
  width: number,
  height: number,
  length: number,
): THREE.BufferGeometry {
  const key = `${params.kind}:${params.slopeAngleDeg ?? ''}:${params.curveSegments ?? ''}:${width}:${height}:${length}`;
  let geo = geometryCache.get(key);
  if (!geo) {
    geo = createBrickGeometry(params, width, height, length);
    geometryCache.set(key, geo);
  }
  return geo;
}

/** Clear the geometry cache (call on unmount/cleanup). */
export function clearGeometryCache(): void {
  for (const geo of geometryCache.values()) {
    geo.dispose();
  }
  geometryCache.clear();
}

// ── Helpers ───────────────────────────────────────────────

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Simple merge by combining indexed buffer attributes
  if (geometries.length === 1) return geometries[0];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  for (const geo of geometries) {
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    const idx = geo.index;

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + indexOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(i + indexOffset);
      }
    }

    indexOffset += pos.count;
    geo.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length > 0) {
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  }
  merged.setIndex(indices);
  merged.computeVertexNormals();

  return merged;
}
