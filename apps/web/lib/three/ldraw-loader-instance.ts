import * as THREE from 'three';
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js';

const PARTS_LIB_URL =
  'https://raw.githubusercontent.com/gkjohnson/ldraw-parts-library/master/complete/ldraw/';

let loaderInstance: LDrawLoader | null = null;
let materialsReady = false;
let materialsPromise: Promise<void> | null = null;

/**
 * Raw model cache keyed by partFile only (no color).
 * Color is applied to clones, not to the cached original.
 */
const rawModelCache = new Map<string, THREE.Group>();

/**
 * Get (or create) the singleton LDrawLoader and ensure LDConfig materials
 * are preloaded exactly once.
 */
export async function initLDrawLoader(): Promise<LDrawLoader> {
  if (!loaderInstance) {
    loaderInstance = new LDrawLoader();
    // partsLibraryPath is used for subpart resolution (parts/, p/, models/)
    loaderInstance.setPartsLibraryPath(PARTS_LIB_URL);
    loaderInstance.smoothNormals = true;
  }

  if (!materialsReady && !materialsPromise) {
    materialsPromise = loaderInstance
      .preloadMaterials(`${PARTS_LIB_URL}LDConfig.ldr`)
      .then(() => {
        materialsReady = true;
      });
  }

  if (materialsPromise) {
    await materialsPromise;
  }

  return loaderInstance;
}

/**
 * Load an LDraw part and return a cloned Group.
 * Raw geometry is cached by partFile; caller applies color to the clone.
 */
export async function loadLDrawModel(
  partFile: string,
): Promise<THREE.Group> {
  const cached = rawModelCache.get(partFile);
  if (cached) {
    return cached.clone();
  }

  const loader = await initLDrawLoader();

  // loader.load() uses Loader.path for URL resolution, NOT partsLibraryPath.
  // We must provide the full URL to the part file in the parts/ subdirectory.
  const fullUrl = `${PARTS_LIB_URL}parts/${partFile}`;

  const group = await new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      fullUrl,
      (model) => resolve(model),
      undefined,
      (err) => reject(err),
    );
  });

  rawModelCache.set(partFile, group);
  return group.clone();
}

/**
 * Clear the raw model cache. Call when scenes unmount to free memory.
 */
export function clearLDrawCache(): void {
  for (const group of rawModelCache.values()) {
    group.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m: THREE.Material) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });
  }
  rawModelCache.clear();
}
