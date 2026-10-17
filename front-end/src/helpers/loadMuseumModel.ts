import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LoadingManager } from 'three';
import type { Object3D } from 'three';
import { museumService } from '@/services/museum.service';
import type { PublicModel } from '@/validations/roomSchema';
import { disposeModel, validateGlb } from './glbAsset';
import { normalizeModel } from './modelNormalization';
import type { LoadedModel } from './roomModelAssets';
import { sanitizeModel } from './sanitizeModel';
import { ModelAssetError } from './modelDiagnostics';
import type { ModelStage } from './modelDiagnostics';

export async function loadMuseumModel(model: PublicModel, signal: AbortSignal, onProgress: (ratio: number) => void): Promise<LoadedModel> {
  const buffer = await museumService.getModelBinary(model, signal, onProgress);
  signal.throwIfAborted();
  try {
    validateGlb(buffer);
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    if ([...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('') !== model.checksumSha256) throw new Error();
  } catch { throw new ModelAssetError('validate', 'format'); }
  signal.throwIfAborted();
  const manager = new LoadingManager();
  // Embedded images use blob URLs. No secondary network requests are allowed.
  manager.setURLModifier(url => {
    if (!url.startsWith('blob:')) throw new Error('Mô hình chứa tài nguyên ngoài tệp.');
    return url;
  });
  let gltf;
  try { gltf = await new GLTFLoader(manager).parseAsync(buffer, ''); }
  catch { throw new ModelAssetError('parse', 'format'); }
  const ownedScenes: Object3D[] = [...gltf.scenes];
  let stage: ModelStage = 'mesh';
  try {
    signal.throwIfAborted();
    const { quarantined } = sanitizeModel(gltf.scene);
    ownedScenes.push(...quarantined);
    stage = 'normalize';
    const normalization = normalizeModel(gltf.scene);
    return { scene: gltf.scene, scenes: ownedScenes, normalization, quarantinedMeshCount: quarantined.length };
  } catch {
    disposeModel(ownedScenes);
    signal.throwIfAborted();
    throw new ModelAssetError(stage, stage === 'mesh' ? 'mesh' : 'format');
  }
}
