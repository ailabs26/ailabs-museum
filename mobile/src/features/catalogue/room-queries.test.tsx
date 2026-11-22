import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { publicRoomApi } from '@/features/scene3d/publicRoomApi';
import type { PublicRoomPayload } from '@/features/scene3d/museumTypes';
import { usePublicRoom } from '@/features/scene3d/usePublicRoom';
import { OFFLINE_NOT_CACHED_MESSAGE, roomKeys, useRoomsQuery } from './room-queries';

const ROOM = { id: 'r1', slug: 'phong-1', name: 'Phòng gốm', description: null, exhibits: [] } as unknown as PublicRoomPayload;

function setup(seed?: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  seed?.(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('catalogue phòng khi mất mạng', () => {
  let detail: jest.SpyInstance;
  let list: jest.SpyInstance;

  beforeEach(() => {
    detail = jest.spyOn(publicRoomApi, 'detail').mockResolvedValue(ROOM);
    list = jest.spyOn(publicRoomApi, 'list').mockResolvedValue([ROOM]);
  });

  afterEach(() => {
    act(() => onlineManager.setOnline(true));
    jest.restoreAllMocks();
  });

  it('offline + đã tải trước (cache) -> hiện ngay, không gọi mạng', async () => {
    act(() => onlineManager.setOnline(false));
    const { wrapper } = setup((c) => c.setQueryData(roomKeys.detail('phong-1'), ROOM, { updatedAt: 0 }));
    const { result } = renderHook(() => usePublicRoom('phong-1'), { wrapper });
    expect(result.current.state).toEqual({ status: 'ready', room: ROOM });
    expect(detail).not.toHaveBeenCalled();
  });

  it('offline + chưa có cache -> báo rõ thay vì quay vòng mãi; có mạng lại thì tự tải', async () => {
    act(() => onlineManager.setOnline(false));
    const { wrapper } = setup();
    const { result } = renderHook(() => usePublicRoom('phong-1'), { wrapper });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'error', message: OFFLINE_NOT_CACHED_MESSAGE }));
    expect(detail).not.toHaveBeenCalled();

    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', room: ROOM }));
  });

  it('online -> tải từ API; lỗi API hiện message, Thử lại tải lại', async () => {
    detail.mockRejectedValueOnce(new Error('API trả lỗi 503.'));
    const { wrapper } = setup();
    const { result } = renderHook(() => usePublicRoom('phong-1'), { wrapper });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'error', message: 'API trả lỗi 503.' }));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });

  it('thiếu slug -> lỗi, không gọi API', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => usePublicRoom(undefined), { wrapper });
    expect(result.current.state).toEqual({ status: 'error', message: 'Thiếu mã phòng trưng bày.' });
    expect(detail).not.toHaveBeenCalled();
  });

  it('danh sách phòng đã cache vẫn hiện khi offline', () => {
    act(() => onlineManager.setOnline(false));
    const { wrapper } = setup((c) => c.setQueryData(roomKeys.list(), [ROOM], { updatedAt: 0 }));
    const { result } = renderHook(() => useRoomsQuery(), { wrapper });
    expect(result.current.data).toEqual([ROOM]);
    expect(result.current.fetchStatus).toBe('paused');
    expect(list).not.toHaveBeenCalled();
  });
});
