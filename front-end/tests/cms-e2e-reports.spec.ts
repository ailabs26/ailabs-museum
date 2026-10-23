import { expect, test } from '@playwright/test';
import { installCmsReportsWorkflowApi } from './fixtures/cmsReportsWorkflowApi';

test.describe('E2E: Xử lý Báo cáo vi phạm (Content Reports Workflow)', () => {
  test('Hiển thị danh sách báo cáo vi phạm và lọc theo trạng thái', async ({ page }) => {
    await installCmsReportsWorkflowApi(page);
    await page.goto('/admin/reports');

    await expect(page.getByRole('heading', { name: 'Báo cáo vi phạm' })).toBeVisible();
    await expect(page.getByText('Trống Đồng Đông Sơn')).toBeVisible();
    await expect(page.getByText('Mô tả hiện vật có thông tin niên đại lịch sử chưa chính xác.')).toBeVisible();
  });

  test('Admin tiếp nhận báo cáo và chuyển sang trạng thái Đang xử lý', async ({ page }) => {
    const { writes } = await installCmsReportsWorkflowApi(page);
    await page.goto('/admin/reports');

    // Mở chi tiết báo cáo
    await page.getByRole('row').filter({ hasText: 'Trống Đồng Đông Sơn' }).click();

    const drawer = page.getByRole('dialog', { name: /Chi tiết báo cáo/ });
    await expect(drawer).toBeVisible();

    // Bấm nút Tiếp nhận xử lý
    await drawer.getByRole('button', { name: 'Tiếp nhận xử lý' }).click();

    const assignCall = writes.find((w) => w.path.includes('/assign'));
    expect(assignCall).toBeTruthy();
  });

  test('Admin phê duyệt giải quyết báo cáo vi phạm kèm kết luận', async ({ page }) => {
    const { writes } = await installCmsReportsWorkflowApi(page);
    await page.goto('/admin/reports');

    await page.getByRole('row').filter({ hasText: 'Trống Đồng Đông Sơn' }).click();
    const drawer = page.getByRole('dialog', { name: /Chi tiết báo cáo/ });
    await expect(drawer).toBeVisible();

    // Bấm nút Đã xử lý (chấp thuận vi phạm)
    await drawer.getByRole('button', { name: 'Đã xử lý (chấp thuận vi phạm)' }).click();

    // Modal nhập kết luận mở ra
    const modal = page.getByRole('dialog', { name: 'Kết luận xử lý' });
    await expect(modal).toBeVisible();

    // Nhập ghi chú kết luận xử lý
    await modal.getByLabel('Nội dung giải quyết (bắt buộc)').fill('Đã hiệu chỉnh lại niên đại từ thế kỷ VII TCN thành thế kỷ V TCN.');

    // Bấm xác nhận
    await modal.getByRole('button', { name: 'Xác nhận' }).click();
    await expect(modal).toHaveCount(0);
    await expect(drawer).toHaveCount(0);

    const resolveCall = writes.find((w) => w.path.includes('/resolve'));
    expect(resolveCall).toBeTruthy();
    expect(resolveCall?.data).toMatchObject({
      resolutionNotes: 'Đã hiệu chỉnh lại niên đại từ thế kỷ VII TCN thành thế kỷ V TCN.',
    });
  });
});

