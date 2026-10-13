import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomB, roomSummaries } from './fixtures/museumContent';

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

test('room and exhibit loading states remain readable until responses arrive', async ({ page }) => {
  let releaseList!: () => void;
  let releaseDetail!: () => void;
  const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
  const detailGate = new Promise<void>((resolve) => { releaseDetail = resolve; });
  await page.route('**/api/rooms', async (route) => { await listGate; await fulfillMuseum(route, envelope(roomSummaries)); });
  await page.route('**/api/rooms/sculpture', async (route) => { await detailGate; await fulfillMuseum(route, envelope(roomA)); });
  await page.goto('/collection');
  await expect(page.getByRole('status')).toHaveText('Đang tải danh sách phòng…');
  releaseList();
  await expect(page.getByRole('status')).toHaveText('Đang tải hiện vật…');
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  releaseDetail();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
});

test('empty public rooms and empty exhibit collections have distinct states', async ({ page }) => {
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([])));
  await page.goto('/collection');
  await expect(page.getByRole('status')).toHaveText('Chưa có phòng trưng bày công khai.');
  await expect(page.getByRole('link', { name: 'Tham quan phòng này trong 3D' })).toHaveCount(0);
  await page.unroute('**/api/rooms');
  await page.goto('/collection?room=empty');
  await expect(page.getByRole('status')).toHaveText('Phòng này chưa có hiện vật được xuất bản.');
  await expect(page.getByText('0 hiện vật đã xuất bản')).toBeVisible();
});

test('list API errors and malformed detail responses can be retried without demo substitution', async ({ page }) => {
  let failList = true;
  await page.route('**/api/rooms', (route) => fulfillMuseum(route,
    failList ? { success: false, data: null, message: 'Unavailable' } : envelope(roomSummaries), failList ? 503 : 200));
  await page.goto('/collection');
  await expect(page.getByRole('alert')).toContainText('Không tải được danh sách phòng');
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  failList = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{ ...roomA.exhibits[0], name: 42 }] })));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được hiện vật');
  await expect(page.getByRole('alert')).toContainText('Dữ liệu phòng không hợp lệ');
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  await page.unroute('**/api/rooms/sculpture');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
});

test('invalid URL selection fetches no unknown room and lets visitors select a public room', async ({ page }) => {
  const paths: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/api/rooms/')) paths.push(new URL(request.url()).pathname); });
  await page.goto('/collection?room=unknown');
  await expect(page.getByRole('alert')).toContainText('Phòng được chọn không có trong danh sách công khai');
  expect(paths).toEqual([]);
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page.getByRole('heading', { name: 'Bình gốm', exact: true })).toBeVisible();
});

test('detail HTTP errors and failed list refresh hide previous content until retry succeeds', async ({ page }) => {
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Phòng không còn khả dụng' }, 404));
  await page.goto('/collection');
  await expect(page.getByRole('alert')).toContainText('Không tải được hiện vật');
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  await page.unroute('**/api/rooms/sculpture');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Unavailable' }, 503));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được danh sách phòng');
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  await page.unroute('**/api/rooms');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
});

test('switching rooms hides old cards while the new room loads', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/rooms/ceramics', async (route) => { await gate; await fulfillMuseum(route, envelope(roomB)); });
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toBeVisible();
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(page.getByRole('status')).toHaveText('Đang tải hiện vật…');
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole('heading', { name: 'Bình gốm', exact: true })).toBeVisible();
});

test('keyboard selection and tour link preserve the selected room', async ({ page }) => {
  await page.goto('/collection');
  const select = page.getByLabel('Chọn phòng trưng bày');
  await expect(select).toHaveValue('sculpture');
  await select.focus();
  await select.press('ArrowDown');
  await select.press('Enter');
  await expect(select).toHaveValue('ceramics');
  const tourLink = page.getByRole('link', { name: 'Tham quan phòng này trong 3D', exact: true });
  await tourLink.focus();
  await tourLink.press('Enter');
  await expect(page).toHaveURL(/\/tour\?room=ceramics$/);
  await expect(page.getByRole('heading', { name: roomB.name, exact: true, level: 1 })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('collection remains responsive in light and dark with long API content', async ({ page }) => {
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [{ ...roomA.exhibits[0], name: 'Tên hiện vật dài '.repeat(10), description: 'Mô tả tiếng Việt dài '.repeat(40) }],
  })));
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/collection');
      await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  }
});
