# Task T-ROLES: RolesModule + ma trận quyền

Nhánh: `feat/be-auth-rbac` (hoặc `feat/be-admin-roles`).
Plan: [`../plans/admin-subsystem-plan.md`](../plans/admin-subsystem-plan.md) §5.3.
Phụ thuộc: T-AUTH.

## Phạm vi
- `roles/repositories/roles.repository.ts` — `extends BaseRepository<Role>`: nạp `rolePermissions.permission`.
- `roles/roles.service.ts`:
  - `list()`, `create(dto)` (trùng `code` → 409), `update(id, dto)`, `remove(id)` (chặn xóa role hệ thống `admin/moderator/editor`).
  - `getPermissions(roleId)` → danh sách `permission.code`.
  - `setPermissions(roleId, codes)` → đặt lại toàn bộ `role_permissions` trong transaction (xóa cũ, thêm mới theo `code`).
  - `listAllPermissions()` → danh mục `permissions`.
- `roles/roles.controller.ts` — endpoint theo §5.3 (gồm `GET /permissions`), đánh `@Permissions(...)`.
- DTO: `create-role.dto.ts`, `update-role.dto.ts`, `set-permissions.dto.ts` (mảng `code` hợp lệ).

## Ngoài phạm vi
- FE PermissionMatrixPage (T-FE).
- Tự ghi audit (T-AUDIT).

## Quy tắc
- `setPermissions` là thao tác "đặt toàn bộ" (PUT) — đồng bộ đúng tập quyền gửi lên, chạy transaction.
- Không cho xóa/sửa `code` của role hệ thống mặc định.
- Chỉ nhận `code` permission tồn tại; code lạ → 422.

## Kiểm tra
- Tạo role trùng code → 409; xóa role hệ thống → 403/409.
- `PUT /roles/:id/permissions` đồng bộ đúng tập quyền; đọc lại khớp.
- Thiếu quyền → 403.
- `typecheck`, `lint`, `build` sạch; unit test cho `setPermissions`.
