import { expect, test } from '@playwright/test';
import { roomDetailSchema, roomListSchema, roomResponseSchema } from '../src/validations/roomSchema';
import { mapRoomDisplays } from '../src/helpers/mapRoomDisplays';

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

test('live published exhibit selection, details and gallery use actual backend content', async ({ page }, testInfo) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1', 'Requires real published content; no database setup or interceptions.');
  test.setTimeout(60_000);
  const sceneRequests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('MuseumScene')) sceneRequests.push(request.url()); });
  const response = await page.request.get('http://localhost:3001/api/rooms');
  expect(response.status()).toBe(200);
  const rooms = roomResponseSchema(roomListSchema).parse(await response.json()).data;
  test.skip(!rooms.length, 'No public room available for populated live acceptance.');
  const detailResponse = await page.request.get(`http://localhost:3001/api/rooms/${encodeURIComponent(rooms[0].slug)}`);
  expect(detailResponse.status()).toBe(200);
  const detail = roomResponseSchema(roomDetailSchema).parse(await detailResponse.json()).data;
  const displays = mapRoomDisplays(detail);
  test.skip(!displays.length, 'No published exhibit available for live interaction.');
  await page.goto(`/tour.html?room=${encodeURIComponent(rooms[0].slug)}`);
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  if (process.env.PLAYWRIGHT_PREVIEW === '1') expect(sceneRequests.some((url) => url.includes('/assets/MuseumScene-'))).toBe(true);
  const display = displays.find((item) => !item.isOutsideRoom) ?? displays[0];
  await page.getByRole('button', { name: `Xem chi tiết ${display.title}`, exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  await expect(panel.getByRole('heading', { name: display.title, exact: true })).toBeVisible();
  if (display.description) await expect(panel.getByText(display.description, { exact: true })).toBeVisible();
  if (display.transcript) await expect(panel.getByText(display.transcript, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tập trung hiện vật', exact: true })).toBeEnabled({ enabled: !display.isOutsideRoom });
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath('day3-live-gallery.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await page.getByRole('button', { name: 'Dừng 3D' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
