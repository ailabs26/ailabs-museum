import { ConflictException, NotFoundException } from '@nestjs/common';

/** Một mục không xóa/khôi phục được và lý do; `notFound` để xóa lẻ trả 404 thay vì 409. */
export interface BlockedDeletion {
  id: string;
  reason: string;
  notFound?: boolean;
}

/** Thao tác hàng loạt trên bản ghi xóa mềm. */
export type SoftDeleteAction = 'delete' | 'restore';

const ACTION_TEXT: Record<SoftDeleteAction, { failed: string; none: string; code: string }> = {
  delete: { failed: 'Không xóa được', none: 'Không mục nào bị xóa.', code: 'delete_blocked' },
  restore: { failed: 'Không khôi phục được', none: 'Không mục nào được khôi phục.', code: 'restore_blocked' },
};

/**
 * Dùng chung cho xóa/khôi phục lẻ và hàng loạt (tất cả hoặc không): không có mục bị chặn thì thôi.
 * - Lẻ: giữ hành vi cũ — 404 nếu không tồn tại, 409 kèm lý do nếu bị chặn.
 * - Hàng loạt: 409, `errors[].field` = ID để giao diện chỉ ra từng dòng bị chặn.
 */
export function assertNothingBlocked(
  blocked: BlockedDeletion[],
  single: boolean,
  action: SoftDeleteAction = 'delete',
): void {
  if (blocked.length === 0) return;
  if (single) {
    const [first] = blocked;
    throw first.notFound ? new NotFoundException(first.reason) : new ConflictException(first.reason);
  }
  const text = ACTION_TEXT[action];
  throw new ConflictException({
    message: `${text.failed} ${blocked.length} mục đã chọn. ${text.none}`,
    errors: blocked.map(({ id, reason }) => ({ code: text.code, field: id, message: reason })),
  });
}
