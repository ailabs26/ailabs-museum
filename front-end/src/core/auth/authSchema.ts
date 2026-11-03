import { z } from 'zod';
import { ApiException } from '@/core/api/api-error';
import type { AuthUser, LoginOutcome, LoginResult } from './types';

export const authUserSchema: z.ZodType<AuthUser> = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  twoFactorEnabled: z.boolean().optional(),
});

export const loginResultSchema: z.ZodType<LoginResult> = z.object({
  accessToken: z.string().min(1),
  user: authUserSchema,
});

/** POST /auth/login: có phiên ngay, hoặc cần bước 2 (2FA). */
export const loginOutcomeSchema: z.ZodType<LoginOutcome> = z.union([
  z.object({ mfaRequired: z.literal(true), mfaToken: z.string().min(1) }),
  loginResultSchema,
]);

export const refreshResultSchema = z.object({
  accessToken: z.string().min(1),
});

export const logoutResultSchema = z.null();

/** Một thiết bị đang đăng nhập (GET /auth/sessions). */
export const sessionSchema = z.object({
  id: z.string().uuid(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  signedInAt: z.string().datetime({ offset: true }),
  lastActiveAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  current: z.boolean(),
});
export type AuthSession = z.infer<typeof sessionSchema>;

export const sessionsResultSchema = z.array(sessionSchema);
export const bulkRevokeResultSchema = z.object({ id: z.string().uuid() });

/** Chỉ dùng phản hồi xác thực sau khi đã kiểm tra hợp đồng API. */
export function parseAuthResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiException('Phản hồi xác thực từ máy chủ không hợp lệ', 502);
  }

  return result.data;
}
