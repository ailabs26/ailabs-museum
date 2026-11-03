import { selectMuseumExhibit } from './fixtures/museumUi';
import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA, roomB } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('[F02] panel link follows selected exhibit and navigates to readable 2D detail', async ({ page }) => {
  await page.goto('/tour?room=sculpture');
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
  const link = page.getByRole('link', { name: 'Đọc chi tiết 2D', exact: true });
  await expect(link).toHaveAttribute('href', `/collection/sculpture/exhibits/${roomA.exhibits[1].id}`);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 3');
  await expect(link).toHaveAttribute('href', `/collection/sculpture/exhibits/${roomA.exhibits[2].id}`);
  await page.getByLabel('Chọn phòng trưng bày').selectOption('ceramics');
  await expect(link).toHaveCount(0);
  await selectMuseumExhibit(page, 'Xem chi tiết Bình gốm');
  await expect(link).toHaveAttribute('href', `/collection/ceramics/exhibits/${roomB.exhibits[0].id}`);
  await link.focus();
  await link.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bình gốm');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.locator('canvas')).toHaveCount(0);
});

for (const failure of ['webgl', 'context', 'chunk']) {
  for (const selected of [false, true]) {
    test(`[F03] ${failure} failure offers contextual 2D link with selection=${selected}`, async ({ page }) => {
      if (failure === 'webgl') await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
          if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
          return Reflect.apply(getContext, this, [type, ...args]);
        } as typeof getContext;
      });
      if (failure === 'chunk') await page.route('**/*MuseumScene*', (route) => route.abort());
      await page.goto('/tour?room=sculpture');
      if (selected) await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 2');
      await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
      if (failure === 'context') {
        const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
        await expect(canvas).toBeVisible();
        await canvas.evaluate((element: HTMLCanvasElement) => {
          const extension = element.getContext('webgl2')?.getExtension('WEBGL_lose_context');
          if (!extension) throw new Error('WebGL context-loss extension required');
          extension.loseContext();
        });
      }
      if (failure === 'context') await expect(page.getByText('Đang khôi phục không gian 3D. Bạn có thể tiếp tục đọc danh mục.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible({ timeout: failure === 'context' ? 12_000 : 5000 });
      await expect(page).toHaveURL(selected
        ? `/tour?room=sculpture&exhibit=${roomA.exhibits[1].id}`
        : '/tour?room=sculpture');
      const link = page.getByRole('link', { name: 'Tiếp tục đọc trong giao diện 2D', exact: true });
      await expect(link).toHaveAttribute('href', selected
        ? `/collection/sculpture/exhibits/${roomA.exhibits[1].id}` : '/collection?room=sculpture');
      await expect(page.getByRole('list', { name: 'Các hiện vật' }).getByRole('listitem')).toHaveCount(5);
      await expect(page.getByRole('link', { name: 'Đọc nội dung phòng trưng bày' })).toHaveAttribute('href', '#museum-catalogue');
      // The fallback follows subsequent DOM selection too, including an ErrorBoundary's fallback.
      await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 3');
      await expect(link).toHaveAttribute('href', `/collection/sculpture/exhibits/${roomA.exhibits[2].id}`);
      await page.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
      await expect(link).toHaveAttribute('href', '/collection?room=sculpture');
    });
  }
}

test('[F04] missing WebGL cancels pending models and focuses collection after deliberate navigation', async ({ page }) => {
  const checksum = 'a'.repeat(64);
  const item = roomA.exhibits[0];
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{
    ...item, model: { id: item.id, checksumSha256: checksum, storageKey: 'models/test.glb', sizeBytes: 100,
      url: `/rooms/sculpture/exhibits/${item.id}/model?version=${checksum}` },
  }] })));
  let pending = 0;
  const aborted: string[] = [];
  page.on('requestfailed', (request) => { if (request.url().includes('/model?')) aborted.push(request.url()); });
  await page.route('**/api/rooms/sculpture/exhibits/*/model?*', () => { pending++; });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto('/tour?room=sculpture');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  const status = page.getByRole('status').filter({ has: page.getByRole('heading', { name: 'Không thể mở không gian 3D' }) });
  await expect(status).toBeFocused();
  // The scene owner must unmount, including the non-Canvas loading/controls UI.
  await expect(page.getByLabel('Điều khiển góc nhìn')).toHaveCount(0);
  await expect.poll(() => pending === 0 || aborted.length === pending).toBe(true);
  const link = page.getByRole('link', { name: 'Tiếp tục đọc trong giao diện 2D', exact: true });
  await link.focus();
  await link.press('Enter');
  await expect(page).toHaveURL(/\/collection\?room=sculpture$/);
  await expect(page.getByRole('heading', { name: 'Bộ sưu tập', level: 1, exact: true })).toBeFocused();
  await expect(page.getByRole('group', { name: 'Chọn phòng trưng bày' })
    .getByRole('button', { name: roomA.name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Mở phòng 3D', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('[F04] unrecovered context retains selection and releases in-flight GLBs after the bounded recovery deadline', async ({ page }) => {
  const item = roomA.exhibits[0];
  const checksum = 'b'.repeat(64);
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{
    ...item, model: { id: item.id, checksumSha256: checksum, storageKey: 'models/test.glb', sizeBytes: 100,
      url: `/rooms/sculpture/exhibits/${item.id}/model?version=${checksum}` },
  }] })));
  let pending = 0;
  const aborted: string[] = [];
  page.on('requestfailed', (request) => { if (request.url().includes('/model?')) aborted.push(request.url()); });
  await page.route('**/api/rooms/sculpture/exhibits/*/model?*', () => { pending++; });
  await page.goto('/tour?room=sculpture');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  // Software WebGL startup can exceed the default assertion timeout.
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => pending).toBe(1);
  await selectMuseumExhibit(page, 'Xem chi tiết Hiện vật 1');
  await canvas.evaluate((element: HTMLCanvasElement) => {
    const extension = element.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context-loss extension required');
    extension.loseContext();
  });
  await expect(page.getByText('Đang khôi phục không gian 3D. Bạn có thể tiếp tục đọc danh mục.')).toBeVisible();
  expect(aborted).toHaveLength(0);
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible({ timeout: 12_000 });
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect.poll(() => aborted.length).toBe(1);
  const link = page.getByRole('link', { name: 'Tiếp tục đọc trong giao diện 2D', exact: true });
  await expect(link).toHaveAttribute('href', `/collection/sculpture/exhibits/${item.id}`);
  await link.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.name);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('[F04] fallback text and links reflow in light/dark and remain usable after API refresh failure', async ({ page }) => {
  await page.route('**/*MuseumScene*', (route) => route.abort());
  await page.goto('/tour?room=sculpture');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('link', { name: 'Tiếp tục đọc trong giao diện 2D' })).toBeVisible();
    }
  }
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, { success: false, data: null, message: 'Unavailable' }, 503));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tiếp tục đọc trong giao diện 2D' })).toHaveCount(0);
  await page.unroute('**/api/rooms/sculpture');
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Tiếp tục đọc trong giao diện 2D' })).toHaveAttribute('href', '/collection?room=sculpture');
});
