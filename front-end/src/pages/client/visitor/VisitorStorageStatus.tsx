import { Alert } from '@mantine/core';
import type { VisitorStorageError } from '@/helpers/visitorPersistence';
import { usePublicLocale } from '@/core/i18n/public-locale';

export function VisitorStorageStatus({ error }: { error: VisitorStorageError }) {
  const { t } = usePublicLocale();
  if (!error) return null;
  return <Alert color="yellow" role="status" mt="sm">
    {error === 'unavailable' ? t('ui.visitor.storage.unavailable', 'Không thể lưu trên trình duyệt. Thay đổi chỉ giữ trong trang đang mở và có thể mất khi tải lại.')
      : error === 'limit' ? t('ui.visitor.storage.limit', 'Đã đạt giới hạn lưu trữ. Hãy xóa bớt mục trước khi thêm.')
        : t('ui.visitor.storage.invalid', 'Dữ liệu đã lưu không hợp lệ hoặc thuộc phiên bản khác. Đang dùng giá trị mặc định.')}
  </Alert>;
}
