import { registerAs } from '@nestjs/config';

/** Cấu hình database — namespace 'database'. Kết nối thực tế dùng data-source.ts. */
export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));
