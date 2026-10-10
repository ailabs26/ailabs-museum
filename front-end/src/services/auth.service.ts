import { http } from '@/core/api/http-client';
import type { AuthUser, LoginPayload, LoginResult } from '@/core/auth/types';

/** Gọi API xác thực (endpoint hoàn thiện ở BE PR #D). */
export const authService = {
  login(payload: LoginPayload): Promise<LoginResult> {
    return http.post<LoginResult>('/auth/login', payload);
  },
  logout(): Promise<void> {
    return http.post<void>('/auth/logout');
  },
  me(): Promise<AuthUser> {
    return http.get<AuthUser>('/auth/me');
  },
};
