'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Stage } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { BrickShape, GeometryParams } from '@brick-quest/shared';
import { getShapeDefinition } from '@brick-quest/shared';

interface ShapePreview3DProps {
  shapeId: BrickShape;
  width?: number;
  height?: number;
  length?: number;
  color?: string;
  className?: string;
}

/** Lightweight geometry builder for the console 3D preview. */
function buildGeometry(params: GeometryParams, w: number, h: number, l: number): THREE.BufferGeometry {
  switch (params.kind) {
    case 'cylinder':
      return new THREE.CylinderGeometry(Math.min(w, l) / 2 - 0.05, Math.min(w, l) / 2 - 0.05, h, 32);
    case 'cone':
      return new THREE.ConeGeometry(Math.min(w, l) / 2 - 0.05, h, params.curveSegments ?? 32);
    case 'dome':
      return new THREE.SphereGeometry(Math.min(w, l) / 2 - 0.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    case 'wedge':
    case 'inverted_wedge':
    case 'curved_wedge': {
      const angleDeg = params.slopeAngleDeg ?? 45;
      const run = Math.min(h / Math.tan((angleDeg * Math.PI) / 180), l);
      const shape = new THREE.Shape();
      shape.moveTo(-l / 2, -h / 2);
      shape.lineTo(l / 2, -h / 2);
      shape.lineTo(l / 2, h / 2);
      shape.lineTo(l / 2 - run, -h / 2);
      const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: w - 0.05, bevelEnabled: false });
      geo.rotateY(Math.PI / 2);
      geo.computeBoundingBox();
      if (geo.boundingBox) {
        geo.translate(
          -(geo.boundingBox.min.x + geo.boundingBox.max.x) / 2,
          -(geo.boundingBox.min.y + geo.boundingBox.max.y) / 2,
          -(geo.boundingBox.min.z + geo.boundingBox.max.z) / 2,
        );
      }
      return geo;
    }
    case 'arch': {
      const shape = new THREE.Shape();
      shape.moveTo(-l / 2, -h / 2);
      shape.lineTo(l / 2, -h / 2);
      shape.lineTo(l / 2, h / 2);
      shape.lineTo(-l / 2, h / 2);
      shape.lineTo(-l / 2, -h / 2);
      const r = Math.min(l / 2 - 0.1, h / 2);
      const hole = new THREE.Path();
      hole.absarc(0, -h / 2, r, 0, Math.PI, false);
      shape.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: w - 0.05, bevelEnabled: false, curveSegments: 16 });
      geo.rotateY(Math.PI / 2);
      geo.computeBoundingBox();
      if (geo.boundingBox) {
        geo.translate(
          -(geo.boundingBox.min.x + geo.boundingBox.max.x) / 2,
          -(geo.boundingBox.min.y + geo.boundingBox.max.y) / 2,
          -(geo.boundingBox.min.z + geo.boundingBox.max.z) / 2,
        );
      }
      return geo;
    }
    case 'half_cylinder':
      return new THREE.CylinderGeometry(h / 2, h / 2, l - 0.05, 16, 1, false, 0, Math.PI);
    case 'triangular_plate': {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, -l / 2);
      shape.lineTo(w / 2, -l / 2);
      shape.lineTo(-w / 2, l / 2);
      const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: h, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      geo.computeBoundingBox();
      if (geo.boundingBox) {
        geo.translate(
          -(geo.boundingBox.min.x + geo.boundingBox.max.x) / 2,
          -(geo.boundingBox.min.y + geo.boundingBox.max.y) / 2,
          -(geo.boundingBox.min.z + geo.boundingBox.max.z) / 2,
        );
      }
      return geo;
    }
    case 'beam_with_holes':
    case 'l_shape':
    case 'box':
    default:
      return new THREE.BoxGeometry(w - 0.05, h, l - 0.05);
  }
}

function PreviewBrick({
  shapeId,
  width = 2,
  height = 1.2,
  length = 2,
  color = '#3b82f6',
}: {
  shapeId: BrickShape;
  width?: number;
  height?: number;
  length?: number;
  color?: string;
}) {
  const def = getShapeDefinition(shapeId);

  const geometry = useMemo(
    () => buildGeometry(def.geometry, width, height, length),
    [def.geometry, width, height, length],
  );

  return (
    <mesh castShadow receiveShadow geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.1} metalness={0.0} />
    </mesh>
  );
}

export function ShapePreview3D({
  shapeId,
  width,
  height,
  length,
  color,
  className = '',
}: ShapePreview3DProps) {
  return (
    <div className={`bg-slate-950 rounded-xl overflow-hidden ${className}`}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [4, 4, 4], fov: 45 }}>
        <color attach="background" args={['#020617']} />
        <Environment preset="studio" />
        <Stage environment="city" intensity={0.6} adjustCamera={1.5}>
          <PreviewBrick
            shapeId={shapeId}
            width={width}
            height={height}
            length={length}
            color={color}
          />
        </Stage>
        <OrbitControls autoRotate autoRotateSpeed={3} makeDefault />
      </Canvas>
    </div>
  );
}
