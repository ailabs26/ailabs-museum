import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';
import { roomA } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('header and homepage links open the tour by keyboard without starting 3D', async ({ page }) => {
  for (const location of ['header', 'main']) {
    await page.goto('/');
    await expect(page.getByText('Sắp ra mắt', { exact: false })).toHaveCount(0);
    const link = location === 'header'
      ? page.locator('header').getByRole('link', { name: 'Tham quan 3D', exact: true })
      : page.getByRole('link', { name: 'Khám phá Không gian 3D (WebXR)', exact: true });
    await expect(link).toHaveAttribute('href', '/tour');
    await link.focus();
    await link.press('Enter');
    await expect(page).toHaveURL(/\/tour$/);
    await expect(page.getByRole('heading', { name: roomA.name, exact: true })).toBeVisible();
    await expect(page.locator('header').getByRole('link', { name: 'Tham quan 3D', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('list', { name: 'Các hiện vật' }).getByRole('listitem')).toHaveCount(5);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeVisible();
  }
});

test('tour navigation stays visible without horizontal overflow in light and dark layouts', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      if (width < 768) {
        await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
        await expect(page.getByRole('link', { name: 'Tham quan 3D', exact: true }).last()).toBeVisible();
      } else {
        await expect(page.locator('header').getByRole('link', { name: 'Tham quan 3D', exact: true })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
