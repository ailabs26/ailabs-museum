import { z } from 'zod';
import { ApiException } from '@/core/api/api-error';

/**
 * Hợp đồng API xác thực cho client native (MOB-E3-03).
 * Khác web: back-end trả `refreshToken` trong body khi request có header `X-Client: mobile`.
 */
export const NATIVE_CLIENT_HEADERS = { 'X-Client': 'mobile' } as const;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  twoFactorEnabled: z.boolean().optional(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const sessionTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});
export type SessionTokens = z.infer<typeof sessionTokensSchema>;

export const loginResultSchema = sessionTokensSchema.extend({ user: authUserSchema });
export type LoginResult = z.infer<typeof loginResultSchema>;

/** POST /auth/login: có phiên ngay, hoặc cần bước 2 (2FA). */
export const loginOutcomeSchema = z.union([
  z.object({ mfaRequired: z.literal(true), mfaToken: z.string().min(1) }),
  loginResultSchema,
]);
export type LoginOutcome = z.infer<typeof loginOutcomeSchema>;

export interface LoginPayload {
  email: string;
  password: string;
}

/** Bước 2 đăng nhập: mã 6 số từ app Authenticator hoặc một mã khôi phục. */
export type TwoFactorCode = { code: string } | { recoveryCode: string };

/** Chỉ dùng phản hồi xác thực sau khi đã kiểm tra hợp đồng API. */
export function parseAuthResponse<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiException('Phản hồi xác thực từ máy chủ không hợp lệ', 502);
  }
  return result.data;
}
