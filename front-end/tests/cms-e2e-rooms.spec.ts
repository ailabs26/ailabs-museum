import { expect, test } from '@playwright/test';
import { installCmsRoomsApi } from './fixtures/cmsRoomsApi';

test.describe('E2E: Quản lý Phòng trưng bày (Rooms CRUD)', () => {
  test('Hiển thị danh sách phòng, tìm kiếm và lọc theo trạng thái', async ({ page }) => {
    await installCmsRoomsApi(page);
    await page.goto('/admin/rooms');

    // Kiểm tra tiêu đề trang
    await expect(page.getByRole('heading', { name: 'Quản lý Phòng trưng bày' })).toBeVisible();

    // Kiểm tra danh sách hiển thị
    const table = page.getByRole('table');
    await expect(table.getByText('Phòng Lịch Sử Kháng Chiến')).toBeVisible();
    await expect(table.getByText('Phòng Cổ Vật Đông Sơn')).toBeVisible();

    // Tìm kiếm phòng
    const searchInput = page.getByPlaceholder('Tìm theo tên phòng hoặc slug...');
    await searchInput.fill('Kháng Chiến');
    await expect(table.getByText('Phòng Lịch Sử Kháng Chiến')).toBeVisible();
    await expect(table.getByText('Phòng Cổ Vật Đông Sơn')).toHaveCount(0);
  });

  test('Mở Drawer và tạo mới phòng trưng bày thành công', async ({ page }) => {
    const { writes } = await installCmsRoomsApi(page);
    await page.goto('/admin/rooms');

    // Bấm nút thêm phòng
    await page.getByRole('button', { name: 'Tạo phòng mới' }).click();

    // Kiểm tra Drawer mở ra
    const drawer = page.getByRole('dialog', { name: 'Tạo phòng trưng bày mới' });
    await expect(drawer).toBeVisible();

    // Nhập thông tin form
    await drawer.getByRole('textbox', { name: 'Tên phòng' }).fill('Phòng Nghệ Thuật Đương Đại');
    // Slug tự động sinh
    await expect(drawer.getByLabel('Slug (Định danh URL)')).toHaveValue('phong-nghe-thuat-duong-dai');

    await drawer.getByLabel('Mô tả phòng').fill('Không gian triển lãm nghệ thuật thị giác hiện đại.');

    // Bấm tạo phòng
    await drawer.getByRole('button', { name: 'Tạo phòng' }).click();

    // Drawer đóng lại và phòng mới xuất hiện
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('table').getByText('Phòng Nghệ Thuật Đương Đại')).toBeVisible();

    // Kiểm tra API đã được gọi đúng
    const postCall = writes.find((w) => w.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(postCall?.data).toMatchObject({
      name: 'Phòng Nghệ Thuật Đương Đại',
      slug: 'phong-nghe-thuat-duong-dai',
    });
  });

  test('Chỉnh sửa thông tin phòng và lưu thành công', async ({ page }) => {
    const { writes } = await installCmsRoomsApi(page);
    await page.goto('/admin/rooms');

    // Bấm nút chỉnh sửa ở dòng đầu tiên
    const row = page.getByRole('row').filter({ hasText: 'Phòng Lịch Sử Kháng Chiến' });
    await row.getByRole('button', { name: 'Sửa' }).click();

    const drawer = page.getByRole('dialog', { name: 'Cập nhật phòng trưng bày' });
    await expect(drawer).toBeVisible();

    // Sửa mô tả
    const descField = drawer.getByLabel('Mô tả phòng');
    await descField.fill('Mô tả đã được cập nhật qua bài kiểm thử E2E.');

    // Bấm lưu thay đổi
    await drawer.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(drawer).toHaveCount(0);

    const patchCall = writes.find((w) => w.method === 'PATCH');
    expect(patchCall).toBeTruthy();
    expect(patchCall?.data).toMatchObject({
      description: 'Mô tả đã được cập nhật qua bài kiểm thử E2E.',
    });
  });

  test('Xác nhận Modal khi xóa phòng', async ({ page }) => {
    const { writes } = await installCmsRoomsApi(page);
    await page.goto('/admin/rooms');

    const row = page.getByRole('row').filter({ hasText: 'Phòng Cổ Vật Đông Sơn' });
    await row.getByRole('button', { name: 'Xóa' }).click();

    // Hộp thoại confirm hiện ra
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText('Bạn có chắc chắn muốn xóa mềm phòng "Phòng Cổ Vật Đông Sơn"')).toBeVisible();

    // Bấm Đồng ý
    await confirmDialog.getByRole('button', { name: 'Đồng ý' }).click();
    await expect(confirmDialog).toHaveCount(0);

    // Dòng đã bị xóa khỏi bảng
    await expect(page.getByRole('table').getByText('Phòng Cổ Vật Đông Sơn')).toHaveCount(0);

    const deleteCall = writes.find((w) => w.method === 'DELETE');
    expect(deleteCall).toBeTruthy();
  });

  test('BR-20: phòng còn hiện vật có nút Xóa bị vô hiệu hóa', async ({ page }) => {
    await installCmsRoomsApi(page);
    await page.goto('/admin/rooms');

    const row = page.getByRole('row').filter({ hasText: 'Phòng Lịch Sử Kháng Chiến' });
    await expect(row.getByRole('button', { name: 'Xóa' })).toBeDisabled();
    const emptyRoom = page.getByRole('row').filter({ hasText: 'Phòng Cổ Vật Đông Sơn' });
    await expect(emptyRoom.getByRole('button', { name: 'Xóa' })).toBeEnabled();
  });
});

