// Task 29 — cấu hình chung cho bài đo k6 (AC-49: p95 ≤ 500 ms, lỗi < 1% ở 100–200 CCU).
// File chạy trong runtime k6 (không phải Node): chỉ dùng API của k6 và ES module thuần.

/** Gốc API, gồm cả prefix `/api`. Mặc định là API đo tải chạy riêng ở cổng 3101. */
export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3101/api').replace(/\/+$/, '');

/** Ngưỡng AC-49. */
export const P95_TARGET_MS = 500;
export const MAX_ERROR_RATE = 0.01;

/**
 * Hồ sơ tải (chọn bằng `K6_PROFILE`). Mỗi VU là một khách tham quan đồng thời (CCU),
 * có thời gian "đọc" giữa các request nên số VU ≈ số người dùng thật đang mở trang.
 */
const PROFILES = {
  smoke: [
    { duration: '10s', target: 5 },
    { duration: '30s', target: 5 },
    { duration: '5s', target: 0 },
  ],
  load100: [
    { duration: '30s', target: 100 },
    { duration: __ENV.K6_HOLD || '3m', target: 100 },
    { duration: '15s', target: 0 },
  ],
  load200: [
    { duration: '45s', target: 200 },
    { duration: __ENV.K6_HOLD || '3m', target: 200 },
    { duration: '15s', target: 0 },
  ],
  // Bậc thang 100 → 200 trong một lần chạy, để thấy điểm gãy nếu có.
  ramp: [
    { duration: '30s', target: 100 },
    { duration: __ENV.K6_HOLD || '2m', target: 100 },
    { duration: '30s', target: 200 },
    { duration: __ENV.K6_HOLD || '2m', target: 200 },
    { duration: '15s', target: 0 },
  ],
  // Vượt mục tiêu để biết còn bao nhiêu dư địa (K6_VUS, mặc định 500). Không phải tiêu chí AC-49.
  stress: [
    { duration: '1m', target: Number(__ENV.K6_VUS || 500) },
    { duration: __ENV.K6_HOLD || '2m', target: Number(__ENV.K6_VUS || 500) },
    { duration: '15s', target: 0 },
  ],
};

export function stagesFor(name) {
  const stages = PROFILES[name];
  if (!stages) throw new Error(`K6_PROFILE không hợp lệ: "${name}". Chọn: ${Object.keys(PROFILES).join(', ')}`);
  return stages;
}

/** Ngưỡng tổng + ngưỡng riêng từng endpoint (tag `endpoint`) để endpoint chậm không bị trung bình che. */
export function thresholdsFor(endpoints) {
  const thresholds = {
    http_req_duration: [`p(95)<${P95_TARGET_MS}`],
    http_req_failed: [`rate<${MAX_ERROR_RATE}`],
    checks: [`rate>${1 - MAX_ERROR_RATE}`],
  };
  for (const name of endpoints) {
    thresholds[`http_req_duration{endpoint:${name}}`] = [`p(95)<${P95_TARGET_MS}`];
    thresholds[`http_req_failed{endpoint:${name}}`] = [`rate<${MAX_ERROR_RATE}`];
  }
  return thresholds;
}

export const SUMMARY_TREND_STATS = ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'];
