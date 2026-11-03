import { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Object3D, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** One shadow map; two broad exhibition accents, independent of CMS item count. */
export function MuseumLighting({ shadowSize = 0, isRecovering = false }: { shadowSize?: number; isRecovering?: boolean }) {
  const { gl, scene, invalidate } = useThree();
  const targets = useMemo(() => [-1, 1].map(side => {
    const target = new Object3D(); target.position.set(side * 4.8, 1.2, -3); return target;
  }), []);
  useLayoutEffect(() => {
    if (isRecovering || gl.getContext().isContextLost()) return;
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, .04);
    const previous = scene.environment, previousIntensity = scene.environmentIntensity;
    scene.environment = environment.texture; scene.environmentIntensity = .45;
    generator.dispose(); room.dispose(); invalidate();
    return () => {
      scene.environment = previous; scene.environmentIntensity = previousIntensity;
      environment.dispose();
    };
  }, [gl, scene, invalidate, isRecovering]);
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
