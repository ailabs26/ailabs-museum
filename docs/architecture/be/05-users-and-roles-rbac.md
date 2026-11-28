# 05 — Người dùng, Vai trò và Phân quyền RBAC (`modules/users/`, `modules/roles/`)

> Mã nguồn: `back-end/src/modules/users/`, `back-end/src/modules/roles/`, `back-end/src/common/guards/permissions.guard.ts`.

Phân hệ RBAC tách rạch ròi giữa **định danh người dùng (`users`)** và **vai trò/quyền (`roles`, `permissions`)**, liên kết nhiều-nhiều qua `user_roles` và `role_permissions`.

## 1. Mô hình Entity

- **`User` (`users`)**:
  - `email`: kiểu `citext` unique (so sánh không phân biệt hoa thường ngay ở PostgreSQL).
  - `password_hash`, `display_name`, `status` (`active` | `locked`), `is_deleted`, `deleted_at`.
  - 4 cột 2FA (`totp_enabled_at`, `totp_secret_enc`, `totp_pending_enc`, `totp_last_step` — 3 cột nhạy cảm đặt `select: false`).
- **`Role` (`roles`)**: `code` (`varchar(64)`), `name` (`varchar(120)`), `is_deleted`, `deleted_at`. Có partial unique index `UQ_roles_code_active (code) WHERE is_deleted = false` nên cho phép tái sử dụng `code` sau khi xóa mềm.
- **`Permission` (`permissions`)**: `code` (`varchar(100)`, unique — khớp 31 khóa trong `PERMISSIONS`), `description`.
- **Bảng nối**: `UserRole` (`user_roles`) và `RolePermission` (`role_permissions`).

## 2. Danh mục Endpoint quản trị

### `UsersController` (`/api/users`)
| Method & Route | Quyền yêu cầu | `@Audit` | Mô tả |
|---|---|---|---|
| `GET /api/users` | `user:read` | — | Danh sách người dùng có phân trang, tìm kiếm, lọc trạng thái/thùng rác |
| `GET /api/users/:id` | `user:read` | — | Chi tiết người dùng kèm danh sách vai trò |
| `POST /api/users` | `user:create` (+ `role:assign` nếu có `roleIds`) | `user.create` | Tạo tài khoản quản trị mới |
| `PATCH /api/users/:id` | `user:update` (+ `role:assign` nếu có `roleIds`) | `user.update` | Cập nhật thông tin, trạng thái khóa, mật khẩu hoặc vai trò |
| `DELETE /api/users/:id` | `user:delete` | `user.delete` | Xóa mềm 1 tài khoản |
| `POST /api/users/bulk-delete` | `user:delete` | `user.delete` | Xóa mềm hàng loạt theo `BulkIdsDto` |
| `POST /api/users/bulk-restore` | `user:delete` | `user.restore` | Khôi phục hàng loạt tài khoản từ thùng rác |
| `POST /api/users/:id/roles` | `role:assign` | `user.assign_roles` | Gán thêm vai trò cho tài khoản |
| `PUT /api/users/:id/roles` | `role:assign` | `user.set_roles` | Thay thế toàn bộ tập vai trò của tài khoản |
| `DELETE /api/users/:id/roles/:roleId` | `role:assign` | `user.remove_role` | Gỡ 1 vai trò khỏi tài khoản |

### `RolesController` (`/api/roles`) & `PermissionsController` (`/api/permissions`)
| Method & Route | Quyền yêu cầu | `@Audit` | Mô tả |
|---|---|---|---|
| `GET /api/roles` | `role:read` | — | Danh sách vai trò (hỗ trợ lọc thùng rác) |
| `POST /api/roles` | `role:create` | `role.create` | Tạo vai trò mới |
| `PATCH /api/roles/:id` | `role:update` | `role.update` | Cập nhật tên/mô tả vai trò |
| `DELETE /api/roles/:id` | `role:delete` | `role.delete` | Xóa mềm vai trò |
| `POST /api/roles/bulk-delete` | `role:delete` | `role.delete` | Xóa mềm nhiều vai trò |
| `POST /api/roles/bulk-restore` | `role:delete` | `role.restore` | Khôi phục nhiều vai trò từ thùng rác |
| `GET /api/roles/:id/permissions` | `role:read` | — | Danh sách quyền đang gán cho vai trò |
| `PUT /api/roles/:id/permissions` | `role:update` | `role.set_permissions` | Cập nhật ma trận quyền của vai trò |
| `GET /api/permissions` | `permission:read` | — | Toàn bộ danh mục quyền của hệ thống |
