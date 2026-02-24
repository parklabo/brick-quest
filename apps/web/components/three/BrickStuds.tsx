'use client';

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { StudConfig, BrickShape } from '@brick-quest/shared';
import { getPooledMaterial } from '../../lib/three/ldraw-color-override';

interface BrickStudsProps {
  studConfig: StudConfig;
  shape: BrickShape;
  width: number;
  height: number;
  length: number;
  hexColor: string;
  transparent?: boolean;
  opacity?: number;
}

const STUD_RADIUS = 0.3;
const STUD_HEIGHT = 0.2;

// Shared geometries — one per segment count, reused across all studs
const STUD_GEO_32 = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 32);
const STUD_GEO_16 = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16);

const _matrix = new THREE.Matrix4();

export function BrickStuds({
  studConfig,
  shape,
  width,
  height,
  length,
  hexColor,
  transparent = false,
  opacity: _opacity = 1,
}: BrickStudsProps) {
  if (!studConfig.hasStuds) return null;

  const y = height / 2 + STUD_HEIGHT / 2;
  const mat = getPooledMaterial(hexColor, transparent, '#000000', 0);

  if (studConfig.layout === 'single_center') {
    return <mesh position={[0, y, 0]} geometry={STUD_GEO_32} material={mat} />;
  }

  return <GridStuds shape={shape} width={width} length={length} y={y} material={mat} />;
}

interface GridStudsProps {
  shape: BrickShape;
  width: number;
  length: number;
  y: number;
  material: THREE.Material;
}

function GridStuds({ shape, width, length, y, material }: GridStudsProps) {
  const instanceRef = useRef<THREE.InstancedMesh>(null);

  const positions = useMemo(() => {
    const wCount = Math.round(width);
    const lCount = Math.round(length);
    const isCorner = shape === 'corner';
    const result: [number, number, number][] = [];

    for (let i = 0; i < wCount; i++) {
      for (let j = 0; j < lCount; j++) {
        if (isCorner && i === wCount - 1 && j === lCount - 1) continue;

        if (shape === 'wedge_plate') {
          const normalizedX = i / (wCount - 1 || 1);
          const normalizedZ = j / (lCount - 1 || 1);
          if (normalizedX + normalizedZ > 1.1) continue;
        }

        const xOffset = i - (wCount - 1) / 2;
        const zOffset = j - (lCount - 1) / 2;
        result.push([xOffset, y, zOffset]);
      }
    }
    return result;
  }, [shape, width, length, y]);

  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;
    for (let i = 0; i < positions.length; i++) {
      const [x, py, z] = positions[i]!;
      _matrix.makeTranslation(x, py, z);
      inst.setMatrixAt(i, _matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [positions]);

  if (positions.length === 0) return null;

  return <instancedMesh ref={instanceRef} args={[STUD_GEO_16, material, positions.length]} />;
}
