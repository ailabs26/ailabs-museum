import { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Object3D, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GALLERY_LIGHTING_PRESET as PRESET, getGalleryAccents, getGallerySpots } from '@/helpers/galleryLighting';
import type { MuseumQuality } from '@/helpers/museumQuality';

/**
 * One shadow map, independent of CMS item count. `legacy` keeps the two broad accents of
 * free-placement rooms; `rotunda` is the layered Gallery Template rig (see `galleryLighting`).
 */
export function MuseumLighting({ shadowSize = 0, isRecovering = false, variant = 'legacy', tier = 'balanced' }: {
  shadowSize?: number; isRecovering?: boolean; variant?: 'legacy' | 'rotunda'; tier?: MuseumQuality['tier'];
}) {
  const { gl, scene, invalidate } = useThree();
  const isRotunda = variant === 'rotunda';
  const spots = useMemo(() => (isRotunda ? getGallerySpots(tier) : []).map(spot => {
    const target = new Object3D(); target.position.set(...spot.target); return { ...spot, object: target };
  }), [isRotunda, tier]);
  const environmentIntensity = isRotunda ? PRESET.environmentIntensity : .45;
  useLayoutEffect(() => { invalidate(); }, [variant, tier, invalidate]);
  const targets = useMemo(() => [-1, 1].map(side => {
    const target = new Object3D(); target.position.set(side * 4.8, 1.2, -3); return target;
  }), []);
  useLayoutEffect(() => {
    if (isRecovering || gl.getContext().isContextLost()) return;
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, .04);
    const previous = scene.environment, previousIntensity = scene.environmentIntensity;
    scene.environment = environment.texture; scene.environmentIntensity = environmentIntensity;
    generator.dispose(); room.dispose(); invalidate();
    return () => {
      scene.environment = previous; scene.environmentIntensity = previousIntensity;
      environment.dispose();
    };
  }, [gl, scene, invalidate, isRecovering, environmentIntensity]);
  const shadow = { castShadow: shadowSize > 0, 'shadow-mapSize': [shadowSize || 512, shadowSize || 512] as [number, number],
    'shadow-camera-left': -9, 'shadow-camera-right': 9, 'shadow-camera-top': 10, 'shadow-camera-bottom': -10,
    'shadow-camera-near': .1, 'shadow-camera-far': 25, 'shadow-bias': -.00025, 'shadow-normalBias': .035, 'shadow-radius': 3 };
  if (isRotunda) return <>
    <ambientLight color={PRESET.ambient.color} intensity={PRESET.ambient.intensity} />
    <hemisphereLight args={[PRESET.hemisphere.sky, PRESET.hemisphere.ground, PRESET.hemisphere.intensity]} />
    {/* L1 — nguồn đổ bóng duy nhất. */}
    <directionalLight position={PRESET.key.position} color={PRESET.key.color} intensity={PRESET.key.intensity} {...shadow} />
    {/* L2 — đèn chiếu bục, không đổ bóng. */}
    {spots.map(spot => <group key={spot.id}>
      <primitive object={spot.object} />
      <spotLight position={spot.position} target={spot.object} color={spot.color} intensity={spot.intensity}
        angle={spot.angle} penumbra={spot.penumbra} distance={spot.distance} decay={2} />
    </group>)}
    {/* L4 — hắt tường phụ jade/xanh lam, không đổ bóng. */}
    {getGalleryAccents(tier).map(accent => <pointLight key={accent.id} position={accent.position} color={accent.color}
      intensity={accent.intensity} distance={accent.distance} decay={2} />)}
  </>;
  return <>
    <ambientLight color="#f4f1e8" intensity={.18} />
    <hemisphereLight args={['#f4f0e6', '#8b8270', .85]} />
    <directionalLight position={[-3.5, 4.8, 4]} color="#fff1d9" intensity={2.3}
      castShadow={shadowSize > 0} shadow-mapSize={[shadowSize || 512, shadowSize || 512]}
      shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={10} shadow-camera-bottom={-10}
      shadow-camera-near={.1} shadow-camera-far={25} shadow-bias={-.00025} shadow-normalBias={.035} shadow-radius={3} />
    <directionalLight position={[5, 3.8, -5]} color="#e6edf4" intensity={.65} />
    {targets.map((target, index) => <group key={index}>
      <primitive object={target} />
      <spotLight position={[(index ? 1 : -1) * 4.5, 4.75, 0]} target={target} color="#ffe8c2" intensity={35}
        angle={.65} penumbra={1} distance={12} decay={2} />
    </group>)}
  </>;
}
