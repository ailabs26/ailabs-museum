import { useEffect, useState } from 'react';
import { LoadingManager } from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeModel, validateGlb } from '@/helpers/glbAsset';
import { normalizeModel } from '@/helpers/modelNormalization';
import type { ModelNormalization } from '@/helpers/modelNormalization';
import { sanitizeModel } from '@/helpers/sanitizeModel';

export interface LoadedPreview {
  scene: Object3D;
  scenes: Object3D[];
  normalization: ModelNormalization;
}

const INVALID_MODEL_MESSAGE =
  'Không dựng được mô hình 3D: tệp không có hình khối hiển thị được hoặc dùng tính năng glTF chưa hỗ trợ.';

/**
 * Tải GLB từ URL đã ký rồi parse như tour 3D: kiểm header glTF, chặn tài nguyên ngoài
 * tệp, gỡ mesh bất thường, chuẩn hóa kích thước. Không kiểm checksum (CMS chỉ xem trước).
 */
export async function loadPreviewModel(url: string, signal: AbortSignal): Promise<LoadedPreview> {
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

export type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; model: LoadedPreview };

/** Tải mô hình theo URL; hủy tải và giải phóng GPU khi URL đổi hoặc component unmount. */
export function usePreviewModel(url: string): PreviewState {
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

  return state;
}
