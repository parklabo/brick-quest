'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

export function BorderLines({ size }: { size: number }) {
  const half = size / 2;

  const geometry = useMemo(() => {
    const points = [
      new THREE.Vector3(-half, 0.02, -half),
      new THREE.Vector3(half, 0.02, -half),
      new THREE.Vector3(half, 0.02, half),
      new THREE.Vector3(-half, 0.02, half),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [half]);

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color="#fbbf24" transparent opacity={0.4} />
    </lineLoop>
  );
}
