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
