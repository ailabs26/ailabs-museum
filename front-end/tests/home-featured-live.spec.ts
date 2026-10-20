import { expect, test } from '@playwright/test';
import { roomDetailSchema, roomListSchema, roomResponseSchema } from '../src/validations/roomSchema';

test('live homepage featured cards match the first public room API response', async ({ page }) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Requires running real backend; no interception, seeds or database writes.');
  const listResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/rooms');
  const detailResponses: import('@playwright/test').Response[] = [];
  page.on('response', (response) => {
    if (/^\/api\/rooms\/[^/]+$/.test(new URL(response.url()).pathname)) detailResponses.push(response);
  });
  await page.goto('/');
  const response = await listResponse;
  expect(response.status()).toBe(200);
  const rooms = roomResponseSchema(roomListSchema).parse(await response.json()).data;
  const featured = page.getByRole('region', { name: 'Hiện vật nổi bật' });
  if (rooms.length === 0) {
    await expect(featured.getByRole('status')).toHaveText('Chưa có phòng trưng bày công khai.');
    test.info().annotations.push({ type: 'live-content', description: 'Empty room list; populated featured acceptance not proven.' });
  } else {
    await expect.poll(() => detailResponses.length).toBeGreaterThan(0);
    const detail = detailResponses[0];
    expect(detail.status()).toBe(200);
    const room = roomResponseSchema(roomDetailSchema).parse(await detail.json()).data;
    expect(room.id).toBe(rooms[0].id);
    const expected = [...room.exhibits].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id)).slice(0, 3);
    await expect(featured.getByRole('listitem')).toHaveCount(expected.length);
    if (expected.length > 0) {
      await expect(featured.getByRole('heading', { level: 3 })).toHaveText(expected.map((item) => item.name));
      await expect(featured.getByText('Chưa có ảnh', { exact: true })).toHaveCount(expected.length);
    } else {
      await expect(featured.getByRole('status')).toHaveText('Phòng này chưa có hiện vật được xuất bản.');
      test.info().annotations.push({ type: 'live-content', description: 'First room empty; populated featured acceptance not proven.' });
    }
    const link = featured.getByRole('link', { name: 'Xem bộ sưu tập của phòng này', exact: true });
    const query = new URLSearchParams({ room: room.slug });
    await expect(link).toHaveAttribute('href', `/collection?${query}`);
    await link.focus();
    await link.press('Enter');
    await expect(page).toHaveURL((url) => url.pathname === '/collection' && url.searchParams.get('room') === room.slug);
    await expect(page.getByRole('listitem')).toHaveCount(room.exhibits.length);
  }
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
