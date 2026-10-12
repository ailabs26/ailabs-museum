import { GalleryArchitecture } from './GalleryArchitecture';
import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';

/** Fixed Day 1 shell. Inner bounds: x ±7, z ±8, floor 0, ceiling 5 metres. */
export function MuseumRoom() {
  return (
    <group>
      <GalleryArchitecture />
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[MUSEUM_ROOM_SIZE.width + 0.4, 0.24, MUSEUM_ROOM_SIZE.depth + 0.4]} />
        <meshStandardMaterial color="#c9bda5" roughness={0.72} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (MUSEUM_ROOM_SIZE.width / 2 + 0.12), MUSEUM_ROOM_SIZE.height / 2, 0]}>
          <boxGeometry args={[0.24, MUSEUM_ROOM_SIZE.height, MUSEUM_ROOM_SIZE.depth + 0.4]} />
          <meshStandardMaterial color="#e4ded1" roughness={0.92} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, MUSEUM_ROOM_SIZE.height / 2, side * (MUSEUM_ROOM_SIZE.depth / 2 + 0.12)]}>
          <boxGeometry args={[MUSEUM_ROOM_SIZE.width, MUSEUM_ROOM_SIZE.height, 0.24]} />
          <meshStandardMaterial color={side < 0 ? '#54716b' : '#e4ded1'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
