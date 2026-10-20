// Explicit test inputs mirroring ExhibitsService; never a production fallback.
export const ROOM_A_ID = '00000000-0000-4000-8000-000000000001';
export const ROOM_B_ID = '00000000-0000-4000-8000-000000000002';
export const ROOM_C_ID = '00000000-0000-4000-8000-000000000003';
export const roomSummaries = [
  { id: ROOM_A_ID, slug: 'sculpture', name: 'Không gian của hình khối', description: 'Phòng điêu khắc', status: 'active', isDeleted: false, deletedAt: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  { id: ROOM_B_ID, slug: 'ceramics', name: 'Gốm Việt', description: null, status: 'active', isDeleted: false, deletedAt: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  { id: ROOM_C_ID, slug: 'empty', name: 'Phòng mới', description: null, status: 'active', isDeleted: false, deletedAt: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
];
export function exhibit(index = 1, roomId = ROOM_A_ID) {
  return {
    id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    roomId, displayOrder: index, name: `Hiện vật ${index}`, description: `Mô tả hiện vật ${index}`,
    positionX: 0, positionY: 0, positionZ: 0, transcript: null,
    placeholderShape: 'box', placeholderColor: '#8b7355', hotspots: [],
    model: null, image: null, audio: null,
  };
}
export const roomA = {
  id: ROOM_A_ID, slug: 'sculpture', name: 'Không gian của hình khối', description: 'Phòng điêu khắc',
  exhibits: ['torus', 'sphere', 'box', 'cone', 'cylinder'].map((shape, index) => ({
    ...exhibit(index + 1), placeholderShape: shape,
    positionX: [0, -5.3, 5.3, -5.3, 5.3][index], positionZ: [0, -5.1, -5.1, 5.1, 5.1][index],
  })),
};
export const roomB = { id: ROOM_B_ID, slug: 'ceramics', name: 'Gốm Việt', description: null, exhibits: [{ ...exhibit(6, ROOM_B_ID), name: 'Bình gốm', placeholderShape: 'cylinder' }] };
export const roomC = { id: ROOM_C_ID, slug: 'empty', name: 'Phòng mới', description: null, exhibits: [] };
export function envelope(data: unknown) { return { success: true, data, message: null }; }
