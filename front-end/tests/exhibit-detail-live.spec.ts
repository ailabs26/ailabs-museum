import { expect, test } from '@playwright/test';
import { roomDetailSchema, roomListSchema, roomResponseSchema } from '../src/validations/roomSchema';

test('live detail page matches a published API exhibit and public navigation', async ({ page, request }) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Requires running real backend; no interception or database writes.');
  const listResponse = await request.get('http://localhost:3001/api/rooms');
  expect(listResponse.status()).toBe(200);
  const rooms = roomResponseSchema(roomListSchema).parse(await listResponse.json()).data;
  if (rooms.length === 0) {
    test.info().annotations.push({ type: 'live-content', description: 'No public room; populated detail acceptance not proven.' });
    await page.goto('/collection');
    await expect(page.getByText('Chưa có phòng trưng bày công khai.', { exact: true })).toBeVisible();
    return;
  }
  const roomResponse = await request.get(`http://localhost:3001/api/rooms/${encodeURIComponent(rooms[0].slug)}`);
  expect(roomResponse.status()).toBe(200);
  const room = roomResponseSchema(roomDetailSchema).parse(await roomResponse.json()).data;
  const item = [...room.exhibits].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id))[0];
  if (!item) {
    test.info().annotations.push({ type: 'live-content', description: 'First public room empty; populated detail acceptance not proven.' });
    await page.goto(`/collection?${new URLSearchParams({ room: room.slug })}`);
    await expect(page.getByText('Phòng này chưa có hiện vật được xuất bản.', { exact: true })).toBeVisible();
    return;
  }
  const path = `/collection/${encodeURIComponent(room.slug)}/exhibits/${item.id}`;
  await page.goto(path);
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.name);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(page.getByRole('region', { name: 'Câu chuyện hiện vật' })).toContainText(item.description || 'Chưa có mô tả.');
    await expect(page.locator('[data-shape]')).toHaveAttribute('data-shape', item.placeholderShape);
    if (item.transcript) await expect(page.getByRole('region', { name: 'Bản thuyết minh' })).toContainText(item.transcript);
    else await expect(page.getByRole('heading', { name: 'Bản thuyết minh' })).toHaveCount(0);
    const hotspots = [...item.hotspots].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
    for (const [index, hotspot] of hotspots.entries()) {
      const row = page.getByRole('list', { name: 'Điểm chú ý của hiện vật' }).getByRole('listitem').nth(index);
      await expect(row).toContainText(hotspot.label);
      await expect(row).toContainText(hotspot.body);
    }
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  const back = page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này', exact: true });
  await expect(back).toHaveAttribute('href', `/collection?${new URLSearchParams({ room: room.slug })}`);
  await back.click();
  const card = page.getByRole('link', { name: `Xem chi tiết ${item.name}`, exact: true });
  await card.focus();
  await card.press('Enter');
  await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === decodeURIComponent(path));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.name);
});
