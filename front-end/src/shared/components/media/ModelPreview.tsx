import { useEffect, useRef, useState } from 'react';
import { Center, Loader, Stack, Text } from '@mantine/core';
import { Canvas, useFrame } from '@react-three/fiber';
import { LoadingManager } from 'three';
import type { Group, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeModel, validateGlb } from '@/helpers/glbAsset';
import { normalizeModel } from '@/helpers/modelNormalization';
import type { ModelNormalization } from '@/helpers/modelNormalization';
import { sanitizeModel } from '@/helpers/sanitizeModel';

interface LoadedPreview {
  scene: Object3D;
  scenes: Object3D[];
  normalization: ModelNormalization;
}

const INVALID_MODEL_MESSAGE =
  'Không dựng được mô hình 3D: tệp không có hình khối hiển thị được hoặc dùng tính năng glTF chưa hỗ trợ.';

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; model: LoadedPreview };

/**
 * Tải GLB từ URL đã ký rồi parse như tour 3D: kiểm header glTF, chặn tài nguyên ngoài
 * tệp, gỡ mesh bất thường, chuẩn hóa kích thước. Không kiểm checksum (CMS chỉ xem trước).
 */
async function loadPreviewModel(url: string, signal: AbortSignal): Promise<LoadedPreview> {
  const response = await fetch(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error(`Không tải được mô hình (HTTP ${response.status}).`);
  const buffer = await response.arrayBuffer();
  signal.throwIfAborted();

  let scenes: Object3D[] = [];
  try {
    validateGlb(buffer);
    const manager = new LoadingManager();
    manager.setURLModifier((resource) => {
      if (!resource.startsWith('blob:')) throw new Error('external resource');
      return resource;
    });
    const gltf = await new GLTFLoader(manager).parseAsync(buffer, '');
    scenes = [...gltf.scenes];
    const { quarantined } = sanitizeModel(gltf.scene);
    scenes.push(...quarantined);
    return { scene: gltf.scene, scenes, normalization: normalizeModel(gltf.scene) };
  } catch {
    disposeModel(scenes);
    // Lỗi của loader/three là thông điệp kỹ thuật — báo người dùng điều họ hiểu được.
    throw new Error(INVALID_MODEL_MESSAGE);
  }
}

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

export interface ModelPreviewProps {
  url: string;
  height?: number;
}

/** Xem trước GLB trong CMS: tự xoay, ánh sáng trung tính; lỗi định dạng hiện thông báo thay vì vỡ trang. */
export default function ModelPreview({ url, height = 280 }: ModelPreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    let loaded: LoadedPreview | null = null;
    setState({ status: 'loading' });
    loadPreviewModel(url, controller.signal)
      .then((model) => {
        loaded = model;
        if (!controller.signal.aborted) setState({ status: 'ready', model });
        else disposeModel(model.scenes);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Không mở được mô hình.' });
      });
    return () => {
      controller.abort();
      if (loaded) disposeModel(loaded.scenes);
    };
  }, [url]);

  if (state.status !== 'ready') {
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
