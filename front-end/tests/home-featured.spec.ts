import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomSummaries } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('homepage shows the first three ordered public exhibits and links to their collection without loading 3D', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [...roomA.exhibits].reverse().map((item) => ({ ...item, displayOrder: 1 })),
  })));
  await page.goto('/');
  const featured = page.getByRole('region', { name: 'Hiện vật nổi bật' });
  await expect(featured.getByRole('listitem')).toHaveCount(3);
  await expect(featured.getByRole('heading', { level: 3 })).toHaveText(roomA.exhibits.slice(0, 3).map((item) => item.name));
  await expect(featured.getByText('Chưa có ảnh', { exact: true })).toHaveCount(3);
  await expect(featured.getByText(roomA.name, { exact: true })).toBeVisible();
  const link = featured.getByRole('link', { name: 'Xem bộ sưu tập của phòng này', exact: true });
  await expect(link).toHaveAttribute('href', '/collection?room=sculpture');
  expect(requests.filter((url) => url.includes('/api/rooms/ceramics'))).toEqual([]);
  expect(requests.filter((url) => url.includes('/components/MuseumScene'))).toEqual([]);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByText(/tại trang Bộ sưu tập/)).toBeVisible();
  await link.focus();
  await link.press('Enter');
  await expect(page).toHaveURL(/\/collection\?room=sculpture$/);
  await expect(page.getByRole('listitem')).toHaveCount(5);
});

test('homepage displays only available items and never searches another room to fill three slots', async ({ page }) => {
  for (const count of [0, 1, 2]) {
    await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: roomA.exhibits.slice(0, count) })));
    const paths: string[] = [];
    const capture = (request: { url(): string }) => { if (request.url().includes('/api/rooms/')) paths.push(new URL(request.url()).pathname); };
    page.on('request', capture);
    await page.goto('/');
    const featured = page.getByRole('region', { name: 'Hiện vật nổi bật' });
    await expect(featured.getByRole('listitem')).toHaveCount(count);
    await expect(featured.getByRole('link', { name: 'Xem bộ sưu tập của phòng này' })).toBeVisible();
    if (count === 0) await expect(featured.getByRole('status')).toHaveText('Phòng này chưa có hiện vật được xuất bản.');
    else await expect(featured.getByRole('heading', { level: 3 })).toHaveText(roomA.exhibits.slice(0, count).map((item) => item.name));
    expect(paths.every((path) => path === '/api/rooms/sculpture')).toBe(true);
    page.off('request', capture);
    await page.unroute('**/api/rooms/sculpture');
  }
});

test('empty room list preserves the static homepage without an invented collection link', async ({ page }) => {
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([])));
  await page.goto('/');
  const featured = page.getByRole('region', { name: 'Hiện vật nổi bật' });
  await expect(featured.getByRole('status')).toHaveText('Chưa có phòng trưng bày công khai.');
  await expect(featured.getByRole('listitem')).toHaveCount(0);
  await expect(featured.getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('list and detail loading states remain readable', async ({ page }) => {
  let releaseList!: () => void;
  let releaseDetail!: () => void;
  const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
  const detailGate = new Promise<void>((resolve) => { releaseDetail = resolve; });
  await page.route('**/api/rooms', async (route) => { await listGate; await fulfillMuseum(route, envelope(roomSummaries)); });
  await page.route('**/api/rooms/sculpture', async (route) => { await detailGate; await fulfillMuseum(route, envelope(roomA)); });
  await page.goto('/');
  const featured = page.getByRole('region', { name: 'Hiện vật nổi bật' });
  await expect(featured.getByRole('status')).toHaveText('Đang tải danh sách phòng…');
  releaseList();
  await expect(featured.getByRole('status')).toHaveText('Đang tải hiện vật nổi bật…');
  releaseDetail();
  await expect(featured.getByRole('listitem')).toHaveCount(3);
});

test('list HTTP error and malformed detail response retry without sample substitution', async ({ page }) => {
  let failList = true;
  let invalidDetail = true;
  await page.route('**/api/rooms', (route) => fulfillMuseum(route,
    failList ? { success: false, data: null, message: 'Unavailable' } : envelope(roomSummaries), failList ? 503 : 200));
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: invalidDetail ? [{ ...roomA.exhibits[0], name: 42 }] : roomA.exhibits,
  })));
  await page.goto('/');
  const featured = page.getByRole('region', { name: 'Hiện vật nổi bật' });
  await expect(featured.getByRole('alert')).toContainText('Không tải được danh sách phòng');
  await expect(page.getByRole('heading', { name: 'Mỗi hiện vật, một câu chuyện.' })).toBeVisible();
  await expect(featured.getByRole('listitem')).toHaveCount(0);
  failList = false;
  await featured.getByRole('button', { name: 'Thử lại' }).click();
  await expect(featured.getByRole('alert')).toContainText('Không tải được hiện vật nổi bật');
  await expect(featured.getByRole('alert')).toContainText('Dữ liệu phòng không hợp lệ');
  invalidDetail = false;
  await featured.getByRole('button', { name: 'Thử lại' }).click();
  await expect(featured.getByRole('listitem')).toHaveCount(3);
});

test('failed refetch hides cached featured cards until retry succeeds', async ({ page }) => {
  await page.goto('/');
  const featured = page.getByRole('region', { name: 'Hiện vật nổi bật' });
  await expect(featured.getByRole('listitem')).toHaveCount(3);
  await featured.getByRole('link', { name: 'Xem bộ sưu tập của phòng này' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(5);
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Unavailable' }, 503));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('link', { name: 'Aura Museum — Trang chủ', exact: true }).click();
  await expect(featured.getByRole('listitem')).toHaveCount(0);
  await expect(featured.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/rooms/sculpture');
  await featured.getByRole('button', { name: 'Thử lại' }).click();
  await expect(featured.getByRole('listitem')).toHaveCount(3);
});

test('featured long content fits mobile and desktop in light and dark', async ({ page }) => {
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: roomA.exhibits.map((item) => ({ ...item, name: 'Tên hiện vật dài '.repeat(10), description: 'Mô tả tiếng Việt '.repeat(30) })),
  })));
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByRole('region', { name: 'Hiện vật nổi bật' }).getByRole('listitem')).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  }
});
