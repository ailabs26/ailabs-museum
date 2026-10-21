import { useRef } from 'react';
import { Center, Loader, Stack, Text } from '@mantine/core';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { usePreviewModel } from './previewModel';
import type { LoadedPreview, PreviewState } from './previewModel';

function SpinningModel({ model }: { model: LoadedPreview }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.4;
  });
  const { scale, offset } = model.normalization;
  return (
    <group ref={ref}>
      <group scale={scale}>
        <group position={offset}>
          <primitive object={model.scene} />
        </group>
      </group>
    </group>
  );
}

/** Khung chờ/lỗi chung cho các khung xem mô hình 3D trong CMS. */
export function PreviewStatus({ state, height }: { state: Exclude<PreviewState, { status: 'ready' }>; height: number }) {
  return (
    <Center h={height} bg="gray.1" style={{ borderRadius: 4 }}>
      {state.status === 'loading' ? (
        <Stack align="center" gap={4}>
          <Loader size="sm" />
          <Text size="xs" c="dimmed">Đang tải mô hình…</Text>
        </Stack>
      ) : (
        <Text size="sm" c="red" ta="center" px="md">{state.message}</Text>
      )}
    </Center>
  );
}

export interface ModelPreviewProps {
  url: string;
  height?: number;
}

/** Xem trước GLB trong CMS: tự xoay, ánh sáng trung tính; lỗi định dạng hiện thông báo thay vì vỡ trang. */
export default function ModelPreview({ url, height = 280 }: ModelPreviewProps) {
  const state = usePreviewModel(url);
  if (state.status !== 'ready') return <PreviewStatus state={state} height={height} />;

  const { size } = state.model.normalization;
  return (
    <div style={{ height, borderRadius: 4, overflow: 'hidden', background: '#e9ecef' }}>
      <Canvas
        camera={{ position: [0, size[1] * 0.7, 3.4], fov: 40 }}
        onCreated={({ camera }) => camera.lookAt(0, size[1] / 2, 0)}
        aria-label="Xem trước mô hình 3D"
        role="img"
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} />
        <directionalLight position={[-4, 2, -3]} intensity={0.5} />
        <SpinningModel model={state.model} />
      </Canvas>
    </div>
  );
}
