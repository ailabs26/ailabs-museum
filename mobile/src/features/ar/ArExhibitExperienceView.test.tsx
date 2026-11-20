import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, View } from 'react-native';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { MuseumDisplay } from '@/features/scene3d/museumTypes';
import type { ViroRuntimeComponents } from './arBridge';
import { ArExhibitExperienceView } from './ArExhibitExperienceView';

function createHotspotTestViro() {
  let onPlaneSelectedRef: ((anchor: { position: [number, number, number] }) => void) | null = null;
  let onPinchRef: ((state: number, factor: number) => void) | null = null;

  const Passthrough = ({ children, ...rest }: Record<string, unknown>) =>
    React.createElement(View, rest, children as React.ReactNode);

  const viro: ViroRuntimeComponents = {
    ViroARSceneNavigator: ({ initialScene }: Record<string, unknown>) => {
      const SceneComp = (initialScene as { scene: React.ComponentType }).scene;
      return React.createElement(View, { testID: 'ar-nav' }, React.createElement(SceneComp));
    },
    ViroARScene: Passthrough,
    ViroARPlaneSelector: ({ children, onPlaneSelected }: Record<string, unknown>) => {
      onPlaneSelectedRef = (onPlaneSelected as typeof onPlaneSelectedRef) ?? null;
      return React.createElement(View, { testID: 'ar-plane' }, children as React.ReactNode);
    },
    ViroNode: ({ children, onPinch }: Record<string, unknown>) => {
      if (onPinch) onPinchRef = onPinch as typeof onPinchRef;
      return React.createElement(View, null, children as React.ReactNode);
    },
    ViroSphere: ({ testID, onClick }: Record<string, unknown>) =>
      React.createElement(Pressable, {
        testID: testID as string,
        onPress: onClick as () => void,
      }),
    Viro3DObject: Passthrough,
    ViroBox: Passthrough,
    ViroText: Passthrough,
    ViroAmbientLight: Passthrough,
    ViroDirectionalLight: Passthrough,
  };

  return {
    viro,
    placeOnPlane: () => onPlaneSelectedRef?.({ position: [0, -0.45, -1.2] }),
    pinchZoom: (factor: number) => {
      onPinchRef?.(1, 1);
      onPinchRef?.(3, factor);
    },
  };
}

describe('ArExhibitExperienceView — chạm hotspot trong AR & duyệt story (MOB-E9-03)', () => {
  const exhibit: MuseumDisplay = {
    id: 'ex-drum',
    title: 'Trống đồng Ngọc Lũ',
    description: 'Di sản Đông Sơn',
    position: [0, 0, -2],
    shape: 'torus',
    color: '#B45309',
    hotspots: [
      {
        id: 'hs-sun',
        label: 'Mặt trời 14 cánh',
        body: 'Trung tâm mặt trống chạm nổi ngôi sao 14 cánh.',
        position: [0, 0.36, 0],
      },
      {
        id: 'hs-birds',
        label: 'Vành chim Lạc',
        body: 'Chim Lạc bay ngược chiều kim đồng hồ quanh mặt trống.',
        position: [0.2, 0.3, 0.1],
      },
      {
        id: 'hs-handles',
        label: 'Quai trống bện thừng',
        body: 'Bốn đôi quai đúc liền thân trống.',
        position: [-0.2, 0.2, 0.1],
      },
    ],
  };

  it('đặt hiện vật lên mặt phẳng, chạm marker 3D mở thuyết minh, giữ chọn khi zoom và duyệt Trước/Tiếp/Đóng', () => {
    const mock = createHotspotTestViro();

    render(
      <ThemeProvider>
        <ArExhibitExperienceView
          exhibit={exhibit}
          capabilityOverride={{
            supported: true,
            engine: 'ARKit',
            platform: 'ios',
            minOsRequirement: 'iOS 15+',
          }}
          viroOverride={mock.viro}
        />
      </ThemeProvider>,
    );

    // Chưa đặt lên mặt phẳng -> chưa hiển thị HUD hotspot.
    expect(screen.queryByTestId('ar-hotspot-hud')).toBeNull();

    // Chạm mặt phẳng để đặt hiện vật -> xuất hiện đủ 3 marker 3D và thanh chip tiếp cận.
    act(() => {
      mock.placeOnPlane();
    });
    expect(screen.getByTestId('ar-hotspot-hud')).toBeOnTheScreen();
    expect(screen.getByTestId('ar-hotspot-marker-hs-sun')).toBeOnTheScreen();
    expect(screen.getByTestId('ar-hotspot-marker-hs-birds')).toBeOnTheScreen();
    expect(screen.getByTestId('ar-hotspot-marker-hs-handles')).toBeOnTheScreen();

    // Chạm trực tiếp vào điểm 3D "Mặt trời 14 cánh" trong không gian AR.
    fireEvent.press(screen.getByTestId('ar-hotspot-marker-hs-sun'));
    expect(screen.getByTestId('ar-hotspot-story-card')).toBeOnTheScreen();
    expect(screen.getByTestId('ar-hotspot-progress')).toHaveTextContent('Điểm 1 / 3');
    expect(
      screen.getByText('Trung tâm mặt trống chạm nổi ngôi sao 14 cánh.'),
    ).toBeOnTheScreen();

    // Phóng to hiện vật trong AR -> thẻ thuyết minh hotspot vẫn giữ nguyên trạng thái đang mở.
    act(() => {
      mock.pinchZoom(1.5);
    });
    expect(screen.getByTestId('ar-placement-status')).toHaveTextContent(/Tỷ lệ 150%/);
    expect(screen.getByTestId('ar-hotspot-progress')).toHaveTextContent('Điểm 1 / 3');

    // Nhấn Tiếp -> sang Điểm 2 / 3.
    fireEvent.press(screen.getByRole('button', { name: 'Xem hotspot tiếp theo' }));
    expect(screen.getByTestId('ar-hotspot-progress')).toHaveTextContent('Điểm 2 / 3');
    expect(
      screen.getByText('Chim Lạc bay ngược chiều kim đồng hồ quanh mặt trống.'),
    ).toBeOnTheScreen();

    // Chọn điểm 3 qua thanh chip tiếp cận dành cho VoiceOver/TalkBack.
    fireEvent.press(screen.getByTestId('ar-hotspot-chip-hs-handles'));
    expect(screen.getByTestId('ar-hotspot-progress')).toHaveTextContent('Điểm 3 / 3');

    // Đóng thẻ thuyết minh.
    fireEvent.press(screen.getByRole('button', { name: 'Đóng thẻ thuyết minh hotspot' }));
    expect(screen.queryByTestId('ar-hotspot-story-card')).toBeNull();
  });
});
