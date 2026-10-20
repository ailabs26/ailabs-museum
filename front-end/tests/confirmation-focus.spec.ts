import { expect, test } from '@playwright/test';
import { installOverlayApi } from './fixtures/overlayApi';
import { expectTrapped } from './fixtures/overlayFocus';

for (const close of ['Escape', 'Hủy', 'close']) {
  test(`danger confirmation starts on cancel and returns without writing via ${close}`, async ({ page }) => {
    const { writes } = await installOverlayApi(page);
    await page.goto('/admin/users');
    const trigger = page.getByRole('button', { name: 'Xóa tài khoản', exact: true });
    await trigger.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Xác nhận', exact: true });
    await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeFocused();
    await expectTrapped(page, dialog, 4);
    if (close === 'Escape') await page.keyboard.press('Escape');
    else if (close === 'Hủy') await dialog.getByRole('button', { name: 'Hủy', exact: true }).press('Space');
    else await dialog.getByRole('button').first().press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(writes).toEqual([]);
  });
}
