'use client';

import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useRouter } from 'next/navigation';
import { DashboardBrick } from './DashboardBrick';
import type { DashboardBrickDef } from './dashboard-layouts';

const HOVER_SCALE = 1.03;
const LERP_SPEED = 8;

interface DashboardStructureProps {
  layout: DashboardBrickDef[];
  href: string;
  label: string;
  subtitle: string;
  glowColor: string;
  groupPosition: [number, number, number];
}

export function DashboardStructure({ layout, href, label, subtitle, glowColor, groupPosition }: DashboardStructureProps) {
  const router = useRouter();
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const currentScale = useRef(1);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = hovered ? HOVER_SCALE : 1;
    currentScale.current = THREE.MathUtils.lerp(currentScale.current, target, LERP_SPEED * delta);
    const s = currentScale.current;
    groupRef.current.scale.set(s, s, s);
  });

  const handleClick = () => {
    router.push(href);
  };

  const handlePointerOver = (e: THREE.Event) => {
    (e as { stopPropagation?: () => void }).stopPropagation?.();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'default';
  };

  const emissive = hovered ? glowColor : '#000000';
  const emissiveIntensity = hovered ? 0.3 : 0;

  return (
    <group ref={groupRef} position={groupPosition} onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
      {layout.map((def, i) => (
        <DashboardBrick key={i} def={def} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      ))}

      {/* Floating label */}
      <Html position={[0, 5.5, 0]} center distanceFactor={15} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
          <span className="text-white font-bold text-sm drop-shadow-lg">{label}</span>
          <span className="text-slate-400 text-[10px] drop-shadow-md">{subtitle}</span>
        </div>
      </Html>
    </group>
  );
}
