import type { Vector3 } from 'three';
import {
  EXHIBIT_PLINTH_SIZE,
  MUSEUM_ROOM_SIZE,
  type MuseumDisplay,
} from './museumTypes';
import {
  GALLERY_SLOTS,
  isDisplayOutsideRoom,
  resolveGalleryLayout,
  type GallerySlotDefinition,
} from './gallerySlots';
import {
  NAVIGATION,
  type NavigationCollider,
  type NavigationRoom,
  type NavigationVector,
  type Vec3Tuple,
} from './museumNavigation';

const WALL_FOCUS_MARGIN = 0.4;
const CAMERA_MIN_POLAR = 1.25;

/**
 * Tính hộp va chạm XZ cho từng hiện vật ở chế độ phòng legacy (MOB-E6-06).
 * Bao gồm bán kính bục + `NAVIGATION.bodyRadius` (0.25 m); bỏ qua hiện vật ngoài vỏ phòng.
 */
export function getDisplayColliders(displays: readonly MuseumDisplay[]): NavigationCollider[] {
  return displays
    .filter((display) => !display.isOutsideRoom)
    .map((display) => {
      const isCenterpiece = Boolean(display.model) || display.shape === 'torus';
      const halfSize = isCenterpiece
        ? EXHIBIT_PLINTH_SIZE.centerpieceRadius
        : display.shape === 'sphere' || display.shape === 'cylinder'
          ? EXHIBIT_PLINTH_SIZE.roundRadius
          : Math.max(EXHIBIT_PLINTH_SIZE.squareWidth / 2, display.shape === 'icosahedron' ? 0.64 : 0);
      const radius = halfSize + NAVIGATION.bodyRadius;
      return {
        minX: display.position[0] - radius,
        maxX: display.position[0] + radius,
        minZ: display.position[2] - radius,
        maxZ: display.position[2] + radius,
      };
    });
}

/** Vật cản của 5 bục vật lý Gallery Template V1 — bục trống vẫn chắn đường. */
export function getGallerySlotColliders(
  slots: readonly GallerySlotDefinition[] = GALLERY_SLOTS,
): NavigationCollider[] {
  return slots.map(({ position, footprintRadius }) => {
    const radius = footprintRadius + NAVIGATION.bodyRadius;
    return {
      minX: position[0] - radius,
      maxX: position[0] + radius,
      minZ: position[2] - radius,
      maxZ: position[2] + radius,
    };
  });
}

/**
 * Vật cản chuẩn theo chế độ phòng (`slotted` 5 bục vs `legacy`).
 * `exceptId` bỏ bục của hiện vật đích khi kiểm tra tầm nhìn/điểm đứng ngắm.
 */
export function getGalleryColliders(
  displays: readonly MuseumDisplay[],
  exceptId?: string,
): NavigationCollider[] {
  const layout = resolveGalleryLayout(displays);
  if (layout.mode === 'legacy') {
    return getDisplayColliders(
      exceptId ? displays.filter((display) => display.id !== exceptId) : displays,
    );
  }
  return getGallerySlotColliders(
    layout.slots
      .filter(({ exhibit }) => !exceptId || exhibit?.id !== exceptId)
      .map(({ slot }) => slot),
  );
}

/** Kiểm tra điểm (x, z) có nằm gọn trong tường phòng và ngoài mọi hộp va chạm bục không. */
export function isNavigationPositionSafe(
  x: number,
  z: number,
  room: NavigationRoom,
  colliders: readonly NavigationCollider[],
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  return (
    Math.abs(x) <= room.width / 2 - NAVIGATION.wallMargin &&
    Math.abs(z) <= room.depth / 2 - NAVIGATION.wallMargin &&
    !colliders.some((box) => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ)
  );
}

function navigationCorners(
  room: NavigationRoom,
  colliders: readonly NavigationCollider[],
): NavigationVector[] {
  const points: NavigationVector[] = [];
  for (const box of colliders) {
    for (const x of [box.minX - 0.01, box.maxX + 0.01]) {
      for (const y of [box.minZ - 0.01, box.maxZ + 0.01]) {
        if (isNavigationPositionSafe(x, y, room, colliders)) {
          points.push({ x, y });
        }
      }
    }
  }
  return points;
}

/**
 * Tìm điểm an toàn gần nhất khi vị trí xuất phát/camera bị kẹt bên trong bục mới xuất bản.
 */
export function findSafeNavigationPoint(
  point: NavigationVector,
  room: NavigationRoom,
  colliders: readonly NavigationCollider[],
): NavigationVector | null {
  const x = Math.max(
    -room.width / 2 + NAVIGATION.wallMargin,
    Math.min(room.width / 2 - NAVIGATION.wallMargin, point.x),
  );
  const y = Math.max(
    -room.depth / 2 + NAVIGATION.wallMargin,
    Math.min(room.depth / 2 - NAVIGATION.wallMargin, point.y),
  );
  if (isNavigationPositionSafe(x, y, room, colliders)) return { x, y };

  const candidates = navigationCorners(room, colliders);
  for (const box of colliders) {
    candidates.push(
      { x: box.minX - 0.01, y },
      { x: box.maxX + 0.01, y },
      { x, y: box.minZ - 0.01 },
      { x, y: box.maxZ + 0.01 },
    );
  }
  const safe = candidates
    .filter((candidate) => isNavigationPositionSafe(candidate.x, candidate.y, room, colliders))
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  return safe[0] ?? null;
}

/**
 * Kiểm tra đoạn thẳng quét (slab intersection) chính xác: loại mọi đoạn cắt xuyên bục.
 */
export function isNavigationSegmentSafe(
  a: NavigationVector,
  b: NavigationVector,
  room: NavigationRoom,
  colliders: readonly NavigationCollider[],
): boolean {
  if (
    !isNavigationPositionSafe(a.x, a.y, room, colliders) ||
    !isNavigationPositionSafe(b.x, b.y, room, colliders)
  ) {
    return false;
  }
  return !colliders.some((box) => {
    let enter = 0;
    let exit = 1;
    const axes: readonly [number, number, number, number][] = [
      [a.x, b.x - a.x, box.minX, box.maxX],
      [a.y, b.y - a.y, box.minZ, box.maxZ],
    ];
    for (const [origin, direction, low, high] of axes) {
      if (Math.abs(direction) < 1e-9) {
        if (origin <= low || origin >= high) return false;
      } else {
        const first = (low - origin) / direction;
        const second = (high - origin) / direction;
        enter = Math.max(enter, Math.min(first, second));
        exit = Math.min(exit, Math.max(first, second));
        if (enter >= exit) return false;
      }
    }
    return enter < exit;
  });
}

/**
 * Tìm đường đi ngắn nhất không va chạm bằng đồ thị tầm nhìn (visibility graph + Dijkstra)
 * quanh các góc bục mở rộng. Trả `null` nếu điểm đầu hoặc đích không hợp lệ/không tới được.
 */
export function findNavigationPath(
  start: NavigationVector,
  end: NavigationVector,
  room: NavigationRoom,
  colliders: readonly NavigationCollider[],
): NavigationVector[] | null {
  if (
    !isNavigationPositionSafe(start.x, start.y, room, colliders) ||
    !isNavigationPositionSafe(end.x, end.y, room, colliders)
  ) {
    return null;
  }
  const isClear = (p: NavigationVector, q: NavigationVector) =>
    isNavigationSegmentSafe(p, q, room, colliders);
  if (isClear(start, end)) return [start, end];

  const nodes: NavigationVector[] = [start, end, ...navigationCorners(room, colliders)];
  const distances = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  distances[0] = 0;

  for (let step = 0; step < nodes.length; step++) {
    let current = -1;
    let bestDist = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const dist = distances[i] ?? Infinity;
      if (!visited.has(i) && dist < bestDist) {
        bestDist = dist;
        current = i;
      }
    }
    if (current < 0 || !Number.isFinite(bestDist)) break;
    if (current === 1) {
      const path: NavigationVector[] = [];
      for (let i = 1; i !== -1; i = previous[i] ?? -1) {
        const node = nodes[i];
        if (node) path.unshift(node);
      }
      return path;
    }
    visited.add(current);
    const currentNode = nodes[current]!;
    for (let next = 0; next < nodes.length; next++) {
      if (visited.has(next)) continue;
      const nextNode = nodes[next]!;
      if (!isClear(currentNode, nextNode)) continue;
      const candidateDist = bestDist + Math.hypot(nextNode.x - currentNode.x, nextNode.y - currentNode.y);
      if (candidateDist < (distances[next] ?? Infinity)) {
        distances[next] = candidateDist;
        previous[next] = current;
      }
    }
  }
  return null;
}

/**
 * Di chuyển camera có kiểm tra va chạm chia bước nhỏ 8 cm để chống xuyên bục (tunneling),
 * đồng thời trượt mượt dọc tường/bục trên từng trục X và Z độc lập.
 */
export function moveWithCollisions(
  position: Vector3,
  dx: number,
  dz: number,
  room: NavigationRoom,
  colliders: readonly NavigationCollider[],
): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.08));
  const stepX = dx / steps;
  const stepZ = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (isNavigationPositionSafe(position.x + stepX, position.z, room, colliders)) {
      position.x += stepX;
    }
    if (isNavigationPositionSafe(position.x, position.z + stepZ, room, colliders)) {
      position.z += stepZ;
    }
  }
}

export interface PlannedFocusRoute {
  path: NavigationVector[];
  lengths: number[];
  totalLength: number;
  destinationY: number;
  target: Vec3Tuple;
}

function getOrbitLimit(target: Vec3Tuple): number {
  return Math.min(
    6,
    MUSEUM_ROOM_SIZE.width / 2 - WALL_FOCUS_MARGIN - Math.abs(target[0]),
    MUSEUM_ROOM_SIZE.depth / 2 - WALL_FOCUS_MARGIN - Math.abs(target[2]),
    (MUSEUM_ROOM_SIZE.height - WALL_FOCUS_MARGIN - target[1]) / Math.cos(CAMERA_MIN_POLAR),
  );
}

/**
 * Lập lộ trình camera không va chạm từ vị trí hiện tại tới điểm đứng ngắm tối ưu của một hiện vật.
 */
export function planExhibitFocusRoute(
  fromPosition: Vec3Tuple,
  exhibit: MuseumDisplay,
  displays: readonly MuseumDisplay[],
  room: NavigationRoom = MUSEUM_ROOM_SIZE,
): PlannedFocusRoute | null {
  if (exhibit.isOutsideRoom || isDisplayOutsideRoom(exhibit)) return null;
  const colliders = getGalleryColliders(displays);
  const [ex, ey, ez] = exhibit.position;
  const target: Vec3Tuple = [
    Math.max(-4.1, Math.min(4.1, ex)),
    Math.min(3.2, ey + (exhibit.shape === 'torus' ? 2.16 : 1.73)),
    Math.max(-5.1, Math.min(5.1, ez)),
  ];
  const radius = Math.min(3.4, Math.max(1.8, getOrbitLimit(target)));
  const radialLen = Math.hypot(target[0], target[2]);
  const horizontal = radius * Math.sin(1.35);
  let destX = target[0] + (radialLen ? -target[0] / radialLen : 0) * horizontal;
  let destZ = target[2] + (radialLen ? -target[2] / radialLen : 1) * horizontal;
  const destY = Math.max(0.41, Math.min(4.59, target[1] + radius * Math.cos(1.35)));

  if (!isNavigationPositionSafe(destX, destZ, room, colliders)) {
    let found = false;
    const baseDist = Math.max(1.8, Math.hypot(destX - target[0], destZ - target[2]));
    for (let ring = 0; ring < 3 && !found; ring++) {
      for (let i = 0; i < 24; i++) {
        const angle = (i * Math.PI) / 12;
        const r = baseDist + ring * 0.6;
        const cx = target[0] + Math.sin(angle) * r;
        const cz = target[2] + Math.cos(angle) * r;
        if (isNavigationPositionSafe(cx, cz, room, colliders)) {
          destX = cx;
          destZ = cz;
          found = true;
          break;
        }
      }
    }
    if (!found) return null;
  }

  const start = findSafeNavigationPoint({ x: fromPosition[0], y: fromPosition[2] }, room, colliders);
  if (!start) return null;

  const path = findNavigationPath(start, { x: destX, y: destZ }, room, colliders);
  if (!path || path.length < 2) return null;

  const lengths: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const curr = path[i]!;
    lengths.push((lengths[i - 1] ?? 0) + Math.hypot(curr.x - prev.x, curr.y - prev.y));
  }
  const totalLength = lengths[lengths.length - 1] ?? 0;

  return { path, lengths, totalLength, destinationY: destY, target };
}

/** Lấy mẫu tọa độ (x, z) tại tỷ lệ `progress` ∈ [0, 1] dọc theo đường đi đa giác đã tính. */
export function sampleFocusRoute(route: PlannedFocusRoute, progress: number): NavigationVector {
  const clamped = Math.max(0, Math.min(1, progress));
  const first = route.path[0]!;
  const last = route.path[route.path.length - 1]!;
  if (clamped <= 0 || route.totalLength <= 1e-6) return first;
  if (clamped >= 1) return last;

  const distance = route.totalLength * clamped;
  let seg = 1;
  while (seg < route.path.length - 1 && (route.lengths[seg] ?? 0) < distance) {
    seg += 1;
  }
  const prevLen = route.lengths[seg - 1] ?? 0;
  const segLen = (route.lengths[seg] ?? prevLen) - prevLen;
  const t = segLen > 1e-9 ? Math.max(0, Math.min(1, (distance - prevLen) / segLen)) : 1;
  const from = route.path[seg - 1]!;
  const to = route.path[seg]!;
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}
