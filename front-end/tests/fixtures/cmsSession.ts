import type { Page } from '@playwright/test';
import { fulfillMuseum } from './museumApi';
import { envelope } from './museumContent';

/**
 * Phiên admin giả cho E2E CMS. Gọi TRƯỚC các route riêng của fixture: Playwright ưu tiên route đăng ký sau.
 * - Mọi request /api/ chưa mock trả rỗng, không bao giờ chạm back-end thật. Dùng predicate theo pathname vì glob
 *   chứa "api" sẽ khớp cả module Vite trong thư mục src/core/api.
 * - Khôi phục phiên như thật: /auth/me không có token → 401 → /auth/refresh → gọi lại /auth/me có token.
 * - /admin/stats/overview: AdminLayout đọc cho badge sidebar, thiếu thì cả trang crash.
 */
export async function installCmsSession(page: Page, permissions: string[]) {
  await page.route((url) => url.pathname.startsWith('/api/'), (route) =>
    fulfillMuseum(route, { ...envelope([]), meta: { page: 1, pageSize: 20, total: 0 } }));
  await page.route('**/api/auth/refresh', (route) => fulfillMuseum(route, envelope({ accessToken: 'cms-fixture-token' })));
  await page.route('**/api/auth/me', (route) => (route.request().headers().authorization
    ? fulfillMuseum(route, envelope({
      id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@aura.local', displayName: 'Administrator', roles: ['admin'], permissions,
    }))
    : fulfillMuseum(route, { success: false, data: null, message: 'Unauthenticated' }, 401)));
  await page.route('**/api/admin/stats/overview*', (route) => fulfillMuseum(route, envelope({
    rooms: { total: 0, active: 0, archived: 0 }, exhibits: { total: 0, visible: 0, hidden: 0 },
    revisions: { inReview: 0, draft: 0 }, reports: { open: 0, inProgress: 0 },
    system: { api: 'up', db: 'up', uptimeSec: 1, serverTime: '2026-11-04T00:00:00Z' },
  })));
}
