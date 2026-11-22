import { render } from '@testing-library/react-native';
import { SpinningCubeScene } from './SpinningCubeScene';

type FrameCallback = (state: unknown, delta: number) => void;
let mockFrameCallback: FrameCallback | null = null;
let mockOnCreated: ((state: { gl: { getContext: () => unknown } }) => void) | null = null;

jest.mock('@react-three/fiber/native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Canvas: ({
      children,
      onCreated,
    }: {
      children: React.ReactNode;
      onCreated?: (state: { gl: { getContext: () => unknown } }) => void;
    }) => {
      mockOnCreated = onCreated ?? null;
      return React.createElement(View, { testID: 'r3f-canvas-stub' }, children);
    },
    useFrame: (cb: FrameCallback) => {
      mockFrameCallback = cb;
    },
  };
});

describe('SpinningCubeScene (MOB-E6-01)', () => {
  beforeEach(() => {
    mockFrameCallback = null;
    mockOnCreated = null;
  });

  it('bỏ qua UNPACK_FLIP_Y_WEBGL trên pixelStorei của Expo GL và chuyển tiếp tham số khác', () => {
    const origPixelStorei = jest.fn();
    const glContext = { pixelStorei: origPixelStorei };

    render(
      <SpinningCubeScene
        paused={false}
        reducedMotion={false}
        colorIndex={0}
        resetNonce={0}
      />,
    );

    expect(mockOnCreated).not.toBeNull();
    mockOnCreated?.({ gl: { getContext: () => glContext } });

    glContext.pixelStorei(0x9240, true);
    expect(origPixelStorei).not.toHaveBeenCalled();

    glContext.pixelStorei(0x0cf5, 4);
    expect(origPixelStorei).toHaveBeenCalledWith(0x0cf5, 4);
  });

  it('báo cáo mẫu FPS sau 500ms khung hình ở 60 FPS qua useFrame', () => {
    const onFpsSample = jest.fn();
    render(
      <SpinningCubeScene
        paused={false}
        reducedMotion={false}
        colorIndex={2}
        resetNonce={0}
        onFpsSample={onFpsSample}
      />,
    );

    onFpsSample.mockClear();
    expect(mockFrameCallback).not.toBeNull();

    // Giả lập 35 khung hình 16.6ms (~581ms) -> kích hoạt báo cáo FPS định kỳ.
    for (let i = 0; i < 35; i++) {
      mockFrameCallback?.({}, 0.0166);
    }

    expect(onFpsSample).toHaveBeenCalledTimes(1);
    const snapshot = onFpsSample.mock.calls[0][0];
    expect(snapshot.fps).toBeGreaterThanOrEqual(59);
    expect(snapshot.meets60FpsTarget).toBe(true);
  });
});
