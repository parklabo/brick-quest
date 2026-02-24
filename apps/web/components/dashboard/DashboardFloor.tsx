'use client';

import { BorderLines } from '../three/BorderLines';

const BASEPLATE_SIZE = 16;

export function DashboardFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[BASEPLATE_SIZE, BASEPLATE_SIZE]} />
        <meshStandardMaterial color="#2d5a27" roughness={0.8} metalness={0.05} />
      </mesh>

      <gridHelper
        args={[BASEPLATE_SIZE, BASEPLATE_SIZE, '#3a7a32', '#336a2c']}
        position={[0, 0.01, 0]}
      />

      <gridHelper
        args={[BASEPLATE_SIZE, BASEPLATE_SIZE * 2, '#2a5a24', '#2a5a24']}
        position={[0, 0.005, 0]}
      />

      <BorderLines size={BASEPLATE_SIZE} />
    </group>
  );
}
