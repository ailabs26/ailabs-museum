import { expect, test } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';
import { envelope, roomA, roomB, roomSummaries } from './fixtures/museumContent';

test('loads only selected public room, renders API exhibits and switches without reload', async ({ page }) => {
  const requests = await installMuseumApi(page);
  await page.goto('/tour.html');
  await expect(page.getByLabel('Chọn phòng trưng bày')).toBeVisible();
  await expect(page.locator('#museum-catalogue li')).toHaveCount(5);
  await expect(page.getByText('Nội dung bảo tàng đã xuất bản', { exact: true })).toBeVisible();
  expect(requests.filter((path) => path !== '/api/rooms')).toEqual(['/api/rooms/sculpture']);
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  const initialView = await page.locator('canvas').screenshot();
  await page.evaluate(() => Reflect.set(window, '__pageMarker', 'unchanged'));
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page.getByRole('heading', { name: 'Gốm Việt', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bình gốm' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect.poll(async () => (await page.locator('canvas').screenshot()).equals(initialView)).toBe(false);
  expect(await page.evaluate(() => Reflect.get(window, '__pageMarker'))).toBe('unchanged');
  await page.getByLabel('Chọn phòng trưng bày').selectOption('sculpture');
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toBeVisible();
  expect(requests.filter((path) => path === '/api/rooms/sculpture')).toHaveLength(1);
  expect(requests.filter((path) => path === '/api/rooms/empty')).toHaveLength(0);
});

test('empty room list shows no sample data or scene start', async ({ page }) => {
  await installMuseumApi(page);
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([])));
  await page.goto('/tour');
  await expect(page.getByText('Chưa có phòng trưng bày công khai.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toHaveCount(0);
  await expect(page.getByRole('listitem')).toHaveCount(0);
});

test('empty selected room keeps the room shell available and labels missing media', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/tour?room=empty');
  await expect(page.getByText('Phòng này chưa có hiện vật được xuất bản.')).toBeVisible();
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page.getByText('Chưa có ảnh hoặc mô hình 3D; đang hiển thị hình khối thay thế.', { exact: true })).toBeVisible();
});

test('list error exposes manual retry and never substitutes sample content', async ({ page }) => {
  await installMuseumApi(page);
  let attempts = 0;
  await page.route('**/api/rooms', (route) => {
    attempts++;
    return fulfillMuseum(route, attempts === 1 ? { success: false, data: null, message: 'Service unavailable' } : envelope(roomSummaries), attempts === 1 ? 503 : 200);
  });
  await page.goto('/tour');
  await expect(page.getByRole('alert')).toContainText('Không tải được danh sách phòng');
  expect(attempts).toBe(1);
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test('invalid selection and detail 404 preserve room selection without stale content', async ({ page }) => {
  const requests = await installMuseumApi(page);
  await page.goto('/tour?room=not-a-room');
  await expect(page.getByRole('alert')).toContainText('Phòng được chọn không có trong danh sách công khai');
  expect(requests.filter((path) => path !== '/api/rooms')).toHaveLength(0);
  await page.route('**/api/rooms/ceramics', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Không tìm thấy phòng trưng bày' }, 404));
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy phòng trưng bày');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('listitem')).toHaveCount(0);
});

test('invalid API payload or wrong room identity fails before scene rendering', async ({ page }) => {
  await installMuseumApi(page);
  for (const data of [
    { success: false, data: roomA, message: null },
    envelope({ ...roomA, exhibits: [{ ...roomA.exhibits[0], positionX: 'bad' }] }),
    envelope(roomB),
    envelope({ ...roomA, id: roomB.id, exhibits: [] }),
  ]) {
    await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, data));
    await page.goto('/tour');
    await expect(page.getByRole('alert')).toContainText('Dữ liệu phòng không hợp lệ');
    await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toHaveCount(0);
    await expect(page.getByRole('listitem')).toHaveCount(0);
  }
});

test('out-of-room exhibits stay readable and explicitly identify unavailable 3D placement', async ({ page }) => {
  await installMuseumApi(page);
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [{ ...roomA.exhibits[0], name: 'Hiện vật ngoài phòng', positionX: 20 }],
  })));
  await page.goto('/tour');
  await expect(page.getByText('Hiện vật này nằm ngoài phạm vi phòng 3D. Bạn có thể đọc thông tin tại đây.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hiện vật ngoài phòng' })).toBeVisible();
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
