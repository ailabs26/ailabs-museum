# 14 — Xử lý Sự cố và Vận hành Backend

> Tổng hợp các lỗi cấu hình, bảo mật, lưu trữ và triển khai thường gặp trên `back-end/` kèm nguyên nhân gốc và cách xử lý theo mã nguồn hiện hành.

## 1. Ứng dụng không khởi động: `Error: Invalid environment: ...`

- **Nguyên nhân**: `validateEnvironment()` trong `src/config/env.validation.ts` chặn fail-fast khi thiếu biến hoặc vi phạm ràng buộc.
- **Các tình huống phổ biến**:
  - Chạy với `NODE_ENV=production` nhưng chưa đặt tường minh `JWT_ACCESS_SECRET`, `MEDIA_URL_SIGNING_SECRET`, `TOTP_ENCRYPTION_KEY` (phải ≥ 32 ký tự và khác chuỗi dev/placeholder).
  - Đặt `MEDIA_STORAGE_DRIVER=supabase` nhưng thiếu `SUPABASE_URL` hoặc thiếu cả `SUPABASE_SECRET_KEY` lẫn `SUPABASE_SERVICE_ROLE_KEY`.
  - Sai cú pháp `TRUST_PROXY` (chỉ chấp nhận `false`, `true`, số hop nguyên, `loopback`/`linklocal`/`uniquelocal`, hoặc danh sách IP/CIDR).

## 2. Refresh cookie bị `403` hoặc không xoay vòng phiên trên trình duyệt

- **Nguyên nhân 1 (`RefreshCookieOriginGuard`)**: trình duyệt gửi header `Origin` không khớp `FRONTEND_ORIGIN` (hoặc origin của chính API). Kiểm tra lại `FRONTEND_ORIGIN` (bao gồm protocol và port, không có dấu `/` thừa).
- **Nguyên nhân 2 (Reuse Detection)**: nếu 2 tab cùng gọi `POST /api/auth/refresh` với cùng cookie cũ hoặc token đã `used_at` bị gửi lại, toàn bộ `family_id` sẽ bị thu hồi (`revoked_at = now()`) và `ActiveSessionGuard` lập tức trả `401` cho mọi request mang `sid` đó. Người dùng cần đăng nhập lại; phía FE cần đảm bảo khóa điều phối refresh giữa các tab.

## 3. Rate limit chặn nhầm tất cả người dùng sau Reverse Proxy

- **Triệu chứng**: mọi request đều bị tính chung 1 IP (IP của Nginx/Cloudflare/Load Balancer) dẫn đến sớm chạm ngưỡng `AuthRateLimiter`, `PublicRateLimitGuard` hoặc `ThrottlerGuard`.
- **Cách xử lý**: đặt `TRUST_PROXY=1` (hoặc số hop/CIDR proxy thực tế) để Express lấy IP thật từ `X-Forwarded-For`. **Không** bật `TRUST_PROXY=true` khi API mở trực tiếp ra internet mà không qua proxy tin cậy vì client có thể giả mạo `X-Forwarded-For`.

## 4. Lỗi `422` khi Submit Review / Publish / Unhide hiện vật

Kiểm tra mảng `errors[].code` trong phản hồi `ApiResponse`:
- `gallery_slot_occupied`: bục `S01..S05` trong phòng đã có hiện vật công khai khác chiếm giữ → đổi vị trí bục khác hoặc ẩn hiện vật cũ trước.
- `media_not_found` / `media_not_ready` / `media_kind_mismatch`: media đã bị xóa mềm, chưa sẵn sàng hoặc gắn nhầm loại slot (vd gắn ảnh vào slot `model`).
- `image_alt_text_missing`, `audio_transcript_missing`, `audio_subtitle_missing`, `subtitle_without_audio`, `media_rights_missing`: bổ sung đủ metadata trợ năng và bản quyền theo §5.2 SRS trước khi gửi duyệt.

## 5. Tệp media trả `404` tại `/media/uploads/...` hoặc lỗi tải trên Supabase

- **Tệp nháp chưa xuất bản**: `MediaDeliveryController` cố tình trả `404` nếu tệp chưa được revision công khai tham chiếu và URL không kèm chữ ký hợp lệ (`?exp=...&sig=...`). Với màn hình Preview CMS, luôn lấy URL có chữ ký từ `GET /api/admin/exhibits/:id/preview` (hạn mặc định `MEDIA_SIGNED_URL_TTL_SECONDS = 900s`).
- **Tải GLB bị ngắt hoặc không tìm thấy file trong storage**: kiểm tra `MEDIA_STORAGE_DRIVER`, tên bucket `SUPABASE_STORAGE_BUCKET` và log cảnh báo `"File của media <id> không còn trong kho lưu trữ"`. Nếu cần dọn thùng rác/file mồ côi, chạy mặc định `MEDIA_ORPHAN_CLEANUP=dry-run` và kiểm tra log cron 03:30 trước khi đổi sang `on`.

## 6. `GET /api/health/ready` trả `503`

- `HealthService.pingDatabase()` thực thi `SELECT 1` với ngưỡng `2000ms`. Khi gặp `503`, kiểm tra `DATABASE_URL`, cấu hình TLS (`DATABASE_SSL=true` và `DATABASE_SSL_CA` khi dùng Supabase pooler) và tình trạng kết nối mạng tới PostgreSQL. Không dùng `/api/health/ready` làm liveness probe vì sẽ kích hoạt restart loop khi DB chập chờn.
