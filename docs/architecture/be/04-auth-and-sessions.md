# 04 — Xác thực, Phiên đăng nhập và 2FA (`modules/auth/`)

> Mã nguồn: `back-end/src/modules/auth/` (`controllers/`, `entities/`, `guards/`, `repositories/`, `services/`, `exceptions/`, `dto/`).

`AuthModule` đăng ký chuỗi 3 `APP_GUARD` toàn cục theo đúng thứ tự:
1. `JwtAuthGuard` — xác thực chữ ký và hạn của Bearer JWT (bỏ qua nếu route có `@Public()`).
2. `ActiveSessionGuard` — xác nhận phiên (`familyId` / `sid`) phát hành access token vẫn còn sống trong `refresh_sessions`.
3. `PermissionsGuard` — kiểm tra danh sách quyền trong `@Permissions(...)`.

## 1. Danh mục Endpoint (`AuthController` & `UserTwoFactorController`)

| Method & Route | Guard / Quyền | `@Audit` | Mô tả |
|---|---|---|---|
| `POST /api/auth/login` | `@Public()` | *(ghi trực tiếp trong service)* | Đăng nhập bằng email + mật khẩu; nếu bật 2FA trả challenge tạm chờ xác thực |
| `POST /api/auth/login/2fa` | `@Public()` | *(ghi trực tiếp trong service)* | Hoàn tất đăng nhập 2FA bằng mã TOTP 6 số hoặc mã khôi phục |
| `POST /api/auth/refresh` | `@Public()`, `RefreshCookieOriginGuard` | *(ghi khi phát hiện reuse)* | Xoay vòng refresh token (từ httpOnly cookie `aura_rt` hoặc body native) |
| `POST /api/auth/logout` | `@Public()`, `RefreshCookieOriginGuard` | *(ghi trực tiếp)* | Thu hồi phiên hiện tại và xóa cookie `aura_rt` |
| `GET /api/auth/me` | JWT + ActiveSession | — | Lấy hồ sơ, vai trò và tập quyền hiện tại của người dùng |
| `PATCH /api/auth/me` | JWT + ActiveSession | `auth.profile_update` | Cập nhật thông tin hồ sơ cá nhân (`displayName`) |
| `POST /api/auth/change-password` | JWT + ActiveSession | `auth.password_change` | Đổi mật khẩu (kiểm mật khẩu cũ + policy) và thu hồi phiên thiết bị khác |
| `GET /api/auth/sessions` | JWT + ActiveSession | — | Liệt kê các phiên thiết bị đang hoạt động của chính người dùng |
| `DELETE /api/auth/sessions/:id` | JWT + ActiveSession | `auth.session_revoke` | Thu hồi 1 phiên thiết bị cụ thể |
| `POST /api/auth/sessions/revoke-others` | JWT + ActiveSession | `auth.session_revoke_others` | Đăng xuất tất cả thiết bị khác (giữ phiên hiện tại) |
| `POST /api/auth/logout-all` | JWT + ActiveSession | `auth.logout_all` | Thu hồi toàn bộ phiên của người dùng trên mọi thiết bị |
| `GET /api/auth/2fa` | JWT + ActiveSession | — | Kiểm tra trạng thái bật 2FA và số mã khôi phục còn lại |
| `POST /api/auth/2fa/setup` | JWT + ActiveSession | — | Tạo secret TOTP tạm, trả `otpauthUrl`, `qrDataUrl`, `secret` |
| `POST /api/auth/2fa/enable` | JWT + ActiveSession | `auth.2fa_enable` | Xác nhận mã đầu tiên, bật 2FA, sinh 10 mã khôi phục, đăng xuất thiết bị khác |
| `POST /api/auth/2fa/disable` | JWT + ActiveSession | `auth.2fa_disable` | Tắt 2FA (yêu cầu mật khẩu hiện tại / mã xác thực) |
| `POST /api/auth/2fa/recovery-codes` | JWT + ActiveSession | `auth.2fa_recovery_regenerate` | Sinh mới bộ 10 mã khôi phục (vô hiệu bộ cũ) |
| `POST /api/users/:id/2fa/reset` | `user:update` | `user.2fa_reset` | Quản trị viên đặt lại 2FA khi người dùng mất thiết bị xác thực |

## 2. Mô hình phiên (`RefreshSession`) và `TokenService`

Bảng `refresh_sessions` lưu trạng thái từng refresh token (chỉ lưu **SHA-256 hash**, không lưu token gốc):

- **`family_id`** (UUID): định danh một chuỗi đăng nhập trên 1 thiết bị; mọi lần xoay vòng đều giữ chung `family_id`. Access token mang claim `sid = family_id`.
- **`token_hash`** (`char(64)`, unique): hash SHA-256 của refresh token.
- **`replaced_by_id`** (UUID, nullable, unique): trỏ tới bản ghi kế tiếp sau khi xoay vòng.
- **`used_at` / `revoked_at` / `expires_at`**: kiểm soát trạng thái sử dụng, thu hồi và hết hạn (mặc định `JWT_REFRESH_TTL_DAYS = 7`).
- **`signed_in_at` / `user_agent` / `ip`**: hiển thị danh sách thiết bị đang đăng nhập trong CMS.
- **Index tối ưu**: `IDX_refresh_sessions_user_family (user_id, family_id)` và partial index `IDX_refresh_sessions_family_live (family_id) WHERE revoked_at IS NULL` giúp `ActiveSessionGuard` kiểm tra nhanh.

## 3. Cơ chế bảo vệ phiên, chống CSRF và chống lạm dụng

### 3.1 `ActiveSessionGuard` (thu hồi tức thì access token)
Access token có hạn ngắn (`JWT_ACCESS_TTL = 15m`), nhưng hệ thống **không chờ hết hạn** khi đăng xuất, đổi mật khẩu, khóa hoặc xóa tài khoản. Sau `JwtAuthGuard`, `ActiveSessionGuard` truy vấn `sessions.isFamilyLive(user.sessionId)`; nếu family đã bị thu hồi hoặc token cũ không có `sid`, guard lập tức trả `401 Phiên đăng nhập đã kết thúc`.

### 3.2 Xoay vòng refresh token & phát hiện tái sử dụng (Reuse Detection)
Mỗi lần gọi `POST /api/auth/refresh`:
- Token cũ được đánh dấu `used_at` và liên kết `replaced_by_id` sang bản ghi mới trong cùng `family_id`.
- Nếu một token đã dùng (`used_at != null`) bị gửi lại (dấu hiệu bị đánh cắp), backend **thu hồi toàn bộ `family_id`** và ghi vết sự kiện bảo mật vào `audit_logs`.

### 3.3 `RefreshCookieOriginGuard`
Vì `/auth/refresh` và `/auth/logout` là `@Public()` dùng httpOnly cookie, guard này kiểm tra header `Origin` trên request từ trình duyệt:
- Nếu không có `Origin` (CLI / native mobile client) → cho qua.
- Nếu có `Origin`, chỉ chấp nhận khi khớp `FRONTEND_ORIGIN` hoặc origin của chính API; sai origin → `403`.

### 3.4 `AuthRateLimiter` và `SessionsCleanupService`
- **`AuthRateLimiter`**: giới hạn tần suất theo cửa sổ trong bộ nhớ cho cả đăng nhập (chặn brute-force theo IP và theo email trước khi băm bcrypt) lẫn `/auth/refresh` với 3 ngưỡng cấu hình riêng:
  - `REFRESH_RATE_LIMIT_PER_SESSION` (mặc định 30/phút)
  - `REFRESH_RATE_LIMIT_PER_IP` (mặc định 300/phút)
  - `REFRESH_RATE_LIMIT_INVALID_PER_IP` (mặc định 20/phút khi cookie thiếu/sai)
- **`SessionsCleanupService`**: chạy định kỳ qua `@Cron` (`ScheduleModule`) để dọn các bản ghi `refresh_sessions` đã hết hạn/đã thu hồi lâu ngày, tránh phình bảng.

## 4. Xác thực 2 lớp TOTP (`TwoFactorService`)

Hệ thống hỗ trợ 2FA TOTP tùy chọn theo chuẩn **RFC 6238** (`otplib` + `qrcode`, `TOTP_ISSUER = 'Aura Museum'`, bước 30 giây, độ lệch cho phép ±1 bước):

1. **Lưu trữ mật mã an toàn**:
   - Cột `totp_secret_enc` và `totp_pending_enc` trên bảng `users` có `select: false` và được mã hóa **AES-256-GCM** qua `sealSecret`/`openSecret` với khóa `TOTP_ENCRYPTION_KEY`.
   - `totp_last_step` (`bigint`, `select: false`) lưu bước TOTP gần nhất đã chấp nhận (`claimStep`) để **chống phát lại (replay attack)**: mỗi mã 6 chữ số chỉ dùng được đúng 1 lần trong cửa sổ 30 giây.
2. **Quy trình bật 2FA**:
   - `POST /api/auth/2fa/setup`: sinh secret 20 byte base32, lưu tạm vào `totp_pending_enc`, trả `otpauthUrl`, ảnh QR dạng PNG data URL (`qrDataUrl`) và `secret`.
   - `POST /api/auth/2fa/enable`: xác minh mã 6 số đầu tiên; trong 1 transaction chuyển secret sang `totp_secret_enc`, đặt `totp_enabled_at`, sinh **10 mã khôi phục** (10 ký tự base32 dạng `xxxxx-xxxxx`, lưu hash SHA-256 tại bảng `user_recovery_codes`) và thu hồi các phiên thiết bị khác.
3. **Mã khôi phục (`UserRecoveryCode`)**:
   - Hàm `hashRecoveryCode()` loại khoảng trắng và dấu gạch ngang rồi lowercase trước khi băm SHA-256, nên người dùng nhập `ABCDE-FGHIJ` hay `abcdefghij` đều hợp lệ.
   - Mỗi mã khôi phục dùng đúng 1 lần (đánh dấu đã dùng trong transaction).
