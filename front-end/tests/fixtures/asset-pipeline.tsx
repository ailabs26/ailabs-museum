import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Group, MantineProvider, Stack } from '@mantine/core';
import { Canvas, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { z } from 'zod';
import '@mantine/core/styles.css';
import { ExhibitionDisplay } from '@/components/museum/ExhibitionDisplay';
import { GallerySurfaces } from '@/components/museum/GallerySurfaces';
import { useRoomModels } from '@/hooks/useRoomModels';
import { modelLodSetSchema } from '@/helpers/modelLod';
import { publicModelSchema } from '@/validations/roomSchema';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import ModelPreview from '@/shared/components/media/ModelPreview';
import { parseSelfContainedGlb } from '@/helpers/parseSelfContainedGlb';
import { disposeModel } from '@/helpers/glbAsset';

const fixtureSchema = z.object({ source: publicModelSchema, lodSet: modelLodSetSchema.optional() });
type FixtureData = z.infer<typeof fixtureSchema>;

function CameraPose({ distance, center }: { distance: number; center: readonly number[] }) {
  const { camera, invalidate } = useThree();
  const [x, y, z] = center;
  useLayoutEffect(() => {
    camera.position.set(x, y, z + distance);
    camera.lookAt(x, y, z);
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, invalidate, distance, x, y, z]);
  return null;
}

/** Uses the production owner, renderer and picking path with test-owned descriptors. */
function AssetScene({ config, distance, selected, onSelect }: {
  config: FixtureData; distance: number; selected: boolean; onSelect: () => void;
}) {
  const displays = useMemo<readonly MuseumDisplay[]>(() => [{
    id: config.source.id, roomId: '00000000-0000-4000-8000-000000000001',
    title: 'Synthetic ceramic', description: 'Generated curved mesh for pipeline verification',
    position: [0, 0, 0], shape: 'sphere', color: '#a66a3c', model: config.source,
    hotspots: [{ id: 'pipeline-hotspot', label: 'Synthetic detail', body: 'Test annotation', position: [2, 1, -3] }],
  }], [config.source]);
  const sets = useMemo(() => config.lodSet ? [config.lodSet] : [], [config.lodSet]);
  const { models, selectLod, retainModel } = useRoomModels(displays, sets);
  const state = models[config.source.checksumSha256];
  const [renderError, setRenderError] = useState(false);
  const center = config.lodSet?.normalization.center ?? [0, 0.9, 0];
  const target = [center[0], center[1] + 1.14, center[2]];
  return <>
    <output data-testid="asset-status" data-level={state?.status === 'ready' ? state.level ?? 0 : ''}>
      {renderError ? 'render-error' : state?.status ?? 'queued'}
    </output>
    <div style={{ width: 800, height: 600 }}>
      <Canvas frameloop="demand" dpr={1} camera={{ fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, outputColorSpace: SRGBColorSpace,
          toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.96 }}
        onCreated={({ gl }) => { gl.domElement.setAttribute('aria-label', 'Asset fixture canvas'); }}>
        <color attach="background" args={['#eee9df']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 4]} intensity={2} />
        <CameraPose distance={distance} center={target} />
        <GallerySurfaces anisotropy={2}>
          <ExhibitionDisplay display={displays[0]} isSelected={selected} onSelect={onSelect}
            modelState={state} lodSet={config.lodSet} isFocused={selected} onLodChange={selectLod}
            onRetainModel={retainModel}
            hasRenderError={renderError} onRenderError={() => setRenderError(true)} />
        </GallerySurfaces>
      </Canvas>
    </div>
  </>;
}

function Fixture() {
  const [config, setConfig] = useState<FixtureData | null>(null);
  const [error, setError] = useState('');
  const [distance, setDistance] = useState(new URLSearchParams(location.search).has('capture') ? 3 : 35);
  const [selected, setSelected] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [measurement, setMeasurement] = useState<{ downloadMs: number; parseDecodeMs: number; bytes: number } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const measurementController = useRef<AbortController | null>(null);
  const preview = new URLSearchParams(location.search).has('preview');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/tests/fixtures/asset-pipeline-data.json', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Fixture config unavailable'); return response.json(); })
      .then(value => setConfig(fixtureSchema.parse(value)))
      .catch(reason => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, []);
  useEffect(() => () => measurementController.current?.abort(), []);
  const measure = async () => {
    if (!config) return;
    const controller = new AbortController();
    measurementController.current = controller;
    setMeasuring(true);
    try {
      const downloadStarted = performance.now();
      const response = await fetch(config.source.url, { signal: controller.signal });
      if (!response.ok) throw new Error('Measurement source unavailable');
      const buffer = await response.arrayBuffer();
      const downloadMs = performance.now() - downloadStarted;
      const parseStarted = performance.now();
      const gltf = await parseSelfContainedGlb(buffer, controller.signal);
      const parseDecodeMs = performance.now() - parseStarted;
      disposeModel(gltf.scenes);
      setMeasurement({ downloadMs, parseDecodeMs, bytes: buffer.byteLength });
    } catch (reason) {
      if (!controller.signal.aborted) setError(String(reason));
    } finally {
      if (!controller.signal.aborted) setMeasuring(false);
    }
  };
  return <MantineProvider><Stack p="md" gap="sm">
    <Group aria-label="Asset fixture controls">
      <Button onClick={() => setDistance(35)}>Far</Button>
      <Button onClick={() => setDistance(8)}>Medium</Button>
      <Button onClick={() => setDistance(3)}>Near</Button>
      <Button onClick={() => setSelected(true)}>Select</Button>
      <Button onClick={() => setSelected(false)}>Unselect</Button>
      <Button onClick={() => setMounted(false)}>Unmount</Button>
      <Button onClick={() => setMounted(true)}>Remount</Button>
      <Button disabled={!config || measuring} onClick={() => void measure()}>Measure</Button>
    </Group>
    <output data-testid="selection">{selected ? 'selected' : 'unselected'}</output>
    <output data-testid="measurement" data-status={measuring ? 'running' : measurement ? 'complete' : 'idle'}>
      {measurement ? JSON.stringify(measurement) : ''}
    </output>
    {error && <p role="alert">{error}</p>}
    {!mounted ? <output data-testid="unmounted">unmounted</output> : config && (preview
      ? <ModelPreview url={config.source.url} height={600} />
      : <AssetScene config={config} distance={distance} selected={selected} onSelect={() => setSelected(true)} />)}
  </Stack></MantineProvider>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
