'use client';

export function WorkshopFurniture() {
  return (
    <group>
      {/* Workbench — LEGO-themed desk */}
      <Workbench position={[0, 0, -7]} />

      {/* Brick display shelves */}
      <BrickShelf position={[7, 0, -5]} />
      <BrickShelf position={[-8, 0, -3]} />

      {/* Decorations */}
      <Plant position={[-8, 0, -8]} />
      <Plant position={[7, 0, -8]} />
      <Plant position={[-8, 0, 5]} />
      <Plant position={[7, 0, 5]} />

      {/* Central workshop rug */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2, 32]} />
        <meshStandardMaterial color="#2a3a4a" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function Workbench({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Tabletop */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[2.5, 0.08, 1.2]} />
        <meshStandardMaterial color="#8B4513" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* LEGO accent strip on top */}
      <mesh position={[0, 0.895, 0]}>
        <boxGeometry args={[2.3, 0.02, 0.1]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.4} />
      </mesh>
      {/* 4 legs */}
      {[
        [-1.0, -0.4],
        [1.0, -0.4],
        [-1.0, 0.4],
        [1.0, 0.4],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x!, 0.42, z!]}>
          <boxGeometry args={[0.08, 0.84, 0.08]} />
          <meshStandardMaterial color="#6b5b4f" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function BrickShelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Frame */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.8, 2, 0.35]} />
        <meshStandardMaterial color="#44403c" roughness={0.8} />
      </mesh>
      {/* Colored "brick" books on shelves */}
      {[0.6, 1.0, 1.4].map((y, i) => (
        <mesh key={i} position={[0, y, 0.05]}>
          <boxGeometry args={[0.65, 0.25, 0.22]} />
          <meshStandardMaterial color={['#E84C38', '#0D69AC', '#4ade80', '#fbbf24'][i]} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pot */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 8]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      {/* Foliage */}
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#22c55e" roughness={0.7} />
      </mesh>
      <mesh position={[0.15, 0.75, 0.1]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#4ade80" roughness={0.7} />
      </mesh>
    </group>
  );
}
