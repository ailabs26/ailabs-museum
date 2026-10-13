import { GalleryArchitecture } from './GalleryArchitecture';
import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';

/** Preserve API placement bounds: x ±7, z ±8, floor 0, ceiling 5 metres. */
export function MuseumRoom() {
  return (
    <group>
      <GalleryArchitecture />
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[MUSEUM_ROOM_SIZE.width + 0.4, 0.24, MUSEUM_ROOM_SIZE.depth + 0.4]} />
        <meshStandardMaterial color="#d9d0bf" roughness={0.86} metalness={0.02} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (MUSEUM_ROOM_SIZE.width / 2 + 0.12), MUSEUM_ROOM_SIZE.height / 2, 0]}>
          <boxGeometry args={[0.24, MUSEUM_ROOM_SIZE.height, MUSEUM_ROOM_SIZE.depth + 0.4]} />
          <meshStandardMaterial color="#eee8dc" roughness={0.94} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, MUSEUM_ROOM_SIZE.height / 2, side * (MUSEUM_ROOM_SIZE.depth / 2 + 0.12)]}>
          <boxGeometry args={[MUSEUM_ROOM_SIZE.width, MUSEUM_ROOM_SIZE.height, 0.24]} />
          <meshStandardMaterial color={side < 0 ? '#526660' : '#eee8dc'} roughness={0.94} />
        </mesh>
      ))}
    </group>
  );
}
