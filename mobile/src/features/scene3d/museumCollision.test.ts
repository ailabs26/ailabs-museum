import { Vector3 } from 'three';
import { GALLERY_SLOTS } from './gallerySlots';
import {
  findNavigationPath,
  findSafeNavigationPoint,
  getDisplayColliders,
  getGalleryColliders,
  getGallerySlotColliders,
  isNavigationPositionSafe,
  isNavigationSegmentSafe,
  moveWithCollisions,
  planExhibitFocusRoute,
  sampleFocusRoute,
} from './museumCollision';
import { INITIAL_CAMERA_POSITION, NAVIGATION } from './museumNavigation';
import { MUSEUM_ROOM_SIZE, type MuseumDisplay } from './museumTypes';

const ROOM = MUSEUM_ROOM_SIZE;
const centerDisplay: MuseumDisplay = {
  id: 'one',
  title: 'Trống đồng',
  description: '',
  shape: 'torus',
  color: '#fff',
  position: [0, 0, 0],
};

function onSlot(id: string, slotIndex: number): MuseumDisplay {
  const slot = GALLERY_SLOTS[slotIndex]!;
  return {
    id,
    title: id,
    description: '',
    shape: 'cube',
    color: '#0F766E',
    position: [slot.position[0], slot.position[1], slot.position[2]],
  };
}

describe('museumCollision — chống xuyên tường/hiện vật & tìm đường an toàn (MOB-E6-06)', () => {
  it('chặn tunneling xuyên qua bục, cho phép trượt dọc bục và giới hạn tường mọi kích thước phòng', () => {
    const colliders = getDisplayColliders([centerDisplay]);
    const position = new Vector3(0, NAVIGATION.eyeHeight, 5);

    // Bước nhảy cực lớn 10m thẳng vào bục trung tâm -> phải dừng ngoài bán kính bục (> 1.45m).
    moveWithCollisions(position, 0, -10, ROOM, colliders);
    expect(position.z).toBeGreaterThan(1.45);

    // Trượt chéo dọc cạnh bục -> trục X vẫn tiến mượt.
    moveWithCollisions(position, 4, -1, ROOM, colliders);
    expect(position.x).toBeGreaterThan(3);

    // Đẩy vượt tường phòng nhỏ 10x12 -> kẹp trong tường và giữ nguyên độ cao mắt Y.
    moveWithCollisions(position, 100, 100, { width: 10, depth: 12, height: 5 }, []);
    expect(position.x).toBeLessThan(5);
    expect(position.z).toBeLessThan(6);
    expect(position.y).toBe(NAVIGATION.eyeHeight);
  });

  it('bảo vệ đủ 5 bục vật lý S01..S05 kể cả khi trống, không chồng lấn và đi được vòng quanh cả 4 mặt mỗi bục', () => {
    const colliders = getGalleryColliders([]);
    expect(colliders).toHaveLength(5);

    // Kiểm tra tọa độ biên bục trung tâm S01 khớp từng số lẻ với web.
    const hero = colliders[0]!;
    expect([hero.minX, hero.maxX, hero.minZ, hero.maxZ].map((v) => +v.toFixed(6))).toEqual([
      -1.47, 1.47, -3.47, -0.53,
    ]);

    // 5 bục không chồng lấn nhau.
    for (let i = 0; i < colliders.length; i++) {
      for (let j = i + 1; j < colliders.length; j++) {
        const a = colliders[i]!;
        const b = colliders[j]!;
        expect(
          a.maxX <= b.minX || b.maxX <= a.minX || a.maxZ <= b.minZ || b.maxZ <= a.minZ,
        ).toBe(true);
      }
    }

    // Điểm spawn ban đầu an toàn và đi tới được 4 mặt của toàn bộ 5 bục mà không cắt xuyên bất kỳ bục nào.
    const spawn = { x: INITIAL_CAMERA_POSITION[0], y: INITIAL_CAMERA_POSITION[2] };
    expect(isNavigationPositionSafe(spawn.x, spawn.y, ROOM, colliders)).toBe(true);
    for (const box of colliders) {
      const cx = (box.minX + box.maxX) / 2;
      const cz = (box.minZ + box.maxZ) / 2;
      const sides = [
        { x: cx, y: box.maxZ + 0.3 },
        { x: cx, y: box.minZ - 0.3 },
        { x: box.minX - 0.3, y: cz },
        { x: box.maxX + 0.3, y: cz },
      ];
      for (const point of sides) {
        const path = findNavigationPath(spawn, point, ROOM, colliders);
        expect(path).not.toBeNull();
        for (let k = 1; k < (path?.length ?? 0); k++) {
          expect(isNavigationSegmentSafe(path![k - 1]!, path![k]!, ROOM, colliders)).toBe(true);
        }
      }
    }
  });

  it('tìm đường vòng quanh bục chắn và trả null nếu đích nằm bên trong vật cản', () => {
    const colliders = getDisplayColliders([centerDisplay]);
    const path = findNavigationPath({ x: 0, y: 5 }, { x: 0, y: -5 }, ROOM, colliders);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(2);
    expect(path!.at(-1)).toEqual({ x: 0, y: -5 });

    // Kiểm tra dày đặc 100 điểm lấy mẫu trên từng đoạn: tuyệt đối không điểm nào lọt vào bục.
    for (let i = 1; i < path!.length; i++) {
      for (let sample = 0; sample <= 100; sample++) {
        const t = sample / 100;
        const px = path![i - 1]!.x * (1 - t) + path![i]!.x * t;
        const pz = path![i - 1]!.y * (1 - t) + path![i]!.y * t;
        expect(isNavigationPositionSafe(px, pz, ROOM, colliders)).toBe(true);
      }
    }

    expect(findNavigationPath({ x: 0, y: 5 }, { x: 0, y: 0 }, ROOM, colliders)).toBeNull();
  });

  it('giải thoát camera bị kẹt trong bục và bỏ qua duy nhất bục mục tiêu khi truyền exceptId', () => {
    const colliders = getDisplayColliders([centerDisplay]);
    const rescued = findSafeNavigationPoint({ x: 0, y: 0 }, ROOM, colliders);
    expect(rescued).not.toBeNull();
    expect(isNavigationPositionSafe(rescued!.x, rescued!.y, ROOM, colliders)).toBe(true);
    expect(Math.hypot(rescued!.x, rescued!.y)).toBeLessThan(2.1);

    const displays = [onSlot('a', 0), onSlot('b', 3)];
    const withoutA = getGalleryColliders(displays, 'a');
    expect(withoutA).toHaveLength(4);
    expect(isNavigationPositionSafe(0, -2, ROOM, withoutA)).toBe(true);
    expect(getGallerySlotColliders()).toHaveLength(5);
  });

  it('planExhibitFocusRoute dẫn camera từ lối vào vòng qua S01 đến tận S02 mà mọi điểm mẫu đều an toàn', () => {
    const displays = GALLERY_SLOTS.map((_, idx) => onSlot(`ex-${idx}`, idx));
    const colliders = getGalleryColliders(displays);
    const route = planExhibitFocusRoute(INITIAL_CAMERA_POSITION, displays[1]!, displays, ROOM);
    expect(route).not.toBeNull();

    for (let step = 0; step <= 50; step++) {
      const sample = sampleFocusRoute(route!, step / 50);
      expect(isNavigationPositionSafe(sample.x, sample.y, ROOM, colliders)).toBe(true);
    }
  });
});
