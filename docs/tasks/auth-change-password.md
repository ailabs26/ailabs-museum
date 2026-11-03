# Task: Người dùng tự đổi mật khẩu

Nhánh: `feat/auth-change-password`. Người phụ trách: Nguyễn Văn Thắng (auth, trang tài khoản — task 2–3).
Issue: #96. Căn cứ: FR-101 "credential reset/change".

## Bối cảnh

Trước đây chỉ Admin đặt lại được mật khẩu người khác qua `PATCH /users/:id`. Người dùng (Admin, Editor, Moderator)
không tự đổi được mật khẩu của chính mình.

## Back-end

- `POST /auth/change-password` — cần đăng nhập, không cần permission; body `{ currentPassword, newPassword }`.
  - `newPassword` cùng quy tắc với khi tạo tài khoản (8–128 ký tự) và phải khác mật khẩu hiện tại.
  - Sai mật khẩu hiện tại → **400** kèm lỗi theo field `currentPassword` (`WrongCurrentPasswordException`).
    Cố ý không dùng 401: frontend coi 401 là phiên hết hạn và sẽ đăng xuất người dùng.
  - Chống dò mật khẩu: lần sai tính chung bộ đếm theo email với đăng nhập sai (`AuthRateLimiter`); quá 5 lần/15 phút → 429 + `Retry-After`.
  - Trong một transaction: khóa độc quyền theo user, đọc lại user; nếu Admin vừa đặt lại mật khẩu hoặc khóa/xóa tài khoản
    trong lúc so bcrypt → 409, không ghi đè. Ghi hash mới, **đăng xuất mọi thiết bị khác, giữ thiết bị hiện tại**
    (`revokeAllForUser(userId, manager, sessionId)`); có hiệu lực ngay nhờ `ActiveSessionGuard`.
  - Audit `auth.password_change` (resource `user`), trả `{ id: userId }` để `AuditInterceptor` ghi được. Không trả/log mật khẩu.

## Front-end

- Trang `/admin/change-password` (`pages/admin/ChangePasswordPage.tsx`), mở từ menu tài khoản ở header → **Đổi mật khẩu**.
- Form 3 ô: mật khẩu hiện tại, mật khẩu mới, nhập lại. Kiểm ở client: độ dài, khác mật khẩu cũ, nhập lại khớp.
  Lỗi từ server hiện ngay dưới ô tương ứng (vd "Mật khẩu hiện tại không đúng"); lỗi khác (409, 429) hiện ở đầu form.
- Thành công: thông báo "Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.", xóa trắng form, làm mới danh sách phiên.
- `authService.changePassword()` kiểm phản hồi bằng zod. File dùng chung chỉ thêm 1 route và 1 mục menu.

## Kiểm chứng ngày 25/10/2026

- Back-end: `npm run typecheck`, `npm run lint`, `npm run build` đạt; `npm run test:core` (PostgreSQL 16 tạm) 256/256;
  `npm test` 1868/1868; coverage lõi 96,47% line · 97,69% branch · 97,85% function.
  Test mới `auth/tests/change-password.spec.ts` (service: đúng thứ tự khóa → đọc lại → ghi → thu hồi; sai mật khẩu cũ,
  trùng mật khẩu, tài khoản khóa, xung đột với Admin đặt lại → 409; HTTP: 401, 400 validation, 400 có field,
  5 lần sai → 429 + Retry-After) và integration DB thật (thiết bị khác bị thu hồi, thiết bị hiện tại giữ,
  đăng nhập bằng mật khẩu mới được, mật khẩu cũ không).
- Front-end: typecheck, build đạt; vitest 160/160; ESLint các file thay đổi sạch.
- E2E Playwright (back-end + PostgreSQL tạm, không dùng DB dùng chung), 2 trình duyệt cùng tài khoản: nhập lại không khớp
  bị chặn ở client; sai mật khẩu hiện tại hiện lỗi dưới ô và **không** bị đăng xuất; đổi thành công → trình duyệt này
  vẫn dùng được, trình duyệt kia bị đưa về `/admin/login` ngay; mật khẩu cũ bị từ chối, mật khẩu mới đăng nhập được;
  audit có bản ghi `auth.password_change`.
- Không cần migration.
