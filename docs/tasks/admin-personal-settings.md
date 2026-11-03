# Task: Trang Cài đặt cá nhân

Nhánh: `feat/admin-personal-settings`. Người phụ trách: Nguyễn Văn Thắng (auth, trang tài khoản — task 2–3).
Phần làm thêm, `requirements.md` không yêu cầu.

## Bối cảnh

Các thiết lập "của tôi" nằm rải rác (trang Đổi mật khẩu, trang Phiên đăng nhập, nút sáng/tối trên header) và người
dùng không tự đổi được tên hiển thị (chỉ Admin sửa qua `PATCH /users/:id`). Gom về một trang Cài đặt; không thêm cài đặt hệ thống.

## Đã làm

- **API `PATCH /auth/me`** (cần đăng nhập, không cần permission): body `{ displayName }` — trim, 1–160 ký tự, cùng quy tắc
  `UpdateUserDto`; gửi kèm email/vai trò/trạng thái → 400 (`forbidNonWhitelisted`). Chỉ sửa user của token; tài khoản bị khóa → 401.
  Trả AuthUser mới; audit `auth.profile_update`. Access token cũ giữ tên cũ tới lần refresh, giao diện dùng user trong context nên đổi ngay.
- **Trang `/admin/settings/:tab`** (menu tài khoản → **Cài đặt**, thay cho 2 mục cũ), tab nằm trên URL:

  | Tab | Nội dung |
  |---|---|
  | Hồ sơ | sửa tên hiển thị (Lưu chỉ bật khi có thay đổi); email chỉ xem; vai trò và quyền (gom theo resource) chỉ xem |
  | Mật khẩu | form đổi mật khẩu (trước là trang `/admin/change-password`) |
  | Phiên đăng nhập | thiết bị đang đăng nhập + đăng xuất từ xa (trước là trang `/admin/sessions`) |
  | Giao diện | Sáng / Tối / Theo hệ thống (Mantine lưu localStorage, đồng bộ với nút trên header) |

- Link cũ `/admin/change-password`, `/admin/sessions` chuyển tới tab tương ứng; tab không tồn tại → Hồ sơ.
- Trang cũ tách thành panel trong `pages/admin/settings/` (`ChangePasswordPanel`, `SessionsPanel`, mới `ProfilePanel`, `AppearancePanel`).
- File dùng chung chỉ chạm: `app/router.tsx` (route), `layouts/AdminLayout.tsx` (1 mục menu). Không có migration.

## Kiểm chứng ngày 27/10/2026

- Back-end: typecheck, lint, build đạt; `npm test` 1954/1954 với PostgreSQL 16 tạm; coverage lõi 96,41% line.
  Test mới `auth/tests/auth-profile.spec.ts`: 401 khi chưa đăng nhập; 400 tên rỗng/quá dài/gửi kèm email hoặc roles;
  200 trả AuthUser với tên đã trim và chỉ sửa user của token; tài khoản khóa/không còn → 401, không ghi gì.
- Front-end: typecheck, build đạt; vitest 170/170; ESLint các file thay đổi sạch.
- E2E Playwright (back-end + PostgreSQL tạm): menu chỉ còn "Cài đặt · Đăng xuất"; tên rỗng bị chặn; đổi tên → header đổi ngay,
  tải lại vẫn giữ; tab Mật khẩu và Phiên đăng nhập hoạt động; link cũ và tab sai chuyển đúng; tab Giao diện chuyển sang tối;
  audit có bản ghi `auth.profile_update`.
