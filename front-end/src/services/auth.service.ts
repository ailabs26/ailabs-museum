import { http } from '@/core/api/http-client';
import type { AuthUser, LoginPayload, LoginResult } from '@/core/auth/types';
import {
  authUserSchema,
  bulkRevokeResultSchema,
  loginResultSchema,
  logoutResultSchema,
  parseAuthResponse,
  sessionsResultSchema,
  type AuthSession,
} from '@/core/auth/authSchema';

/** Gọi và kiểm tra phản hồi từ API xác thực. */
export const authService = {
  async login(payload: LoginPayload): Promise<LoginResult> {
    return parseAuthResponse(loginResultSchema, await http.post<unknown>('/auth/login', payload));
  },
  async logout(): Promise<void> {
    // Đợi cookie xoay vòng về trước khi yêu cầu backend thu hồi phiên đó.
    await http.waitForRefresh();
    parseAuthResponse(logoutResultSchema, await http.post<unknown>('/auth/logout'));
  },
  async me(): Promise<AuthUser> {
    return parseAuthResponse(authUserSchema, await http.get<unknown>('/auth/me'));
  },
  async sessions(): Promise<AuthSession[]> {
    return parseAuthResponse(sessionsResultSchema, await http.get<unknown>('/auth/sessions'));
  },
  async revokeSession(id: string): Promise<void> {
    parseAuthResponse(logoutResultSchema, await http.delete<unknown>(`/auth/sessions/${id}`));
  },
  async revokeOtherSessions(): Promise<void> {
    parseAuthResponse(bulkRevokeResultSchema, await http.post<unknown>('/auth/sessions/revoke-others'));
  },
  /** Tự đổi mật khẩu; back-end đăng xuất mọi thiết bị khác, giữ thiết bị này. */
  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    parseAuthResponse(bulkRevokeResultSchema, await http.post<unknown>('/auth/change-password', input));
  },
  async logoutAll(): Promise<void> {
    parseAuthResponse(bulkRevokeResultSchema, await http.post<unknown>('/auth/logout-all'));
  },
};
