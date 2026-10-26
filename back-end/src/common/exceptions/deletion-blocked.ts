import { ConflictException, NotFoundException } from '@nestjs/common';

/** Một mục không xóa được và lý do; `notFound` để xóa lẻ trả 404 thay vì 409. */
export interface BlockedDeletion {
  id: string;
  reason: string;
  notFound?: boolean;
}

/**
 * Dùng chung cho xóa lẻ và xóa hàng loạt (tất cả hoặc không): không có mục bị chặn thì thôi.
 * - Xóa lẻ: giữ hành vi cũ — 404 nếu không tồn tại, 409 kèm lý do nếu bị chặn.
 * - Hàng loạt: 409, `errors[].field` = ID để giao diện chỉ ra từng dòng bị chặn.
 */
export function assertNothingBlocked(blocked: BlockedDeletion[], single: boolean): void {
  if (blocked.length === 0) return;
  if (single) {
    const [first] = blocked;
    throw first.notFound ? new NotFoundException(first.reason) : new ConflictException(first.reason);
  }
  throw new ConflictException({
    message: `Không xóa được ${blocked.length} mục đã chọn. Không mục nào bị xóa.`,
    errors: blocked.map(({ id, reason }) => ({ code: 'delete_blocked', field: id, message: reason })),
  });
}
