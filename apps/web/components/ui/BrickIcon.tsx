'use client';

import { memo, useMemo } from 'react';
import type { BrickShape, BrickType } from '@brick-quest/shared';
import { getShapeDefinition } from '@brick-quest/shared';

interface BrickIconProps {
  width: number;
  length: number;
  hexColor: string;
  type?: BrickType;
  shape?: BrickShape;
  maxSize?: number;
  className?: string;
}

function darkenColor(hex: string, percent: number): string {
  let color = hex.replace(/^\s*#|\s*$/g, '');
  if (color.length === 3) color = color.replace(/(.)/g, '$1$1');

  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  const amount = Math.floor(255 * (percent / 100));

  const newR = Math.max(0, r - amount);
  const newG = Math.max(0, g - amount);
  const newB = Math.max(0, b - amount);

  const toHex = (n: number) => n.toString(16).padStart(2, '0');

  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

export const BrickIcon = memo(function BrickIcon({
  width,
  length,
  hexColor,
  type = 'brick',
  shape = 'rectangle',
  maxSize = 64,
  className = '',
}: BrickIconProps) {
  const def = getShapeDefinition(shape);
  const isCorner = shape === 'corner';
  const isSlope = def.category === 'slope' || def.category === 'curved';
  const isTile = type === 'tile' || isSlope;
  const isPlate = type === 'plate' || type === 'tile';

  const padding = 16;
  const availableSize = maxSize - padding * 2;
  const maxDim = Math.max(width, length);
  const cellSize = availableSize / maxDim;

  const { sideColor, deepShadowColor } = useMemo(
    () => ({ sideColor: darkenColor(hexColor, 20), deepShadowColor: darkenColor(hexColor, 40) }),
    [hexColor],
  );

  const stepSize = 0.5;
  const layers = isPlate ? 6 : 20;

  const extrusionShadow = Array.from({ length: layers }, (_, i) => {
    const offset = (i + 1) * stepSize;
    const color = i > layers - 5 ? deepShadowColor : sideColor;
    return `${offset}px ${offset}px 0 ${color}`;
  }).join(', ');

  const filterLayers = isPlate ? 3 : 8;
  const filterStep = isPlate ? 1 : 1.5;
  const dropShadowFilter = Array.from({ length: filterLayers }, (_, i) => {
    const offset = (i + 1) * filterStep;
    return `drop-shadow(${offset}px ${offset}px 0px ${sideColor})`;
  }).join(' ');

  const clipPath = def.icon2d.clipPath ?? (isCorner ? 'polygon(0 0, 100% 0, 100% 50%, 50% 50%, 50% 100%, 0 100%)' : 'none');

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: maxSize, height: maxSize }}
    >
      <div
        style={{
          transform: 'rotateX(60deg) rotateZ(45deg) translate(-10%, -10%)',
          transformStyle: 'preserve-3d',
          width: width * cellSize,
          height: length * cellSize,
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: hexColor,
            backgroundImage: def.icon2d.gradient
              ?? (isSlope
                ? 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.2) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.1) 100%)'),
            borderRadius: def.icon2d.borderRadius,
            display: 'grid',
            gridTemplateColumns: `repeat(${width}, 1fr)`,
            gridTemplateRows: `repeat(${length}, 1fr)`,
            boxShadow: isCorner ? 'none' : extrusionShadow,
            filter: isCorner
              ? `${dropShadowFilter} drop-shadow(2px 2px 4px rgba(0,0,0,0.4))`
              : 'drop-shadow(5px 5px 6px rgba(0,0,0,0.3))',
            clipPath,
          }}
        >
          {!isTile &&
            !isSlope &&
            Array.from({ length: width * length }).map((_, i) => (
              <div key={i} className="flex items-center justify-center">
                <div
                  style={{
                    width: '65%',
                    height: '65%',
                    borderRadius: '50%',
                    backgroundColor: hexColor,
                    boxShadow: `
                      inset 1px 1px 1px rgba(255,255,255,0.6),
                      inset -1px -1px 2px rgba(0,0,0,0.2),
                      ${isPlate ? '1px 1px 0px' : '2px 2px 0px'} ${sideColor},
                      2px 2px 2px rgba(0,0,0,0.2)
                    `,
                  }}
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
});
