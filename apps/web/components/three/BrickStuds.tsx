'use client';

import type { StudConfig, BrickShape } from '@brick-quest/shared';

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

export function BrickStuds({
  studConfig,
  shape,
  width,
  height,
  length,
  hexColor,
  transparent = false,
  opacity = 1,
}: BrickStudsProps) {
  if (!studConfig.hasStuds) return null;

  const y = height / 2 + STUD_HEIGHT / 2;

  if (studConfig.layout === 'single_center') {
    return (
      <mesh position={[0, y, 0]}>
        <cylinderGeometry args={[STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 32]} />
        <meshStandardMaterial color={hexColor} roughness={0.2} transparent={transparent} opacity={opacity} />
      </mesh>
    );
  }

  // Grid layout
  const wCount = Math.round(width);
  const lCount = Math.round(length);
  const isCorner = shape === 'corner';
  const studs = [];

  for (let i = 0; i < wCount; i++) {
    for (let j = 0; j < lCount; j++) {
      // Skip the "missing" corner stud for L-shapes
      if (isCorner && i === wCount - 1 && j === lCount - 1) continue;

      // For wedge_plate (triangular), skip studs that fall outside the triangle
      if (shape === 'wedge_plate') {
        const normalizedX = i / (wCount - 1 || 1);
        const normalizedZ = j / (lCount - 1 || 1);
        if (normalizedX + normalizedZ > 1.1) continue;
      }

      const xOffset = i - (wCount - 1) / 2;
      const zOffset = j - (lCount - 1) / 2;

      studs.push(
        <mesh key={`${i}-${j}`} position={[xOffset, y, zOffset]}>
          <cylinderGeometry args={[STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16]} />
          <meshStandardMaterial color={hexColor} roughness={0.2} transparent={transparent} opacity={opacity} />
        </mesh>,
      );
    }
  }

  return <group>{studs}</group>;
}
