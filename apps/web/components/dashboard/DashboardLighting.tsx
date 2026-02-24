'use client';

import { useMemo } from 'react';

const useShadowSize = () =>
  useMemo(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 1024 : 2048), []);

export function DashboardLighting() {
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
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-bias={-0.001}
      />

      {/* Fill light — cool */}
      <directionalLight position={[-8, 12, -8]} intensity={0.4} color="#e0e7ff" />
    </>
  );
}
