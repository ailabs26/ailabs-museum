#!/usr/bin/env node
/**
 * VT-079 TC16 — kiểm chứng tải autosave: 200 tác vụ đồng thời, mục tiêu p95 ≤ 5.0 s (NFR1)
 * và invariant compare-and-swap dưới tải (AC3).
 *
 * Chỉ chạy với API localhost (server trỏ PostgreSQL cục bộ) — không bao giờ bắn tải vào môi trường dùng chung.
 *   API_URL=http://127.0.0.1:3101/api LOAD_EMAIL=... LOAD_PASSWORD=... node scripts/bt3-autosave-load.mjs
 * Biến tùy chọn: LOAD_USERS (mặc định 200), LOAD_ROUNDS (mặc định 3), P95_TARGET_MS (mặc định 5000).
 */
import { performance } from 'node:perf_hooks';

const API = process.env.API_URL ?? 'http://127.0.0.1:3101/api';
const USERS = Number(process.env.LOAD_USERS ?? 200);
const ROUNDS = Number(process.env.LOAD_ROUNDS ?? 3);
const P95_TARGET_MS = Number(process.env.P95_TARGET_MS ?? 5000);
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(API)) {
  console.error(`Từ chối chạy: API_URL phải là localhost, nhận ${API}`);
  process.exit(2);
}

async function call(method, path, token, body) {
  const started = performance.now();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ms: performance.now() - started, data: json?.data, message: json?.message };
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function summarize(label, results) {
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const byStatus = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  const row = {
    label, n: results.length, byStatus,
    p50: +percentile(ms, 50).toFixed(1), p95: +percentile(ms, 95).toFixed(1),
    p99: +percentile(ms, 99).toFixed(1), max: +ms[ms.length - 1].toFixed(1),
  };
  console.log(JSON.stringify(row));
  return row;
}

async function main() {
  const login = await call('POST', '/auth/login', null, { email: process.env.LOAD_EMAIL, password: process.env.LOAD_PASSWORD });
  if (login.status !== 200 && login.status !== 201) throw new Error(`Login thất bại: ${login.status} ${login.message}`);
  const token = login.data.accessToken;
  const tag = `vt079-load-${Date.now()}`;
  const room = await call('POST', '/admin/rooms', token, { slug: tag, name: 'Phòng tải VT-079' });
  if (room.status !== 201) throw new Error(`Tạo phòng thất bại: ${room.status} ${room.message}`);

  // Dữ liệu giả lập: mỗi "người dùng" sửa một hiện vật nháp riêng (tạo tuần tự, không tính vào đo).
  const exhibits = [];
  for (let i = 0; i < USERS; i++) {
    const created = await call('POST', '/admin/exhibits', token, {
      roomId: room.data.id, name: { vi: `Hiện vật tải ${i}` }, description: { vi: 'Mô tả' },
    });
    if (created.status !== 201) throw new Error(`Tạo hiện vật ${i} thất bại: ${created.status} ${created.message}`);
    exhibits.push({ id: created.data.id, version: created.data.version });
  }
  console.log(`# ${USERS} hiện vật nháp đã tạo; API ${API}; mục tiêu p95 ≤ ${P95_TARGET_MS} ms`);

  // Kịch bản A: USERS autosave đồng thời, mỗi tác vụ một hiện vật, version khớp → kỳ vọng toàn 200.
  const rowsA = [];
  for (let round = 1; round <= ROUNDS; round++) {
    const results = await Promise.all(exhibits.map((e, i) =>
      call('PATCH', `/admin/exhibits/${e.id}`, token, { name: { vi: `Tải vòng ${round} #${i}` }, expectedVersion: e.version })
        .then((r) => { if (r.status === 200) e.version = r.data.version; return r; })));
    rowsA.push(summarize(`A vòng ${round}: ${USERS} autosave đồng thời / ${USERS} hiện vật`, results));
  }

  // Kịch bản B: USERS autosave đồng thời vào CÙNG một hiện vật với cùng expectedVersion.
  const target = exhibits[0];
  const before = target.version;
  const resultsB = await Promise.all(Array.from({ length: USERS }, (_, i) =>
    call('PATCH', `/admin/exhibits/${target.id}`, token, { name: { vi: `Tab ${i}` }, expectedVersion: before })));
  const rowB = summarize(`B: ${USERS} autosave đồng thời / 1 hiện vật, cùng expectedVersion=${before}`, resultsB);
  const detail = await call('GET', `/admin/exhibits/${target.id}`, token);
  const winners = resultsB.flatMap((r, i) => (r.status === 200 ? [`Tab ${i}`] : []));
  const invariant = {
    winners: winners.length, versionBefore: before, versionAfter: detail.data.version,
    storedName: detail.data.content?.name?.vi, winnerName: winners[0],
  };
  console.log(JSON.stringify({ invariantB: invariant }));

  const worstP95 = Math.max(...rowsA.map((r) => r.p95), rowB.p95);
  const no5xx = [...rowsA, rowB].every((r) => Object.keys(r.byStatus).every((s) => Number(s) < 500));
  const casOk = invariant.winners === 1 && invariant.versionAfter === before + 1 && invariant.storedName === invariant.winnerName
    && rowB.byStatus[409] === USERS - 1;
  const allA200 = rowsA.every((r) => r.byStatus[200] === USERS);
  console.log(`# KẾT LUẬN: p95 lớn nhất ${worstP95} ms (mục tiêu ≤ ${P95_TARGET_MS}) → ${worstP95 <= P95_TARGET_MS ? 'ĐẠT' : 'KHÔNG ĐẠT'}; `
    + `5xx: ${no5xx ? 'không' : 'CÓ'}; A toàn 200: ${allA200 ? 'đúng' : 'SAI'}; invariant CAS dưới tải: ${casOk ? 'giữ' : 'VI PHẠM'}`);
  process.exit(worstP95 <= P95_TARGET_MS && no5xx && casOk && allA200 ? 0 : 1);
}

main().catch((error) => { console.error(error); process.exit(1); });
