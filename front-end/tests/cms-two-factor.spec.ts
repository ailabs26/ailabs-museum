import { expect, test, type Page } from '@playwright/test';
import { fulfillMuseum } from './fixtures/museumApi';
import { envelope } from './fixtures/museumContent';

const USER = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@aura.local', displayName: 'Administrator', roles: ['admin'], permissions: [] as string[] };
const GOOD_CODE = '246810';
const RECOVERY = ['abcde-fghij', 'klmno-pqrst', 'uvwxy-z2345', 'aaaaa-bbbbb', 'ccccc-ddddd', 'eeeee-fffff', 'ggggg-hhhhh', 'iiiii-jjjjj', 'kkkkk-lllll', 'mmmmm-nnnnn'];
// QR 1x1 PNG hợp lệ để <img> hiển thị.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

/** API giả có trạng thái: đăng nhập (có / không 2FA), quản lý 2FA. Mọi /api/ khác trả rỗng. */
async function installApi(page: Page, options: { loggedIn: boolean; twoFactorEnabled: boolean }) {
  const state = { session: options.loggedIn, enabled: options.twoFactorEnabled, posts: [] as { path: string; body: unknown }[] };
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    const method = request.method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: {
        'Access-Control-Allow-Origin': request.headers().origin ?? 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'authorization,content-type',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      } });
      return;
    }
    const body = method === 'POST' ? (request.postDataJSON() as Record<string, unknown> | null) : null;
    if (method === 'POST') state.posts.push({ path, body });
    const fail = (status: number, message: string) => fulfillMuseum(route, { success: false, data: null, message }, status);

    if (path === '/auth/refresh') return state.session ? fulfillMuseum(route, envelope({ accessToken: 'tok' })) : fail(401, 'Unauthenticated');
    if (path === '/auth/me') {
      return request.headers().authorization && state.session
        ? fulfillMuseum(route, envelope({ ...USER, twoFactorEnabled: state.enabled }))
        : fail(401, 'Unauthenticated');
    }
    if (path === '/auth/login') return fulfillMuseum(route, envelope({ mfaRequired: true, mfaToken: 'mfa-token' }));
    if (path === '/auth/login/2fa') {
      if (body?.code === GOOD_CODE || body?.recoveryCode === RECOVERY[0]) {
        state.session = true;
        return fulfillMuseum(route, envelope({ accessToken: 'tok', user: USER }));
      }
      return fail(401, 'Mã xác thực không đúng hoặc đã hết hạn');
    }
    if (path === '/auth/2fa') return fulfillMuseum(route, envelope({ enabled: state.enabled, recoveryCodesRemaining: state.enabled ? 10 : 0 }));
    if (path === '/auth/2fa/setup') {
      return fulfillMuseum(route, envelope({ otpauthUrl: 'otpauth://totp/x', qrDataUrl: PNG, secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' }));
    }
    if (path === '/auth/2fa/enable') {
      if (body?.code !== GOOD_CODE) return fail(400, 'Mã xác thực không đúng hoặc đã hết hạn');
      state.enabled = true;
      return fulfillMuseum(route, envelope({ id: USER.id, recoveryCodes: RECOVERY }));
    }
    if (path === '/admin/stats/overview') {
      return fulfillMuseum(route, envelope({
        rooms: { total: 0, active: 0, archived: 0 }, exhibits: { total: 0, visible: 0, hidden: 0 }, revisions: { inReview: 0, draft: 0 },
        reports: { open: 0, inProgress: 0 }, system: { api: 'up', db: 'up', uptimeSec: 1, serverTime: new Date().toISOString() },
      }));
    }
    if (path === '/notifications/unread-count') return fulfillMuseum(route, envelope({ count: 0 }));
    return fulfillMuseum(route, { ...envelope([]), meta: { page: 1, pageSize: 20, total: 0 } });
  });
  return state;
}

async function passwordStep(page: Page) {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Email' }).fill('admin@aura.local');
  await page.getByLabel(/^Mật khẩu/).fill('hoa-sen-ven-ho-7');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Xác thực 2 lớp' })).toBeVisible();
}

test.describe('Đăng nhập 2 bước', () => {
  test('mã sai → báo lỗi, xóa ô nhập; mã đúng → tự gửi khi đủ 6 số và vào CMS', async ({ page }) => {
    const state = await installApi(page, { loggedIn: false, twoFactorEnabled: true });
    await passwordStep(page);

    await page.getByRole('textbox', { name: 'Chữ số 1 của mã xác thực' }).pressSequentially('000000');
    await expect(page.getByRole('alert')).toContainText('Mã xác thực không đúng');
    await expect(page.getByRole('textbox', { name: 'Chữ số 1 của mã xác thực' })).toHaveValue('');

    await page.getByRole('textbox', { name: 'Chữ số 1 của mã xác thực' }).pressSequentially(GOOD_CODE);
    await expect(page).toHaveURL(/\/admin$/);
    expect(state.posts.filter((p) => p.path === '/auth/login/2fa').map((p) => p.body)).toEqual([
      { mfaToken: 'mfa-token', code: '000000' }, { mfaToken: 'mfa-token', code: GOOD_CODE },
    ]);
  });

  test('dùng mã khôi phục thay cho mã 6 số; Quay lại về bước mật khẩu', async ({ page }) => {
    const state = await installApi(page, { loggedIn: false, twoFactorEnabled: true });
    await passwordStep(page);
    await page.getByRole('button', { name: 'Quay lại' }).click();
    await expect(page.getByRole('heading', { name: 'Đăng nhập CMS' })).toBeVisible();

    await passwordStep(page);
    await page.getByRole('button', { name: 'Dùng mã khôi phục' }).click();
    await page.getByRole('textbox', { name: 'Mã khôi phục' }).fill(RECOVERY[0]);
    await page.getByRole('button', { name: 'Xác nhận' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    expect(state.posts.at(-1)).toEqual({ path: '/auth/login/2fa', body: { mfaToken: 'mfa-token', recoveryCode: RECOVERY[0] } });
  });
});

test('Cài đặt: bật 2FA — QR + khóa nhập tay → mã đúng → 10 mã khôi phục, phải xác nhận đã lưu mới đóng được', async ({ page }) => {
  const state = await installApi(page, { loggedIn: true, twoFactorEnabled: false });
  await page.goto('/admin/settings/two-factor');
  await expect(page.getByText('Đang tắt')).toBeVisible();

  await page.getByRole('button', { name: 'Bật xác thực 2 lớp' }).click();
  await expect(page.getByRole('img', { name: 'Mã QR thiết lập xác thực 2 lớp' })).toBeVisible();
  await expect(page.getByText('JBSW Y3DP EHPK 3PXP')).toBeVisible();
  const confirm = page.getByRole('button', { name: 'Bật xác thực 2 lớp' });
  await expect(confirm).toBeDisabled();

  await page.getByRole('textbox', { name: 'Mã xác thực — chữ số 1' }).pressSequentially('111111');
  await confirm.click();
  await expect(page.getByRole('alert')).toContainText('Mã xác thực không đúng');

  await page.getByRole('textbox', { name: 'Mã xác thực — chữ số 1' }).pressSequentially(GOOD_CODE);
  await confirm.click();
  await expect(page.getByText('Lưu các mã khôi phục này ngay')).toBeVisible();
  for (const code of RECOVERY) await expect(page.getByText(code, { exact: true })).toBeVisible();
  const done = page.getByRole('button', { name: 'Xong' });
  await expect(done).toBeDisabled();
  await page.getByLabel('Tôi đã lưu các mã khôi phục ở nơi an toàn').check();
  await done.click();

  await expect(page.getByText('Đang bật')).toBeVisible();
  await expect(page.getByText('/10 mã khôi phục chưa dùng')).toBeVisible();
  expect(state.posts.map((p) => p.path).filter((p) => p.startsWith('/auth/2fa'))).toEqual(['/auth/2fa/setup', '/auth/2fa/enable', '/auth/2fa/enable']);
});
