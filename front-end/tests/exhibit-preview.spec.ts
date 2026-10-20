import { expect, test, type Locator } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

async function expectPreview(container: Locator, shape: string, color: string) {
  const illustration = container.locator('[data-shape]');
  await expect(illustration).toHaveAttribute('data-shape', shape === 'cube' ? 'box' : shape);
  await expect(illustration).toHaveAttribute('aria-hidden', 'true');
  expect(await illustration.evaluate((element) => getComputedStyle(element).getPropertyValue('--exhibit-color').trim())).toBe(color);
  await expect(container.getByText('Hình minh họa thay thế', { exact: true })).toBeVisible();
  await expect(container.getByText('Chưa có ảnh', { exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('collection and homepage use labelled CSS previews from API shapes and colors', async ({ page }) => {
  await page.goto('/collection');
  const cards = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem');
  await expect(cards).toHaveCount(5);
  for (const [index, exhibit] of roomA.exhibits.entries()) {
    await expectPreview(cards.nth(index), exhibit.placeholderShape, exhibit.placeholderColor);
  }
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Aura Museum — Trang chủ', exact: true }).click();
  const featured = page.getByRole('region', { name: 'Hiện vật nổi bật' }).getByRole('listitem');
  await expect(featured).toHaveCount(3);
  for (const [index, exhibit] of roomA.exhibits.slice(0, 3).entries()) {
    await expectPreview(featured.nth(index), exhibit.placeholderShape, exhibit.placeholderColor);
  }
});

test('tour catalogue and selected detail share the same box preview and preserve text and focus', async ({ page }) => {
  const exhibit = roomA.exhibits[2];
  await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route, envelope({ ...roomA, exhibits: [{
    ...exhibit, placeholderColor: '#457c79', transcript: 'Bản thuyết minh được duyệt',
    hotspots: [{ id: '20000000-0000-4000-8000-000000000001', label: 'Bề mặt', body: 'Nội dung điểm chú ý', positionX: 0, positionY: 1, positionZ: 0, displayOrder: 0 }],
  }] })));
  await page.goto('/tour');
  const card = page.getByRole('list', { name: 'Các hiện vật' }).getByRole('listitem');
  await expectPreview(card, 'box', '#457c79');
  const trigger = card.getByRole('button', { name: `Xem chi tiết ${exhibit.name}`, exact: true });
  await trigger.click();
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  await expectPreview(panel, 'box', '#457c79');
  await expect(panel.getByText(exhibit.description, { exact: true })).toBeVisible();
  await expect(panel.getByText('Bản thuyết minh được duyệt')).toBeVisible();
  await expect(panel.getByText('Nội dung điểm chú ý')).toBeVisible();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await panel.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
  await expect(trigger).toBeFocused();
});

test('previews remain available in public pages and detail when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  for (const path of ['/collection', '/']) {
    await page.goto(path);
    await expect(page.getByText('Hình minh họa thay thế', { exact: true })).toHaveCount(path === '/' ? 3 : 5);
    await expect(page.locator('canvas')).toHaveCount(0);
  }
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Không thể mở không gian 3D' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Các hiện vật' }).getByText('Hình minh họa thay thế', { exact: true })).toHaveCount(5);
  await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true }).click();
  await expectPreview(page.getByRole('complementary', { name: 'Chi tiết hiện vật' }), 'sphere', roomA.exhibits[1].placeholderColor);
});

test('CSS previews reflow in collection and homepage without fetching assets', async ({ page }) => {
  test.setTimeout(60_000); // Sixteen real navigations across both pages and color schemes.
  const assets: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/media/') || request.url().includes('/components/MuseumScene')) assets.push(request.url());
  });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/collection', '/']) {
        await page.goto(path);
        await expect(page.getByText('Hình minh họa thay thế', { exact: true })).toHaveCount(path === '/' ? 3 : 5);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
  expect(assets).toEqual([]);
});
