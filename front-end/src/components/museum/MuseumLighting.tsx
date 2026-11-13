import { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Object3D, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GALLERY_LIGHTING_PRESET as PRESET, GALLERY_SLOT_TARGETS, getGalleryAccents, getGallerySpots, type GalleryLightTarget } from '@/helpers/galleryLighting';
import type { MuseumQuality } from '@/helpers/museumQuality';

/**
 * Light rig «Heritage Warm» dùng cho mọi phòng (xem `galleryLighting`): một nguồn đổ bóng, đèn chiếu theo
 * `targets` (bục của template hoặc vị trí hiện vật thật của phòng legacy), độc lập với số hiện vật của CMS.
 */
export function MuseumLighting({ shadowSize = 0, isRecovering = false, tier = 'balanced', targets = GALLERY_SLOT_TARGETS }: {
  shadowSize?: number; isRecovering?: boolean; tier?: MuseumQuality['tier']; targets?: readonly GalleryLightTarget[];
}) {
  const { gl, scene, invalidate } = useThree();
  // Chỉ dựng lại đèn khi vị trí cần chiếu đổi, không theo mỗi lần mảng `targets` được tạo mới.
  const targetKey = targets.map(({ id, position, isHero }) => `${id}:${position.join(',')}:${isHero}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableTargets = useMemo(() => targets, [targetKey]);
  const spots = useMemo(() => getGallerySpots(tier, stableTargets).map(spot => {
    const target = new Object3D(); target.position.set(...spot.target); return { ...spot, object: target };
  }), [tier, stableTargets]);
  const accents = useMemo(() => getGalleryAccents(tier, stableTargets), [tier, stableTargets]);
  useLayoutEffect(() => { invalidate(); }, [spots, accents, invalidate]);
  useLayoutEffect(() => {
    if (isRecovering || gl.getContext().isContextLost()) return;
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, .04);
    const previous = scene.environment, previousIntensity = scene.environmentIntensity;
    scene.environment = environment.texture; scene.environmentIntensity = PRESET.environmentIntensity;
    generator.dispose(); room.dispose(); invalidate();
    return () => {
      scene.environment = previous; scene.environmentIntensity = previousIntensity;
      environment.dispose();
    };
  }, [gl, scene, invalidate, isRecovering]);
  return <>
    <ambientLight color={PRESET.ambient.color} intensity={PRESET.ambient.intensity} />
    <hemisphereLight args={[PRESET.hemisphere.sky, PRESET.hemisphere.ground, PRESET.hemisphere.intensity]} />
    {/* L1 — nguồn đổ bóng duy nhất. */}
    <directionalLight position={PRESET.key.position} color={PRESET.key.color} intensity={PRESET.key.intensity}
      castShadow={shadowSize > 0} shadow-mapSize={[shadowSize || 512, shadowSize || 512]}
      shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={10} shadow-camera-bottom={-10}
      shadow-camera-near={.1} shadow-camera-far={25} shadow-bias={-.00025} shadow-normalBias={.035} shadow-radius={3} />
    {/* L2 — đèn chiếu hiện vật, không đổ bóng. */}
    {spots.map(spot => <group key={spot.id}>
      <primitive object={spot.object} />
      <spotLight position={spot.position} target={spot.object} color={spot.color} intensity={spot.intensity}
        angle={spot.angle} penumbra={spot.penumbra} distance={spot.distance} decay={2} />
    </group>)}
    {/* L4 — hắt tường phụ jade/xanh lam, không đổ bóng. */}
    {accents.map(accent => <pointLight key={accent.id} position={accent.position} color={accent.color}
      intensity={accent.intensity} distance={accent.distance} decay={2} />)}
  </>;
}
