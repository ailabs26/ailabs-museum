import { useLayoutEffect, useRef } from 'react';
import { Euler, Matrix4, type InstancedMesh, type Material, type Vector3Tuple } from 'three';
import { useGallerySurfaces } from './GallerySurfaces';
import { GallerySign } from './GallerySign';

const BAYS = [-4.8, 0, 4.8];
const RIBS: Vector3Tuple[] = [-1, 1].flatMap(side => Array.from({ length: 65 }, (_, i): Vector3Tuple => [side * 6.88, 2.5, -7.68 + i * .24]));
const BAY_PANELS: Vector3Tuple[] = [-1, 1].flatMap(side => BAYS.map((z): Vector3Tuple => [side * 6.82, 2.5, z]));
const BAY_TOPS: Vector3Tuple[] = [-1, 1].flatMap(side => BAYS.map((z): Vector3Tuple => [side * 6.77, 4.13, z]));
const BAY_SIDES: Vector3Tuple[] = [-1, 1].flatMap(side => BAYS.flatMap(z => [-1, 1].map((edge): Vector3Tuple => [side * 6.78, 2.5, z + edge * 1.58])));
const SKIRTING: Vector3Tuple[] = [-1, 1].map(side => [side * 6.88, .12, 0]);
const CORNICE: Vector3Tuple[] = [-1, 1].map(side => [side * 6.82, 4.65, 0]);
const COFFERS: Vector3Tuple[] = [-5.4, 0, 5.4].map(z => [0, 4.96, z]);
const CEILING_RIBS: Vector3Tuple[] = [-6.6, -3.3, 0, 3.3, 6.6].map(x => [x, 4.88, 0]);
const SEAMS_X: Vector3Tuple[] = [-6, -4, -2, 0, 2, 4, 6].map(x => [x, .002, 0]);
const SEAMS_Z: Vector3Tuple[] = [-6, -4, -2, 0, 2, 4, 6].map(z => [0, .003, z]);

/** Shared geometry/material for each architectural finish, independent of exhibit count. */
function GalleryInstances({ positions, size, material, rotationX = 0 }: {
  positions: readonly Vector3Tuple[]; size: Vector3Tuple; material: Material; rotationX?: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new Matrix4().makeRotationFromEuler(new Euler(rotationX, 0, 0));
    positions.forEach((position, index) => mesh.setMatrixAt(index, matrix.setPosition(...position)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [positions, rotationX]);
  return <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]} material={material} receiveShadow>
    <boxGeometry args={size} />
  </instancedMesh>;
}

/** All decorative projections stay outside the existing walkable envelope. */
export function GalleryArchitecture() {
  const { stone, walnut, bronze, plaster, charcoal, grout } = useGallerySurfaces();
  return <group name="Gallery architecture">
    <mesh position={[0, 5.12, 0]} material={plaster}><boxGeometry args={[14.4, .24, 16.4]} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 6.97, 2.5, 0]} material={walnut} receiveShadow>
      <boxGeometry args={[.05, 4.6, 16]} />
    </mesh>)}
    <GalleryInstances positions={RIBS} size={[.08, 4.25, .055]} material={walnut} />
    <GalleryInstances positions={BAY_PANELS} size={[.045, 3.2, 3.08]} material={stone} />
    <GalleryInstances positions={BAY_TOPS} size={[.08, .035, 3.22]} material={bronze} />
    <GalleryInstances positions={BAY_SIDES} size={[.055, 3.3, .025]} material={bronze} />
    <GalleryInstances positions={SKIRTING} size={[.16, .24, 16]} material={charcoal} />
    <GalleryInstances positions={CORNICE} size={[.24, .12, 16]} material={plaster} />
    <GalleryInstances positions={CEILING_RIBS} size={[.1, .22, 16]} material={walnut} />
    <GalleryInstances positions={COFFERS} size={[12.9, .08, 3.8]} material={charcoal} />
    {[-5.4, 0, 5.4].map(z => <group key={z}>
      <mesh position={[0, 4.91, z]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.8, 2.6]} /><meshStandardMaterial color="#f7f3e6" emissive="#fff5de" emissiveIntensity={.6} roughness={1} />
      </mesh>
      {[-1, 1].map(side => <mesh key={side} position={[side * 3.08, 4.87, z]} material={bronze}>
        <boxGeometry args={[.03, .08, 3.2]} />
      </mesh>)}
    </group>)}
    <group userData={{ xrIgnore: true }}>
      <GalleryInstances positions={SEAMS_X} size={[.008, .002, 16]} material={grout} />
      <GalleryInstances positions={SEAMS_Z} size={[14, .002, .008]} material={grout} />
    </group>
    <mesh position={[0, 2.55, -7.94]} material={charcoal}><boxGeometry args={[8.2, 4.5, .1]} /></mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * 4.16, 2.55, -7.85]} material={bronze}><boxGeometry args={[.035, 4.5, .035]} /></mesh>
      <mesh position={[0, 2.55 + side * 2.26, -7.85]} material={bronze}><boxGeometry args={[8.35, .035, .035]} /></mesh>
      <mesh position={[side * 5.6, 2.5, -7.94]} material={walnut}><boxGeometry args={[2.2, 4.5, .08]} /></mesh>
    </group>)}
    <GallerySign />
  </group>;
}
