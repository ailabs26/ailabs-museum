import { expect, test } from '@playwright/test';
import { installOverlayApi } from './fixtures/overlayApi';
import { expectTrapped } from './fixtures/overlayFocus';

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 768, 1440]) {
    test(`long exhibit drawer keeps keyboard focus visible at ${width}px in ${colorScheme}`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 900 });
      await installOverlayApi(page);
      await page.goto('/admin/exhibits');
      const trigger = page.getByRole('button', { name: 'Thêm hiện vật', exact: true });
      await trigger.press('Enter');
      const drawer = page.getByRole('dialog', { name: 'Thêm hiện vật mới', exact: true });
      const name = drawer.getByRole('textbox', { name: 'Tên hiện vật (Tiếng Việt)', exact: true });
      await expect(name).toBeFocused();
      await expectTrapped(page, drawer, 20);
      await drawer.getByRole('button', { name: 'Tạo bản nháp', exact: true }).focus();
      await expect(drawer.getByRole('button', { name: 'Tạo bản nháp', exact: true })).toBeInViewport();
      await expect(drawer.getByRole('button', { name: 'Tạo bản nháp', exact: true })).toHaveCSS('outline-style', 'solid');
      await page.screenshot({ path: testInfo.outputPath('drawer-keyboard-focus.png') });
      await page.keyboard.press('Escape');
      await expect(drawer).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }
}
