import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test.use({ deviceScaleFactor: 3 });

test('idle scene stops GPU draw calls and repeated start/stop stays usable', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.set(window, '__museumDraws', 0);
    const original = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args: Parameters<typeof original>) {
      Reflect.set(window, '__museumDraws', Reflect.get(window, '__museumDraws') + 1);
      return original.apply(this, args);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tour');
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
    const canvas = page.getByLabel('Phòng trưng bày 3D');
    await expect(canvas).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
    const dpr = await canvas.evaluate((element: HTMLCanvasElement) => element.width / element.clientWidth);
    expect(dpr).toBeGreaterThan(1);
    expect(dpr).toBeLessThanOrEqual(1.5);
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__museumDraws'))).toBeGreaterThan(0);
    // Deliberate observation interval: prove demand rendering becomes idle.
    await page.waitForTimeout(700);
    const draws = await page.evaluate(() => Reflect.get(window, '__museumDraws'));
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => Reflect.get(window, '__museumDraws'))).toBe(draws);
    await canvas.press('ArrowRight');
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__museumDraws'))).toBeGreaterThan(draws);
    await page.getByRole('button', { name: 'Dừng 3D' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('leaving the tour releases its canvas and returning starts in DOM mode', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
  await page.getByRole('link', { name: 'Aura Museum' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('banner').getByRole('link', { name: 'Tham quan 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});
