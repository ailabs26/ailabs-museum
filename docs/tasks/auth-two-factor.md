# Task: Xác thực 2 lớp (2FA, TOTP) tùy chọn

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/totp-2fa`. Phần C3 của task "Nâng cao". Đã chốt: **tùy chọn cho mọi người**
(không ép buộc), kèm mã khôi phục.

## Bối cảnh

CMS chỉ đăng nhập bằng mật khẩu, nên lộ mật khẩu là mất tài khoản. 2FA dùng chuẩn TOTP (RFC 6238), chạy với các app
Authenticator phổ biến, không cần SMS hay email, và điện thoại không cần mạng.

## Thay đổi

Back-end (`otplib`, `qrcode`):
- Migration `1793700000000-AddTwoFactor`:
  - bảng `users` thêm `totp_enabled_at`, `totp_secret_enc`, `totp_pending_enc`, `totp_last_step` (3 cột sau `select: false`);
  - bảng `user_recovery_codes` (SHA-256, `used_at`, CASCADE theo user).
- `common/security/secret-box.ts`: AES-256-GCM, định dạng `v1.iv.tag.ct`, phát hiện dữ liệu bị sửa hoặc sai khóa. Khóa là
  `TOTP_ENCRYPTION_KEY`, đã thêm vào danh sách khóa bắt buộc ở production và vào `.env.example`.
- `TwoFactorRepository` / `TwoFactorService`: thiết lập, bật, tắt, tạo lại mã khôi phục, Admin tắt hộ, và kiểm mã khi đăng
  nhập. Mã lệch ±1 bước vẫn được chấp nhận. Mỗi bước chỉ dùng được một lần nhờ `claimStep` (UPDATE có điều kiện).
- Đăng nhập:
  - `AuthService.login` trả `MfaChallenge` khi đã bật 2FA;
  - `loginTwoFactor` kiểm `mfaToken` (5 phút, `purpose: 'mfa'`, dấu vân tay passwordHash), giới hạn sai 5 lần / 15 phút /
    tài khoản (`AuthRateLimiter`), rồi cấp phiên bằng `issueSession` (phần đuôi cũ của `login`, tách ra dùng chung).
- Endpoint:
  - `POST /auth/login/2fa`;
  - `GET /auth/2fa`, `POST /auth/2fa/{setup,enable,disable,recovery-codes}`;
  - `POST /users/:id/2fa/reset` (`UserTwoFactorController`, đặt ở auth module để tránh vòng phụ thuộc với users).
- `/auth/me` và `UserResponse` có thêm `twoFactorEnabled`.
- Audit: `auth.2fa_enable`, `auth.2fa_disable`, `auth.2fa_recovery_regenerate`, `user.2fa_reset`; `auth.login_failed` thêm
  reason `invalid_2fa` / `mfa_expired`; `auth.login` qua 2FA ghi kèm `twoFactor: totp | recovery_code`.

Front-end:
- `LoginPage` có bước 2:
  - ô mã 6 số (`PinInput`, `oneTimeCode`, đủ 6 số thì tự gửi);
  - "Dùng mã khôi phục";
  - "Quay lại".
- `auth.context`: `login()` trả `{ mfaToken }` khi cần 2FA, thêm `completeTwoFactor`. Schema login đổi thành union.
- Cài đặt → tab **Xác thực 2 lớp** (`TwoFactorPanel`):
  - chưa bật: QR, khóa nhập tay (chia nhóm 4 ký tự) và nút Chép, nhập mã để bật; sau đó hiện 10 mã khôi phục (Sao chép /
    Tải về), phải tick "đã lưu" mới đóng được;
  - đã bật: số mã còn lại (cảnh báo khi ≤ 2), Tạo mã mới, Tắt (mật khẩu + mã).
- `UsersPage`: nút "Tắt xác thực 2 lớp" (có xác nhận), chỉ hiện với tài khoản đang bật.

## Kiểm chứng ngày 03/11/2026

- Back-end: lint, typecheck đạt; `npm test` 2159/2159 với PostgreSQL 16 tạm (0 skip, 0 cancelled); coverage lõi 93,54%.
  - `two-factor.spec.ts`:
    - secret-box: giải mã đúng, sai khóa / bị sửa / sai định dạng thì lỗi;
    - setup: URI, QR, secret không lưu dạng rõ;
    - enable: 10 mã khác nhau, đăng xuất thiết bị khác;
    - lệch ±30 giây được, 90 giây thì không;
    - chống dùng lại (kể cả mã dùng lúc bật);
    - mã khôi phục dùng 1 lần, không phân biệt hoa thường / gạch / khoảng trắng;
    - disable, tạo lại mã, Admin tắt hộ.
  - `two-factor-login.spec.ts`:
    - chưa bật thì có phiên ngay; đã bật thì chỉ có `mfaToken` (300 giây, purpose mfa, không chứa hash);
    - đăng nhập bằng TOTP hoặc mã khôi phục;
    - sai 5 lần → 429;
    - token giả / sai purpose → `mfa_expired`; đổi mật khẩu giữa chừng → `mfa_expired`; bị khóa → `account_disabled`;
    - HTTP: bước 1 không set cookie, bước 2 set cookie và audit, kiểm tra hợp lệ của mã, các endpoint quản lý và bộ đếm 429.
  - `two-factor.integration.spec.ts` (DB thật): cột bí mật không select mặc định; 5 request `claimStep` song song thì đúng 1
    thành công; 4 request dùng cùng mã khôi phục song song thì đúng 1 thành công; disable xóa sạch.
  - RBAC: `POST /users/:id/2fa/reset` được quét tự động, bắt buộc có `@Permissions`.
- Front-end: lint, typecheck, build đạt; vitest 215/215; Playwright `cms-two-factor.spec.ts` 3/3 (mã sai → mã đúng tự gửi;
  mã khôi phục và Quay lại; bật 2FA trong Cài đặt từ đầu đến cuối). Các spec liên quan (`museum-session`,
  `admin-drawer-focus`, `cms-notifications`, `cms-e2e-reports`): 20/20.
- Smoke trên app thật (PostgreSQL tạm, `otplib` đóng vai app Authenticator), 14 bước đều đúng:
  - secret trong DB đã mã hóa (chuỗi gốc không xuất hiện);
  - bước 1 không cấp cookie;
  - dùng lại mã → 401; mã khôi phục chữ hoa → 200, dùng lại → 401;
  - Admin tắt hộ → đăng nhập lại chỉ cần mật khẩu;
  - audit đủ.
  - QR thật 240×240 có URI chuẩn (`SHA1`, 6 số, 30 giây).
