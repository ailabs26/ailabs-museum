import { Canvas, events } from '@react-three/fiber';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Group } from '@mantine/core';
import { ACESFilmicToneMapping } from 'three';
import { MuseumRoom } from '@/components/museum/MuseumRoom';
import { ExhibitionDisplay } from '@/components/museum/ExhibitionDisplay';
import { MuseumLighting } from '@/components/museum/MuseumLighting';
import { MuseumControls, type CameraAction, type CameraCommand } from '@/components/museum/MuseumControls';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { SceneLifecycle } from '@/components/museum/SceneLifecycle';
import { INITIAL_CAMERA_POSITION, INITIAL_CAMERA_TARGET } from '@/helpers/museumCamera';
import classes from './MuseumScene.module.css';
import { useRoomModels } from '@/hooks/useRoomModels';
import { ModelLoadingStatus } from '@/components/museum/ModelLoadingStatus';

// Labels render over solid geometry. Picking follows that same visual order;
// intersecting labels still use nearest-first ordering within their layer.
const createMuseumEvents: typeof events = (store) => ({
  ...events(store),
  filter: (hits) => [...hits].sort((left, right) =>
    Number(right.object.userData.museumLabel === true) - Number(left.object.userData.museumLabel === true) || left.distance - right.distance),
});

export function MuseumScene({ displays, selectedId, onSelect, onClear, fallback }: {
  displays: readonly MuseumDisplay[]; selectedId: string | null; onSelect: (id: string) => void; onClear: () => void;
  fallback: ReactNode;
}) {
  const [command, setCommand] = useState<CameraCommand | null>(null);
  const [isContextLost, setIsContextLost] = useState(false);
  const pointerRef = useRef({ x: 0, y: 0, dragged: false });
  const { models, retry } = useRoomModels(isContextLost ? [] : displays);
  const selectedDisplay = displays.find((display) => display.id === selectedId);
  const selectedModel = selectedDisplay?.model ? models[selectedDisplay.model.checksumSha256] : undefined;
  const selectedAsset = selectedModel?.status === 'ready' ? selectedModel.asset : undefined;
  const focusBounds = useMemo(() => selectedDisplay && selectedAsset ? {
    center: [selectedDisplay.position[0], selectedDisplay.position[1] + 1.14 + selectedAsset.normalization.center[1], selectedDisplay.position[2]] as [number, number, number],
    radius: selectedAsset.normalization.radius,
  } : undefined, [selectedDisplay, selectedAsset]);
  const handleContextLost = useCallback(() => setIsContextLost(true), []);
  const handleCommand = (action: CameraAction) => setCommand((previous) => ({ action, sequence: (previous?.sequence ?? 0) + 1 }));
  if (isContextLost) return fallback;
  return (
    <div className={classes.scene}>
    <div className={classes.canvasFrame}
      onPointerDownCapture={(event) => { pointerRef.current = { x: event.clientX, y: event.clientY, dragged: !event.isPrimary }; }}
      onPointerMoveCapture={(event) => {
        if (Math.hypot(event.clientX - pointerRef.current.x, event.clientY - pointerRef.current.y) > 5) pointerRef.current.dragged = true;
      }}>
    <Canvas
      events={createMuseumEvents}
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: INITIAL_CAMERA_POSITION, fov: 60, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'low-power', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
      // R3F mounts this inside <canvas> even when WebGL works; no failure callbacks here.
      fallback="Trình duyệt không hiển thị được canvas. Nội dung hiện vật vẫn có trong danh mục bên dưới."
      onPointerMissed={(event) => { if (event.type === 'click' && !pointerRef.current.dragged) onClear(); }}
      onCreated={({ camera }) => camera.lookAt(...INITIAL_CAMERA_TARGET)}
    >
      <color attach="background" args={['#eee9df']} />
      <MuseumLighting />
      <SceneLifecycle onContextLost={handleContextLost} />
      <MuseumControls command={command} selectedDisplay={selectedDisplay} focusBounds={focusBounds} />
      <MuseumRoom />
      {displays.filter((display) => !display.isOutsideRoom).map((display) => <ExhibitionDisplay key={display.id} display={display} isSelected={display.id === selectedId} onSelect={onSelect} modelState={display.model ? models[display.model.checksumSha256] : undefined} />)}
    </Canvas>
    </div>
    <Group className={classes.toolbar} gap="xs" aria-label="Điều khiển góc nhìn">
      <Button variant="default" onClick={() => handleCommand('reset')}>Góc nhìn ban đầu</Button>
      <Button variant="default" onClick={() => handleCommand('in')}>Đến gần</Button>
      <Button variant="default" onClick={() => handleCommand('out')}>Lùi xa</Button>
      <Button color="teal.9" disabled={!selectedDisplay || selectedDisplay.isOutsideRoom} onClick={() => handleCommand('focus')}>Tập trung hiện vật</Button>
    </Group>
    <ModelLoadingStatus displays={displays} models={models} onRetry={retry} />
    </div>
  );
}
