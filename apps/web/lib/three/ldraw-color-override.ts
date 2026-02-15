import * as THREE from 'three';

export interface ColorOverrideOptions {
  isGhost?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
}

// ---- Material pool: reuse materials by key to avoid 500+ allocations ----
const materialPool = new Map<string, THREE.MeshStandardMaterial>();

function getPooledMaterial(
  hexColor: string,
  isGhost: boolean,
  emissive: string,
  emissiveIntensity: number,
): THREE.MeshStandardMaterial {
  const key = `${hexColor}:${isGhost}:${emissive}:${emissiveIntensity}`;
  let mat = materialPool.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness: 0.1,
      metalness: 0.0,
      transparent: isGhost,
      opacity: isGhost ? 0.3 : 1,
      emissive: new THREE.Color(emissive),
      emissiveIntensity,
    });
    materialPool.set(key, mat);
  }
  return mat;
}

/** Dispose all pooled materials — call on scene teardown */
export function clearMaterialPool(): void {
  for (const mat of materialPool.values()) mat.dispose();
  materialPool.clear();
}

/** Get a pooled MeshStandardMaterial (for use by BrickBody / BrickStuds) */
export { getPooledMaterial };

/**
 * Replace all materials on an LDraw Group with BrickQuest-styled
 * MeshStandardMaterial, and strip ALL line-based objects
 * (LineSegments, Line, LineLoop — LDraw edges/conditional lines).
 */
export function applyBrickQuestColor(
  group: THREE.Group,
  hexColor: string,
  options: ColorOverrideOptions = {},
): void {
  const { isGhost = false, emissive = '#000000', emissiveIntensity = 0 } = options;

  const toRemove: THREE.Object3D[] = [];

  group.traverse((child: THREE.Object3D) => {
    // Remove ALL line-based objects (LineSegments, Line, LineLoop)
    if (child instanceof THREE.Line) {
      toRemove.push(child);
      return;
    }

    if (child instanceof THREE.Mesh) {
      // Dispose the original LDraw material(s) — they're not pooled
      if (Array.isArray(child.material)) {
        child.material.forEach((m: THREE.Material) => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }

      child.material = getPooledMaterial(hexColor, isGhost, emissive, emissiveIntensity);
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Remove collected line objects outside traversal
  for (const obj of toRemove) {
    if (obj instanceof THREE.Line) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m: THREE.Material) => m.dispose());
      } else if (obj.material instanceof THREE.Material) {
        obj.material.dispose();
      }
    }
    obj.parent?.remove(obj);
  }
}
