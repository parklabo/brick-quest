'use client';

import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useWorkshopStore } from '../../lib/stores/workshop';
import {
  STATION_CYLINDER,
  STATION_GLOW_RING,
  STATION_PORTAL_SPHERE,
} from '../../lib/three/shared-geometries';
import { DashboardBrick } from './DashboardBrick';
import type { DashboardBrickDef } from './dashboard-layouts';

const INTERACT_RADIUS = 2.5;
const HOVER_SCALE = 1.03;
const LERP_SPEED = 8;

export interface StationConfig {
  id: string;
  label: string;
  subtitle: string;
  href: string;
  color: string;
  position: [number, number, number];
  layout: DashboardBrickDef[];
  layoutOffset: [number, number, number];
}

interface WorkshopStationProps {
  config: StationConfig;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  onNavigate: (href: string) => void;
}

const _stationPos = new THREE.Vector3();

export function WorkshopStation({ config, playerPos, onNavigate }: WorkshopStationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const currentScale = useRef(1);
  const wasNear = useRef(false);

  const setNearStation = useWorkshopStore((s) => s.setNearStation);
  const clearNearStation = useWorkshopStore((s) => s.clearNearStation);
  const nearStation = useWorkshopStore((s) => s.nearStation);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Proximity detection
    _stationPos.set(config.position[0], 0, config.position[2]);
    const dist = playerPos.current.distanceTo(_stationPos);
    const isNear = dist < INTERACT_RADIUS;

    if (isNear && !wasNear.current) {
      setNearStation(config.id);
    } else if (!isNear && wasNear.current && nearStation === config.id) {
      clearNearStation();
    }
    wasNear.current = isNear;

    // Glow ring pulse
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      const pulse = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
      mat.opacity = isNear || hovered ? pulse + 0.3 : pulse;
    }

    // Hover scale
    const target = hovered || isNear ? HOVER_SCALE : 1;
    currentScale.current = THREE.MathUtils.lerp(
      currentScale.current,
      target,
      LERP_SPEED * delta,
    );
    const s = currentScale.current;
    groupRef.current.scale.set(s, s, s);
  });

  const handleClick = () => {
    onNavigate(config.href);
  };

  return (
    <group ref={groupRef} position={config.position}>
      {/* Base platform */}
      <mesh position={[0, 0.05, 0]} geometry={STATION_CYLINDER}>
        <meshStandardMaterial color="#1a1a2e" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Glow ring */}
      <mesh
        ref={glowRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.12, 0]}
        geometry={STATION_GLOW_RING}
      >
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Portal core */}
      <mesh
        position={[0, 0.8, 0]}
        geometry={STATION_PORTAL_SPHERE}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <meshStandardMaterial
          color={config.color}
          emissive={config.color}
          emissiveIntensity={hovered ? 0.8 : 0.4}
          transparent
          opacity={0.7}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>

      {/* Point light */}
      <pointLight
        position={[0, 1.0, 0]}
        intensity={hovered ? 2.0 : 1.0}
        color={config.color}
        distance={4}
        decay={2}
      />

      {/* Brick structure on station */}
      <group position={config.layoutOffset}>
        {config.layout.map((def, i) => (
          <DashboardBrick
            key={i}
            def={def}
            emissive={hovered ? config.color : '#000000'}
            emissiveIntensity={hovered ? 0.2 : 0}
          />
        ))}
      </group>

      {/* Floating label — clickable */}
      <Html
        position={[0, 4.5, 0]}
        center
        distanceFactor={15}
        style={{ userSelect: 'none' }}
      >
        <button
          onClick={handleClick}
          className="flex flex-col items-center gap-0.5 whitespace-nowrap cursor-pointer
            bg-black/50 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-1.5
            hover:bg-white/15 hover:border-white/40 transition-colors"
        >
          <span className="text-white font-bold text-sm drop-shadow-lg">
            {config.label}
          </span>
          <span className="text-slate-400 text-[10px] drop-shadow-md">
            {config.subtitle}
          </span>
        </button>
      </Html>
    </group>
  );
}
