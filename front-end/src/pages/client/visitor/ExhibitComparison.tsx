import { Button, Group, Modal, Paper, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import type { VisitorExhibitRef } from '@/helpers/visitorState';
import { exhibitRefKey } from '@/helpers/visitorState';
import { collectMediaCredits } from '@/helpers/mediaCredits';
import { useResolvedVisitorExhibits } from '@/hooks/useResolvedVisitorExhibits';
import type { RoomSummary } from '@/validations/roomSchema';
import { ExhibitImage } from '@/shared/components/media/ExhibitImage';
import { MediaCreditList } from '@/components/museum/MediaCreditList';
import classes from './ExhibitComparison.module.css';

export function ExhibitComparison({ selection, rooms, message, onRemove, onClear }: {
  selection: readonly VisitorExhibitRef[]; rooms: readonly RoomSummary[]; message: string;
  onRemove: (target: VisitorExhibitRef) => void; onClear: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { entries, isLoading, hasError } = useResolvedVisitorExhibits(selection, rooms);
  const available = entries.flatMap(entry => entry ? [entry] : []);
  return <Paper component="section" aria-labelledby="comparison-tray-title" withBorder radius="md" p="md" my="lg">
    <Title order={2} size="h3" id="comparison-tray-title">Lựa chọn so sánh</Title>
    <Text size="sm" c="dimmed" my="xs">Chọn 2–3 hiện vật, có thể từ các phòng khác nhau.</Text>
    <Text role="status" aria-label="Trạng thái so sánh" size="sm">{message}</Text>
    <Stack gap="xs" my="sm">
      {selection.map((ref, index) => {
        const name = entries[index]?.exhibit.name ?? (isLoading ? 'Đang xác minh hiện vật' : 'Hiện vật không khả dụng');
        return <Group key={exhibitRefKey(ref)} justify="space-between" wrap="wrap">
          <Text className={classes.name}>{name}</Text>
          <Button variant="subtle" aria-label={`Bỏ so sánh ${name}`} onClick={() => onRemove(ref)}>Bỏ</Button>
        </Group>;
      })}
    </Stack>
    {hasError && <Text c="dimmed">Không tải được một số nội dung. Dùng Làm mới để thử lại.</Text>}
    <Group>
      <Button disabled={isLoading || available.length < 2} onClick={() => setIsOpen(true)}>Mở so sánh ({selection.length})</Button>
      <Button variant="default" disabled={selection.length === 0} onClick={onClear}>Xóa lựa chọn so sánh</Button>
    </Group>
    <Modal opened={isOpen} onClose={() => setIsOpen(false)} title="So sánh hiện vật" size="min(70rem, 100%)"
      closeButtonProps={{ 'aria-label': 'Đóng so sánh' }}>
      {isLoading ? <Text role="status">Đang kiểm tra nội dung so sánh…</Text>
        : available.length < 2 ? <Text role="status">Không còn đủ 2 hiện vật công khai để so sánh.</Text>
          : <div className={classes.scroll} role="region" aria-label="Nội dung so sánh, cuộn ngang trên màn hình nhỏ" tabIndex={0}>
            <div className={classes.columns} style={{ gridTemplateColumns: `repeat(${available.length}, minmax(15rem, 1fr))` }}>
              {available.map(({ room, exhibit }) => <article className={classes.column} key={exhibitRefKey({ roomId: room.id, exhibitId: exhibit.id })}>
                <Title order={3} className={classes.name}>{exhibit.name}</Title>
                <Text size="sm" c="dimmed" my="sm">{room.name}</Text>
                <ExhibitImage image={exhibit.image ? { url: exhibit.image.url, alt: exhibit.image.altText.vi || exhibit.name } : null}
                  shape={exhibit.placeholderShape} color={exhibit.placeholderColor} className={classes.preview} />
                <Title order={4} mt="md" size="h5">Mô tả</Title>
                <Text className={classes.description}>{exhibit.description || 'Chưa có mô tả.'}</Text>
                <MediaCreditList credits={collectMediaCredits(exhibit)} className={classes.description} />
              </article>)}
            </div>
          </div>}
    </Modal>
  </Paper>;
}
