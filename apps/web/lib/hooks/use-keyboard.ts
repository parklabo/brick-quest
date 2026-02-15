'use client';

import { useEffect, useRef } from 'react';

export interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  elevateUp: boolean;
  elevateDown: boolean;
}

export function useKeyboard() {
  const keys = useRef<KeyState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    rotateLeft: false,
    rotateRight: false,
    elevateUp: false,
    elevateDown: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = true;
          break;
        case 'KeyQ':
          keys.current.rotateLeft = true;
          break;
        case 'KeyE':
          keys.current.rotateRight = true;
          break;
        case 'KeyR':
          keys.current.elevateUp = true;
          break;
        case 'KeyF':
          keys.current.elevateDown = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = false;
          break;
        case 'KeyQ':
          keys.current.rotateLeft = false;
          break;
        case 'KeyE':
          keys.current.rotateRight = false;
          break;
        case 'KeyR':
          keys.current.elevateUp = false;
          break;
        case 'KeyF':
          keys.current.elevateDown = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return keys;
}
