'use client';

import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clearMaterialPool } from '../../lib/three/ldraw-color-override';
import { clearGeometryCache } from '../../lib/three/geometry-factory';
import { clearLDrawCache } from '../../lib/three/ldraw-loader-instance';
import { useTranslations } from 'next-intl';
import { DashboardLighting } from './DashboardLighting';
import { DashboardCamera } from './DashboardCamera';
import { DashboardFloor } from './DashboardFloor';
import { DashboardStructure } from './DashboardStructure';
import { DESIGN_ISLAND, MYBRICKS_ISLAND } from './dashboard-layouts';

function SceneCleanup() {
  const { gl, scene } = useThree();

  useEffect(() => {
    return () => {
      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat: THREE.Material) => mat.dispose());
          } else if (object.material) {
            object.material.dispose();
          }
        }
      });
      gl.dispose();
      clearMaterialPool();
      clearGeometryCache();
      clearLDrawCache();
    };
  }, [gl, scene]);

  return null;
}

export default function DashboardScene() {
  const t = useTranslations('dashboard');

  useEffect(() => {
    return () => {
      THREE.Cache.clear();
    };
  }, []);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [12, 10, 12], fov: 50 }}
    >
      <color attach="background" args={['#0c0c14']} />
      <fog attach="fog" args={['#0c0c14', 20, 45]} />

      <DashboardLighting />
      <DashboardCamera />
      <SceneCleanup />

      <Suspense fallback={null}>
        <DashboardFloor />

        <DashboardStructure
          layout={DESIGN_ISLAND}
          href="/create"
          label={t('designIsland')}
          subtitle={t('designIslandDesc')}
          glowColor="#fbbf24"
          groupPosition={[-3.5, 0, -1]}
          baseDelay={0.3}
        />

        <DashboardStructure
          layout={MYBRICKS_ISLAND}
          href="/scan"
          label={t('myBricksIsland')}
          subtitle={t('myBricksIslandDesc')}
          glowColor="#60a5fa"
          groupPosition={[3.5, 0, -1]}
          baseDelay={0.5}
        />
      </Suspense>
    </Canvas>
  );
}
