'use client';

import { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations, Text, Billboard } from '@react-three/drei';
import { useTranslations } from 'next-intl';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { usePlayerStore } from '../../lib/stores/player';
import { useProfileStore } from '../../lib/stores/profile';
import { useInventoryStore } from '../../lib/stores/inventory';
import { useTintedClone } from '../../lib/three/use-tinted-clone';
import { useKeyboard } from '../../lib/hooks/use-keyboard';
import { useWorkshopStore } from '../../lib/stores/workshop';
import type { KeyState } from '../../lib/hooks/use-keyboard';
import type { ZoneId } from '../../lib/stores/workshop';

function useIsMobile() {
  return useMemo(() => typeof window !== 'undefined' && window.innerWidth < 768, []);
}

/* ═══════════════════════════════════════════
   Portal zone config
   ═══════════════════════════════════════════ */

interface PortalConfig {
  id: ZoneId;
  position: [number, number, number];
  color: string;
  emissive: string;
  accentColor: string;
}

const PORTALS: PortalConfig[] = [
  { id: 'design', position: [-3.5, 0, -1], color: '#fbbf24', emissive: '#ff9800', accentColor: '#fcd34d' },
  { id: 'mybrick', position: [3.5, 0, -1], color: '#a78bfa', emissive: '#7c3aed', accentColor: '#c4b5fd' },
];

const INTERACT_RADIUS = 2.8;

/* ═══════════════════════════════════════════
   Notice board — clickable, opens modal
   ═══════════════════════════════════════════ */

function NoticeBoard() {
  const [hovered, setHovered] = useState(false);
  const pinRef = useRef<THREE.Mesh>(null);
  const openNotice = useWorkshopStore((s) => s.openNotice);
  const t = useTranslations('dashboard');

  // Subtle pin glow animation
  useFrame((state) => {
    if (pinRef.current) {
      const mat = pinRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }
  });

  return (
    <group
      position={[-6.95, 1.4, 0]}
      rotation={[0, Math.PI / 2, 0]}
      onClick={openNotice}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
    >
      {/* Cork board frame */}
      <mesh>
        <boxGeometry args={[2.4, 1.5, 0.06]} />
        <meshStandardMaterial color={hovered ? '#6B4226' : '#5C4033'} roughness={0.5} />
      </mesh>
      {/* Cork surface */}
      <mesh position={[0, 0, 0.035]}>
        <boxGeometry args={[2.1, 1.2, 0.02]} />
        <meshStandardMaterial color={hovered ? '#C4A050' : '#B8941E'} roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Paper note 1 — slightly rotated */}
      <group position={[-0.45, 0.2, 0.05]} rotation={[0, 0, 0.05]}>
        <mesh>
          <boxGeometry args={[0.8, 0.6, 0.005]} />
          <meshStandardMaterial color="#FFFEF0" roughness={0.9} />
        </mesh>
        <Text position={[0, 0.18, 0.005]} fontSize={0.08} color="#333333" anchorX="center" anchorY="middle" fontWeight="bold">
          {t('noticeItem1Title')}
        </Text>
        {/* Red pin */}
        <mesh ref={pinRef} position={[0, 0.25, 0.01]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.4} />
        </mesh>
      </group>
      {/* Paper note 2 */}
      <group position={[0.45, 0.15, 0.05]} rotation={[0, 0, -0.03]}>
        <mesh>
          <boxGeometry args={[0.75, 0.55, 0.005]} />
          <meshStandardMaterial color="#FFF8E1" roughness={0.9} />
        </mesh>
        <Text position={[0, 0.16, 0.005]} fontSize={0.07} color="#333333" anchorX="center" anchorY="middle" fontWeight="bold">
          {t('noticeItem3Title')}
        </Text>
        {/* Yellow pin */}
        <mesh position={[0, 0.22, 0.01]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#FBBF24" emissive="#FBBF24" emissiveIntensity={0.3} />
        </mesh>
      </group>
      {/* Paper note 3 — bottom */}
      <group position={[0, -0.3, 0.05]} rotation={[0, 0, 0.02]}>
        <mesh>
          <boxGeometry args={[0.9, 0.45, 0.005]} />
          <meshStandardMaterial color="#F0F4FF" roughness={0.9} />
        </mesh>
        <Text position={[0, 0.1, 0.005]} fontSize={0.07} color="#1a237e" anchorX="center" anchorY="middle" fontWeight="bold">
          {t('noticeItem2Title')}
        </Text>
        {/* Blue pin */}
        <mesh position={[0, 0.17, 0.01]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#3B82F6" emissive="#3B82F6" emissiveIntensity={0.3} />
        </mesh>
      </group>
      {/* Board label */}
      <mesh position={[0, -0.68, 0.04]}>
        <boxGeometry args={[0.8, 0.18, 0.02]} />
        <meshStandardMaterial color="#3A2A1A" roughness={0.4} />
      </mesh>
      <Text position={[0, -0.68, 0.06]} fontSize={0.09} color="#FFD700" anchorX="center" anchorY="middle" fontWeight="bold" letterSpacing={0.08}>
        {t('noticeBoard')}
      </Text>
      {/* Hover glow */}
      {hovered && (
        <pointLight position={[0, 0, 0.8]} color="#FBBF24" intensity={0.6} distance={3} decay={2} />
      )}
    </group>
  );
}

/* ═══════════════════════════════════════════
   Logo sculpture — Sword in Stone
   ═══════════════════════════════════════════ */

function LogoSculpture() {
  return (
    <group position={[0, 0, 0]}>
      {/* Pedestal */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[1.0, 1.1, 0.08, 32]} />
        <meshStandardMaterial color="#A89878" roughness={0.7} />
      </mesh>
      {/* Stone base */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[1.4, 0.28, 1.0]} />
        <meshStandardMaterial color="#9CA3AF" roughness={0.85} />
      </mesh>
      <mesh position={[-0.06, 0.48, 0.03]}>
        <boxGeometry args={[1.2, 0.24, 0.85]} />
        <meshStandardMaterial color="#8A9099" roughness={0.85} />
      </mesh>
      <mesh position={[0.03, 0.68, -0.02]}>
        <boxGeometry args={[1.0, 0.18, 0.7]} />
        <meshStandardMaterial color="#7B8290" roughness={0.85} />
      </mesh>
      {/* Sword */}
      <group position={[0, 0.77, 0]} rotation={[0, 0, Math.PI * 0.06]}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.16, 0.6, 0.16]} />
          <meshStandardMaterial color="#FACC15" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[0.65, 0.16, 0.16]} />
          <meshStandardMaterial color="#3B82F6" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[0.16, 1.0, 0.16]} />
          <meshStandardMaterial color="#EF4444" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[0.2, 0.12, 0.2]} />
          <meshStandardMaterial color="#3B82F6" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.9, 0]}>
          <boxGeometry args={[0.12, 0.1, 0.12]} />
          <meshStandardMaterial color="#FACC15" emissive="#FACC15" emissiveIntensity={0.4} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

/* ═══════════════════════════════════════════
   Warp Portal — LEGO brick gate with glowing portal
   ═══════════════════════════════════════════ */

function WarpPortal({
  config,
  playerPos,
}: {
  config: PortalConfig;
  playerPos: React.RefObject<THREE.Vector3>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const portalRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const openZone = useWorkshopStore((s) => s.openZone);
  const setNearStation = useWorkshopStore((s) => s.setNearStation);
  const clearNearStation = useWorkshopStore((s) => s.clearNearStation);
  const nearStation = useWorkshopStore((s) => s.nearStation);
  const wasNearRef = useRef(false);

  const { color, emissive, accentColor, position, id } = config;

  // Animate portal shimmer + ring rotation + proximity detection
  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Portal surface shimmer
    if (portalRef.current) {
      const mat = portalRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.25 + Math.sin(t * 2) * 0.1;
      mat.emissiveIntensity = 0.4 + Math.sin(t * 1.5) * 0.15;
    }

    // Ring rotation
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.5;
      ringRef.current.rotation.z = Math.sin(t * 0.3) * 0.1;
    }

    // Proximity detection
    if (playerPos.current) {
      const dx = playerPos.current.x - position[0];
      const dz = playerPos.current.z - position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      const isNear = dist < INTERACT_RADIUS;

      if (isNear && !wasNearRef.current) {
        setNearStation(id);
      } else if (!isNear && wasNearRef.current && nearStation === id) {
        clearNearStation();
      }
      wasNearRef.current = isNear;
    }
  });

  const handleClick = () => {
    openZone(id);
  };

  return (
    <group ref={groupRef} position={position}>
      {/* ── Base platform ── */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[1.6, 1.8, 0.08, 6]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Base glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[1.4, 1.6, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Left pillar (LEGO bricks stacked) ── */}
      <group position={[-0.7, 0.08, 0]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.45, 0.4, 0.45]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color={accentColor} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[0.45, 0.4, 0.45]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color={accentColor} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[0.45, 0.4, 0.45]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
      </group>

      {/* ── Right pillar ── */}
      <group position={[0.7, 0.08, 0]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.45, 0.4, 0.45]} />
          <meshStandardMaterial color={accentColor} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[0.45, 0.4, 0.45]} />
          <meshStandardMaterial color={accentColor} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[0.45, 0.4, 0.45]} />
          <meshStandardMaterial color={accentColor} roughness={0.35} />
        </mesh>
      </group>

      {/* ── Top arch brick ── */}
      <mesh position={[0, 2.18, 0]}>
        <boxGeometry args={[1.85, 0.35, 0.45]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.15} roughness={0.3} />
      </mesh>

      {/* ── Portal surface (glowing plane) ── */}
      <mesh
        ref={portalRef}
        position={[0, 1.2, 0]}
        onClick={handleClick}
        onPointerOver={(e) => { setHovered(true); document.body.style.cursor = 'pointer'; e.stopPropagation(); }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <planeGeometry args={[1.1, 1.9]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.4}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── Spinning torus ring around portal ── */}
      <mesh ref={ringRef} position={[0, 1.2, 0]}>
        <torusGeometry args={[0.85, 0.03, 8, 32]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={emissive}
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* ── Orbiting small bricks ── */}
      <OrbitingBrick center={[0, 1.2, 0]} radius={1.1} speed={0.8} offset={0} color={color} />
      <OrbitingBrick center={[0, 1.2, 0]} radius={1.1} speed={0.8} offset={Math.PI} color={accentColor} />
      <OrbitingBrick center={[0, 1.6, 0]} radius={0.9} speed={-0.6} offset={Math.PI / 2} color={color} />

      {/* ── Point light for atmosphere ── */}
      <pointLight
        position={[0, 1.2, 0.5]}
        color={emissive}
        intensity={hovered ? 2.5 : 1.5}
        distance={5}
        decay={2}
      />

      {/* ── Hover glow boost ── */}
      {hovered && (
        <pointLight
          position={[0, 1.2, -0.5]}
          color={accentColor}
          intensity={1.5}
          distance={4}
          decay={2}
        />
      )}
    </group>
  );
}

function OrbitingBrick({
  center,
  radius,
  speed,
  offset,
  color,
}: {
  center: [number, number, number];
  radius: number;
  speed: number;
  offset: number;
  color: string;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed + offset;
    ref.current.position.x = center[0] + Math.cos(t) * radius;
    ref.current.position.y = center[1] + Math.sin(t * 1.5) * 0.15;
    ref.current.position.z = center[2] + Math.sin(t) * radius;
    ref.current.rotation.x = t * 2;
    ref.current.rotation.z = t * 1.3;
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.12, 0.08, 0.12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
    </mesh>
  );
}

/* ═══════════════════════════════════════════
   Movable character (WASD)
   ═══════════════════════════════════════════ */

const IDLE_CANDIDATES = ['Idle', 'Idle_Loop', 'Unarmed_Idle'];
const WALK_CANDIDATES = ['Walking_A', 'Walk', 'Walking', 'Walk_Fwd_Loop', 'Run', 'Running', 'Jog_Fwd_Loop'];
const MOVE_SPEED = 4;
const BOUNDS = { min: -5.5, max: 5.5 };
const MODEL_SCALE = 0.42;

function findAnim(
  actions: Record<string, THREE.AnimationAction | null>,
  candidates: string[],
): THREE.AnimationAction | null {
  for (const candidate of candidates) {
    for (const [name, action] of Object.entries(actions)) {
      if (!action) continue;
      const stripped = name.includes('|') ? name.split('|').pop()! : name;
      if (stripped === candidate || name === candidate) return action;
    }
  }
  for (const candidate of candidates) {
    for (const [name, action] of Object.entries(actions)) {
      if (action && name.toLowerCase().includes(candidate.toLowerCase())) return action;
    }
  }
  return null;
}

function CharacterModel({ modelUrl, bodyColor, isMoving }: { modelUrl: string; bodyColor: string; isMoving: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(modelUrl);
  const clonedScene = useTintedClone(scene, modelUrl, bodyColor, 0.35);
  const { actions, mixer } = useAnimations(animations, groupRef);
  const prevAnimRef = useRef<string | null>(null);

  const resolvedAnim = useMemo(() => {
    return isMoving ? findAnim(actions, WALK_CANDIDATES) : findAnim(actions, IDLE_CANDIDATES);
  }, [isMoving, actions]);

  useEffect(() => {
    const animName = resolvedAnim?.getClip().name ?? null;
    if (animName === prevAnimRef.current) return;
    prevAnimRef.current = animName;

    if (!resolvedAnim) {
      const fallback = findAnim(actions, IDLE_CANDIDATES);
      if (fallback) fallback.reset().fadeIn(0.3).play();
      return;
    }

    Object.values(actions).forEach((a) => {
      if (a && a !== resolvedAnim && a.isRunning()) a.fadeOut(0.3);
    });
    resolvedAnim.reset().fadeIn(0.3).play();
  }, [resolvedAnim, actions]);

  useFrame((_, delta) => { mixer.update(delta); });

  return (
    <group ref={groupRef} scale={MODEL_SCALE}>
      <primitive object={clonedScene} />
    </group>
  );
}

function CharacterFallback() {
  return (
    <>
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.2, 0.4, 8, 16]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.4} />
      </mesh>
    </>
  );
}

function MovableCharacter({
  keysRef,
  posRef,
}: {
  keysRef: React.RefObject<KeyState>;
  posRef: React.RefObject<THREE.Vector3>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRotation = useRef(0);
  const isMovingRef = useRef(false);
  const [isMoving, setIsMoving] = useState(false);
  const camera = useThree((s) => s.camera);

  const modelUrl = usePlayerStore((s) => s.modelUrl);
  const bodyColor = usePlayerStore((s) => s.bodyColor);

  useFrame((_, delta) => {
    if (!groupRef.current || !keysRef.current) return;
    const keys = keysRef.current;

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    let dx = 0;
    let dz = 0;
    if (keys.forward) { dx += fwd.x; dz += fwd.z; }
    if (keys.backward) { dx -= fwd.x; dz -= fwd.z; }
    if (keys.left) { dx -= right.x; dz -= right.z; }
    if (keys.right) { dx += right.x; dz += right.z; }

    const len = Math.sqrt(dx * dx + dz * dz);
    const moving = len > 0;

    if (moving !== isMovingRef.current) {
      isMovingRef.current = moving;
      setIsMoving(moving);
    }

    if (moving) {
      dx /= len;
      dz /= len;

      const pos = groupRef.current.position;
      pos.x += dx * MOVE_SPEED * delta;
      pos.z += dz * MOVE_SPEED * delta;
      pos.x = Math.max(BOUNDS.min, Math.min(BOUNDS.max, pos.x));
      pos.z = Math.max(BOUNDS.min, Math.min(BOUNDS.max, pos.z));

      targetRotation.current = Math.atan2(dx, dz);
    }

    // Update shared position ref for portal proximity detection
    if (groupRef.current && posRef.current) {
      posRef.current.copy(groupRef.current.position);
    }

    // Smooth rotation
    const currentY = groupRef.current.rotation.y;
    const diff = targetRotation.current - currentY;
    const wrapped = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
    groupRef.current.rotation.y += wrapped * 8 * delta;
  });

  const openProfile = useWorkshopStore((s) => s.openProfile);
  const displayName = useProfileStore((s) => s.profile?.displayName) || 'Builder';
  const [hovered, setHovered] = useState(false);

  return (
    <group
      ref={groupRef}
      position={[0, 0, 2]}
      onClick={(e) => { e.stopPropagation(); openProfile(); }}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
    >
      {/* Username tooltip on hover */}
      {hovered && (
        <Billboard position={[0, 1.15, 0]}>
          {/* Tag background */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[displayName.length * 0.08 + 0.2, 0.18]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.65} />
          </mesh>
          <Text fontSize={0.1} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold">
            {displayName}
          </Text>
        </Billboard>
      )}
      {/* Hover glow ring */}
      {hovered && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.3, 0.5, 24]} />
          <meshBasicMaterial color={bodyColor} transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Hover point light */}
      {hovered && (
        <pointLight position={[0, 0.8, 0]} color={bodyColor} intensity={1.5} distance={3} decay={2} />
      )}
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.3, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.15} />
      </mesh>
      <Suspense fallback={<CharacterFallback />}>
        <CharacterModel modelUrl={modelUrl} bodyColor={bodyColor} isMoving={isMoving} />
      </Suspense>
    </group>
  );
}

/* ═══════════════════════════════════════════
   Inventory display — 3D info board near mybrick portal
   ═══════════════════════════════════════════ */

function InventoryDisplay() {
  const parts = useInventoryStore((s) => s.parts);
  const t = useTranslations('dashboard');
  const totalBricks = parts.reduce((sum, p) => sum + p.count, 0);
  const uniqueTypes = parts.length;

  if (totalBricks === 0) return null;

  // Floor display in front of mybrick portal
  return (
    <group position={[3.5, 0.01, 2.8]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Background panel on floor */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[3.2, 1.2]} />
        <meshBasicMaterial color="#1a1028" transparent opacity={0.7} />
      </mesh>
      {/* Border */}
      <mesh position={[0, 0, -0.006]}>
        <planeGeometry args={[3.4, 1.35]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.2} />
      </mesh>
      {/* Brick count — left */}
      <Text
        position={[-0.8, 0.12, 0.001]}
        fontSize={0.45}
        color="#f87171"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {String(totalBricks)}
      </Text>
      <Text
        position={[-0.8, -0.28, 0.001]}
        fontSize={0.16}
        color="#c4b5d0"
        anchorX="center"
        anchorY="middle"
      >
        {t('totalBricks')}
      </Text>
      {/* Divider */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[0.03, 0.8]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.5} />
      </mesh>
      {/* Parts count — right */}
      <Text
        position={[0.8, 0.12, 0.001]}
        fontSize={0.45}
        color="#60a5fa"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {String(uniqueTypes)}
      </Text>
      <Text
        position={[0.8, -0.28, 0.001]}
        fontSize={0.16}
        color="#c4b5d0"
        anchorX="center"
        anchorY="middle"
      >
        {t('uniqueParts')}
      </Text>
    </group>
  );
}

/* ═══════════════════════════════════════════
   Floor zone styling
   ═══════════════════════════════════════════ */

function ZoneFloor() {
  return (
    <>
      {/* Left zone floor (amber tint) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.5, 0.003, -0.5]}>
        <planeGeometry args={[6.5, 13]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.035} />
      </mesh>
      {/* Right zone floor (purple tint) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.5, 0.003, -0.5]}>
        <planeGeometry args={[6.5, 13]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.035} />
      </mesh>
      {/* Center path — stone walkway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[0.8, 13]} />
        <meshStandardMaterial color="#B0A898" roughness={0.8} />
      </mesh>
      {/* Stone path details */}
      {[-4.5, -3, -1.5, 0, 1.5, 3, 4.5].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, z]}>
          <planeGeometry args={[0.75, 0.06]} />
          <meshStandardMaterial color="#9A9080" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════
   Scene composition
   ═══════════════════════════════════════════ */

function WorkshopContent({ keysRef }: { keysRef: React.RefObject<KeyState> }) {
  const playerPosRef = useRef(new THREE.Vector3(0, 0, 2));
  const t = useTranslations('dashboard');

  return (
    <>
      {/* ── Lighting — warm workshop ── */}
      <ambientLight intensity={0.55} color="#FFF5E6" />
      <hemisphereLight color="#FFF0D0" groundColor="#C4A870" intensity={0.35} />
      <directionalLight position={[8, 14, 6]} intensity={1.6} color="#FFF5E0" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-6, 10, -8]} intensity={0.35} color="#E8E0D4" />

      {/* ── Floor ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#C4B590" roughness={0.75} />
      </mesh>
      <gridHelper args={[14, 14, '#B8A578', '#A89868']} position={[0, 0.005, 0]} />

      {/* ── Zone floor tints + center path ── */}
      <ZoneFloor />

      {/* ── Walls (back + left, flush with floor edge) ── */}
      <mesh position={[0, 1.2, -7.05]}>
        <boxGeometry args={[14.2, 2.4, 0.1]} />
        <meshStandardMaterial color="#DDD5C8" roughness={0.85} />
      </mesh>
      <mesh position={[-7.05, 1.2, 0]}>
        <boxGeometry args={[0.1, 2.4, 14.2]} />
        <meshStandardMaterial color="#DDD5C8" roughness={0.85} />
      </mesh>
      {/* Baseboard accent */}
      <mesh position={[0, 0.06, -6.97]}>
        <boxGeometry args={[14.2, 0.12, 0.04]} />
        <meshStandardMaterial color="#A08060" />
      </mesh>
      <mesh position={[-6.97, 0.06, 0]}>
        <boxGeometry args={[0.04, 0.12, 14.2]} />
        <meshStandardMaterial color="#A08060" />
      </mesh>

      {/* ── Back wall (정면): Hackathon + Park Labs only ── */}
      {/* Hackathon sponsor banner — back wall left */}
      <group position={[-3, 1.5, -6.95]}>
        {/* Outer frame */}
        <mesh>
          <boxGeometry args={[3.6, 1.8, 0.06]} />
          <meshStandardMaterial color="#1a237e" roughness={0.3} metalness={0.3} />
        </mesh>
        {/* Inner surface */}
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[3.3, 1.55, 0.02]} />
          <meshStandardMaterial color="#0d1440" roughness={0.2} />
        </mesh>
        {/* Google Cloud colors — top accent bar */}
        <mesh position={[-1.24, 0.7, 0.05]}>
          <boxGeometry args={[0.82, 0.07, 0.01]} />
          <meshStandardMaterial color="#EA4335" emissive="#EA4335" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[-0.41, 0.7, 0.05]}>
          <boxGeometry args={[0.82, 0.07, 0.01]} />
          <meshStandardMaterial color="#FBBC05" emissive="#FBBC05" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.41, 0.7, 0.05]}>
          <boxGeometry args={[0.82, 0.07, 0.01]} />
          <meshStandardMaterial color="#34A853" emissive="#34A853" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[1.24, 0.7, 0.05]}>
          <boxGeometry args={[0.82, 0.07, 0.01]} />
          <meshStandardMaterial color="#4285F4" emissive="#4285F4" emissiveIntensity={0.5} />
        </mesh>
        <Text position={[0, 0.38, 0.055]} fontSize={0.2} color="#FFFFFF" anchorX="center" anchorY="middle" fontWeight="bold" letterSpacing={0.03}>
          第4回 Agentic AI Hackathon
        </Text>
        <Text position={[0, 0.1, 0.055]} fontSize={0.16} color="#8AB4F8" anchorX="center" anchorY="middle" letterSpacing={0.03}>
          with Google Cloud
        </Text>
        <mesh position={[0, -0.08, 0.05]}>
          <boxGeometry args={[2.4, 0.012, 0.005]} />
          <meshStandardMaterial color="#4285F4" emissive="#4285F4" emissiveIntensity={0.4} />
        </mesh>
        <Text position={[0, -0.28, 0.055]} fontSize={0.11} color="#AAAAAA" anchorX="center" anchorY="middle">
          Sponsored by
        </Text>
        <Text position={[0, -0.52, 0.055]} fontSize={0.24} color="#3EA8FF" anchorX="center" anchorY="middle" fontWeight="bold" letterSpacing={0.08}>
          Zenn
        </Text>
        <pointLight position={[0, 0, 1]} color="#4285F4" intensity={0.8} distance={4} decay={2} />
      </group>

      {/* Park Labs banner — back wall right */}
      <group position={[3, 1.5, -6.95]}>
        <mesh>
          <boxGeometry args={[3.6, 1.8, 0.06]} />
          <meshStandardMaterial color="#2A2A2A" roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[3.3, 1.55, 0.02]} />
          <meshStandardMaterial color="#111111" roughness={0.2} />
        </mesh>
        {/* Top accent line */}
        <mesh position={[0, 0.7, 0.05]}>
          <boxGeometry args={[3.3, 0.05, 0.005]} />
          <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.5} />
        </mesh>
        <Text position={[0, 0.3, 0.055]} fontSize={0.28} color="#FFFFFF" anchorX="center" anchorY="middle" fontWeight="bold" letterSpacing={0.06}>
          Park Labs
        </Text>
        <Text position={[0, -0.05, 0.055]} fontSize={0.13} color="#9CA3AF" anchorX="center" anchorY="middle" letterSpacing={0.02}>
          park-labs.com
        </Text>
        <mesh position={[0, -0.28, 0.05]}>
          <boxGeometry args={[2.0, 0.01, 0.005]} />
          <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.3} />
        </mesh>
        <Text position={[0, -0.45, 0.055]} fontSize={0.09} color="#6B7280" anchorX="center" anchorY="middle" letterSpacing={0.02}>
          AI Research &amp; Development
        </Text>
        <pointLight position={[0, 0, 1]} color="#10B981" intensity={0.6} distance={4} decay={2} />
      </group>

      {/* ── Left wall: Notice board (clickable) ── */}
      <NoticeBoard />

      {/* ── Portal floor labels (engraved text) ── */}
      <Text
        position={[-3.5, 0.02, 1.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.3}
        color="#8B7355"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        fontWeight="bold"
      >
        {t('designZone')}
      </Text>
      <Text
        position={[3.5, 0.02, 1.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.3}
        color="#6B5B8D"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        fontWeight="bold"
      >
        {t('myBrickZone')}
      </Text>

      {/* ── Inventory display near mybrick portal ── */}
      <InventoryDisplay />

      {/* ── Center: Logo sculpture ── */}
      <LogoSculpture />

      {/* ── Character ── */}
      <MovableCharacter keysRef={keysRef} posRef={playerPosRef} />

      {/* ── Warp Portals ── */}
      {PORTALS.map((p) => (
        <WarpPortal key={p.id} config={p} playerPos={playerPosRef} />
      ))}

      {/* ── Camera controls ── */}
      <OrbitControls
        target={[0, 0.5, 0]}
        enableRotate
        enablePan
        minZoom={15}
        maxZoom={90}
        maxPolarAngle={Math.PI / 2.2}
        panSpeed={0.5}
        rotateSpeed={0.5}
      />
    </>
  );
}

/* ═══════════════════════════════════════════
   Virtual joystick (mobile)
   ═══════════════════════════════════════════ */

const JOYSTICK_RADIUS = 38;
const JOYSTICK_DEADZONE = 8;

function VirtualJoystick({ keysRef }: { keysRef: React.RefObject<KeyState> }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [thumbPos, setThumbPos] = useState({ x: 0, y: 0 });
  const originRef = useRef({ x: 0, y: 0 });
  const activeRef = useRef(false);

  const resetKeys = () => {
    if (!keysRef.current) return;
    keysRef.current.forward = false;
    keysRef.current.backward = false;
    keysRef.current.left = false;
    keysRef.current.right = false;
  };

  const updateFromTouch = (clientX: number, clientY: number) => {
    const dx = clientX - originRef.current.x;
    const dy = clientY - originRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const nx = clamped * Math.cos(angle);
    const ny = clamped * Math.sin(angle);

    setThumbPos({ x: nx, y: ny });

    if (!keysRef.current) return;
    if (dist > JOYSTICK_DEADZONE) {
      const normX = nx / JOYSTICK_RADIUS;
      const normY = ny / JOYSTICK_RADIUS;
      keysRef.current.forward = normY < -0.3;
      keysRef.current.backward = normY > 0.3;
      keysRef.current.left = normX < -0.3;
      keysRef.current.right = normX > 0.3;
    } else {
      resetKeys();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const rect = baseRef.current!.getBoundingClientRect();
    originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    activeRef.current = true;
    updateFromTouch(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!activeRef.current) return;
    e.stopPropagation();
    updateFromTouch(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    activeRef.current = false;
    setThumbPos({ x: 0, y: 0 });
    resetKeys();
  };

  return (
    <div
      ref={baseRef}
      className="fixed bottom-32 left-5 z-60 w-22 h-22 rounded-full
        bg-black/15 backdrop-blur-sm border border-black/10 touch-none select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className="absolute top-1/2 left-1/2 w-9 h-9 rounded-full
          bg-black/25 border border-black/15"
        style={{
          transform: `translate(calc(-50% + ${thumbPos.x}px), calc(-50% + ${thumbPos.y}px))`,
          transition: activeRef.current ? 'none' : 'transform 0.15s ease-out',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Root export
   ═══════════════════════════════════════════ */

export default function WorkshopScene() {
  const isMobile = useIsMobile();
  const keysRef = useKeyboard();

  return (
    <>
      <Canvas
        dpr={[1, isMobile ? 1 : 1.5]}
        orthographic
        camera={{
          zoom: isMobile ? 40 : 55,
          position: [8, 8, 8],
          near: -1000,
          far: 1000,
        }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={['#E8DED2']} />
        <fog attach="fog" args={['#E8DED2', 20, 45]} />
        <WorkshopContent keysRef={keysRef} />
        {!isMobile && (
          <EffectComposer>
            <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.9} intensity={0.15} mipmapBlur />
            <Vignette offset={0.4} darkness={0.3} />
          </EffectComposer>
        )}
      </Canvas>
      {isMobile && <VirtualJoystick keysRef={keysRef} />}
    </>
  );
}
