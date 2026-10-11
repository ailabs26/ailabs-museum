import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { SceneFallback } from '@/components/museum/SceneFallback';
import { MuseumRoom } from '@/components/museum/MuseumRoom';

export function MuseumScene() {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 2.6, 5.8], fov: 60, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'low-power', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      fallback={<SceneFallback />}
      onCreated={({ camera }) => camera.lookAt(0, 1.35, 0)}
    >
      <color attach="background" args={['#eee9df']} />
      <hemisphereLight args={['#fff3d6', '#69756f', 2]} />
      <MuseumRoom />
    </Canvas>
  );
}
