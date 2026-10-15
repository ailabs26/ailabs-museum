import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('[D02] direct URL and reload show the correct public exhibit without loading a scene', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const exhibit = roomA.exhibits[1];
  await page.goto(`/collection/sculpture/exhibits/${exhibit.id}`);
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(exhibit.name);
    await expect(page.getByText(roomA.name, { exact: true })).toBeVisible();
    await expect(page.getByText(exhibit.description, { exact: true })).toBeVisible();
    await expect(page.getByText('Hình minh họa thay thế', { exact: true })).toBeVisible();
    await expect(page.locator('[data-shape]')).toHaveAttribute('data-shape', exhibit.placeholderShape);
    await expect(page.getByText('Chưa có ảnh', { exact: true })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
  }
  expect(requests.filter((url) => url.includes('/api/admin/') || url.includes('/components/MuseumScene'))).toEqual([]);
  expect(requests.filter((url) => url.includes('/api/rooms/ceramics'))).toEqual([]);
});

test('[D02] empty description has an explicit text state', async ({ page }) => {
  const exhibit = roomA.exhibits[0];
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [{ ...exhibit, description: '' }],
  })));
  await page.goto(`/collection/sculpture/exhibits/${exhibit.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(exhibit.name);
  await expect(page.getByRole('heading', { name: 'Câu chuyện hiện vật', level: 2 })).toBeVisible();
  await expect(page.getByText('Chưa có mô tả.', { exact: true })).toBeVisible();
});

test('[D02] basic guards do not substitute another room or render a missing exhibit', async ({ page }) => {
  for (const path of [
    `/collection/unknown/exhibits/${roomA.exhibits[0].id}`,
    '/collection/sculpture/exhibits/not-a-uuid',
    '/collection/sculpture/exhibits/10000000-0000-4000-8000-000000000099',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(roomA.exhibits[0].name);
    await expect(page.getByText('Hình minh họa thay thế', { exact: true })).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/không hợp lệ|Không tìm thấy/);
  }
});
