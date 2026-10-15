import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vitest chỉ chạy unit test thuần trong `src/**` (đuôi .test.ts),
 * tách khỏi Playwright E2E ở thư mục `tests/` (đuôi .spec.ts).
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
