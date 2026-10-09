# Task 29 — Load Test REST API bằng k6

**Deadline:** 20/11/2026  
**Nhánh:** `feat/qa-load-test-k6`  
**Bắt đầu từ:** `origin/dev`  
**Yêu cầu:** NFR-08, AC-49 (SRS docs/requirements.md)

---

## Mục tiêu hiệu năng cần đạt

| Chỉ số | Mục tiêu |
|:---|:---|
| Concurrent Users (CCU) | 100 – 200 đồng thời |
| p95 response time | ≤ 500ms |
| Error rate | < 1% |

---

## Cảnh báo quan trọng — Supabase Connection Pool

> ⚠️ Supabase Free/Pro dùng Direct Connection có **giới hạn số connection đồng thời**.  
> Khi chạy load test với 100–200 CCU, **bắt buộc dùng Transaction Pooler (port 6543)** thay vì Session Pooler (port 5432) để tránh lỗi `too many connections` làm sai lệch kết quả test.

Trong `back-end/.env` khi load test:
```env
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:6543/postgres?pgbouncer=true
```

---

## Cài đặt k6

```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69

echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list

sudo apt-get update && sudo apt-get install k6

# Kiểm tra
k6 version
```

---

## Kịch bản 1 — Public API (Visitor load)

Lưu file tại: `back-end/docs/plans/v1/load-test-public.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp-up: 0 → 50 CCU
    { duration: '5m', target: 100 },  // Hold: 100 CCU
    { duration: '3m', target: 200 },  // Spike: 200 CCU
    { duration: '2m', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // p95 ≤ 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  // GET /health
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  // GET /rooms
  const rooms = http.get(`${BASE_URL}/rooms`);
  check(rooms, {
    'rooms 200': (r) => r.status === 200,
    'rooms has data': (r) => JSON.parse(r.body).length > 0,
  });

  // GET /rooms/:slug
  const room = http.get(`${BASE_URL}/rooms/phong-kham-pha`);
  check(room, {
    'room 200': (r) => r.status === 200,
    'room has exhibits': (r) => JSON.parse(r.body).exhibits !== undefined,
  });

  sleep(1);
}
```

---

## Kịch bản 2 — CMS Admin API

Lưu file tại: `back-end/docs/plans/v1/load-test-admin.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // NFR-05: p95 ≤ 2s cho CMS ops
    http_req_failed: ['rate<0.01'],
  },
};

const headers = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'Content-Type': 'application/json',
};

export default function () {
  // GET /admin/exhibits
  const list = http.get(`${BASE_URL}/admin/exhibits`, { headers });
  check(list, { 'admin exhibits 200': (r) => r.status === 200 });

  sleep(1);
}
```

---

## Cách chạy

```bash
# Kịch bản Public API
k6 run back-end/docs/plans/v1/load-test-public.js \
  -e BASE_URL=http://localhost:3001

# Kịch bản Admin API
k6 run back-end/docs/plans/v1/load-test-admin.js \
  -e BASE_URL=http://localhost:3001 \
  -e JWT_TOKEN=<token>

# Xuất kết quả JSON
k6 run back-end/docs/plans/v1/load-test-public.js \
  -e BASE_URL=http://localhost:3001 \
  --out json=back-end/docs/plans/v1/load-test-results.json
```

---

## Chỉ số cần ghi lại trong báo cáo

| Chỉ số | Mô tả |
|:---|:---|
| `http_req_duration p50` | Median response time |
| `http_req_duration p95` | 95th percentile — **chỉ số chính** |
| `http_req_duration p99` | 99th percentile |
| `http_req_failed` | Tỉ lệ request lỗi |
| `http_reqs` | Tổng số request |
| `vus_max` | Peak Virtual Users |
| Kết luận DB | Có bị pool exhaustion không? |

---

## Bàn giao

Tạo file `back-end/docs/plans/v1/load-test-report.md`:

```markdown
# Báo cáo Load Test — REST API

**Ngày thực hiện:** DD/MM/YYYY  
**Môi trường:** local / staging  
**Supabase tier:** Free / Pro  
**Pooler:** Transaction Pooler port 6543 ✅  

## Kết quả Kịch bản 1 — Public API

| Chỉ số | Giá trị | Mục tiêu | Pass/Fail |
|:---|:---:|:---:|:---:|
| p95 | ...ms | ≤ 500ms | |
| p99 | ...ms | — | |
| Error rate | ...% | < 1% | |
| Peak CCU | ... | 200 | |

## Kết luận

Hệ thống [ĐẠT / CHƯA ĐẠT] yêu cầu NFR-08.
```

