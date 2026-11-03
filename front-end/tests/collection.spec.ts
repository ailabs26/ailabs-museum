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
  const rooms = page.getByRole('group', { name: 'Chọn phòng trưng bày' });
  const sculpture = rooms.getByRole('button', { name: roomA.name, exact: true });
  const ceramics = rooms.getByRole('button', { name: roomB.name, exact: true });
  await expect(sculpture).toHaveAttribute('aria-pressed', 'true');
  await expect(ceramics).toHaveAttribute('aria-pressed', 'false');
  await ceramics.click();
  await expect(page).toHaveURL(/source=home&room=ceramics$/);
  await expect(ceramics).toHaveAttribute('aria-pressed', 'true');
  await expect(sculpture).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('heading', { name: roomB.name, exact: true, level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bình gốm', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(rooms.getByRole('button', { name: roomB.name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: 'Tham quan phòng này trong 3D', exact: true })).toHaveAttribute('href', '/tour?room=ceramics');
});

test('browser back and forward restore the selected room pill and cards', async ({ page }) => {
  await page.goto('/collection?source=home&room=sculpture');
  const rooms = page.getByRole('group', { name: 'Chọn phòng trưng bày' });
  const sculpture = rooms.getByRole('button', { name: roomA.name, exact: true });
  const ceramics = rooms.getByRole('button', { name: roomB.name, exact: true });
  await ceramics.click();
  await expect(page).toHaveURL(/source=home&room=ceramics$/);
  await page.goBack();
  await expect(page).toHaveURL(/source=home&room=sculpture$/);
  await expect(sculpture).toHaveAttribute('aria-pressed', 'true');
  await expect(ceramics).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('heading', { name: roomA.exhibits[0].name, exact: true })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/source=home&room=ceramics$/);
  await expect(ceramics).toHaveAttribute('aria-pressed', 'true');
  await expect(sculpture).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('heading', { name: roomB.exhibits[0].name, exact: true })).toBeVisible();
});

test('room and exhibit loading states remain readable until responses arrive', async ({ page }) => {
  let releaseList!: () => void;
  let releaseDetail!: () => void;
  const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
  const detailGate = new Promise<void>((resolve) => { releaseDetail = resolve; });
  await page.route('**/api/rooms', async (route) => { await listGate; await fulfillMuseum(route, envelope(roomSummaries)); });
  await page.route('**/api/rooms/sculpture', async (route) => { await detailGate; await fulfillMuseum(route, envelope(roomA)); });
  await page.goto('/collection');
  await expect(page.locator('ul[aria-hidden="true"]')).toBeVisible();
  const loadingStatus = page.getByRole('status', { name: 'Trạng thái tải bộ sưu tập' });
  await expect(loadingStatus).toHaveCount(1);
  await expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
  await expect(loadingStatus).toHaveAttribute('aria-atomic', 'true');
  await expect(loadingStatus).toBeVisible();
  expect(await loadingStatus.boundingBox()).toMatchObject({ width: 1, height: 1 });
  await expect(loadingStatus).toHaveCSS('overflow', 'hidden');
  expect(await loadingStatus.evaluate((node) => node.closest('[aria-hidden="true"], [hidden]') === null)).toBe(true);
  const initialRegion = await loadingStatus.elementHandle();
  await expect(loadingStatus).toHaveText('Đang tải danh sách phòng trưng bày…');
  releaseList();
  await expect(loadingStatus).toHaveText(`Đang tải hiện vật của phòng ${roomA.name}…`);
  expect(await loadingStatus.evaluate((node, original) => node === original, initialRegion)).toBe(true);
  await expect(page.locator('ul[aria-hidden="true"]')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  releaseDetail();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
  await expect(loadingStatus).toHaveCount(1);
  await expect(loadingStatus).toBeEmpty();
  expect(await loadingStatus.evaluate((node, original) => node === original, initialRegion)).toBe(true);
  await expect(page.locator('ul[aria-hidden="true"]')).toHaveCount(0);
});

test('search filters names and descriptions locally, reports counts, clears and resets on room change', async ({ page }) => {
  const namedExhibits = roomA.exhibits.map((item, index) => index === 0
    ? { ...item, name: 'Tượng Đồng', description: 'Hoa văn cổ đại' } : item);
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: namedExhibits })));
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/rooms')) requests.push(new URL(request.url()).pathname);
  });
  await page.goto('/collection');
  const input = page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' });
  const cards = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem');
  await expect(cards).toHaveCount(5);
  const initialRequests = [...requests];

  await input.fill('  TƯỢNG ĐỒNG  ');
  await expect(page.getByText('1/5 hiện vật khớp tìm kiếm')).toBeVisible();
  await expect(cards).toHaveCount(1);
  await expect(cards.getByRole('heading', { name: 'Tượng Đồng' })).toBeVisible();
  await input.fill('  HOA VĂN CỔ  ');
  await expect(page.getByText('1/5 hiện vật khớp tìm kiếm')).toBeVisible();
  await expect(cards.getByRole('heading', { name: 'Tượng Đồng' })).toBeVisible();
  await input.fill('geen match');
  await expect(page.getByRole('status').filter({ hasText: 'Không có hiện vật nào khớp' })).toBeVisible();
  await expect(page.getByText('0/5 hiện vật khớp tìm kiếm')).toBeVisible();
  await input.fill('');
  await expect(cards).toHaveCount(5);
  await expect(page.getByText('5 hiện vật đã xuất bản')).toBeVisible();
  await input.fill('tượng');
  await page.getByRole('group', { name: 'Chọn phòng trưng bày' })
    .getByRole('button', { name: roomB.name, exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(page.getByRole('heading', { name: roomB.exhibits[0].name, exact: true })).toBeVisible();
  await expect(page.getByText('1 hiện vật đã xuất bản')).toBeVisible();
  expect(requests.filter((path) => path === '/api/rooms/sculpture').length).toBe(1);
  expect(requests.filter((path) => path === '/api/rooms/ceramics').length).toBe(1);
  expect(requests).toEqual([...initialRequests, '/api/rooms/ceramics']);
});

test('empty public rooms and empty exhibit collections have distinct states', async ({ page }) => {
  const loadingStatus = page.getByRole('status', { name: 'Trạng thái tải bộ sưu tập' });
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([])));
  await page.goto('/collection');
  await expect(page.getByRole('status').filter({ hasText: 'Chưa có phòng trưng bày công khai.' })).toBeVisible();
  await expect(loadingStatus).toBeEmpty();
  await expect(page.getByRole('link', { name: 'Tham quan phòng này trong 3D' })).toHaveCount(0);
  await page.unroute('**/api/rooms');
  await page.goto('/collection?room=empty');
  await expect(page.getByRole('status').filter({ hasText: 'Phòng này chưa có hiện vật được xuất bản.' })).toBeVisible();
  await expect(loadingStatus).toBeEmpty();
  await expect(page.getByText('0 hiện vật đã xuất bản')).toBeVisible();
});

test('list API errors and malformed detail responses can be retried without demo substitution', async ({ page }) => {
  let failList = true;
  let releaseList!: () => void;
  const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
  await page.route('**/api/rooms', async (route) => {
    if (failList) await listGate;
    await fulfillMuseum(route,
      failList ? { success: false, data: null, message: 'Unavailable' } : envelope(roomSummaries), failList ? 503 : 200);
  });
  await page.goto('/collection');
  const loadingStatus = page.getByRole('status', { name: 'Trạng thái tải bộ sưu tập' });
  await expect(loadingStatus).toHaveText('Đang tải danh sách phòng trưng bày…');
  releaseList();
  await expect(page.getByRole('alert')).toContainText('Không tải được danh sách phòng');
  await expect(loadingStatus).toBeEmpty();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  failList = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{ ...roomA.exhibits[0], name: 42 }] })));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được hiện vật');
  await expect(page.getByRole('alert')).toContainText('Dữ liệu phòng không hợp lệ');
  await expect(loadingStatus).toBeEmpty();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  await page.unroute('**/api/rooms/sculpture');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
  await expect(loadingStatus).toBeEmpty();
});

test('malformed room lists clear the loading status and recover on retry', async ({ page }) => {
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([{ ...roomSummaries[0], name: 42 }])));
  await page.goto('/collection');
  await expect(page.getByRole('alert')).toContainText('Không tải được danh sách phòng');
  const loadingStatus = page.getByRole('status', { name: 'Trạng thái tải bộ sưu tập' });
  await expect(loadingStatus).toBeEmpty();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  await page.unroute('**/api/rooms');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
  await expect(loadingStatus).toBeEmpty();
});

test('invalid URL selection fetches no unknown room and lets visitors select a public room', async ({ page }) => {
  const paths: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/api/rooms/')) paths.push(new URL(request.url()).pathname); });
  await page.goto('/collection?room=unknown');
  await expect(page.getByRole('alert')).toContainText('Phòng được chọn không có trong danh sách công khai');
  await expect(page.getByRole('status', { name: 'Trạng thái tải bộ sưu tập' })).toBeEmpty();
  expect(paths).toEqual([]);
  await page.getByRole('group', { name: 'Chọn phòng trưng bày' })
    .getByRole('button', { name: roomB.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bình gốm', exact: true })).toBeVisible();
});

test('detail HTTP errors and failed list refresh hide previous content until retry succeeds', async ({ page }) => {
  let releaseDetail!: () => void;
  const detailGate = new Promise<void>((resolve) => { releaseDetail = resolve; });
  await page.route('**/api/rooms/sculpture', async (route) => {
    await detailGate;
    await fulfillMuseum(route, { success: false, data: null, message: 'Phòng không còn khả dụng' }, 404);
  });
  await page.goto('/collection');
  const loadingStatus = page.getByRole('status', { name: 'Trạng thái tải bộ sưu tập' });
  await expect(loadingStatus).toHaveText(`Đang tải hiện vật của phòng ${roomA.name}…`);
  releaseDetail();
  await expect(page.getByRole('alert')).toContainText('Không tải được hiện vật');
  await expect(loadingStatus).toBeEmpty();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  await page.unroute('**/api/rooms/sculpture');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Unavailable' }, 503));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được danh sách phòng');
  await expect(loadingStatus).toBeEmpty();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })).toHaveCount(0);
  await page.unroute('**/api/rooms');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
  await expect(loadingStatus).toBeEmpty();
});

test('background refresh and local search do not repeat initial loading announcements or steal focus', async ({ page }) => {
  await page.goto('/collection');
  const cards = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem');
  await expect(cards).toHaveCount(5);
  const loadingStatus = page.getByRole('status', { name: 'Trạng thái tải bộ sưu tập' });
  await expect(loadingStatus).toBeEmpty();
  const messages = await loadingStatus.evaluateHandle((node) => {
    const changes: string[] = [];
    new MutationObserver(() => changes.push(node.textContent ?? ''))
      .observe(node, { childList: true, characterData: true, subtree: true });
    return changes;
  });
  let releaseList!: () => void;
  let releaseDetail!: () => void;
  const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
  const detailGate = new Promise<void>((resolve) => { releaseDetail = resolve; });
  await page.route('**/api/rooms', async (route) => { await listGate; await fulfillMuseum(route, envelope(roomSummaries)); });
  await page.route('**/api/rooms/sculpture', async (route) => { await detailGate; await fulfillMuseum(route, envelope(roomA)); });
  await Promise.all([
    page.waitForRequest('**/api/rooms'),
    page.waitForRequest('**/api/rooms/sculpture'),
    page.getByRole('button', { name: 'Làm mới', exact: true }).click(),
  ]);
  const updatingStatus = page.getByRole('status').filter({ hasText: 'Đang cập nhật hiện vật…' });
  await expect(updatingStatus).toHaveCount(1);
  await expect(loadingStatus).toHaveCount(1);
  await expect(page.getByRole('status', { name: 'Trạng thái so sánh' })).toBeEmpty();
  await expect(loadingStatus).toBeEmpty();
  await expect(cards).toHaveCount(5);
  const search = page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' });
  await search.focus();
  const listResponse = page.waitForResponse('**/api/rooms');
  releaseList();
  await listResponse;
  await expect(loadingStatus).toBeEmpty();
  await expect(updatingStatus).toHaveCount(1);
  releaseDetail();
  await expect(updatingStatus).toHaveCount(0);
  await expect(search).toBeFocused();
  await search.fill('geen match');
  await expect(page.getByRole('status').filter({ hasText: 'Không có hiện vật nào khớp' })).toBeVisible();
  await expect(loadingStatus).toBeEmpty();
  expect(await messages.jsonValue()).toEqual([]);
});

test('switching rooms hides old cards while the new room loads', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/rooms/ceramics', async (route) => { await gate; await fulfillMuseum(route, envelope(roomB)); });
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toBeVisible();
  const loadingStatus = page.getByRole('status', { name: 'Trạng thái tải bộ sưu tập' });
  await expect(loadingStatus).toHaveCount(1);
  await expect(loadingStatus).toBeEmpty();
  const initialRegion = await loadingStatus.elementHandle();
  const rooms = page.getByRole('group', { name: 'Chọn phòng trưng bày' });
  const sculpture = rooms.getByRole('button', { name: roomA.name, exact: true });
  const ceramics = rooms.getByRole('button', { name: roomB.name, exact: true });
  await ceramics.click();
  await expect(ceramics).toHaveAttribute('aria-pressed', 'true');
  await expect(sculpture).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('ul[aria-hidden="true"]')).toBeVisible();
  await expect(loadingStatus).toHaveText(`Đang tải hiện vật của phòng ${roomB.name}…`);
  await expect(ceramics).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Hiện vật 1', exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole('heading', { name: 'Bình gốm', exact: true })).toBeVisible();
  await expect(loadingStatus).toBeEmpty();
  expect(await loadingStatus.evaluate((node, original) => node === original, initialRegion)).toBe(true);
  await expect(ceramics).toBeFocused();
});

test('room pills support Tab, Enter and Space and the tour link keeps the selected room', async ({ page }) => {
  await page.goto('/collection');
  const rooms = page.getByRole('group', { name: 'Chọn phòng trưng bày' });
  const sculpture = rooms.getByRole('button', { name: roomA.name, exact: true });
  const ceramics = rooms.getByRole('button', { name: roomB.name, exact: true });
  await sculpture.focus();
  await page.keyboard.press('Tab');
  await expect(ceramics).toBeFocused();
  expect(await ceramics.evaluate((button) => button.matches(':focus-visible'))).toBe(true);
  await expect(ceramics).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(ceramics).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Shift+Tab');
  await expect(sculpture).toBeFocused();
  await page.keyboard.press('Space');
  await expect(sculpture).toHaveAttribute('aria-pressed', 'true');
  const tourLink = page.getByRole('link', { name: 'Tham quan phòng này trong 3D', exact: true });
  await tourLink.focus();
  await tourLink.press('Enter');
  await expect(page).toHaveURL(/\/tour\?room=sculpture$/);
  await expect(page.getByRole('heading', { name: roomA.name, exact: true, level: 1 })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('collection remains responsive in light and dark with long API content', async ({ page }) => {
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [{ ...roomA.exhibits[0], name: 'Tên hiện vật dài '.repeat(10), description: 'Mô tả tiếng Việt dài '.repeat(40) }],
  })));
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/collection');
      await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('group', { name: 'Chọn phòng trưng bày' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Tham quan phòng này trong 3D' })).toBeVisible();
    }
  }
});
