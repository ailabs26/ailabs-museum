import type { ModelNormalization } from '@/features/scene3d/glbValidation';
import type { MuseumDisplay } from '@/features/scene3d/museumTypes';
import {
  arHotspotStoryReducer,
  computeArMarkerRadius,
  resolveArHotspots,
  resolveArHotspotStory,
} from './arHotspots';

describe('arHotspots — tọa độ hotspot AR & bộ điều hướng story (MOB-E9-03)', () => {
  const baseExhibit: MuseumDisplay = {
    id: 'ex-drum',
    title: 'Trống đồng Ngọc Lũ',
    description: 'Di sản văn hóa Đông Sơn',
    position: [0, 0, -2],
    shape: 'torus',
    color: '#B45309',
    model: {
      id: '10000000-0000-4000-8000-000000000001',
      storageKey: 'models/drum.glb',
      sizeBytes: 1024,
      checksumSha256: 'a'.repeat(64),
      url: `/rooms/dong-son/exhibits/10000000-0000-4000-8000-000000000001/model?version=${'a'.repeat(64)}`,
    },
    hotspots: [
      { id: 'h1', label: 'Mặt trống', body: 'Ngôi sao 14 cánh', position: [10, 20, -10] },
      { id: 'h2', label: 'Thân trống', body: 'Họa tiết thuyền chiến', position: [15, 10, -5] },
    ],
  };

  it('biến đổi chính xác tọa độ nguồn GLB qua normalizeModel sang không gian đặt AR', () => {
    const norm: ModelNormalization = {
      scale: 0.1,
      offset: [-10, -10, 10],
      size: [1.1, 1.1, 1.1],
      center: [0, 0.55, 0],
      radius: 0.95,
    };

    // arFitFactor = 0.55 / 1.1 = 0.5 -> finalScale = 0.1 * 0.5 = 0.05
    const markers = resolveArHotspots(baseExhibit, norm, 0.55);
    expect(markers).toHaveLength(2);
    expect(markers[0]?.position[0]).toBeCloseTo(0);
    expect(markers[0]?.position[1]).toBeCloseTo(0.5);
    expect(markers[0]?.position[2]).toBeCloseTo(0);
    expect(markers[1]?.position[0]).toBeCloseTo(0.25);
    expect(markers[1]?.position[2]).toBeCloseTo(0.25);
    expect(markers[0]?.isDefault).toBe(false);
  });

  it('tạo hotspot mặc định khi hiện vật không có hotspot và tạo vị trí dự phòng không trùng cho tọa độ lỗi', () => {
    const noHotspots: MuseumDisplay = { ...baseExhibit, hotspots: [] };
    const defaultMarkers = resolveArHotspots(noHotspots);
    expect(defaultMarkers).toHaveLength(1);
    expect(defaultMarkers[0]).toMatchObject({
      id: 'ex-drum:default',
      label: 'Trống đồng Ngọc Lũ',
      isDefault: true,
    });

    const badCoords: MuseumDisplay = {
      ...baseExhibit,
      model: null,
      hotspots: [
        { id: 'bad1', label: 'Điểm 1', body: 'B1', position: [Number.NaN, 1, 0] },
        { id: 'bad2', label: 'Điểm 2', body: 'B2', position: [99, 1, 0] },
      ],
    };
    const recovered = resolveArHotspots(badCoords);
    expect(recovered[0]?.position.every(Number.isFinite)).toBe(true);
    expect(recovered[1]?.position.every(Number.isFinite)).toBe(true);
    expect(recovered[0]?.position).not.toEqual(recovered[1]?.position);
  });

  it('bù bán kính marker theo arScale và điều hướng story Trước / Tiếp / Đóng / Reconcile chính xác', () => {
    const smallModelRadius = computeArMarkerRadius(0.25, false);
    const largeModelRadius = computeArMarkerRadius(2.5, false);
    expect(smallModelRadius).toBeGreaterThan(largeModelRadius);
    expect(computeArMarkerRadius(1, true)).toBeGreaterThan(computeArMarkerRadius(1, false));

    const markers = resolveArHotspots({ ...baseExhibit, model: null });
    let state = { selectedId: null as string | null };

    state = arHotspotStoryReducer(state, { type: 'SELECT', hotspotId: 'h1' });
    expect(resolveArHotspotStory(markers, state.selectedId)).toMatchObject({
      index: 0,
      total: 2,
      hasPrev: false,
      hasNext: true,
    });

    state = arHotspotStoryReducer(state, { type: 'NEXT', hotspots: markers });
    expect(state.selectedId).toBe('h2');
    // Ở điểm cuối không vượt biên.
    state = arHotspotStoryReducer(state, { type: 'NEXT', hotspots: markers });
    expect(state.selectedId).toBe('h2');

    state = arHotspotStoryReducer(state, { type: 'PREV', hotspots: markers });
    expect(state.selectedId).toBe('h1');

    // Chạm lại chính điểm đang chọn -> đóng (TOGGLE).
    state = arHotspotStoryReducer(state, { type: 'TOGGLE', hotspotId: 'h1' });
    expect(state.selectedId).toBeNull();

    // Nếu CMS xóa mất hotspot đang mở -> RECONCILE tự đóng an toàn.
    state = arHotspotStoryReducer({ selectedId: 'h2' }, { type: 'RECONCILE', hotspots: [markers[0]!] });
    expect(state.selectedId).toBeNull();
  });
});
