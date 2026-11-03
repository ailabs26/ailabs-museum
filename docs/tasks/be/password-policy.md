# Task: Chính sách độ mạnh mật khẩu

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/password-policy`. Phần C1 của task "Nâng cao".

## Bối cảnh

Trước đây mật khẩu chỉ bị kiểm `MinLength(8)` và `MaxLength(128)`. Nên "12345678" hay "Password1" đều đặt được. Ngoài ra bcrypt
chỉ dùng 72 byte đầu, nên mật khẩu dài hơn 72 byte bị cắt âm thầm.

## Thay đổi

- `common/security/password-policy.ts`:
  - `checkPasswordPolicy(password, { email, displayName })` trả danh sách vi phạm;
  - `assertPasswordPolicy(...)` ném 400 kèm `errors[]`;
  - decorator `@IsStrongPassword()`.
- Quy tắc (theo hướng NIST):
  - ≥ 10 ký tự, ≤ 72 byte;
  - có chữ và số;
  - không phổ biến;
  - không chứa email/tên.
  - Không ép ký tự đặc biệt, không hết hạn.
- "Phổ biến": phần chữ còn lại sau khi bỏ số và ký tự không được nằm trong danh sách từ gốc (password, matkhau, admin, qwerty,
  baotang…), cùng một danh sách chuỗi bàn phím (`1q2w3e4r5t`…) và luật "chỉ một ký tự lặp lại". Plan ban đầu dự định dùng một
  danh sách khoảng 1.000 mật khẩu, nhưng mình không có nguồn danh sách đáng tin để đưa vào repo. Cách bắt biến thể này phủ được
  "Password2024!", "Matkhau123456" mà một danh sách cố định sẽ bỏ sót.
- Nơi áp dụng:
  - `CreateUserDto` (kiểm luôn email/tên trong DTO);
  - `UpdateUserDto` và `ChangePasswordDto` (decorator; việc không chứa email/tên kiểm ở `UsersService.update` và
    `AuthService.changePassword` theo user hiện có, lấy tên mới nếu đang đổi cùng lúc).
- FE:
  - `helpers/passwordPolicy.ts` mô phỏng các quy tắc (trừ danh sách phổ biến);
  - `PasswordStrength` (thanh đo + danh sách quy tắc), dùng ở trang Đổi mật khẩu và form tạo/sửa tài khoản.

## Kiểm chứng ngày 03/11/2026

- Back-end: lint, typecheck đạt; `npm test` 2138/2138 với PostgreSQL 16 tạm (0 skip, 0 cancelled).
  - `password-policy.spec.ts`: mật khẩu tốt không cần ký tự đặc biệt; biên 9/10 ký tự; chữ có dấu tính 1 ký tự; biên 72/73 byte;
    chữ có dấu nhiều byte; thiếu chữ/số; 11 mẫu phổ biến kèm biến thể; chứa email/tên (bỏ dấu); từ < 3 ký tự không chặn oan;
    `errors[]`; decorator dùng email/tên của DTO.
- Front-end: lint, build đạt; vitest 218/218 (thêm `passwordPolicy.test.ts`).
  - Playwright `admin-drawer-focus` 8/8, sau khi đổi mật khẩu mẫu `fixture-only-password` (không có số) sang mật khẩu hợp lệ.
  - `admin-navigation-keyboard` có 8 test fail **sẵn trên `dev`** (đã đối chứng bằng cách chạy trên `dev` nguyên bản), không
    liên quan task này.
- Lần chạy đầu trên DB mới tinh, `trash-restore.integration.spec` bị *cancelled* vì nhiều spec cùng `runMigrations()` song song
  (`pg_class_relname_nsp_index`). Đây là lỗi có từ trước, không do task này. Chạy lại trên DB đã migrate thì đạt đủ.
