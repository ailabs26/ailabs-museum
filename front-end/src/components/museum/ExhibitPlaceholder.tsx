import { useLayoutEffect, useState } from 'react';
import { ConeGeometry, IcosahedronGeometry, LatheGeometry, SphereGeometry, TorusGeometry, Vector2, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MuseumDisplay } from '@/interfaces/museumScene';

/** Explicit geometric illustration, never a fabricated historical reconstruction. */
export function ExhibitPlaceholder({ shape, color, isSelected, isHovered }: {
  shape: MuseumDisplay['shape']; color: string; isSelected: boolean; isHovered: boolean;
}) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  useLayoutEffect(() => {
    const roundedCylinder = () => new LatheGeometry([
      new Vector2(0, -.55), new Vector2(.42, -.55), new Vector2(.448, -.53),
      new Vector2(.45, -.5), new Vector2(.45, .5), new Vector2(.448, .53),
      new Vector2(.42, .55), new Vector2(0, .55),
    ], 48);
    const next = shape === 'cube' ? new RoundedBoxGeometry(.9, .9, .9, 3, .025)
      : shape === 'sphere' ? new SphereGeometry(.57, 40, 28)
        : shape === 'torus' ? new TorusGeometry(.8, .2, 24, 72)
          : shape === 'cone' ? new ConeGeometry(.52, 1.2, 40)
            : shape === 'cylinder' ? roundedCylinder() : new IcosahedronGeometry(.64, 0);
    setGeometry(next);
    return () => next.dispose();
  }, [shape]);
  return geometry && <mesh castShadow receiveShadow position={[0, shape === 'torus' ? 2.16 : 1.73, 0]} rotation={[0, 0, shape === 'cube' ? .12 : 0]}>
    <primitive object={geometry} attach="geometry" />
    <meshStandardMaterial color={color} roughness={shape === 'torus' ? .38 : .58} metalness={shape === 'torus' ? .4 : .08}
      emissive={isSelected ? '#857147' : '#b69761'} emissiveIntensity={isSelected ? .08 : isHovered ? .06 : 0} />
  </mesh>;
}
