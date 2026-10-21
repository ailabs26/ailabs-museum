# Plan triển khai — Phân hệ Quản trị hệ thống (Admin Subsystem)

> Plan chi tiết để hiện thực hóa kiến trúc ở [`../architecture/07-admin-subsystem.md`](../architecture/07-admin-subsystem.md).
> Dùng làm **codebase mẫu** cho cả nhóm: mỗi module đi theo đúng `core/` + quy ước ở
> [`../architecture/be/coding-conventions.md`](../architecture/be/coding-conventions.md).
> Ánh xạ PR: tương ứng **#C (seed)** và **#D (auth-rbac)** trong [`../architecture/09-roadmap-and-branching.md`](../architecture/09-roadmap-and-branching.md).

## 1. Mục tiêu & phạm vi

Phân hệ quản trị là nền cho mọi module CMS khác. Phạm vi plan này:

- **AuthModule** — đăng nhập/làm mới/đăng xuất/lấy thông tin phiên (`/auth/*`), `JwtAuthGuard`, xoay vòng refresh token.
- **UsersModule** — CRUD tài khoản + gán/bỏ vai trò.
- **RolesModule** (gồm permissions) — CRUD vai trò + đọc danh mục quyền + đặt ma trận quyền cho vai trò.
- **AuditModule** — đọc nhật ký + `AuditInterceptor` ghi vết tự động.
- **Seed** — tạo quyền chuẩn, 3 vai trò mặc định (admin/moderator/editor) và tài khoản admin đầu tiên.
- **RBAC guard áp route** — `JwtAuthGuard` (global) + `PermissionsGuard` cho các route quản trị.

**Ngoài phạm vi:** FE admin pages (PR #F riêng), module nội dung (rooms/exhibits/media), kiểm duyệt/report.

## 2. Phụ thuộc & chuẩn bị

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| `core/*` (BaseRepository, ApiResponse, filter, interceptor, guards) | ✅ đã có | Tái sử dụng, không sửa |
| `common/*` (enums, PERMISSIONS, AuthUser, DTO phân trang) | ✅ đã có | `PERMISSIONS`, `RoleKey`, `DEFAULT_ROLE_PERMISSIONS` đã định nghĩa |
| 13 entity + migration | ✅ đã có | Gồm `User/Role/Permission/UserRole/RolePermission/RefreshSession/AuditLog` |
| Extension DB `uuid-ossp`, `citext` | ✅ đã vá | commit `fix(be-db)` |
| `@nestjs/jwt` | ⬜ cần thêm | Ký/verify access token |
| Thư viện hash mật khẩu | ⬜ cần thêm | **`bcryptjs`** (thuần JS, không cần build native — an toàn đa nền tảng cho nhóm) hoặc `argon2`. Plan chọn `bcryptjs`. |
| `@nestjs/throttler` | ⬜ cần thêm (giai đoạn rate-limit) | Chặn brute-force login/refresh |
| `cookie-parser` | ⬜ cần thêm | Đọc refresh token từ httpOnly cookie |

### Biến môi trường mới (`config/env.ts`)

| Biến | Mặc định dev | Ý nghĩa |
|---|---|---|
| `JWT_ACCESS_SECRET` | *(bắt buộc)* | Khóa ký access token |
| `JWT_ACCESS_TTL` | `15m` | Hạn access token |
| `JWT_REFRESH_TTL_DAYS` | `7` | Hạn refresh token (ngày) |
| `REFRESH_COOKIE_NAME` | `aura_rt` | Tên cookie refresh |
| `BCRYPT_ROUNDS` | `12` | Cost factor hash mật khẩu |
| `SEED_ADMIN_EMAIL` | `admin@aura.local` | Email admin seed |
| `SEED_ADMIN_PASSWORD` | *(bắt buộc khi seed)* | Mật khẩu admin seed (không commit) |

## 3. Chiến lược token (chốt theo 05-security-rbac)

- **Access token (JWT, ~15 phút):** payload `{ sub: userId, email, roles: string[], permissions: string[] }`. Gửi qua header `Authorization: Bearer`.
- **Refresh token (~7 ngày, lưu DB dạng hash):** chuỗi ngẫu nhiên 32 byte; chỉ lưu `token_hash = sha256(raw)` trong `refresh_sessions`. Gửi/nhận qua **httpOnly cookie** (`SameSite=Lax`, `Secure` ở production).
- **Rotation:** mỗi lần `/auth/refresh` → tạo session mới cùng `family_id`, đặt `used_at` + `replaced_by_id` cho session cũ, phát hành raw token mới.
- **Reuse detection:** nếu một session đã có `used_at`/`revoked_at` lại bị dùng để refresh → **thu hồi toàn bộ family** (`revoked_at = now()` cho mọi session cùng `family_id`) và trả 401.
- **Logout:** thu hồi session hiện tại (và tùy chọn cả family), xóa cookie.
- **User `disabled`:** mọi login/refresh bị từ chối.

## 4. Cấu trúc thư mục dự kiến (`back-end/src`)

```
core/auth/
  jwt-auth.guard.ts        # mới: verify access token, gắn AuthUser vào request
  jwt.payload.ts           # mới: type payload access token
modules/ (giữ phẳng theo convention hiện tại — mỗi domain 1 thư mục)
auth/
  auth.module.ts
  auth.controller.ts       # /auth/login|refresh|logout|me
  auth.service.ts          # xác thực, phát hành token, rotation
  token.service.ts         # ký access, tạo/băm/so khớp refresh, quản lý family
  dto/login.dto.ts
users/
  users.module.ts
  users.controller.ts      # GET/POST/:id PATCH/:id DELETE/:id, :id/roles
  users.service.ts
  repositories/users.repository.ts   # extends BaseRepository<User>
  dto/create-user.dto.ts, update-user.dto.ts, assign-roles.dto.ts
  dto/user-response.dto.ts           # ẩn passwordHash
roles/
  roles.module.ts
  roles.controller.ts      # GET/POST/:id PATCH/:id DELETE, :id/permissions GET|PUT, GET /permissions
  roles.service.ts
  repositories/roles.repository.ts
  dto/create-role.dto.ts, update-role.dto.ts, set-permissions.dto.ts
audit/
  audit.module.ts
  audit.controller.ts      # GET /audit, GET /audit/:id
  audit.service.ts         # ghi (append-only) + đọc có filter/phân trang
  audit.interceptor.ts     # ghi vết tự động cho route ghi/sửa
  repositories/audit.repository.ts
seed/
  seed.ts                  # script chạy bằng ts-node: quyền + 3 role + admin đầu tiên
```

> Theo convention hiện tại dự án để module **phẳng** ngay dưới `src/` (như `exhibits/`), không bọc trong `modules/`. Plan tuân theo đó.

## 5. Hợp đồng API (khớp 06-api-contract)

Mọi response bọc `ApiResponse<T>` qua `ResponseInterceptor` sẵn có. Lỗi đi qua `AllExceptionsFilter`.

### 5.1 Auth
| Method | Path | Quyền | Body | Trả về |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` | `{ accessToken, user }` + set cookie refresh |
| POST | `/auth/refresh` | public (cookie) | — | `{ accessToken }` + cookie refresh mới |
| POST | `/auth/logout` | đã đăng nhập | — | `{ success: true }`, xóa cookie |
| GET | `/auth/me` | đã đăng nhập | — | `AuthUser` (id, email, displayName, roles, permissions) |

### 5.2 Users
| Method | Path | Quyền |
|---|---|---|
| GET | `/users?page&pageSize&q&status` | `user:read` |
| POST | `/users` | `user:create` |
| GET | `/users/:id` | `user:read` |
| PATCH | `/users/:id` | `user:update` |
| DELETE | `/users/:id` | `user:delete` (soft delete) |
| POST | `/users/:id/roles` | `role:assign` |
| DELETE | `/users/:id/roles/:roleId` | `role:assign` |

### 5.3 Roles & Permissions
| Method | Path | Quyền |
|---|---|---|
| GET | `/roles` | `role:read` |
| POST | `/roles` | `role:create` |
| PATCH | `/roles/:id` | `role:update` |
| DELETE | `/roles/:id` | `role:delete` |
| GET | `/roles/:id/permissions` | `role:read` |
| PUT | `/roles/:id/permissions` | `role:update` (đặt toàn bộ ma trận) |
| GET | `/permissions` | `permission:read` |

### 5.4 Audit
| Method | Path | Quyền |
|---|---|---|
| GET | `/audit?page&pageSize&actorId&action&resourceType&from&to` | `audit:read` |
| GET | `/audit/:id` | `audit:read` |

## 6. RBAC & guard

- `JwtAuthGuard` đăng ký **global** (APP_GUARD) → mọi route yêu cầu access token, trừ route đánh `@Public()`.
- `PermissionsGuard` đã có, chạy sau, đối chiếu `@Permissions(...)`.
- Route public hiện tại (`/rooms`, `/health`, `/auth/login`, `/auth/refresh`) phải đánh `@Public()` để không vỡ.
- Payload access token mang sẵn `roles` + `permissions` → guard không cần truy vấn DB mỗi request.

## 7. Seed (PR #C)

`seed/seed.ts` (idempotent, chạy `ts-node`):
1. Upsert toàn bộ `PERMISSIONS` vào bảng `permissions`.
2. Upsert 3 role theo `DEFAULT_ROLE_PERMISSIONS` (admin/moderator/editor) + ghi `role_permissions`.
3. Tạo admin đầu tiên từ `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (hash bcrypt), gán role `admin` nếu chưa có.
4. (Tùy chọn) seed 5 hiện vật demo — có thể tách script riêng.

Thêm script `package.json`: `"seed": "ts-node -r tsconfig-paths/register src/seed/seed.ts"`.

## 8. AuditInterceptor

- Bọc route ghi/sửa quản trị; sau khi service trả thành công → `AuditService.record({ actorId, action, resourceType, resourceId, reason, requestId })`.
- Append-only: chỉ INSERT; không endpoint sửa/xóa audit.
- Ghi cả khi 403 (truy cập trái phép) ở các hành động nhạy cảm.
- `requestId` lấy từ header `X-Request-Id` (hoặc sinh uuid ở middleware).

## 9. Bảo mật & chất lượng

- Mật khẩu hash bcrypt (cost `BCRYPT_ROUNDS`), không bao giờ log/plaintext, không trả `passwordHash` ra API (DTO response loại bỏ).
- Rate limit `@nestjs/throttler` cho `/auth/login`, `/auth/refresh`, (và `/reports` sau này).
- CORS đã giới hạn `FRONTEND_ORIGIN`; bổ sung Helmet ở `main.ts`.
- Secret chỉ qua env; `.env` đã trong `.gitignore`.
- Không tin `roles/permissions` do client gửi — chỉ lấy từ token đã verify.

## 10. Kiểm thử tối thiểu (DoD)

- `token.service` — rotation phát hành token mới + đánh dấu cũ; reuse-detection thu hồi family.
- `auth.service` — login sai mật khẩu/disabled → 401; login đúng → access + cookie.
- `permissions.guard` — thiếu quyền → 403 (đã có khung).
- `users.service` — trùng email → 409; soft delete không xóa cứng.
- Mỗi PR: `typecheck`, `lint`, `build` sạch; endpoint trả `ApiResponse`; có migration nếu đổi schema.

## 11. Chia nhỏ công việc (ánh xạ task)

| Task | Nội dung | File task |
|---|---|---|
| T-SEED | Seed permissions + roles + admin | [`../tasks/admin-be-seed.md`](../tasks/admin-be-seed.md) |
| T-AUTH | AuthModule + TokenService + JwtAuthGuard + env | [`../tasks/admin-be-auth.md`](../tasks/admin-be-auth.md) |
| T-USERS | UsersModule (CRUD + gán role) | [`../tasks/admin-be-users.md`](../tasks/admin-be-users.md) |
| T-ROLES | RolesModule (+ permissions matrix) | [`../tasks/admin-be-roles-permissions.md`](../tasks/admin-be-roles-permissions.md) |
| T-AUDIT | AuditModule + AuditInterceptor | [`../tasks/admin-be-audit.md`](../tasks/admin-be-audit.md) |
| T-FE | FE admin skeleton (Login/Dashboard/Users/Roles/Matrix/Audit) | [`../tasks/admin-fe-skeleton.md`](../tasks/admin-fe-skeleton.md) |

## 12. Thứ tự thực hiện đề xuất

1. T-SEED (độc lập, mở đường cho đăng nhập thử).
2. T-AUTH (nền cho mọi route bảo vệ).
3. T-USERS + T-ROLES (song song được sau khi có auth).
4. T-AUDIT (gắn interceptor lên các route users/roles).
5. T-FE (nối API sau khi BE ổn định).
