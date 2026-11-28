# 10 — Nhật ký Hệ thống (Audit) và Thông báo CMS (`modules/audit/`, `modules/notifications/`)

> Mã nguồn: `back-end/src/modules/audit/` và `back-end/src/modules/notifications/`.

## 1. Module Nhật ký Hệ thống (`AuditModule`)

`AuditModule` cung cấp cơ chế ghi vết **append-only** (không sửa/xóa bản ghi nhật ký) bằng 3 con đường kết hợp:

1. **Tự động qua `@Audit(action, resourceType)` + `AuditInterceptor` (đăng ký `APP_INTERCEPTOR`)**:
   - Chỉ kích hoạt trên route gắn metadata `@Audit(...)`, chạy sau khi handler thành công.
   - Tự tách một hoặc nhiều `resourceId` (hỗ trợ cả thao tác đơn lẻ lẫn `bulk-delete`/`bulk-restore` trả về `{ ids: [...] }`).
   - Với `resourceType === 'revision'`, tự điền thêm khóa ngoại `revision_id` để truy vết chéo.
2. **Ghi vết từ chối truy cập qua `PermissionDeniedFilter`**:
   - Đăng ký ở cuối chuỗi `useGlobalFilters` trong `main.ts` nên bắt mọi `PermissionDeniedException` (`403`) kể cả route chỉ đọc không có `@Audit`.
   - Ghi sự kiện `action = 'access.denied'`, `resource_type = 'access'`, `reason` là JSON gồm status, method, route pattern, quyền yêu cầu và quyền thiếu; không bao giờ lưu token, cookie, body hay query string. Nếu ghi DB thất bại vẫn trả `403` và log cảnh báo kèm `request_id`.
3. **Ghi trực tiếp qua `AuditService.record()` / `recordSafely()`**:
   - Dùng cho các sự kiện đặc thù không qua decorator như đăng nhập/đăng xuất, phát hiện reuse refresh token, hay cron dọn media (`media.purge` với `actor_id = null`).

### Entity `AuditLog` (`audit_logs`) & Endpoint (`AuditController` — `/api/audit`)
- **Cột chính**: `actor_id` (UUID, nullable), `action` (`varchar(100)`), `resource_type` (`varchar(40)`), `resource_id` (UUID, nullable), `revision_id` (UUID, nullable), `reason` (`text`), `request_id` (`varchar(100)` khớp `X-Request-Id`), `ip` (`varchar(64)`), `user_agent` (`varchar(512)`), `created_at`. Index `IDX_audit_logs_resource_time`.
- **Endpoint** (đều yêu cầu quyền `audit:read`):
  - `GET /api/audit`: lọc theo `actorId`, `action`, `resourceType`, `resourceId`, khoảng thời gian và phân trang.
  - `GET /api/audit/export`: xuất tệp CSV (`audit-csv.util.ts` + `csv.util.ts` chống formula injection), trả kèm header `Content-Disposition` (đã mở trong CORS `exposedHeaders`).
  - `GET /api/audit/:id`: chi tiết 1 dòng nhật ký.
