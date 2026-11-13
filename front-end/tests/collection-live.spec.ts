import { expect, test } from '@playwright/test';
import { roomDetailSchema, roomListSchema, roomResponseSchema } from '../src/validations/roomSchema';

test('live collection displays seeded Supabase content through the API without intercepts', async ({ page }) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Requires real local backend with seeded public content; no database writes.');
  const slug = 'phong-lich-su-quan-su-viet-nam';
  const listResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/rooms');
  const detailResponse = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/rooms/${slug}`);
  await page.goto(`/collection?room=${slug}`);
  const list = await listResponse;
  expect(list.status()).toBe(200);
  expect(roomResponseSchema(roomListSchema).parse(await list.json()).data.some((room) => room.slug === slug)).toBe(true);
  const response = await detailResponse;
  expect(response.status()).toBe(200);
  const detail = roomResponseSchema(roomDetailSchema).parse(await response.json()).data;
  const items = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem');
  await expect(items).toHaveCount(detail.exhibits.length);
  expect(detail.exhibits.length).toBeGreaterThanOrEqual(5);
  for (const name of ['[Mẫu] Mũ bảo hộ', '[Mẫu] Bình nước dã chiến', '[Mẫu] Ba lô hành quân', '[Mẫu] La bàn', '[Mẫu] Máy thông tin liên lạc']) {
    await expect(items.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText('Chưa có ảnh', { exact: true })).toHaveCount(detail.exhibits.length);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tham quan phòng này trong 3D', exact: true })).toHaveAttribute('href', `/tour?room=${slug}`);
});
