# Task: Ghi audit đăng nhập, đăng xuất và chuẩn hóa nhật ký hệ thống

Nhánh: `feat/auth-audit-events`. Người phụ trách: Nguyễn Văn Thắng. Issue: #97.
Có sửa module audit và trang Nhật ký (phần của Nguyễn Đức Quang) — người phụ trách đồng ý; yêu cầu: làm đúng thực tế, không dùng dữ liệu/id giả.

## Bối cảnh

- Đăng nhập/đăng xuất không được ghi audit → Admin không thấy ai vào hệ thống hay có ai đang dò mật khẩu (FR-106, NFR-57).
- `audit_logs.resource_id` bắt buộc → sự kiện không gắn tài nguyên phải bịa id (403 đang dùng UUID ngẫu nhiên).
- Không có cột IP/User-Agent.
- **Lỗi bảo mật sẵn có:** `GET /audit` và `GET /audit/:id` trả nguyên entity `User` của actor, **kèm `passwordHash`**, trạng thái, cờ xóa (vi phạm NFR-21).

## Đã làm

- Migration `AuditNullableResourceAndClientInfo1793500000000`: `resource_id` cho phép NULL; thêm `ip varchar(64)`, `user_agent varchar(512)`.
  `down()` từ chối nếu đã có bản ghi không gắn tài nguyên (không bịa id). Bản ghi cũ giữ nguyên.
- `AuditService`: `resourceId` nullable, ghi `ip`/`userAgent`; `recordSafely()` (lỗi lưu chỉ ghi cảnh báo); `access.denied` dùng `resourceId` null
  thay cho UUID ngẫu nhiên. `AuditInterceptor` và filter 403 ghi kèm IP/User-Agent.
- **Sửa lỗi lộ `passwordHash`:** API audit trả `AuditLogResponse`, `actor` chỉ gồm `{ id, email, displayName }`.
- Audit xác thực (ở `AuthController`, kèm IP/User-Agent/request id):

  | Action | Khi nào | actor | resourceId | reason |
  |---|---|---|---|---|
  | `auth.login` | đăng nhập thành công | tài khoản | tài khoản | — |
  | `auth.login_failed` | sai mật khẩu / tài khoản khóa / mật khẩu vừa bị đổi | null | tài khoản đích | `{"reason":…}` |
  | `auth.login_failed` | email không tồn tại | null | null | `{"reason":"unknown_account"}` |
  | `auth.login_blocked` | bị chặn 429 (IP hoặc email) | null | null | `{"limit":"ip\|email"}` |
  | `auth.logout` | đăng xuất có phiên | chủ phiên | chủ phiên | — |

  Không ghi email/mật khẩu đã nhập. `auth.login_blocked` chỉ ghi **1 lần mỗi cửa sổ chặn** cho mỗi IP/email để chính audit không làm ngập DB
  khi bị dò mật khẩu. Không ghi refresh (xảy ra mỗi 15 phút). Phản hồi cho client không đổi (không lộ email có tồn tại hay không).
- `AuthService.login` ném `LoginFailedException` (kế thừa 401) mang lý do + tài khoản đích; `logout` trả userId của phiên.
- Trang Nhật ký: hiện IP, User-Agent; `Resource ID` rỗng hiện "— (không gắn tài nguyên)"; người thực hiện của sự kiện xác thực/truy cập
  không có actor hiện **"Chưa đăng nhập"** (trước là "hệ thống" — sai nghĩa); sự kiện thất bại/bị chặn/bị từ chối tô đỏ.

## Lưu ý vận hành

- **Migration `1793500000000` đã chạy trên DB dùng chung ngày 29/10/2026 lúc 11:59**, sau khi backup
  `~/aura-backups/aura-2026-10-29-1159.dump` (đã kiểm đọc lại được). Trước khi chạy chỉ có đúng migration này đang chờ; sau khi chạy
  `migration:show` báo `[X] 10 AuditNullableResourceAndClientInfo1793500000000`, `resource_id` cho phép NULL, có đủ cột `ip`, `user_agent`;
  370 bản ghi cũ giữ nguyên (chưa bản ghi nào NULL). Hoàn tác: `npm run migration:revert` (chỉ được khi chưa có bản ghi `resource_id` NULL)
  hoặc khôi phục từ bản backup. Môi trường dùng DB riêng phải chạy migration này trước khi deploy.
- IP lấy theo Express: sau reverse proxy cần bật `trust proxy` (issue #82), nếu không mọi bản ghi mang IP của proxy.

## Kiểm chứng ngày 29/10/2026

- Back-end: typecheck, lint, build đạt; `npm test` 1976/1976 với PostgreSQL 16 tạm; coverage lõi 96,47% line.
  Test mới: `auth/tests/auth-audit.spec.ts` (5 sự kiện, không lộ email/mật khẩu, chặn ghi 1 lần/cửa sổ, đăng xuất không phiên không ghi),
  `audit/tests/audit-service.spec.ts` (IP/UA cắt độ dài, `recordSafely`, `access.denied` không id giả, response không có `passwordHash`),
  `core-db.integration` (SQL thật: lưu `resource_id` NULL + IP/UA; `list`/`getById` không lộ hash).
  Migration up → down (từ chối khi có bản ghi NULL) → up.
- Front-end: typecheck, build; vitest 171/171 (mới `audit.service.test.ts`); ESLint file thay đổi sạch.
- E2E (back-end + PostgreSQL tạm, request thật): sai mật khẩu → `login_failed` gắn tài khoản đích; email lạ → `resource_id` NULL;
  dò 7 lần (5×401, 2×429) → đúng **1** `login_blocked`; đăng nhập/đăng xuất qua giao diện → `auth.login`/`auth.logout` kèm IP và User-Agent;
  `GET /audit` không chứa `passwordHash` hay chuỗi bcrypt; trang Nhật ký hiển thị IP/User-Agent và "Chưa đăng nhập".
