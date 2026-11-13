import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomB, roomSummaries } from './fixtures/museumContent';

test('browser storage events synchronize favorites and notes across tabs without server writes', async ({ page, context }) => {
  await installMuseumApi(page);
  const second = await context.newPage();
  await installMuseumApi(second);
  const path = `/collection/sculpture/exhibits/${roomA.exhibits[0].id}`;
  await page.goto(path); await second.goto(path);
  const favorite = (tab: typeof page) => tab.getByRole('button', { name: 'Yêu thích Hiện vật 1', exact: true });
  await favorite(page).click();
  await expect(favorite(second)).toHaveAttribute('aria-pressed', 'true');
  await second.getByRole('textbox', { name: 'Ghi chú của bạn', exact: true }).fill('Ghi chú từ tab hai');
  await expect(page.getByRole('textbox', { name: 'Ghi chú của bạn', exact: true })).toHaveValue('Ghi chú từ tab hai');
  await favorite(second).click();
  await expect(favorite(page)).toHaveAttribute('aria-pressed', 'false');
  await second.close();
});

test('recent lists never show cached content after failed public detail refresh', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hiện vật 1');
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này', exact: true }).click();
  const recent = page.getByRole('region', { name: 'Đã xem gần đây' });
  await expect(recent.getByRole('link')).toHaveCount(1);
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, { success: false, data: null, message: 'Unavailable' }, 503));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(recent.getByRole('link')).toHaveCount(0);
  await expect(recent.getByText(/không còn khả dụng/)).toBeVisible();
});

test('visitor controls reflow at mobile and 200 percent zoom in light and dark themes', async ({ page }) => {
  await installMuseumApi(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(value => localStorage.setItem('mantine-color-scheme-value', value), theme);
    for (const viewport of [{ width: 320, height: 740 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
      const toggle = page.getByRole('button', { name: 'Chế độ đọc', exact: true });
      if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
      const grow = page.getByRole('button', { name: 'Tăng cỡ chữ' });
      while (await grow.isEnabled()) await grow.click();
      if (viewport.width === 1280) await page.evaluate(() => { document.body.style.zoom = '2'; });
      await expect(page.getByRole('textbox', { name: 'Ghi chú của bạn', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await page.evaluate(() => { document.body.style.zoom = ''; });
      await page.screenshot({ path: `test-results/visitor-detail-${theme}-${viewport.width}.png`, fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test('comparison scroll stays inside the dialog on narrow screens and focus stays trapped', async ({ page }) => {
  await installMuseumApi(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/collection');
  for (const item of roomA.exhibits.slice(0, 3)) {
    const button = page.getByRole('button', { name: `So sánh ${item.name}`, exact: true });
    const bounds = await button.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    await button.click();
  }
  await page.getByRole('button', { name: 'Mở so sánh (3)', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'So sánh hiện vật' });
  await expect(dialog).toBeVisible();
  const scroll = dialog.getByRole('region');
  await scroll.focus();
  await scroll.press('End');
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: 'test-results/visitor-comparison-mobile.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('favorite filter follows room back/forward and does not resurrect hidden rooms', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/collection');
  await page.getByRole('button', { name: 'Yêu thích Hiện vật 1', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Chỉ hiện vật yêu thích trong phòng này' }).check();
  await page.getByRole('button', { name: roomB.name, exact: true }).click();
  await expect(page.getByText(/Không có hiện vật yêu thích khớp/)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 3, name: 'Hiện vật 1', exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByText(/Không có hiện vật yêu thích khớp/)).toBeVisible();
  await page.route('**/api/rooms', route => fulfillMuseum(route, envelope(roomSummaries.filter(room => room.id !== roomB.id))));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Phòng được chọn không có');
});

test('failed stale detail loads never count as a successful recent view', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/collection');
  await expect(page.getByRole('heading', { level: 3, name: 'Hiện vật 1', exact: true })).toBeVisible();
  await page.route('**/api/rooms/sculpture', async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await fulfillMuseum(route, { success: false, data: null, message: 'Unavailable' }, 503);
  });
  await page.evaluate(() => { const now = Date.now(); Date.now = () => now + 60_000; });
  await page.getByRole('link', { name: 'Xem chi tiết Hiện vật 1', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Không tải được nội dung');
  expect(await page.evaluate(() => localStorage.getItem('aura:visitor:recent:v1'))).toBeNull();
});

test('removing the only filtered favorite restores focus to a readable destination', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/collection');
  const favorite = page.getByRole('button', { name: 'Yêu thích Hiện vật 1', exact: true });
  await favorite.click();
  await page.getByRole('checkbox', { name: 'Chỉ hiện vật yêu thích trong phòng này' }).check();
  await favorite.focus(); await favorite.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Bộ sưu tập', exact: true })).toBeFocused();
});
