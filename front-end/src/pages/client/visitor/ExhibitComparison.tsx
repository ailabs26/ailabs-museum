import { Button, Group, Modal, Paper, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import type { VisitorExhibitRef } from '@/helpers/visitorState';
import { exhibitRefKey } from '@/helpers/visitorState';
import { collectMediaCredits } from '@/helpers/mediaCredits';
import { useResolvedVisitorExhibits } from '@/hooks/useResolvedVisitorExhibits';
import type { RoomSummary } from '@/validations/roomSchema';
import { ExhibitImage } from '@/shared/components/media/ExhibitImage';
import { MediaCreditList } from '@/components/museum/MediaCreditList';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { localizeExhibit } from '@/helpers/localizeExhibit';
import classes from './ExhibitComparison.module.css';

export function ExhibitComparison({ selection, rooms, message, onRemove, onClear }: {
  selection: readonly VisitorExhibitRef[]; rooms: readonly RoomSummary[]; message: string;
  onRemove: (target: VisitorExhibitRef) => void; onClear: () => void;
}) {
  const { locale, t } = usePublicLocale();
  const [isOpen, setIsOpen] = useState(false);
  const { entries, isLoading, hasError } = useResolvedVisitorExhibits(selection, rooms);
  const localizedEntries = entries.map(entry => entry && { ...entry, exhibit: localizeExhibit(entry.exhibit, locale) });
  const available = localizedEntries.flatMap(entry => entry ? [entry] : []);
  return <Paper component="section" aria-labelledby="comparison-tray-title" withBorder radius="md" p="md" my="lg">
    <Title order={2} size="h3" id="comparison-tray-title">{t('ui.visitor.compare.title', 'Lựa chọn so sánh')}</Title>
    <Text size="sm" c="dimmed" my="xs">{t('ui.visitor.compare.instructions', 'Chọn 2–3 hiện vật, có thể từ các phòng khác nhau.')}</Text>
    <Text role="status" aria-label={t('ui.visitor.compare.status', 'Trạng thái so sánh')} size="sm">{message}</Text>
    <Stack gap="xs" my="sm">
      {selection.map((ref, index) => {
        const name = localizedEntries[index]?.exhibit.name ?? (isLoading
          ? t('ui.visitor.compare.resolving', 'Đang xác minh hiện vật')
          : t('ui.visitor.compare.missing', 'Hiện vật không khả dụng'));
        return <Group key={exhibitRefKey(ref)} justify="space-between" wrap="wrap">
          <Text className={classes.name}>{name}</Text>
          <Button variant="subtle" aria-label={t('ui.visitor.compare.remove.aria', 'Bỏ so sánh {name}').replace('{name}', () => name)}
            onClick={() => onRemove(ref)}>{t('ui.visitor.compare.remove', 'Bỏ')}</Button>
        </Group>;
      })}
    </Stack>
    {hasError && <Text c="dimmed">{t('ui.visitor.compare.load-error', 'Không tải được một số nội dung. Dùng Làm mới để thử lại.')}</Text>}
    <Group>
      <Button disabled={isLoading || available.length < 2} onClick={() => setIsOpen(true)}>
        {t('ui.visitor.compare.open', 'Mở so sánh ({count})').replace('{count}', () => String(selection.length))}
      </Button>
      <Button variant="default" disabled={selection.length === 0} onClick={onClear}>
        {t('ui.visitor.compare.clear', 'Xóa lựa chọn so sánh')}
      </Button>
    </Group>
    <Modal opened={isOpen} onClose={() => setIsOpen(false)} title={t('ui.visitor.compare.modal.title', 'So sánh hiện vật')} size="min(70rem, 100%)"
      closeButtonProps={{ 'aria-label': t('ui.visitor.compare.modal.close', 'Đóng so sánh') }}>
      {isLoading ? <Text role="status">{t('ui.visitor.compare.loading', 'Đang kiểm tra nội dung so sánh…')}</Text>
        : available.length < 2 ? <Text role="status">{t('ui.visitor.compare.insufficient', 'Không còn đủ 2 hiện vật công khai để so sánh.')}</Text>
          : <div className={classes.scroll} role="region" aria-label={t('ui.visitor.compare.region', 'Nội dung so sánh, cuộn ngang trên màn hình nhỏ')} tabIndex={0}>
            <div className={classes.columns} style={{ gridTemplateColumns: `repeat(${available.length}, minmax(15rem, 1fr))` }}>
              {available.map(({ room, exhibit }) => <article className={classes.column} key={exhibitRefKey({ roomId: room.id, exhibitId: exhibit.id })}>
                <Title order={3} className={classes.name}>{exhibit.name}</Title>
                <Text size="sm" c="dimmed" my="sm">{room.name}</Text>
                <ExhibitImage image={exhibit.image ? { url: exhibit.image.url, alt: exhibit.image.altText.vi || exhibit.name } : null}
                  shape={exhibit.placeholderShape} color={exhibit.placeholderColor} className={classes.preview}
                  labels={{ preview: t('ui.collection.exhibit.preview', 'Hình minh họa thay thế'),
                    imageMissing: t('ui.collection.exhibit.image-missing', 'Chưa có ảnh') }} />
                <Title order={4} mt="md" size="h5">{t('ui.visitor.compare.description', 'Mô tả')}</Title>
                <Text className={classes.description}>{exhibit.description || t('ui.visitor.compare.no-description', 'Chưa có mô tả.')}</Text>
                <MediaCreditList credits={collectMediaCredits(exhibit)} className={classes.description} translate={t} />
              </article>)}
            </div>
          </div>}
    </Modal>
  </Paper>;
}
