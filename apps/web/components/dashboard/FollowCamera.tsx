'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import type { KeyState } from '../../lib/hooks/use-keyboard';

// Camera orbit config
const ORBIT_DISTANCE = 15;
const INITIAL_AZIMUTH = Math.PI / 4;
const INITIAL_ELEVATION = Math.PI / 5;
const MIN_ELEVATION = 0.15;
const MAX_ELEVATION = Math.PI / 2.5;
const ROTATE_SPEED = 2.0;
const ELEVATE_SPEED = 1.2;
const LERP_FACTOR = 5;

// Zoom config
const MIN_ZOOM = 20;
const MAX_ZOOM = 120;
const ZOOM_SPEED = 8;

// Drag config
const DRAG_ROTATE_SPEED = 0.008;
const DRAG_ELEVATE_SPEED = 0.006;

// Touch config
const TOUCH_ORBIT_SPEED = 0.006;
const TOUCH_ELEVATE_SPEED = 0.004;
const PINCH_ZOOM_SPEED = 0.02;

interface FollowCameraProps {
  targetRef: React.MutableRefObject<THREE.Vector3>;
  azimuthRef: React.MutableRefObject<number>;
  keysRef: React.MutableRefObject<KeyState>;
}

const _desiredPos = new THREE.Vector3();

export function FollowCamera({
  targetRef,
  azimuthRef,
  keysRef,
}: FollowCameraProps) {
  const { camera, gl } = useThree();
  const zoomRef = useRef(50);
  const elevationRef = useRef(INITIAL_ELEVATION);
  const internalAzimuth = useRef(INITIAL_AZIMUTH);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Touch state
  const touchCountRef = useRef(0);
  const lastTouchRef = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(0);

  // Scroll zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.05;
    zoomRef.current = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, zoomRef.current + delta * ZOOM_SPEED),
    );
  }, []);

  // Right-click drag for orbit
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // handled by touch events
    if (e.button === 2 || e.button === 1) {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current || e.pointerType === 'touch') return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    internalAzimuth.current -= dx * DRAG_ROTATE_SPEED;
    elevationRef.current = Math.max(
      MIN_ELEVATION,
      Math.min(MAX_ELEVATION, elevationRef.current + dy * DRAG_ELEVATE_SPEED),
    );
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (e.button === 2 || e.button === 1) {
      isDragging.current = false;
    }
  }, []);

  const handleContextMenu = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  // Touch events
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchCountRef.current = e.touches.length;
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
      lastTouchRef.current = {
        x: (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2,
        y: (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2,
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && touchCountRef.current === 1) {
      // Single finger orbit
      const dx = e.touches[0]!.clientX - lastTouchRef.current.x;
      const dy = e.touches[0]!.clientY - lastTouchRef.current.y;
      lastTouchRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };

      internalAzimuth.current -= dx * TOUCH_ORBIT_SPEED;
      elevationRef.current = Math.max(
        MIN_ELEVATION,
        Math.min(MAX_ELEVATION, elevationRef.current + dy * TOUCH_ELEVATE_SPEED),
      );
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const pinchDelta = dist - lastPinchDist.current;
      lastPinchDist.current = dist;

      zoomRef.current = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, zoomRef.current + pinchDelta * PINCH_ZOOM_SPEED),
      );
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    touchCountRef.current = e.touches.length;
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
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
  }, [
    gl.domElement,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  ]);

  useFrame((_, delta) => {
    const keys = keysRef.current;

    // Keyboard orbit rotation (Q/E)
    if (keys.rotateLeft) internalAzimuth.current += ROTATE_SPEED * delta;
    if (keys.rotateRight) internalAzimuth.current -= ROTATE_SPEED * delta;

    // Keyboard elevation (R/F)
    if (keys.elevateUp) {
      elevationRef.current = Math.min(
        MAX_ELEVATION,
        elevationRef.current + ELEVATE_SPEED * delta,
      );
    }
    if (keys.elevateDown) {
      elevationRef.current = Math.max(
        MIN_ELEVATION,
        elevationRef.current - ELEVATE_SPEED * delta,
      );
    }

    // Sync azimuth for player movement direction
    azimuthRef.current = internalAzimuth.current;

    // Compute camera position from spherical coordinates
    const target = targetRef.current;
    const azimuth = internalAzimuth.current;
    const elevation = elevationRef.current;

    _desiredPos.set(
      target.x + ORBIT_DISTANCE * Math.cos(elevation) * Math.sin(azimuth),
      target.y + ORBIT_DISTANCE * Math.sin(elevation),
      target.z + ORBIT_DISTANCE * Math.cos(elevation) * Math.cos(azimuth),
    );

    // Smooth follow
    camera.position.lerp(_desiredPos, LERP_FACTOR * delta);

    // Smooth zoom — only update projection matrix when zoom actually changes
    const ortho = camera as THREE.OrthographicCamera;
    const zoomDelta = (zoomRef.current - ortho.zoom) * LERP_FACTOR * delta;
    if (Math.abs(zoomDelta) > 0.001) {
      ortho.zoom += zoomDelta;
      ortho.updateProjectionMatrix();
    }

    // Look at player
    camera.lookAt(target.x, target.y, target.z);
  });

  return null;
}
