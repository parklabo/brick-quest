'use client';

import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const BASEPLATE_SIZE = 32;

export function WorkspaceFloor() {
  return (
    <group>
      {/* Main baseplate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[BASEPLATE_SIZE, BASEPLATE_SIZE]} />
        <meshStandardMaterial color="#2d5a27" roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Stud grid overlay */}
      <gridHelper args={[BASEPLATE_SIZE, BASEPLATE_SIZE, '#3a7a32', '#336a2c']} position={[0, 0.01, 0]} />

      {/* Fine sub-grid */}
      <gridHelper args={[BASEPLATE_SIZE, BASEPLATE_SIZE * 2, '#2a5a24', '#2a5a24']} position={[0, 0.005, 0]} />

      {/* Border glow */}
      <BorderLines size={BASEPLATE_SIZE} />
    </group>
  );
}

function BorderLines({ size }: { size: number }) {
  const lineRef = useRef<THREE.LineLoop>(null);
  const half = size / 2;

  useFrame(() => {
    if (lineRef.current) {
      const mat = lineRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.4 + Math.sin(Date.now() * 0.001) * 0.15;
    }
  });

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
    <lineLoop ref={lineRef} geometry={geometry}>
      <lineBasicMaterial color="#fbbf24" transparent opacity={0.4} />
    </lineLoop>
  );
}
