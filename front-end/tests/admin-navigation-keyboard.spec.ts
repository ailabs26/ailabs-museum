import { expect, test } from '@playwright/test';
import { installModerationApi } from './fixtures/moderationApi';

test('mobile CMS navigation exposes named keyboard controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await installModerationApi(page);
  await page.goto('/admin/moderation');
  await expect(page.getByRole('heading', { name: 'Kiểm duyệt nội dung' })).toBeVisible();
  const burger = page.getByRole('button', { name: 'Mở điều hướng quản trị', exact: true });
  await page.keyboard.press('Tab');
  await expect(burger).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Đóng điều hướng quản trị', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  const account = page.getByRole('button', { name: 'Tài khoản Reviewer', exact: true });
  await expect(account).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Đăng xuất' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(account).toBeFocused();
});

test('CMS login and logout can be completed with keyboard-only controls', async ({ page }) => {
  const { writes } = await installModerationApi(page, { authenticated: false });
  await page.goto('/admin/moderation');
  const email = page.getByRole('textbox', { name: 'Email' });
  await expect(email).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(email).toBeFocused();
  await page.keyboard.type('reviewer@example.test');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Mật khẩu', exact: true })).toBeFocused();
  await page.keyboard.type('fixture-only-password');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Tài khoản Reviewer', exact: true })).toBeVisible();
  const account = page.getByRole('button', { name: 'Tài khoản Reviewer', exact: true });
  for (let index = 0; index < 20 && !await account.evaluate(element => element === document.activeElement); index++) {
    await page.keyboard.press('Tab');
  }
  await expect(account).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Đăng xuất' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Đăng xuất' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(writes).toEqual(['/auth/logout']);
});

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 768, 1440]) {
    test(`CMS keyboard navigation remains visible at ${width}px in ${colorScheme}`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 900 });
      await installModerationApi(page);
      await page.goto('/admin/moderation');
      await expect(page.getByRole('heading', { name: 'Kiểm duyệt nội dung' })).toBeVisible();
      await page.keyboard.press('Tab');
      const first = width < 768
        ? page.getByRole('button', { name: 'Mở điều hướng quản trị', exact: true })
        : page.getByRole('button', { name: 'Tài khoản Reviewer', exact: true });
      await expect(first).toBeFocused();
      await expect(first).toBeInViewport();
      await expect(first).toHaveCSS('outline-style', 'solid');
      await page.screenshot({ path: testInfo.outputPath('cms-keyboard-focus.png') });
      if (width < 768) await page.keyboard.press('Space');
      const moderation = page.getByRole('link', { name: 'Kiểm duyệt', exact: true });
      for (let index = 0; index < 15 && !await moderation.evaluate(element => element === document.activeElement); index++) {
        await page.keyboard.press('Tab');
      }
      await expect(moderation).toBeFocused();
      await expect(moderation).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
