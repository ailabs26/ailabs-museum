import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LoadingManager } from 'three';
import { museumService } from '@/services/museum.service';
import type { PublicModel } from '@/validations/roomSchema';
import { disposeModel, validateGlb } from './glbAsset';
import { normalizeModel } from './modelNormalization';
import type { LoadedModel } from './roomModelAssets';

export async function loadMuseumModel(model: PublicModel, signal: AbortSignal, onProgress: (ratio: number) => void): Promise<LoadedModel> {
  const buffer = await museumService.getModelBinary(model, signal, onProgress);
  signal.throwIfAborted();
  validateGlb(buffer);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  if ([...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('') !== model.checksumSha256) {
    throw new Error('Nội dung GLB không khớp dữ liệu đã xuất bản.');
  }
  signal.throwIfAborted();
  const manager = new LoadingManager();
  // Embedded images use blob URLs. No secondary network requests are allowed.
  manager.setURLModifier(url => {
    if (!url.startsWith('blob:')) throw new Error('Mô hình chứa tài nguyên ngoài tệp.');
    return url;
  });
  const gltf = await new GLTFLoader(manager).parseAsync(buffer, '');
  try {
    signal.throwIfAborted();
    const normalization = normalizeModel(gltf.scene);
    return { scene: gltf.scene, scenes: gltf.scenes, normalization };
  } catch (error) { disposeModel(gltf.scenes); throw error; }
}
