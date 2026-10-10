# Task T-FE: FE Admin skeleton (CMS)

Nhánh: `feat/fe-admin-skeleton`.
Plan: [`../plans/admin-subsystem-plan.md`](../plans/admin-subsystem-plan.md) §5 FE; kiến trúc [`../architecture/07-admin-subsystem.md`](../architecture/07-admin-subsystem.md) §7.5.
Phụ thuộc: #E `feat/fe-foundation` (đã có `shared/components`, `AdminLayout`, router), T-AUTH + T-USERS + T-ROLES + T-AUDIT (API).

## Phạm vi
- `core/auth` FE: lưu access token (memory + refresh qua cookie), `http-client` tự gắn Bearer + single-flight refresh khi 401.
- Guard định tuyến: `RequireAuth`, `RequirePermission(perm)`.
- Màn hình (dùng `shared/components` sẵn có — `DataTable`, `Form*`, `StatCard`, `ConfirmModal`...):
  - **LoginPage** — form email/mật khẩu, xử lý 401, a11y + focus-trap.
  - **DashboardPage** — `StatCard` ×4 + biểu đồ (`@mantine/charts`) + trạng thái hệ thống.
  - **UsersPage** — `DataTable` user, drawer tạo/sửa + `FormSelect` role, `ConfirmModal` khóa/xóa.
  - **RolesPage** — `DataTable` role + tạo/sửa.
  - **PermissionMatrixPage** — bảng checkbox role×permission, lưu `PUT /roles/:id/permissions`.
  - **AuditPage** — `DataTable` nhật ký + filter (actor/action/thời gian) + xem chi tiết.
- `services/*.service.ts` cho users/roles/permissions/audit gọi API chuẩn `ApiResponse`.

## Ngoài phạm vi
- Module nội dung (rooms/exhibits/media), 3D/XR, client 2D.
- i18n (Phase 3).

## Quy tắc
- Mọi lời gọi API đi qua `http-client` chung; không fetch rải rác.
- Tôn trọng RBAC: ẩn/chặn hành động thiếu quyền (dựa `permissions` từ `/auth/me`).
- Dùng component trong `shared/`; không tạo trùng.
- A11y: nhãn form, focus-trap modal, điều hướng bàn phím.

## Kiểm tra
- Đăng nhập → vào AdminLayout; token hết hạn tự refresh, thất bại → về Login.
- Thiếu quyền → route/action bị chặn.
- CRUD user/role hoạt động, ma trận quyền lưu đúng.
- `npm run build` + `tsc` sạch; không lỗi console a11y cơ bản.
