# Task T-SEED: Seed quyền, vai trò & admin đầu tiên

Nhánh: `feat/be-auth-rbac` (chung đợt dựng khung) hoặc `feat/be-admin-seed`.
Plan: [`../plans/admin-subsystem-plan.md`](../plans/admin-subsystem-plan.md) §7.

## Phạm vi
- Thêm script `src/seed/seed.ts` **idempotent** chạy bằng `ts-node`:
  1. Upsert toàn bộ `PERMISSIONS` (từ `common/constants/permissions.constant.ts`) vào bảng `permissions` (theo `code`).
  2. Upsert 3 vai trò `admin`/`moderator`/`editor` (từ `RoleKey`) và ghi `role_permissions` theo `DEFAULT_ROLE_PERMISSIONS`.
  3. Tạo tài khoản admin đầu tiên từ `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` (hash bcrypt), gán role `admin` nếu chưa gán.
- Thêm biến môi trường `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` vào `config/env.ts` (và `.env.example`).
- Thêm script `"seed"` vào `back-end/package.json`.

## Ngoài phạm vi
- Seed 5 hiện vật demo (tách script riêng `seed-demo-content.ts` nếu cần).
- Bất kỳ endpoint HTTP nào.

## Quy tắc
- Chạy nhiều lần không tạo bản ghi trùng (upsert theo khóa tự nhiên: `permission.code`, `role.code`, `user.email`).
- Không commit mật khẩu thật; `SEED_ADMIN_PASSWORD` chỉ đặt ở `.env` cục bộ.
- Hash mật khẩu bằng cùng tiện ích dùng ở AuthModule (`bcryptjs`, cost `BCRYPT_ROUNDS`).

## Kiểm tra
- `npm run seed` lần 1 tạo 3 role + N permission + 1 admin; lần 2 không đổi số bản ghi.
- `typecheck`, `lint`, `build` sạch.
- Đăng nhập thử bằng admin seed sau khi có AuthModule (T-AUTH).
