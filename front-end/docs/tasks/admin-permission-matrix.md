# Admin permissions và permission matrix

## Phạm vi

- Tách trang danh sách quyền tại `/admin/permissions` và ma trận tại `/admin/permission-matrix`.
- Hiển thị trạng thái tải, lỗi/thử lại, dữ liệu trống và kết quả tìm kiếm trống.
- Chỉ cho sửa khi có `role:update`; cột `admin` hệ thống luôn chỉ đọc.
- Lưu các vai trò đã thay đổi bằng một request và giữ lựa chọn khi request thất bại.
- Kiểm tra cấu trúc response API trước khi dùng.

## Nghiệm thu

- Điều hướng và route phản ánh đúng `permission:read`, `role:read`, `role:update`.
- Danh sách quyền và ma trận hiển thị dữ liệu backend, không hard-code nội dung quyền.

- Bộ đếm trên nút lưu tính số vai trò còn thay đổi so với dữ liệu đã lưu; hoàn tác về trạng thái ban đầu làm giảm số đếm.
