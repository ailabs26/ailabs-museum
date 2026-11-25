import { renderHook } from '@testing-library/react-native';
import { Analytics, analytics, sanitizeEvent, useTrackRoomView } from './analytics';

const ID = '10000000-0000-4000-8000-000000000001';
const ID2 = '10000000-0000-4000-8000-000000000002';

describe('sanitizeEvent — không lộ PII', () => {
  it('bỏ mọi trường ngoài danh sách cho phép', () => {
    expect(sanitizeEvent('room_view', { roomId: ID, email: 'a@b.c', name: 'Thắng', token: 'x', lat: 21.02 })).toEqual({ roomId: ID });
  });

  it('PII nhét vào trường hợp lệ -> bỏ cả sự kiện', () => {
    expect(sanitizeEvent('room_view', { roomId: 'a@b.c' })).toBeNull();
    expect(sanitizeEvent('room_view', { roomId: `${ID} a@b.c` })).toBeNull();
    expect(sanitizeEvent('exhibit_view', { exhibitId: ID, mode: 'Thắng' })).toBeNull();
    expect(sanitizeEvent('tour_step', { roomId: ID, step: '0912345678' })).toBeNull();
  });

  it('thiếu trường, số sai, tên sự kiện lạ -> bỏ', () => {
    expect(sanitizeEvent('tour_start', { roomId: ID })).toBeNull();
    expect(sanitizeEvent('tour_start', { roomId: ID, steps: -1 })).toBeNull();
    expect(sanitizeEvent('login', { email: 'a@b.c' })).toBeNull();
    expect(sanitizeEvent('toString', {})).toBeNull();
  });
});

describe('Analytics', () => {
  it('ghi sự kiện phòng / hiện vật / tour với thời điểm và gửi tới sink', () => {
    const a = new Analytics(() => true, 100, () => 5);
    const sink = jest.fn();
    a.addSink(sink);
    a.track('room_view', { roomId: ID });
    a.track('exhibit_view', { exhibitId: ID, mode: 'ar' });
    a.track('tour_start', { roomId: ID, steps: 3 });
    a.track('tour_step', { roomId: ID, step: 1 });
    a.track('tour_complete', { roomId: ID, steps: 3 });
    expect(a.getRecent().map((r) => r.name)).toEqual(['room_view', 'exhibit_view', 'tour_start', 'tour_step', 'tour_complete']);
    expect(sink).toHaveBeenNthCalledWith(1, { at: 5, name: 'room_view', props: { roomId: ID } });
  });

  it('flag tắt -> không ghi, không gửi', () => {
    const a = new Analytics(() => false);
    const sink = jest.fn();
    a.addSink(sink);
    a.track('room_view', { roomId: ID });
    expect(a.getRecent()).toEqual([]);
    expect(sink).not.toHaveBeenCalled();
  });

  it('giữ tối đa capacity; sink lỗi không ảnh hưởng; gỡ sink được', () => {
    const a = new Analytics(() => true, 2);
    a.addSink(() => {
      throw new Error('mạng');
    });
    const good = jest.fn();
    const remove = a.addSink(good);
    [0, 1, 2].forEach((step) => a.track('tour_step', { roomId: ID, step }));
    remove();
    a.track('room_view', { roomId: ID });
    expect(good).toHaveBeenCalledTimes(3);
    expect(a.getRecent()).toHaveLength(2);
  });
});

describe('useTrackRoomView', () => {
  it('chờ có phòng; render lại cùng phòng không tính thêm; đổi phòng tính lượt mới', () => {
    const track = jest.spyOn(analytics, 'track');
    const { rerender } = renderHook(({ id }: { id?: string }) => useTrackRoomView(id), { initialProps: {} as { id?: string } });
    rerender({ id: ID });
    rerender({ id: ID });
    rerender({ id: ID2 });
    expect(track.mock.calls).toEqual([['room_view', { roomId: ID }], ['room_view', { roomId: ID2 }]]);
  });
});
