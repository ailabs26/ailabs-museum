import { registerAs } from '@nestjs/config';
import { DEV_JWT_ACCESS_SECRET } from './env.validation';

/** Cấu hình bảo mật JWT + refresh token + hash mật khẩu — namespace 'jwt'. */
export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? DEV_JWT_ACCESS_SECRET,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '7', 10),
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'aura_rt',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  /** Số request /auth/refresh tối đa mỗi phút (xem AuthRateLimiter). */
  refreshRateLimit: {
    perSession: parseInt(process.env.REFRESH_RATE_LIMIT_PER_SESSION ?? '30', 10),
    perIp: parseInt(process.env.REFRESH_RATE_LIMIT_PER_IP ?? '300', 10),
    invalidPerIp: parseInt(process.env.REFRESH_RATE_LIMIT_INVALID_PER_IP ?? '20', 10),
  },
}));
