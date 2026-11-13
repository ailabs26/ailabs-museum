# Task 29: Đo tải API bằng k6 (100–200 CCU, AC-49)

Người làm: Nguyễn Trọng Thành · Nhánh `feat/k6-api-load` (từ `dev` tại `3af8fb7`) · Ngày đo: 13/11/2026.

## Kết luận

| Mức tải | p95 tổng | p99 tổng | Lỗi | Kết quả AC-49 |
|---|---|---|---|---|
| 100 CCU (2 lần) | 27.5 ms / 18.8 ms | 1594 ms / 24.9 ms | 0% / 0% | **Đạt** |
| 200 CCU (2 lần) | 21.5 ms / 24.0 ms | 30.2 ms / 35.7 ms | 0% / 0% | **Đạt** |
| 500 VU (stress) | 373.8 ms | 478.8 ms | 0% | Vẫn đạt, sát ngưỡng |
| 1000 VU (stress) | 2137 ms | 2230 ms | 0% | Trượt latency, không lỗi |

- API công khai **đạt AC-49** ở cả 100 và 200 CCU. Mọi endpoint đều có p95 < 40 ms, không có response lỗi.
- Dư địa khoảng **2,5 lần**: 500 VU vẫn đạt. Từ khoảng 300 req/s trở lên thì thông lượng không tăng nữa vì luồng JS của **một tiến trình Node** đã bão hòa, không phải do Postgres (chi tiết ở mục Điểm nghẽn).
- **Rủi ro cấu hình cần nhóm quyết định:** với giá trị mặc định `PUBLIC_API_RATE_LIMIT=600` request/phút/IP, 200 khách dùng chung một IP (Wi-Fi bảo tàng qua NAT) bị **91,7% response 429**. Xem mục Rate limit theo IP.

## Phạm vi và cách đo

**Endpoint được đo:** các API mà trang khách gọi (`front-end/src/services/museum.service.ts`, `rooms.service.ts`, `core/i18n/public-locale.tsx`). Mỗi request được gắn tag `endpoint`, có trọng số như sau:

| Trọng số | Tag | Request |
|---|---|---|
| 25 | `room_detail` | `GET /api/rooms/:slug?lang=` (phòng, hiện vật, hotspot) |
| 20 | `rooms_list` | `GET /api/rooms?lang=` |
| 20 | `search` | `GET /api/rooms/search?q=&page=1..3&pageSize=12&lang=` |
| 12 | `ui_translations` | `GET /api/public/translations?locale=` |
| 8 | `public_rooms_list` | `GET /api/public/rooms?lang=` |
| 8 | `exhibit_location` | `GET /api/public/exhibits/:id/location` (liên kết QR) |
| 7 | `public_room_detail` | `GET /api/public/rooms/:slug?lang=` |

**Mô hình tải:**
- Mỗi VU là một khách. Sau mỗi request, VU nghỉ ngẫu nhiên 0,5–2 s để mô phỏng thời gian đọc. Mức nghỉ này ngắn hơn khách thật, nên tải đo được nặng hơn thực tế.
- 60% request dùng `lang=vi`, phần còn lại chia đều cho 6 locale.
- Từ khóa tìm kiếm gồm: chuỗi rỗng (duyệt), từ có nhiều kết quả, từ có dấu tiếng Việt, và từ không khớp hiện vật nào.

**Profile:**
- `load100` và `load200`: ramp-up 30–45 s, giữ tải 3 phút, ramp-down 15 s.
- `stress`: tăng lên `K6_VUS` VU trong 1 phút, giữ 1 phút.

**Tiêu chí đạt:**
- Tổng **và từng endpoint** đều phải có p95 < 500 ms và `http_req_failed` < 1%.
- Mọi response phải là HTTP 200 với envelope `success: true`.
- Ngưỡng được áp riêng cho từng endpoint để endpoint chậm không bị giá trị trung bình che mất.

**Dữ liệu** (`npm run load:k6:prepare`):
- 41 phòng ACTIVE, gồm phòng demo và 40 bản sao `k6-load-*`.
- 205 hiện vật đã duyệt và đang hiển thị, mỗi phòng 5 hiện vật, đúng template 5 bục.
- Tên hiện vật được thêm hậu tố "· bản N" để kết quả tìm kiếm và phân trang thay đổi theo từ khóa.

**Môi trường đo:**

| Thành phần | Cấu hình |
|---|---|
| Máy | AMD Ryzen 7 7730U (8 nhân / 16 luồng), 13,5 GB RAM; khoảng 6 GB swap đang dùng; có thêm container khác chạy nền (WordPress, MongoDB) |
| API | Commit `3af8fb7` + nhánh này, `npm run build` → `node dist/main.js`, `NODE_ENV=production`, **1 tiến trình**, Node v26.3.0, cổng 3101 |
| DB | Postgres 16.15 (Docker `postgres:16-alpine`, localhost:55433), pool TypeORM/pg mặc định (10 kết nối) |
| Rate limit | `PUBLIC_API_RATE_LIMIT=100000` (lý do ở mục Rate limit theo IP) |
| Công cụ | k6 v0.57.0, chạy cùng máy với API và DB |

## Kết quả chi tiết

Bằng chứng gốc (summary text và JSON đầy đủ) nằm trong [`evidence/k6/`](evidence/k6/).

### 200 CCU, lần 1 ([`load200.txt`](evidence/k6/load200.txt))

Thông lượng 138,5 req/s, 33.410 request, 0 lỗi (429 = 0, 5xx = 0).

| endpoint | requests | p50 ms | p95 ms | p99 ms | max ms |
|---|---|---|---|---|---|
| exhibit_location | 2669 | 2.3 | 7.5 | 12.8 | 48.6 |
| public_room_detail | 2356 | 3.1 | 9.1 | 14.4 | 26.5 |
| public_rooms_list | 2667 | 4.9 | 10.6 | 17.0 | 74.8 |
| room_detail | 8320 | 10.0 | 17.5 | 27.1 | 79.3 |
| rooms_list | 6540 | 4.6 | 10.0 | 16.7 | 69.8 |
| search | 6772 | 17.0 | 28.7 | 39.6 | 91.8 |
| ui_translations | 4080 | 4.8 | 10.5 | 17.5 | 52.7 |
| **TỔNG** | 33410 | 7.6 | **21.5** | 30.2 | 91.8 |

Lần 2 ([`load200-run2.txt`](evidence/k6/load200-run2.txt)): p95 tổng 24.0 ms, p99 35.7 ms, max 314.5 ms, lỗi 0%.

### 100 CCU

| Lần | Thông lượng | p50 | p95 | p99 | max | Lỗi |
|---|---|---|---|---|---|---|
| 1 ([`load100.txt`](evidence/k6/load100.txt)) | 66,2 req/s | 6.3 ms | 27.5 ms | 1594 ms | 2882 ms | 0% |
| 2 ([`load100-run2.txt`](evidence/k6/load100-run2.txt)) | 71,5 req/s | 6.5 ms | 18.8 ms | 24.9 ms | 54.8 ms | 0% |

Ở lần 1, p99 của **mọi endpoint** cùng tăng lên khoảng 1–2,9 s, nhưng p95 vẫn chỉ 27 ms. Lần này chạy ngay sau đợt stress 1000 VU, khi máy đang dùng khoảng 6 GB swap. Vì trễ xảy ra đồng thời ở mọi endpoint, đây là một lần dừng chung của cả hệ thống, có thể do swap hoặc GC. Lần chạy lại không còn hiện tượng này (max 54,8 ms). Kết luận: đây là nhiễu của máy đo, không phải lỗi của API. Hai lần đều đạt AC-49.

### Stress (ngoài phạm vi AC-49, để biết dư địa)

| VU | Thông lượng | p50 | p95 | p99 | Lỗi | Endpoint chậm nhất (p95) |
|---|---|---|---|---|---|---|
| 500 ([`stress-500.txt`](evidence/k6/stress-500.txt)) | 261,8 req/s | 106 ms | 374 ms | 479 ms | 0% | search 429 ms, room_detail 408 ms |
| 1000 ([`stress-1000.txt`](evidence/k6/stress-1000.txt)) | 313,9 req/s | 1016 ms | 2137 ms | 2230 ms | 0% | search 2198 ms, room_detail 2178 ms |

## Điểm nghẽn

Đo `top` trong lúc chạy 800 VU:
- Tiến trình API chiếm khoảng **119% CPU**, tức luồng JS chính đã bão hòa; phần vượt 100% là GC và libuv.
- 10 kết nối Postgres, mỗi kết nối khoảng 20% CPU. k6 chiếm khoảng 32%.
- Toàn máy còn **66% CPU rảnh**.

Vậy giới hạn khoảng 300 req/s là giới hạn của một tiến trình Node. Ở mức tải thấp, endpoint chậm nhất là `search` (p50 15–17 ms) và `room_detail` (p50 9–10 ms), do có truy vấn ILIKE trên JSONB và phải dựng DTO nhiều hiện vật kèm hotspot.

Không cần tối ưu thêm cho AC-49. Nếu sau này cần vượt khoảng 500 CCU, có hai hướng:
1. Chạy nhiều instance API sau reverse proxy. Lưu ý: hàng đợi upload bất đồng bộ (BT3 VT-078) đang giả định **chỉ một instance** xử lý job, nên phải tách worker trước khi scale.
2. Cache response công khai ở CDN hoặc proxy. Hiện các endpoint trả `Cache-Control: no-cache` theo BR-22/AC-51, nên muốn cache phải có cơ chế revalidate (ETag).

## Rate limit theo IP

`PublicRateLimitGuard` đếm request theo `request.ip`. Mọi VU của k6 đều đi ra từ 127.0.0.1, nên với giới hạn mặc định thì bài đo sẽ đo rate limiter chứ không đo API. Vì vậy các lần đo chính đặt `PUBLIC_API_RATE_LIMIT=100000`.

Để định lượng rủi ro, tôi chạy thêm một lần 200 CCU vào một API thứ hai giữ **giá trị mặc định 600 request/phút/IP** ([`shared-ip-default-limit-load200.txt`](evidence/k6/shared-ip-default-limit-load200.txt)):

- 14.476 request, trong đó **13.319 response là 429 (91,7%)**, 5xx = 0.
- Mỗi khách gửi khoảng 0,69 req/s ≈ 42 request/phút (138,5 req/s chia 200 VU), nên 200 khách sau một IP tạo khoảng **8.300 request/phút**, gấp gần 14 lần giới hạn 600.

Ở bảo tàng thật, khách tại chỗ thường dùng chung Wi-Fi nên đi ra Internet bằng **một IP public**. Với cấu hình mặc định, chỉ khoảng 15 khách đồng thời là đã chạm giới hạn. Chú thích trong `.env.example` đã ghi "Khách chung Wi-Fi bảo tàng dùng chung IP: đặt rộng", nhưng giá trị mặc định vẫn là 600.

**Đề xuất (cần nhóm quyết định, nhánh này không đổi code hay giá trị mặc định):**
- Nếu triển khai có Wi-Fi tại chỗ, đặt `PUBLIC_API_RATE_LIMIT` ≥ 200 × 42 × 1,5 ≈ **12.600** (làm tròn 15.000).
- Hoặc miễn giới hạn cho IP của bảo tàng ở reverse proxy.
- Đồng thời kiểm tra `TRUST_PROXY` để API lấy đúng IP client thay vì IP của proxy. Nếu cấu hình sai, **mọi** khách sẽ dùng chung một IP.

## Cách chạy lại

Xem [`back-end/load/k6/README.md`](../../../back-end/load/k6/README.md). Tóm tắt (trong `back-end/`):

```bash
npm run migration:run && npm run seed && npm run load:k6:prepare   # DATABASE_URL trỏ Postgres local
npm run build && <env đo tải> node dist/main.js                    # cổng 3101
K6_PROFILE=load200 K6_SUMMARY_JSON=../docs/tasks/be/evidence/k6/load200.json npm run load:k6
```

## File thay đổi

| File | Vai trò |
|---|---|
| `back-end/scripts/k6-load-data.ts` | Chuẩn bị dữ liệu: seed demo rồi nhân bản thành `K6_LOAD_ROOMS` phòng. Chạy lại nhiều lần cho cùng kết quả, chỉ chấp nhận DB localhost |
| `back-end/scripts/k6-load-data.spec.ts` | 16 test: chặn host không phải local, kiểm tham số số phòng, định dạng slug |
| `back-end/load/k6/public-visitor.js` | Kịch bản khách tham quan, ngưỡng theo endpoint, đếm 429/5xx |
| `back-end/load/k6/lib/profiles.js`, `lib/summary.js` | Profile tải, ngưỡng AC-49, bảng tóm tắt theo endpoint (chạy offline, không cần jslib) |
| `back-end/load/k6/README.md` | Hướng dẫn chạy |
| `back-end/package.json` | `load:k6:prepare`, `load:k6`, `test:load-scripts` |
| `back-end/.eslintrc.cjs` | Bỏ qua `load/` vì đây là runtime k6, không phải Node |

## Kiểm chứng

- `npm run test:load-scripts`: 16/16 test đạt.
- `npm run lint`, `npm run typecheck`: sạch.
- `npm test` (toàn bộ back-end): 2188/2188 test đạt.
- Đã thử chạy `load:k6:prepare` hai lần liên tiếp: vẫn đúng 41 phòng và 205 hiện vật. Với `DATABASE_URL` trỏ host lạ, script từ chối chạy.

## Giới hạn của phép đo

- k6, API và Postgres chạy chung một máy, lại có tiến trình khác chạy nền. Số đo trên máy chủ thật có thể khác. Phép đo này không đi qua mạng thật, CDN hay TLS.
- Không đo các API quản trị, việc tải file GLB hay media (băng thông Storage có rate limit riêng là `PUBLIC_MEDIA_RATE_LIMIT`), hay upload.
- Dữ liệu chỉ có 205 hiện vật. Nếu dữ liệu tăng nhiều, cần đo lại `search`, vì truy vấn ILIKE trên JSONB không dùng index.

## Câu hỏi mở

1. Giá trị `PUBLIC_API_RATE_LIMIT` khi triển khai thật là bao nhiêu? Có miễn giới hạn cho IP của bảo tàng không?
2. Có cần thêm bước k6 smoke vào CI (exit code khác 0 khi trượt ngưỡng) không?
