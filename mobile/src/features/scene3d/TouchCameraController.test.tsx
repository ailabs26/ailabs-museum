import { fireEvent, render, screen } from '@testing-library/react-native';
import { PerspectiveCamera } from 'three';
import {
  INITIAL_CAMERA_POSITION,
  NavigationGestures,
  createNavigationInput,
  type CameraAction,
} from './museumNavigation';
import { TouchCameraController } from './TouchCameraController';
import { TouchNavigationHud } from './TouchNavigationHud';

type FrameFn = (state: unknown, delta: number) => void;
let mockFrameCb: FrameFn | null = null;
const mockCamera = new PerspectiveCamera(60, 0.5, 0.1, 100);

jest.mock('@react-three/fiber/native', () => ({
  useFrame: (cb: FrameFn) => {
    mockFrameCb = cb;
  },
  useThree: () => ({
    camera: mockCamera,
    size: { width: 390, height: 844 },
  }),
}));

describe('TouchCameraController & TouchNavigationHud (MOB-E6-05)', () => {
  beforeEach(() => {
    mockFrameCb = null;
    mockCamera.position.set(...INITIAL_CAMERA_POSITION);
    mockCamera.rotation.set(0, 0, 0);
    mockCamera.updateMatrixWorld();
  });

  it('cập nhật FOV màn dọc, xoay mượt qua useFrame và phản hồi lệnh nút rời / reset', () => {
    const input = createNavigationInput();
    const commandRef: { current: ((action: CameraAction) => void) | null } = { current: null };

    render(<TouchCameraController input={input} commandHandler={commandRef} reducedMotion={false} />);

    // Màn hình dọc 390x844 phải mở rộng FOV > 60° (≤ 82°).
    expect(mockCamera.fov).toBeGreaterThan(60);
    expect(mockCamera.fov).toBeLessThanOrEqual(82);

    // Kéo xoay góc nhìn cảm ứng + đẩy joystick tiến về phía trước.
    input.look.x = 0.25;
    input.joystick.y = 1;
    const zBefore = mockCamera.position.z;
    for (let i = 0; i < 20; i++) {
      mockFrameCb?.({}, 1 / 60);
    }
    expect(mockCamera.position.z).toBeLessThan(zBefore);
    expect(mockCamera.quaternion.y).not.toBe(0);

    // Nút điều khiển rời: tiến và đặt lại góc nhìn.
    commandRef.current?.('forward');
    commandRef.current?.('left');
    commandRef.current?.('reset');
    expect(mockCamera.position.toArray()).toEqual(INITIAL_CAMERA_POSITION);
  });

  it('tôn trọng reducedMotion bằng cách khớp ngay góc nhìn không quán tính', () => {
    const input = createNavigationInput();
    const commandRef: { current: ((action: CameraAction) => void) | null } = { current: null };

    render(<TouchCameraController input={input} commandHandler={commandRef} reducedMotion />);

    input.look.x = 0.3;
    mockFrameCb?.({}, 1 / 60);
    // Ở chế độ reducedMotion, blend = 1 nên 1 frame đã xoay tới đúng góc đích (yaw ≈ -0.3).
    expect(Math.abs(mockCamera.rotation.y)).toBeGreaterThan(0.25);
  });

  it('TouchNavigationHud phát đúng sự kiện CameraAction khi nhấn các nút tiếp cận', () => {
    const input = createNavigationInput();
    const gestures = new NavigationGestures();
    const onAction = jest.fn();

    render(<TouchNavigationHud input={input} gestures={gestures} onAction={onAction} />);

    expect(screen.getByTestId('touch-look-surface')).toBeOnTheScreen();
    expect(screen.getByTestId('virtual-joystick')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Quay camera sang trái' }));
    fireEvent.press(screen.getByRole('button', { name: 'Bước tiến về phía trước' }));
    fireEvent.press(screen.getByRole('button', { name: 'Bước lùi về phía sau' }));
    fireEvent.press(screen.getByRole('button', { name: 'Quay camera sang phải' }));
    fireEvent.press(screen.getByRole('button', { name: 'Đặt lại góc nhìn ban đầu' }));

    expect(onAction.mock.calls.map((c) => c[0])).toEqual([
      'left',
      'forward',
      'back',
      'right',
      'reset',
    ]);
  });
});
