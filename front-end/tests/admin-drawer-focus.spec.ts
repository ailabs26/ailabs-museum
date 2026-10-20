import { expect, test } from '@playwright/test';
import { installOverlayApi, overlayUser } from './fixtures/overlayApi';
import { expectTrapped } from './fixtures/overlayFocus';
import { fulfillMuseum } from './fixtures/museumApi';

for (const form of [
  { route: 'users', trigger: 'Tạo tài khoản', title: 'Tạo tài khoản', field: 'Email' },
  { route: 'roles', trigger: 'Tạo vai trò', title: 'Tạo vai trò', field: 'Mã vai trò' },
  { route: 'rooms', trigger: 'Tạo phòng mới', title: 'Tạo phòng trưng bày mới', field: 'Tên phòng' },
  { route: 'exhibits', trigger: 'Thêm hiện vật', title: 'Thêm hiện vật mới', field: 'Tên hiện vật (Tiếng Việt)' },
]) {
  test(`${form.route} form drawer focuses an editable field and traps keyboard input`, async ({ page }) => {
    await installOverlayApi(page);
    await page.goto(`/admin/${form.route}`);
    const trigger = page.getByRole('button', { name: form.trigger, exact: true });
    await trigger.press('Enter');
    const dialog = page.getByRole('dialog', { name: form.title, exact: true });
    await expect(dialog.getByRole('textbox', { name: form.field, exact: true })).toBeFocused();
    await expectTrapped(page, dialog, form.route === 'exhibits' ? 24 : 12);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test('user edit ignores disabled email and keeps focus through pending save error', async ({ page }) => {
  await installOverlayApi(page);
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  await page.route(`**/api/users/${overlayUser.id}`, async route => {
    await gate;
    await fulfillMuseum(route, { success: false, data: null, message: 'Không lưu được dữ liệu mẫu' }, 500);
  });
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Sửa', exact: true }).press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Sửa tài khoản', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Tên hiển thị', exact: true })).toBeFocused();
  await expect(dialog.getByRole('textbox', { name: 'Email', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).press('Enter');
  await expect(dialog.getByRole('textbox', { name: 'Tên hiển thị', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expectTrapped(page, dialog, 3);
  finish();
  await expect(dialog.getByRole('alert')).toContainText('Không lưu được dữ liệu mẫu');
  await expectTrapped(page, dialog, 8);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tài khoản', exact: true })).toBeFocused();
});

for (const form of [
  { route: 'roles', edit: 'Sửa tên', title: 'Sửa vai trò', field: 'Tên hiển thị', disabled: 'Mã vai trò' },
  { route: 'rooms', edit: 'Sửa', title: 'Cập nhật phòng trưng bày', field: 'Tên phòng', disabled: 'Slug (Định danh URL)' },
]) {
  test(`${form.route} edit skips disabled identity and returns focus after cancel`, async ({ page }) => {
    await installOverlayApi(page);
    await page.goto(`/admin/${form.route}`);
    const trigger = page.getByRole('button', { name: form.edit, exact: true });
    await trigger.press('Space');
    const dialog = page.getByRole('dialog', { name: form.title, exact: true });
    await expect(dialog.getByRole('textbox', { name: form.field, exact: true })).toBeFocused();
    await expect(dialog.getByRole('textbox', { name: form.disabled, exact: true })).toBeDisabled();
    await expectTrapped(page, dialog, 8);
    await dialog.getByRole('button', { name: 'Hủy', exact: true }).press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test('user create success returns to its persistent trigger', async ({ page }) => {
  const { writes } = await installOverlayApi(page);
  await page.goto('/admin/users');
  const trigger = page.getByRole('button', { name: 'Tạo tài khoản', exact: true });
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Tạo tài khoản', exact: true });
  await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill('new@example.test');
  await dialog.getByRole('textbox', { name: 'Tên hiển thị', exact: true }).fill('Tài khoản mới');
  await dialog.locator('input[type="password"]').fill('fixture-only-password');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(writes.filter(item => item.path === '/users')).toHaveLength(1);
});
