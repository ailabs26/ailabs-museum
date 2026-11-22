import { Vector3 } from 'three';
import {
  NAVIGATION,
  NavigationGestures,
  applyLook,
  computePinchStep,
  createNavigationInput,
  getJoystickVector,
  getMuseumFov,
  stepMovement,
} from './museumNavigation';

const ROOM = { width: 14, depth: 16, height: 5 };

describe('museumNavigation — port chuẩn toán học từ web (MOB-E6-05)', () => {
  function travel(x: number, y: number, yaw = 0, fps = 60, sprint = false): Vector3 {
    const position = new Vector3(0, NAVIGATION.eyeHeight, 5);
    const velocity = new Vector3();
    for (let i = 0; i < fps; i++) {
      stepMovement(position, velocity, { x, y }, yaw, sprint, 1 / fps, ROOM);
    }
    return position;
  }

  it('di chuyển đúng hướng tiến/lùi/trái/phải trên mặt phẳng ngang và theo góc yaw', () => {
    expect(travel(0, 1).z).toBeLessThan(4);
    expect(travel(0, -1).z).toBeGreaterThan(6);
    expect(travel(1, 0).x).toBeGreaterThan(1);
    expect(travel(-1, 0).x).toBeLessThan(-1);
    expect(travel(0, 1, Math.PI / 2).x).toBeLessThan(-1);
    expect(travel(0, 1).y).toBe(NAVIGATION.eyeHeight);
  });

  it('chuẩn hóa đường chéo và tích phân damping độc lập với 30/60/120 FPS', () => {
    const start = new Vector3(0, NAVIGATION.eyeHeight, 5);
    expect(travel(1, 1).distanceTo(start)).toBeCloseTo(travel(0, 1).distanceTo(start), 6);
    expect(travel(0, 1, 0, 30).z).toBeCloseTo(travel(0, 1, 0, 120).z, 6);
    expect(travel(0, 1, 0, 60, true).z).toBeLessThan(travel(0, 1).z);
  });

  it('kẹp delta lớn sau khi resume từ background, giảm tốc mượt và về trạng thái ngủ', () => {
    const position = new Vector3(0, NAVIGATION.eyeHeight, 5);
    const velocity = new Vector3();
    stepMovement(position, velocity, { x: 0, y: 1 }, 0, false, 100, ROOM);
    expect(position.z).toBeGreaterThan(4.9);

    for (let i = 0; i < 120; i++) {
      stepMovement(position, velocity, { x: 0, y: 0 }, 0, false, 1 / 60, ROOM);
    }
    expect(velocity.length()).toBe(0);
    const stopped = position.clone();
    expect(stepMovement(position, velocity, { x: 0, y: 0 }, 0, false, 1 / 60, ROOM)).toBe(false);
    expect(position.equals(stopped)).toBe(true);
  });

  it('ánh xạ joystick ảo có dead-zone 12%, kẹp bán kính và đảo trục Y màn hình', () => {
    expect(getJoystickVector(2, 1, 40)).toEqual({ x: 0, y: 0 });
    expect(getJoystickVector(0, -80, 40)).toEqual({ x: 0, y: 1 });
    const diagonal = getJoystickVector(80, 80, 40);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(getJoystickVector(0, -20, 40).y).toBeGreaterThan(0);
    expect(getJoystickVector(0, -20, 40).y).toBeLessThan(1);
    expect(getJoystickVector(Number.NaN, 0, 40)).toEqual({ x: 0, y: 0 });
  });

  it('applyLook xoay đúng hướng và kẹp pitch không gây lật camera', () => {
    const look = { yaw: 0, pitch: 0 };
    applyLook(look, 100, -100, 0.005);
    expect(look.yaw).toBeCloseTo(-0.5);
    expect(look.pitch).toBeCloseTo(0.5);
    applyLook(look, 0, -10000, 0.005);
    expect(look.pitch).toBe(NAVIGATION.pitchLimit);
    applyLook(look, 0, 10000, 0.005);
    expect(look.pitch).toBe(-NAVIGATION.pitchLimit);
  });

  it('NavigationGestures phân biệt tap (<5px) với kéo camera (>5px) và pinch 2 ngón', () => {
    const gestures = new NavigationGestures();
    gestures.start(1, 100, 100);
    gestures.move(1, 102, 103); // ~3.6px -> vẫn cho chọn
    expect(gestures.canSelect).toBe(true);
    gestures.move(1, 112, 100); // 12px > 5px -> chặn chọn hiện vật
    expect(gestures.canSelect).toBe(false);
    gestures.end(1);

    // Chạm 2 ngón (pinch) -> luôn chặn chọn
    gestures.start(1, 50, 50);
    expect(gestures.canSelect).toBe(true);
    gestures.start(2, 150, 50);
    expect(gestures.canSelect).toBe(false);
    gestures.cancel();
    expect(gestures.canSelect).toBe(false);
  });

  it('tính FOV dọc cho điện thoại và kẹp bước pinch zoom an toàn', () => {
    expect(getMuseumFov(1.6)).toBe(60);
    expect(getMuseumFov(390 / 844)).toBeGreaterThan(60);
    expect(getMuseumFov(390 / 844)).toBeLessThanOrEqual(82);
    expect(computePinchStep(100, 140)).toBeGreaterThan(0);
    expect(computePinchStep(100, 60)).toBeLessThan(0);
    expect(computePinchStep(100, 5000)).toBe(0.8);
    expect(computePinchStep(0, 100)).toBe(0);

    const a = createNavigationInput();
    const b = createNavigationInput();
    a.joystick.y = 1;
    expect(b.joystick.y).toBe(0);
  });
});
