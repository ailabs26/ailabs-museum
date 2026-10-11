# Task T-AUTH: AuthModule + TokenService + JwtAuthGuard

Nhánh: `feat/be-auth-rbac`.
Plan: [`../plans/admin-subsystem-plan.md`](../plans/admin-subsystem-plan.md) §3, §5.1, §6.

## Phạm vi
- Thêm thư viện: `@nestjs/jwt`, `bcryptjs` (+ `@types/bcryptjs`), `cookie-parser` (+ `@types/cookie-parser`).
- Bổ sung biến môi trường vào `config/env.ts`: `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, `REFRESH_COOKIE_NAME`, `BCRYPT_ROUNDS`.
- `core/auth/jwt-auth.guard.ts` + `core/auth/jwt.payload.ts`: verify access token, gắn `AuthUser` vào `request.user`. Đăng ký **global** (`APP_GUARD`), tôn trọng `@Public()`.
- `auth/token.service.ts`:
  - `signAccess(user)` → JWT mang `{ sub, email, roles, permissions }`.
  - `issueRefresh(userId, familyId?)` → sinh raw 32 byte, lưu `sha256(raw)` vào `refresh_sessions`, trả raw.
  - `rotate(rawToken)` → xác thực hash + hạn, tạo session mới cùng family, đánh dấu `used_at`/`replaced_by_id`; phát hiện tái dùng → thu hồi cả family + 401.
  - `revoke(sessionId)` / `revokeFamily(familyId)`.
- `auth/auth.service.ts`: `login(email, password)` (so khớp bcrypt, chặn user `disabled`), `me(userId)`, `logout(sessionId)`.
- `auth/auth.controller.ts`: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`. Login/refresh đánh `@Public()`, set/clear httpOnly cookie refresh.
- Đánh `@Public()` cho các route công khai hiện có (`/rooms`, `/health`).
- `main.ts`: dùng `cookie-parser`.

## Ngoài phạm vi
- Rate limit `@nestjs/throttler` (làm ở bước bảo mật sau, có thể task riêng).
- Quản lý user/role (T-USERS, T-ROLES).

## Quy tắc
- Chỉ lưu **hash** refresh token, không lưu raw.
- Access token mang sẵn `roles`+`permissions` để guard không truy vấn DB mỗi request.
- Không trả `passwordHash`; không log token/mật khẩu.
- Refresh token qua httpOnly cookie `SameSite=Lax` (`Secure` ở production).

## Kiểm tra
- Login sai mật khẩu / user disabled → 401; đúng → `{ accessToken, user }` + cookie.
- Gọi route bảo vệ thiếu/ sai token → 401; có token hợp lệ → qua `JwtAuthGuard`.
- Refresh xoay vòng token; dùng lại token cũ → thu hồi family + 401.
- Unit test: `token.service` (rotation, reuse-detection), `auth.service` (login).
- `typecheck`, `lint`, `build` sạch.
