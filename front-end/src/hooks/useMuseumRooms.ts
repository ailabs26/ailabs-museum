import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { localizeRoom } from '@/helpers/localizeExhibit';
import { museumService } from '@/services/museum.service';
import type { RoomDetail, RoomSummary } from '@/validations/roomSchema';

export function useMuseumRooms(requestedSlug: string | null) {
  const client = useQueryClient();
  const { locale } = usePublicLocale();
  // Dịch ở `select`: cache giữ dữ liệu gốc, đổi ngôn ngữ không phải tải lại.
  const localizeList = useCallback((list: RoomSummary[]) => list.map((item) => localizeRoom(item, locale)), [locale]);
  const localizeDetail = useCallback((detail: RoomDetail) => localizeRoom(detail, locale), [locale]);
  const rooms = useQuery({
    queryKey: ['museum-tour', 'rooms'],
    meta: { public: true },
    queryFn: ({ signal }) => museumService.listRooms(signal),
    select: localizeList,
    retry: false,
  });
  const selectedSlug = requestedSlug ?? rooms.data?.[0]?.slug;
  const selectedRoom = rooms.isSuccess ? rooms.data.find((room) => room.slug === selectedSlug) : undefined;
  const room = useQuery({
    queryKey: ['museum-tour', 'room', selectedRoom?.id, selectedRoom?.slug],
    meta: { public: true },
    queryFn: ({ signal }) => {
      if (!selectedRoom) throw new Error('No public room selected');
      return museumService.getRoom(selectedRoom, signal);
    },
    enabled: !!selectedRoom,
    select: localizeDetail,
    retry: false,
  });
  return {
    rooms, room, selectedRoom, selectedSlug,
    refresh: () => client.invalidateQueries({ queryKey: ['museum-tour'] }),
  };
}
