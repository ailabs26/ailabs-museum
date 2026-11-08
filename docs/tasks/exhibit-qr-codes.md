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

## Checklist khi deploy production

Làm đủ trước khi in mã hàng loạt. Thiếu một mục thì khách quét mã sẽ không mở được trang.

- [ ] **`VITE_PUBLIC_SITE_URL`** (front-end) đặt bằng domain production, ví dụ `https://museum.example.com`. Nếu để trống thì mã lấy địa chỉ đang mở CMS: in từ máy dev sẽ ra mã trỏ tới `localhost` hoặc IP LAN.
- [ ] **SPA fallback** ở nơi host front-end: mọi đường dẫn không phải tệp tĩnh đều trả về `index.html`. Thiếu cấu hình này thì quét mã mở thẳng `/e/<id>` bị 404 từ server, dù bấm trong app vẫn chạy.
- [ ] **`FRONTEND_ORIGIN`** (back-end) bằng domain production, nếu không trang khách gọi API bị chặn CORS. Back-end chỉ nhận một origin.
- [ ] **`npm run seed:translations`** đã chạy trên DB production, để trang quét mã có chuỗi `ui.short-link.*` đủ 6 ngôn ngữ.
- [ ] **Quét thử bằng điện thoại thật** một hiện vật đã xuất bản trên bản production:
  - Mở đúng trang chi tiết, có ảnh và audio.
  - Điện thoại cài ngôn ngữ khác tiếng Việt (Anh, Pháp, Trung, Hàn, Nhật) thì trang tự hiện ngôn ngữ đó.
  - Hiện vật chưa xuất bản thì hiện "Không tìm thấy hiện vật".
- [ ] **In thử một trang** từ "In mã QR" của một phòng và quét mã trên giấy ở khoảng 30–50 cm. Máy in mờ thì dùng "Tải SVG" để in.
- [ ] **Chỉ in hàng loạt** sau khi các bước trên đều đạt.
