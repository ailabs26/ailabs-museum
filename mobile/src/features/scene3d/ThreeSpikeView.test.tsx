import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, View } from 'react-native';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ThreeSpikeView } from './ThreeSpikeView';
import type { SpinningCubeSceneProps } from './SpinningCubeScene';

const mockSceneSpy = jest.fn();
let mockShouldThrowInScene = false;

jest.mock('./SpinningCubeScene', () => {
  const React = require('react');
  const { View: RNView } = require('react-native');
  return {
    SPIKE_CUBE_COLORS: ['#0F766E', '#D97706', '#2563EB'],
    SpinningCubeScene: (props: SpinningCubeSceneProps) => {
      mockSceneSpy(props);
      if (mockShouldThrowInScene) {
        throw new Error('GL context creation failed on unsupported GPU');
      }
      return React.createElement(RNView, { testID: 'mock-r3f-canvas' });
    },
  };
});

describe('ThreeSpikeView (MOB-E6-01)', () => {
  beforeEach(() => {
    mockSceneSpy.mockClear();
    mockShouldThrowInScene = false;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hiển thị HUD FPS, cập nhật trạng thái 60 FPS và hỗ trợ Tạm dừng / Đổi màu / Đặt lại', async () => {
    render(
      <ThemeProvider>
        <ThreeSpikeView />
      </ThemeProvider>,
    );
    await act(async () => {});

    expect(screen.getByTestId('mock-r3f-canvas')).toBeOnTheScreen();
    expect(screen.getByTestId('spike-fps-value')).toHaveTextContent('-- FPS');

    // Mô phỏng khung hình thực tế đạt 60 FPS báo về từ R3F useFrame.
    const latestProps = mockSceneSpy.mock.calls.at(-1)?.[0] as SpinningCubeSceneProps;
    act(() => {
      latestProps.onFpsSample?.({
        fps: 60.0,
        frameTimeMs: 16.65,
        p95FrameTimeMs: 17.2,
        droppedFrames16ms: 1,
        droppedFrames33ms: 0,
        sampleCount: 60,
        meets60FpsTarget: true,
      });
    });

    expect(screen.getByTestId('spike-fps-value')).toHaveTextContent('60.0 FPS');
    expect(screen.getByTestId('spike-status-badge')).toHaveTextContent('Ổn định 60 FPS');

    // Tạm dừng và kiểm tra prop truyền vào scene.
    fireEvent.press(screen.getByRole('button', { name: 'Tạm dừng xoay khối lập phương' }));
    expect(screen.getByTestId('spike-status-badge')).toHaveTextContent('Đang tạm dừng');
    expect((mockSceneSpy.mock.calls.at(-1)?.[0] as SpinningCubeSceneProps).paused).toBe(true);

    // Đổi màu cube.
    fireEvent.press(screen.getByRole('button', { name: 'Đổi màu khối lập phương' }));
    expect((mockSceneSpy.mock.calls.at(-1)?.[0] as SpinningCubeSceneProps).colorIndex).toBe(1);

    // Đặt lại về mặc định.
    fireEvent.press(screen.getByRole('button', { name: 'Đặt lại góc xoay và thông số đo FPS' }));
    const afterReset = mockSceneSpy.mock.calls.at(-1)?.[0] as SpinningCubeSceneProps;
    expect(afterReset.paused).toBe(false);
    expect(afterReset.colorIndex).toBe(0);
    expect(afterReset.resetNonce).toBe(1);
  });

  it('tự động dừng xoay khi OS bật Giảm chuyển động (reduced motion)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    render(
      <ThemeProvider>
        <ThreeSpikeView />
      </ThemeProvider>,
    );

    expect(await screen.findByText('Giảm chuyển động (OS)')).toBeOnTheScreen();
    expect((mockSceneSpy.mock.calls.at(-1)?.[0] as SpinningCubeSceneProps).reducedMotion).toBe(
      true,
    );
  });

  it('tự động tạm dừng render khi app chuyển sang background', async () => {
    let appStateListener: ((state: 'active' | 'background' | 'inactive') => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener as typeof appStateListener;
      return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
    });

    render(
      <ThemeProvider>
        <ThreeSpikeView />
      </ThemeProvider>,
    );
    await act(async () => {});

    act(() => {
      appStateListener?.('background');
    });
    expect((mockSceneSpy.mock.calls.at(-1)?.[0] as SpinningCubeSceneProps).paused).toBe(true);

    act(() => {
      appStateListener?.('active');
    });
    expect((mockSceneSpy.mock.calls.at(-1)?.[0] as SpinningCubeSceneProps).paused).toBe(false);
  });

  it('không làm crash app khi Expo GL ném lỗi và cho phép Thử lại hoặc chuyển 2D', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onFallback2D = jest.fn();
    mockShouldThrowInScene = true;

    render(
      <ThemeProvider>
        <View style={{ flex: 1 }}>
          <ThreeSpikeView onFallback2D={onFallback2D} />
        </View>
      </ThemeProvider>,
    );
    await act(async () => {});

    expect(screen.getByTestId('scene3d-error-fallback')).toBeOnTheScreen();
    expect(screen.getByText('GL context creation failed on unsupported GPU')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Chuyển sang chế độ xem 2D' }));
    expect(onFallback2D).toHaveBeenCalledTimes(1);

    // Khắc phục lỗi và nhấn Thử lại 3D -> quay lại Canvas bình thường.
    mockShouldThrowInScene = false;
    fireEvent.press(screen.getByRole('button', { name: 'Thử khởi tạo lại khung cảnh 3D' }));
    expect(screen.getByTestId('mock-r3f-canvas')).toBeOnTheScreen();

    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });
});
