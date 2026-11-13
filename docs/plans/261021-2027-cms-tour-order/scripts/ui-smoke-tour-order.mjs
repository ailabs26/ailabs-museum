// Smoke UI thứ tự tour trên Vite 5174 → API 3091 (Supabase thật). Dùng phòng thử riêng (lưu trữ, không
// công khai) + 3 bản nháp để không đụng thứ tự phòng thật; tự dọn trong finally.
// Chạy: node ui-smoke-tour-order.mjs <front-end> <back-end>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const FE = process.argv[2];
const BE = process.argv[3];
const require = createRequire(join(FE, 'package.json'));
const { chromium } = require('playwright');
process.loadEnvFile(join(BE, '.env'));

const SHOTS = join(fileURLToPath(new URL('.', import.meta.url)), 'shots');
mkdirSync(SHOTS, { recursive: true });
const WEB = 'http://localhost:5174';
const API = 'http://localhost:3091/api';
const SLUG = `e2e-tour-${Date.now()}`;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

let token = null;
let roomId = null;
const exhibitIds = {};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
const api = (path, init = {}) => fetch(`${API}${path}`, {
  ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
}).then((r) => r.json());

/** Thứ tự hiện vật thử theo API (displayOrder). */
async function serverOrder() {
  const rows = (await api(`/admin/exhibits?roomId=${roomId}&pageSize=100`)).data;
  return [...rows].sort((a, b) => a.displayOrder - b.displayOrder).map((row) => row.content.name.vi.replace('[E2E Tour] ', '')).join(',');
}
/** Thứ tự đang hiện trong modal. */
async function modalOrder(modal) {
  const items = await modal.getByRole('listitem').allInnerTexts();
  return items.map((text) => (text.match(/\[E2E Tour\] (\w)/) ?? [])[1]).join(',');
}

try {
  await page.goto(`${WEB}/admin/login`);
  await page.getByLabel('Email').fill(process.env.SEED_ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu').fill(process.env.SEED_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await page.waitForURL(`${WEB}/admin`);
  token = await page.evaluate(async (url) => {
    const r = await fetch(`${url}/auth/refresh`, { method: 'POST', credentials: 'include' });
    return (await r.json()).data?.accessToken;
  }, API);

  roomId = (await api('/admin/rooms', { method: 'POST', body: JSON.stringify({ slug: SLUG, name: 'E2E Tour' }) })).data?.id;
  await api(`/admin/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
  for (const [order, key] of ['A', 'B', 'C'].entries()) {
    const created = await api('/admin/exhibits', {
      method: 'POST',
      body: JSON.stringify({ roomId, name: { vi: `[E2E Tour] ${key}`, en: `[E2E Tour] ${key}` }, displayOrder: order + 1, position: { x: order * 3 - 3, y: 0, z: 0 } }),
    });
    exhibitIds[key] = created.data?.id;
  }
  check('Tạo phòng thử (lưu trữ) + 3 bản nháp', !!roomId && Object.values(exhibitIds).every(Boolean), await serverOrder());

  // 1. Mở modal, chọn phòng thử, thấy đúng thứ tự hiện tại
  await page.goto(`${WEB}/admin/exhibits`);
  await page.getByRole('button', { name: 'Thứ tự tour' }).click();
  const modal = page.getByRole('dialog', { name: 'Thứ tự hiện vật & guided tour' });
  await modal.getByRole('textbox', { name: 'Phòng trưng bày' }).click();
  await page.getByRole('option', { name: `E2E Tour (${SLUG})` }).click();
  await modal.getByRole('listitem').first().waitFor();
  await page.waitForTimeout(300);
  check('Modal hiện thứ tự hiện tại của phòng', (await modalOrder(modal)) === 'A,B,C', await modalOrder(modal));
  check('Nút lưu tắt khi chưa đổi gì', await modal.getByRole('button', { name: 'Lưu thứ tự' }).isDisabled());

  // 2. Nút lên/xuống (bàn phím) + Hoàn tác
  await modal.getByRole('button', { name: 'Đưa "[E2E Tour] C" lên trên' }).click();
  await modal.getByRole('button', { name: 'Đưa "[E2E Tour] C" lên trên' }).click();
  check('Nút lên trên đổi thứ tự', (await modalOrder(modal)) === 'C,A,B', await modalOrder(modal));
  await modal.getByRole('button', { name: 'Hoàn tác' }).click();
  check('Hoàn tác trả về thứ tự đã lưu', (await modalOrder(modal)) === 'A,B,C', await modalOrder(modal));

  // 3. Kéo-thả: B lên đầu, rồi C lên trên A → B,C,A
  await modal.getByRole('listitem').nth(1).dragTo(modal.getByRole('listitem').nth(0));
  await modal.getByRole('button', { name: 'Đưa "[E2E Tour] C" lên trên' }).click();
  const beforeSave = await modalOrder(modal);
  check('Kéo-thả đổi thứ tự', beforeSave === 'B,C,A', beforeSave);
  await page.screenshot({ path: join(SHOTS, '1-tour-order.png') });
  await modal.getByRole('button', { name: 'Lưu thứ tự' }).click();
  await page.getByText('Đã lưu thứ tự tour của phòng').waitFor();
  check('Lưu: server cập nhật displayOrder', (await serverOrder()) === 'B,C,A', await serverOrder());

  // 4. Mở lại modal: thứ tự được giữ (FR-79)
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Thứ tự tour' }).click();
  await modal.getByRole('textbox', { name: 'Phòng trưng bày' }).click();
  await page.getByRole('option', { name: `E2E Tour (${SLUG})` }).click();
  await page.waitForTimeout(800);
  check('Mở lại: thứ tự đã lưu được giữ', (await modalOrder(modal)) === 'B,C,A', await modalOrder(modal));
} catch (error) {
  check('Lỗi bất ngờ', false, error.message.split('\n')[0]);
  await page.screenshot({ path: join(SHOTS, 'error.png'), fullPage: true }).catch(() => {});
} finally {
  if (token) {
    for (const id of Object.values(exhibitIds).filter(Boolean)) {
      const r = await fetch(`${API}/admin/exhibits/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      console.log(`🧹 xóa hiện vật nháp: HTTP ${r.status}`);
    }
    if (roomId) {
      const r = await fetch(`${API}/admin/rooms/${roomId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      console.log(`🧹 xóa phòng thử: HTTP ${r.status}`);
    }
  }
  const relevant = consoleErrors.filter((e) => !/favicon|DevTools|401/.test(e));
  console.log(`Console errors: ${relevant.length}${relevant.length ? '\n  ' + relevant.slice(0, 5).join('\n  ') : ''}`);
  await browser.close();
  console.log(`\nKết quả: ${results.filter(Boolean).length}/${results.length} đạt`);
}
