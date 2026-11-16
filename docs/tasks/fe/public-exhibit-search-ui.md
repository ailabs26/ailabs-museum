# Task: Tìm kiếm hiện vật trên toàn bảo tàng cho khách

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/public-exhibit-search`. Nối `GET /rooms/search` (VT-077, #130) vào giao diện.

## Bối cảnh

Ô tìm kiếm ở trang Bộ sưu tập chỉ lọc tại chỗ trong phòng đang chọn. Khách tìm hiện vật ở phòng khác sẽ thấy "không có", dù
back-end đã có API tìm trên toàn bảo tàng.

## Thay đổi

- `GlobalExhibitSearch`: khối "Ở các phòng khác" dưới ô tìm kiếm cũ.
  - Gọi API sau 300 ms ngừng gõ, từ 2 ký tự trở lên; phân trang 12 mục với nút "Xem thêm kết quả".
  - Bỏ hiện vật của phòng đang xem (đã có ở trên) và hiện vật thuộc phòng không có trong danh sách công khai.
  - Có trạng thái đang tìm, không có kết quả, lỗi + Thử lại, và dòng "Tìm thấy N hiện vật" đọc được bằng trình đọc màn hình.
- Phòng đang xem không có kết quả thì khối này được đưa lên trước, để kết quả không bị đẩy xuống dưới màn hình.
- Lọc tại chỗ trong phòng giữ nguyên, API lỗi không ảnh hưởng lọc này.

## Kiểm chứng ngày 04/11/2026

- Front-end: lint, typecheck, build đạt; vitest 218/218.
- Playwright `collection-global-search.spec.ts`: kết quả kèm tên phòng và link đúng; khối nằm trước khi phòng trống; không lặp
  hiện vật phòng đang xem; dưới 2 ký tự không gọi API; debounce một request; API lỗi không ảnh hưởng lọc tại chỗ, Thử lại được.
- Chạy UI thật với API thật (PostgreSQL tạm, 2 phòng, hiện vật song ngữ đã xuất bản): tìm "Bình gốm" từ Phòng A ra hiện vật ở
  Phòng B, bấm vào mở đúng trang chi tiết.
