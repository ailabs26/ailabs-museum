import { expect, test } from '@playwright/test';
import { roomDetailSchema, roomListSchema, roomResponseSchema } from '../src/validations/roomSchema';

test('live tour has a contextual 2D route for a published exhibit and room fallback', async ({ page, request }) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Requires real local backend; no interception or database writes.');
  const listResponse = await request.get('http://localhost:3001/api/rooms');
  expect(listResponse.status()).toBe(200);
  const rooms = roomResponseSchema(roomListSchema).parse(await listResponse.json()).data;
  if (rooms.length === 0) {
    test.info().annotations.push({ type: 'live-content', description: 'No public rooms; fallback populated route not proven.' });
    return;
  }
  const roomResponse = await request.get(`http://localhost:3001/api/rooms/${encodeURIComponent(rooms[0].slug)}`);
  const room = roomResponseSchema(roomDetailSchema).parse(await roomResponse.json()).data;
  if (room.exhibits.length === 0) {
    test.info().annotations.push({ type: 'live-content', description: 'First room empty; exhibit fallback route not proven.' });
    return;
  }
  const item = room.exhibits[0];
  await page.goto(`/tour?room=${encodeURIComponent(room.slug)}`);
  await page.getByRole('button', { name: `Xem chi tiết ${item.name}`, exact: true }).click();
  const link = page.getByRole('link', { name: 'Đọc chi tiết 2D', exact: true });
  await expect(link).toHaveAttribute('href', `/collection/${encodeURIComponent(room.slug)}/exhibits/${item.id}`);
  await link.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.name);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.locator('canvas')).toHaveCount(0);
});
