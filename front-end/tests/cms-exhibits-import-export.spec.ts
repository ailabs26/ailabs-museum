import { expect, test, type Page } from '@playwright/test';
import { installCmsExhibitsApi } from './fixtures/cmsExhibitsApi';

/** Task 38 — nút Xuất và modal Nhập hiện vật (API giả lập, chạy cùng bộ E2E CMS). */

const CSV = 'roomSlug,name_vi\nphong-gom,Bình gốm\nphong-khong-co,Sai phòng\nphong-gom,Chuông đồng\n';

function importResult(dryRun: boolean) {
  return {
    dryRun,
    total: 3,
    valid: 2,
    created: dryRun ? 0 : 2,
    failed: 1,
    ids: dryRun ? [] : ['n1', 'n2'],
    rows: [
      { row: 1, status: dryRun ? 'valid' : 'created', name: 'Bình gốm', exhibitId: dryRun ? null : 'n1', errors: [] },
      { row: 2, status: 'error', name: 'Sai phòng', exhibitId: null, errors: [{ field: 'roomSlug', message: 'Không tìm thấy phòng có slug "phong-khong-co"' }] },
      { row: 3, status: dryRun ? 'valid' : 'created', name: 'Chuông đồng', exhibitId: dryRun ? null : 'n2', errors: [] },
    ],
  };
}

async function installTransferApi(page: Page, options: { importStatus?: number } = {}) {
  const calls: Array<{ path: string; params: Record<string, string> }> = [];
  // Đăng ký sau installCmsExhibitsApi → được ưu tiên cho hai route này.
  await page.route('**/api/admin/exhibits/export*', async (route) => {
    const url = new URL(route.request().url());
    calls.push({ path: 'export', params: Object.fromEntries(url.searchParams) });
    const json = url.searchParams.get('format') === 'json';
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': json ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="exhibits-20261113-1300.${json ? 'json' : 'csv'}"`,
        'access-control-expose-headers': 'Content-Disposition',
      },
      body: json ? '{"items":[]}' : '﻿"id","roomSlug"\r\n',
    });
  });
  await page.route('**/api/admin/exhibits/import*', async (route) => {
    const url = new URL(route.request().url());
    calls.push({ path: 'import', params: Object.fromEntries(url.searchParams) });
    if (options.importStatus === 422) {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, data: null, message: 'Cột không được hỗ trợ: ten', errors: [{ field: 'file', code: 'exhibit_import_invalid_file', message: 'Cột không được hỗ trợ: ten' }] }),
      });
      return;
    }
    const dryRun = url.searchParams.get('dryRun') === 'true';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: importResult(dryRun), message: null }) });
  });
  return calls;
}

test.describe('E2E: Xuất/nhập hiện vật (Task 38)', () => {
  test('Xuất CSV và JSON tải file về với tên từ server', async ({ page }) => {
    await installCmsExhibitsApi(page);
    const calls = await installTransferApi(page);
    await page.goto('/admin/exhibits');

    for (const [item, filename] of [['CSV (mở bằng Excel)', 'exhibits-20261113-1300.csv'], ['JSON', 'exhibits-20261113-1300.json']] as const) {
      await page.getByRole('button', { name: 'Xuất' }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: item }).click();
      expect((await download).suggestedFilename()).toBe(filename);
    }
    expect(calls.map((c) => c.params.format)).toEqual(['csv', 'json']);
  });

  test('Nhập: kiểm tra → thấy dòng lỗi → nhập dòng hợp lệ → kết quả thành công một phần', async ({ page }) => {
    await installCmsExhibitsApi(page);
    const calls = await installTransferApi(page);
    await page.goto('/admin/exhibits');

    await page.getByRole('button', { name: 'Nhập', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nhập hiện vật từ CSV/JSON' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Kiểm tra' })).toBeDisabled();

    await dialog.locator('input[type="file"]').setInputFiles({ name: 'hien-vat.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
    await dialog.getByRole('button', { name: 'Kiểm tra' }).click();

    await expect(dialog.getByText('Kết quả kiểm tra')).toBeVisible();
    await expect(dialog.getByText('2/3 dòng hợp lệ, 1 dòng lỗi (sẽ bị bỏ qua khi nhập).')).toBeVisible();
    const errors = dialog.getByRole('table', { name: 'Các dòng lỗi' });
    await expect(errors.getByRole('row')).toHaveCount(2);
    await expect(errors).toContainText('roomSlug: Không tìm thấy phòng có slug "phong-khong-co"');

    await dialog.getByRole('button', { name: 'Nhập 2 dòng hợp lệ' }).click();
    await expect(dialog.getByText('Kết quả nhập')).toBeVisible();
    await expect(dialog.getByText('Đã tạo 2 bản nháp; 1 dòng lỗi chưa được nhập.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Đóng' })).toBeVisible();
    expect(calls.filter((c) => c.path === 'import').map((c) => c.params.dryRun)).toEqual(['true', 'false']);

    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('Nhập: file sai đuôi bị chặn ở trình duyệt, không gọi API', async ({ page }) => {
    await installCmsExhibitsApi(page);
    const calls = await installTransferApi(page);
    await page.goto('/admin/exhibits');
    await page.getByRole('button', { name: 'Nhập', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nhập hiện vật từ CSV/JSON' });
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'bang.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') });
    await expect(dialog.getByText('Chỉ nhận file .csv hoặc .json')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Kiểm tra' })).toBeDisabled();
    expect(calls).toEqual([]);
  });

  test('Nhập: lỗi cấp file từ server hiển thị nguyên thông điệp tiếng Việt', async ({ page }) => {
    await installCmsExhibitsApi(page);
    await installTransferApi(page, { importStatus: 422 });
    await page.goto('/admin/exhibits');
    await page.getByRole('button', { name: 'Nhập', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nhập hiện vật từ CSV/JSON' });
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'sai.csv', mimeType: 'text/csv', buffer: Buffer.from('ten\nA\n') });
    await dialog.getByRole('button', { name: 'Kiểm tra' }).click();
    await expect(dialog.getByText('Cột không được hỗ trợ: ten')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Nhập/ })).toBeDisabled();
  });
});
