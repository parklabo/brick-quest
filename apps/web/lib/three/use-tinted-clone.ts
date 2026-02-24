'use client';

import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

interface CacheEntry {
  clone: THREE.Group;
  refCount: number;
}

const cloneCache = new Map<string, CacheEntry>();

function makeCacheKey(modelUrl: string, bodyColor: string, tintStrength: number) {
  return `${modelUrl}::${bodyColor}::${tintStrength}`;
}

function createTintedClone(scene: THREE.Group, bodyColor: string, tintStrength: number): THREE.Group {
  const clone = skeletonClone(scene) as THREE.Group;
  const tintColor = new THREE.Color(bodyColor);
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const mat = (child.material as THREE.MeshStandardMaterial).clone();
      mat.color.lerp(tintColor, tintStrength);
      child.material = mat;
    }
  });
  return clone;
}

function disposeCloneMaterials(clone: THREE.Group) {
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const mat = child.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else {
        mat.dispose();
      }
    }
  });
}

/**
 * Returns a skeleton-cloned scene tinted by bodyColor.
 * Caches clones by (modelUrl, bodyColor, tintStrength) — refCounted.
 * On unmount: decrement refCount; dispose materials when refCount hits 0.
 * Geometry is shared with the original, so we never dispose it here.
 */
export function useTintedClone(scene: THREE.Group, modelUrl: string, bodyColor: string, tintStrength = 0.35): THREE.Group {
  const cacheKey = makeCacheKey(modelUrl, bodyColor, tintStrength);
  const cacheKeyRef = useRef(cacheKey);

  const clone = useMemo(() => {
    const existing = cloneCache.get(cacheKey);
    if (existing) {
      existing.refCount++;
      return existing.clone;
    }
    const newClone = createTintedClone(scene, bodyColor, tintStrength);
    cloneCache.set(cacheKey, { clone: newClone, refCount: 1 });
    return newClone;
  }, [scene, cacheKey, bodyColor, tintStrength]);

  useEffect(() => {
    cacheKeyRef.current = cacheKey;
  }, [cacheKey]);

  useEffect(() => {
    return () => {
      const key = cacheKeyRef.current;
      const entry = cloneCache.get(key);
      if (!entry) return;
      entry.refCount--;
      if (entry.refCount <= 0) {
        disposeCloneMaterials(entry.clone);
        cloneCache.delete(key);
      }
    };
  }, []);

  return clone;
}
