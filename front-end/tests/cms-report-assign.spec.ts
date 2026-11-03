import { expect, test, type Page } from '@playwright/test';
import { fulfillMuseum } from './fixtures/museumApi';
import { envelope } from './fixtures/museumContent';

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@aura.local', displayName: 'Quản trị viên' };
const MOD = { id: '00000000-0000-4000-8000-0000000000b0', email: 'mod@aura.local', displayName: 'Kiểm duyệt viên' };
const REPORT_ID = '50000000-0000-4000-8000-000000000001';

/** API giả có trạng thái cho trang Báo cáo: một báo cáo đang mở, giao/tiếp nhận cập nhật người giữ. */
async function installApi(page: Page) {
  const report = {
    id: REPORT_ID, exhibitId: '10000000-0000-4000-8000-000000000001', category: 'wrong_info',
    message: 'Niên đại ghi sai', status: 'open', assignedTo: null as typeof ADMIN | null, resolution: null,
    reportedRevision: null, createdAt: '2026-11-02T00:00:00Z', resolvedAt: null,
  };
  const assignBodies: unknown[] = [];

  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    const method = request.method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: {
        'Access-Control-Allow-Origin': request.headers().origin ?? 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'authorization,content-type',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      } });
      return;
    }
    if (path === '/auth/refresh') return fulfillMuseum(route, envelope({ accessToken: 'report-assign-token' }));
    if (path === '/auth/me') {
      return request.headers().authorization
        ? fulfillMuseum(route, envelope({ ...ADMIN, roles: ['admin'], permissions: ['report:read', 'report:resolve'] }))
        : fulfillMuseum(route, { success: false, data: null, message: 'Unauthenticated' }, 401);
    }
    if (path === '/admin/stats/overview') {
      return fulfillMuseum(route, envelope({
        rooms: { total: 0, active: 0, archived: 0 }, exhibits: { total: 0, visible: 0, hidden: 0 },
        revisions: { inReview: 0, draft: 0 }, reports: { open: 1, inProgress: 0 },
        system: { api: 'up', db: 'up', uptimeSec: 1, serverTime: new Date().toISOString() },
      }));
    }
    if (path === '/reports/assignees') return fulfillMuseum(route, envelope([ADMIN, MOD]));
    if (path === `/reports/${REPORT_ID}/assign` && method === 'POST') {
      const body = request.postDataJSON() as { assigneeId?: string };
      assignBodies.push(body);
      report.status = 'in_progress';
      report.assignedTo = body.assigneeId === MOD.id ? MOD : ADMIN;
      return fulfillMuseum(route, envelope(report));
    }
    if (path === `/reports/${REPORT_ID}`) return fulfillMuseum(route, envelope(report));
    if (path === '/reports') return fulfillMuseum(route, { ...envelope([report]), meta: { page: 1, pageSize: 20, total: 1 } });
    if (path === '/notifications/unread-count') return fulfillMuseum(route, envelope({ count: 0 }));
    return fulfillMuseum(route, { ...envelope([]), meta: { page: 1, pageSize: 20, total: 0 } });
  });
  return { assignBodies };
}

async function openReport(page: Page) {
  await page.goto('/admin/reports');
  await page.getByRole('row').filter({ hasText: 'Niên đại ghi sai' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  return drawer;
}

test.describe('Giao báo cáo cho người khác', () => {
  test('chọn người rồi bấm Giao → gửi assigneeId, hiện người tiếp nhận mới; người đang giữ bị loại khỏi danh sách', async ({ page }) => {
    const { assignBodies } = await installApi(page);
    const drawer = await openReport(page);

    const giao = drawer.getByRole('button', { name: 'Giao', exact: true });
    await expect(giao).toBeDisabled();
    await drawer.getByRole('textbox', { name: 'Giao cho người khác' }).click();
    await page.getByRole('option', { name: /Kiểm duyệt viên/ }).click();
    await giao.click();

    await expect(page.getByText('Đã giao báo cáo cho Kiểm duyệt viên')).toBeVisible();
    expect(assignBodies).toEqual([{ assigneeId: MOD.id }]);
    await expect(drawer.getByText('Kiểm duyệt viên', { exact: true })).toBeVisible();

    // Đang xử lý: nhãn đổi thành "Giao lại cho", không còn lựa chọn người đang giữ.
    await drawer.getByRole('textbox', { name: 'Giao lại cho' }).click();
    await expect(page.getByRole('option', { name: /Quản trị viên/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Kiểm duyệt viên/ })).toHaveCount(0);
  });

  test('Tiếp nhận (tự nhận) vẫn gửi body rỗng như cũ', async ({ page }) => {
    const { assignBodies } = await installApi(page);
    const drawer = await openReport(page);
    await drawer.getByRole('button', { name: 'Tiếp nhận', exact: true }).click();
    await expect(page.getByText('Đã tiếp nhận báo cáo')).toBeVisible();
    expect(assignBodies).toEqual([{}]);
  });
});
