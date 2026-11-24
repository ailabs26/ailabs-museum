import { http } from '@/core/api/http-client';
import {
  NATIVE_CLIENT_HEADERS,
  authUserSchema,
  loginOutcomeSchema,
  loginResultSchema,
  parseAuthResponse,
  type AuthUser,
  type LoginOutcome,
  type LoginPayload,
  type LoginResult,
  type TwoFactorCode,
} from './auth-schema';

/**
 * Gọi API xác thực và kiểm tra phản hồi (MOB-E3-03).
 * Header `X-Client: mobile` chỉ gắn cho login/logout (refresh ở http-client) — request public
 * không cần header này.
 */
export const authApi = {
  async login(payload: LoginPayload): Promise<LoginOutcome> {
    const data = await http.post<unknown>('/auth/login', payload, {
      headers: NATIVE_CLIENT_HEADERS,
    });
    return parseAuthResponse(loginOutcomeSchema, data);
  },
  /** Bước 2 đăng nhập khi tài khoản bật 2FA. */
  async loginTwoFactor(mfaToken: string, code: TwoFactorCode): Promise<LoginResult> {
    const data = await http.post<unknown>(
      '/auth/login/2fa',
      { mfaToken, ...code },
      { headers: NATIVE_CLIENT_HEADERS },
    );
    return parseAuthResponse(loginResultSchema, data);
  },
  /** Thu hồi phiên trên server; có thể gọi lại, token sai cũng trả 200. */
  async logout(refreshToken: string): Promise<void> {
    await http.post<unknown>('/auth/logout', { refreshToken }, { headers: NATIVE_CLIENT_HEADERS });
  },
  async me(): Promise<AuthUser> {
    return parseAuthResponse(authUserSchema, await http.get<unknown>('/auth/me'));
  },
};
