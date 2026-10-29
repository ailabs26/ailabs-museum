import { registerAs } from '@nestjs/config';
import { DEV_JWT_ACCESS_SECRET } from './env.validation';

/** Cấu hình bảo mật JWT + refresh token + hash mật khẩu — namespace 'jwt'. */
export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? DEV_JWT_ACCESS_SECRET,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '7', 10),
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'aura_rt',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
}));
