import { expect, test, type Locator, type Response } from '@playwright/test';
import { roomDetailSchema, roomListSchema, roomResponseSchema, type RoomDetail } from '../src/validations/roomSchema';

async function expectApiPreview(container: Locator, exhibit: RoomDetail['exhibits'][number]) {
  const shape = container.locator('[data-shape]');
  await expect(shape).toHaveAttribute('data-shape', exhibit.placeholderShape);
  expect(await shape.evaluate((element) => getComputedStyle(element).getPropertyValue('--exhibit-color').trim())).toBe(exhibit.placeholderColor);
  await expect(container.getByText('Hình minh họa thay thế', { exact: true })).toBeVisible();
  await expect(container.getByText('Chưa có ảnh', { exact: true })).toBeVisible();
}

test('live API shapes and colors match collection, featured, tour and selected detail', async ({ page }) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Requires real local backend; no interception or database writes.');
  const details: Response[] = [];
  page.on('response', (response) => {
    if (/^\/api\/rooms\/[^/]+$/.test(new URL(response.url()).pathname)) details.push(response);
  });
  const listResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/rooms');
  await page.goto('/collection');
  const list = await listResponse;
  expect(list.status()).toBe(200);
  const rooms = roomResponseSchema(roomListSchema).parse(await list.json()).data;
  if (rooms.length === 0) {
    await expect(page.getByText('Chưa có phòng trưng bày công khai.', { exact: true })).toBeVisible();
    test.info().annotations.push({ type: 'live-content', description: 'No public rooms; populated preview acceptance not proven.' });
    return;
  }
  await expect.poll(() => details.length).toBeGreaterThan(0);
  const response = details[0];
  expect(response.status()).toBe(200);
  const room = roomResponseSchema(roomDetailSchema).parse(await response.json()).data;
  expect(room.id).toBe(rooms[0].id);
  const exhibits = [...room.exhibits].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
  if (exhibits.length === 0) {
    await expect(page.getByText('Phòng này chưa có hiện vật được xuất bản.', { exact: true })).toBeVisible();
    test.info().annotations.push({ type: 'live-content', description: 'First room empty; populated preview acceptance not proven.' });
    return;
  }
  const cards = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem');
  await expect(cards).toHaveCount(exhibits.length);
  for (const [index, exhibit] of exhibits.entries()) await expectApiPreview(cards.nth(index), exhibit);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Aura Museum — Trang chủ', exact: true }).click();
  const featured = page.getByRole('region', { name: 'Hiện vật nổi bật' }).getByRole('listitem');
  await expect(featured).toHaveCount(Math.min(3, exhibits.length));
  for (const [index, exhibit] of exhibits.slice(0, 3).entries()) await expectApiPreview(featured.nth(index), exhibit);
  await page.locator('header').getByRole('link', { name: 'Tham quan 3D', exact: true }).click();
  const tour = page.getByRole('list', { name: 'Các hiện vật' }).getByRole('listitem');
  await expect(tour).toHaveCount(exhibits.length);
  for (const [index, exhibit] of exhibits.entries()) await expectApiPreview(tour.nth(index), exhibit);
  await tour.first().getByRole('button', { name: `Xem chi tiết ${exhibits[0].name}`, exact: true }).click();
  await expectApiPreview(page.getByRole('complementary', { name: 'Chi tiết hiện vật' }), exhibits[0]);
  await expect(page.locator('canvas')).toHaveCount(0);
});
