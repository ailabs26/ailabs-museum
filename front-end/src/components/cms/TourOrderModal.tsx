import { useEffect, useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Center, Group, Loader, Modal, Paper, Select, Stack, Text } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconGripVertical, IconInfoCircle } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveBilingualText } from '@/helpers/exhibitHotspots';
import { isOrderChanged, moveItem, sortForTour } from '@/helpers/tourOrder';
import type { ExhibitRow } from '@/services/exhibits.service';
import { exhibitsService } from '@/services/exhibits.service';
import { notify } from '@/shared/components/feedback';

/** Giới hạn `pageSize` của API danh sách hiện vật. */
const MAX_ROOM_EXHIBITS = 100;

export interface TourOrderModalProps {
  opened: boolean;
  onClose: () => void;
  rooms: { value: string; label: string }[];
  /** Phòng chọn sẵn khi mở (vd phòng đang lọc trên danh sách). */
  initialRoomId?: string | null;
}

function exhibitName(row: ExhibitRow): string {
  const name = resolveBilingualText(row.content.name);
  return name.vi || name.en || row.id.slice(0, 8);
}

/**
 * Xem và đổi thứ tự hiện vật của một phòng — cũng là trình tự guided tour (FR-76, FR-77, FR-79).
 * Kéo-thả hoặc dùng nút lên/xuống (bàn phím); lưu gửi đủ id của phòng theo thứ tự mới.
 */
export function TourOrderModal({ opened, onClose, rooms, initialRoomId }: TourOrderModalProps) {
  const queryClient = useQueryClient();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [order, setOrder] = useState<ExhibitRow[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Chỉ chọn phòng lúc mở modal: `rooms` là mảng mới mỗi lần trang cha render.
  useEffect(() => {
    if (opened) setRoomId(initialRoomId ?? rooms[0]?.value ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const exhibitsQuery = useQuery({
    queryKey: ['admin-exhibits', 'tour-order', roomId],
    queryFn: () => exhibitsService.list({ roomId: roomId as string, page: 1, pageSize: MAX_ROOM_EXHIBITS }),
    enabled: opened && !!roomId,
  });
  const original = exhibitsQuery.data ? sortForTour(exhibitsQuery.data.items) : [];
  const tooMany = (exhibitsQuery.data?.total ?? 0) > MAX_ROOM_EXHIBITS;

  // Nạp lại thứ tự khi đổi phòng hoặc dữ liệu mới về (sau khi lưu).
  useEffect(() => {
    setOrder(exhibitsQuery.data ? sortForTour(exhibitsQuery.data.items) : []);
  }, [exhibitsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => exhibitsService.reorder(roomId as string, order.map((row) => row.id)),
    onSuccess: async () => {
      notify.success('Đã lưu thứ tự tour của phòng');
      await queryClient.invalidateQueries({ queryKey: ['admin-exhibits'] });
      void queryClient.invalidateQueries({ queryKey: ['public-room'] });
    },
    onError: (err) => notify.error(err instanceof Error ? err.message : 'Lưu thứ tự thất bại'),
  });

  const move = (from: number, to: number) => setOrder((current) => moveItem(current, from, to));
  const publishedCount = order.filter((row) => row.status === 'published').length;
  const changed = isOrderChanged(original, order);

  return (
    <Modal opened={opened} onClose={onClose} title="Thứ tự hiện vật & guided tour" size="lg">
      <Stack gap="sm">
        <Select
          label="Phòng trưng bày"
          data={rooms}
          value={roomId}
          onChange={setRoomId}
          allowDeselect={false}
          disabled={saveMutation.isPending}
        />
        <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
          <Text size="sm">
            Tour đi qua hiện vật theo thứ tự này. Chỉ hiện vật <strong>đã xuất bản</strong> có mặt trong tour công khai
            ({publishedCount}/{order.length}); bản nháp giữ chỗ trong thứ tự để khi xuất bản sẽ vào đúng vị trí.
          </Text>
        </Alert>

        {exhibitsQuery.isLoading && (
          <Center py="md">
            <Loader size="sm" />
          </Center>
        )}
        {tooMany && (
          <Alert color="red">Phòng có hơn {MAX_ROOM_EXHIBITS} hiện vật — chưa hỗ trợ sắp xếp trên giao diện.</Alert>
        )}
        {!exhibitsQuery.isLoading && order.length === 0 && (
          <Text size="sm" c="dimmed" ta="center">
            Phòng chưa có hiện vật.
          </Text>
        )}

        <Stack gap={6} role="list" aria-label="Thứ tự hiện vật">
          {order.map((row, index) => (
            <Paper
              key={row.id}
              role="listitem"
              withBorder
              p="xs"
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              style={{ cursor: 'grab', opacity: dragIndex === index ? 0.5 : 1 }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <IconGripVertical size={16} color="var(--mantine-color-gray-6)" aria-hidden />
                  <Text size="sm" fw={600} w={28}>
                    {index + 1}.
                  </Text>
                  <Text size="sm" lineClamp={1}>
                    {exhibitName(row)}
                  </Text>
                  <Badge size="xs" variant="light" color={row.status === 'published' ? 'teal' : 'gray'}>
                    {row.status === 'published' ? 'Trong tour' : 'Bản nháp'}
                  </Badge>
                </Group>
                <Group gap={2} wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={`Đưa "${exhibitName(row)}" lên trên`}
                  >
                    <IconArrowUp size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    disabled={index === order.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={`Đưa "${exhibitName(row)}" xuống dưới`}
                  >
                    <IconArrowDown size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={() => setOrder(original)} disabled={!changed || saveMutation.isPending}>
            Hoàn tác
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!changed || tooMany} loading={saveMutation.isPending}>
            Lưu thứ tự
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
