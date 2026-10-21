// Smoke UI ghi công media (FR-97) trên Vite 5174 → API 3091 (Supabase thật). Không sửa metadata media thật:
// phần hiển thị kiểm qua bản nháp + GLB thử có quyền sử dụng (tự xóa); phần public kiểm hợp đồng API + trang 2D.
// Chạy: node ui-smoke-media-rights.mjs <front-end> <back-end>
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
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

/** GLB tối thiểu có hình khối thật; `seed` làm checksum mỗi lần chạy khác nhau. */
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

let token = null;
let mediaId = null;
let exhibitId = null;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

try {
  // 1. Hợp đồng public: model mang rights như ảnh/audio
  const room = (await fetch(`${API}/rooms/bo-suu-tap-glb`).then((r) => r.json())).data;
  const models = room.exhibits.filter((e) => e.model);
  check('API public: mọi model có trường rights', models.length > 0 && models.every((e) => e.model.rights && 'license' in e.model.rights),
    `${models.length} model`);
  const withRights = room.exhibits.filter((e) => [e.model, e.image, e.audio?.vi?.audio, e.audio?.en?.audio]
    .some((m) => m?.rights && (m.rights.source || m.rights.author || m.rights.license)));
  console.log(`   ℹ hiện vật công khai đã có thông tin quyền: ${withRights.length}/${room.exhibits.length}`);

  // 2. Trang 2D vẫn qua kiểm schema với payload mới; mục ghi công chỉ hiện khi có thông tin
  const first = room.exhibits[0];
  await page.goto(`${WEB}/collection/${room.slug}/exhibits/${first.id}`);
  await page.getByRole('heading', { level: 1, name: first.name }).waitFor({ timeout: 30_000 });
  const creditsShown = (await page.getByRole('heading', { name: 'Nguồn & bản quyền' }).count()) > 0;
  const expected = withRights.some((e) => e.id === first.id);
  check('Trang 2D đọc được payload mới; mục "Nguồn & bản quyền" khớp dữ liệu', creditsShown === expected,
    `hiện=${creditsShown}, có dữ liệu=${expected}`);

  // 3. Bản nháp gắn GLB có quyền sử dụng → preview hiện ghi công như tour
  await page.goto(`${WEB}/admin/login`);
  await page.getByLabel('Email').fill(process.env.SEED_ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu').fill(process.env.SEED_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await page.waitForURL(`${WEB}/admin`);
  token = await page.evaluate(async (url) => {
    const r = await fetch(`${url}/auth/refresh`, { method: 'POST', credentials: 'include' });
    return (await r.json()).data?.accessToken;
  }, API);
  const form = new FormData();
  form.append('file', new Blob([buildPyramidGlb(Date.now())], { type: 'model/gltf-binary' }), 'e2e-rights-pyramid.glb');
  form.append('kind', 'model');
  form.append('source', 'E2E Rights'); form.append('author', 'Claude'); form.append('license', 'CC0');
  mediaId = (await fetch(`${API}/admin/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }).then((r) => r.json())).data?.id;
  exhibitId = (await fetch(`${API}/admin/exhibits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: room.id, name: { vi: '[E2E Rights] Hiện vật', en: '[E2E Rights] Exhibit' }, position: { x: 0, y: 0, z: 5 }, modelId: mediaId }),
  }).then((r) => r.json())).data?.id;
  check('Tạo GLB có quyền sử dụng + bản nháp', !!mediaId && !!exhibitId);

  await page.goto(`${WEB}/admin/exhibits/${exhibitId}/preview`);
  const panel = page.getByRole('complementary', { name: 'Chi tiết hiện vật' });
  await panel.getByRole('heading', { name: 'Nguồn & bản quyền' }).waitFor({ timeout: 60_000 });
  const line = await panel.getByText('Mô hình 3D:').locator('..').innerText();
  check('Panel 3D hiện ghi công model', line.includes('Tác giả: Claude') && line.includes('Nguồn: E2E Rights') && line.includes('Giấy phép: CC0'), line);
  await page.screenshot({ path: join(SHOTS, '1-preview-credits.png') });
} catch (error) {
  check('Lỗi bất ngờ', false, error.message.split('\n')[0]);
  await page.screenshot({ path: join(SHOTS, 'error.png'), fullPage: true }).catch(() => {});
} finally {
  if (token && exhibitId) {
    const r = await fetch(`${API}/admin/exhibits/${exhibitId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    console.log(`🧹 xóa hiện vật nháp: HTTP ${r.status}`);
  }
  if (token && mediaId) {
    const r = await fetch(`${API}/admin/media/${mediaId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    console.log(`🧹 xóa media GLB thử: HTTP ${r.status}`);
  }
  const relevant = consoleErrors.filter((e) => !/favicon|DevTools|401/.test(e));
  console.log(`Console errors: ${relevant.length}${relevant.length ? '\n  ' + relevant.slice(0, 5).join('\n  ') : ''}`);
  await browser.close();
  console.log(`\nKết quả: ${results.filter(Boolean).length}/${results.length} đạt`);
}
