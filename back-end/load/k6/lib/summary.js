// Tóm tắt kết quả k6: bảng p50/p95/p99 + tỉ lệ lỗi theo endpoint, và file JSON để lưu bằng chứng.
// Không dùng jslib từ mạng để chạy được offline.

import { MAX_ERROR_RATE, P95_TARGET_MS } from './profiles.js';

function ms(value) {
  return value === undefined ? '-' : `${value.toFixed(1)}`;
}

function pct(value) {
  return value === undefined ? '-' : `${(value * 100).toFixed(2)}%`;
}

/** Gom submetric `http_req_duration{endpoint:x}` / `http_req_failed{endpoint:x}` thành từng dòng. */
export function endpointRows(metrics) {
  const rows = [];
  for (const key of Object.keys(metrics)) {
    const match = /^http_req_duration\{endpoint:([^}]+)\}$/.exec(key);
    if (!match) continue;
    const name = match[1];
    const duration = metrics[key].values;
    const failed = metrics[`http_req_failed{endpoint:${name}}`];
    rows.push({
      endpoint: name,
      count: duration.count,
      med: duration.med,
      p95: duration['p(95)'],
      p99: duration['p(99)'],
      max: duration.max,
      errorRate: failed ? failed.values.rate : undefined,
    });
  }
  return rows.sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}

function verdict(row) {
  const okLatency = row.p95 !== undefined && row.p95 < P95_TARGET_MS;
  const okErrors = row.errorRate !== undefined && row.errorRate < MAX_ERROR_RATE;
  return okLatency && okErrors ? 'ĐẠT' : 'TRƯỢT';
}

export function renderText(data, meta) {
  const m = data.metrics;
  const total = {
    endpoint: 'TỔNG',
    count: m.http_reqs.values.count,
    med: m.http_req_duration.values.med,
    p95: m.http_req_duration.values['p(95)'],
    p99: m.http_req_duration.values['p(99)'],
    max: m.http_req_duration.values.max,
    errorRate: m.http_req_failed.values.rate,
  };
  const rows = [...endpointRows(m), total];
  const header = ['endpoint', 'requests', 'p50 ms', 'p95 ms', 'p99 ms', 'max ms', 'lỗi', 'kết luận'];
  const lines = rows.map((r) => [
    r.endpoint, String(r.count), ms(r.med), ms(r.p95), ms(r.p99), ms(r.max), pct(r.errorRate), verdict(r),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  const fmt = (cols) => cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  const thresholdsFailed = Object.entries(m)
    .filter(([, metric]) => metric.thresholds && Object.values(metric.thresholds).some((t) => !t.ok))
    .map(([name]) => name);
  return [
    '',
    `k6 · profile=${meta.profile} · base=${meta.baseUrl} · VU tối đa=${m.vus_max.values.max}`,
    `Mục tiêu AC-49: p95 < ${P95_TARGET_MS} ms, lỗi < ${MAX_ERROR_RATE * 100}%`,
    `Thông lượng: ${m.http_reqs.values.rate.toFixed(1)} req/s · checks đạt ${pct(m.checks.values.rate)}`,
    '',
    fmt(header),
    fmt(widths.map((w) => '-'.repeat(w))),
    ...lines.map(fmt),
    '',
    thresholdsFailed.length ? `Ngưỡng TRƯỢT: ${thresholdsFailed.join(', ')}` : 'Mọi ngưỡng đều ĐẠT.',
    '',
  ].join('\n');
}
