# Task: An toàn trước production — khóa bí mật, IP sau proxy, health check, CI

Người phụ trách: Nguyễn Văn Thắng. PR: `feat/production-hardening` (back-end), `ci/github-actions` (CI). Đóng issue #82 (phần trust proxy).

## Bối cảnh

- `JWT_ACCESS_SECRET` và `MEDIA_URL_SIGNING_SECRET` có giá trị mặc định công khai trong mã nguồn. Deploy mà quên đặt
  env thì ai đọc repo cũng ký được access token Admin và URL xem trước media.
- Chưa bật `trust proxy`: sau reverse proxy, `req.ip` luôn là IP của proxy → rate limit đăng nhập (20 request/phút/IP)
  chặn chung mọi người, phiên đăng nhập và audit ghi sai IP.
- `GET /api/health` luôn trả `ok` kể cả khi DB đã chết → không dùng được cho readiness probe.
- Chưa có CI: PR #81 làm hỏng 53 test `rbac-http` nhưng đến PR #91 mới phát hiện.

## Thay đổi

### Khóa bí mật khi production (`config/env.validation.ts`)

- Thêm `NODE_ENV` (`development` | `test` | `production`, mặc định `development`).
- Khi `NODE_ENV=production`, mỗi khóa `JWT_ACCESS_SECRET`, `MEDIA_URL_SIGNING_SECRET` phải: được đặt tường minh,
  dài ≥ 32 ký tự, không trùng khóa dev trong mã nguồn hay khóa mẫu của `.env.example`. Sai → app **không khởi động**,
  lỗi `Invalid environment: <tên biến>` (không in giá trị).
- Dev/test giữ nguyên hành vi (vẫn dùng được khóa mặc định). Khóa dev là hằng số dùng chung
  (`DEV_JWT_ACCESS_SECRET`, `DEV_MEDIA_URL_SIGNING_SECRET`) cho cả `jwt.config.ts`, `media.config.ts`.

### IP client sau reverse proxy (`TRUST_PROXY`)

- `parseTrustProxy()` (`config/app.config.ts`) → `app.trustProxy`; `main.ts` áp `app.set('trust proxy', …)`.
- Giá trị: trống/`false` (mặc định, như cũ) | số hop (`1` — khuyên dùng khi có 1 proxy) | `true` |
  danh sách IP/subnet/`loopback`/`linklocal`/`uniquelocal`. Sai cú pháp → `Invalid environment: TRUST_PROXY`.
- Ảnh hưởng: rate limit đăng nhập/refresh/đổi mật khẩu, IP của phiên đăng nhập, IP trong audit.
- Redis cho bộ đếm rate limit chỉ cần khi chạy nhiều instance — chưa làm.

### Health check (`modules/health`)

- Tách `HealthModule` (`HealthController` + `HealthService`).
- `GET /api/health`: liveness, không chạm DB (DB chập chờn không làm proxy khởi động lại app).
- `GET /api/health/ready`: `SELECT 1` với timeout 2 s → 200 `{ status: "ok", db: "up", latencyMs }`;
  DB lỗi hoặc treo → 503 "Cơ sở dữ liệu không sẵn sàng", chi tiết lỗi chỉ ghi log server.

### Cấu hình môi trường

- `.env.example`: thêm `TRUST_PROXY=false` và ghi chú yêu cầu khóa khi `NODE_ENV=production`.
- `.env` local: chỉ thêm `TRUST_PROXY=false` (FE gọi thẳng API, không qua proxy). Môi trường deploy phải đặt
  `NODE_ENV=production`, hai khóa riêng (`openssl rand -hex 32`) và `TRUST_PROXY` theo số proxy thực tế.

## Kiểm chứng ngày 29/10/2026

- Back-end: typecheck, lint, build đạt; `npm test` 2005/2005 với PostgreSQL 16 tạm; coverage lõi 95,94% line ·
  97,72% branch · 98,05% function. Test mới: `config/tests/config.spec.ts` (production thiếu khóa / khóa dev / khóa mẫu /
  khóa ngắn → từ chối, chỉ nêu tên biến; `parseTrustProxy` các dạng hợp lệ và sai), `modules/health/tests/health.spec.ts`
  (liveness không chạm DB; ready 200; DB lỗi → 503 không lộ chi tiết; DB treo → 503 sau timeout; ping PostgreSQL thật
  rồi mất kết nối).
- Boot thật `npm run start:prod` với `NODE_ENV=production` và PostgreSQL tạm:
  - thiếu `MEDIA_URL_SIGNING_SECRET` → dừng với `Invalid environment: MEDIA_URL_SIGNING_SECRET`;
  - đủ khóa → chạy; `/api/health/ready` 200; tắt DB → 503 sau 2 ms, `/api/health` vẫn 200;
  - 22 request `/api/auth/refresh` với 22 `X-Forwarded-For` khác nhau: không đặt `TRUST_PROXY` → request 21–22 bị 429
    (gộp chung 1 IP, đúng hành vi cũ); `TRUST_PROXY=1` → không request nào bị 429 (mỗi IP một bộ đếm).
