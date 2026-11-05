import { Button, Group, Paper, Text, Textarea } from '@mantine/core';
import { useRef } from 'react';
import { isSameExhibit, notesStore } from '@/helpers/visitorState';
import type { VisitorExhibitRef } from '@/helpers/visitorState';
import { useVisitorStore } from '@/hooks/useVisitorStore';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { VisitorStorageStatus } from './VisitorStorageStatus';

export function VisitorNotes({ target }: { target: VisitorExhibitRef }) {
  const { t } = usePublicLocale();
  const { value, error } = useVisitorStore(notesStore);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const entry = value.find(item => isSameExhibit(item, target));
  const text = entry?.text ?? '';
  const isFull = !entry && value.length >= 100;
  const save = (nextText: string) => notesStore.update(entries => {
    const others = entries.filter(item => !isSameExhibit(item, target));
    return nextText ? [...others, { ...target, text: nextText }] : others;
  });
  return <Paper component="section" aria-label={t('ui.visitor.notes.section', 'Ghi chú riêng')} withBorder radius="md" p="md" mt="xl">
    <Textarea ref={inputRef} label={t('ui.visitor.notes.label', 'Ghi chú của bạn')}
      description={t('ui.visitor.notes.description', 'Ghi chú chỉ được lưu trên trình duyệt này')}
      value={text} maxLength={2000} autosize minRows={3} maxRows={8} disabled={isFull}
      onChange={event => save(event.currentTarget.value)} />
    <Text size="sm" c="dimmed" mt="xs">{t('ui.visitor.notes.count', '{count}/2000 ký tự · Tự động lưu khi nhập.')
      .replace('{count}', String(text.length))}</Text>
    {isFull && <Text role="status">{t('ui.visitor.notes.full', 'Đã đủ 100 ghi chú. Hãy xóa một ghi chú ở hiện vật khác trước khi tạo mới.')}</Text>}
    <VisitorStorageStatus error={error} />
    <Text role="status" aria-label={t('ui.visitor.notes.status.aria', 'Trạng thái ghi chú')} size="sm" my="sm">
      {!error && text ? t('ui.visitor.notes.saved', 'Đã lưu ghi chú trên trình duyệt.')
        : !error ? t('ui.visitor.notes.empty', 'Chưa có ghi chú.')
          : t('ui.visitor.notes.unsaved', 'Ghi chú chưa được lưu trên trình duyệt.')}
    </Text>
    <Group>
      <Button variant="default" disabled={!text} onClick={() => { save(''); inputRef.current?.focus(); }}>
        {t('ui.visitor.notes.clear', 'Xóa ghi chú')}
      </Button>
      {error === 'unavailable' && <Button variant="light" onClick={() => notesStore.update(entries => entries)}>
        {t('ui.visitor.notes.retry', 'Thử lưu lại ghi chú')}
      </Button>}
    </Group>
  </Paper>;
}
