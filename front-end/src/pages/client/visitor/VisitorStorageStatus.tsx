import { Alert } from '@mantine/core';
import { usePublicT } from '@/core/i18n/public-locale';
import type { VisitorStorageError } from '@/helpers/visitorPersistence';

export function VisitorStorageStatus({ error }: { error: VisitorStorageError }) {
  const t = usePublicT();
  if (!error) return null;
  return <Alert color="yellow" role="status" mt="sm">
    {error === 'unavailable' ? t('ui.storage.unavailable', 'Không thể lưu trên trình duyệt. Thay đổi chỉ giữ trong trang đang mở và có thể mất khi tải lại.')
      : error === 'limit' ? t('ui.storage.limit', 'Đã đạt giới hạn lưu trữ. Hãy xóa bớt mục trước khi thêm.')
        : t('ui.storage.invalid', 'Dữ liệu đã lưu không hợp lệ hoặc thuộc phiên bản khác. Đang dùng giá trị mặc định.')}
  </Alert>;
}
