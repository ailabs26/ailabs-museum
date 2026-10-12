import { Canvas } from '@react-three/fiber';
import { useCallback, useState } from 'react';
import { Button, Group } from '@mantine/core';
import { ACESFilmicToneMapping } from 'three';
import { SceneFallback } from '@/components/museum/SceneFallback';
import { MuseumRoom } from '@/components/museum/MuseumRoom';
import { ExhibitionDisplay } from '@/components/museum/ExhibitionDisplay';
import { MuseumLighting } from '@/components/museum/MuseumLighting';
import { MuseumControls, type CameraAction, type CameraCommand } from '@/components/museum/MuseumControls';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { SceneLifecycle } from '@/components/museum/SceneLifecycle';

export function MuseumScene({ displays }: { displays: readonly MuseumDisplay[] }) {
  const [command, setCommand] = useState<CameraCommand | null>(null);
  const [isContextLost, setIsContextLost] = useState(false);
  const handleContextLost = useCallback(() => setIsContextLost(true), []);
  const handleCommand = (action: CameraAction) => setCommand((previous) => ({ action, sequence: (previous?.sequence ?? 0) + 1 }));
  if (isContextLost) return <SceneFallback />;
  return (
    <>
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 2.6, 5.8], fov: 60, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'low-power', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      fallback={<SceneFallback />}
      onCreated={({ camera }) => camera.lookAt(0, 1.35, 0)}
    >
      <color attach="background" args={['#eee9df']} />
      <MuseumLighting />
      <SceneLifecycle onContextLost={handleContextLost} />
      <MuseumControls command={command} />
      <MuseumRoom />
      {displays.map((display) => <ExhibitionDisplay key={display.id} display={display} />)}
    </Canvas>
    <Group pos="absolute" bottom={16} left={16} right={16} gap="xs" aria-label="Điều khiển góc nhìn">
      <Button variant="default" onClick={() => handleCommand('reset')}>Góc nhìn ban đầu</Button>
      <Button variant="default" onClick={() => handleCommand('in')}>Đến gần</Button>
      <Button variant="default" onClick={() => handleCommand('out')}>Lùi xa</Button>
    </Group>
    </>
  );
}
