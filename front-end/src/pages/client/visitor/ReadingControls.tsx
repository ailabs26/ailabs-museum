import { Button, Group, Paper, Text } from '@mantine/core';
import { DEFAULT_READING, readingStore } from '@/helpers/visitorState';
import { useVisitorStore } from '@/hooks/useVisitorStore';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { VisitorStorageStatus } from './VisitorStorageStatus';

export function ReadingControls() {
  const { t } = usePublicLocale();
  const { value, error } = useVisitorStore(readingStore);
  const changeScale = (step: number) => readingStore.update(current => ({
    ...current, fontScale: Math.max(1, Math.min(1.5, Math.round((current.fontScale + step) * 10) / 10)),
  }));
  return <Paper component="section" aria-label={t('ui.visitor.reading.section', 'Tùy chọn đọc hiện vật')} p="md" radius="md" withBorder mb="lg">
    <Group>
      <Button variant={value.enabled ? 'light' : 'default'} aria-pressed={value.enabled}
        onClick={() => readingStore.update(current => ({ ...current, enabled: !current.enabled }))}>
        {t('ui.visitor.reading.toggle', 'Chế độ đọc')}
      </Button>
      {value.enabled && <>
        <Button variant="default" aria-label={t('ui.visitor.reading.decrease', 'Giảm cỡ chữ')} disabled={value.fontScale <= 1} onClick={() => changeScale(-0.1)}>A−</Button>
        <Text role="status" aria-label={t('ui.visitor.reading.size.aria', 'Cỡ chữ đọc')}>
          {t('ui.visitor.reading.size', 'Cỡ chữ {percent}%').replace('{percent}', String(Math.round(value.fontScale * 100)))}
        </Text>
        <Button variant="default" aria-label={t('ui.visitor.reading.increase', 'Tăng cỡ chữ')} disabled={value.fontScale >= 1.5} onClick={() => changeScale(0.1)}>A+</Button>
      </>}
      <Button variant="subtle" onClick={() => readingStore.update(() => DEFAULT_READING)}>
        {t('ui.visitor.reading.reset', 'Đặt lại chế độ đọc')}
      </Button>
    </Group>
    <VisitorStorageStatus error={error} />
  </Paper>;
}
