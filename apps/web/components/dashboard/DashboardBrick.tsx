'use client';

import { memo } from 'react';
import { getBrickHeight } from '@brick-quest/shared';
import { BrickBody } from '../three/BrickBody';
import type { DashboardBrickDef } from './dashboard-layouts';

interface DashboardBrickProps {
  def: DashboardBrickDef;
  emissive?: string;
  emissiveIntensity?: number;
}

export const DashboardBrick = memo(function DashboardBrick({
  def,
  emissive = '#000000',
  emissiveIntensity = 0,
}: DashboardBrickProps) {
  const height = getBrickHeight(def.shape, def.type);
  const [tx, ty, tz] = def.position;
  const finalY = ty + height / 2;

  const rotation: [number, number, number] = def.rotation
    ? [
        def.rotation[0] * (Math.PI / 180),
        def.rotation[1] * (Math.PI / 180),
        def.rotation[2] * (Math.PI / 180),
      ]
    : [0, 0, 0];

  return (
    <group position={[tx, finalY, tz]} rotation={rotation}>
      <BrickBody
        shape={def.shape}
        type={def.type}
        width={def.width}
        height={height}
        length={def.length}
        hexColor={def.color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </group>
  );
});
