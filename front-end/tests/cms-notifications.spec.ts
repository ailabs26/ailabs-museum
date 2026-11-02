import { expect, test, type Page } from '@playwright/test';
import { fulfillMuseum } from './fixtures/museumApi';
import { envelope } from './fixtures/museumContent';

type Note = { id: string; type: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string };

const LONG_REASON = 'Thiếu nguồn tham khảo cho niên đại. '.repeat(6).trim();

/** API giả có trạng thái: phiên admin + 12 thông báo (mới nhất trước); đọc/xóa thay đổi dữ liệu thật. */
async function installApi(page: Page) {
  const now = Date.now();
  const notes: Note[] = Array.from({ length: 12 }, (_, i) => ({
    id: `n${String(i + 1).padStart(2, '0')}`,
    type: i === 0 ? 'revision.rejected' : 'report.created',
    title: i === 0 ? 'Bản nội dung bị từ chối: Trống đồng' : `Báo cáo vi phạm mới số ${i + 1}`,
    body: i === 0 ? LONG_REASON : null,
    link: i === 0 ? '/admin/exhibits' : '/admin/reports',
    read: i >= 3,
    createdAt: new Date(now - i * 60 * 60_000).toISOString(),
  }));
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'admin@aura.local', displayName: 'Admin',
    roles: ['admin'], permissions: ['audit:read', 'report:read', 'exhibit:read'] };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    const path = url.pathname.replace('/api', '');
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
    if (path === '/auth/refresh') return fulfillMuseum(route, envelope({ accessToken: 'notifications-fixture-token' }));
    if (path === '/auth/me') {
      // Lần đầu không có token → 401 để app tự refresh rồi gọi lại (đúng luồng khôi phục phiên).
      return request.headers().authorization
        ? fulfillMuseum(route, envelope(user))
        : fulfillMuseum(route, { success: false, data: null, message: 'Unauthenticated' }, 401);
    }
    if (method === 'GET' && path === '/notifications/unread-count') {
      return fulfillMuseum(route, envelope({ count: notes.filter((n) => !n.read).length }));
    }
    if (method === 'GET' && path === '/notifications') {
      const pageNo = Number(url.searchParams.get('page') ?? 1);
      const size = Number(url.searchParams.get('pageSize') ?? 10);
      return fulfillMuseum(route, { ...envelope(notes.slice((pageNo - 1) * size, pageNo * size)),
        meta: { page: pageNo, pageSize: size, total: notes.length } });
    }
    if (method === 'POST' && path === '/notifications/read-all') {
      const updated = notes.filter((n) => !n.read).length;
      notes.forEach((n) => { n.read = true; });
      return fulfillMuseum(route, envelope({ updated }));
    }
    const read = /^\/notifications\/([^/]+)\/read$/.exec(path);
    if (method === 'PATCH' && read) {
      notes.find((n) => n.id === read[1])!.read = true;
      return fulfillMuseum(route, envelope(null));
    }
    const del = /^\/notifications\/([^/]+)$/.exec(path);
    if (method === 'DELETE' && del) {
      notes.splice(notes.findIndex((n) => n.id === del[1]), 1);
      return fulfillMuseum(route, envelope(null));
    }
    if (path === '/admin/stats/overview') {
      return fulfillMuseum(route, envelope({
        rooms: { total: 0, active: 0, archived: 0 }, exhibits: { total: 0, visible: 0, hidden: 0 },
        revisions: { inReview: 0, draft: 0 }, reports: { open: 0, inProgress: 0 },
        system: { api: 'up', db: 'up', uptimeSec: 1, serverTime: new Date().toISOString() },
      }));
    }
    // Trang nền (nhật ký, badge sidebar): danh sách rỗng là đủ.
    return fulfillMuseum(route, { ...envelope([]), meta: { page: 1, pageSize: 20, total: 0 } });
  });
}

test.describe('Chuông thông báo CMS', () => {
  test.beforeEach(async ({ page }) => {
    await installApi(page);
    await page.goto('/admin/audit');
  });

  const bell = (page: Page) => page.getByRole('button', { name: /^Thông báo \(/ });
  const list = (page: Page) => page.getByRole('list', { name: 'Danh sách thông báo' });

  test('badge số chưa đọc; mở thấy 10 mục, "Xem thêm" tải thêm 2 mục cũ hơn rồi ẩn nút', async ({ page }) => {
    await expect(bell(page)).toHaveAccessibleName('Thông báo (3 chưa đọc)');
    await bell(page).click();
    await expect(list(page).getByRole('listitem')).toHaveCount(10);
    await page.getByRole('button', { name: 'Xem thêm', exact: true }).last().click();
    await expect(list(page).getByRole('listitem')).toHaveCount(12);
    await expect(list(page).getByText('Báo cáo vi phạm mới số 12')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xem thêm', exact: true })).toHaveCount(1); // chỉ còn nút mở rộng nội dung
  });

  test('nội dung dài bị cắt, "Xem thêm" mở rộng và "Thu gọn" thu lại', async ({ page }) => {
    await bell(page).click();
    const first = list(page).getByRole('listitem').first();
    const toggle = first.getByRole('button', { name: 'Xem thêm' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(first.getByRole('button', { name: 'Thu gọn' })).toHaveAttribute('aria-expanded', 'true');
    await first.getByRole('button', { name: 'Thu gọn' }).click();
    await expect(first.getByRole('button', { name: 'Xem thêm' })).toBeVisible();
  });

  test('đánh dấu một mục đã đọc, xóa một mục, rồi đánh dấu tất cả đã đọc', async ({ page }) => {
    await bell(page).click();
    await page.getByRole('button', { name: 'Đánh dấu đã đọc: Báo cáo vi phạm mới số 2' }).click();
    await expect(bell(page)).toHaveAccessibleName('Thông báo (2 chưa đọc)');
    await expect(page.getByRole('button', { name: 'Đánh dấu đã đọc: Báo cáo vi phạm mới số 2' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Xóa thông báo: Báo cáo vi phạm mới số 5' }).click();
    await expect(list(page).getByText('Báo cáo vi phạm mới số 5', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).click();
    await expect(bell(page)).toHaveAccessibleName('Thông báo (0 chưa đọc)');
    await expect(page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })).toBeDisabled();
  });

  test('bấm tiêu đề → đánh dấu đã đọc và mở trang liên kết', async ({ page }) => {
    await bell(page).click();
    await page.getByRole('button', { name: 'Bản nội dung bị từ chối: Trống đồng', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/exhibits$/);
    await expect(bell(page)).toHaveAccessibleName('Thông báo (2 chưa đọc)');
  });
});
