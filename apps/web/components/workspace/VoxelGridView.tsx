'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { VoxelGrid } from '@brick-quest/shared';

const BRICK_HEIGHT = 1.2;
const PLATE_HEIGHT = 0.4;
const VOXEL_GAP = 0.95; // slight gap between voxels for visual clarity

interface ColorGroup {
  color: string;
  matrices: THREE.Matrix4[];
}

function VoxelInstances({ color, matrices }: ColorGroup) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(VOXEL_GAP, 1, VOXEL_GAP), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 }), [color]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  return <instancedMesh ref={meshRef} args={[geometry, material, matrices.length]} castShadow receiveShadow />;
}

/** Render raw AI voxel grid as 1x1 colored cubes for debug comparison */
export function VoxelGridView({ grid }: { grid: VoxelGrid }) {
  const colorGroups = useMemo(() => {
    const groups = new Map<string, THREE.Matrix4[]>();
    let currentY = 0;

    for (const layer of grid.layers) {
      const h = layer.heightType === 'brick' ? BRICK_HEIGHT : PLATE_HEIGHT;

      for (let z = 0; z < layer.grid.length; z++) {
        const row = layer.grid[z];
        if (!row) continue;
        for (let x = 0; x < row.length; x++) {
          const hex = row[x];
          if (!hex) continue;

          const m = new THREE.Matrix4();
          m.compose(
            new THREE.Vector3(x, currentY + h / 2, z),
            new THREE.Quaternion(),
            new THREE.Vector3(1, h, 1)
          );

          if (!groups.has(hex)) groups.set(hex, []);
          groups.get(hex)!.push(m);
        }
      }

      currentY += h;
    }

    const result: ColorGroup[] = [];
    for (const [color, matrices] of groups) {
      result.push({ color, matrices });
    }
    return result;
  }, [grid]);

  return (
    <group>
      {colorGroups.map(({ color, matrices }) => (
        <VoxelInstances key={color} color={color} matrices={matrices} />
      ))}
    </group>
  );
}
