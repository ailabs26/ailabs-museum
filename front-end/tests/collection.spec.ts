import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomB } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('collection renders validated API exhibits in display order without loading a 3D scene', async ({ page }) => {
  const sceneRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/components/MuseumScene')) sceneRequests.push(request.url());
  });
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [...roomA.exhibits].reverse(),
  })));
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'Bộ sưu tập', exact: true, level: 1 })).toBeVisible();
  const items = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem');
  await expect(items).toHaveCount(5);
  await expect(items.getByRole('heading', { level: 3 })).toHaveText(roomA.exhibits.map((item) => item.name));
  for (const item of roomA.exhibits) await expect(page.getByText(item.description, { exact: true })).toBeVisible();
  await expect(page.getByText('Chưa có ảnh', { exact: true })).toHaveCount(5);
  await expect(page.getByRole('link', { name: 'Tham quan phòng này trong 3D', exact: true })).toHaveAttribute('href', '/tour?room=sculpture');
  await expect(page.locator('header').getByRole('link', { name: 'Bộ sưu tập', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(sceneRequests).toEqual([]);
});

test('selecting a room preserves URL parameters and reload restores the selection', async ({ page }) => {
  await page.goto('/collection?source=home');
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page).toHaveURL(/source=home&room=ceramics$/);
  await expect(page.getByRole('heading', { name: roomB.name, exact: true, level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bình gốm', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Chọn phòng trưng bày')).toHaveValue('ceramics');
  await expect(page.getByRole('link', { name: 'Tham quan phòng này trong 3D', exact: true })).toHaveAttribute('href', '/tour?room=ceramics');
});
