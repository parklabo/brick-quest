'use client';

export function WorkshopLighting() {
  return (
    <>
      {/* Ambient */}
      <ambientLight intensity={0.6} color="#d4d4d8" />

      {/* Hemisphere fill */}
      <hemisphereLight
        color="#e0e7ff"
        groundColor="#2d1b4e"
        intensity={0.4}
      />

      {/* Main sun — no shadows for performance */}
      <directionalLight
        position={[8, 15, 8]}
        intensity={1.8}
        color="#fff8f0"
      />

      {/* Fill light */}
      <directionalLight
        position={[-6, 10, -6]}
        intensity={0.3}
        color="#e0e7ff"
      />
    </>
  );
}
