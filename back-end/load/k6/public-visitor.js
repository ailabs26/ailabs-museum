// Task 29 — Kịch bản k6: khách tham quan dùng API công khai (AC-49).
//
//   K6_PROFILE=smoke   k6 run load/k6/public-visitor.js     # kiểm tra kịch bản, 5 VU
//   K6_PROFILE=load100 k6 run load/k6/public-visitor.js     # 100 CCU
//   K6_PROFILE=load200 k6 run load/k6/public-visitor.js     # 200 CCU
//
// Biến môi trường: BASE_URL (mặc định http://localhost:3101/api), K6_PROFILE, K6_HOLD (thời gian
// giữ tải, vd 5m), K6_SUMMARY_JSON (đường dẫn lưu summary JSON), K6_THINK_MIN/K6_THINK_MAX (giây).
//
// Mỗi VU lặp một "lượt xem" chọn ngẫu nhiên có trọng số theo hành vi trang khách (front-end
// `museum.service.ts`, `rooms.service.ts`, `public-locale.tsx`), xen thời gian đọc giữa các request.

import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, SUMMARY_TREND_STATS, stagesFor, thresholdsFor } from './lib/profiles.js';
import { renderText } from './lib/summary.js';

const PROFILE = __ENV.K6_PROFILE || 'smoke';
const THINK_MIN = Number(__ENV.K6_THINK_MIN || 0.5);
const THINK_MAX = Number(__ENV.K6_THINK_MAX || 2);
const LOCALES = ['vi', 'en', 'zh', 'ko', 'ja', 'fr'];
// Từ khóa tìm kiếm: có kết quả, ít kết quả, không có kết quả, dấu tiếng Việt và chuỗi rỗng (duyệt).
const SEARCH_TERMS = ['', '', 'mũ', 'ba lô', 'bản 1', 'bản 27', 'hành quân', 'Mẫu', 'không-có-hiện-vật-này'];

/** Trọng số hành vi (tổng 100). */
const ACTIONS = [
  { weight: 20, endpoint: 'rooms_list', run: (d) => get('rooms_list', `/rooms?lang=${locale()}`) },
  { weight: 25, endpoint: 'room_detail', run: (d) => get('room_detail', `/rooms/${pick(d.slugs)}?lang=${locale()}`) },
  { weight: 20, endpoint: 'search', run: () => get('search', searchPath()) },
  { weight: 8, endpoint: 'public_rooms_list', run: () => get('public_rooms_list', `/public/rooms?lang=${locale()}`) },
  { weight: 7, endpoint: 'public_room_detail', run: (d) => get('public_room_detail', `/public/rooms/${pick(d.slugs)}?lang=${locale()}`) },
  { weight: 12, endpoint: 'ui_translations', run: () => get('ui_translations', `/public/translations?locale=${locale()}`) },
  { weight: 8, endpoint: 'exhibit_location', run: (d) => get('exhibit_location', `/public/exhibits/${pick(d.exhibitIds)}/location`) },
];
const TOTAL_WEIGHT = ACTIONS.reduce((sum, a) => sum + a.weight, 0);

// Phân loại response lỗi để biết lỗi do rate limit (429), do server (5xx) hay khác (4xx, timeout).
const status429 = new Counter('status_429');
const status5xx = new Counter('status_5xx');
const statusOther = new Counter('status_other_non_200');

export const options = {
  scenarios: {
    visitors: { executor: 'ramping-vus', startVUs: 0, stages: stagesFor(PROFILE), gracefulRampDown: '10s' },
  },
  thresholds: thresholdsFor(ACTIONS.map((a) => a.endpoint)),
  summaryTrendStats: SUMMARY_TREND_STATS,
  // Không đo setup (lấy danh sách slug/id) vào kết quả.
  setupTimeout: '60s',
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function locale() {
  // ~60% khách dùng tiếng Việt, còn lại rải đều các ngôn ngữ khác.
  return Math.random() < 0.6 ? 'vi' : pick(LOCALES);
}

function searchPath() {
  const q = pick(SEARCH_TERMS);
  const page = 1 + Math.floor(Math.random() * 3);
  const query = [`page=${page}`, 'pageSize=12', `lang=${locale()}`];
  if (q) query.push(`q=${encodeURIComponent(q)}`);
  return `/rooms/search?${query.join('&')}`;
}

function get(endpoint, path) {
  const res = http.get(`${BASE_URL}${path}`, { tags: { endpoint, name: endpoint } });
  if (res.status === 429) status429.add(1, { endpoint });
  else if (res.status >= 500) status5xx.add(1, { endpoint });
  else if (res.status !== 200) statusOther.add(1, { endpoint, status: String(res.status) });
  check(res, {
    'status 200': (r) => r.status === 200,
    'envelope success': (r) => {
      try {
        return r.json('success') === true;
      } catch (_) {
        return false;
      }
    },
  }, { endpoint });
  return res;
}

/** Lấy danh sách slug phòng và id hiện vật thật từ API trước khi tạo tải. */
export function setup() {
  const rooms = http.get(`${BASE_URL}/rooms`, { tags: { name: 'setup' } });
  if (rooms.status !== 200) fail(`Không gọi được ${BASE_URL}/rooms (HTTP ${rooms.status}). API đã chạy chưa?`);
  const slugs = rooms.json('data').map((room) => room.slug);
  const exhibitIds = [];
  for (let page = 1; page <= 5; page += 1) {
    const res = http.get(`${BASE_URL}/rooms/search?page=${page}&pageSize=50`, { tags: { name: 'setup' } });
    if (res.status !== 200) break;
    const items = res.json('data');
    items.forEach((item) => exhibitIds.push(item.id));
    if (items.length < 50) break;
  }
  if (slugs.length === 0 || exhibitIds.length === 0) {
    fail('Chưa có phòng/hiện vật công khai — chạy `npm run load:k6:prepare` trước.');
  }
  console.log(`setup: ${slugs.length} phòng, ${exhibitIds.length} hiện vật, profile=${PROFILE}`);
  return { slugs, exhibitIds };
}

export default function visitor(data) {
  let roll = Math.random() * TOTAL_WEIGHT;
  const action = ACTIONS.find((a) => (roll -= a.weight) < 0) || ACTIONS[0];
  action.run(data);
  sleep(THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN));
}

export function handleSummary(data) {
  const output = { stdout: renderText(data, { profile: PROFILE, baseUrl: BASE_URL }) };
  if (__ENV.K6_SUMMARY_JSON) output[__ENV.K6_SUMMARY_JSON] = JSON.stringify(data, null, 2);
  return output;
}
