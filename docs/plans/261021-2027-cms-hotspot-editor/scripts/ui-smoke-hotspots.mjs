// Smoke UI hotspot editor trên Vite 5174 → API 3091 (Supabase thật). Dùng model có sẵn, tự xóa hiện vật nháp.
// Chạy: node ui-smoke-hotspots.mjs <front-end> <back-end>
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
/** Model seed có sẵn (cọc gỗ Bạch Đằng, 3,56 MB) — option hiện "… · 3.6 MB". */
const MODEL_OPTION = /3\.6 MB/;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

let exhibitId = null;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('response', async (res) => {
  if (res.request().method() === 'POST' && res.url().endsWith('/admin/exhibits') && res.status() === 201) {
    exhibitId = (await res.json()).data.id;
  }
});

async function pick(scope, label, option) {
  await scope.getByRole('textbox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option }).first().click();
}
const num = async (locator) => Number((await locator.inputValue()).replace(',', '.'));

let token;
try {
  await page.goto(`${WEB}/admin/login`);
  await page.getByLabel('Email').fill(process.env.SEED_ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu').fill(process.env.SEED_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await page.waitForURL(`${WEB}/admin`);
  token = await page.evaluate(async (api) => {
    const r = await fetch(`${api}/auth/refresh`, { method: 'POST', credentials: 'include' });
    return (await r.json()).data?.accessToken;
  }, API);
  const api = (path, init = {}) => fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } }).then((r) => r.json());

  // 1. Tạo nháp, gắn model, thêm hotspot thiếu tiếng Anh → validate chặn, chuyển tab Hotspots
  await page.goto(`${WEB}/admin/exhibits`);
  await page.getByRole('button', { name: 'Thêm hiện vật' }).click();
  const form = page.getByRole('dialog', { name: /Thêm hiện vật mới/ });
  await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog] input')].some((i) => i.value.includes('(')));
  await form.getByLabel('Tên hiện vật (Tiếng Việt)').fill('[E2E Hotspot] Hiện vật thử');
  await form.getByLabel('Tên hiện vật (Tiếng Anh)').fill('[E2E Hotspot] Test exhibit');
  await form.getByRole('tab', { name: /Media & thuyết minh/ }).click();
  await pick(form, 'Model 3D (GLB)', MODEL_OPTION);
  await form.getByRole('tab', { name: /Hotspots/ }).click();
  await form.getByRole('button', { name: 'Thêm hotspot' }).click();
  await form.getByLabel('Tiêu đề (Tiếng Việt)').first().fill('Đầu cọc');
  await form.getByRole('tab', { name: /Thông tin cơ bản/ }).click();
  await form.getByRole('button', { name: 'Tạo bản nháp' }).click();
  await page.waitForTimeout(500);
  const onHotspotTab = await form.getByRole('tab', { name: /Hotspots/ }).getAttribute('aria-selected');
  const enInvalid = await form.getByLabel('Tiêu đề (Tiếng Anh)').first().getAttribute('aria-invalid');
  check('Hotspot thiếu tiếng Anh → không lưu, chuyển tab Hotspots, ô bị đánh dấu', onHotspotTab === 'true' && enInvalid === 'true' && !exhibitId);

  // 2. Điền đủ, bấm lên mô hình để lấy tọa độ
  await form.getByLabel('Tiêu đề (Tiếng Anh)').first().fill('Stake head');
  await form.getByLabel('Nội dung (Tiếng Việt)').first().fill('Đầu cọc được vạt nhọn.');
  await form.getByLabel('Nội dung (Tiếng Anh)').first().fill('The stake head is sharpened.');
  const canvas = form.locator('canvas');
  await canvas.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  const box = await canvas.boundingBox();
  // Bấm dò từ giữa khung theo chiều dọc tới khi trúng bề mặt mô hình.
  let picked = false;
  for (const fy of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * fy);
    await page.waitForTimeout(200);
    const values = [await num(form.getByLabel('Vị trí X').first()), await num(form.getByLabel('Vị trí Y').first()), await num(form.getByLabel('Vị trí Z').first())];
    if (values.some((v) => v !== 0)) { picked = values; break; }
  }
  check('Bấm lên mô hình 3D điền tọa độ hotspot', !!picked, JSON.stringify(picked));
  await page.screenshot({ path: join(SHOTS, '1-hotspot-picker.png') });

  // 3. Hotspot thứ hai nhập tọa độ tay
  await form.getByRole('button', { name: 'Thêm hotspot' }).click();
  await form.getByLabel('Tiêu đề (Tiếng Việt)').nth(1).fill('Thân cọc');
  await form.getByLabel('Tiêu đề (Tiếng Anh)').nth(1).fill('Stake body');
  await form.getByLabel('Nội dung (Tiếng Việt)').nth(1).fill('Thân cọc gỗ lim.');
  await form.getByLabel('Nội dung (Tiếng Anh)').nth(1).fill('Ironwood body.');
  await form.getByLabel('Vị trí Y').nth(1).fill('0.25');
  await form.getByRole('button', { name: 'Tạo bản nháp' }).click();
  await form.waitFor({ state: 'hidden' });
  check('Tạo bản nháp có hotspot', !!exhibitId, exhibitId ?? '');
  let detail = (await api(`/admin/exhibits/${exhibitId}`)).data;
  const labels = detail.hotspots.map((h) => JSON.parse(h.label));
  check('Server lưu 2 hotspot song ngữ đúng thứ tự + tọa độ',
    detail.hotspots.length === 2 && labels[0].en === 'Stake head' && labels[1].vi === 'Thân cọc'
      && Math.abs(detail.hotspots[0].position.y - picked[1]) < 1e-6 && detail.hotspots[1].position.y === 0.25,
    JSON.stringify(detail.hotspots.map((h) => [JSON.parse(h.label).vi, h.position])));

  // 4. Mở sửa: hotspot được nạp lại; đổi thứ tự rồi lưu
  await page.getByPlaceholder(/Tìm kiếm hiện vật/).fill('E2E Hotspot');
  const row = page.getByRole('row').filter({ hasText: '[E2E Hotspot] Hiện vật thử' });
  await row.waitFor();
  await row.getByRole('button').nth(1).click();
  const edit = page.getByRole('dialog', { name: /Chỉnh sửa hiện vật/ });
  await edit.getByRole('tab', { name: 'Hotspots (2)' }).click();
  const loaded = await edit.getByLabel('Tiêu đề (Tiếng Anh)').nth(1).inputValue();
  check('Mở sửa: nạp lại hotspot từ server', loaded === 'Stake body', loaded);
  await edit.getByRole('button', { name: 'Đưa hotspot #2 lên trên' }).click();
  await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await edit.waitFor({ state: 'hidden' });
  detail = (await api(`/admin/exhibits/${exhibitId}`)).data;
  const order = [...detail.hotspots].sort((a, b) => a.displayOrder - b.displayOrder).map((h) => JSON.parse(h.label).vi);
  check('Đổi thứ tự hotspot được lưu', order.join('|') === 'Thân cọc|Đầu cọc', order.join('|'));

  // 5. Sửa phần khác khi không đụng hotspot → hotspot giữ nguyên
  await row.getByRole('button').nth(1).click();
  await edit.getByLabel('Tên hiện vật (Tiếng Anh)').fill('[E2E Hotspot] Test exhibit 2');
  await edit.getByRole('tab', { name: 'Hotspots (2)' }).waitFor();
  await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await edit.waitFor({ state: 'hidden' });
  detail = (await api(`/admin/exhibits/${exhibitId}`)).data;
  check('Lưu thay đổi khác vẫn giữ 2 hotspot', detail.hotspots.length === 2);

  // 6. Drawer chi tiết hiện tiêu đề đã giải mã (không phải chuỗi JSON)
  await row.getByRole('button').nth(0).click();
  const det = page.getByRole('dialog', { name: /Chi tiết hiện vật/ });
  await det.getByRole('tab', { name: /Hotspots/ }).click();
  const text = await det.getByText(/#1:/).innerText();
  check('Chi tiết: tiêu đề hotspot hiển thị đúng chữ', text.includes('Thân cọc') && !text.includes('{'), text);
  await det.screenshot({ path: join(SHOTS, '2-detail-hotspots.png') });
} catch (error) {
  check('Lỗi bất ngờ', false, error.message.split('\n')[0]);
  await page.screenshot({ path: join(SHOTS, 'error.png'), fullPage: true }).catch(() => {});
} finally {
  if (token && exhibitId) {
    const r = await fetch(`${API}/admin/exhibits/${exhibitId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    console.log(`🧹 xóa hiện vật nháp: HTTP ${r.status}`);
  }
  const relevant = consoleErrors.filter((e) => !/favicon|DevTools|401/.test(e));
  console.log(`Console errors: ${relevant.length}${relevant.length ? '\n  ' + relevant.slice(0, 5).join('\n  ') : ''}`);
  await browser.close();
  console.log(`\nKết quả: ${results.filter(Boolean).length}/${results.length} đạt`);
}
