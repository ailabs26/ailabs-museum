# Task: Sửa luồng đăng nhập Admin

Nhánh: `fix/admin-auth-flow`.
Luồng: login → Admin → reload → access token hết hạn → refresh → logout.

## Đã làm

- Nối LoginPage với API thật; giữ trang Admin đích cùng query/hash, chuyển người đã đăng nhập khỏi trang login, đồng nhất mật khẩu tối thiểu 8 ký tự với backend.
- Cho phép `/auth/me` refresh/retry khi cần; khôi phục phiên bằng refresh cookie sau reload và tránh lặp request khởi tạo trong React StrictMode.
- Kiểm tra response auth bằng Zod; giữ access token trong bộ nhớ và gửi refresh cookie qua `withCredentials`.
- Đồng bộ token/user, hủy query và dọn cache khi logout; chờ refresh đang chạy rồi thu hồi cookie, không nhận lại token trả về sau khi đã logout.

## Kiểm chứng

- `npm run typecheck`, `npm run lint`, `npm run build` đều đạt; lệnh build thông thường đã chạy tại repo gốc. Vite còn cảnh báo bundle khoảng 679 KB.
 Chưa xác minh bằng trình duyệt thật. Kiểm tra thủ công còn cần: vào `/admin`, đăng nhập, reload vẫn ở Admin, chờ access token hết hạn rồi gọi API quản trị, logout về login, reload vẫn ở login; quan sát cookie trong DevTools.

## Nhánh sau

Sai mật khẩu, tài khoản bị khóa, refresh hết hạn/tái sử dụng và nhiều request đồng thời.
