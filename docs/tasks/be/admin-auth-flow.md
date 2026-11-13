# Task: Sửa luồng xác thực Admin

Nhánh: `fix/admin-auth-flow`.
Luồng: login → Admin → reload → access token hết hạn → refresh → logout.

## Đã làm

- Giữ API login, refresh, me; chuẩn hóa login/refresh/logout trả HTTP 200 và bổ sung Swagger.
- Logout xác định phiên bằng refresh cookie, thu hồi phiên và xóa cookie kể cả khi access token đã hết hạn; kiểm tra Origin khi trình duyệt gửi Origin.
- Xóa refresh cookie với cùng `HttpOnly`, `SameSite`, `Secure`, `path` lúc tạo. Logout trả envelope `{ success: true, data: null, message: null }`.

## Kiểm chứng

- `npm run typecheck`, `npm run lint`, `npm run build` đều đạt.
- Chưa kiểm thử với database Supabase hoặc trình duyệt thật. Không tạo/chạy migration, không chạy seed.
- Logout thu hồi refresh session; access JWT đã cấp vẫn có thể dùng tới hết TTL. Frontend xóa token trong bộ nhớ ngay khi logout.

## Nhánh sau

Sai mật khẩu, tài khoản bị khóa, refresh hết hạn/tái sử dụng, nhiều request đồng thời và transaction/khóa cho refresh rotation.
