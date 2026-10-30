import { Alert } from '@mantine/core';
import type { VisitorStorageError } from '@/helpers/visitorPersistence';

export function VisitorStorageStatus({ error }: { error: VisitorStorageError }) {
  if (!error) return null;
  return <Alert color="yellow" role="status" mt="sm">
    {error === 'unavailable' ? 'Không thể lưu trên trình duyệt. Thay đổi chỉ giữ trong trang đang mở và có thể mất khi tải lại.'
      : error === 'limit' ? 'Đã đạt giới hạn lưu trữ. Hãy xóa bớt mục trước khi thêm.'
        : 'Dữ liệu đã lưu không hợp lệ hoặc thuộc phiên bản khác. Đang dùng giá trị mặc định.'}
  </Alert>;
}
