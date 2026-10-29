import { UnauthorizedException } from '@nestjs/common';

/** Lý do đăng nhập thất bại — chỉ dùng cho audit, client luôn nhận thông điệp chung. */
export type LoginFailureReason = 'unknown_account' | 'invalid_password' | 'account_disabled' | 'credentials_changed';

/**
 * 401 đăng nhập thất bại kèm thông tin cho audit (tài khoản đích nếu email tồn tại, lý do).
 * Phản hồi HTTP giữ nguyên như UnauthorizedException: không tiết lộ email có tồn tại hay không.
 */
export class LoginFailedException extends UnauthorizedException {
  constructor(
    readonly reason: LoginFailureReason,
    readonly userId: string | null,
    message = 'Email hoặc mật khẩu không đúng',
  ) {
    super(message);
  }
}
