import { expect, test } from '@playwright/test';
import { installOverlayApi, overlayReport } from './fixtures/overlayApi';
import { expectTrapped } from './fixtures/overlayFocus';
import { fulfillMuseum } from './fixtures/museumApi';

test('reject modal keeps Escape scoped to the top overlay and returns into its drawer', async ({ page }) => {
  await installOverlayApi(page);
  await page.goto('/admin/moderation');
  await page.getByRole('button', { name: /Xem chi tiết Bình gốm, bản #1,/ }).press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Bình gốm', exact: true });
  await drawer.getByRole('button', { name: 'Từ chối', exact: true }).press('Enter');
  const modal = page.getByRole('dialog', { name: 'Từ chối phiên bản', exact: true });
  await expect(modal.getByRole('textbox', { name: 'Lý do từ chối' })).toBeFocused();
  await expectTrapped(page, modal, 6);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Từ chối', exact: true })).toBeFocused();
});

test('reports nested modal traps focus and Escape leaves the parent drawer open', async ({ page }) => {
  await installOverlayApi(page);
  await page.goto('/admin/reports');
  // Reports has no keyboard row trigger; only the overlay lifecycle is under test.
  await page.getByRole('cell', { name: 'Báo cáo mẫu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Chi tiết báo cáo', exact: true });
  await drawer.getByRole('button', { name: 'Xử lý xong', exact: true }).press('Enter');
  const modal = page.getByRole('dialog', { name: 'Xử lý xong báo cáo', exact: true });
  await expect(modal.getByRole('textbox', { name: 'Kết luận xử lý' })).toBeFocused();
  await expectTrapped(page, modal, 6);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Xử lý xong', exact: true })).toBeFocused();
});

test('nested rejection success closes both overlays and focuses the page after queue refetch', async ({ page }) => {
  const { writes } = await installOverlayApi(page);
  await page.goto('/admin/moderation');
  await page.getByRole('button', { name: /Xem chi tiết Bình gốm, bản #1,/ }).press('Enter');
  await page.getByRole('dialog', { name: 'Bình gốm', exact: true }).getByRole('button', { name: 'Từ chối', exact: true }).press('Enter');
  const modal = page.getByRole('dialog', { name: 'Từ chối phiên bản', exact: true });
  await modal.getByRole('textbox', { name: 'Lý do từ chối' }).fill('Cần kiểm tra lại nội dung');
  await modal.getByRole('button', { name: 'Xác nhận từ chối', exact: true }).press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Kiểm duyệt nội dung', exact: true })).toBeFocused();
  expect(writes).toHaveLength(1);
});

test('report resolution closes both layers and returns to the page', async ({ page }) => {
  await installOverlayApi(page);
  await page.goto('/admin/reports');
  await page.getByRole('cell', { name: 'Báo cáo mẫu' }).click();
  await page.getByRole('dialog', { name: 'Chi tiết báo cáo', exact: true }).getByRole('button', { name: 'Xử lý xong', exact: true }).press('Enter');
  const modal = page.getByRole('dialog', { name: 'Xử lý xong báo cáo', exact: true });
  await modal.getByRole('textbox', { name: 'Kết luận xử lý' }).fill('Đã kiểm tra nội dung');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Báo cáo vi phạm', exact: true })).toBeFocused();
});

test('nested modal error retains focus and does not close its parent', async ({ page }) => {
  await installOverlayApi(page);
  await page.route(`**/api/reports/${overlayReport.id}/resolve`, route => fulfillMuseum(route, { success: false, data: null, message: 'Không xử lý được báo cáo mẫu' }, 500));
  await page.goto('/admin/reports');
  await page.getByRole('cell', { name: 'Báo cáo mẫu' }).click();
  await page.getByRole('dialog', { name: 'Chi tiết báo cáo', exact: true }).getByRole('button', { name: 'Xử lý xong', exact: true }).press('Enter');
  const modal = page.getByRole('dialog', { name: 'Xử lý xong báo cáo', exact: true });
  await modal.getByRole('textbox', { name: 'Kết luận xử lý' }).fill('Nội dung kiểm tra');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).press('Enter');
  await expect(page.getByText('Không xử lý được báo cáo mẫu', { exact: true })).toBeVisible();
  await expectTrapped(page, modal, 6);
  await expect(page.getByRole('dialog')).toHaveCount(2);
});

test('dismissing a report can be cancelled without changing its parent', async ({ page }) => {
  const { writes } = await installOverlayApi(page);
  await page.goto('/admin/reports');
  await page.getByRole('cell', { name: 'Báo cáo mẫu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Chi tiết báo cáo', exact: true });
  const trigger = drawer.getByRole('button', { name: 'Đóng/bác', exact: true });
  await trigger.press('Space');
  const modal = page.getByRole('dialog', { name: 'Đóng/bác báo cáo', exact: true });
  await expect(modal.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled();
  await expectTrapped(page, modal, 6);
  await modal.getByRole('button', { name: 'Hủy', exact: true }).press('Enter');
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(writes).toEqual([]);
});

test('conflict closes the report workflow without leaving an orphan modal', async ({ page }) => {
  await installOverlayApi(page);
  await page.route(`**/api/reports/${overlayReport.id}/resolve`, route => fulfillMuseum(route, { success: false, data: null, message: 'Bản ghi đã thay đổi' }, 409));
  await page.goto('/admin/reports');
  await page.getByRole('cell', { name: 'Báo cáo mẫu' }).click();
  await page.getByRole('dialog', { name: 'Chi tiết báo cáo', exact: true }).getByRole('button', { name: 'Xử lý xong', exact: true }).press('Enter');
  const modal = page.getByRole('dialog', { name: 'Xử lý xong báo cáo', exact: true });
  await modal.getByRole('textbox', { name: 'Kết luận xử lý' }).fill('Kết luận mẫu');
  await modal.getByRole('button', { name: 'Xác nhận', exact: true }).press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Báo cáo vi phạm', exact: true })).toBeFocused();
});

test('conflict closes the rejection workflow without leaving an orphan modal', async ({ page }) => {
  await installOverlayApi(page);
  await page.route('**/api/revisions/*/reject', route => fulfillMuseum(route, { success: false, data: null, message: 'Phiên bản đã thay đổi' }, 409));
  await page.goto('/admin/moderation');
  await page.getByRole('button', { name: /Xem chi tiết Bình gốm, bản #1,/ }).press('Enter');
  await page.getByRole('dialog', { name: 'Bình gốm', exact: true }).getByRole('button', { name: 'Từ chối', exact: true }).press('Enter');
  const modal = page.getByRole('dialog', { name: 'Từ chối phiên bản', exact: true });
  await modal.getByRole('textbox', { name: 'Lý do từ chối' }).fill('Lý do mẫu');
  await modal.getByRole('button', { name: 'Xác nhận từ chối', exact: true }).press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Kiểm duyệt nội dung', exact: true })).toBeFocused();
});
