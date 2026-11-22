import { useQuery } from '@tanstack/react-query';
import { publicRoomApi } from '@/features/scene3d/publicRoomApi';

/**
 * Query catalogue phòng (MOB-E12-01): đi qua react-query nên được lưu cache ra đĩa (MOB-E3-02)
 * và vẫn xem được khi mất mạng. Nền cho `useRooms`/`useRoom` của task roomsApi (MOB-E4-01, TV3).
 */
export const roomKeys = {
  all: ['rooms'] as const,
  list: () => [...roomKeys.all, 'list'] as const,
  detail: (slug: string) => [...roomKeys.all, 'detail', slug] as const,
};

export const OFFLINE_NOT_CACHED_MESSAGE =
  'Bạn đang offline và nội dung này chưa được tải trước. Kết nối mạng rồi thử lại.';

export function useRoomsQuery() {
  return useQuery({
    queryKey: roomKeys.list(),
    queryFn: ({ signal }) => publicRoomApi.list(signal),
  });
}

export function useRoomQuery(slug: string | undefined) {
  return useQuery({
    queryKey: roomKeys.detail(slug ?? ''),
    queryFn: ({ signal }) => publicRoomApi.detail(slug as string, signal),
    enabled: Boolean(slug),
  });
}

/** Query đang chờ mạng mà chưa có dữ liệu cache → báo người dùng thay vì quay vòng mãi. */
export function isWaitingForNetwork(query: { data: unknown; fetchStatus: string }): boolean {
  return query.data === undefined && query.fetchStatus === 'paused';
}
