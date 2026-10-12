import { GalleryArchitecture } from './GalleryArchitecture';

/** Fixed Day 1 shell. Inner bounds: x ±7, z ±8, floor 0, ceiling 5 metres. */
export function MuseumRoom() {
  return (
    <group>
      <GalleryArchitecture />
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[14.4, 0.24, 16.4]} />
        <meshStandardMaterial color="#c9bda5" roughness={0.72} />
      </mesh>
      {[-7.12, 7.12].map((x) => (
        <mesh key={x} position={[x, 2.5, 0]}>
          <boxGeometry args={[0.24, 5, 16.4]} />
          <meshStandardMaterial color="#e4ded1" roughness={0.92} />
        </mesh>
      ))}
      {[-8.12, 8.12].map((z) => (
        <mesh key={z} position={[0, 2.5, z]}>
          <boxGeometry args={[14, 5, 0.24]} />
          <meshStandardMaterial color={z < 0 ? '#54716b' : '#e4ded1'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
