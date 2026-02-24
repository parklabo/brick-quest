'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';

const ORBIT_RADIUS = 16;
const ELEVATION = 10;
const ROTATION_SPEED = 0.15; // rad/s
const LERP_FACTOR = 3;
const TARGET = new THREE.Vector3(0, 1.5, -1);

const _desiredPos = new THREE.Vector3();

export function DashboardCamera() {
  const { camera, gl } = useThree();
  const angleRef = useRef(Math.PI / 4);
  const pausedRef = useRef(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = useCallback(() => {
    pausedRef.current = true;
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
  }, []);

  const handlePointerUp = useCallback(() => {
    // Resume auto-rotate after 2s of no interaction
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, 2000);
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: true });
    canvas.addEventListener('touchend', handlePointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('touchstart', handlePointerDown);
      canvas.removeEventListener('touchend', handlePointerUp);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, [gl.domElement, handlePointerDown, handlePointerUp]);

  useFrame((_, delta) => {
    if (!pausedRef.current) {
      angleRef.current += ROTATION_SPEED * delta;
    }

    const angle = angleRef.current;
    const desiredX = TARGET.x + ORBIT_RADIUS * Math.sin(angle);
    const desiredZ = TARGET.z + ORBIT_RADIUS * Math.cos(angle);

    camera.position.lerp(_desiredPos.set(desiredX, ELEVATION, desiredZ), LERP_FACTOR * delta);
    camera.lookAt(TARGET.x, TARGET.y, TARGET.z);
  });

  return null;
}
