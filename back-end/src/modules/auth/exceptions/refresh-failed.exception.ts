import { UnauthorizedException } from '@nestjs/common';

/**
 * Lý do refresh thất bại — chỉ dùng cho audit, client luôn nhận thông điệp chung.
 * `reuse`: token đã xoay vòng bị gửi lại (dấu hiệu bị đánh cắp) → cả family bị thu hồi.
 * `revoked`: token đã bị thu hồi (đăng xuất, đăng xuất từ xa) — bình thường, không phải tấn công.
 * `rotated_recently`: token vừa xoay vòng bị gửi lại trong ân hạn (tab khác, mất phản hồi) — giữ phiên.
 */
export type RefreshFailureReason =
  | 'unknown_token' | 'reuse' | 'rotated_recently' | 'revoked' | 'expired' | 'inactive_user';

/** 401 refresh thất bại kèm chủ phiên + family cho audit; phản hồi HTTP giống UnauthorizedException. */
export class RefreshFailedException extends UnauthorizedException {
  constructor(
    readonly reason: RefreshFailureReason,
    readonly userId: string | null = null,
    readonly familyId: string | null = null,
  ) {
    super('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
  }
}
