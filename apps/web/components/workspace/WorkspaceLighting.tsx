'use client';

import { useMemo } from 'react';

const useShadowSize = () => useMemo(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 1024 : 2048), []);

export function WorkspaceLighting() {
  const shadowSize = useShadowSize();

  return (
    <>
      <ambientLight intensity={0.8} color="#f8fafc" />
      <hemisphereLight color="#f0f4ff" groundColor="#d4c8a8" intensity={0.5} />

      {/* Main sun */}
      <directionalLight
        position={[15, 25, 15]}
        intensity={1.8}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={0.1}
        shadow-camera-far={80}
        shadow-bias={-0.001}
      />

      {/* Fill light — cool */}
      <directionalLight position={[-10, 15, -10]} intensity={0.4} color="#e0e7ff" />

      {/* Top-down fill */}
      <directionalLight position={[0, 20, 0]} intensity={0.3} color="#f5f5f5" />

      {/* Soft point accent */}
      <pointLight position={[0, 10, -15]} intensity={0.3} color="#f5f5f5" distance={40} />
    </>
  );
}
