import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Euler, Matrix4, type InstancedMesh, type Vector3Tuple } from 'three';

const RAILS: Vector3Tuple[] = [-4, 0, 4].map((x) => [x, 4.94, 0]);
const STRIPS: Vector3Tuple[] = [-4, 0, 4].map((x) => [x, 4.875, 0]);
const SKIRTING: Vector3Tuple[] = [-6.92, 6.92].map((x) => [x, 0.16, 0]);
const PILASTERS: Vector3Tuple[] = [-6.92, 6.92].flatMap((x) => [-6, -2, 2, 6].map((z): Vector3Tuple => [x, 2.65, z]));
const PANELS: Vector3Tuple[] = [-1, 1].flatMap((side) => [-4, 0, 4].map((z): Vector3Tuple => [side * 6.9, 2.45, z]));
const INSETS: Vector3Tuple[] = PANELS.map(([x, y, z]) => [x - Math.sign(x) * 0.05, y, z]);
const ACCENTS: Vector3Tuple[] = PANELS.map(([x, y, z]) => [x - Math.sign(x) * 0.08, y + 1.58, z]);
const COFFERS: Vector3Tuple[] = [-6, -2, 2, 6].map((z) => [0, 4.88, z]);
const SEAMS_X: Vector3Tuple[] = [-6, -4, -2, 0, 2, 4, 6].map((x) => [x, 0.003, 0]);
const SEAMS_Z: Vector3Tuple[] = [-6, -4, -2, 0, 2, 4, 6].map((z) => [0, 0.004, z]);

/** One draw/geometry/material per repeated finish, owned by this R3F mount. */
function GalleryInstances({ positions, rotationX = 0, children }: {
  positions: readonly Vector3Tuple[]; rotationX?: number; children: ReactNode;
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
  return <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>{children}</instancedMesh>;
}

/** Inset panels and coffers retain their dimensions, normals and finishes. */
export function GalleryArchitecture() {
  return (
    <group>
      <mesh position={[0, 5.12, 0]}>
        <boxGeometry args={[14.4, 0.24, 16.4]} />
        <meshStandardMaterial color="#eee8dc" roughness={0.95} />
      </mesh>
      <GalleryInstances positions={RAILS}>
        <boxGeometry args={[0.14, 0.12, 15.8]} />
        <meshStandardMaterial color="#524f46" roughness={0.8} />
      </GalleryInstances>
      <GalleryInstances positions={STRIPS} rotationX={Math.PI / 2}>
        <planeGeometry args={[0.075, 14.5]} />
        <meshStandardMaterial color="#fff3dd" emissive="#fff3dd" emissiveIntensity={1.2} />
      </GalleryInstances>
      <GalleryInstances positions={SKIRTING}>
        <boxGeometry args={[0.1, 0.32, 16]} />
        <meshStandardMaterial color="#766955" roughness={0.75} metalness={0.1} />
      </GalleryInstances>
      <GalleryInstances positions={PILASTERS}>
        <boxGeometry args={[0.12, 4.7, 0.18]} />
        <meshStandardMaterial color="#d8cfbe" roughness={0.92} />
      </GalleryInstances>
      <GalleryInstances positions={PANELS}>
        <boxGeometry args={[0.09, 3.4, 2.9]} />
        <meshStandardMaterial color="#d4cbb9" roughness={0.95} />
      </GalleryInstances>
      <GalleryInstances positions={INSETS}>
        <boxGeometry args={[0.04, 3.15, 2.65]} />
        <meshStandardMaterial color="#e6dfd1" roughness={0.92} />
      </GalleryInstances>
      <GalleryInstances positions={ACCENTS}>
        <boxGeometry args={[0.04, 0.025, 2.6]} />
        <meshBasicMaterial color="#f6e5c8" />
      </GalleryInstances>
      <GalleryInstances positions={COFFERS}>
        <boxGeometry args={[13.6, 0.22, 0.22]} />
        <meshStandardMaterial color="#d6cdbd" roughness={0.95} />
      </GalleryInstances>
      <GalleryInstances positions={SEAMS_X} rotationX={-Math.PI / 2}>
        <planeGeometry args={[0.012, 16]} />
        <meshStandardMaterial color="#bfb5a2" roughness={0.9} />
      </GalleryInstances>
      <GalleryInstances positions={SEAMS_Z} rotationX={-Math.PI / 2}>
        <planeGeometry args={[14, 0.012]} />
        <meshStandardMaterial color="#bfb5a2" roughness={0.9} />
      </GalleryInstances>
      <mesh position={[0, 2.5, -7.97]}>
        <boxGeometry args={[4.4, 2.8, 0.05]} />
        <meshStandardMaterial color="#3e5a55" roughness={1} />
      </mesh>
      <mesh position={[0, 2.5, -7.91]}>
        <torusGeometry args={[0.9, 0.025, 8, 48]} />
        <meshStandardMaterial color="#cba871" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}
