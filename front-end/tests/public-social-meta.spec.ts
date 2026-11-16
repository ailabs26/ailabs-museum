import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA } from './fixtures/museumContent';

/** OpenGraph/Twitter cập nhật động theo trang để chia sẻ liên kết hiển thị đúng. */

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

const ogContent = (page: import('@playwright/test').Page, prop: string) =>
  page.locator(`meta[property="${prop}"]`).getAttribute('content');

test('trang chủ có OG mặc định Aura Museum', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  expect(await ogContent(page, 'og:title')).toContain('Aura Museum');
  expect(await ogContent(page, 'og:url')).toContain('/');
});

test('chi tiết hiện vật đặt OG theo tên + mô tả hiện vật', async ({ page }) => {
  const exhibit = roomA.exhibits[0];
  await page.goto(`/collection/sculpture/exhibits/${exhibit.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(exhibit.name);
  expect(await ogContent(page, 'og:title')).toContain(exhibit.name);
  expect(await ogContent(page, 'og:url')).toContain(exhibit.id);
  const description = await ogContent(page, 'og:description');
  expect(description && description.length).toBeTruthy();
});
