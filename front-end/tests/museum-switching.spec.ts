import { expect, test } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './fixtures/museumApi';
import { envelope, roomA, roomB, roomSummaries } from './fixtures/museumContent';

test('list and detail loading do not render sample or previous-room content', async ({ page }) => {
  await installMuseumApi(page);
  let releaseList!: () => void;
  const waitList = new Promise<void>((resolve) => { releaseList = resolve; });
  let releaseDetail!: () => void;
  const waitDetail = new Promise<void>((resolve) => { releaseDetail = resolve; });
  await page.route('**/api/rooms', async (route) => { await waitList; await fulfillMuseum(route, envelope(roomSummaries)); });
  await page.route('**/api/rooms/sculpture', async (route) => { await waitDetail; await fulfillMuseum(route, envelope(roomA)); });
  await page.goto('/tour');
  await expect(page.getByRole('status')).toContainText('Đang tải danh sách phòng');
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toHaveCount(0);
  releaseList();
  await expect(page.getByRole('status')).toContainText('Đang tải phòng trưng bày');
  await expect(page.getByRole('listitem')).toHaveCount(0);
  releaseDetail();
  await expect(page.getByRole('listitem')).toHaveCount(5);
});

test('rapid switching cancels the obsolete request and late data cannot replace current room', async ({ page }) => {
  await installMuseumApi(page);
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  let started = false;
  let wasCancelled = false;
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname === '/api/rooms/ceramics') wasCancelled = true;
  });
  await page.route('**/api/rooms/ceramics', async (route) => { started = true; await delayed; await fulfillMuseum(route, envelope(roomB)); });
  await page.goto('/tour');
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect.poll(() => started).toBe(true);
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByLabel('Chọn phòng trưng bày').selectOption('empty');
  await expect.poll(() => wasCancelled).toBe(true);
  await expect(page.getByRole('heading', { name: 'Phòng mới', exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('heading', { name: 'Phòng mới', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bình gốm' })).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('leaving the page aborts active detail requests', async ({ page }) => {
  await installMuseumApi(page);
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  let started = false;
  let wasCancelled = false;
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname === '/api/rooms/ceramics') wasCancelled = true;
  });
  await page.route('**/api/rooms/ceramics', async (route) => { started = true; await delayed; await fulfillMuseum(route, envelope(roomB)); });
  await page.goto('/tour?room=ceramics');
  await expect.poll(() => started).toBe(true);
  await page.getByRole('link', { name: 'Aura Museum' }).click();
  await expect.poll(() => wasCancelled).toBe(true);
  release();
  await expect(page.getByRole('heading', { name: 'Bảo tàng WebXR Aura' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('failed refresh hides cached detail and allows manual recovery', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/tour');
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Server unavailable' }, 503));
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được phòng trưng bày');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, name: 'Phòng cập nhật' })));
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { name: 'Phòng cập nhật', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('refresh removes a room that is no longer public without retaining its content', async ({ page }) => {
  await installMuseumApi(page);
  await page.goto('/tour?room=ceramics');
  await expect(page.getByRole('heading', { name: 'Bình gốm' })).toBeVisible();
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([roomSummaries[0]])));
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(page.getByRole('alert')).toContainText('Phòng được chọn không có trong danh sách công khai');
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('room slugs are URL-encoded and never become query or path instructions', async ({ page }) => {
  await installMuseumApi(page);
  const slug = 'gốm / 01?name=test';
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([{ ...roomSummaries[1], slug }])));
  let requestedPath = '';
  await page.route('**/api/rooms/**', async (route) => {
    requestedPath = new URL(route.request().url()).pathname;
    await fulfillMuseum(route, envelope({ ...roomB, slug }));
  });
  await page.goto('/tour');
  await expect(page.getByRole('heading', { name: 'Bình gốm' })).toBeVisible();
  expect(requestedPath).toBe('/api/rooms/g%E1%BB%91m%20%2F%2001%3Fname%3Dtest');
});
