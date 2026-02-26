'use client';

import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildPlan, BuildStepBlock } from '@brick-quest/shared';
import { clearLDrawCache } from '../../lib/three/ldraw-loader-instance';
import { LegoBrick } from './LegoBrick';

interface Lego3DSceneProps {
  plan: BuildPlan;
  currentStepIndex: number;
}

/** Compute the axis-aligned bounding box of a set of build steps */
function computeBounds(steps: BuildStepBlock[]) {
  if (steps.length === 0) {
    return { center: new THREE.Vector3(0, 2, 0), size: new THREE.Vector3(10, 5, 10) };
  }

  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  for (const step of steps) {
    const { x, y, z } = step.position;
    const hw = step.size.width / 2;
    const hl = step.size.length / 2;
    const h = step.size.height;

    min.x = Math.min(min.x, x - hw);
    min.y = Math.min(min.y, y);
    min.z = Math.min(min.z, z - hl);
    max.x = Math.max(max.x, x + hw);
    max.y = Math.max(max.y, y + h);
    max.z = Math.max(max.z, z + hl);
  }

  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const size = new THREE.Vector3().subVectors(max, min);
  return { center, size };
}

/** Adjust camera and controls to fit the model */
function CameraFitter({
  center,
  size,
}: {
  center: THREE.Vector3;
  size: THREE.Vector3;
}) {
  const { camera, controls } = useThree();

  useEffect(() => {
    const maxDim = Math.max(size.x, size.y, size.z, 5);
    // Distance that fits the bounding sphere in the FOV with padding
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    const fovRad = (fov / 2) * (Math.PI / 180);
    const dist = (maxDim * 0.7) / Math.tan(fovRad) + maxDim * 0.3;

    // Position camera at 3/4 angle above the model
    const offset = new THREE.Vector3(dist * 0.6, dist * 0.5, dist * 0.6);
    camera.position.copy(center).add(offset);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    // Update orbit controls target
    if (controls && 'target' in controls) {
      (controls.target as THREE.Vector3).copy(center);
      (controls as unknown as { update: () => void }).update();
    }
  }, [camera, controls, center, size]);

  return null;
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

  // Compute bounds from ALL steps (so camera doesn't jump as you step through)
  const { center, size } = useMemo(() => computeBounds(plan.steps), [plan.steps]);

  // Dynamic grid/shadow scale based on model size
  const groundScale = Math.max(size.x, size.z, 10) * 2;
  const fadeDistance = groundScale * 1.5;

  useEffect(() => {
    return () => {
      THREE.Cache.clear();
      clearLDrawCache();
    };
  }, []);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden bg-gray-100 border border-gray-300 shadow-2xl">
      <Canvas shadows camera={{ fov: 45, near: 0.1, far: 500 }}>
        <SceneCleanup />
        <color attach="background" args={['#e8ecf1']} />
        {/* Lighting — bright studio setup */}
        <ambientLight intensity={0.8} color="#f8fafc" />
        <hemisphereLight color="#f0f4ff" groundColor="#d4c8a8" intensity={0.5} />
        <directionalLight
          position={[15, 25, 15]}
          intensity={1.8}
          color="#fff8f0"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-groundScale / 2}
          shadow-camera-right={groundScale / 2}
          shadow-camera-top={groundScale / 2}
          shadow-camera-bottom={-groundScale / 2}
          shadow-camera-near={0.1}
          shadow-camera-far={80}
        />
        <directionalLight position={[-10, 15, -10]} intensity={0.4} color="#e0e7ff" />
        <pointLight position={[0, 10, -15]} intensity={0.3} distance={40} color="#f5f5f5" />
        <group>
          {visibleSteps.map((step, idx) => (
            <LegoBrick key={step.stepId || idx} block={step} />
          ))}
        </group>
        <Grid
          infiniteGrid
          cellSize={1}
          sectionSize={4}
          fadeDistance={fadeDistance}
          sectionColor="#94a3b8"
          cellColor="#cbd5e1"
          position={[0, 0, 0]}
        />
        <ContactShadows
          opacity={0.4}
          scale={groundScale}
          blur={2.5}
          far={6}
          resolution={256}
          color="#64748b"
        />
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
        <CameraFitter center={center} size={size} />
      </Canvas>
    </div>
  );
}
