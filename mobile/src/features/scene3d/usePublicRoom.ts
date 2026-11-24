import {
  OFFLINE_NOT_CACHED_MESSAGE,
  isWaitingForNetwork,
  useRoomQuery,
} from '@/features/catalogue/room-queries';
import type { PublicRoomPayload } from './museumTypes';

type RoomState =
  | { status: 'loading' }
  | { status: 'ready'; room: PublicRoomPayload }
  | { status: 'error'; message: string };

/** Phòng trưng bày theo slug — qua react-query nên xem lại được khi offline (MOB-E12-01). */
export function usePublicRoom(slug: string | undefined) {
  const query = useRoomQuery(slug);
  const retry = () => void query.refetch();

  let state: RoomState;
  if (!slug) state = { status: 'error', message: 'Thiếu mã phòng trưng bày.' };
  // Có dữ liệu (kể cả từ cache khi offline) thì luôn hiển thị, lỗi làm mới nền không che nội dung.
  else if (query.data) state = { status: 'ready', room: query.data };
  else if (isWaitingForNetwork(query))
    state = { status: 'error', message: OFFLINE_NOT_CACHED_MESSAGE };
  else if (query.isError && !query.isFetching)
    state = { status: 'error', message: query.error.message || 'Không thể tải phòng trưng bày.' };
  else state = { status: 'loading' };

  return { state, retry };
}
