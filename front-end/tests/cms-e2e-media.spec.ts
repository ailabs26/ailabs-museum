import { expect, test } from '@playwright/test';
import { installCmsMediaApi } from './fixtures/cmsMediaApi';

test.describe('E2E: Quản lý Thư viện Media & Quy tắc xóa BR-21', () => {
  test('Hiển thị danh sách media và tìm kiếm theo tên file', async ({ page }) => {
    await installCmsMediaApi(page);
    await page.goto('/admin/media');

    await expect(page.getByRole('heading', { name: 'Media', exact: true })).toBeVisible();
    await expect(page.getByText('anh-hien-vat-dong-son.png')).toBeVisible();
    await expect(page.getByText('trong_dong_dong_son.glb')).toBeVisible();

    // Tìm kiếm
    const searchInput = page.getByPlaceholder('Tìm theo tên tệp, mô tả, nguồn, tác giả...');
    await searchInput.fill('trong_dong');
    await expect(page.getByText('trong_dong_dong_son.glb')).toBeVisible();
    await expect(page.getByText('anh-hien-vat-dong-son.png')).toHaveCount(0);
  });

  test('Chỉnh sửa quyền sử dụng và siêu dữ liệu bản quyền (FR-97)', async ({ page }) => {
    const { writes } = await installCmsMediaApi(page);
    await page.goto('/admin/media');

    const row = page.getByRole('row').filter({ hasText: 'anh-hien-vat-dong-son.png' });
    await row.getByRole('button', { name: 'Sửa thông tin' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    // Cập nhật tác giả và nguồn gốc
    const authorInput = drawer.getByRole('textbox', { name: 'Tác giả' });
    await authorInput.fill('Viện Khảo cổ học Việt Nam');

    await drawer.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(drawer).toHaveCount(0);

    const patchCall = writes.find((w) => w.method === 'PATCH');
    expect(patchCall).toBeTruthy();
    expect(patchCall?.data).toMatchObject({
      author: 'Viện Khảo cổ học Việt Nam',
    });
  });

  test('Kiểm tra quy tắc BR-21: Chặn xóa media đang được sử dụng (409 Conflict)', async ({ page }) => {
    const { writes } = await installCmsMediaApi(page);
    await page.goto('/admin/media');

    // Thử xóa media-002 (mô hình GLB đang gắn với exhibit đã xuất bản)
    const row = page.getByRole('row').filter({ hasText: 'trong_dong_dong_son.glb' });
    await row.getByRole('button', { name: 'Xóa' }).click();

    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Xóa media' }).click();

    // Thông báo lỗi 409 xuất hiện trên UI
    await expect(page.getByText('Không thể xóa media đang được sử dụng')).toBeVisible();

    // File vẫn còn nguyên trong bảng
    await expect(page.getByRole('table').getByText('trong_dong_dong_son.glb')).toBeVisible();

    const deleteCall = writes.find((w) => w.path === '/admin/media/media-002');
    expect(deleteCall).toBeTruthy();
  });
});

