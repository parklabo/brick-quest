'use client';

import type { BuildStepBlock } from '@brick-quest/shared';
import { BrickBody } from './BrickBody';

interface LegoBrickProps {
  block: BuildStepBlock;
  isGhost?: boolean;
}

export function LegoBrick({ block, isGhost = false }: LegoBrickProps) {
  const { width, height, length } = block.size;

  return (
    <group
      position={[block.position.x, block.position.y + height / 2, block.position.z]}
      rotation={[
        block.rotation.x * (Math.PI / 180),
        block.rotation.y * (Math.PI / 180),
        block.rotation.z * (Math.PI / 180),
      ]}
    >
      <BrickBody
        shape={block.shape}
        type={block.type}
        width={width}
        height={height}
        length={length}
        hexColor={block.hexColor}
        isGhost={isGhost}
        showStuds={!isGhost}
      />
    </group>
  );
}
