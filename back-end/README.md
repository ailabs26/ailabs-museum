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

### Seed nội dung demo vào phòng hiện có

```sh
npm run test:seed
npm run seed:demo
```

`seed:demo` ghi vào PostgreSQL được chỉ định bởi `DATABASE_URL` (kể cả Supabase),
thêm 5 hiện vật `[Mẫu]` cùng revision approved/public vào phòng có slug
`phong-lich-su-quan-su-viet-nam`. Phòng phải active/chưa xóa; tài khoản
`SEED_ADMIN_EMAIL` phải tồn tại, active/chưa xóa và có role admin. Không cần
`SEED_ADMIN_PASSWORD`, không tự tạo phòng/admin hoặc chạy migration.

Seed chạy trong transaction, khóa phòng và dùng ID cố định. Chạy lại bỏ qua bộ
exhibit/revision đã có, giữ cả nội dung đã sửa và trạng thái ẩn/xóa mềm; ID thuộc
phòng khác hoặc bộ đôi không nhất quán gây lỗi và rollback. Không sửa quyền,
metadata phòng hoặc dữ liệu ngoài bộ demo. Lệnh không tự xóa demo.

Kiểm tra `GET /api/rooms/phong-lich-su-quan-su-viet-nam` sau seed. Ảnh/model/audio
vẫn null, hotspot rỗng; hình khối là placeholder. Đây là dữ liệu phát triển,
không thay thế hồ sơ và asset nghiệm thu đã được thẩm định. Không chạy lại seed
quản trị chỉ để thêm nội dung. Task/design/plan tại `../docs/tasks/demo-content-seed.md`.

## 3. API

- **Tiền tố toàn cục `/api`.** Swagger UI: `http://localhost:3001/api/docs` (có ô nhập Bearer token).
- Media tĩnh phục vụ ngoài prefix: `GET /media/<file>`.

### Công khai (không cần token)
- `GET /api/health`
- `GET /api/rooms`, `GET /api/rooms/:slug` — nội dung đã xuất bản.

### Phân hệ quản trị (cần access token, trừ login/refresh)
- **Auth:** `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`.
- **Users:** `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`, `POST/PUT /api/users/:id/roles`, `DELETE /api/users/:id/roles/:roleId`.
- **Roles & Permissions:** `GET/POST /api/roles`, `PATCH/DELETE /api/roles/:id`, `GET|PUT /api/roles/:id/permissions`, `GET /api/permissions`.
- **Audit:** `GET /api/audit`, `GET /api/audit/:id`.

Mọi response theo envelope `ApiResponse<T>` (`{ success, data, message, meta? }`); endpoint list kèm `meta` phân trang.

Quản lý tài khoản:

- `POST /users` cần `user:create`; nếu gán `roleIds` khác rỗng, cần thêm `role:assign`.
- `PATCH /users/:id` cần `user:update`; có `roleIds` (kể cả `[]`) thì cần thêm `role:assign`.
  Thông tin và toàn bộ vai trò được lưu trong cùng transaction; bỏ trường `roleIds` để giữ nguyên.
- `PUT /users/:id/roles` chỉ cần `role:assign`, thay toàn bộ vai trò; `[]` bỏ mọi vai trò.
  `POST` gán thêm và `DELETE .../:roleId` bỏ một vai trò vẫn được hỗ trợ.
- Không cho khóa/xóa mềm/bỏ role `admin` của Admin active, chưa xóa cuối cùng. Các thao tác
  tài khoản/Role dùng chung advisory transaction lock để hai request không cùng loại bỏ Admin cuối.
- Khóa tạm thời bằng `PATCH status=disabled`, mở khóa bằng `active`; `DELETE` là xóa mềm.
  Email của tài khoản đã xóa vẫn được giữ theo unique hiện có; tạo trùng trả 409.
- JWT vẫn dùng quyền tại lúc cấp: khóa/xóa/bỏ quyền không vô hiệu access token cũ ngay.
  Login/refresh kiểm tra tài khoản và cấp quyền mới; menu frontend cập nhật khi tải lại/đăng nhập lại.
  Chưa có cơ chế thu hồi tức thì access token hoặc khôi phục tài khoản đã xóa.

## 4. Xác thực & RBAC

- **Access token** JWT (~15 phút) mang `roles` + `permissions`; gửi qua `Authorization: Bearer`.
- **Refresh token** (~7 ngày) chỉ lưu **hash** trong bảng `refresh_sessions`, trao đổi qua **httpOnly cookie**; **xoay vòng** mỗi lần refresh và **thu hồi cả family** nếu phát hiện token cũ bị dùng lại.
- `JwtAuthGuard` + `PermissionsGuard` đăng ký **toàn cục**. Route công khai đánh `@Public()`; route quản trị đánh `@Permissions('resource:action')`.
- Mật khẩu hash bằng bcrypt; không trả `passwordHash`/token ra API.
- Ghi vết tự động: route ghi/sửa đánh `@Audit('resource.action','resource')`; `AuditInterceptor` tạo `AuditLog` append-only sau khi thành công.
- Thiếu quyền RBAC ở guard hoặc kiểm tra `role:assign` trong service trả `403` và ghi
  `access.denied` qua `PermissionDeniedFilter`, kể cả route đọc không có `@Audit`.
  `resourceType=access`, `resourceId` là UUID của sự kiện (không phải ID tài nguyên bị thao tác).
  `reason` lưu JSON: status, method, route pattern, quyền yêu cầu và quyền thiếu; `actorId`
  lấy từ JWT đã xác thực, `requestId` khớp header `X-Request-Id`.
  Không lưu token, cookie, body hoặc query string. Nếu lưu audit thất bại, vẫn trả `403`
  và ghi cảnh báo theo request ID. `401` và lỗi Origin của refresh/logout không thuộc sự kiện RBAC này.

## 5. Cấu trúc `src/` (chuẩn enterprise)

```
src/
├── main.ts, app.module.ts
├── common/        # hạ tầng dùng chung, global (CommonModule @Global)
│   ├── decorators/ guards/ filters/ interceptors/ middleware/ exceptions/
│   ├── dto/ (ApiResponse, PaginationQueryDto…) constants/ enums/ types/
│   ├── repository/ (BaseRepository)  database/ (TransactionManager)  security/ (PasswordService)
├── config/        # app.config / database.config / jwt.config (registerAs) + env.validation + data-source + index
├── database/      # migrations/ + seeds/ + database.module.ts
└── modules/       # feature theo domain, mỗi module: controllers/ services/ repositories/ entities/ dto/
    ├── auth/      (refresh_session)   users/ (user, user_role)   roles/ (role, permission, role_permission)
    ├── audit/ (audit_log + interceptor/decorator)   exhibits/ (exhibit, revision, hotspot)
    └── rooms/ (room)   media/ (media)   content-reports/ (content_report)   health/
```

- Entity đặt theo DDD trong `modules/<domain>/entities/`.
- Tầng dữ liệu đi theo Controller → Service → Repository; chỉ Repository chạm TypeORM.
- `public/media/` — asset minh họa phục vụ qua HTTP.

## 6. Migration

- Luôn giữ `synchronize: false`; đổi schema bằng TypeORM migration.
- Chỉ người phụ trách database chạy `migration:generate/run/revert`; AI agent không tự chạy.
- Kiểm tra file generate trước khi chạy (đặc biệt `DROP`, đổi enum/constraint).
- Không sửa/xóa migration đã chạy trên DB dùng chung; tạo migration mới cho thay đổi tiếp theo.
- TypeORM ghi lịch sử ở bảng `public.migrations`; không chỉnh thủ công.

```sh
npm run migration:generate -- src/database/migrations/TenMigration
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
