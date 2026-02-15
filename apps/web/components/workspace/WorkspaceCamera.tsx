'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import type { KeyState } from '../../lib/hooks/use-keyboard';

const ORBIT_DISTANCE = 15;
const INITIAL_AZIMUTH = Math.PI / 4;
const INITIAL_ELEVATION = Math.PI / 5;
const MIN_ELEVATION = 0.1;
const MAX_ELEVATION = Math.PI / 2.2;
const ROTATE_SPEED = 2.0;
const ELEVATE_SPEED = 1.2;
const PAN_SPEED = 8;
const LERP_FACTOR = 5;

const MIN_ZOOM = 5;
const MAX_ZOOM = 40;
const ZOOM_SPEED = 2;

const DRAG_ROTATE_SPEED = 0.008;
const DRAG_ELEVATE_SPEED = 0.006;

// Baseplate bounds
const BOUND = 16;

interface WorkspaceCameraProps {
  keysRef: React.MutableRefObject<KeyState>;
}

export function WorkspaceCamera({ keysRef }: WorkspaceCameraProps) {
  const { camera, gl } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  const distanceRef = useRef(ORBIT_DISTANCE);
  const azimuthRef = useRef(INITIAL_AZIMUTH);
  const elevationRef = useRef(INITIAL_ELEVATION);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.01;
    distanceRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, distanceRef.current - delta * ZOOM_SPEED));
  }, []);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.button === 2 || e.button === 1) {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    azimuthRef.current -= dx * DRAG_ROTATE_SPEED;
    elevationRef.current = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, elevationRef.current + dy * DRAG_ELEVATE_SPEED));
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (e.button === 2 || e.button === 1) isDragging.current = false;
  }, []);

  const handleContextMenu = useCallback((e: Event) => e.preventDefault(), []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('contextmenu', handleContextMenu);
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gl.domElement, handleWheel, handlePointerDown, handlePointerMove, handlePointerUp, handleContextMenu]);

  useFrame((_, delta) => {
    const keys = keysRef.current;

    // Keyboard orbit (Q/E)
    if (keys.rotateLeft) azimuthRef.current += ROTATE_SPEED * delta;
    if (keys.rotateRight) azimuthRef.current -= ROTATE_SPEED * delta;

    // Keyboard elevation (R/F)
    if (keys.elevateUp) elevationRef.current = Math.min(MAX_ELEVATION, elevationRef.current + ELEVATE_SPEED * delta);
    if (keys.elevateDown) elevationRef.current = Math.max(MIN_ELEVATION, elevationRef.current - ELEVATE_SPEED * delta);

    // WASD pan (relative to camera azimuth)
    const azimuth = azimuthRef.current;
    const forwardX = Math.sin(azimuth);
    const forwardZ = Math.cos(azimuth);
    let dx = 0, dz = 0;
    if (keys.forward) { dx += forwardX; dz += forwardZ; }
    if (keys.backward) { dx -= forwardX; dz -= forwardZ; }
    if (keys.left) { dx += forwardZ; dz -= forwardX; }
    if (keys.right) { dx -= forwardZ; dz += forwardX; }

    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      const target = targetRef.current;
      target.x = Math.max(-BOUND, Math.min(BOUND, target.x + (dx / len) * PAN_SPEED * delta));
      target.z = Math.max(-BOUND, Math.min(BOUND, target.z + (dz / len) * PAN_SPEED * delta));
    }

    // Compute camera position from spherical coordinates
    const target = targetRef.current;
    const elev = elevationRef.current;
    const dist = distanceRef.current;

    const desiredX = target.x + dist * Math.cos(elev) * Math.sin(azimuth);
    const desiredY = target.y + dist * Math.sin(elev);
    const desiredZ = target.z + dist * Math.cos(elev) * Math.cos(azimuth);

    camera.position.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), LERP_FACTOR * delta);
    camera.lookAt(target.x, target.y, target.z);
  });

  return null;
}
