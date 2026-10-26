import { ApiException } from '@/core/api/api-error';

/**
 * Lỗi 409 của xóa hàng loạt liệt kê `errors[].field` = ID + lý do. Trả các dòng "tên — lý do" để hiển thị;
 * null nếu không phải lỗi dạng này (để dùng thông báo chung).
 */
export function bulkDeleteFailures(error: unknown, nameOf: (id: string) => string | undefined): string[] | null {
  if (!(error instanceof ApiException) || error.status !== 409) return null;
  const items = error.errors.filter((item) => item.code === 'delete_blocked' && item.field);
  if (items.length === 0) return null;
  return items.map((item) => `${nameOf(item.field!) ?? item.field} — ${item.message}`);
}
