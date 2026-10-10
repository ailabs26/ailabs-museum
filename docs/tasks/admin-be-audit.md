# Task T-AUDIT: AuditModule + AuditInterceptor

Nhánh: `feat/be-auth-rbac` (hoặc `feat/be-admin-audit`).
Plan: [`../plans/admin-subsystem-plan.md`](../plans/admin-subsystem-plan.md) §5.4, §8.
Phụ thuộc: T-AUTH, T-USERS/T-ROLES (để có route gắn interceptor).

## Phạm vi
- `audit/repositories/audit.repository.ts` — `extends BaseRepository<AuditLog>`: phân trang + lọc `actorId`/`action`/`resourceType`/khoảng `occurredAt`.
- `audit/audit.service.ts`:
  - `record(entry)` — append-only INSERT (`actorId`, `action`, `resourceType`, `resourceId`, `reason`, `requestId`).
  - `list(query)` / `getById(id)` — đọc có filter + phân trang.
- `audit/audit.interceptor.ts` — bọc route ghi/sửa quản trị; sau khi service thành công → `record(...)`. Lấy `action`/`resourceType` từ metadata decorator `@Audit('user.create','user')`; `requestId` từ header `X-Request-Id`.
- `audit/audit.controller.ts` — `GET /audit`, `GET /audit/:id`, quyền `audit:read`.

## Ngoài phạm vi
- FE AuditPage (T-FE).
- Lưu `before/after` chi tiết (giai đoạn đầu chỉ ghi `action/resource/actor/requestId`; mở rộng sau nếu cần).

## Quy tắc
- **Append-only**: chỉ INSERT, không endpoint sửa/xóa audit.
- Không ghi token/mật khẩu vào audit.
- Ghi cả khi 403 ở hành động nhạy cảm (tùy chọn giai đoạn sau).

## Kiểm tra
- Tạo/sửa user/role → sinh đúng 1 bản ghi audit với `action`/`resourceType` mong đợi.
- `GET /audit` lọc theo actor/action/thời gian + phân trang đúng.
- Thiếu quyền `audit:read` → 403.
- `typecheck`, `lint`, `build` sạch.
