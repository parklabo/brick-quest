'use client';

import { useMemo } from 'react';

const useShadowSize = () =>
  useMemo(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 1024 : 2048), []);

export function WorkspaceLighting() {
  const shadowSize = useShadowSize();

  return (
    <>
      <ambientLight intensity={0.5} color="#d4d4d8" />

      {/* Main sun */}
      <directionalLight
        position={[10, 20, 10]}
        intensity={2.0}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-bias={-0.001}
      />

      {/* Fill light — cool */}
      <directionalLight position={[-8, 12, -8]} intensity={0.4} color="#e0e7ff" />

      {/* Top-down fill */}
      <directionalLight position={[0, 15, 0]} intensity={0.3} color="#f5f5f5" />

      {/* Cool accent */}
      <pointLight position={[0, 8, -12]} intensity={0.3} color="#93c5fd" distance={16} decay={2} />

      {/* Warm accent */}
      <pointLight position={[8, 5, 6]} intensity={0.2} color="#fbbf24" distance={10} decay={2} />
    </>
  );
}
