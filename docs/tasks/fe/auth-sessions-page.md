# Task: Màn hình "Phiên đăng nhập" — đăng xuất thiết bị khác / tất cả thiết bị (front-end)

Nhánh: `feat/fe-sessions-page`. Người phụ trách: Nguyễn Văn Thắng.
API và thiết kế: `docs/tasks/be/auth-session-management.md` (PR #92).

## Đã làm

- Trang `/admin/sessions` (`pages/admin/SessionsPage.tsx`), mở từ menu tài khoản ở header → **Phiên đăng nhập**.
  Mọi tài khoản đăng nhập đều vào được (chỉ thấy phiên của chính mình), không cần permission.
- Bảng thiết bị: tên thiết bị đọc từ User-Agent (`helpers/userAgent.ts`, vd "Chrome trên Windows"), IP,
  thời điểm đăng nhập, hoạt động gần nhất; thiết bị đang dùng có badge **Thiết bị này** và luôn ở dòng đầu.
- Hành động (đều có modal xác nhận):
  - Đăng xuất từng thiết bị; nếu là thiết bị này → kết thúc phiên cục bộ, về trang đăng nhập.
  - **Đăng xuất các thiết bị khác** (vô hiệu khi không còn thiết bị khác).
  - **Đăng xuất tất cả** → `AuthContext.logoutAll()` gọi API trước (cần access token) rồi xóa token, về trang đăng nhập.
- `authService`: `sessions()`, `revokeSession(id)`, `revokeOtherSessions()`, `logoutAll()`; phản hồi kiểm bằng zod (`core/auth/authSchema.ts`).
- Thiết bị bị đăng xuất từ xa: request kế tiếp nhận 401 → `http-client` thử refresh → thất bại → xóa token → về
  `/admin/login` (dùng luồng có sẵn, không sửa `http-client`).
- Thay đổi file dùng chung chỉ ở mức tối thiểu: thêm 1 route trong `app/router.tsx`, 1 `Menu.Item` trong `layouts/AdminLayout.tsx`.

## Kiểm chứng ngày 25/10/2026

- `npm run typecheck`, `npm run build`: đạt; `npm run test:unit`: 160/160 (mới: `helpers/userAgent.test.ts`, 8 test).
- ESLint các file thay đổi: sạch. `npm run lint` toàn repo còn lỗi có sẵn trên `dev` ở `scripts/e2e-cms-workflow.mjs`,
  `tests/fixtures/*`, `CollectionPage.tsx` (không thuộc task này, không sửa).
- E2E thủ công bằng Playwright, back-end + PostgreSQL tạm (không dùng DB dùng chung), 2 trình duyệt cùng tài khoản:
  trang hiện 2 thiết bị, đúng badge "Thiết bị này"; **Đăng xuất các thiết bị khác** → còn 1 dòng, trình duyệt kia
  chuyển trang trong SPA bị đưa về `/admin/login` ngay (không đợi access token hết hạn); **Đăng xuất tất cả** → về login.
  API ghi audit `auth.session_revoke_others`, `auth.logout_all`.
