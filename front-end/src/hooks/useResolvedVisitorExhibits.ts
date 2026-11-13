import { useQueries } from '@tanstack/react-query';
import type { VisitorExhibitRef } from '@/helpers/visitorState';
import { museumService } from '@/services/museum.service';
import type { RoomDetail, RoomSummary } from '@/validations/roomSchema';

export interface ResolvedVisitorExhibit { room: RoomSummary; exhibit: RoomDetail['exhibits'][number] }

/** Resolve identifiers only through the current, validated public room list and details. */
export function useResolvedVisitorExhibits(refs: readonly VisitorExhibitRef[], rooms: readonly RoomSummary[]) {
  const requiredRooms = rooms.filter(room => refs.some(ref => ref.roomId === room.id));
  const queries = useQueries({ queries: requiredRooms.map(room => ({
    queryKey: ['museum-tour', 'room', room.id, room.slug],
    meta: { public: true },
    queryFn: ({ signal }: { signal: AbortSignal }) => museumService.getRoom(room, signal),
    retry: false,
    refetchOnMount: 'always' as const,
  })) });
  const entries = refs.map(ref => {
    const index = requiredRooms.findIndex(room => room.id === ref.roomId);
    const query = queries[index];
    if (!query?.isSuccess || query.isFetching) return undefined;
    const exhibit = query.data.exhibits.find(item => item.id === ref.exhibitId);
    return exhibit ? { room: requiredRooms[index], exhibit } : undefined;
  });
  return { entries, isLoading: queries.some(query => query.isPending || query.isFetching), hasError: queries.some(query => query.isError) };
}
