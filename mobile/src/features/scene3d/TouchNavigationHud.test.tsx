import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { TouchNavigationHud } from './TouchNavigationHud';
import { createNavigationInput, NavigationGestures } from './museumNavigation';

beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function touch(identifier: number, pageX: number, pageY = 100) {
  return { identifier, pageX, pageY, locationX: pageX - 10, locationY: pageY - 20 };
}

function setUpHud() {
  const input = createNavigationInput();
  input.stop = jest.fn();
  input.wake = jest.fn();
  const gestures = new NavigationGestures();
  const onTap = jest.fn();
  const onAction = jest.fn();
  render(<TouchNavigationHud {...{ input, gestures, onTap, onAction }} />);
  const surface = screen.getByTestId('touch-look-surface');
  let time = 0;
  const send = (
    phase: string,
    touches: ReturnType<typeof touch>[] = [],
    changedTouches = touches,
    target = surface,
  ) => {
    time++;
    const touchBank = [];
    for (const finger of touches) {
      touchBank[finger.identifier] = {
        touchActive: true,
        currentPageX: finger.pageX,
        currentPageY: finger.pageY,
        currentTimeStamp: time,
        previousPageX: finger.pageX - 10,
        previousPageY: finger.pageY,
        previousTimeStamp: time - 1,
      };
    }
    fireEvent(target, `responder${phase}`, {
      nativeEvent: { touches, changedTouches },
      touchHistory: {
        touchBank,
        mostRecentTimeStamp: time,
        numberActiveTouches: touches.length,
        indexOfSingleActiveTouch: touches.length === 1 ? touches[0]?.identifier : -1,
      },
    });
  };
  const tap = (finger: ReturnType<typeof touch>) => {
    send('Grant', [finger]);
    send('Start', [finger]);
    send('End', [], [finger]);
    send('Release', [], [finger]);
  };
  return { input, onTap, onAction, send, tap };
}

it('dispatch đúng một tap bằng tọa độ local, không xoay hay ngắt camera', () => {
  const { input, onTap, tap } = setUpHud();
  tap(touch(1, 80, 120));
  expect(onTap).toHaveBeenCalledTimes(1);
  expect(onTap).toHaveBeenCalledWith(70, 100);
  expect(input.wake).not.toHaveBeenCalled();
  expect(input.look).toEqual({ x: 0, y: 0 });
});

it('drag quay về điểm đầu và release ngoài ngưỡng đều bị chặn, tap kế tiếp hoạt động', () => {
  const { input, onTap, send, tap } = setUpHud();
  const finger = touch(1, 80);
  send('Grant', [finger]);
  send('Move', [touch(1, 100, 110)]);
  expect(input.look.x).toBeCloseTo(0.1);
  expect(input.look.y).toBeCloseTo(0.05);
  send('Move', [finger]);
  send('Release', [], [finger]);
  send('Grant', [finger]);
  send('Release', [], [touch(1, 90)]);
  expect(onTap).not.toHaveBeenCalled();
  tap(finger);
  expect(onTap).toHaveBeenCalledTimes(1);
});

it.each([true, false])(
  'pinch (có move: %s) về một ngón không chọn, tap kế tiếp hoạt động',
  (move) => {
    const { input, onTap, send, tap } = setUpHud();
    const finger = touch(1, 80);
    const second = touch(2, 100);
    send('Grant', [finger]);
    send('Start', [finger, second], [second]);
    if (move) {
      send('Move', [finger, touch(2, 120)]);
      expect(input.dolly).toBeCloseTo(0.24);
    }
    send('End', [finger], [second]);
    send('Move', [touch(1, 90)]);
    expect(input.look.x).toBeCloseTo(0.05);
    send('End', [], [finger]);
    send('Release', [], [finger]);
    expect(onTap).not.toHaveBeenCalled();
    tap(finger);
    expect(onTap).toHaveBeenCalledTimes(1);
  },
);

it('terminate và app inactive vô hiệu hóa release rồi khôi phục được tap', () => {
  const { input, onTap, send, tap } = setUpHud();
  const listeners = jest.mocked(AppState.addEventListener).mock.calls
    .filter(([event]) => event === 'change')
    .map(([, listener]) => listener);
  const finger = touch(1, 80);
  send('Grant', [finger]);
  send('Terminate');
  send('Release', [], [finger]);
  send('Grant', [finger]);
  act(() => listeners.forEach((listener) => listener('background')));
  expect(input.stop).toHaveBeenCalledTimes(1);
  act(() => listeners.forEach((listener) => listener('active')));
  send('Release', [], [finger]);
  expect(onTap).not.toHaveBeenCalled();
  tap(finger);
  expect(onTap).toHaveBeenCalledTimes(1);
});

it('giữ joystick và nút điều hướng trên responder riêng', () => {
  const { input, onTap, onAction, send } = setUpHud();
  const joystick = screen.getByTestId('virtual-joystick');
  const finger = touch(1, 80);
  send('Grant', [finger], [finger], joystick);
  send('Move', [touch(1, 100)], [touch(1, 100)], joystick);
  expect(input.joystick.x).toBeGreaterThan(0);
  send('Release', [], [finger], joystick);
  expect(input.joystick.x).toBe(0);
  fireEvent.press(screen.getByRole('button', { name: 'Bước tiến về phía trước' }));
  expect(onAction).toHaveBeenCalledWith('forward');
  expect(onTap).not.toHaveBeenCalled();
});
