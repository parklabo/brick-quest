'use client';

import { useRef, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useWorkspaceStore } from '../../lib/stores/workspace';
import type { PlacedBrick } from '../../lib/stores/workspace';
import { SELECT_RING } from '../../lib/three/shared-geometries';
import { BrickBody } from '../three/BrickBody';

// Static materials — avoids re-creation on every hover/select toggle
const SELECTED_MAT = new THREE.MeshBasicMaterial({
  color: '#fbbf24',
  transparent: true,
  opacity: 0.7,
  side: THREE.DoubleSide,
});
const HOVERED_MAT = new THREE.MeshBasicMaterial({
  color: '#60a5fa',
  transparent: true,
  opacity: 0.4,
  side: THREE.DoubleSide,
});

interface InteractiveBrickProps {
  brick: PlacedBrick;
}

export function InteractiveBrick({ brick }: InteractiveBrickProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const selectedId = useWorkspaceStore((s) => s.selectedBrickId);
  const selectBrick = useWorkspaceStore((s) => s.selectBrick);
  const isSelected = selectedId === brick.instanceId;

  const { width, height, length } = brick.size;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectBrick(isSelected ? null : brick.instanceId);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'default';
  };

  const emissiveColor = isSelected ? '#fbbf24' : hovered ? '#60a5fa' : '#000000';
  const emissiveIntensity = isSelected ? 0.3 : hovered ? 0.15 : 0;

  return (
    <group
      ref={groupRef}
      position={[brick.position.x, brick.position.y + height / 2, brick.position.z]}
      rotation={[
        brick.rotation.x * (Math.PI / 180),
        brick.rotation.y * (Math.PI / 180),
        brick.rotation.z * (Math.PI / 180),
      ]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <BrickBody
        shape={brick.shape}
        type={brick.type}
        width={width}
        height={height}
        length={length}
        hexColor={brick.hexColor}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
      />

      {/* Selection ring at ground level */}
      {(isSelected || hovered) && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -height / 2 + 0.03, 0]}
          geometry={SELECT_RING}
          material={isSelected ? SELECTED_MAT : HOVERED_MAT}
        />
      )}
    </group>
  );
}
