'use client';

import { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Billboard, Text } from '@react-three/drei';
import { usePlayerStore } from '../../lib/stores/player';
import { useProfileStore } from '../../lib/stores/profile';
import { useTintedClone } from '../../lib/three/use-tinted-clone';
import {
  SHADOW_CIRCLE_LG,
  SELECT_RING_LG,
  STATUS_SPHERE_PLAYER,
  CLICK_SPHERE,
} from '../../lib/three/shared-geometries';
import type { KeyState } from '../../lib/hooks/use-keyboard';

const MOVE_SPEED = 5;
const BOUNDS = { min: -9, max: 9 };
const MODEL_SCALE = 0.42;

const IDLE_CANDIDATES = ['Idle', 'Idle_Loop', 'Unarmed_Idle'];
const WALK_CANDIDATES = [
  'Walking_A', 'Walk', 'Walking', 'Walk_Fwd_Loop',
  'Run', 'Running', 'Jog_Fwd_Loop',
];

interface PlayerCharacterProps {
  onPositionChange: (pos: THREE.Vector3) => void;
  azimuthRef: React.MutableRefObject<number>;
  keysRef: React.MutableRefObject<KeyState>;
}

/* ── Animation helpers ── */

function buildAnimationIndex(actions: Record<string, THREE.AnimationAction | null>) {
  const index = new Map<string, THREE.AnimationAction>();
  for (const [name, action] of Object.entries(actions)) {
    if (!action) continue;
    index.set(name, action);
    // Strip armature prefix: "Armature|Idle" → "Idle"
    const stripped = name.includes('|') ? name.split('|').pop()! : name;
    if (stripped !== name) index.set(stripped, action);
  }
  return index;
}

function findAnimationAction(
  actions: Record<string, THREE.AnimationAction | null>,
  candidates: string[],
  index: Map<string, THREE.AnimationAction>,
): THREE.AnimationAction | null {
  for (const name of candidates) {
    const found = index.get(name);
    if (found) return found;
  }
  // Fallback: substring match
  for (const candidate of candidates) {
    for (const [name, action] of Object.entries(actions)) {
      if (action && name.toLowerCase().includes(candidate.toLowerCase())) {
        return action;
      }
    }
  }
  return null;
}

/* ── Animated GLB model ── */

function PlayerModel({
  isMoving,
  modelUrl,
  bodyColor,
}: {
  isMoving: boolean;
  modelUrl: string;
  bodyColor: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(modelUrl);
  const prevAnimRef = useRef<string | null>(null);

  const clonedScene = useTintedClone(scene, modelUrl, bodyColor, 0.35);
  const { actions, mixer } = useAnimations(animations, groupRef);
  const animIndex = useMemo(() => buildAnimationIndex(actions), [actions]);

  const resolvedAnim = useMemo(() => {
    if (isMoving) {
      return findAnimationAction(actions, WALK_CANDIDATES, animIndex);
    }
    return findAnimationAction(actions, IDLE_CANDIDATES, animIndex);
  }, [isMoving, actions, animIndex]);

  useEffect(() => {
    const animName = resolvedAnim?.getClip().name ?? null;
    if (animName === prevAnimRef.current) return;
    prevAnimRef.current = animName;

    if (!resolvedAnim) {
      const fallback = findAnimationAction(actions, IDLE_CANDIDATES, animIndex);
      if (fallback) fallback.reset().fadeIn(0.3).play();
      return;
    }

    Object.values(actions).forEach((a) => {
      if (a && a !== resolvedAnim && a.isRunning()) {
        a.fadeOut(0.3);
      }
    });

    resolvedAnim.reset().fadeIn(0.3).play();
  }, [resolvedAnim, actions, animIndex]);

  useFrame((_, delta) => {
    mixer.update(delta);
  });

  return (
    <group ref={groupRef} scale={MODEL_SCALE}>
      <primitive object={clonedScene} />
    </group>
  );
}

/* ── Fallback capsule (shown while model loads) ── */

function FallbackBody() {
  const bodyColor = usePlayerStore((s) => s.bodyColor);
  return (
    <>
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.2, 0.4, 8, 16]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.4} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.08, 1.08, 0.17]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#1e1b4b" />
      </mesh>
      <mesh position={[-0.08, 1.08, 0.17]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#1e1b4b" />
      </mesh>
    </>
  );
}

/* ── Main player component ── */

export function PlayerCharacter({
  onPositionChange,
  azimuthRef,
  keysRef,
}: PlayerCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRotation = useRef(0);
  const [isMoving, setIsMoving] = useState(false);
  const isMovingRef = useRef(false);
  const [hovered, setHovered] = useState(false);

  const modelUrl = usePlayerStore((s) => s.modelUrl);
  const bodyColor = usePlayerStore((s) => s.bodyColor);
  const playerName = useProfileStore((s) => s.profile?.displayName ?? 'Builder');

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const keys = keysRef.current;
    const azimuth = azimuthRef.current;

    const forwardX = -Math.sin(azimuth);
    const forwardZ = -Math.cos(azimuth);
    const rightX = Math.cos(azimuth);
    const rightZ = -Math.sin(azimuth);

    let dx = 0;
    let dz = 0;

    if (keys.forward) { dx += forwardX; dz += forwardZ; }
    if (keys.backward) { dx -= forwardX; dz -= forwardZ; }
    if (keys.left) { dx -= rightX; dz -= rightZ; }
    if (keys.right) { dx += rightX; dz += rightZ; }

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

      onPositionChange(pos);
    }

    // Smooth rotation
    const currentY = groupRef.current.rotation.y;
    const diff = targetRotation.current - currentY;
    const wrapped = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
    groupRef.current.rotation.y += wrapped * 8 * delta;
  });

  return (
    <group ref={groupRef} position={[0, 0, 3]}>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} geometry={SHADOW_CIRCLE_LG}>
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>

      {/* Click target (invisible sphere) */}
      <mesh
        position={[0, 0.8, 0]}
        geometry={CLICK_SPHERE}
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
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Selection / hover ring */}
      {hovered && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} geometry={SELECT_RING_LG}>
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.4} />
        </mesh>
      )}

      {/* Character model */}
      <Suspense fallback={<FallbackBody />}>
        <PlayerModel
          isMoving={isMoving}
          modelUrl={modelUrl}
          bodyColor={bodyColor}
        />
      </Suspense>

      {/* Status indicator */}
      <mesh position={[0, 2.0, 0]} geometry={STATUS_SPHERE_PLAYER}>
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Name tag */}
      {hovered && (
        <Billboard position={[0, 2.2, 0]} follow lockX={false} lockY={false} lockZ={false}>
          <Text
            fontSize={0.18}
            fontWeight={700}
            color="white"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.015}
            outlineColor="#000000"
          >
            {playerName}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
