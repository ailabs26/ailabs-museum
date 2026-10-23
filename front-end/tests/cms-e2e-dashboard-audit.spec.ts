import { expect, test } from '@playwright/test';
import { installCmsDashboardAuditApi } from './fixtures/cmsDashboardAuditApi';

test.describe('E2E: Thống kê Dashboard & Nhật ký hệ thống (Stats & Audit Trail)', () => {
  test('Hiển thị tổng quan các thẻ thống kê và trạng thái hệ thống', async ({ page }) => {
    await installCmsDashboardAuditApi(page);
    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống' })).toBeVisible();

    // Kiểm tra các thẻ thống kê (StatCards)
    await expect(page.getByText('Phòng trưng bày')).toBeVisible();
    await expect(page.getByText('12 phòng')).toBeVisible();
    await expect(page.getByText('45 hiện vật')).toBeVisible();
    await expect(page.getByText('4 chờ duyệt')).toBeVisible();
    await expect(page.getByText('3 cần xử lý')).toBeVisible();

    // Kiểm tra trạng thái hệ thống
    await expect(page.getByText('API: Sẵn sàng')).toBeVisible();
    await expect(page.getByText('Database: Sẵn sàng')).toBeVisible();
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

