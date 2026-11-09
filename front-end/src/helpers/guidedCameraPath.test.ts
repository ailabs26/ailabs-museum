import { describe, expect, it } from 'vitest';
import { buildGuidedPath, getGuidedView, sampleGuidedPath, advanceGuidedTime, getGuidedDuration, roundGuidedPathCorners, GUIDED_MOTION } from './guidedCameraPath';
import { findNavigationPath, getDisplayColliders, isNavigationPositionSafe, isNavigationSegmentSafe, type NavigationCollider } from './museumNavigation';
import { MUSEUM_ROOM_SIZE as room, type MuseumDisplay } from '@/interfaces/museumScene';
import { roomA } from '../../tests/fixtures/museumContent';
import { mapRoomDisplays } from './mapRoomDisplays';
import { roomDetailSchema } from '@/validations/roomSchema';

const obstacle = { minX: -1.5, maxX: 1.5, minZ: -1.5, maxZ: 1.5 };
const display: MuseumDisplay = { id: 'one', title: 'One', description: '', position: [0, 0, 0], shape: 'sphere', color: '#fff' };

function assertSafe(path: NonNullable<ReturnType<typeof buildGuidedPath>>, colliders: NavigationCollider[]) {
  expect(path.points[0]).toEqual({ x: -4, y: 0 });
  expect(path.points.at(-1)).toEqual({ x: 4, y: 0 });
  for (let i = 0; i < path.points.length; i++) {
    const point = path.points[i];
    expect(Number.isFinite(point.x + point.y + path.distances[i] + path.times[i])).toBe(true);
    expect(isNavigationPositionSafe(point.x, point.y, room, colliders)).toBe(true);
    if (i) {
      expect(isNavigationSegmentSafe(path.points[i - 1], point, room, colliders)).toBe(true);
      expect(path.distances[i]).toBeGreaterThan(path.distances[i - 1]);
      expect(path.times[i]).toBeGreaterThan(path.times[i - 1]);
      const acceleration = (path.speeds[i] ** 2 - path.speeds[i - 1] ** 2) / (2 * (path.distances[i] - path.distances[i - 1]));
      expect(Math.abs(acceleration)).toBeLessThanOrEqual(GUIDED_MOTION.acceleration + 1e-6);
    }
    expect(path.speeds[i]).toBeLessThanOrEqual(GUIDED_MOTION.speed);
  }
  for (let t = 0; t < path.duration; t += 1 / 120) {
    const p = sampleGuidedPath(path, t);
    expect(isNavigationPositionSafe(p.x, p.y, room, colliders)).toBe(true);
  }
}

describe('guided collision-safe arc-length motion', () => {
  it.each([[], [obstacle], [obstacle, { minX: 2, maxX: 3, minZ: -3, maxZ: 1 }]].map(colliders => ({ colliders })))('keeps every rendered chord safe through obstacles $colliders', ({ colliders }) => {
    const path = buildGuidedPath({ x: -4, y: 0 }, { x: 4, y: 0 }, room, colliders)!;
    expect(path).not.toBeNull();
    assertSafe(path, colliders);
    expect(sampleGuidedPath(path, 0)).toMatchObject({ x: -4, y: 0, distance: 0 });
    expect(sampleGuidedPath(path, path.duration)).toMatchObject({ x: 4, y: 0, distance: path.length });
  });

  it('actually rounds an obstructed polyline with multiple intermediate headings', () => {
    const path = buildGuidedPath({ x: -4, y: 0 }, { x: 4, y: 0 }, room, [obstacle])!;
    const headings = new Set(path.points.slice(1).map((p, i) => Math.atan2(p.y - path.points[i].y, p.x - path.points[i].x).toFixed(2)));
    expect(headings.size).toBeGreaterThan(8);
    expect(path.length).toBeGreaterThan(8);
    expect(path.speeds.some((v, i) => i > 5 && i < path.speeds.length - 5 && v < GUIDED_MOTION.speed)).toBe(true);
  });

  it('shrinks rounding in a narrow passage and falls back safely', () => {
    const colliders = [{ ...obstacle, maxZ: 7.55 }, { minX: -6.55, maxX: 6.55, minZ: -7.55, maxZ: -1.54 }];
    const path = buildGuidedPath({ x: -4, y: 0 }, { x: 4, y: 0 }, room, colliders)!;
    assertSafe(path, colliders);
    expect(path.points.some(point => point.y > -1.54 && point.y < -1.5)).toBe(true);
  });

  it('retains the collision-free polyline when every positive rounding radius cuts a collider', () => {
    const route = [{ x: -3, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 3 }];
    const colliders = [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }];
    const rounded = roundGuidedPathCorners(route, room, colliders);
    expect(rounded).toEqual(route);
    for (let i = 1; i < rounded.length; i++) expect(isNavigationSegmentSafe(rounded[i - 1], rounded[i], room, colliders)).toBe(true);
  });

  it('handles walls, coincident endpoints and rejects invalid or unreachable endpoints', () => {
    expect(buildGuidedPath({ x: -6.55, y: 7.55 }, { x: 6.55, y: -7.55 }, room, [])).not.toBeNull();
    const still = buildGuidedPath({ x: 4, y: 0 }, { x: 4, y: 0 }, room, [])!;
    expect(still.length).toBe(0);
    expect(sampleGuidedPath(still, 10)).toMatchObject({ x: 4, y: 0 });
    expect(buildGuidedPath({ x: NaN, y: 0 }, { x: 4, y: 0 }, room, [])).toBeNull();
    expect(buildGuidedPath({ x: -4, y: 0 }, { x: 0, y: 0 }, room, [obstacle])).toBeNull();
    expect(buildGuidedPath({ x: -4, y: 0 }, { x: 4, y: 0 }, room, [{ minX: -1, maxX: 1, minZ: -8, maxZ: 8 }])).toBeNull();
  });

  it('is time-based at 30/60/120 FPS, freezes on pause and caps background deltas', () => {
    const path = buildGuidedPath({ x: -4, y: 0 }, { x: 4, y: 0 }, room, [obstacle])!;
    const positions = [30, 60, 120].map(fps => {
      let elapsed = 0;
      for (let i = 0; i < fps * 3; i++) elapsed = advanceGuidedTime(elapsed, 1 / fps, true);
      expect(advanceGuidedTime(elapsed, 10, false)).toBe(elapsed);
      return sampleGuidedPath(path, elapsed);
    });
    expect(positions[0].x).toBeCloseTo(positions[2].x, 8);
    expect(positions[1].y).toBeCloseTo(positions[2].y, 8);
    expect(advanceGuidedTime(2, 40, true)).toBe(2.05);
    expect(advanceGuidedTime(2, -1, true)).toBe(2);
    expect(advanceGuidedTime(2, Infinity, true)).toBe(2);
  });

  it('finishes sub-sample travel with a finite acceleration profile', () => {
    const path = buildGuidedPath({ x: 0, y: 3 }, { x: 0.01, y: 3 }, room, [])!;
    expect(Number.isFinite(path.duration)).toBe(true);
    expect(path.duration).toBeGreaterThan(0);
    expect(sampleGuidedPath(path, path.duration)).toMatchObject({ x: 0.01, y: 3 });
  });

  it('builds a finite resumed route from a real interrupted museum pose', () => {
    const displays = mapRoomDisplays(roomDetailSchema.parse(roomA));
    const view = getGuidedView(displays[1], displays)!;
    const path = buildGuidedPath({ x: -0.003955212238692456, y: 5.78644986942391 }, { x: view.position[0], y: view.position[2] }, room,
      getDisplayColliders(displays))!;
    expect(Number.isFinite(path.duration)).toBe(true);
    expect(path.duration).toBeLessThan(20);
  });

  it('limits resultant 3D speed when horizontal travel and vertical reframing coincide', () => {
    const path = buildGuidedPath({ x: 0, y: 4 }, { x: 0, y: 1 }, room, [])!;
    const duration = getGuidedDuration(path.duration, 2);
    let previous = [0, 0, 4];
    const dt = 1 / 120;
    for (let elapsed = dt; elapsed <= duration; elapsed += dt) {
      const p = elapsed / duration, sample = sampleGuidedPath(path, path.duration * p);
      const current = [sample.x, 2 * p * p * (3 - 2 * p), sample.y];
      expect(Math.hypot(...current.map((value, i) => value - previous[i])) / dt).toBeLessThanOrEqual(GUIDED_MOTION.speed + 1e-6);
      previous = current;
    }
  });

  it.each([0, 1].flatMap(height => [30, 60, 120].map(fps => ({ height, fps }))))('bounds vector acceleration at $fps FPS with $height m vertical travel', ({ fps, height }) => {
    const path = buildGuidedPath({ x: -4, y: 0 }, { x: 4, y: 0 }, room, [obstacle])!;
    const duration = getGuidedDuration(path.duration, height);
    const dt = 1 / fps;
    let previous = [-4, 0, 0], velocity = [0, 0, 0];
    for (let elapsed = dt; elapsed <= duration + dt; elapsed += dt) {
      const progress = Math.min(1, elapsed / duration);
      const sample = sampleGuidedPath(path, path.duration * progress);
      const point = [sample.x, height * progress * progress * (3 - 2 * progress), sample.y];
      const nextVelocity = point.map((v, axis) => (v - previous[axis]) / dt);
      expect(Math.hypot(...nextVelocity.map((v, axis) => v - velocity[axis])) / dt).toBeLessThanOrEqual(1.000001);
      velocity = nextVelocity; previous = point;
    }
  });
});

describe('guided exhibit framing', () => {
  it('uses normalized bounds and finds an unobstructed safe viewing position', () => {
    const bounds = { center: [0, 2, 0] as [number, number, number], radius: 1.2 };
    const view = getGuidedView(display, [display], bounds, 0.5, 82)!;
    expect(view).not.toBeNull();
    expect(Math.hypot(...view.position.map((v, i) => v - bounds.center[i]))).toBeGreaterThan(3);
    expect(view.target).toEqual(bounds.center);
    const blocked = { ...display, id: 'two', position: view.position.map((v, i) => i === 1 ? 0 : v) as [number, number, number] };
    const alternative = getGuidedView(display, [display, blocked], bounds, 0.5, 82)!;
    expect(alternative).not.toBeNull();
    expect(alternative.position).not.toEqual(view.position);
  });

  it('rejects out-of-room and nonfinite geometry without moving it', () => {
    expect(getGuidedView({ ...display, isOutsideRoom: true }, [display])).toBeNull();
    expect(getGuidedView({ ...display, position: [NaN, 0, 0] }, [])).toBeNull();
    expect(getGuidedView(display, [display], { center: [0, 2, 0], radius: Infinity })).toBeNull();
    expect(findNavigationPath({ x: -4, y: 0 }, { x: 4, y: 0 }, room, [obstacle])!.length).toBeGreaterThan(2);
  });
});
