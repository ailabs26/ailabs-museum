import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomB, roomC, roomSummaries } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('the collection banner introduces the room and the shared gallery', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const modelRequests: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (/\/MuseumScene[.-]/.test(pathname) || /\.glb$/i.test(pathname)) modelRequests.push(request.url());
  });
  await page.goto('/collection');
  const main = page.getByRole('main');
  const title = main.getByRole('heading', { level: 1 });
  await expect(title).toHaveText('Bộ sưu tập');
  const banner = main.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) });
  await expect(banner).toHaveCSS('background-color', 'rgb(23, 34, 31)');
  expect((await banner.boundingBox())!.height).toBeGreaterThanOrEqual(240);

  const room = main.getByRole('region', { name: roomA.name, exact: true });
  const gallery = main.getByRole('region', { name: 'Hiện vật trong bộ sưu tập', exact: true });
  await expect(room.getByText(roomA.description)).toBeVisible();
  await expect(room.getByText('5 hiện vật đã xuất bản')).toBeVisible();
  await expect(room.getByRole('link', { name: 'Tham quan phòng này trong 3D' })).toHaveAttribute('href', '/tour?room=sculpture');
  await expect(gallery.getByRole('heading', { level: 3 })).toHaveText(roomA.exhibits.map(({ name }) => name));
  expect((await room.boundingBox())!.x).toBeLessThan((await gallery.boundingBox())!.x);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(modelRequests).toEqual([]);
});

test('a long room list stays on one scrollable row and keyboard selection keeps the URL', async ({ page }) => {
  const moreRooms = Array.from({ length: 10 }, (_, index) => ({
    ...roomSummaries[0],
    id: `00000000-0000-4000-8000-${String(10 + index).padStart(12, '0')}`,
    slug: `gallery-${index}`,
    name: `Phòng trưng bày chuyên đề ${index}`,
  }));
  await page.route('**/api/rooms', (route) => fulfillMuseum(route, envelope([roomSummaries[0], ...moreRooms, roomSummaries[2]])));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/collection?source=home&room=sculpture');
  const rooms = page.getByRole('group', { name: 'Chọn phòng trưng bày' });
  await expect(rooms.getByRole('button')).toHaveCount(12);
  const first = rooms.getByRole('button').first();
  const last = rooms.getByRole('button', { name: roomC.name, exact: true });
  expect((await first.boundingBox())!.y).toBe((await last.boundingBox())!.y);
  await rooms.getByRole('button').nth(10).focus();
  await page.keyboard.press('Tab');
  await expect(last).toBeFocused();
  expect(await rooms.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/source=home&room=empty$/);
  await expect(last).toHaveAttribute('aria-pressed', 'true');
  const room = page.getByRole('region', { name: roomC.name, exact: true });
  await expect(room.getByText('0 hiện vật đã xuất bản')).toBeVisible();
  await expect(room.getByRole('button').first()).toBeDisabled();
  await expect(room.getByRole('link')).toHaveAttribute('href', '/tour?room=empty');
});

test('clearing search restores the gallery and returns focus to the input', async ({ page }) => {
  await page.goto('/collection');
  const search = page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' });
  const clear = page.getByRole('button', { name: 'Xóa tìm kiếm' });
  await expect(clear).toHaveCount(0);
  await search.fill('Bình gốm');
  await expect(page.getByRole('list', { name: 'Kết quả ở các phòng khác' }).getByRole('link')).toHaveCount(1);
  await expect(page.getByText('0/5 hiện vật khớp tìm kiếm')).toBeVisible();
  await expect(clear).toBeVisible();
  await clear.focus();
  await page.keyboard.press('Enter');
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(clear).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
});

test('cross-room results lead even when the current room has no exhibits', async ({ page }) => {
  await page.goto('/collection?room=empty');
  await page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' }).fill('Bình gốm');
  await expect(page.getByRole('list', { name: 'Kết quả ở các phòng khác' }).getByRole('link')).toHaveCount(1);
  const remote = await page.getByRole('heading', { name: 'Ở các phòng khác' }).boundingBox();
  const room = await page.getByRole('heading', { name: roomC.name, level: 2 }).boundingBox();
  expect(remote!.y).toBeLessThan(room!.y);
});

test('moving cross-room results preserves the 300ms debounce', async ({ page }) => {
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: roomA.name, level: 2 })).toBeVisible();
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  const search = page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' });
  await search.fill('Bình gốm');
  const heading = page.getByRole('heading', { name: 'Ở các phòng khác' });
  await page.clock.runFor(299);
  await expect(heading).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(heading).toBeVisible();
  await page.clock.resume();
  await expect(page.getByRole('list', { name: 'Kết quả ở các phòng khác' }).getByRole('link')).toHaveCount(1);
});

test('opening an exhibit from Home and Collection keeps the selected room on return', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Xem Danh mục Bộ sưu tập' }).click();
  await page.getByRole('button', { name: roomB.name, exact: true }).click();
  await expect(page).toHaveURL(/\/collection\?room=ceramics$/);
  await page.getByRole('textbox', { name: 'Tìm kiếm hiện vật' }).fill(roomB.exhibits[0].name);
  await page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('link', { name: /Xem chi tiết/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: roomB.exhibits[0].name })).toBeVisible();
  await page.getByRole('link', { name: 'Quay lại bộ sưu tập của phòng này' }).click();
  await expect(page).toHaveURL(/\/collection\?room=ceramics$/);
  await expect(page.getByRole('button', { name: roomB.name, exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('the gallery uses its own width across all supported viewports and themes', async ({ page }) => {
  await page.goto('/collection');
  const gallery = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' });
  await expect(gallery.getByRole('listitem')).toHaveCount(5);
  for (const scheme of ['light', 'dark']) {
    await page.locator('html').evaluate((html, theme) => html.setAttribute('data-mantine-color-scheme', theme), scheme);
    for (const width of [320, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const grid = await gallery.evaluate((node) => ({
        width: node.getBoundingClientRect().width,
        count: getComputedStyle(node).gridTemplateColumns.split(' ').length,
        documentWidth: document.documentElement.scrollWidth,
      }));
      expect(grid.documentWidth, `${scheme} ${width}px`).toBeLessThanOrEqual(width);
      expect(grid.count, `gallery width ${grid.width}px`).toBe(grid.width >= 800 ? 3 : grid.width >= 524 ? 2 : 1);
      const room = await page.getByRole('heading', { name: roomA.name, level: 2 }).boundingBox();
      const items = await gallery.boundingBox();
      if (width < 1024) expect(room!.y).toBeLessThan(items!.y);
    }
  }
});
