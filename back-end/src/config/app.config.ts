import { registerAs } from '@nestjs/config';

/** Cấu hình ứng dụng (port, CORS origin, prefix API) — namespace 'app'. */
export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  apiPrefix: 'api',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL,
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
}));
