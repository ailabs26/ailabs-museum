import { useState, type FormEvent } from 'react';
import { Alert, Button, Group, Modal, NativeSelect, Stack, Textarea } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { notify } from './notify';
import { PUBLIC_REPORT_CATEGORIES, reportsService, type CreatePublicReportInput } from '@/services/reports.service';

interface PublicReportModalProps extends Pick<CreatePublicReportInput, 'exhibitId' | 'reportedRevisionId'> {
  opened: boolean;
  onClose: () => void;
  portalTarget?: HTMLElement;
  translate?: (key: string, fallback: string) => string;
}

const validationMessages = {
  'message-required': 'Vui lòng nhập nội dung báo cáo.',
  'message-too-long': 'Nội dung báo cáo không được vượt quá 2000 ký tự.',
  'category-required': 'Vui lòng chọn danh mục báo cáo.',
};

export function PublicReportModal({ exhibitId, reportedRevisionId, opened, onClose, portalTarget, translate }: PublicReportModalProps) {
  const t = (key: string, fallback: string) => translate?.(key, fallback) ?? fallback;
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState<keyof typeof validationMessages | null>(null);
  const mutation = useMutation({
    mutationFn: reportsService.createPublic,
    onSuccess: () => {
      notify.success(t('ui.report.success', 'Đã gửi báo cáo nội dung'));
      onClose();
    },
  });
  const error = validationError
    ? t(`ui.report.validation.${validationError}`, validationMessages[validationError])
    : mutation.error instanceof Error ? mutation.error.message : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setValidationError('message-required');
      return;
    }
    if (trimmedMessage.length > 2000) {
      setValidationError('message-too-long');
      return;
    }
    const selectedCategory = PUBLIC_REPORT_CATEGORIES.find((item) => item.value === category);
    if (!selectedCategory) {
      setValidationError('category-required');
      return;
    }
    setValidationError(null);
    mutation.mutate({
      exhibitId,
      reportedRevisionId,
      category: selectedCategory.value,
      message: trimmedMessage,
    });
  };

  const handleClose = () => {
    if (!mutation.isPending) onClose();
  };

  return (
    <Modal title={t('ui.report.title', 'Báo cáo nội dung')} closeButtonProps={{ 'aria-label': t('ui.report.close', 'Đóng biểu mẫu báo cáo') }} opened={opened} onClose={handleClose}
      portalProps={portalTarget ? { target: portalTarget } : undefined}
      closeOnClickOutside={!mutation.isPending} closeOnEscape={!mutation.isPending}>
      <form onSubmit={handleSubmit}>
        <Stack>
          <NativeSelect label={t('ui.report.category', 'Danh mục')} required value={category} disabled={mutation.isPending}
            onChange={(event) => { setCategory(event.currentTarget.value); mutation.reset(); setValidationError(null); }}
            data={[{ value: '', label: t('ui.report.category.placeholder', 'Chọn danh mục') }, ...PUBLIC_REPORT_CATEGORIES.map(item => ({
              ...item,
              label: t(`ui.report.category.${item.value}`, item.label),
            }))]} />
          <Textarea label={t('ui.report.message', 'Nội dung bổ sung')} required maxLength={2000} minRows={4} value={message}
            disabled={mutation.isPending}
            onChange={(event) => { setMessage(event.currentTarget.value); mutation.reset(); setValidationError(null); }} />
          {error && <Alert color="red" role="alert">{error}</Alert>}
          <Group justify="flex-end">
            <Button type="button" variant="default" disabled={mutation.isPending} onClick={handleClose}>{t('ui.report.cancel', 'Hủy')}</Button>
            <Button type="submit" loading={mutation.isPending}>{t('ui.report.submit', 'Gửi báo cáo')}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
