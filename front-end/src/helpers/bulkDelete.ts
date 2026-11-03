import { ApiException } from '@/core/api/api-error';

/** Thao tác hàng loạt trên bản ghi xóa mềm (back-end xử lý tất cả hoặc không). */
export type BulkAction = 'delete' | 'restore';

const BLOCKED_CODE: Record<BulkAction, string> = { delete: 'delete_blocked', restore: 'restore_blocked' };

/**
 * Lỗi 409 của xóa/khôi phục hàng loạt liệt kê `errors[].field` = ID + lý do. Trả các dòng "tên — lý do" để
 * hiển thị; null nếu không phải lỗi dạng này (để dùng thông báo chung).
 */
export function bulkDeleteFailures(
  error: unknown,
  nameOf: (id: string) => string | undefined,
  action: BulkAction = 'delete',
): string[] | null {
  if (!(error instanceof ApiException) || error.status !== 409) return null;
  const items = error.errors.filter((item) => item.code === BLOCKED_CODE[action] && item.field);
  if (items.length === 0) return null;
  return items.map((item) => `${nameOf(item.field!) ?? item.field} — ${item.message}`);
}

/** Ngày giờ xóa hiển thị trong thùng rác (giờ Việt Nam). */
export function formatDeletedAt(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
}
