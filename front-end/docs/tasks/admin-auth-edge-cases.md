# Task: Các trường hợp lỗi đăng nhập Admin

Nhánh: `fix/admin-auth-edge-cases`.

## Đã làm

- Sai mật khẩu/tài khoản khóa giữ form và email, hiển thị lỗi trong `role="alert"`, không chuyển vào Admin; chặn submit lại trong lúc login đang chờ.
- Nhiều request 401 trong cùng trang dùng một promise refresh rồi retry từng request tối đa một lần. 401 đến muộn sau rotation dùng access token mới thay vì refresh thêm lần nữa.
- Tách phiên đăng nhập khỏi lần thay access token. Response/retry của phiên cũ không dùng token của phiên mới hoặc trả dữ liệu quản trị sau logout.
- Refresh bị từ chối hoặc sai contract xóa token; AuthProvider hiện có xóa user, hủy query/dọn cache và RequireAuth chuyển về login. Retry vẫn 401 cũng kết thúc phiên.
- Logout chờ refresh kết thúc và vẫn gửi logout nếu refresh thất bại; response refresh đến sau logout không khôi phục phiên.
- Vitest dùng alias `@/` giống Vite. Không thêm dependency hoặc biến môi trường.

## Kiểm chứng ngày 13/10/2026

- `npm run typecheck`, `npm run lint`, `npm run build`: đạt.
- Luồng được kiểm tra trực tiếp trên giao diện và người phụ trách xác nhận đạt.
- Các file test riêng của task auth đã được xóa theo yêu cầu.
- Vite vẫn cảnh báo chunk lớn: main khoảng 1.37 MB, scene khoảng 851 KB (minified); tối ưu bundle nằm ngoài task auth.

Giới hạn: single flight chỉ trong cùng trang, chưa phối hợp nhiều tab. Theo chính sách backend, hai refresh thực sự gửi trùng token gây thu hồi cả family và yêu cầu login lại.
