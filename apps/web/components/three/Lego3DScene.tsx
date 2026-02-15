'use client';

import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildPlan } from '@brick-quest/shared';
import { clearLDrawCache } from '../../lib/three/ldraw-loader-instance';
import { LegoBrick } from './LegoBrick';

interface Lego3DSceneProps {
  plan: BuildPlan;
  currentStepIndex: number;
}

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
    };
  }, [gl, scene]);
  return null;
}

export default function Lego3DScene({ plan, currentStepIndex }: Lego3DSceneProps) {
  const visibleSteps = plan.steps.slice(0, currentStepIndex + 1);

  useEffect(() => {
    return () => {
      THREE.Cache.clear();
      clearLDrawCache();
    };
  }, []);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shadow-2xl">
      <Canvas shadows camera={{ position: [10, 8, 10], fov: 45 }}>
        <SceneCleanup />
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
        <group>
          {visibleSteps.map((step, idx) => (
            <LegoBrick key={step.stepId || idx} block={step} />
          ))}
        </group>
        <Grid infiniteGrid cellSize={1} sectionSize={4} fadeDistance={30} sectionColor="#475569" cellColor="#334155" position={[0, 0, 0]} />
        <ContactShadows opacity={0.6} scale={20} blur={2} far={4} resolution={256} color="#000000" />
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
