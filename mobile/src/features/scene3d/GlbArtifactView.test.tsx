import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { GlbArtifactView } from './GlbArtifactView';
import * as glbLoader from './glbLoader';
import * as glbValidation from './glbValidation';
import type { PublicModel } from './glbSchema';

jest.mock('./GlbArtifactCanvas', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlbArtifactCanvas: () => React.createElement(View, { testID: 'mock-glb-canvas' }),
  };
});

describe('GlbArtifactView (MOB-E6-02)', () => {
  const sha = 'b'.repeat(64);
  const model: PublicModel = {
    id: '10000000-0000-4000-8000-000000000001',
    storageKey: 'models/drum.glb',
    sizeBytes: 2048,
    checksumSha256: sha,
    url: `/rooms/dong-son/exhibits/10000000-0000-4000-8000-000000000001/model?version=${sha}`,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hiển thị hiện vật từ bộ nhớ đệm cục bộ và giải phóng GPU (disposeModel) khi unmount', async () => {
    const scene = new Group();
    scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const disposeSpy = jest.spyOn(glbValidation, 'disposeModel');

    jest.spyOn(glbLoader, 'loadGlbModel').mockResolvedValue({
      modelId: model.id,
      checksumSha256: sha,
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
      sizeBytes: 2048,
      loadDurationMs: 12,
    });

    const { unmount } = render(
      <ThemeProvider>
        <GlbArtifactView title="Trống đồng Ngọc Lũ" model={model} />
      </ThemeProvider>,
    );

    expect(await screen.findByTestId('mock-glb-canvas')).toBeOnTheScreen();
    expect(screen.getByTestId('glb-source-badge')).toHaveTextContent(/Nguồn: Bộ nhớ đệm cục bộ/);

    unmount();
    expect(disposeSpy).toHaveBeenCalledWith([scene]);
  });

  it('hiển thị trạng thái lỗi rõ ràng khi 429/mất mạng và hỗ trợ Thử lại hoặc chuyển 2D', async () => {
    const onFallback2D = jest.fn();
    const scene = new Group();
    scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));

    const loadSpy = jest
      .spyOn(glbLoader, 'loadGlbModel')
      .mockRejectedValueOnce(
        new glbLoader.GlbLoadError('download', 'rate_limit', 'Quá nhiều yêu cầu tải mô hình.', 30),
      )
      .mockResolvedValueOnce({
        modelId: model.id,
        checksumSha256: sha,
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
        source: 'network',
        sizeBytes: 2048,
        loadDurationMs: 45,
      });

    render(
      <ThemeProvider>
        <GlbArtifactView title="Trống đồng" model={model} onFallback2D={onFallback2D} />
      </ThemeProvider>,
    );

    expect(await screen.findByTestId('glb-error-view')).toBeOnTheScreen();
    expect(screen.getByText(/30 giây/)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Xem mô tả hiện vật 2D' }));
    expect(onFallback2D).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole('button', { name: 'Thử tải lại mô hình 3D' }));
    await waitFor(() => expect(screen.getByTestId('mock-glb-canvas')).toBeOnTheScreen());
    expect(loadSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('glb-source-badge')).toHaveTextContent(/Nguồn: Tải từ máy chủ/);
  });
});
