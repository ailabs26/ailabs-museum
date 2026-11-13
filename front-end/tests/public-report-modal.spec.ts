import { expect, test } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, roomA } from './fixtures/museumContent';

test.beforeEach(async ({ page }) => { await installMuseumApi(page); });

test('collection report submits a fixed category and the viewed revision', async ({ page }) => {
  const exhibit = roomA.exhibits[0];
  let payload: Record<string, unknown> | undefined;
  await page.route('**/api/public/reports', async (route) => {
    payload = route.request().postDataJSON();
    await fulfillMuseum(route, envelope({ id: 'c1111111-1111-4111-8111-111111111111', status: 'open' }), 201);
  });
  await page.goto('/collection');
  const card = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem').first();
  await card.getByRole('button', { name: 'Báo nội dung' }).click();

  const dialog = page.getByRole('dialog', { name: 'Báo cáo nội dung' });
  const category = dialog.getByLabel('Danh mục');
  await expect(category.locator('option')).toHaveCount(5);
  await category.selectOption('wrong_info');
  await dialog.getByLabel('Nội dung bổ sung').fill('   ');
  await dialog.getByRole('button', { name: 'Gửi báo cáo' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Vui lòng nhập nội dung');
  expect(payload).toBeUndefined();
  await dialog.getByLabel('Nội dung bổ sung').fill('  Sai niên đại  ');
  await dialog.getByRole('button', { name: 'Gửi báo cáo' }).click();

  await expect(dialog).toHaveCount(0);
  expect(payload).toEqual({
    exhibitId: exhibit.id,
    reportedRevisionId: exhibit.revisionId,
    category: 'wrong_info',
    message: 'Sai niên đại',
  });
  await expect(page.getByText('Đã gửi báo cáo nội dung')).toBeVisible();
});

test('failed report keeps the entered values and shows the API error', async ({ page }) => {
  await page.route('**/api/public/reports', (route) => fulfillMuseum(route,
    { success: false, data: null, message: 'Bạn gửi quá nhanh, vui lòng thử lại sau.' }, 429));
  await page.goto('/collection');
  const card = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem').first();
  await card.getByRole('button', { name: 'Báo nội dung' }).click();
  const dialog = page.getByRole('dialog', { name: 'Báo cáo nội dung' });
  await dialog.getByLabel('Danh mục').selectOption('other');
  await dialog.getByLabel('Nội dung bổ sung').fill('Thông tin cần kiểm tra');
  await dialog.getByRole('button', { name: 'Gửi báo cáo' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Bạn gửi quá nhanh');
  await expect(dialog.getByLabel('Danh mục')).toHaveValue('other');
  await expect(dialog.getByLabel('Nội dung bổ sung')).toHaveValue('Thông tin cần kiểm tra');
});

test('detail page and tour panel both open the shared report form', async ({ page }) => {
  const exhibit = roomA.exhibits[1];
  await page.goto(`/collection/sculpture/exhibits/${exhibit.id}`);
  await page.getByRole('button', { name: 'Báo nội dung' }).click();
  await expect(page.getByRole('dialog', { name: 'Báo cáo nội dung' })).toBeVisible();
  await page.getByRole('button', { name: 'Hủy' }).click();

  await page.goto('/tour');
  await page.getByRole('button', { name: `Xem chi tiết ${roomA.exhibits[0].name}` }).click();
  await page.getByRole('button', { name: 'Báo nội dung' }).click();
  await expect(page.getByRole('dialog', { name: 'Báo cáo nội dung' })).toBeVisible();
});
