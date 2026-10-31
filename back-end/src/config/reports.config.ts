import { registerAs } from '@nestjs/config';

export const reportsConfig = registerAs('reports', () => ({
  publicRateLimit: parseInt(process.env.PUBLIC_REPORT_RATE_LIMIT ?? '5', 10),
}));
