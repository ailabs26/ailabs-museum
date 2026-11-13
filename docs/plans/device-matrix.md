# Device matrix

Trạng thái dưới đây là checklist, không phải kết quả thử nghiệm thiết bị. Kiểm thử thực tế cần ghi ngày, browser/version, model máy, chế độ mạng và bằng chứng ảnh/log.

| Thiết bị | Browser gợi ý | Di chuyển / chọn | VR | Trạng thái |
| --- | --- | --- | --- | --- |
| Desktop Windows/macOS/Linux | Chrome, Firefox, Safari mới | WASD, chuột, click và danh sách bàn phím | Tùy WebXR | Chưa thử thủ công |
| Android cảm ứng | Chrome | Nút hướng, kéo nhìn, chạm | Tùy thiết bị | Chưa thử trên máy thật |
| iOS/iPadOS | Safari | Nút hướng, kéo nhìn, chạm | Thường không có immersive-vr | Chưa thử trên máy thật |
| Kính WebXR | Browser tích hợp của kính | Thumbstick, trigger, headset | immersive-vr | Chưa thử trên kính thật |
| Thiết bị không WebGL | Browser bất kỳ | Danh sách 2D, bảng nội dung | Không | Chưa thử thủ công |

Điều kiện kiểm tra: phục vụ qua HTTPS hoặc localhost cho WebXR; xác nhận nút VR chỉ hiện khi `isSessionSupported('immersive-vr')`; xác nhận desktop/mobile dùng được nếu không có `navigator.xr`. Kiểm tra phím Tab, Enter/Space trên danh sách, Esc đóng bảng, transcript, contrast, hướng ngang/dọc và hành vi khi quyền XR bị từ chối.
