import { useQuery, useQueryClient } from '@tanstack/react-query';
import { museumService } from '@/services/museum.service';

export function useMuseumRooms(requestedSlug: string | null) {
  const client = useQueryClient();
  const rooms = useQuery({
    queryKey: ['museum-tour', 'rooms'],
    queryFn: ({ signal }) => museumService.listRooms(signal),
    retry: false,
  });
  const selectedSlug = requestedSlug ?? rooms.data?.[0]?.slug;
  const selectedRoom = rooms.isSuccess ? rooms.data.find((room) => room.slug === selectedSlug) : undefined;
  const room = useQuery({
    queryKey: ['museum-tour', 'room', selectedRoom?.id, selectedRoom?.slug],
    queryFn: ({ signal }) => {
      if (!selectedRoom) throw new Error('No public room selected');
      return museumService.getRoom(selectedRoom, signal);
    },
    enabled: !!selectedRoom,
    retry: false,
  });
  return {
    rooms, room, selectedRoom, selectedSlug,
    refresh: () => client.invalidateQueries({ queryKey: ['museum-tour'] }),
  };
}
