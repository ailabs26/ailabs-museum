import { defineConfig } from 'vitest/config';

/**
 * Vitest chỉ chạy unit test thuần trong `src/**` (đuôi .test.ts),
 * tách khỏi Playwright E2E ở thư mục `tests/` (đuôi .spec.ts).
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
