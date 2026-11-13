// Smoke UI preview 3D bản nháp trên Vite 5174 → API 3091 (Supabase thật). Tạo nháp qua API, tự xóa.
// Chạy: node ui-smoke-preview.mjs <front-end> <back-end>
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
let MODEL_ID = null; // GLB sinh riêng cho lần chạy — checksum khác mọi model đã xuất bản

/** GLB tối thiểu có hình khối thật (một kim tự tháp 4 mặt); `seed` làm checksum mỗi lần chạy khác nhau. */
function buildPyramidGlb(seed) {
  const h = 1 + (seed % 1000) / 1000;
  const positions = new Float32Array([0, h, 0, -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 1, 3, 2, 1, 4, 3]);
  const bin = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(indices.buffer)]);
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 60 }, { buffer: 0, byteOffset: 60, byteLength: 36 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 5, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, h, 0.5] },
      { bufferView: 1, componentType: 5123, count: 18, type: 'SCALAR' },
    ],
  };
  const pad = (buf, byte) => Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4, byte)]);
  const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = pad(bin, 0);
  const header = Buffer.alloc(12);
  header.write('glTF', 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const chunk = (data, type) => { const head = Buffer.alloc(8); head.writeUInt32LE(data.length, 0); head.write(type, 4); return Buffer.concat([head, data]); };
  return Buffer.concat([header, chunk(jsonChunk, 'JSON'), chunk(binChunk, 'BIN\0')]);
}
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

let exhibitId = null;
let token = null;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
const contentResponses = [];
page.on('response', (res) => { if (MODEL_ID && res.url().includes(`/admin/media/${MODEL_ID}/content`)) contentResponses.push(res.status()); });

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
  const api = (path, init = {}) => fetch(`${API}${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  }).then((r) => r.json());

  const form = new FormData();
  form.append('file', new Blob([buildPyramidGlb(Date.now())], { type: 'model/gltf-binary' }), 'e2e-preview-pyramid.glb');
  form.append('kind', 'model');
  form.append('source', 'E2E Preview'); form.append('author', 'Claude'); form.append('license', 'CC0');
  const uploaded = await fetch(`${API}/admin/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }).then((r) => r.json());
  MODEL_ID = uploaded.data?.id;
  check('Upload GLB riêng cho bản nháp', !!MODEL_ID, uploaded.message ?? '');

  // Phòng công khai có model thật để bản nháp đứng giữa các hiện vật đã xuất bản.
  const rooms = (await api('/rooms')).data;
  const room = rooms.find((r) => r.slug === 'bo-suu-tap-glb') ?? rooms[0];
  const created = await api('/admin/exhibits', {
    method: 'POST',
    body: JSON.stringify({
      roomId: room.id,
      name: { vi: '[E2E Preview] Cọc thử', en: '[E2E Preview] Test stake' },
      description: { vi: 'Mô tả tiếng Việt', en: 'English description' },
      position: { x: 0, y: 0, z: 5 },
      modelId: MODEL_ID,
      hotspots: [{ label: { vi: 'Đầu cọc', en: 'Stake head' }, body: { vi: 'Vạt nhọn', en: 'Sharpened' }, positionX: 0, positionY: 2.4, positionZ: 0, displayOrder: 1 }],
    }),
  });
  exhibitId = created.data?.id;
  check('Tạo bản nháp thử qua API', !!exhibitId, created.message ?? '');

  // 1. Mở từ drawer chi tiết
  await page.goto(`${WEB}/admin/exhibits`);
  await page.getByPlaceholder(/Tìm kiếm hiện vật/).fill('E2E Preview');
  const row = page.getByRole('row').filter({ hasText: '[E2E Preview] Cọc thử' });
  await row.waitFor();
  await row.getByRole('button').nth(0).click();
  await page.getByRole('link', { name: 'Xem trước 3D trong phòng trưng bày' }).click();
  await page.waitForURL(`${WEB}/admin/exhibits/${exhibitId}/preview`);
  check('Nút trong drawer mở trang preview', true);

  // 2. Scene 3D + model bản nháp tải qua endpoint admin (kiểm checksum như tour)
  await page.locator('canvas').first().waitFor({ timeout: 60_000 });
  // Model bản nháp được tải đầu tiên (đứng đầu hàng đợi) → nhãn của nó thôi báo "Đang tải".
  for (let waited = 0; !contentResponses.length && waited < 120_000; waited += 500) await page.waitForTimeout(500);
  await page.waitForTimeout(5000);
  check('Model bản nháp tải qua /admin/media/:id/content', contentResponses.includes(200), JSON.stringify(contentResponses));
  const failedModel = await page.getByText(/Không tải được mô hình/i).count();
  check('Model bản nháp qua kiểm checksum, không báo lỗi tải', contentResponses.includes(200) && failedModel === 0, `${failedModel}`);
  await page.screenshot({ path: join(SHOTS, '1-preview-vi.png') });

  // 3. Panel chi tiết mặc định chọn bản nháp; đổi ngôn ngữ đổi nội dung + hotspot
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  const titleVi = await panel.getByRole('heading', { level: 2 }).innerText();
  const hotspotVi = await panel.getByText('Đầu cọc').count();
  check('Panel hiện nội dung tiếng Việt của bản nháp + hotspot', titleVi === '[E2E Preview] Cọc thử' && hotspotVi === 1, titleVi);
  await page.getByText('English', { exact: true }).click();
  await page.waitForTimeout(500);
  const titleEn = await panel.getByRole('heading', { level: 2 }).innerText();
  const hotspotEn = await panel.getByText('Stake head').count();
  check('Đổi sang English: tên, mô tả, hotspot tiếng Anh', titleEn === '[E2E Preview] Test stake' && hotspotEn === 1
    && (await panel.getByText('English description').count()) === 1, titleEn);
  check('Panel preview không có link "Đọc chi tiết 2D"', (await panel.getByText('Đọc chi tiết 2D').count()) === 0);
  await page.screenshot({ path: join(SHOTS, '2-preview-en.png') });

  // 4. Các hiện vật đã xuất bản khác của phòng có trong danh sách điều khiển hotspot/scene
  const roomDetail = (await api(`/rooms/${room.slug}`)).data;
  const neighbour = roomDetail.exhibits[0]?.name;
  const neighbourShown = neighbour ? (await page.getByText(neighbour, { exact: false }).count()) > 0 : true;
  check('Hiện vật đã xuất bản khác của phòng xuất hiện cạnh bản nháp', neighbourShown, neighbour ?? '(phòng trống)');
} catch (error) {
  check('Lỗi bất ngờ', false, error.message.split('\n')[0]);
  await page.screenshot({ path: join(SHOTS, 'error.png'), fullPage: true }).catch(() => {});
} finally {
  if (token && exhibitId) {
    const r = await fetch(`${API}/admin/exhibits/${exhibitId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    console.log(`🧹 xóa hiện vật nháp: HTTP ${r.status}`);
  }
  if (token && MODEL_ID) {
    const r = await fetch(`${API}/admin/media/${MODEL_ID}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    console.log(`🧹 xóa media GLB thử: HTTP ${r.status}`);
  }
  const relevant = consoleErrors.filter((e) => !/favicon|DevTools|401/.test(e));
  console.log(`Console errors: ${relevant.length}${relevant.length ? '\n  ' + relevant.slice(0, 5).join('\n  ') : ''}`);
  await browser.close();
  console.log(`\nKết quả: ${results.filter(Boolean).length}/${results.length} đạt`);
}
