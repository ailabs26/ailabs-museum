import { expect, test } from '@playwright/test';
import { installOverlayApi, overlayUser, overlayExhibit, overlayAudit } from './fixtures/overlayApi';
import { expectTrapped } from './fixtures/overlayFocus';
import { fulfillMuseum } from './fixtures/museumApi';
import { envelope } from './fixtures/museumContent';

test('deleting a record returns focus to the remaining users heading', async ({ page }) => {
  const { writes } = await installOverlayApi(page);
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Xóa tài khoản', exact: true }).press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: 'Đồng ý', exact: true }).press('Space');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xóa tài khoản', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tài khoản', exact: true })).toBeFocused();
  expect(writes.map(item => item.path)).toEqual([`/users/${overlayUser.id}`]);
});

test('read-only audit drawer traps its only button and returns to a meaningful page target', async ({ page }) => {
  await installOverlayApi(page);
  await page.goto('/admin/audit');
  // Audit remains click-row-only; this does not certify keyboard opening.
  await page.getByRole('cell', { name: overlayAudit.action, exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Chi tiết nhật ký', exact: true });
  await expectTrapped(page, drawer, 3);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Nhật ký hệ thống', exact: true })).toBeFocused();
});

test('exhibit detail loading does not move focus outside the drawer when data arrives', async ({ page }) => {
  await installOverlayApi(page);
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  await page.route(`**/api/admin/exhibits/${overlayExhibit.id}`, async route => {
    await gate;
    await fulfillMuseum(route, envelope(overlayExhibit));
  });
  await page.goto('/admin/exhibits');
  // This pre-existing icon is unnamed; record the keyboard-trigger limitation.
  const trigger = page.getByRole('row').filter({ hasText: 'Hiện vật mẫu' }).getByRole('button').nth(0);
  await trigger.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Chi tiết hiện vật & Lịch sử phiên bản', exact: true });
  await expectTrapped(page, drawer, 3);
  finish();
  await expect(drawer.getByText('Hiện vật mẫu', { exact: true })).toBeVisible();
  await expectTrapped(page, drawer, 6);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

for (const record of [
  { route: 'roles', heading: 'Vai trò', confirm: 'Đồng ý', trigger: 'Xóa' },
  { route: 'rooms', heading: 'Quản lý Phòng trưng bày', confirm: 'Đồng ý', trigger: 'Xóa' },
  { route: 'exhibits', heading: 'Hiện vật', confirm: 'Xóa vĩnh viễn bản nháp', trigger: '' },
]) {
  test(`${record.route} delete restores a stable page target after the invoker disappears`, async ({ page }) => {
    await installOverlayApi(page);
    await page.goto(`/admin/${record.route}`);
    const trigger = record.trigger ? page.getByRole('button', { name: record.trigger, exact: true }) : page.getByRole('row').filter({ hasText: 'Hiện vật mẫu' }).getByRole('button').last();
    await trigger.press('Enter');
    await page.getByRole('dialog').getByRole('button', { name: record.confirm, exact: true }).press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: record.heading, exact: true })).toBeFocused();
  });
}
