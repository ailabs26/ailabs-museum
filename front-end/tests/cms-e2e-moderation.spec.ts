import { expect, test } from '@playwright/test';
import { installCmsModerationConcurrencyApi } from './fixtures/cmsModerationConcurrencyApi';

test.describe('E2E: Kiểm duyệt nội dung & Xử lý xung đột 409 (Moderation & Concurrency)', () => {
  test('Hiển thị hàng chờ duyệt, mở Drawer so sánh Diff và xuất bản thành công', async ({ page }) => {
    const { writes } = await installCmsModerationConcurrencyApi(page);
    await page.goto('/admin/moderation');

    await expect(page.getByRole('heading', { name: 'Kiểm duyệt nội dung' })).toBeVisible();
    await expect(page.getByText('Trống Đồng Ngọc Lũ')).toBeVisible();

    // Mở drawer xem chi tiết
    await page.getByRole('row').filter({ hasText: 'Trống Đồng Ngọc Lũ' }).click();

    const drawer = page.getByRole('dialog', { name: /Duyệt phiên bản/ });
    await expect(drawer).toBeVisible();

    // Kiểm tra tab so sánh thay đổi
    await expect(drawer.getByText('So sánh thay đổi')).toBeVisible();
    await expect(drawer.getByText('Bảo vật quốc gia thời kỳ Đông Sơn đỉnh cao.')).toBeVisible();

    // Bấm xuất bản
    await drawer.getByRole('button', { name: 'Xuất bản' }).click();

    // Drawer đóng lại sau khi xuất bản
    await expect(drawer).toHaveCount(0);

    const publishCall = writes.find((w) => w.path.includes('/publish'));
    expect(publishCall).toBeTruthy();
  });

  test('Từ chối phiên bản kèm lý do bắt buộc', async ({ page }) => {
    const { writes } = await installCmsModerationConcurrencyApi(page);
    await page.goto('/admin/moderation');

    await page.getByRole('row').filter({ hasText: 'Trống Đồng Ngọc Lũ' }).click();
    const drawer = page.getByRole('dialog', { name: /Duyệt phiên bản/ });
    await expect(drawer).toBeVisible();

    // Bấm nút Từ chối trong Drawer
    await drawer.getByRole('button', { name: 'Từ chối' }).click();

    // Modal nhập lý do hiện lên
    const modal = page.getByRole('dialog', { name: 'Từ chối phiên bản' });
    await expect(modal).toBeVisible();

    // Nhập lý do từ chối
    const reasonInput = modal.getByLabel('Lý do từ chối (bắt buộc)');
    await reasonInput.fill('Ảnh đại diện bị mờ và thiếu phần mô tả tiếng Anh.');

    // Bấm Xác nhận từ chối
    await modal.getByRole('button', { name: 'Xác nhận từ chối' }).click();
    await expect(modal).toHaveCount(0);
    await expect(drawer).toHaveCount(0);

    const rejectCall = writes.find((w) => w.path.includes('/reject'));
    expect(rejectCall).toBeTruthy();
    expect(rejectCall?.data).toMatchObject({
      reason: 'Ảnh đại diện bị mờ và thiếu phần mô tả tiếng Anh.',
    });
  });

  test('Xử lý xung đột 409 Conflict khi phiên bản đã bị thay đổi đồng thời', async ({ page }) => {
    // Mô phỏng trường hợp server trả về lỗi 409
    await installCmsModerationConcurrencyApi(page, { simulate409OnPublish: true });
    await page.goto('/admin/moderation');

    await page.getByRole('row').filter({ hasText: 'Trống Đồng Ngọc Lũ' }).click();
    const drawer = page.getByRole('dialog', { name: /Duyệt phiên bản/ });
    await expect(drawer).toBeVisible();

    // Bấm xuất bản
    await drawer.getByRole('button', { name: 'Xuất bản' }).click();

    // Alert hoặc Notification báo xung đột 409 xuất hiện trên UI
    await expect(page.getByText('Nội dung đã bị thay đổi bởi người khác')).toBeVisible();

    // Drawer tự động đóng để người dùng tải lại dữ liệu mới nhất
    await expect(drawer).toHaveCount(0);
  });
});

