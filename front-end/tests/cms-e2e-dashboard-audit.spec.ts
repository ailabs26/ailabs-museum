import { expect, test } from '@playwright/test';
import { installCmsDashboardAuditApi } from './fixtures/cmsDashboardAuditApi';

test.describe('E2E: Thống kê Dashboard & Nhật ký hệ thống (Stats & Audit Trail)', () => {
  test('Hiển thị tổng quan các thẻ thống kê và trạng thái hệ thống', async ({ page }) => {
    await installCmsDashboardAuditApi(page);
    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Thẻ số liệu (StatCard) lấy từ /admin/stats/overview của fixture
    await expect(page.getByRole('main').getByText('Phòng trưng bày', { exact: true })).toBeVisible();
    await expect(page.getByText('10 hoạt động · 2 lưu trữ')).toBeVisible();
    await expect(page.getByText('40 hiển thị · 5 đang ẩn')).toBeVisible();
    await expect(page.getByText('8 bản nháp đang biên tập')).toBeVisible();
    await expect(page.getByText('2 đang xử lý')).toBeVisible();

    // Trạng thái hệ thống
    await expect(page.getByText('API: up')).toBeVisible();
    await expect(page.getByText('Database: up')).toBeVisible();
  });

  test('Hiển thị bảng nhật ký hệ thống (Audit Trail) và mở xem chi tiết', async ({ page }) => {
    await installCmsDashboardAuditApi(page);
    await page.goto('/admin/audit');

    await expect(page.getByRole('heading', { name: 'Nhật ký hệ thống' })).toBeVisible();

    // Kiểm tra dòng nhật ký xuất hiện
    await expect(page.getByText('room.create')).toBeVisible();
    await expect(page.getByText('revision.publish')).toBeVisible();

    // Bấm xem chi tiết dòng nhật ký
    await page.getByRole('row').filter({ hasText: 'room.create' }).click();

    const drawer = page.getByRole('dialog', { name: 'Chi tiết nhật ký' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('room-101')).toBeVisible();
    await expect(drawer.getByText('Playwright Test')).toBeVisible();
  });
});

