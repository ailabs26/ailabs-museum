# Task: Mã QR cho từng hiện vật

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/exhibit-qr-codes`.

## Bối cảnh

Khách ở bảo tàng thật chưa có cách nhanh để mở nội dung số của hiện vật đang đứng trước mặt. Mỗi hiện vật có một mã QR dán cạnh nó; quét là mở trang chi tiết.

## Thay đổi

- **Liên kết cố định `/e/<id>`**: mã chỉ chứa id hiện vật. Trang `/e/<id>` gọi `GET /public/exhibits/:id/location` rồi chuyển tới `/collection/<slug-phòng>/exhibits/<id>`, nên đổi slug phòng hay chuyển hiện vật sang phòng khác thì mã đã in vẫn dùng được.
- API chỉ trả khi hiện vật đã xuất bản, đang hiển thị và thuộc phòng active (cùng điều kiện với tìm kiếm công khai); ngược lại 404, id sai định dạng 400.
- **Ngôn ngữ**: khách vào qua mã QR mà chưa từng chọn ngôn ngữ thì trang theo ngôn ngữ của máy (`ko-KR` → `ko`), không khớp thì tiếng Việt. Vào trang thường vẫn mặc định tiếng Việt.
- **CMS**: nút "Mã QR" ở mỗi hiện vật (xem, sao chép liên kết, tải PNG/SVG, cảnh báo khi chưa công khai). Nút "In mã QR" ở mỗi phòng mở trang in khổ A4, mặc định chỉ hiện vật đã xuất bản.
- Thư viện `qrcode` chỉ tải khi admin mở mã QR, không vào bundle trang khách.

## Cấu hình

`VITE_PUBLIC_SITE_URL` (front-end): địa chỉ trang khách in trên mã. Để trống thì dùng địa chỉ đang mở CMS; nên đặt khi in mã từ máy không phải production.
