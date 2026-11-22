import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { GlbLoadError, type LoadedGlbAsset, type LoadGlbOptions } from './glbLoader';
import * as glbValidation from './glbValidation';
import type { MuseumDisplay } from './museumTypes';
import { RoomModelManager } from './roomModelManager';

function createExhibitWithModel(id: string, checksumChar: string): MuseumDisplay {
  const sha = checksumChar.repeat(64);
  return {
    id,
    title: id,
    description: '',
    position: [0, 0, -2],
    shape: 'cube',
    color: '#0F766E',
    model: {
      id: '10000000-0000-4000-8000-000000000001',
      storageKey: `models/${id}.glb`,
      sizeBytes: 1024,
      checksumSha256: sha,
      url: `/rooms/demo/exhibits/10000000-0000-4000-8000-000000000001/model?version=${sha}`,
    },
  };
}

function makeFakeAsset(checksumSha256: string): LoadedGlbAsset {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  return {
    modelId: '10000000-0000-4000-8000-000000000001',
    checksumSha256,
    scene,
    scenes: [scene],
    normalization: {
      scale: 1,
      offset: [0, 0, 0],
      size: [1, 1, 1],
      center: [0, 0.5, 0],
      radius: 0.86,
    },
    quarantinedMeshCount: 0,
    source: 'cache',
    sizeBytes: 1024,
    loadDurationMs: 5,
  };
}

describe('RoomModelManager (MOB-E6-04)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gộp checksum trùng, giới hạn đồng thời maxConcurrent = 2, cô lập lỗi và giải phóng GPU khi dispose', async () => {
    let activeNow = 0;
    let peakActive = 0;
    let calls = 0;
    const disposeSpy = jest.spyOn(glbValidation, 'disposeModel');

    const loaderImpl = async (options: LoadGlbOptions): Promise<LoadedGlbAsset> => {
      calls += 1;
      activeNow += 1;
      peakActive = Math.max(peakActive, activeNow);
      await new Promise((resolve) => setTimeout(resolve, 15));
      activeNow -= 1;

      if (options.model.checksumSha256.startsWith('e')) {
        throw new GlbLoadError('download', 'missing', 'Mô hình đã bị gỡ.');
      }
      return makeFakeAsset(options.model.checksumSha256);
    };

    const displays: MuseumDisplay[] = [
      createExhibitWithModel('ex-1', 'a'),
      createExhibitWithModel('ex-2', 'a'), // trùng checksum 'a' với ex-1 -> không tải lại!
      createExhibitWithModel('ex-3', 'b'),
      createExhibitWithModel('ex-4', 'c'),
      createExhibitWithModel('ex-5', 'e'), // lỗi 404 -> không ảnh hưởng các hiện vật khác
    ];

    const manager = new RoomModelManager({ maxConcurrent: 2, loaderImpl });
    const states = await manager.loadRoomDisplays(displays);

    // 4 checksum khác nhau (a, b, c, e) -> chỉ tải đúng 4 lần thay vì 5.
    expect(calls).toBe(4);
    expect(peakActive).toBeLessThanOrEqual(2);
    expect(states.get('ex-1')?.status).toBe('ready');
    expect(states.get('ex-2')?.status).toBe('ready');
    expect(states.get('ex-3')?.status).toBe('ready');
    expect(states.get('ex-4')?.status).toBe('ready');
    expect(states.get('ex-5')).toMatchObject({ status: 'error', category: 'missing' });

    // Khi rời phòng -> giải phóng GPU cho đúng 3 asset thành công (a, b, c).
    manager.dispose();
    expect(disposeSpy).toHaveBeenCalledTimes(3);
  });
});
