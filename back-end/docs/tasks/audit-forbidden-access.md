# Task: Audit truy cập bị từ chối do thiếu quyền

Nhánh: `fix/audit-forbidden-access`.

## Đã làm

- `PermissionDeniedException` mang quyền yêu cầu/quyền thiếu từ kiểm tra RBAC phía server.
- `PermissionDeniedFilter` toàn cục bắt lỗi từ guard và kiểm tra `role:assign` trong UsersService.
- Ghi một `access.denied` cho mỗi request bị chặn, kể cả API đọc không có `@Audit`.
- Dùng schema `audit_logs` hiện có: `resourceType=access`, `resourceId` là UUID của sự kiện;
  `reason` chứa JSON status/method/route pattern/requiredPermissions/missingPermissions.
- Ghi actor từ JWT và request ID; không ghi token/cookie/body/query. Lỗi lưu audit vẫn trả 403,
  kèm cảnh báo theo request ID. Audit thành công của thao tác được phép vẫn qua interceptor.
- `401` và lỗi Origin của refresh/logout không ghi `access.denied`. Không đổi entity/migration.

## Kiểm chứng 14/10/2026

- Typecheck, lint, build backend: đạt. Bộ test backend hiện có: 471/471 đạt.
- Bộ test HTTP tạm: 13/13 đạt; dùng guard, controller, filter, middleware, interceptor
  và AuditService thật, repository giả trong bộ nhớ.
- Đã kiểm tra 47 route RBAC đều ghi đúng một sự kiện khi bị chặn; 2 route Dashboard
  chỉ cần đăng nhập không bị thay đổi. Service dữ liệu không chạy khi guard từ chối.
- Đã kiểm tra quyền yêu cầu/quyền thiếu, lỗi role:assign trong POST/PATCH User, audit của
  thao tác thành công, 401, route public, 403 ngoài RBAC, lỗi ghi audit, request ID,
  và việc không lưu query/body/cookie/access token. Không có kiểm thử trên PostgreSQL thật.
- File test tạm được xóa sau khi đạt theo quy ước bàn giao đã chọn; giữ test có sẵn.

## Kiểm tra bàn giao

1. Đăng nhập tài khoản thiếu `user:read`, gọi `GET /api/users` trong Swagger: nhận 403.
2. Dùng Admin có `audit:read`, xem Nhật ký hệ thống, lọc hành động `access.denied`.
3. Mở chi tiết: actor đúng, request ID khớp response, `reason` có `GET`, `/api/users`,
   `missingPermissions=["user:read"]`. Resource ID là ID sự kiện bảo mật.
4. Gọi API có ID hoặc POST/PATCH với quyền thiếu: vẫn ghi được audit, không chạy thao tác dữ liệu.
5. Có `user:create`/`user:update` nhưng thiếu `role:assign`, gửi roleIds: nhận 403 và audit quyền thiếu.
6. Gọi với token sai/hết hạn: nhận 401, không tạo sự kiện RBAC. Có đủ quyền: không tạo `access.denied`.

Việc xác minh bản ghi trên database thật do người phụ trách thực hiện; AI chỉ kiểm thử cục bộ
bằng repository giả, không ghi Supabase hoặc chạy migration/seed.
