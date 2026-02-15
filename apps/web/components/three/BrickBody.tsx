'use client';

import { useMemo, useState } from 'react';
import { getShapeDefinition, type BrickShape, type BrickType } from '@brick-quest/shared';
import { getCachedGeometry } from '../../lib/three/geometry-factory';
import { resolveLDrawPart } from '../../lib/three/ldraw-part-map';
import { getPooledMaterial } from '../../lib/three/ldraw-color-override';
import { BrickStuds } from './BrickStuds';
import { LDrawBrickBody } from './LDrawBrickBody';

interface BrickBodyProps {
  shape: BrickShape;
  type: BrickType;
  width: number;
  height: number;
  length: number;
  hexColor: string;
  isGhost?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  showStuds?: boolean;
}

export function BrickBody({
  shape,
  type,
  width,
  height,
  length,
  hexColor,
  isGhost = false,
  emissive = '#000000',
  emissiveIntensity = 0,
  showStuds = true,
}: BrickBodyProps) {
  const def = useMemo(() => getShapeDefinition(shape), [shape]);

  const geometry = useMemo(
    () => getCachedGeometry(def.geometry, width, height, length),
    [def.geometry, width, height, length],
  );

  const ldrawPart = useMemo(
    () => resolveLDrawPart(shape, type, width, length),
    [shape, type, width, length],
  );

  // Track whether the LDraw model has loaded successfully
  const [ldrawReady, setLDrawReady] = useState(false);
  const [ldrawFailed, setLDrawFailed] = useState(false);

  const isTile = type === 'tile';
  const hasStuds = showStuds && def.studs.hasStuds && !isTile;

  // Show procedural when: no LDraw mapping, LDraw loading, or LDraw failed
  const showProcedural = !ldrawPart || !ldrawReady || ldrawFailed;

  return (
    <group>
      {/* LDraw model (renders on top once loaded) */}
      {ldrawPart && !ldrawFailed && (
        <LDrawBrickBody
          partFile={ldrawPart}
          hexColor={hexColor}
          isGhost={isGhost}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          onLoaded={() => setLDrawReady(true)}
          onError={() => setLDrawFailed(true)}
        />
      )}

      {/* Procedural fallback (visible while loading or if no mapping) */}
      {showProcedural && (
        <>
          <mesh
            castShadow
            receiveShadow
            geometry={geometry}
            material={getPooledMaterial(hexColor, isGhost, emissive, emissiveIntensity)}
          />
          {hasStuds && (
            <BrickStuds
              studConfig={def.studs}
              shape={shape}
              width={width}
              height={height}
              length={length}
              hexColor={hexColor}
              transparent={isGhost}
              opacity={isGhost ? 0.3 : 1}
            />
          )}
        </>
      )}
    </group>
  );
}
