# Aura Museum API

Backend cho bảo tàng WebXR (3D-WEB-03): **NestJS + TypeScript + PostgreSQL + TypeORM**.
Gồm hai phần: **nội dung công khai** (chỉ đọc, phục vụ client) và **phân hệ quản trị hệ thống**
(xác thực, RBAC, quản lý người dùng/vai trò/quyền, nhật ký) — nền cho các module CMS tiếp theo.

Quy ước đặt tên và tổ chức code: [docs/coding-conventions.md](docs/coding-conventions.md).
Kiến trúc & plan: [../docs/architecture/](../docs/architecture/), [../docs/plans/admin-subsystem-plan.md](../docs/plans/admin-subsystem-plan.md).
**Thành viên và AI agent đọc coding-conventions trước khi thêm code.**

## 1. Yêu cầu & biến môi trường

- Node.js 20+, PostgreSQL 14+ (bật được extension `uuid-ossp`, `citext` — migration tự tạo).
- Sao chép `.env.example` → `.env` và điền:

| Biến | Mô tả |
|---|---|
| `PORT` | Cổng API (mặc định 3001) |
| `FRONTEND_ORIGIN` | Origin của FE cho CORS (mặc định `http://localhost:5173`) |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `JWT_ACCESS_SECRET` | Khóa ký access token (**bắt buộc đổi ở môi trường thật**, ≥16 ký tự) |
| `JWT_ACCESS_TTL` | Hạn access token (vd `15m`) |
| `JWT_REFRESH_TTL_DAYS` | Hạn refresh token (ngày, vd `7`) |
| `REFRESH_COOKIE_NAME` | Tên httpOnly cookie refresh (vd `aura_rt`) |
| `BCRYPT_ROUNDS` | Cost factor hash mật khẩu (10–15) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Tài khoản admin đầu tiên (chỉ dùng khi `npm run seed`) |

## 2. Chạy local

```sh
cd back-end
cp .env.example .env     # rồi điền DATABASE_URL, JWT_ACCESS_SECRET, SEED_ADMIN_*
npm install
npm run migration:run    # tạo extension + 13 bảng
npm run seed             # tạo quyền + 3 vai trò + admin đầu tiên (idempotent)
npm run dev              # chạy watch mode (tương đương npm run start)
```

- Bản production: `npm run build` rồi `npm run start:prod`.
- Lùi migration cuối: `npm run migration:revert`.

## 3. API

- **Tiền tố toàn cục `/api`.** Swagger UI: `http://localhost:3001/api/docs` (có ô nhập Bearer token).
- Media tĩnh phục vụ ngoài prefix: `GET /media/<file>`.

### Công khai (không cần token)
- `GET /api/health`
- `GET /api/rooms`, `GET /api/rooms/:slug` — nội dung đã xuất bản.

### Phân hệ quản trị (cần access token, trừ login/refresh)
- **Auth:** `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`.
- **Users:** `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`, `POST /api/users/:id/roles`, `DELETE /api/users/:id/roles/:roleId`.
- **Roles & Permissions:** `GET/POST /api/roles`, `PATCH/DELETE /api/roles/:id`, `GET|PUT /api/roles/:id/permissions`, `GET /api/permissions`.
- **Audit:** `GET /api/audit`, `GET /api/audit/:id`.

Mọi response theo envelope `ApiResponse<T>` (`{ success, data, message, meta? }`); endpoint list kèm `meta` phân trang.

## 4. Xác thực & RBAC

- **Access token** JWT (~15 phút) mang `roles` + `permissions`; gửi qua `Authorization: Bearer`.
- **Refresh token** (~7 ngày) chỉ lưu **hash** trong bảng `refresh_sessions`, trao đổi qua **httpOnly cookie**; **xoay vòng** mỗi lần refresh và **thu hồi cả family** nếu phát hiện token cũ bị dùng lại.
- `JwtAuthGuard` + `PermissionsGuard` đăng ký **toàn cục**. Route công khai đánh `@Public()`; route quản trị đánh `@Permissions('resource:action')`.
- Mật khẩu hash bằng bcrypt; không trả `passwordHash`/token ra API.
- Ghi vết tự động: route ghi/sửa đánh `@Audit('resource.action','resource')`; `AuditInterceptor` tạo `AuditLog` append-only sau khi thành công.

## 5. Cấu trúc `src/`

- `config/` — validation môi trường, TypeORM DataSource (dùng cho app, migration CLI và seed).
- `core/` — hạ tầng global: `http/` (ApiResponse, ResponseInterceptor, AllExceptionsFilter), `repository/` (BaseRepository), `database/` (TransactionManager), `security/` (PasswordService), `auth/` (JwtAuthGuard, PermissionsGuard, các decorator), `exceptions/`.
- `common/` — `constants/` (PERMISSIONS), `enums/` (RoleKey...), `dto/`, `types/` (AuthUser, Paginated).
- Module phân hệ quản trị: `auth/`, `users/`, `roles/` (gồm permissions), `audit/`.
- Module nội dung: `rooms/`, `exhibits/` (+ revision), `media/`, `hotspots/`, các bảng RBAC (`roles`, `permissions`, `user-roles`, `role-permissions`, `refresh-sessions`, `audit-logs`).
- `migrations/` — schema 13 bảng MVP (xem [../docs/architecture/04-data-model-erd.md](../docs/architecture/04-data-model-erd.md)).
- `seed/` — script seed quyền/vai trò/admin.
- `public/media/` — asset minh họa.

## 6. Migration

- Luôn giữ `synchronize: false`; đổi schema bằng TypeORM migration.
- Chỉ người phụ trách database chạy `migration:generate/run/revert`; AI agent không tự chạy.
- Kiểm tra file generate trước khi chạy (đặc biệt `DROP`, đổi enum/constraint).
- Không sửa/xóa migration đã chạy trên DB dùng chung; tạo migration mới cho thay đổi tiếp theo.
- TypeORM ghi lịch sử ở bảng `public.migrations`; không chỉnh thủ công.

```sh
npm run migration:generate -- src/migrations/TenMigration
```

## 7. Kiểm tra chất lượng

```sh
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # nest build
```

Phân hệ quản trị đã có đầy đủ xác thực, RBAC, CRUD người dùng/vai trò/quyền và nhật ký.
Các module nội dung CMS (CRUD rooms/exhibits, upload media, kiểm duyệt/report) và bộ kiểm thử
sẽ dựng ở các PR tiếp theo theo [../docs/architecture/09-roadmap-and-branching.md](../docs/architecture/09-roadmap-and-branching.md).
