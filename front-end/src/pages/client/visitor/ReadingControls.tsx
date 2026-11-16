import { Button, Group, Paper, Text } from '@mantine/core';
import { DEFAULT_READING, readingStore } from '@/helpers/visitorState';
import { useVisitorStore } from '@/hooks/useVisitorStore';
import { VisitorStorageStatus } from './VisitorStorageStatus';
import { usePublicLocale } from '@/core/i18n/public-locale';

export function ReadingControls() {
  const { value, error } = useVisitorStore(readingStore);
  const { t } = usePublicLocale();
  const changeScale = (step: number) => readingStore.update(current => ({
    ...current, fontScale: Math.max(1, Math.min(1.5, Math.round((current.fontScale + step) * 10) / 10)),
  }));
  return <Paper component="section" aria-label={t('ui.reading.aria', 'Tùy chọn đọc hiện vật')} p="md" radius="md" withBorder mb="lg">
    <Group>
      <Button variant={value.enabled ? 'light' : 'default'} aria-pressed={value.enabled}
        onClick={() => readingStore.update(current => ({ ...current, enabled: !current.enabled }))}>{t('ui.reading.mode', 'Chế độ đọc')}</Button>
      {value.enabled && <>
        <Button variant="default" aria-label={t('ui.reading.smaller', 'Giảm cỡ chữ')} disabled={value.fontScale <= 1} onClick={() => changeScale(-0.1)}>A−</Button>
        <Text role="status" aria-label={t('ui.reading.size-aria', 'Cỡ chữ đọc')}>{t('ui.reading.size', 'Cỡ chữ {percent}%', { percent: Math.round(value.fontScale * 100) })}</Text>
        <Button variant="default" aria-label={t('ui.reading.larger', 'Tăng cỡ chữ')} disabled={value.fontScale >= 1.5} onClick={() => changeScale(0.1)}>A+</Button>
      </>}
      <Button variant="subtle" onClick={() => readingStore.update(() => DEFAULT_READING)}>{t('ui.reading.reset', 'Đặt lại chế độ đọc')}</Button>
    </Group>
    <VisitorStorageStatus error={error} />
  </Paper>;
}
