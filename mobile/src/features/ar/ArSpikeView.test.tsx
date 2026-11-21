import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { ViroRuntimeComponents } from './arBridge';
import { ArSpikeView } from './ArSpikeView';

function createMockViro(): {
  viro: ViroRuntimeComponents;
  triggerTracking: (state: number, reason?: number) => void;
} {
  let trackingHandler: ((state: number, reason?: number) => void) | null = null;
  const Passthrough = ({ children, ...rest }: Record<string, unknown>) =>
    React.createElement(View, rest, children as React.ReactNode);

  const viro: ViroRuntimeComponents = {
    ViroARSceneNavigator: ({ initialScene }: Record<string, unknown>) => {
      const SceneComp = (initialScene as { scene: React.ComponentType }).scene;
      return React.createElement(
        View,
        { testID: 'mock-viro-ar-navigator' },
        React.createElement(SceneComp),
      );
    },
    ViroARScene: ({ children, onTrackingUpdated }: Record<string, unknown>) => {
      trackingHandler = (onTrackingUpdated as typeof trackingHandler) ?? null;
      return React.createElement(View, { testID: 'mock-viro-ar-scene' }, children as React.ReactNode);
    },
    ViroARPlaneSelector: Passthrough,
    ViroNode: Passthrough,
    ViroBox: () => React.createElement(View, { testID: 'mock-viro-box' }),
    ViroSphere: Passthrough,
    Viro3DObject: Passthrough,
    ViroText: Passthrough,
    ViroAmbientLight: Passthrough,
    ViroDirectionalLight: Passthrough,
  };

  return {
    viro,
    triggerTracking: (state, reason) => trackingHandler?.(state, reason),
  };
}

describe('ArSpikeView (MOB-E9-01)', () => {
  it('hiển thị màn hình fallback rõ ràng kèm nút chuyển sang phòng 3D khi chạy trên Expo Go / thiết bị không hỗ trợ', () => {
    const onFallback3D = jest.fn();
    const onExit = jest.fn();

    render(
      <ThemeProvider>
        <ArSpikeView
          capabilityOverride={{
            supported: false,
            engine: 'none',
            reason: 'native_module_missing',
            userMessage: 'Cần mở bằng EAS Development Build.',
            technicalHint: 'Expo Go thiếu Viro native.',
          }}
          onFallback3D={onFallback3D}
          onExit={onExit}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('ar-unsupported-fallback')).toBeOnTheScreen();
    expect(screen.getByText('Cần mở bằng EAS Development Build.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Mở phòng trưng bày 3D thay thế' }));
    expect(onFallback3D).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole('button', { name: 'Quay lại màn hình trước' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('khởi chạy ViroARSceneNavigator, đặt 1 model AR, cập nhật tracking và ẩn/hiện model', () => {
    const { viro, triggerTracking } = createMockViro();

    render(
      <ThemeProvider>
        <ArSpikeView
          capabilityOverride={{
            supported: true,
            engine: 'ARKit',
            platform: 'ios',
            minOsRequirement: 'iOS 15+',
          }}
          viroOverride={viro}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('ar-spike-active')).toBeOnTheScreen();
    expect(screen.getByTestId('ar-engine-badge')).toHaveTextContent(/ARKit · iOS 15\+/);
    expect(screen.getByTestId('mock-viro-box')).toBeOnTheScreen();

    act(() => {
      triggerTracking(3);
    });
    expect(screen.getByTestId('ar-tracking-status')).toHaveTextContent(/AR Tracking ổn định/);

    // Tắt/bật lại model AR thử nghiệm.
    fireEvent.press(screen.getByRole('button', { name: 'Ẩn mô hình thử nghiệm AR' }));
    expect(screen.queryByTestId('mock-viro-box')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Đặt mô hình thử nghiệm AR' }));
    expect(screen.getByTestId('mock-viro-box')).toBeOnTheScreen();
  });
});
