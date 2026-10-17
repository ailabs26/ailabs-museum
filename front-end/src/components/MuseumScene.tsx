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
import { ArtifactHotspotControls } from '@/components/museum/ArtifactHotspotControls';
import { getArtifactFocusBounds } from '@/helpers/artifactHotspots';
import type { ArtifactRenderState } from '@/components/museum/ArtifactModelBoundary';
import { reportModelFailure } from '@/helpers/modelDiagnostics';

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
  const [renderStates, setRenderStates] = useState<Record<string, ArtifactRenderState>>({});
  const pointerRef = useRef({ x: 0, y: 0, dragged: false });
  const { models, retry } = useRoomModels(isContextLost ? [] : displays);
  const selectedDisplay = displays.find((display) => display.id === selectedId);
  const selectedModel = selectedDisplay?.model ? models[selectedDisplay.model.checksumSha256] : undefined;
  const selectedAsset = selectedModel?.status === 'ready' && !renderStates[selectedDisplay?.id ?? '']?.failed ? selectedModel.asset : undefined;
  const focusBounds = useMemo(() => selectedDisplay?.model ? getArtifactFocusBounds(selectedDisplay, selectedAsset?.normalization)
    : undefined, [selectedDisplay, selectedAsset]);
  const handleContextLost = useCallback(() => setIsContextLost(true), []);
  const handleRenderError = (display: MuseumDisplay) => {
    const previous = renderStates[display.id];
    const attempts = previous?.checksum === display.model?.checksumSha256 ? previous.attempts : 0;
    setRenderStates(states => ({ ...states, [display.id]: { checksum: display.model!.checksumSha256, attempts, failed: true } }));
    reportModelFailure({ artifactId: display.id, roomId: display.roomId, attempt: attempts + 1, stage: 'render', category: 'render' });
  };
  const handleRetryRender = (id: string) => setRenderStates(states => {
    const state = states[id];
    return !state || !state.failed || state.attempts >= 3 ? states : { ...states, [id]: { ...state, failed: false, attempts: state.attempts + 1 } };
  });
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
      {displays.filter((display) => !display.isOutsideRoom).map((display) => <ExhibitionDisplay key={display.id} display={display} isSelected={display.id === selectedId} onSelect={onSelect}
        modelState={display.model ? models[display.model.checksumSha256] : undefined} renderAttempt={renderStates[display.id]?.attempts}
        hasRenderError={renderStates[display.id]?.checksum === display.model?.checksumSha256 && renderStates[display.id]?.failed}
        onRenderError={() => handleRenderError(display)} />)}
    </Canvas>
    </div>
    <Group className={classes.toolbar} gap="xs" aria-label="Điều khiển góc nhìn">
      <Button variant="default" onClick={() => handleCommand('reset')}>Góc nhìn ban đầu</Button>
      <Button variant="default" onClick={() => handleCommand('in')}>Đến gần</Button>
      <Button variant="default" onClick={() => handleCommand('out')}>Lùi xa</Button>
      <Button color="teal.9" disabled={!selectedDisplay || selectedDisplay.isOutsideRoom} onClick={() => handleCommand('focus')}>Tập trung hiện vật</Button>
    </Group>
    <ArtifactHotspotControls displays={displays} selectedId={selectedId} onSelect={onSelect} />
    <ModelLoadingStatus displays={displays} models={models} onRetry={retry} renderStates={renderStates} onRetryRender={handleRetryRender} />
    </div>
  );
}
