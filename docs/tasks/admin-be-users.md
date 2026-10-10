# Task T-USERS: UsersModule (CRUD + gán vai trò)

Nhánh: `feat/be-auth-rbac` (hoặc `feat/be-admin-users`).
Plan: [`../plans/admin-subsystem-plan.md`](../plans/admin-subsystem-plan.md) §5.2.
Phụ thuộc: T-AUTH (JwtAuthGuard), T-SEED (role sẵn có).

## Phạm vi
- `users/repositories/users.repository.ts` — `extends BaseRepository<User>`: tìm theo email (citext), phân trang + lọc `q`/`status`, nạp quan hệ `userRoles.role`.
- `users/users.service.ts` — nghiệp vụ:
  - `list(query)` phân trang.
  - `create(dto)`: trùng email → 409; hash mật khẩu; gán role (transaction qua `TransactionManager`).
  - `update(id, dto)`: đổi `displayName`/`status`/mật khẩu.
  - `remove(id)`: soft delete (`isDeleted=true`, `deletedAt=now`).
  - `assignRoles(id, roleIds)` / `removeRole(id, roleId)`.
- `users/users.controller.ts` — endpoint theo §5.2, mỗi route đánh `@Permissions(...)`.
- DTO: `create-user.dto.ts`, `update-user.dto.ts`, `assign-roles.dto.ts`, `user-response.dto.ts` (ẩn `passwordHash`).

## Ngoài phạm vi
- Màn hình FE (T-FE).
- Ghi audit tự động (gắn ở T-AUDIT bằng interceptor).

## Quy tắc
- Controller → Service → Repository; controller không chạm TypeORM.
- Trả `ApiResponse`; list kèm `meta` phân trang.
- Không trả `passwordHash` ra API.
- Gán role chạy trong transaction để nhất quán.

## Kiểm tra
- Tạo user trùng email → 409; tạo mới → 201 + ẩn passwordHash.
- Soft delete không xóa cứng; list mặc định lọc `isDeleted=false`.
- Thiếu quyền (`user:create`...) → 403.
- `typecheck`, `lint`, `build` sạch; unit test happy-path + 1 nhánh lỗi.
