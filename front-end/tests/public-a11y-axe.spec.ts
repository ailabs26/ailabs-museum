import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA } from './fixtures/museumContent';

/**
 * Audit tự động WCAG 2.2 AA cho các trang public chính bằng axe-core.
 * Chạy trên API fixture (tất định, không cần DB/live) ở cả giao diện sáng & tối.
 * Kết quả JSON của từng trang được đính kèm vào report Playwright để tổng hợp
 * vào accessibility-audit-report.md. Xem docs/plans/261116-2309-public-client-tasks-audit-upgrade/.
 */

// Chỉ xét các tiêu chí AA (và thấp hơn) tới WCAG 2.2 — bỏ qua 'best-practice' và AAA.
const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const PUBLIC_ROUTES: ReadonlyArray<{ id: string; path: string }> = [
  { id: 'home', path: '/' },
  { id: 'collection', path: '/collection' },
  { id: 'collection-room', path: '/collection?room=sculpture' },
  { id: 'exhibit-detail-2d', path: `/collection/sculpture/exhibits/${roomA.exhibits[0].id}` },
];

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

for (const colorScheme of ['light', 'dark'] as const) {
  for (const route of PUBLIC_ROUTES) {
    test(`[A11Y] ${route.id} không có vi phạm WCAG 2.2 AA (${colorScheme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(route.path);
      // Chờ nội dung chính dựng xong để axe soi DOM thật, không phải skeleton.
      await expect(page.getByRole('main')).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();

      await testInfo.attach(`axe-${route.id}-${colorScheme}.json`, {
        body: JSON.stringify({
          route: route.path,
          colorScheme,
          violations: results.violations,
          passes: results.passes.length,
          incomplete: results.incomplete.length,
        }, null, 2),
        contentType: 'application/json',
      });

      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nút — ${v.help}`);
      expect(summary, `Vi phạm WCAG 2.2 AA trên ${route.path} [${colorScheme}]`).toEqual([]);
    });
  }
}
