import { ApiException } from './api-error';
import { notify } from '@/shared/components/feedback';

/**
 * Ánh xạ mã HTTP → thông điệp tiếng Việt thân thiện cho các thao tác CMS.
 * Hàm thuần (không phụ thuộc UI) để dễ kiểm thử.
 */
export function cmsErrorMessage(status: number, fallback?: string): string {
  switch (status) {
    case 409:
      return fallback || 'Nội dung đã bị thay đổi bởi người khác, vui lòng tải lại trang';
    case 403:
      return 'Bạn không đủ quyền thực hiện thao tác này';
    case 400:
    case 422:
      return fallback || 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại';
    case 0:
      return 'Mất kết nối máy chủ, vui lòng thử lại';
    default:
      return fallback || 'Có lỗi xảy ra, vui lòng thử lại';
  }
}

export interface HandleCmsErrorOptions {
  /** Gọi khi gặp 409 (sửa đồng thời) — thường để refetch + đóng panel. */
  onConflict?: () => void;
}

/**
 * Xử lý lỗi thống nhất cho mutation CMS: hiện thông báo tiếng Việt theo mã lỗi,
 * và kích hoạt onConflict khi 409.
 */
export function handleCmsError(err: unknown, opts?: HandleCmsErrorOptions): void {
  if (err instanceof ApiException) {
    notify.error(cmsErrorMessage(err.status, err.message));
    if (err.status === 409) opts?.onConflict?.();
    return;
  }
  notify.error('Có lỗi xảy ra, vui lòng thử lại');
}
