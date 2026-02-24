'use client';

export function WorkshopWalls() {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 1.5, -10]}>
        <boxGeometry args={[20, 3, 0.15]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.7} metalness={0.15} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-10, 1.5, 0]}>
        <boxGeometry args={[0.15, 3, 20]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.7} metalness={0.15} />
      </mesh>

      {/* Wall accent strip — back (LEGO amber) */}
      <mesh position={[0, 0.05, -9.9]}>
        <boxGeometry args={[20, 0.1, 0.05]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Wall accent strip — left (LEGO amber) */}
      <mesh position={[-9.9, 0.05, 0]}>
        <boxGeometry args={[0.05, 0.1, 20]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Workshop sign on back wall */}
      <mesh position={[0, 2.5, -9.85]}>
        <boxGeometry args={[4, 0.6, 0.05]} />
        <meshStandardMaterial
          color="#1e293b"
          emissive="#fbbf24"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}
