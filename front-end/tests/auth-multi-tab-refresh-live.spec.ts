import { expect, test, type Page } from '@playwright/test';

/**
 * Issue #141: hai tab cùng phiên tải lại đồng thời không được bị đăng xuất.
 * Cần back-end thật + tài khoản admin; GHI vào DB (tạo phiên) → chỉ chạy trên DB tạm/local.
 * Back-end phải nâng `REFRESH_RATE_LIMIT_PER_SESSION` (vd 1000): 2 tab × 20 vòng vượt mức mặc định 30/phút/phiên (#126).
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const ROUNDS = 20;

/** Ghi lại mã trạng thái của mọi response /auth/refresh trên trang. */
function trackRefresh(page: Page, statuses: number[]) {
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('/auth/refresh')) statuses.push(response.status());
  });
}

test('2 tab cùng phiên tải lại đồng thời 20 lần → không tab nào bị đăng xuất', async ({ context }) => {
  test.skip(process.env.MUSEUM_LIVE_TEST !== '1' || !email || !password,
    'Cần MUSEUM_LIVE_TEST=1, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD và back-end thật (ghi DB).');
  test.setTimeout(180_000);

  const first = await context.newPage();
  await first.goto('/admin/login');
  await first.getByLabel('Email').fill(email!);
  await first.getByLabel('Mật khẩu').fill(password!);
  await first.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(first).not.toHaveURL(/\/admin\/login/);

  const second = await context.newPage();
  await second.goto('/admin');
  await expect(second).not.toHaveURL(/\/admin\/login/);

  const statuses: number[] = [];
  trackRefresh(first, statuses);
  trackRefresh(second, statuses);

  for (let round = 1; round <= ROUNDS; round++) {
    await Promise.all([first.reload(), second.reload()]);
    for (const page of [first, second]) {
      await expect(page.getByRole('navigation').first(), `vòng ${round}`).toBeVisible();
      await expect(page, `vòng ${round}`).not.toHaveURL(/\/admin\/login/);
    }
  }

  // Mỗi lần tải lại, mỗi tab refresh 1 lần; không lần nào bị từ chối.
  expect(statuses.length).toBeGreaterThanOrEqual(ROUNDS * 2);
  expect(statuses.filter((status) => status !== 200)).toEqual([]);
});
