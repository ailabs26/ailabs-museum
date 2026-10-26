import { Canvas, events } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Group, Text } from '@mantine/core';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
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
import { createNavigationInput } from '@/helpers/museumNavigation';
import { NavigationGestures } from '@/helpers/navigationGestures';
import { NavigationHud, type NavigationMode } from '@/components/museum/NavigationHud';
import { SpatialMinimap } from '@/components/museum/SpatialMinimap';
import { ArtifactDock } from '@/components/museum/ArtifactDock';
import { PhotoCapture } from '@/components/museum/PhotoCapture';
import { downloadScenePhoto } from '@/helpers/scenePhoto';
import { notify } from '@/shared/components/feedback';
import { IconCamera, IconFocus2, IconHome, IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { MuseumXr } from '@/components/museum/MuseumXr';
import type { XrSessionController, XrSnapshot } from '@/helpers/xrSession';
import type { WebglStatus } from '@/helpers/webglRecovery';
import { GallerySurfaces } from '@/components/museum/GallerySurfaces';
import { useMuseumQuality } from '@/hooks/useMuseumQuality';

// Labels render over solid geometry. Picking follows that same visual order;
// intersecting labels still use nearest-first ordering within their layer.
const createMuseumEvents: typeof events = (store) => ({
  ...events(store),
  filter: (hits) => [...hits].sort((left, right) =>
    Number(right.object.userData.museumLabel === true) - Number(left.object.userData.museumLabel === true) || left.distance - right.distance),
});

export function MuseumScene({ displays, selectedId, onSelect, onClear, fallback, immersive = false, onXrChange }: {
  displays: readonly MuseumDisplay[]; selectedId: string | null; onSelect: (id: string) => void; onClear: () => void;
  fallback: ReactNode;
  immersive?: boolean;
  onXrChange?: (snapshot: XrSnapshot, owner: XrSessionController | null) => void;
}) {
  const quality = useMuseumQuality();
  const [command, setCommand] = useState<CameraCommand | null>(null);
  const [webglStatus, setWebglStatus] = useState<WebglStatus>('ready');
  const [xrOwner, setXrOwner] = useState<XrSessionController | null>(null);
  const [xrStatus, setXrStatus] = useState<XrSnapshot>({ capability: 'checking', phase: 'idle', message: '' });
  useEffect(() => { onXrChange?.(xrStatus, xrOwner); }, [onXrChange, xrStatus, xrOwner]);
  const [xrHoveredId, setXrHoveredId] = useState<string | null>(null);
  const [isRendererRestarting, setIsRendererRestarting] = useState(false);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const rendererResets = useRef(0);
  const isWebInputEnabled = !isRendererRestarting && webglStatus === 'ready' && xrStatus.phase === 'idle';
  const handleRendererReset = useCallback(() => {
    if (++rendererResets.current > 2) { setWebglStatus('failed'); return; }
    setIsRendererRestarting(true); setXrOwner(null);
    setXrStatus({ capability: 'checking', phase: 'idle', message: 'Đang khởi tạo lại phần hiển thị sau lỗi VR.' });
  }, []);
  useEffect(() => {
    if (!isRendererRestarting) return;
    // R3F 8 disposes an unmounted root after 500 ms. Retire that renderer before
    // creating another; the room model owner above Canvas remains mounted.
    const timer = window.setTimeout(() => {
      setCanvasEpoch(epoch => epoch + 1); setWebglStatus('ready'); setIsRendererRestarting(false);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [isRendererRestarting]);
  const [renderStates, setRenderStates] = useState<Record<string, ArtifactRenderState>>({});
  const input = useMemo(createNavigationInput, []);
  const gestures = useMemo(() => new NavigationGestures(), []);
  const [mode, setMode] = useState<NavigationMode>('explore');
  const [isActive, setIsActive] = useState(false);
  const [hasTouch, setHasTouch] = useState(false);
  useEffect(() => { setHasTouch(navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches); }, []);
  const handleSceneSelect = (id: string) => { if (gestures.canSelect) onSelect(id); };
  const { models, retry } = useRoomModels(displays);
  const selectedDisplay = displays.find((display) => display.id === selectedId);
  const selectedModel = selectedDisplay?.model ? models[selectedDisplay.model.checksumSha256] : undefined;
  const selectedRenderState = renderStates[selectedDisplay?.id ?? ''];
  const selectedAsset = selectedModel?.status === 'ready' && !(selectedRenderState?.checksum === selectedDisplay?.model?.checksumSha256 && selectedRenderState?.failed) ? selectedModel.asset : undefined;
  const focusBounds = useMemo(() => selectedDisplay?.model ? getArtifactFocusBounds(selectedDisplay, selectedAsset?.normalization)
    : undefined, [selectedDisplay, selectedAsset]);
  const handleWebglStatus = useCallback((status: WebglStatus) => setWebglStatus(status), []);
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
  const captureRef = useRef<(() => string | null) | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const handlePhoto = async () => {
    setIsCapturing(true);
    try {
      const ok = await downloadScenePhoto(captureRef.current?.() ?? null);
      if (ok) notify.success('Đã lưu ảnh kỷ niệm không gian 3D');
      else notify.error('Chưa chụp được ảnh. Hãy thử lại sau khi khung 3D hiển thị xong.');
    } finally {
      setIsCapturing(false);
    }
  };
  if (webglStatus === 'failed') return fallback;
  return (
    <div className={`${classes.scene} ${immersive ? classes.immersive : ''}`} data-quality-tier={quality.tier} data-webgl-status={webglStatus} data-xr-phase={xrStatus.phase}>
    <div className={classes.canvasFrame}
      onPointerDownCapture={event => { gestures.start(event.pointerId, event.clientX, event.clientY); if (event.pointerType === 'touch') setHasTouch(true); }}
      onPointerMoveCapture={event => gestures.move(event.pointerId, event.clientX, event.clientY)}
      onPointerUpCapture={event => gestures.end(event.pointerId)}
      onPointerCancelCapture={() => gestures.cancel()}>
    {!isRendererRestarting && <Canvas key={canvasEpoch}
      events={createMuseumEvents}
      frameloop="demand"
      dpr={[1, quality.dpr]}
      shadows={quality.shadowSize ? { type: PCFSoftShadowMap } : false}
      camera={{ position: INITIAL_CAMERA_POSITION, fov: 60, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: .96 }}
      // R3F mounts this inside <canvas> even when WebGL works; no failure callbacks here.
      fallback="Trình duyệt không hiển thị được canvas. Nội dung hiện vật vẫn có trong danh mục bên dưới."
      onPointerMissed={(event) => { if (isWebInputEnabled && event.type === 'click' && gestures.canSelect) onClear(); }}
      onCreated={({ camera }) => camera.lookAt(...INITIAL_CAMERA_TARGET)}
    >
      <color attach="background" args={['#eee9df']} />
      <MuseumLighting shadowSize={quality.shadowSize} isRecovering={webglStatus === 'recovering'} />
      <SceneLifecycle onStatus={handleWebglStatus} />
      <MuseumXr available={webglStatus === 'ready'} displays={displays} selectedId={selectedId} onSelect={onSelect}
        onController={setXrOwner} onStatus={setXrStatus} onHover={setXrHoveredId} onRendererReset={handleRendererReset} />
      <PhotoCapture bind={(fn) => { captureRef.current = fn; }} />
      <MuseumControls enabled={isWebInputEnabled} command={command} selectedDisplay={selectedDisplay} focusBounds={focusBounds}
        displays={displays} input={input} gestures={gestures} onModeChange={setMode} onActiveChange={setIsActive} />
      <GallerySurfaces anisotropy={quality.anisotropy}>
      <MuseumRoom />
      {displays.filter((display) => !display.isOutsideRoom).map((display) => <ExhibitionDisplay key={display.id} display={display} isSelected={display.id === selectedId} onSelect={handleSceneSelect}
        modelState={display.model ? models[display.model.checksumSha256] : undefined} renderAttempt={renderStates[display.id]?.attempts}
        hasRenderError={renderStates[display.id]?.checksum === display.model?.checksumSha256 && renderStates[display.id]?.failed}
        isXrHovered={xrHoveredId === display.id} onRenderError={() => handleRenderError(display)} />)}
      </GallerySurfaces>
    </Canvas>}
    {isRendererRestarting && <div className={classes.recovering} role="status">Đang khởi tạo lại phần hiển thị sau lỗi VR.</div>}
    {webglStatus !== 'ready' && <div className={classes.recovering} role="status">Đang khôi phục không gian 3D. Bạn có thể tiếp tục đọc danh mục.</div>}
    {isWebInputEnabled && <NavigationHud input={input} mode={mode} isActive={isActive} hasTouch={hasTouch} immersive={immersive} />}
    {isWebInputEnabled && <SpatialMinimap displays={displays} selectedId={selectedId} onSelect={onSelect} />}
    {isWebInputEnabled && <ArtifactDock displays={displays} selectedId={selectedId} onSelect={onSelect} />}
    </div>
    <Group className={classes.toolbar} gap="xs" aria-label="Điều khiển góc nhìn">
      <Button variant="default" aria-label="Góc nhìn ban đầu" title="Góc nhìn ban đầu (Home)" disabled={!isWebInputEnabled} onClick={() => handleCommand('reset')}>
        <IconHome size={18} aria-hidden="true" />{!immersive && 'Góc nhìn ban đầu'}
      </Button>
      <Button variant="default" aria-label="Tập trung hiện vật" title="Tập trung hiện vật (F)" disabled={!isWebInputEnabled || !selectedDisplay || selectedDisplay.isOutsideRoom} onClick={() => handleCommand('focus')}>
        <IconFocus2 size={18} aria-hidden="true" />{!immersive && 'Tập trung hiện vật'}
      </Button>
      <Button variant="default" aria-label="Chụp ảnh" title="Chụp ảnh" disabled={!isWebInputEnabled || isCapturing}
        loading={isCapturing} onClick={() => void handlePhoto()}><IconCamera size={18} aria-hidden="true" />{!immersive && 'Chụp ảnh'}</Button>
      <details className={classes.moreControls}><summary aria-label="Thêm điều khiển" title="Thêm điều khiển"><IconAdjustmentsHorizontal size={18} aria-hidden="true" /></summary>
        <div>
          <Button variant="default" disabled={!isWebInputEnabled} onClick={() => handleCommand('in')}>Đến gần</Button>
          <Button variant="default" disabled={!isWebInputEnabled} onClick={() => handleCommand('out')}>Lùi xa</Button>
          <Text size="xs" role="status">{xrStatus.message || (xrStatus.capability === 'checking' ? 'Đang kiểm tra VR…'
            : xrStatus.capability === 'unavailable' ? 'VR không khả dụng trong trình duyệt hoặc thiết bị này. Bạn vẫn có thể tham quan 3D.' : '')}</Text>
        </div>
      </details>
      {xrStatus.capability === 'ready' && xrStatus.phase === 'idle' && <Button disabled={webglStatus !== 'ready' || !xrOwner} onClick={() => {
        onXrChange?.({ ...xrStatus, phase: 'requesting' }, xrOwner); void xrOwner?.enter();
      }}>Enter VR</Button>}
      {xrStatus.phase === 'requesting' && <Button disabled>Đang vào VR…</Button>}
      {(xrStatus.phase === 'active' || xrStatus.phase === 'ending') && <Button disabled={xrStatus.phase === 'ending'} onClick={() => { void xrOwner?.exit(); }}>Exit VR</Button>}
    </Group>
    <details className={classes.hotspotMenu}><summary>Điểm tương tác</summary>
      <ArtifactHotspotControls displays={displays} selectedId={selectedId} onSelect={onSelect} />
    </details>
    <div className={classes.modelStatus}><ModelLoadingStatus displays={displays} models={models} onRetry={retry} renderStates={renderStates} onRetryRender={handleRetryRender} /></div>
    </div>
  );
}
