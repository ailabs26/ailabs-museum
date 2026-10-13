# Task: Hoàn thiện màn hình tài khoản Admin

Nhánh: `fix/admin-user-management`; màn hình `/admin/users`.

## Đã làm

- Tạo, sửa thông tin/khóa/mở khóa, xóa mềm và gán/bỏ toàn bộ Role kết nối NestJS.
- Gán Role kiểm tra quyền riêng; người chỉ có `role:assign` + `role:read` lưu qua PUT,
  người có `user:update` lưu thông tin + Role bằng một PATCH.
- Role chưa tải/lỗi không ghi đè thành []; cho thử lại. Không gọi danh sách Role khi thiếu quyền đọc.
- Phân biệt tải/lỗi/rỗng; lỗi lưu giữ form và thông báo backend. Chặn gửi/đóng form khi đang lưu.
- Tìm kiếm có debounce, lọc trạng thái, phân trang; nhãn xóa mềm rõ ràng, khóa bằng form sửa.
- Kiểm tra response User và danh sách Role bằng Zod trước khi dùng.

## Kiểm chứng 13/10/2026

- Typecheck, lint, build: đạt; Vite vẫn cảnh báo chunk lớn.
- Unit test hiện có: 6/6 đạt.
- Chromium production preview với API fixture: 8/8 đạt (PATCH nguyên tử, quyền cập nhật
  và gán Role riêng, lỗi User/Role, response sai schema, tạo/tìm/xóa và lỗi lưu).
- Kiểm tra tạm ngoài repo; không thêm file test vào repo. Chưa nghiệm thu CRUD trên
  NestJS + PostgreSQL thật; không ghi Supabase hoặc GitHub.

## Kiểm tra bàn giao

Mở Tài khoản → tạo User → sửa tên/trạng thái/vai trò → tải lại kiểm tra → tìm/lọc →
xóa tài khoản test. Thử tài khoản chỉ đọc, chỉ cập nhật và chỉ gán Role; thử mất API/Role,
email trùng và lỗi Admin cuối cùng. Quyền mới áp dụng với JWT mới; menu của phiên hiện tại
cập nhật khi tải lại/đăng nhập lại. Email không sửa được, không có màn hình khôi phục xóa mềm.
