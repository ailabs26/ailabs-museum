import { GalleryArchitecture } from './GalleryArchitecture';
import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';
import { useGallerySurfaces } from './GallerySurfaces';

/** Preserve API placement bounds: x ±7, z ±8, floor 0, ceiling 5 metres. */
export function MuseumRoom() {
  const { stone, plaster } = useGallerySurfaces();
  return (
    <group>
      <GalleryArchitecture />
      <mesh position={[0, -0.12, 0]} userData={{ museumFloor: true }} material={stone} receiveShadow>
        <boxGeometry args={[MUSEUM_ROOM_SIZE.width + 0.4, 0.24, MUSEUM_ROOM_SIZE.depth + 0.4]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (MUSEUM_ROOM_SIZE.width / 2 + 0.12), MUSEUM_ROOM_SIZE.height / 2, 0]} material={plaster} receiveShadow>
          <boxGeometry args={[0.24, MUSEUM_ROOM_SIZE.height, MUSEUM_ROOM_SIZE.depth + 0.4]} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, MUSEUM_ROOM_SIZE.height / 2, side * (MUSEUM_ROOM_SIZE.depth / 2 + 0.12)]} material={plaster} receiveShadow>
          <boxGeometry args={[MUSEUM_ROOM_SIZE.width, MUSEUM_ROOM_SIZE.height, 0.24]} />
        </mesh>
      ))}
    </group>
  );
}
