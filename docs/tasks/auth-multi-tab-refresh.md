# Task: Refresh đồng thời từ nhiều tab không còn bị coi là tái dùng token

Người phụ trách: Nguyễn Văn Thắng. Issue #141. Nhánh `fix/141-multi-tab-refresh`.

## Bối cảnh

Refresh cookie dùng chung mọi tab, còn access token nằm riêng trong bộ nhớ từng tab. Hai tab refresh cùng lúc sẽ gửi cùng
một token. Request đến sau thấy token đã `used_at` nên reuse-detection thu hồi cả family: mọi tab bị đăng xuất và (từ #140)
sinh thêm `auth.refresh_reuse_detected` báo động giả.

## Thay đổi

- Front-end (`core/api/http-client.ts`): `POST /auth/refresh` chạy trong Web Lock `aura-auth-refresh` (dùng chung mọi tab
  cùng origin). Tab sau chỉ gửi khi tab trước đã nhận cookie mới, nên xoay vòng hợp lệ. Trình duyệt không có Web Locks thì
  chạy thẳng như cũ.
- Back-end (`TokenService.rotate`): token đã dùng, chưa bị thu hồi, bị gửi lại trong `REFRESH_REUSE_GRACE_MS` (10 giây)
  → `RefreshFailedException('rotated_recently')`: 401 với thông điệp chung, **không** thu hồi family, không ghi audit.
  Quá 10 giây, hoặc family đã bị thu hồi, thì xử lý như cũ.
- `AuthController.refresh`: với `rotated_recently` thì **không xóa cookie**, vì cookie trình duyệt lúc đó là token mới của
  tab khác; xóa đi thì tab kia cũng mất phiên.

Giới hạn còn lại: nếu phản hồi refresh bị mất (server đã xoay vòng nhưng cookie mới không về tới trình duyệt) và lần thử lại
đến sau quá 10 giây, phiên vẫn bị thu hồi như reuse. Đây là giới hạn vốn có của refresh-token rotation.

## Kiểm chứng ngày 02/11/2026

- Back-end: lint, typecheck đạt; `npm test` 2108/2108 với PostgreSQL 16 tạm (gồm test tích hợp DB, 0 skip); coverage lõi 95,39%. Thêm test: trong ân hạn → `rotated_recently`, family còn sống, token
  mới vẫn xoay vòng được; family đã thu hồi → vẫn `reuse`; replay sau ân hạn → `reuse` + thu hồi; HTTP: `rotated_recently`
  không ghi audit, không `Set-Cookie`, các lý do khác vẫn xóa cookie. `core-db.integration.spec.ts` (DB thật): 2 refresh
  đồng thời cùng token → 1 thành công + 1 `rotated_recently`, family còn sống; replay sau ân hạn → thu hồi cả family.
- Front-end: lint, typecheck đạt; vitest 213/213. Thêm test: refresh gửi bên trong khóa và nhả khóa sau phản hồi; lỗi vẫn nhả
  khóa; không có Web Locks vẫn refresh được.
- E2E Playwright `tests/auth-multi-tab-refresh-live.spec.ts` (back-end + PostgreSQL 16 tạm, `REFRESH_RATE_LIMIT_PER_SESSION=1000`
  vì 2 tab × 20 vòng vượt mức 30/phút/phiên của #126), 2 tab cùng phiên tải lại đồng thời 20 vòng:

  | | `dev` trước #141 | Sau #141 |
  |---|---|---|
  | Kết quả | Bị đá về trang đăng nhập ở vòng 3 | Qua 20/20 vòng, mọi refresh 200 |
  | Phiên bị thu hồi | 7/7 | 0/42 |
  | `auth.refresh_reuse_detected` | 1 (báo động giả) | 0 |

- Lớp back-end khi tắt Web Locks (biến thể tạm, không commit): mỗi vòng một tab refresh 200, tab kia 401 ân hạn và hiện trang
  đăng nhập; cookie không mất, lần tải lại sau tự khôi phục; 0 phiên bị thu hồi, 0 audit reuse.

Chạy lại E2E: `MUSEUM_LIVE_TEST=1 E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npx playwright test auth-multi-tab-refresh-live`
(chỉ trên DB local/tạm, vì test có ghi DB).
