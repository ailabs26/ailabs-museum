/** Người dùng đã đăng nhập (khớp AuthUser của backend). */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  /** Có trong /auth/me: đã bật xác thực 2 lớp. */
  twoFactorEnabled?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

/** Đúng mật khẩu nhưng tài khoản bật 2FA: cần bước 2 với `mfaToken` (hạn 5 phút). */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginOutcome = LoginResult | MfaChallenge;

/** Bước 2 đăng nhập: mã 6 số từ app Authenticator hoặc một mã khôi phục. */
export type TwoFactorCode = { code: string } | { recoveryCode: string };
