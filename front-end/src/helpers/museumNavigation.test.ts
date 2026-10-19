import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { applyLook, createNavigationInput, getDisplayColliders, getJoystickVector, moveWithCollisions, stepMovement, findNavigationPath, findSafeNavigationPoint, isNavigationPositionSafe } from './museumNavigation';
import type { MuseumDisplay } from '@/interfaces/museumScene';

const room = { width: 14, depth: 16, height: 5 };
const display: MuseumDisplay = { id: 'one', title: '', description: '', shape: 'torus', color: '#fff', position: [0, 0, 0] };

describe('shared desktop and touch movement', () => {
  function travel(x: number, y: number, yaw = 0, fps = 60, sprint = false) {
    const position = new Vector3(0, 1.7, 5), velocity = new Vector3();
    for (let i = 0; i < fps; i++) stepMovement(position, velocity, { x, y }, yaw, sprint, 1 / fps, room, []);
    return position;
  }
  it('moves forward/back/left/right on the camera horizontal plane', () => {
    expect(travel(0, 1).z).toBeLessThan(4); expect(travel(0, -1).z).toBeGreaterThan(6);
    expect(travel(1, 0).x).toBeGreaterThan(1); expect(travel(-1, 0).x).toBeLessThan(-1);
    expect(travel(0, 1, Math.PI / 2).x).toBeLessThan(-1); expect(travel(0, 1).y).toBe(1.7);
  });
  it('normalizes diagonals and integrates damping independently of FPS', () => {
    const start = new Vector3(0, 1.7, 5);
    expect(travel(1, 1).distanceTo(start)).toBeCloseTo(travel(0, 1).distanceTo(start), 8);
    expect(travel(0, 1, 0, 30).z).toBeCloseTo(travel(0, 1, 0, 120).z, 8);
    expect(travel(0, 1, 0, 60, true).z).toBeLessThan(travel(0, 1).z);
  });
  it('caps resume delta, decelerates on release and eventually sleeps', () => {
    const position = new Vector3(0, 1.7, 5), velocity = new Vector3();
    stepMovement(position, velocity, { x: 0, y: 1 }, 0, false, 100, room, []);
    expect(position.z).toBeGreaterThan(4.9);
    for (let i = 0; i < 120; i++) stepMovement(position, velocity, { x: 0, y: 0 }, 0, false, 1 / 60, room, []);
    expect(velocity.length()).toBe(0);
    const stopped = position.clone();
    expect(stepMovement(position, velocity, { x: 0, y: 0 }, 0, false, 1 / 60, room, [])).toBe(false);
    expect(position.equals(stopped)).toBe(true);
  });
});

it('maps analog joystick with dead zone, clamped radius and inverted screen Y', () => {
  expect(getJoystickVector(2, 1, 40)).toEqual({ x: 0, y: 0 });
  expect(getJoystickVector(0, -80, 40)).toEqual({ x: 0, y: 1 });
  const diagonal = getJoystickVector(80, 80, 40);
  expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
  expect(getJoystickVector(0, -20, 40).y).toBeGreaterThan(0);
  expect(getJoystickVector(0, -20, 40).y).toBeLessThan(1);
});

it('mouse/touch look has correct direction and clamps pitch without roll', () => {
  const look = { yaw: 0, pitch: 0 };
  applyLook(look, 100, -100, 0.003);
  expect(look.yaw).toBeCloseTo(-0.3); expect(look.pitch).toBeCloseTo(0.3);
  applyLook(look, 0, -10000, 0.003); expect(look.pitch).toBeLessThan(Math.PI / 2);
  applyLook(look, 0, 10000, 0.003); expect(look.pitch).toBeGreaterThan(-Math.PI / 2);
});

it('prevents tunneling into a plinth, slides along obstacles and bounds each room', () => {
  const colliders = getDisplayColliders([display]);
  const position = new Vector3(0, 1.7, 5);
  moveWithCollisions(position, 0, -10, room, colliders);
  expect(position.z).toBeGreaterThan(1.45);
  moveWithCollisions(position, 4, -1, room, colliders); expect(position.x).toBeGreaterThan(3);
  moveWithCollisions(position, 100, 100, { width: 10, depth: 12, height: 5 }, []);
  expect(position.x).toBeLessThan(5); expect(position.z).toBeLessThan(6);
  expect(position.y).toBe(1.7);
});

it('protects GLB loading/error placeholders and ignores displays outside the shell', () => {
  expect(getDisplayColliders([{ ...display, model: {} as MuseumDisplay['model'] }])[0]).toEqual(getDisplayColliders([display])[0]);
  expect(getDisplayColliders([{ ...display, isOutsideRoom: true }])).toEqual([]);
  const first = createNavigationInput(), second = createNavigationInput();
  first.keys.add('KeyW'); expect(second.keys.size).toBe(0);
  const crystal = getDisplayColliders([{ ...display, shape: 'icosahedron' }])[0];
  expect(crystal.maxX).toBeGreaterThanOrEqual(0.64 + 0.25);
});

it('routes focus/reset around plinths and leaves unreachable destinations alone', () => {
  const colliders = getDisplayColliders([display]);
  const path = findNavigationPath({ x: 0, y: 5 }, { x: 0, y: -5 }, room, colliders)!;
  expect(path.length).toBeGreaterThan(2);
  expect(path.at(-1)).toEqual({ x: 0, y: -5 });
  for (let i = 1; i < path.length; i++) for (let sample = 0; sample <= 100; sample++) {
    const t = sample / 100;
    expect(isNavigationPositionSafe(path[i - 1].x * (1 - t) + path[i].x * t, path[i - 1].y * (1 - t) + path[i].y * t, room, colliders)).toBe(true);
  }
  expect(findNavigationPath({ x: 0, y: 5 }, { x: 0, y: 0 }, room, colliders)).toBeNull();
});
it('chooses the nearest free spawn/reset point when published placement occupies it', () => {
  const colliders = getDisplayColliders([display]);
  const safe = findSafeNavigationPoint({ x: 0, y: 0 }, room, colliders)!;
  expect(isNavigationPositionSafe(safe.x, safe.y, room, colliders)).toBe(true);
  expect(Math.hypot(safe.x, safe.y)).toBeLessThan(2.1);
});
