# Admin permission matrix

## Phạm vi

- Cung cấp API cập nhật nhiều vai trò trong ma trận quyền bằng một transaction.
- Kiểm tra vai trò, mã quyền và chặn thay đổi quyền của vai trò `admin` hệ thống.
- Ghi audit cho từng vai trò được cập nhật.
- Không thay đổi schema database và không tạo/chạy migration.

## Nghiệm thu

- Cập nhật hợp lệ được áp dụng đồng thời; dữ liệu không hợp lệ không gây cập nhật một phần.
- Endpoint yêu cầu `role:update` và trả danh sách vai trò sau cập nhật.
