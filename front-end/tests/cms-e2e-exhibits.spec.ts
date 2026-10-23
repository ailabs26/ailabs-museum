import { expect, test } from '@playwright/test';
import { installCmsExhibitsApi } from './fixtures/cmsExhibitsApi';

test.describe('E2E: Quản lý Hiện vật & Phiên bản (Exhibits & Revisions)', () => {
  test('Hiển thị danh sách hiện vật và trạng thái', async ({ page }) => {
    await installCmsExhibitsApi(page);
    await page.goto('/admin/exhibits');

    await expect(page.getByRole('heading', { name: 'Hiện vật' })).toBeVisible();
    await expect(page.getByText('Súng Trường K54')).toBeVisible();
  });

  test('Tạo bản nháp hiện vật mới với thông tin song ngữ', async ({ page }) => {
    const { writes } = await installCmsExhibitsApi(page);
    await page.goto('/admin/exhibits');

    await page.getByRole('button', { name: 'Thêm hiện vật' }).click();

    const drawer = page.getByRole('dialog', { name: 'Thêm hiện vật mới' });
    await expect(drawer).toBeVisible();

    // Chọn phòng
    await drawer.getByLabel('Phòng trưng bày').click();
    await page.getByRole('option', { name: 'Phòng Lịch Sử Kháng Chiến' }).click();

    // Điền tên tiếng Việt và tiếng Anh
    await drawer.getByLabel('Tên hiện vật (Tiếng Việt)', { exact: true }).fill('Mũ Tai Bèo Bộ Đội');
    await drawer.getByLabel('Tên hiện vật (Tiếng Anh)').fill('Vietnamese Flap Cap');

    // Điền mô tả
    await drawer.getByLabel('Mô tả hiện vật (Tiếng Việt)').fill('Trang bị đặc trưng của quân giải phóng.');
    await drawer.getByLabel('Mô tả hiện vật (Tiếng Anh)').fill('Iconic gear of liberation forces.');

    // Bấm Tạo bản nháp
    await drawer.getByRole('button', { name: 'Tạo bản nháp' }).click();

    // Kiểm tra Drawer đóng và hiện vật mới hiển thị
    await expect(drawer).toHaveCount(0);
    await expect(page.getByText('Mũ Tai Bèo Bộ Đội')).toBeVisible();

    const postCall = writes.find((w) => w.method === 'POST' && w.path === '/admin/exhibits');
    expect(postCall).toBeTruthy();
  });

  test('Gửi yêu cầu kiểm duyệt phiên bản nháp', async ({ page }) => {
    const { writes } = await installCmsExhibitsApi(page);
    await page.goto('/admin/exhibits');

    const row = page.getByRole('row').filter({ hasText: 'Súng Trường K54' });
    // Bấm nút Gửi duyệt
    await row.getByTitle('Gửi duyệt').click();

    const confirmModal = page.getByRole('dialog');
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal.getByText('Gửi bản nháp')).toBeVisible();

    await confirmModal.getByRole('button', { name: 'Gửi duyệt' }).click();
    await expect(confirmModal).toHaveCount(0);

    const submitCall = writes.find((w) => w.path.includes('/submit-review'));
    expect(submitCall).toBeTruthy();
  });
});

