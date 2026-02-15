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

// Touch gesture speeds
const TOUCH_ORBIT_SPEED = 0.006;
const TOUCH_ELEVATE_SPEED = 0.004;
const TOUCH_PAN_SPEED = 0.03;
const PINCH_ZOOM_SPEED = 0.02;

// Baseplate bounds
const BOUND = 16;

// Reusable Vector3 to avoid GC allocations in useFrame (60+ calls/sec)
const _desiredPos = new THREE.Vector3();

function getTouchDistance(t1: Touch, t2: Touch) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(t1: Touch, t2: Touch) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}

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

  // Touch state
  const touchCountRef = useRef(0);
  const lastTouchRef = useRef({ x: 0, y: 0 });
  const lastPinchDistRef = useRef(0);
  const lastPinchCenterRef = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.01;
    distanceRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, distanceRef.current - delta * ZOOM_SPEED));
  }, []);

  // --- Mouse (right-click drag to orbit) ---
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // handled by touch events
    if (e.button === 2 || e.button === 1) {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    azimuthRef.current -= dx * DRAG_ROTATE_SPEED;
    elevationRef.current = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, elevationRef.current + dy * DRAG_ELEVATE_SPEED));
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (e.button === 2 || e.button === 1) isDragging.current = false;
  }, []);

  const handleContextMenu = useCallback((e: Event) => e.preventDefault(), []);

  // --- Touch gestures ---
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    touchCountRef.current = e.touches.length;
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      lastPinchDistRef.current = getTouchDistance(e.touches[0], e.touches[1]);
      lastPinchCenterRef.current = getTouchCenter(e.touches[0], e.touches[1]);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && touchCountRef.current === 1) {
      // Single finger: orbit
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      azimuthRef.current -= dx * TOUCH_ORBIT_SPEED;
      elevationRef.current = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, elevationRef.current + dy * TOUCH_ELEVATE_SPEED));
    } else if (e.touches.length === 2) {
      // Two fingers: pinch to zoom + drag to pan
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const center = getTouchCenter(e.touches[0], e.touches[1]);

      // Pinch zoom
      const pinchDelta = lastPinchDistRef.current - dist;
      distanceRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, distanceRef.current + pinchDelta * PINCH_ZOOM_SPEED));
      lastPinchDistRef.current = dist;

      // Two-finger pan
      const panDx = center.x - lastPinchCenterRef.current.x;
      const panDy = center.y - lastPinchCenterRef.current.y;
      lastPinchCenterRef.current = center;

      const azimuth = azimuthRef.current;
      const forwardX = Math.sin(azimuth);
      const forwardZ = Math.cos(azimuth);
      // Screen X → strafe, Screen Y → forward/backward
      const moveX = -panDx * (-forwardZ) + -panDy * (-forwardX);
      const moveZ = -panDx * (forwardX) + -panDy * (-forwardZ);
      const target = targetRef.current;
      target.x = Math.max(-BOUND, Math.min(BOUND, target.x + moveX * TOUCH_PAN_SPEED));
      target.z = Math.max(-BOUND, Math.min(BOUND, target.z + moveZ * TOUCH_PAN_SPEED));
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    touchCountRef.current = e.touches.length;
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      lastPinchDistRef.current = getTouchDistance(e.touches[0], e.touches[1]);
      lastPinchCenterRef.current = getTouchCenter(e.touches[0], e.touches[1]);
    }
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gl.domElement, handleWheel, handlePointerDown, handlePointerMove, handlePointerUp, handleContextMenu, handleTouchStart, handleTouchMove, handleTouchEnd]);

  useFrame((_, delta) => {
    const keys = keysRef.current;

    // Keyboard orbit (Q/E)
    if (keys.rotateLeft) azimuthRef.current += ROTATE_SPEED * delta;
    if (keys.rotateRight) azimuthRef.current -= ROTATE_SPEED * delta;

    // Keyboard elevation (R/F)
    if (keys.elevateUp) elevationRef.current = Math.min(MAX_ELEVATION, elevationRef.current + ELEVATE_SPEED * delta);
    if (keys.elevateDown) elevationRef.current = Math.max(MIN_ELEVATION, elevationRef.current - ELEVATE_SPEED * delta);

    // WASD pan (relative to camera azimuth)
    // Camera looks FROM (target + offset) TO target, so view direction = -offset.
    // Moving target in the view direction makes the camera pan forward.
    const azimuth = azimuthRef.current;
    const forwardX = Math.sin(azimuth);
    const forwardZ = Math.cos(azimuth);
    let dx = 0, dz = 0;
    if (keys.forward) { dx -= forwardX; dz -= forwardZ; }
    if (keys.backward) { dx += forwardX; dz += forwardZ; }
    if (keys.left) { dx -= forwardZ; dz += forwardX; }
    if (keys.right) { dx += forwardZ; dz -= forwardX; }

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

    camera.position.lerp(_desiredPos.set(desiredX, desiredY, desiredZ), LERP_FACTOR * delta);
    camera.lookAt(target.x, target.y, target.z);
  });

  return null;
}
