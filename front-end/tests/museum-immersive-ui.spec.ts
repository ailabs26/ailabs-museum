import { expect, test } from '@playwright/test';
import { installMuseumApi } from './fixtures/museumApi';

test.beforeEach(async ({ page }) => {
  await installMuseumApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined }));
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`immersive controls remain reachable at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto('/tour');
    await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
    const canvas = page.getByLabel('Phòng trưng bày 3D');
    await expect(canvas).toBeVisible();
    expect(await canvas.boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
    await expect(page.getByRole('button', { name: 'Hướng dẫn di chuyển', exact: true })).toHaveAttribute('aria-expanded', 'false');
    for (const name of ['Thoát tham quan', 'Góc nhìn ban đầu', 'Chụp ảnh']) {
      const control = page.getByRole('button', { name, exact: true });
      await expect(control).toBeVisible();
      const box = (await control.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(await control.evaluate(node => {
        const box = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
    }
    await page.screenshot({ path: info.outputPath('immersive.png') });
    await page.getByRole('button', { name: 'Lia camera tới Hiện vật 2', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
    await expect(panel).toBeVisible();
    expect(await canvas.boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
    await panel.getByRole('button', { name: 'Đóng chi tiết hiện vật' }).click();
    await page.getByText('Danh mục hiện vật', { exact: true }).click();
    await expect(page.getByRole('list', { name: 'Các hiện vật' })).toBeVisible();
    await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 1', exact: true }).click();
    await expect(panel).toContainText('Hiện vật 1');
    await page.screenshot({ path: info.outputPath('detail.png') });
    await page.getByRole('button', { name: 'Thoát tham quan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mở phòng 3D' })).toBeFocused();
  });
}

test('report modal owns Escape before exhibit and tour', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await page.getByRole('button', { name: 'Lia camera tới Hiện vật 1', exact: true }).click();
  await page.getByRole('button', { name: 'Báo nội dung', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Báo cáo nội dung' });
  await expect(modal).toBeVisible();
  expect(await modal.evaluate(node => !!node.closest('[data-immersive-tour]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toBeVisible();
  await expect(page.getByLabel('Phòng trưng bày 3D')).toBeVisible();
});
