'use client';

import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clearLDrawCache } from '../../lib/three/ldraw-loader-instance';
import { useKeyboard } from '../../lib/hooks/use-keyboard';
import { useWorkspaceStore } from '../../lib/stores/workspace';
import { WorkspaceCamera } from './WorkspaceCamera';
import { WorkspaceFloor } from './WorkspaceFloor';
import { WorkspaceLighting } from './WorkspaceLighting';
import { InteractiveBrick } from './InteractiveBrick';
import { WorkspaceHUD } from './WorkspaceHUD';
import { StepControls } from './StepControls';

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

export default function WorkspaceScene() {
  const keysRef = useKeyboard();
  const placedBricks = useWorkspaceStore((s) => s.placedBricks);
  const currentStep = useWorkspaceStore((s) => s.currentStep);
  const selectBrick = useWorkspaceStore((s) => s.selectBrick);

  const visibleBricks = currentStep >= 0 ? placedBricks.slice(0, currentStep + 1) : placedBricks;

  useEffect(() => {
    return () => {
      THREE.Cache.clear();
      clearLDrawCache();
    };
  }, []);

  const handleMissClick = () => {
    selectBrick(null);
    document.body.style.cursor = 'default';
  };

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ position: [12, 10, 12], fov: 50 }}
        dpr={[1, 2]}
        onPointerMissed={handleMissClick}
      >
        <color attach="background" args={['#0c0c14']} />
        <fog attach="fog" args={['#0c0c14', 25, 50]} />

        <WorkspaceLighting />
        <WorkspaceCamera keysRef={keysRef} />

        <SceneCleanup />

        <Suspense fallback={null}>
          <WorkspaceFloor />

          {visibleBricks.map((brick) => (
            <InteractiveBrick key={brick.instanceId} brick={brick} />
          ))}
        </Suspense>
      </Canvas>

      <WorkspaceHUD />
      <StepControls />
    </div>
  );
}
