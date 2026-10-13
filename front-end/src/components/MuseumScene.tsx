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
import { INITIAL_CAMERA_POSITION, INITIAL_CAMERA_TARGET } from '@/helpers/museumCamera';
import classes from './MuseumScene.module.css';

export function MuseumScene({ displays, selectedId, onSelect }: {
  displays: readonly MuseumDisplay[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const [command, setCommand] = useState<CameraCommand | null>(null);
  const [isContextLost, setIsContextLost] = useState(false);
  const selectedDisplay = displays.find((display) => display.id === selectedId);
  const handleContextLost = useCallback(() => setIsContextLost(true), []);
  const handleCommand = (action: CameraAction) => setCommand((previous) => ({ action, sequence: (previous?.sequence ?? 0) + 1 }));
  if (isContextLost) return <SceneFallback />;
  return (
    <div className={classes.scene}>
    <div className={classes.canvasFrame}>
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: INITIAL_CAMERA_POSITION, fov: 60, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'low-power', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
      fallback={<SceneFallback />}
      onCreated={({ camera }) => camera.lookAt(...INITIAL_CAMERA_TARGET)}
    >
      <color attach="background" args={['#eee9df']} />
      <MuseumLighting />
      <SceneLifecycle onContextLost={handleContextLost} />
      <MuseumControls command={command} selectedDisplay={selectedDisplay} />
      <MuseumRoom />
      {displays.filter((display) => !display.isOutsideRoom).map((display) => <ExhibitionDisplay key={display.id} display={display} isSelected={display.id === selectedId} onSelect={onSelect} />)}
    </Canvas>
    </div>
    <Group className={classes.toolbar} gap="xs" aria-label="Điều khiển góc nhìn">
      <Button variant="default" onClick={() => handleCommand('reset')}>Góc nhìn ban đầu</Button>
      <Button variant="default" onClick={() => handleCommand('in')}>Đến gần</Button>
      <Button variant="default" onClick={() => handleCommand('out')}>Lùi xa</Button>
      <Button color="teal.9" disabled={!selectedDisplay || selectedDisplay.isOutsideRoom} onClick={() => handleCommand('focus')}>Tập trung hiện vật</Button>
    </Group>
    </div>
  );
}
