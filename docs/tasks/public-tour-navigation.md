# Task: Khôi phục điều hướng tham quan 3D

Nhánh: `fix/public-tour-navigation`; base `50d1209`.

## Nguyên nhân và phạm vi

Trang chủ được dựng lúc tour chưa khả dụng nên header và hero dùng text “Sắp ra mắt”. Route `/tour` hiện đã trỏ tới `MuseumPage` sau tích hợp Day 2, nhưng copy/điều hướng chưa cập nhật.

## Các bước

- [x] Kiểm tra route, cả hai chỗ dùng nhãn cũ và CSS liên quan.
- [x] Thêm kiểm tra Playwright chứng minh header/hero dẫn tới tour bằng bàn phím, nav active và không tự mount Canvas.
- [x] Header dùng `NavLink` tới `/tour`; hero dùng `Link` tới `/tour`; giới thiệu mô tả đúng khả năng đọc danh mục và mở không gian 3D hiện tại.
- [x] Xóa CSS chỉ dùng cho trạng thái cũ; giữ phần hiện vật nổi bật trống và danh mục chưa triển khai.
- [x] Chạy test navigation, typecheck/lint/build và kiểm tra responsive light/dark.
- [x] Review diff và chuẩn bị commit phần fix kèm test/bằng chứng. Báo nội dung trước khi tạo PR.

## Điều kiện nghiệm thu

Header và trang chủ không còn “Sắp ra mắt” cho 3D. Hai liên kết tới `/tour`, focus/Enter hoạt động; header báo đúng trang active; API catalogue hiển thị và Canvas chỉ mở khi nhấn nút. Không đổi API, database hoặc scene. Tests dùng fixture để kiểm tra UI, không thay cho kiểm chứng dữ liệu Supabase thật.

## Trạng thái

Đã sửa, 2 Playwright tests đạt (17.6s); trước sửa cả hai fail đúng vì nhãn cũ và không có link. Assertions kiểm tra hai entry bằng Enter, tour hiển thị 5 hiện vật fixture, Canvas chưa mount và nav active. Kiểm tra không tràn ngang 320/768/1024/1440 px ở light/dark đạt. Frontend typecheck/lint/build đạt; build vẫn cảnh báo bundle >500 kB. Chưa chạy full suite vì nhiều test cũ còn kỳ vọng heading trang chủ/tour trước tích hợp; tests tập trung kiểm chứng trực tiếp phần fix. Chưa kiểm chứng hình ảnh trực quan hoặc dữ liệu Supabase trong lượt này. Chưa push/PR.
