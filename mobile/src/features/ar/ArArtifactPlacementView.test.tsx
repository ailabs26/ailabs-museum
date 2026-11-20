import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { InMemoryGlbCache } from '@/features/scene3d/glbCache';
import type { MuseumDisplay } from '@/features/scene3d/museumTypes';
import type { ViroRuntimeComponents } from './arBridge';
import { ArArtifactPlacementView } from './ArArtifactPlacementView';

function createInteractiveMockViro() {
  let onPlaneSelectedRef: ((anchor: { position: [number, number, number] }) => void) | null = null;
  let onPinchRef: ((state: number, factor: number) => void) | null = null;
  let onRotateRef: ((state: number, factor: number) => void) | null = null;
  let last3DObjectProps: Record<string, unknown> | null = null;

  const Passthrough = ({ children, ...rest }: Record<string, unknown>) =>
    React.createElement(View, rest, children as React.ReactNode);

  const viro: ViroRuntimeComponents = {
    ViroARSceneNavigator: ({ initialScene }: Record<string, unknown>) => {
      const SceneComp = (initialScene as { scene: React.ComponentType }).scene;
      return React.createElement(
        View,
        { testID: 'mock-ar-nav' },
        React.createElement(SceneComp),
      );
    },
    ViroARScene: Passthrough,
    ViroARPlaneSelector: ({ children, onPlaneSelected }: Record<string, unknown>) => {
      onPlaneSelectedRef = (onPlaneSelected as typeof onPlaneSelectedRef) ?? null;
      return React.createElement(View, { testID: 'mock-plane-selector' }, children as React.ReactNode);
    },
    ViroNode: ({ children, onPinch, onRotate }: Record<string, unknown>) => {
      onPinchRef = (onPinch as typeof onPinchRef) ?? null;
      onRotateRef = (onRotate as typeof onRotateRef) ?? null;
      return React.createElement(View, { testID: 'mock-placed-node' }, children as React.ReactNode);
    },
    Viro3DObject: (props: Record<string, unknown>) => {
      last3DObjectProps = props;
      return React.createElement(View, { testID: 'mock-ar-glb-object' });
    },
    ViroBox: () => React.createElement(View, { testID: 'mock-ar-fallback-box' }),
    ViroSphere: Passthrough,
    ViroText: Passthrough,
    ViroAmbientLight: Passthrough,
    ViroDirectionalLight: Passthrough,
  };

  return {
    viro,
    selectPlane: (position: [number, number, number]) => onPlaneSelectedRef?.({ position }),
    pinch: (state: number, factor: number) => onPinchRef?.(state, factor),
    rotate: (state: number, factor: number) => onRotateRef?.(state, factor),
    getLast3DObjectProps: () => last3DObjectProps,
  };
}

describe('ArArtifactPlacementView — tích hợp cache GLB thật + mặt phẳng + xoay/zoom (MOB-E9-02)', () => {
  it('đọc tệp GLB thật từ cache MOB-E6-02, đặt lên mặt phẳng và xoay/phóng to ổn định', async () => {
    // Dùng tệp GLB thật đang có trong back-end/public/media/uploads/models/
    const modelsDir = path.resolve(__dirname, '../../../../back-end/public/media/uploads/models');
    const firstGlb = fs.readdirSync(modelsDir).find((f) => f.endsWith('.glb'))!;
    const glbBytes = fs.readFileSync(path.join(modelsDir, firstGlb));
    const sha256 = crypto.createHash('sha256').update(glbBytes).digest('hex');
    const arrayBuf = glbBytes.buffer.slice(
      glbBytes.byteOffset,
      glbBytes.byteOffset + glbBytes.byteLength,
    );

    const cache = new InMemoryGlbCache();
    await cache.putBuffer(sha256, arrayBuf);

    const fetchSpy = jest.fn();
    const exhibitId = '10000000-0000-4000-8000-000000000009';
    const exhibit: MuseumDisplay = {
      id: exhibitId,
      title: 'Trống đồng Ngọc Lũ',
      description: 'Hiện vật Đông Sơn',
      position: [0, 0, -2],
      shape: 'torus',
      color: '#B45309',
      model: {
        id: exhibitId,
        storageKey: `models/${firstGlb}`,
        sizeBytes: glbBytes.length,
        checksumSha256: sha256,
        url: `/rooms/dong-son/exhibits/${exhibitId}/model?version=${sha256}`,
      },
    };

    const mock = createInteractiveMockViro();

    render(
      <ThemeProvider>
        <ArArtifactPlacementView
          exhibit={exhibit}
          cache={cache}
          fetchImpl={fetchSpy as unknown as typeof fetch}
          sha256Impl={(buf) =>
            Promise.resolve(crypto.createHash('sha256').update(Buffer.from(buf)).digest('hex'))
          }
          capabilityOverride={{
            supported: true,
            engine: 'ARCore',
            platform: 'android',
            minOsRequirement: 'Android 8.0+ (API 26+)',
          }}
          viroOverride={mock.viro}
        />
      </ThemeProvider>,
    );

    // Xác nhận lấy thẳng từ cache cục bộ với 0 request mạng.
    await waitFor(() =>
      expect(screen.getByTestId('ar-model-source')).toHaveTextContent(/Bộ nhớ đệm cục bộ/),
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    // Chạm mặt phẳng ngang -> đặt hiện vật GLB thật lên AR.
    act(() => {
      mock.selectPlane([0, -0.5, -1.4]);
    });
    expect(screen.getByTestId('mock-ar-glb-object')).toBeOnTheScreen();
    expect(mock.getLast3DObjectProps()).toMatchObject({
      type: 'GLB',
      source: { uri: `memory://glb/${sha256}.glb` },
    });

    // Thao tác pinch zoom & xoay 2 ngón.
    act(() => {
      mock.pinch(1, 1);
      mock.pinch(3, 1.4);
      mock.rotate(1, 0);
      mock.rotate(3, -45);
    });
    expect(screen.getByTestId('ar-placement-status')).toHaveTextContent(/Tỷ lệ 140% · Xoay 45°/);

    // Thao tác nút rời cho người dùng 1 tay / VoiceOver.
    fireEvent.press(screen.getByRole('button', { name: 'Phóng to hiện vật AR' }));
    expect(screen.getByTestId('ar-placement-status')).toHaveTextContent(/Tỷ lệ 155%/);

    fireEvent.press(screen.getByRole('button', { name: 'Đặt lại kích thước và góc xoay AR' }));
    expect(screen.getByTestId('ar-placement-status')).toHaveTextContent(/Tỷ lệ 100% · Xoay 0°/);

    // Đổi mặt phẳng khác -> ẩn model đã đặt để người dùng chọn mặt phẳng mới.
    fireEvent.press(screen.getByRole('button', { name: 'Chọn mặt phẳng đặt lại hiện vật' }));
    expect(screen.queryByTestId('mock-ar-glb-object')).toBeNull();
  });
});
