import { expect, test, type Page } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';
import { envelope } from './fixtures/museumContent';

test('tour initial JavaScript stays below 1 MB before loading any WebGL scene', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_PREVIEW !== '1', 'Measures production bundles, not Vite development modules');
  await installMuseumApi(page);
  await page.goto('/tour.html');
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeVisible();
  const scripts = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.name.includes('/assets/') && new URL(entry.name).pathname.endsWith('.js'))
    .map((entry) => ({ url: entry.name, bytes: (entry as PerformanceResourceTiming).decodedBodySize })));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((script) => script.bytes > 0)).toBe(true);
  expect(scripts.reduce((bytes, script) => bytes + script.bytes, 0)).toBeLessThan(1_000_000);
  expect(scripts.some((script) => /MuseumScene|apexcharts/i.test(script.url))).toBe(false);
  await expect(page.locator('canvas')).toHaveCount(0);
});

async function openDashboard(page: Page) {
  await installMuseumApi(page);
  await page.route('**/api/auth/login', (route) => fulfillMuseum(route, envelope({ accessToken: 'test-only-token', user: {
    id: '00000000-0000-4000-8000-000000000001', email: 'perf@example.test', displayName: 'Test user', roles: [], permissions: [],
  } })));
  await page.route('**/api/admin/stats/overview', (route) => fulfillMuseum(route, envelope({
    rooms: { total: 1, active: 1, archived: 0 }, exhibits: { total: 5, visible: 5, hidden: 0 },
    revisions: { inReview: 0, draft: 0 }, reports: { open: 1, inProgress: 0 },
    system: { api: 'up', db: 'up', uptimeSec: 30, serverTime: '2026-10-14T00:00:00Z' },
  })));
  await page.route('**/api/admin/stats/charts', (route) => fulfillMuseum(route, envelope({
    reportsByStatus: [{ label: 'open', count: 1 }], exhibitsByRoom: [{ label: 'Gallery', count: 5 }],
    revisionsByState: [{ label: 'approved', count: 5 }], activityLast14Days: [{ date: '2026-10-14', revisions: 5, reports: 1 }],
  })));
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('perf@example.test');
  await page.getByLabel(/^Mật khẩu/).fill('test-only-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
}

test('deferred chart code still renders dashboard charts on demand', async ({ page }) => {
  await openDashboard(page);
  // Four primary charts and the two nonempty statistic sparklines.
  await expect(page.locator('.apexcharts-canvas')).toHaveCount(6, { timeout: 15_000 });
});

test('failed chart chunk leaves the dashboard usable with local error feedback', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_PREVIEW !== '1', 'Requires production chunk URL');
  await page.route('**/assets/react-apexcharts*', (route) => route.abort());
  await openDashboard(page);
  await expect(page.getByText('Không tải được biểu đồ. Hãy tải lại trang để thử lại.')).toHaveCount(4);
  await expect(page.getByRole('img', { name: 'Không tải được xu hướng', exact: true })).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeEnabled();
});
