// Smoke UI Task 10 trên Vite 5174 → API 3091 (Supabase thật). Tự dọn dữ liệu tạo ra.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const FE = process.argv[2];
const BE = process.argv[3];
const require = createRequire(join(FE, 'package.json'));
const { chromium } = require('playwright');
process.loadEnvFile(join(BE, '.env'));

const DIR = fileURLToPath(new URL('.', import.meta.url));
const FILES = join(DIR, 't10files');
const SHOTS = join(DIR, 'shots');
const WEB = 'http://localhost:5174';
const API = 'http://localhost:3091/api';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const created = { media: [], exhibit: null };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('response', async (res) => {
  const url = res.url();
  if (res.request().method() === 'POST' && url.endsWith('/admin/media/upload') && res.status() === 201) {
    created.media.push((await res.json()).data);
  }
  if (res.request().method() === 'POST' && url.endsWith('/admin/exhibits') && res.status() === 201) {
    created.exhibit = (await res.json()).data;
  }
});

/** Chọn option trong Select của Mantine theo label ô và một phần nội dung option. */
async function pick(scope, label, optionText) {
  await scope.getByRole('textbox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: new RegExp(optionText) }).first().click();
}

let token;
try {
  // 1. Đăng nhập
  await page.goto(`${WEB}/admin/login`);
  await page.getByLabel('Email').fill(process.env.SEED_ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu').fill(process.env.SEED_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await page.waitForURL(`${WEB}/admin`);
  token = await page.evaluate(async (api) => {
    const r = await fetch(`${api}/auth/refresh`, { method: 'POST', credentials: 'include' });
    return (await r.json()).data?.accessToken;
  }, API);
  check('Đăng nhập CMS', !!token);

  // 2. Trang Media: upload 4 loại, điền quyền sử dụng ngay sau upload
  await page.goto(`${WEB}/admin/media`);
  await page.getByRole('heading', { name: 'Media' }).waitFor();
  check('Trang Media thay placeholder', true);
  const uploads = [
    ['Hình ảnh', 'e2e-task10-anh.png'],
    ['Audio (MP3)', 'e2e-task10-audio.mp3'],
    ['Phụ đề (WebVTT)', 'e2e-task10-phude.vtt'],
    ['Model 3D (GLB)', 'e2e-task10-model.glb'],
  ];
  for (const [kindLabel, file] of uploads) {
    await pick(page, 'Loại media', kindLabel.replace(/[()]/g, '.'));
    await page.locator('input[type=file]').setInputFiles(join(FILES, file));
    const drawer = page.getByRole('dialog', { name: 'Thông tin media' });
    await drawer.waitFor({ timeout: 180_000 });
    await drawer.getByLabel('Nguồn').fill('E2E Task 10');
    await drawer.getByLabel('Tác giả').fill('Claude');
    await drawer.getByLabel('Giấy phép / điều kiện sử dụng').fill('CC0');
    await drawer.getByRole('button', { name: 'Lưu' }).click();
    await drawer.waitFor({ state: 'hidden' });
    check(`Upload + điền quyền: ${file}`, true);
  }
  check('Đã ghi nhận 4 media tạo ra', created.media.length === 4, created.media.map((m) => m.kind).join(','));
  await page.getByPlaceholder(/Tìm theo tên tệp/).fill('e2e-task10');
  await page.getByRole('row').filter({ hasText: 'e2e-task10-model.glb' }).waitFor();
  const rightsOk = await page.getByText('Đủ', { exact: true }).count();
  check('Cột quyền sử dụng = Đủ cho 4 media', rightsOk === 4, `${rightsOk}`);
  await page.screenshot({ path: join(SHOTS, '1-media-library.png'), fullPage: true });

  // 3. Xem trước: ảnh + GLB
  const row = (name) => page.getByRole('row').filter({ hasText: name });
  await row('e2e-task10-anh.png').getByRole('button', { name: 'Xem trước' }).click();
  const modal = page.getByRole('dialog', { name: 'e2e-task10-anh.png' });
  const imgOk = await modal.locator('img').evaluate((img) => new Promise((resolve) => {
    if (img.complete) return resolve(img.naturalWidth > 0);
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
  })).catch(() => false);
  check('Xem trước ảnh tải được (URL ký)', imgOk);
  await page.keyboard.press('Escape');
  await row('e2e-task10-model.glb').getByRole('button', { name: 'Xem trước' }).click();
  const modelModal = page.getByRole('dialog', { name: 'e2e-task10-model.glb' });
  await modelModal.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => {});
  const hasCanvas = await modelModal.locator('canvas').count();
  check('Xem trước GLB thật dựng thành canvas 3D', hasCanvas > 0, hasCanvas ? 'canvas' : (await modelModal.innerText()).slice(0, 120));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SHOTS, '2-model-preview.png') });
  await page.keyboard.press('Escape');

  // Tái hiện lỗi sập API: mở/đóng preview GLB liên tục để hủy request khi API đang chờ Supabase.
  for (let i = 0; i < 5; i++) {
    await row('e2e-task10-model.glb').getByRole('button', { name: 'Xem trước' }).click();
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(3000);
  const alive = await fetch(`${API}/health`).then((r) => r.status).catch(() => 0);
  check('API vẫn sống sau 5 lần hủy tải GLB giữa chừng', alive === 200, `health=${alive}`);

  // 4. Tạo hiện vật nháp, gắn media nhưng thiếu alt text
  await page.goto(`${WEB}/admin/exhibits`);
  await page.getByRole('button', { name: 'Thêm hiện vật' }).click();
  const form = page.getByRole('dialog', { name: /Thêm hiện vật mới/ });
  await form.getByRole('textbox', { name: 'Phòng trưng bày' }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some((i) => i.closest('[role=dialog]') && i.value.includes('(')));
  await form.getByLabel('Tên hiện vật (Tiếng Việt)').fill('[E2E Task 10] Hiện vật thử');
  await form.getByLabel('Tên hiện vật (Tiếng Anh)').fill('[E2E Task 10] Test exhibit');
  await form.getByLabel('Mô tả hiện vật (Tiếng Việt)').fill('Mô tả thử');
  await form.getByLabel('Mô tả hiện vật (Tiếng Anh)').fill('Test description');
  await form.getByRole('tab', { name: /Media & thuyết minh/ }).click();
  await pick(form, 'Model 3D (GLB)', 'e2e-task10-model');
  await pick(form, 'Hình ảnh hiện vật', 'e2e-task10-anh');
  await pick(form, 'Audio thuyết minh (MP3)', 'e2e-task10-audio');
  await pick(form, 'Phụ đề (WebVTT)', 'e2e-task10-phude');
  await form.getByLabel('Lời thuyết minh (transcript)').fill('Lời thuyết minh thử');
  await page.screenshot({ path: join(SHOTS, '3-exhibit-media-tab.png') });
  await form.getByRole('button', { name: 'Tạo bản nháp' }).click();
  await form.waitFor({ state: 'hidden' });
  check('Tạo bản nháp có gắn 4 media', !!created.exhibit, created.exhibit?.id);
  const detail = await fetch(`${API}/admin/exhibits/${created.exhibit.id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const c = detail.data.content;
  check('Server lưu đúng slot + transcript', !!(c.modelId && c.imageId && c.audioViId && c.subtitleViId) && JSON.stringify(c.transcript).includes('Lời thuyết minh thử'));

  // 5. Gửi duyệt khi thiếu alt text → form mở lại, đánh dấu đúng ô
  await page.getByPlaceholder(/Tìm kiếm hiện vật/).fill('E2E Task 10');
  const exRow = page.getByRole('row').filter({ hasText: '[E2E Task 10] Hiện vật thử' });
  await exRow.waitFor();
  await exRow.getByRole('button').nth(2).click(); // eye, edit, send
  await page.getByRole('button', { name: 'Gửi kiểm duyệt' }).click();
  const editForm = page.getByRole('dialog', { name: /Chỉnh sửa hiện vật/ });
  await editForm.waitFor({ timeout: 15_000 });
  const mediaTabSelected = await editForm.getByRole('tab', { name: /Media & thuyết minh/ }).getAttribute('aria-selected');
  const altViError = await editForm.getByLabel('Alt text ảnh (Tiếng Việt)').getAttribute('aria-invalid');
  const altEnError = await editForm.getByLabel('Alt text ảnh (Tiếng Anh)').getAttribute('aria-invalid');
  check('Submit 422 → mở form, chuyển tab Media', mediaTabSelected === 'true');
  check('Ô alt text vi/en bị đánh dấu lỗi', altViError === 'true' && altEnError === 'true');
  await page.screenshot({ path: join(SHOTS, '4-submit-errors.png') });

  // 6. Bổ sung alt text → lưu → form điền lại alt text khi mở lần sau
  await editForm.getByLabel('Alt text ảnh (Tiếng Việt)').fill('Ảnh thử');
  await editForm.getByLabel('Alt text ảnh (Tiếng Anh)').fill('Test image');
  await editForm.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await editForm.waitFor({ state: 'hidden' });
  await exRow.getByRole('button').nth(1).click();
  const reopened = page.getByRole('dialog', { name: /Chỉnh sửa hiện vật/ });
  await reopened.getByRole('tab', { name: /Media & thuyết minh/ }).click();
  const altBack = await reopened.getByLabel('Alt text ảnh (Tiếng Anh)').inputValue();
  check('Sửa lại: alt text được điền sẵn từ server', altBack === 'Test image', altBack);
  await page.keyboard.press('Escape');

  // 7. Drawer chi tiết: xem trước media
  await exRow.getByRole('button').nth(0).click();
  const det = page.getByRole('dialog', { name: /Chi tiết hiện vật/ });
  await det.getByText('Hình ảnh', { exact: true }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(2000);
  const detImg = await det.locator('img').first().evaluate((img) => new Promise((resolve) => {
    if (img.complete) return resolve(img.naturalWidth > 0);
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
  })).catch(() => false);
  await det.locator('canvas').first().waitFor({ timeout: 30_000 }).catch(() => {});
  check('Chi tiết: GLB dựng thành canvas 3D', (await det.locator('canvas').count()) > 0);
  const detAudio = await det.locator('audio').count();
  const detTrack = await det.locator('audio track').count();
  check('Chi tiết: ảnh tải được', detImg);
  check('Chi tiết: audio kèm track phụ đề', detAudio === 1 && detTrack === 1, `audio=${detAudio} track=${detTrack}`);
  await det.screenshot({ path: join(SHOTS, '5-detail-preview.png') });
} catch (error) {
  check('Lỗi bất ngờ', false, error.message.split('\n')[0]);
  await page.screenshot({ path: join(SHOTS, 'error.png'), fullPage: true }).catch(() => {});
} finally {
  // Dọn dẹp: hiện vật nháp → media (chưa publish nên API xóa được và tự dọn file)
  if (token && created.exhibit) {
    const r = await fetch(`${API}/admin/exhibits/${created.exhibit.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    console.log(`🧹 xóa hiện vật nháp: HTTP ${r.status}`);
  }
  for (const m of created.media) {
    const r = await fetch(`${API}/admin/media/${m.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    console.log(`🧹 xóa media ${m.kind}: HTTP ${r.status}`);
  }
  const relevant = consoleErrors.filter((e) => !/favicon|DevTools/.test(e));
  console.log(`Console errors: ${relevant.length}${relevant.length ? '\n  ' + relevant.slice(0, 5).join('\n  ') : ''}`);
  await browser.close();
  console.log(`\nKết quả: ${results.filter(Boolean).length}/${results.length} đạt`);
}
