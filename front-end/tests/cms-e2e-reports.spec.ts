import { expect, test, type Page } from '@playwright/test';
import { installCmsReportsWorkflowApi } from './fixtures/cmsReportsWorkflowApi';

const OPEN_MESSAGE = 'Mô tả hiện vật có thông tin niên đại lịch sử chưa chính xác.';
const RESOLVED_MESSAGE = 'Sai chính tả ở tên hiện vật.';

async function openReport(page: Page, message: string) {
  await page.getByRole('row').filter({ hasText: message }).click();
  const drawer = page.getByRole('dialog', { name: 'Chi tiết báo cáo' });
  await expect(drawer).toBeVisible();
  return drawer;
}

test.describe('E2E: Xử lý Báo cáo vi phạm (Content Reports Workflow)', () => {
  test('Hiển thị danh sách báo cáo vi phạm và lọc theo trạng thái', async ({ page }) => {
    await installCmsReportsWorkflowApi(page);
    await page.goto('/admin/reports');

    await expect(page.getByRole('heading', { name: 'Báo cáo vi phạm' })).toBeVisible();
    await expect(page.getByText(OPEN_MESSAGE)).toBeVisible();
    await expect(page.getByText(RESOLVED_MESSAGE)).toBeVisible();

    // Lọc "Đã xử lý" → chỉ còn báo cáo đã xử lý
    await page.getByRole('textbox', { name: 'Trạng thái' }).click();
    await page.getByRole('option', { name: 'Đã xử lý' }).click();
    await expect(page.getByText(RESOLVED_MESSAGE)).toBeVisible();
    await expect(page.getByText(OPEN_MESSAGE)).toHaveCount(0);
  });

  test('Admin tiếp nhận báo cáo và chuyển sang trạng thái Đang xử lý', async ({ page }) => {
    const { writes } = await installCmsReportsWorkflowApi(page);
    await page.goto('/admin/reports');

    const drawer = await openReport(page, OPEN_MESSAGE);
    await expect(drawer.getByText('Trống Đồng Đông Sơn')).toBeVisible();
    await drawer.getByRole('button', { name: 'Tiếp nhận', exact: true }).click();

    await expect(page.getByText('Đã tiếp nhận báo cáo')).toBeVisible();
    await expect(drawer.getByText('Đang xử lý')).toBeVisible();
    await expect(drawer.getByText('Administrator')).toBeVisible();
    expect(writes.filter((w) => w.path.endsWith('/assign'))).toHaveLength(1);
  });

  test('Admin xử lý xong báo cáo vi phạm kèm kết luận', async ({ page }) => {
    const { writes } = await installCmsReportsWorkflowApi(page);
    await page.goto('/admin/reports');

    const drawer = await openReport(page, OPEN_MESSAGE);
    await drawer.getByRole('button', { name: 'Xử lý xong' }).click();

    const modal = page.getByRole('dialog', { name: 'Xử lý xong báo cáo' });
    await expect(modal).toBeVisible();
    const confirm = modal.getByRole('button', { name: 'Xác nhận' });
    await expect(confirm).toBeDisabled(); // bắt buộc có kết luận

    const resolution = 'Đã hiệu chỉnh lại niên đại từ thế kỷ VII TCN thành thế kỷ V TCN.';
    await modal.getByLabel('Kết luận xử lý').fill(resolution);
    await confirm.click();

    await expect(page.getByText('Đã xử lý báo cáo')).toBeVisible();
    await expect(modal).toHaveCount(0);
    const resolveCall = writes.find((w) => w.path.endsWith('/resolve'));
    expect(resolveCall?.data).toEqual({ resolution });
  });

  test('Admin đóng/bác báo cáo bằng mẫu kết luận có sẵn', async ({ page }) => {
    const { writes } = await installCmsReportsWorkflowApi(page);
    await page.goto('/admin/reports');

    const drawer = await openReport(page, OPEN_MESSAGE);
    await drawer.getByRole('button', { name: 'Đóng/bác' }).click();

    const modal = page.getByRole('dialog', { name: 'Đóng/bác báo cáo' });
    await modal.getByRole('button', { name: 'Không vi phạm' }).click();
    await expect(modal.getByLabel('Kết luận xử lý')).toHaveValue(/không vi phạm quy định/);
    await modal.getByRole('button', { name: 'Xác nhận' }).click();

    await expect(page.getByText('Đã đóng báo cáo')).toBeVisible();
    const dismissCall = writes.find((w) => w.path.endsWith('/dismiss'));
    expect((dismissCall?.data as { resolution: string }).resolution).toMatch(/không vi phạm quy định/);
  });
});
