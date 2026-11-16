import { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { selectHomeHeroSlides } from '@/helpers/homeHeroSlides';
import { museumService } from '@/services/museum.service';
import type { useMuseumRooms } from './useMuseumRooms';

type MuseumRooms = ReturnType<typeof useMuseumRooms>;
type Progress = { key: string; offset: number; done: boolean };

export function useHomeHeroSlides({ rooms, room, selectedRoom }: Pick<MuseumRooms, 'rooms' | 'room' | 'selectedRoom'>) {
  const { locale } = usePublicLocale();
  const roomList = rooms.data ?? [];
  const extraRooms = selectedRoom ? roomList.filter((item) => item.id !== selectedRoom.id).slice(0, 4) : [];
  const primarySlides = room.isSuccess && selectedRoom ? selectHomeHeroSlides([room.data], locale) : [];
  const sourceKey = `${selectedRoom?.id ?? ''}:${extraRooms.map((item) => item.id).join(',')}`;
  const [progress, setProgress] = useState<Progress>({ key: '', offset: 0, done: false });
  const currentProgress = progress.key === sourceKey ? progress : { key: sourceKey, offset: 0, done: false };
  const offset = currentProgress.offset;
  const batch = extraRooms.slice(offset, offset + 2);
  const shouldFetch = rooms.isSuccess && room.isSuccess && primarySlides.length < 3 && !currentProgress.done && batch.length > 0;
  const queries = useQueries({
    queries: extraRooms.map((summary, index) => ({
      queryKey: ['museum-tour', 'room', summary.id, summary.slug],
      meta: { public: true },
      queryFn: ({ signal }: { signal: AbortSignal }) => museumService.getRoom(summary, signal),
      enabled: shouldFetch && index >= offset && index < offset + 2,
      retry: false,
    })),
  });
  const allSlides = selectHomeHeroSlides([
    ...(room.isSuccess && selectedRoom ? [room.data] : []),
    ...queries.flatMap((query) => query.isSuccess ? [query.data] : []),
  ], locale);
  const batchQueries = queries.slice(offset, offset + batch.length);
  const batchState = batchQueries.map((query) => `${query.status}:${query.data?.id ?? ''}`).join('|');

  useEffect(() => {
    if (!shouldFetch || batch.length === 0 || !batchQueries.every((query) => query.fetchStatus === 'idle' && (query.isSuccess || query.isError))) return;
    setProgress((current) => {
      const currentOffset = current.key === sourceKey ? current.offset : 0;
      if (currentOffset !== offset || (current.key === sourceKey && current.done)) return current;
      return { key: sourceKey, offset: offset + batch.length, done: allSlides.length >= 3 };
    });
  }, [allSlides.length, batch.length, batchState, batchQueries, offset, shouldFetch, sourceKey]);

  return allSlides;
}
