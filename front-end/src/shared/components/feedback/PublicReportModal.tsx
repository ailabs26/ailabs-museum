import { useState, type FormEvent } from 'react';
import { Alert, Button, Group, Modal, NativeSelect, Stack, Textarea } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { notify } from './notify';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { PUBLIC_REPORT_CATEGORIES, reportsService, type CreatePublicReportInput } from '@/services/reports.service';

interface PublicReportModalProps extends Pick<CreatePublicReportInput, 'exhibitId' | 'reportedRevisionId'> {
  opened: boolean;
  onClose: () => void;
  portalTarget?: HTMLElement;
}

export function PublicReportModal({ exhibitId, reportedRevisionId, opened, onClose, portalTarget }: PublicReportModalProps) {
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const { locale, t } = usePublicLocale();
  const [validationError, setValidationError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: reportsService.createPublic,
    onSuccess: () => {
      notify.success(t('ui.report.sent', 'Đã gửi báo cáo nội dung'));
      onClose();
    },
  });
  const error = validationError ?? (mutation.error instanceof Error
    ? (locale === 'vi' ? mutation.error.message : t('ui.report.send-failed', 'Không gửi được báo cáo. Vui lòng thử lại.'))
    : null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setValidationError(t('ui.report.message-required', 'Vui lòng nhập nội dung báo cáo.'));
      return;
    }
    if (trimmedMessage.length > 2000) {
      setValidationError(t('ui.report.message-too-long', 'Nội dung báo cáo không được vượt quá 2000 ký tự.'));
      return;
    }
    const selectedCategory = PUBLIC_REPORT_CATEGORIES.find((item) => item.value === category);
    if (!selectedCategory) {
      setValidationError(t('ui.report.category-required', 'Vui lòng chọn danh mục báo cáo.'));
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
    <Modal title={t('ui.report.title', 'Báo cáo nội dung')} opened={opened} onClose={handleClose}
      portalProps={portalTarget ? { target: portalTarget } : undefined}
      closeOnClickOutside={!mutation.isPending} closeOnEscape={!mutation.isPending}>
      <form onSubmit={handleSubmit}>
        <Stack>
          <NativeSelect label={t('ui.report.category', 'Danh mục')} required value={category} disabled={mutation.isPending}
            onChange={(event) => { setCategory(event.currentTarget.value); mutation.reset(); setValidationError(null); }}
            data={[{ value: '', label: t('ui.report.choose-category', 'Chọn danh mục') },
              ...PUBLIC_REPORT_CATEGORIES.map(({ value, key, label }) => ({ value, label: t(key, label) }))]} />
          <Textarea label={t('ui.report.details', 'Nội dung bổ sung')} required maxLength={2000} minRows={4} value={message}
            disabled={mutation.isPending}
            onChange={(event) => { setMessage(event.currentTarget.value); mutation.reset(); setValidationError(null); }} />
          {error && <Alert color="red" role="alert">{error}</Alert>}
          <Group justify="flex-end">
            <Button type="button" variant="default" disabled={mutation.isPending} onClick={handleClose}>{t('ui.common.cancel', 'Hủy')}</Button>
            <Button type="submit" loading={mutation.isPending}>{t('ui.report.send', 'Gửi báo cáo')}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
