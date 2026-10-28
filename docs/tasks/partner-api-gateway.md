# Task: Cổng API đối tác và quản lý API key

Nhánh: `feat/partner-api-gateway`. Người phụ trách: Nguyễn Văn Thắng (giai đoạn 3 — mở rộng module quản lý API key cho bên thứ ba).
Phần quản lý key (bảng `partner_api_keys`, tạo/thu hồi/xóa, trang `ApiKeysPage`) do Nguyễn Đức Quang dựng trước (PR #108);
task này bổ sung phần còn thiếu để key thực sự dùng được.

## Trước task

Key sinh được, lưu hash, có scope và thu hồi được, nhưng **không endpoint nào nhận key**: scope chỉ lưu chứ không áp dụng,
chưa có rate limit theo key, `last_used_at` không bao giờ cập nhật, xóa key là xóa cứng.

## Đã làm

- **Cổng `/api/partner/v1`** (`PartnerApiController`): `rooms` (`rooms:read`), `rooms/:slug` (`exhibits:read`),
  `rooms/:slug/tour` (`tour:embed`), `rooms/:slug/exhibits/:id/model` (`media:read`). Tái dùng `ExhibitsService`/`PublicModelsService`
  nên chỉ trả nội dung Published. API công khai cho trang web giữ nguyên.
- **`PartnerApiKeyGuard`**: `X-API-Key` → hash → key active/chưa xóa/chưa hết hạn (401) → rate limit theo key (429 + `Retry-After`,
  header `X-RateLimit-*`) → scope của route (403). `public:read` bao trùm các scope đọc nội dung (không gồm `analytics:read`).
  Route là `@Public()` nên guard JWT của admin bỏ qua; khóa đối tác không mở được route admin.
- **Rate limit theo key**: cột `rate_limit_per_minute` (mặc định 60, CHECK 1–10000), `PartnerRateLimiter` cửa sổ trượt trong bộ nhớ.
- **`last_used_at`** cập nhật khi key được dùng, tối đa mỗi phút một lần/key; lỗi ghi không làm hỏng request.
- **Xóa key → xóa mềm** (`is_deleted`/`deleted_at`, thu hồi nếu đang hoạt động), thống nhất chính sách xóa mềm.
- Migration `PartnerApiKeyRateLimitAndSoftDelete1793400000000` (timestamp đặt sau `1793300000000` của migration tạo bảng).
- Giao diện `ApiKeysPage`: ô "Giới hạn request/phút", cột "Giới hạn", xóa không còn là "xóa vĩnh viễn", hướng dẫn `curl` trong hộp thoại khóa mới.
- `npm test` nay chạy cả `src/modules/partner-api-keys/tests` (thêm script `test:partner`).

## Chưa làm / lưu ý

- `analytics:read` chưa gắn route nào — phụ thuộc task dọn dẹp và tổng hợp analytics.
- Bộ đếm rate limit trong bộ nhớ: mất khi restart, chạy nhiều instance cần Redis; sau reverse proxy không ảnh hưởng (đếm theo key, không theo IP).
- **Migration `1793400000000` chưa chạy trên DB dùng chung** (migration tạo bảng `1793300000000` của Quang đã chạy). Cần backup rồi chạy trước khi deploy code; chưa chạy thì API quản lý key lỗi vì thiếu cột.

## Kiểm chứng ngày 28/10/2026

- Back-end: typecheck, lint, build đạt; `npm test` 1966/1966 với PostgreSQL 16 tạm; test mới `partner-api-keys.spec.ts`
  (scope, rate limiter, authenticate theo hash, ghi `last_used_at` có giới hạn, tạo với giới hạn mặc định/tùy chỉnh, xóa mềm),
  `partner-api-gateway.spec.ts` (401/403/429, đi qua guard JWT toàn cục, tour sắp theo `displayOrder`),
  `core-db.integration` (SQL thật: chỉ key active/chưa hết hạn/chưa xóa dùng được; xóa mềm ẩn khỏi danh sách).
- Front-end: typecheck, build đạt; vitest 170/170; ESLint file thay đổi sạch.
- E2E (back-end + PostgreSQL tạm): tạo key qua giao diện với giới hạn 3/phút → khóa `ak_live_` + 48 hex, có hướng dẫn `curl`;
  không key/key sai → 401; key đúng → 200 với `X-RateLimit-Limit: 3`; request thứ 4 → 429 `Retry-After: 60`;
  key đối tác gọi route admin → 401; thu hồi trên giao diện → 401 ngay; xóa → biến khỏi danh sách, DB `is_deleted = true`;
  key chỉ `rooms:read` gọi chi tiết phòng/tour/model → 403; giới hạn 0 → 400; audit `apikey.create/revoke/delete`.
