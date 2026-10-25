# Task: Quản lý phiên đăng nhập — đăng xuất thiết bị khác, đăng xuất tất cả (back-end)

Nhánh: `feat/auth-sessions-api`. Người phụ trách: Nguyễn Văn Thắng (auth/RBAC, task 2–5).
Phần giao diện: `docs/tasks/fe/auth-sessions-page.md`.

## Bối cảnh

Một tài khoản đăng nhập được nhiều thiết bị (mỗi lần login = 1 refresh family), nhưng người dùng không xem
được mình đang đăng nhập ở đâu và không tự đăng xuất thiết bị khác được. Access JWT (15 phút) không tra DB,
nên thu hồi refresh (logout, khóa user, đổi mật khẩu) chưa đá thiết bị kia ra ngay.

Đã chốt: chỉ người dùng tự quản lý phiên **của mình** (không thêm quyền RBAC); thu hồi có hiệu lực **ngay**;
lưu User-Agent + IP để nhận ra thiết bị.

## Đã làm

- Migration `AddRefreshSessionDeviceInfo1792943375524`: `refresh_sessions` thêm `created_at`, `signed_in_at`,
  `user_agent varchar(512)`, `ip varchar(64)` và index partial `IDX_refresh_sessions_family_live (family_id) WHERE revoked_at IS NULL`.
  `signed_in_at` chép nguyên qua mỗi lần xoay vòng; `user_agent/ip` cập nhật theo request refresh mới nhất.
- Access JWT mang claim `sid` = familyId; `JwtAuthGuard` gắn `AuthUser.sessionId`.
- `ActiveSessionGuard` (APP_GUARD, thứ tự **JwtAuthGuard → ActiveSessionGuard → PermissionsGuard**): mỗi request đã
  đăng nhập kiểm family còn token chưa thu hồi và chưa hết hạn; không còn hoặc token thiếu `sid` → 401.
  Hệ quả: logout, đổi mật khẩu/khóa/xóa user (N3) cũng có hiệu lực ngay, không còn khoảng hở 15 phút.
- `SessionsService` + endpoint (cần đăng nhập, không cần permission):

  | Route | Hành vi | Audit |
  |---|---|---|
  | `GET /auth/sessions` | Thiết bị đang đăng nhập: `id` (familyId), `userAgent`, `ip`, `signedInAt`, `lastActiveAt`, `expiresAt`, `current` | — |
  | `DELETE /auth/sessions/:id` | Đăng xuất 1 thiết bị của mình; 404 nếu không phải của mình; là phiên hiện tại → xóa cookie | `auth.session_revoke` / `session` |
  | `POST /auth/sessions/revoke-others` | Đăng xuất mọi thiết bị khác, giữ thiết bị hiện tại; trả `{ id: userId }` | `auth.session_revoke_others` / `user` |
  | `POST /auth/logout-all` | Đăng xuất tất cả kể cả hiện tại, xóa cookie; trả `{ id: userId }` | `auth.logout_all` / `user` |

  Hai route hàng loạt trả `{ id }` để `AuditInterceptor` có sẵn ghi được vết (không sửa module audit).
- Vá race còn lại của N3: `login` phát hành refresh trong transaction dưới khóa user (shared) và đọc lại
  `passwordHash`/`status`; Admin vừa đổi mật khẩu/khóa trong lúc so bcrypt → 401, không cấp phiên bằng mật khẩu cũ.
- Không sửa module audit, rooms, exhibits, content-reports.

## Lưu ý vận hành

- **Chạy migration trên DB dùng chung trước khi deploy code** (backup trước bằng `back-end/tools/db/backup.sh`).
  Code mới đọc các cột mới; chưa migrate thì login/refresh lỗi.
- Sau deploy, access token cũ (không có `sid`) bị 401 một lần; frontend tự refresh lấy token mới, người dùng không phải đăng nhập lại.
- Mỗi request đã đăng nhập thêm 1 truy vấn `EXISTS` theo index partial.
- IP/User-Agent là dữ liệu cá nhân: chỉ chủ tài khoản xem được; vòng đời theo refresh session.
- Liên quan: N1 rate limit đăng nhập (PR #81), N3 thu hồi phiên khi đổi mật khẩu/khóa/xóa (PR #91), issue #82 (`trust proxy` — ảnh hưởng cả IP hiển thị ở đây).

## Kiểm chứng ngày 25/10/2026

- `npm run typecheck`, `npm run lint`, `npm run build`: đạt; boot `AppModule` với PostgreSQL tạm: đạt.
- `npm run test:core` (PostgreSQL 16 tạm, không dùng DB dùng chung): 245/245; `npm test`: 1857/1857.
- Coverage lõi: 96,40% line · 97,60% branch · 97,81% function.
- Test mới: `auth/tests/active-session-guard.spec.ts`, `auth/tests/auth-sessions.spec.ts` (thiết bị bị đăng xuất bị chặn
  ngay ở request kế tiếp, 404 phiên người khác, logout-all xóa cookie), bổ sung `token-service`, `auth-service`
  (race đăng nhập lúc đổi mật khẩu), `rbac-guards` (thứ tự 3 guard), `rbac-http` (phiên đã thu hồi → 401 trước kiểm quyền),
  `core-db.integration` (index partial, 1 dòng/thiết bị, revoke trừ phiên hiện tại, không thu hồi được phiên người khác).
- Migration `down` → `up` trên DB tạm: đạt.
