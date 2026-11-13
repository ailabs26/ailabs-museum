# Đo tải API bằng k6 (Task 29, AC-49)

Mục tiêu: API công khai chịu **100–200 khách đồng thời** với **p95 < 500 ms** và **lỗi < 1%**.
Kết quả và phân tích: [`docs/tasks/be/k6-api-load.md`](../../../docs/tasks/be/k6-api-load.md).

## Chuẩn bị (một lần)

Chỉ đo trên Postgres **local**: script dữ liệu từ chối mọi `DATABASE_URL` không phải localhost.
Không đo vào Supabase dùng chung, không dùng cổng 3001 của dev server.

```bash
# 1. Postgres riêng cho bài đo
docker run -d --name k6-pg -e POSTGRES_PASSWORD=k6 -e POSTGRES_DB=k6 -p 127.0.0.1:55433:5432 postgres:16-alpine

# 2. Schema + RBAC + admin + dữ liệu tải (trong back-end/; biến trên dòng lệnh được ưu tiên hơn .env)
export DATABASE_URL=postgres://postgres:k6@127.0.0.1:55433/k6 DATABASE_SSL=false MEDIA_STORAGE_DRIVER=local
export SEED_ADMIN_EMAIL=admin@aura.local SEED_ADMIN_PASSWORD='mat-khau-tam-cho-db-local'
npm run migration:run && npm run seed
npm run load:k6:prepare            # mặc định 40 phòng nhân bản → 41 phòng, 205 hiện vật; đổi bằng K6_LOAD_ROOMS

# 3. Build và chạy API đo tải ở cổng 3101 (production mode, khóa ngẫu nhiên)
npm run build
NODE_ENV=production PORT=3101 \
  JWT_ACCESS_SECRET=$(openssl rand -hex 32) MEDIA_URL_SIGNING_SECRET=$(openssl rand -hex 32) \
  TOTP_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  PUBLIC_API_RATE_LIMIT=100000 PUBLIC_MEDIA_RATE_LIMIT=100000 \
  node dist/main.js
```

`PUBLIC_API_RATE_LIMIT=100000`: mọi VU của k6 đi ra từ **một IP** (127.0.0.1), nên với giới hạn mặc định
600 request/phút/IP gần như toàn bộ request sẽ bị 429 — bài đo khi đó đo rate limiter chứ không đo API.
Xem mục "Rate limit theo IP" trong báo cáo.

## Chạy

Cài k6 ≥ 0.57 (<https://grafana.com/docs/k6/latest/set-up/install-k6/>), rồi trong `back-end/`:

```bash
K6_PROFILE=smoke   npm run load:k6       # 5 VU, ~45 s — kiểm tra kịch bản trước
K6_PROFILE=load100 npm run load:k6       # 100 CCU, giữ 3 phút
K6_PROFILE=load200 npm run load:k6       # 200 CCU, giữ 3 phút
K6_PROFILE=stress K6_VUS=500 npm run load:k6   # vượt mục tiêu, tìm dư địa

# Lưu bằng chứng
K6_PROFILE=load200 K6_SUMMARY_JSON=../docs/tasks/be/evidence/k6/load200.json npm run load:k6
```

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `BASE_URL` | `http://localhost:3101/api` | Gốc API, gồm prefix `/api` |
| `K6_PROFILE` | `smoke` | `smoke`, `load100`, `load200`, `ramp` (100 → 200), `stress` |
| `K6_HOLD` | `3m` (`ramp`: `2m`) | Thời gian giữ tải ở mỗi mức |
| `K6_VUS` | `500` | Số VU của profile `stress` |
| `K6_THINK_MIN` / `K6_THINK_MAX` | `0.5` / `2` | Thời gian đọc (giây) giữa hai request của một khách |
| `K6_SUMMARY_JSON` | — | File lưu summary JSON đầy đủ |

Exit code khác 0 khi có ngưỡng trượt, nên dùng được làm gate trong CI.

## Kịch bản

`public-visitor.js` — mỗi VU là một khách, mỗi vòng chọn một hành vi theo trọng số (bám theo
`front-end/src/services/museum.service.ts`, `rooms.service.ts`, `core/i18n/public-locale.tsx`):

| Trọng số | Tag `endpoint` | Request |
|---|---|---|
| 25 | `room_detail` | `GET /rooms/:slug?lang=` (phòng + hiện vật + hotspot) |
| 20 | `rooms_list` | `GET /rooms?lang=` |
| 20 | `search` | `GET /rooms/search?q=&page=1..3&pageSize=12&lang=` (có từ khóa không khớp, có duyệt không từ khóa) |
| 12 | `ui_translations` | `GET /public/translations?locale=` |
| 8 | `public_rooms_list` | `GET /public/rooms?lang=` |
| 8 | `exhibit_location` | `GET /public/exhibits/:id/location` (liên kết QR) |
| 7 | `public_room_detail` | `GET /public/rooms/:slug?lang=` |

Ngôn ngữ: ~60% `vi`, còn lại rải đều 6 locale. Mỗi response phải là HTTP 200 với envelope `success: true`.
Ngưỡng áp cho tổng **và từng endpoint**. Summary in thêm số response 429 / 5xx / mã khác.

Tải file GLB (`/rooms/:slug/exhibits/:id/model`) và media không nằm trong kịch bản: chúng là băng thông
Storage, có rate limit riêng (`PUBLIC_MEDIA_RATE_LIMIT`), không thuộc AC-49.
