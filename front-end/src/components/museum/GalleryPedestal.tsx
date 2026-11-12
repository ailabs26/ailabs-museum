import { EXHIBIT_PLINTH_SIZE } from '@/interfaces/museumScene';
import { useGallerySurfaces } from './GallerySurfaces';

/** `hero`/`standard` thuộc Gallery Template; `square` chỉ còn ở phòng legacy. */
export type PedestalKind = 'hero' | 'standard' | 'square';

/**
 * Bục vật lý, độc lập với nội dung hiện vật: phòng theo template luôn dựng đủ bục kể cả khi trống.
 * Mặt bục ở y = 1.14 (`ARTIFACT_BASE_Y`) cho mọi loại — model, hotspot và camera focus dùng chung mốc này.
 */
export function GalleryPedestal({ kind, hasTrim = false }: { kind: PedestalKind; hasTrim?: boolean }) {
  const { stone, walnut, bronze, charcoal, contact, glow } = useGallerySurfaces();
  const isHero = kind === 'hero', isRound = kind !== 'square';
  const footprint = isHero ? EXHIBIT_PLINTH_SIZE.centerpieceRadius : EXHIBIT_PLINTH_SIZE.roundRadius;
  return <>
    {/* Edge-transparent soft contact occlusion is also retained in the low tier. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]} raycast={() => {}} userData={{ xrIgnore: true }}>
      <planeGeometry args={[isHero ? 3.5 : 2.4, isHero ? 3.5 : 2.4]} />
      <meshBasicMaterial map={contact} transparent opacity={.65} depthWrite={false} />
    </mesh>
    <mesh position={[0, 0.04, 0]} material={charcoal} receiveShadow>
      {isRound ? <cylinderGeometry args={[footprint, footprint, 0.08, 32]} /> : <boxGeometry args={[EXHIBIT_PLINTH_SIZE.squareWidth, 0.08, EXHIBIT_PLINTH_SIZE.squareWidth]} />}
    </mesh>
    <mesh position={[0, 0.58, 0]} material={isHero ? stone : walnut} castShadow receiveShadow>
      {isRound ? <cylinderGeometry args={[isHero ? 1.1 : 0.66, isHero ? 1.16 : 0.7, 1.04, 32]} /> : <boxGeometry args={[1.05, 1.04, 1.05]} />}
    </mesh>
    <mesh position={[0, 1.12, 0]} material={bronze} castShadow receiveShadow>
      {isRound ? <cylinderGeometry args={[isHero ? 1.13 : 0.7, isHero ? 1.13 : 0.7, 0.04, 32]} /> : <boxGeometry args={[1.09, 0.04, 1.09]} />}
    </mesh>
    {/* Viền sáng chân bục của Gallery Template: emissive tĩnh, không thêm đèn. */}
    {hasTrim && isRound && <mesh position={[0, 0.1, 0]} material={glow} raycast={() => {}}>
      <cylinderGeometry args={[isHero ? 1.168 : 0.708, isHero ? 1.168 : 0.708, 0.03, 48, 1, true]} />
    </mesh>}
  </>;
}
