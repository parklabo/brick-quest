'use client';

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadLDrawModel } from '../../lib/three/ldraw-loader-instance';
import { applyBrickQuestColor, type ColorOverrideOptions } from '../../lib/three/ldraw-color-override';

/** LDraw 20 LDU = 1 BrickQuest stud → uniform scale 1/20 */
const LDRAW_SCALE = 0.05;

interface LDrawBrickBodyProps {
  partFile: string;
  hexColor: string;
  isGhost?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  onLoaded?: () => void;
  onError?: () => void;
}

/**
 * Custom hook: asynchronously load an LDraw model, apply BrickQuest
 * colors, normalize scale and bounding box.
 */
function useLDrawModel(
  partFile: string,
  hexColor: string,
  colorOptions: ColorOverrideOptions,
  onLoaded?: () => void,
  onError?: () => void,
) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setModel(null);

    loadLDrawModel(partFile)
      .then((group) => {
        if (!mountedRef.current) return;

        // Apply BrickQuest color override (also strips all line objects)
        applyBrickQuestColor(group, hexColor, colorOptions);

        // Validate: if no mesh children remain, treat as failure
        let hasMesh = false;
        group.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) hasMesh = true;
        });
        if (!hasMesh) {
          onError?.();
          return;
        }

        // Scale: LDraw → BrickQuest (1/20 uniform)
        group.scale.set(LDRAW_SCALE, LDRAW_SCALE, LDRAW_SCALE);

        // Y-axis flip: LDraw is Y-down, BrickQuest is Y-up
        group.rotation.x = Math.PI;

        // Force matrix update for accurate bounding box
        group.updateMatrixWorld(true);

        // Center model at origin to match procedural geometry's centering.
        // LegoBrick adds +height/2 to y, so both geometry types need the
        // same center-origin convention.
        const box = new THREE.Box3().setFromObject(group);
        if (box.isEmpty()) {
          onError?.();
          return;
        }
        const center = new THREE.Vector3();
        box.getCenter(center);
        group.position.set(-center.x, -center.y, -center.z);

        setModel(group);
        onLoaded?.();
      })
      .catch(() => {
        if (!mountedRef.current) return;
        onError?.();
      });

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partFile, hexColor]);

  return model;
}

export function LDrawBrickBody({
  partFile,
  hexColor,
  isGhost = false,
  emissive = '#000000',
  emissiveIntensity = 0,
  onLoaded,
  onError,
}: LDrawBrickBodyProps) {
  const colorOptions: ColorOverrideOptions = { isGhost, emissive, emissiveIntensity };
  const model = useLDrawModel(partFile, hexColor, colorOptions, onLoaded, onError);

  if (!model) return null;

  return <primitive object={model} />;
}
