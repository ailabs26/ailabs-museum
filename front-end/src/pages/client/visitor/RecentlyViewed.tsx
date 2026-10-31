import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { recentStore, exhibitRefKey } from '@/helpers/visitorState';
import { useVisitorStore } from '@/hooks/useVisitorStore';
import { useResolvedVisitorExhibits } from '@/hooks/useResolvedVisitorExhibits';
import type { RoomSummary } from '@/validations/roomSchema';
import { VisitorStorageStatus } from './VisitorStorageStatus';

export function RecentlyViewed({ rooms, isRoomsReady }: { rooms: readonly RoomSummary[]; isRoomsReady: boolean }) {
  const recent = useVisitorStore(recentStore);
  const { entries, isLoading, hasError } = useResolvedVisitorExhibits(recent.value, isRoomsReady ? rooms : []);
  const available = entries.flatMap(entry => entry ? [entry] : []);
  return <Paper component="section" aria-labelledby="recent-title" withBorder radius="md" p="md" mt="xl">
    <Group justify="space-between" mb="sm">
      <Title order={2} id="recent-title" size="h3">Đã xem gần đây</Title>
      <Button variant="default" onClick={() => recentStore.update(() => [])} disabled={recent.value.length === 0}>Xóa lịch sử</Button>
    </Group>
    <VisitorStorageStatus error={recent.error} />
    {recent.value.length === 0 ? <Text c="dimmed">Chưa có hiện vật đã xem.</Text>
      : !isRoomsReady ? <Text c="dimmed">Chưa xác minh được danh sách công khai.</Text>
        : isLoading ? <Text role="status">Đang kiểm tra hiện vật gần đây…</Text>
          : <Stack gap="sm">
            {available.map(({ room, exhibit }) => <Link key={exhibitRefKey({ roomId: room.id, exhibitId: exhibit.id })}
              to={`/collection/${encodeURIComponent(room.slug)}/exhibits/${encodeURIComponent(exhibit.id)}`}>
              Tiếp tục khám phá: {exhibit.name} — {room.name}
            </Link>)}
            {available.length < recent.value.length && <Text c="dimmed">Một số hiện vật không còn khả dụng hoặc chưa xác minh được.</Text>}
            {hasError && <Text c="dimmed">Hãy dùng Làm mới để thử tải lại nội dung công khai.</Text>}
          </Stack>}
  </Paper>;
}
