import { http } from '@/core/api/http-client';
import type { AuthUser, LoginPayload, LoginResult } from '@/core/auth/types';
import {
  authUserSchema,
  loginResultSchema,
  logoutResultSchema,
  parseAuthResponse,
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
};
