import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomB, roomSummaries } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('[D02] direct URL and reload show the correct public exhibit without loading a scene', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const exhibit = roomA.exhibits[1];
  await page.goto(`/collection/sculpture/exhibits/${exhibit.id}`);
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(exhibit.name);
    await expect(page.getByText(roomA.name, { exact: true })).toBeVisible();
    await expect(page.getByText(exhibit.description, { exact: true })).toBeVisible();
    await expect(page.getByText('Hình minh họa thay thế', { exact: true })).toBeVisible();
    await expect(page.locator('[data-shape]')).toHaveAttribute('data-shape', exhibit.placeholderShape);
    await expect(page.getByText('Chưa có ảnh', { exact: true })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
  }
  expect(requests.filter((url) => url.includes('/api/admin/') || url.includes('/components/MuseumScene'))).toEqual([]);
  expect(requests.filter((url) => url.includes('/api/rooms/ceramics'))).toEqual([]);
});

test('[D02] empty description has an explicit text state', async ({ page }) => {
  const exhibit = roomA.exhibits[0];
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [{ ...exhibit, description: '' }],
  })));
  await page.goto(`/collection/sculpture/exhibits/${exhibit.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(exhibit.name);
  await expect(page.getByRole('heading', { name: 'Câu chuyện hiện vật', level: 2 })).toBeVisible();
  await expect(page.getByText('Chưa có mô tả.', { exact: true })).toBeVisible();
});

test('[D02] basic guards do not substitute another room or render a missing exhibit', async ({ page }) => {
  for (const path of [
    `/collection/unknown/exhibits/${roomA.exhibits[0].id}`,
    '/collection/sculpture/exhibits/not-a-uuid',
    '/collection/sculpture/exhibits/10000000-0000-4000-8000-000000000099',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(roomA.exhibits[0].name);
    await expect(page.getByText('Hình minh họa thay thế', { exact: true })).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/không hợp lệ|Không tìm thấy/);
  }
});

test('[D03] published transcript and ordered hotspots render as plain text', async ({ page }) => {
  const item = roomA.exhibits[0];
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: [{ ...item, description: '<b>Câu chuyện</b>', transcript: '<b>Thuyết minh</b>', hotspots: [
      { id: '20000000-0000-4000-8000-000000000002', label: 'Điểm sau', body: '<img src=x onerror=alert(1)>', positionX: 0, positionY: 1, positionZ: 0, displayOrder: 1 },
      { id: '20000000-0000-4000-8000-000000000001', label: 'Điểm trước', body: 'Nội dung tiếng Việt', positionX: 0, positionY: 1, positionZ: 0, displayOrder: 1 },
    ] }],
  })));
  await page.goto(`/collection/sculpture/exhibits/${item.id}`);
  await expect(page.getByRole('heading', { name: 'Bản thuyết minh', level: 2 })).toBeVisible();
  await expect(page.getByText('<b>Thuyết minh</b>', { exact: true })).toBeVisible();
  await expect(page.getByText('<b>Câu chuyện</b>', { exact: true })).toBeVisible();
  const hotspots = page.getByRole('list', { name: 'Điểm chú ý của hiện vật' }).getByRole('listitem');
  await expect(hotspots).toHaveText(['Điểm trướcNội dung tiếng Việt', 'Điểm sau<img src=x onerror=alert(1)>']);
  await expect(page.locator('main b, main img')).toHaveCount(0);
});

test('[D03] absent or empty optional content does not create empty sections', async ({ page }) => {
  const item = roomA.exhibits[0];
  for (const transcript of [null, '']) {
    await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{ ...item, transcript, hotspots: [] }] })));
    await page.goto(`/collection/sculpture/exhibits/${item.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.name);
    await expect(page.getByRole('heading', { name: 'Bản thuyết minh' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Điểm chú ý' })).toHaveCount(0);
    await page.unroute('**/api/rooms/sculpture');
  }
});

test('[D04] HTTP and schema failures expose retry instead of not-found or stale content', async ({ page }) => {
  let failList = true;
  let badDetail = true;
  await page.route('**/api/rooms', (route) => fulfillMuseum(route,
    failList ? { success: false, data: null, message: 'Unavailable' } : envelope(roomSummaries), failList ? 503 : 200));
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({
    ...roomA, exhibits: badDetail ? [{ ...roomA.exhibits[0], name: 42 }] : roomA.exhibits,
  })));
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Không tải được nội dung');
  await expect(page.getByRole('alert')).toBeVisible();
  failList = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Dữ liệu phòng không hợp lệ');
  await expect(page.getByText('Hình minh họa thay thế')).toHaveCount(0);
  badDetail = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(roomA.exhibits[0].name);
});

test('[D04] loading guards precede not-found and invalid identity never selects another room', async ({ page }) => {
  let releaseList!: () => void;
  let releaseDetail!: () => void;
  const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
  const detailGate = new Promise<void>((resolve) => { releaseDetail = resolve; });
  await page.route('**/api/rooms', async (route) => { await listGate; await fulfillMuseum(route, envelope(roomSummaries)); });
  await page.route('**/api/rooms/sculpture', async (route) => { await detailGate; await fulfillMuseum(route, envelope(roomA)); });
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  await expect(page.getByRole('status')).toHaveText('Đang tải danh sách phòng…');
  releaseList();
  await expect(page.getByRole('status')).toHaveText('Đang tải hiện vật…');
  releaseDetail();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(roomA.exhibits[0].name);
  await page.goto(`/collection/ceramics/exhibits/${roomA.exhibits[0].id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Không tìm thấy hiện vật');
  await expect(page.getByRole('link', { name: 'Về bộ sưu tập', exact: true })).toHaveAttribute('href', '/collection');
});

test('[D04] obsolete detail response cannot replace the exhibit selected in a new URL', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/rooms/sculpture', async (route) => {
    await gate;
    await fulfillMuseum(route, envelope(roomA)).catch(() => undefined);
  });
  await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
  await expect(page.getByRole('status')).toHaveText('Đang tải hiện vật…');
  await page.evaluate((path) => {
    history.pushState(null, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, `/collection/ceramics/exhibits/${roomB.exhibits[0].id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(roomB.exhibits[0].name);
  release();
  await expect(page.getByText(roomA.exhibits[0].description, { exact: true })).toHaveCount(0);
  await page.evaluate((path) => {
    history.pushState(null, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, `/collection/ceramics/exhibits/${roomA.exhibits[0].id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Không tìm thấy hiện vật');
});

test('[D04] failed refresh hides cached detail until successful retry', async ({ page }) => {
  const path = `/collection/sculpture/exhibits/${roomA.exhibits[0].id}`;
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(roomA.exhibits[0].name);
  await page.locator('header').getByRole('link', { name: 'Bộ sưu tập', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(5);
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Unavailable' }, 503));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Không tải được nội dung');
  await expect(page.getByText('Hình minh họa thay thế')).toHaveCount(0);
  await page.unroute('**/api/rooms/sculpture');
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(roomA.exhibits[0].name);
});

test('[D05] collection and featured card links open details and return to the correct room', async ({ page }) => {
  for (const source of ['/collection?room=ceramics', '/']) {
    const item = source === '/' ? roomA.exhibits[0] : roomB.exhibits[0];
    const slug = source === '/' ? 'sculpture' : 'ceramics';
    const roomName = source === '/' ? roomA.name : roomB.name;
    await page.goto(source);
    const link = page.getByRole('link', { name: `Xem chi tiết ${item.name}`, exact: true });
    await expect(link).toHaveAttribute('href', `/collection/${slug}/exhibits/${item.id}`);
    await link.focus();
    await link.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.name);
    await page.reload();
    const back = page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này', exact: true });
    await expect(back).toHaveAttribute('href', `/collection?room=${slug}`);
    await back.click();
    await expect(page.getByRole('group', { name: 'Chọn phòng trưng bày' })
      .getByRole('button', { name: roomName, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.name);
  }
});

test('[D05] card detail URLs encode the room slug as a path segment', async ({ page }) => {
  const slug = 'phòng & gốm';
  const room = { ...roomB, slug };
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([room])));
  await page.route('**/api/rooms/**', (route) => fulfillMuseum(route, envelope(room)));
  await page.goto('/collection');
  const link = page.getByRole('link', { name: `Xem chi tiết ${room.exhibits[0].name}`, exact: true });
  await expect(link).toHaveAttribute('href', `/collection/${encodeURIComponent(slug)}/exhibits/${room.exhibits[0].id}`);
  await link.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(room.exhibits[0].name);
  await expect(page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này', exact: true })).toHaveAttribute('href', `/collection?${new URLSearchParams({ room: slug })}`);
});

test('[D06] route changes focus the destination title and error recovery focuses the exhibit', async ({ page }) => {
  await page.goto('/collection');
  const first = roomA.exhibits[0];
  const second = roomA.exhibits[1];
  await page.getByRole('link', { name: `Xem chi tiết ${first.name}`, exact: true }).press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.evaluate((path) => {
    history.pushState(null, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, `/collection/sculpture/exhibits/${second.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(second.name);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.evaluate(() => {
    history.pushState(null, '', '/collection/sculpture/exhibits/invalid');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Đường dẫn hiện vật không hợp lệ');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  let fail = true;
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route,
    fail ? { success: false, data: null, message: 'Unavailable' } : envelope(roomA), fail ? 503 : 200));
  await page.goto(`/collection/sculpture/exhibits/${first.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Không tải được nội dung');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  fail = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(first.name);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('[D06] background refresh does not steal focus from the back link', async ({ page }) => {
  const item = roomA.exhibits[0];
  await page.goto(`/collection/sculpture/exhibits/${item.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.name);
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này', exact: true }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/rooms/sculpture', async (route) => {
    await gate;
    await fulfillMuseum(route, envelope({ ...roomA, exhibits: roomA.exhibits.map((exhibit) => ({ ...exhibit, description: 'Mô tả đã cập nhật' })) }));
  });
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Đang cập nhật hiện vật…');
  // Navigate in the SPA so the same cache/request stays active.
  await page.getByRole('link', { name: `Xem chi tiết ${item.name}`, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const back = page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này', exact: true });
  await back.focus();
  release();
  await expect(page.getByText('Mô tả đã cập nhật', { exact: true })).toBeVisible();
  await expect(back).toBeFocused();
});

test('[D06] complete detail remains readable without WebGL and reflows in both color schemes', async ({ page }) => {
  test.setTimeout(60_000);
  const item = { ...roomA.exhibits[0], name: '[Mẫu] Bình nước dã chiến', description: 'Câu chuyện tiếng Việt dài '.repeat(30),
    transcript: 'Bản thuyết minh độc lập WebGL', hotspots: [
      { id: '20000000-0000-4000-8000-000000000001', label: 'Nét khắc', body: 'Chi tiết vẫn đọc được', positionX: 0, positionY: 1, positionZ: 0, displayOrder: 0 },
    ] };
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [item] })));
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  const unwanted: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/components/MuseumScene') || request.url().includes('/media/')) unwanted.push(request.url());
  });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/collection/sculpture/exhibits/${item.id}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.name);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-family', '"Times New Roman", serif');
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Câu chuyện hiện vật', 'Bản thuyết minh', 'Điểm chú ý']);
      await expect(page.getByText(item.transcript, { exact: true })).toBeVisible();
      await expect(page.getByText('Chi tiết vẫn đọc được', { exact: true })).toBeVisible();
      await expect(page.getByText('Hình minh họa thay thế', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('canvas')).toHaveCount(0);
    }
  }
  expect(unwanted).toEqual([]);
});
