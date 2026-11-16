import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';

const forbidden3dRequest = /HeroCanvas|react-three-fiber|three-[^/]+\.js|\.glb(?:\?|$)/i;

for (const webglEnabled of [true, false]) {
  test(`homepage hero stays 2D with WebGL ${webglEnabled ? 'enabled' : 'disabled'}`, async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    if (!webglEnabled) {
      await page.addInitScript(() => Object.defineProperty(window, 'WebGLRenderingContext', { configurable: true, value: undefined }));
    }
    await installMuseumApi(page);
    await page.goto('/');
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Khám phá Không gian 3D (WebXR)' })).toHaveAttribute('href', '/tour');
    await expect(page.getByRole('link', { name: 'Xem Danh mục Bộ sưu tập' })).toHaveAttribute('href', '/collection');
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(requests.filter((url) => forbidden3dRequest.test(url))).toEqual([]);
    await expect(page.getByText('5+', { exact: true })).toHaveCount(0);
    await expect(page.getByText('100%', { exact: true })).toHaveCount(0);
    await expect(page.getByText('0s', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Trống đồng Đông Sơn', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/~2\.500 năm/)).toHaveCount(0);
  });
}

test('homepage hero and shared navigation remain available when room API fails', async ({ page }) => {
  await page.route('**/api/rooms**', (route) => route.abort());
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const tourLink = page.getByRole('link', { name: 'Khám phá Không gian 3D (WebXR)' });
  await expect(tourLink).toHaveAttribute('href', '/tour');
  await expect(page.getByRole('link', { name: 'Xem Danh mục Bộ sưu tập' })).toHaveAttribute('href', '/collection');

  for (let index = 0; index < 12 && !(await tourLink.evaluate((link) => link === document.activeElement)); index += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(tourLink).toBeFocused();
  await expect(tourLink).toHaveCSS('outline-style', 'solid');
});
