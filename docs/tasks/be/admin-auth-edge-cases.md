# Task: Các trường hợp lỗi xác thực Admin

Nhánh: `fix/admin-auth-edge-cases`.

## Đã làm

- Sai email/mật khẩu cùng trả 401 và không cấp phiên; email không tồn tại vẫn so bcrypt bằng dummy hash có cùng cost. Tài khoản `disabled` hoặc soft-deleted không login/refresh; `/auth/me` không khôi phục user bị khóa/xóa.
- Refresh thiếu/không hợp lệ/hết hạn/tái sử dụng trả 401. Controller xóa cookie với cùng options lúc tạo; Origin không được phép trả 403 và không xoay/xóa cookie.
- Rotation dùng transaction, khóa PostgreSQL theo `family_id` (`pg_advisory_xact_lock`) rồi khóa dòng hiện tại và đọc lại. Tạo token con + đánh dấu token cha đã dùng cùng commit; lỗi ký JWT hoặc ghi dữ liệu rollback.
- Replay thu hồi cả family, kể cả token con; revoke được commit trước khi ném 401. Expiry tính cả thời điểm `expires_at <= now`. Logout cùng khóa family và thu hồi cả family để không bỏ sót token con khi đụng refresh.
- Giữ Controller → Service → Repository; truy vấn/khóa nằm trong repository. Không sửa entity, migration, seed hoặc thêm biến môi trường.

## Hành vi đồng thời

Hai HTTP refresh gửi cùng token: tối đa một request thành công; request còn lại là replay và thu hồi cả family. Token con của request thành công cũng bị thu hồi. Frontend single flight tránh gửi trùng trong cùng một trang; chưa đồng bộ refresh giữa nhiều tab.

Access JWT đã cấp vẫn có thể dùng trên các API khác tới hết TTL; chưa có denylist hoặc kiểm tra trạng thái user trên mọi request. `disabled` là trạng thái do quản trị viên đặt, chưa tự khóa sau nhiều lần sai mật khẩu.

## Kiểm chứng ngày 13/10/2026

- `npm run typecheck`, `npm run lint`, `npm run build`: đạt.
- Luồng được kiểm tra trực tiếp trên giao diện và người phụ trách xác nhận đạt.
- Các file test riêng của task auth đã được xóa theo yêu cầu. Không chạy migration/seed.

Trước merge cần người phụ trách review phần auth và xác minh transaction/lock trên database test PostgreSQL riêng.
