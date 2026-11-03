import { expect, test } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';
import { envelope, roomA, roomB } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('recent exhibits link to the right room, deduplicate after reload and can be cleared', async ({ page }) => {
  for (const room of [roomA, roomB, roomA]) {
    await page.goto(`/collection/${room.slug}/exhibits/${room.exhibits[0].id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(room.exhibits[0].name);
  }
  await page.reload();
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này', exact: true }).click();
  const recent = page.getByRole('region', { name: 'Đã xem gần đây' });
  await expect(recent).toBeVisible({ timeout: 3000 });
  const links = recent.getByRole('link');
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute('href', `/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  await expect(links.nth(1)).toHaveAttribute('href', `/collection/ceramics/exhibits/${roomB.exhibits[0].id}`);
  await links.nth(1).press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(roomB.exhibits[0].name);
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này', exact: true }).click();
  await recent.getByRole('button', { name: 'Xóa lịch sử' }).click();
  await expect(recent.getByText('Chưa có hiện vật đã xem.')).toBeVisible();
  await page.reload();
  await expect(recent.getByRole('link')).toHaveCount(0);
});

test('invalid details never enter history and stale identifiers never restore content', async ({ page }) => {
  await page.goto('/collection/sculpture/exhibits/invalid');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Đường dẫn hiện vật không hợp lệ');
  expect(await page.evaluate(() => localStorage.getItem('aura:visitor:recent:v1'))).toBeNull();
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(roomA.exhibits[0].name);
  await page.route('**/api/rooms', route => fulfillMuseum(route, envelope([roomB])));
  await page.goto('/collection');
  const recent = page.getByRole('region', { name: 'Đã xem gần đây' });
  await expect(recent.getByRole('link')).toHaveCount(0);
  await expect(recent.getByText(/không còn khả dụng/)).toBeVisible();
});
