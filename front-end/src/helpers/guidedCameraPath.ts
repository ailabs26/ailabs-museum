import { MUSEUM_ROOM_SIZE, type MuseumDisplay } from '@/interfaces/museumScene';
import { getExhibitView, type ModelFocusBounds, type MuseumCameraView } from './museumCamera';
import { findNavigationPath, findSafeNavigationPoint, getDisplayColliders, isNavigationPositionSafe, isNavigationSegmentSafe, NAVIGATION, type NavigationCollider, type NavigationRoom, type NavigationVector } from './museumNavigation';

export const GUIDED_MOTION = { speed: 1.25, acceleration: 1, turnSpeed: 1.3 } as const;
export interface GuidedPath {
  points: NavigationVector[];
  distances: number[];
  speeds: number[];
  times: number[];
  length: number;
  duration: number;
}
export function getGuidedDuration(horizontalDuration: number, verticalDistance: number): number {
  const height = Math.abs(verticalDistance);
  // Triangle bounds include simultaneous vertical easing and horizontal travel.
  return Math.max(horizontalDuration + height * 1.5 / GUIDED_MOTION.speed,
    Math.sqrt(horizontalDuration ** 2 + 6 * height / GUIDED_MOTION.acceleration));
}
const distance = (a: NavigationVector, b: NavigationVector) => Math.hypot(b.x - a.x, b.y - a.y);
const mix = (a: NavigationVector, b: NavigationVector, t: number): NavigationVector => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Use actual bounds for framing and reject a safe but occluded destination. */
export function getGuidedView(display: MuseumDisplay, displays: readonly MuseumDisplay[], bounds?: ModelFocusBounds, aspect = 1.7, fov = 60): MuseumCameraView | null {
  if (!display.position.every(Number.isFinite) || !Number.isFinite(aspect) || aspect <= 0
    || (bounds && (!bounds.center.every(Number.isFinite) || !Number.isFinite(bounds.radius) || bounds.radius <= 0))) return null;
  const view = getExhibitView(display, bounds, aspect, fov);
  if (!view) return null;
  const target: MuseumCameraView['target'] = bounds?.center ?? [display.position[0], view.target[1], display.position[2]];
  const halfFov = Math.min(fov * Math.PI / 360, Math.atan(Math.tan(fov * Math.PI / 360) * aspect));
  const minimumDistance = (bounds?.radius ?? (display.shape === 'torus' ? 1.15 : 0.85)) * 1.15 / Math.sin(halfFov);
  const colliders = getDisplayColliders(displays);
  const otherColliders = getDisplayColliders(displays.filter(item => item.id !== display.id));
  const safe = (position: MuseumCameraView['position']) => position.every(Number.isFinite)
    && position[1] >= NAVIGATION.wallMargin && position[1] <= MUSEUM_ROOM_SIZE.height - NAVIGATION.wallMargin
    && Math.hypot(...position.map((value, i) => value - target[i])) >= minimumDistance - 1e-6
    && isNavigationPositionSafe(position[0], position[2], MUSEUM_ROOM_SIZE, colliders)
    && isNavigationSegmentSafe({ x: position[0], y: position[2] }, { x: target[0], y: target[2] }, MUSEUM_ROOM_SIZE, otherColliders);
  if (safe(view.position)) return { target, position: view.position };
  const candidates: MuseumCameraView['position'][] = [];
  const nearest = findSafeNavigationPoint({ x: view.position[0], y: view.position[2] }, MUSEUM_ROOM_SIZE, colliders);
  if (nearest) candidates.push([nearest.x, view.position[1], nearest.y]);
  const radius = Math.max(minimumDistance, Math.hypot(view.position[0] - target[0], view.position[2] - target[2]));
  for (let ring = 0; ring < 4; ring++) for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI / 24, r = radius + ring * 0.4;
    candidates.push([target[0] + Math.sin(angle) * r, Math.max(0.45, Math.min(4.55, view.position[1])), target[2] + Math.cos(angle) * r]);
  }
  const position = candidates.filter(safe).sort((a, b) =>
    Math.hypot(...a.map((v, i) => v - view.position[i])) - Math.hypot(...b.map((v, i) => v - view.position[i])))[0];
  return position ? { target, position } : null;
}

/** Bounded corner rounding keeps the original turn when every curve is obstructed. */
export function roundGuidedPathCorners(route: readonly NavigationVector[], room: NavigationRoom, colliders: readonly NavigationCollider[]): NavigationVector[] {
  if (route.length < 2) return [...route];
  const clear = (a: NavigationVector, b: NavigationVector) => isNavigationSegmentSafe(a, b, room, colliders);
  const rounded = [route[0]];
  for (let i = 1; i < route.length - 1; i++) {
    const before = route[i - 1], corner = route[i], after = route[i + 1];
    let radius = Math.min(0.55, distance(before, corner) * 0.4, distance(corner, after) * 0.4);
    let curve: NavigationVector[] = [corner];
    for (let attempt = 0; attempt < 8 && radius > 0.002; attempt++, radius /= 2) {
      const a = mix(corner, before, radius / distance(before, corner));
      const b = mix(corner, after, radius / distance(after, corner));
      // Short chords bound direction changes even when sampled at 120 Hz.
      const count = Math.max(4, Math.ceil(radius * 2 / 0.005));
      const samples = Array.from({ length: count + 1 }, (_, index) => {
        const t = index / count;
        return mix(mix(a, corner, t), mix(corner, b, t), t);
      });
      if (clear(rounded.at(-1)!, a) && samples.every((p, index) => !index || clear(samples[index - 1], p))) { curve = samples; break; }
    }
    rounded.push(...curve);
  }
  rounded.push(route.at(-1)!);
  return rounded;
}

/** The validated sampled polyline is also the rendered curve, avoiding spline overshoot. */
export function buildGuidedPath(start: NavigationVector, end: NavigationVector, room: NavigationRoom, colliders: readonly NavigationCollider[]): GuidedPath | null {
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return null;
  const expanded = colliders.map(box => ({ minX: box.minX - 0.22, maxX: box.maxX + 0.22, minZ: box.minZ - 0.22, maxZ: box.maxZ + 0.22 }));
  const route = findNavigationPath(start, end, room, expanded) ?? findNavigationPath(start, end, room, colliders);
  if (!route) return null;
  const clear = (a: NavigationVector, b: NavigationVector) => isNavigationSegmentSafe(a, b, room, colliders);
  const routingBoxes = route.every(p => isNavigationPositionSafe(p.x, p.y, room, expanded)) ? expanded : colliders;
  const pruned = [route[0]];
  for (let i = 0; i < route.length - 1;) {
    let next = route.length - 1;
    while (next > i + 1 && !isNavigationSegmentSafe(route[i], route[next], room, routingBoxes)) next--;
    pruned.push(route[next]); i = next;
  }
  const rounded = roundGuidedPathCorners(pruned, room, colliders);
  const points = [start], distances = [0];
  for (let i = 1; i < rounded.length; i++) {
    const from = rounded[i - 1], to = rounded[i], length = distance(from, to);
    // Even a centimetre-long trip needs an interior acceleration/deceleration sample.
    const count = length ? Math.max(2, Math.ceil(length / 0.04)) : 0;
    for (let j = 1; j <= count; j++) {
      const point = j === count ? to : mix(from, to, j / count), previous = points.at(-1)!;
      if (!clear(previous, point)) return null;
      distances.push(distances.at(-1)! + distance(previous, point)); points.push(point);
    }
  }
  const speeds: number[] = points.map(() => GUIDED_MOTION.speed);
  // Reserve part of the vector acceleration budget for turning while speeding up.
  const tangentialAcceleration = GUIDED_MOTION.acceleration * 0.6;
  const lateralAcceleration = GUIDED_MOTION.acceleration * 0.4;
  speeds[0] = speeds[speeds.length - 1] = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const turn = Math.abs(Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x),
      (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)));
    const curvature = turn / Math.max(1e-6, (distance(a, b) + distance(b, c)) / 2);
    speeds[i] = turn > 0.35 ? 0 : Math.min(GUIDED_MOTION.speed, Math.sqrt(lateralAcceleration / Math.max(curvature, 1e-6)));
  }
  for (let i = 1; i < points.length; i++) speeds[i] = Math.min(speeds[i], Math.sqrt(speeds[i - 1] ** 2 + 2 * tangentialAcceleration * (distances[i] - distances[i - 1])));
  for (let i = points.length - 2; i >= 0; i--) speeds[i] = Math.min(speeds[i], Math.sqrt(speeds[i + 1] ** 2 + 2 * tangentialAcceleration * (distances[i + 1] - distances[i])));
  const times = [0];
  for (let i = 1; i < points.length; i++) times.push(times[i - 1] + 2 * (distances[i] - distances[i - 1]) / (speeds[i - 1] + speeds[i]));
  return { points, distances, speeds, times, length: distances.at(-1)!, duration: times.at(-1)! };
}

function upperIndex(values: readonly number[], value: number): number {
  let low = 1, high = values.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] < value) low = middle + 1; else high = middle;
  }
  return low;
}

export function sampleGuidedDistance(path: GuidedPath, distanceAlong: number): NavigationVector {
  if (!path.length) return path.points[0];
  const d = Math.max(0, Math.min(path.length, distanceAlong)), i = upperIndex(path.distances, d);
  return mix(path.points[i - 1], path.points[i], (d - path.distances[i - 1]) / (path.distances[i] - path.distances[i - 1]));
}

export function sampleGuidedPath(path: GuidedPath, elapsed: number) {
  if (!path.length || elapsed >= path.duration) return { ...path.points.at(-1)!, distance: path.length };
  const t = Math.max(0, elapsed), i = upperIndex(path.times, t), dt = t - path.times[i - 1];
  const acceleration = (path.speeds[i] - path.speeds[i - 1]) / (path.times[i] - path.times[i - 1]);
  const d = path.distances[i - 1] + path.speeds[i - 1] * dt + 0.5 * acceleration * dt * dt;
  return { ...sampleGuidedDistance(path, d), distance: d };
}

export function advanceGuidedTime(elapsed: number, delta: number, running: boolean): number {
  return elapsed + (running && Number.isFinite(delta) ? Math.max(0, Math.min(NAVIGATION.maxDelta, delta)) : 0);
}
