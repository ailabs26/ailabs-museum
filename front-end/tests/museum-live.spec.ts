import { expect, test } from '@playwright/test';
import { roomDetailSchema, roomListSchema, roomResponseSchema } from '../src/validations/roomSchema';

test('live public API content reaches the tour without intercepts or sample substitution', async ({ page }) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Requires a running real backend; no database setup or test fixtures.');
  const listResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/rooms');
  await page.goto('/tour.html');
  const response = await listResponse;
  expect(response.status()).toBe(200);
  const rooms = roomResponseSchema(roomListSchema).parse(await response.json()).data;
  if (rooms.length === 0) {
    await expect(page.getByText('Chưa có phòng trưng bày công khai.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toHaveCount(0);
  } else {
    await expect(page.getByLabel('Chọn phòng trưng bày')).toHaveValue(rooms[0].slug);
    await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(rooms[0].name);
    const detailResponse = await page.request.get(`http://localhost:3001/api/rooms/${encodeURIComponent(rooms[0].slug)}`);
    expect(detailResponse.status()).toBe(200);
    const detail = roomResponseSchema(roomDetailSchema).parse(await detailResponse.json()).data;
    await expect(page.getByRole('list', { name: 'Các hiện vật' }).getByRole('listitem')).toHaveCount(detail.exhibits.length);
  }
  await expect(page.getByRole('alert')).toHaveCount(0);
});
