import { ApiException } from './api-error';
import { cmsErrorMessage } from './cms-error-message';
import { notify } from '@/shared/components/feedback';

export { cmsErrorMessage };

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
