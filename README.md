# Aura Museum - Bảo tàng WebXR tương tác

- **Mã đề tài:** 3D-WEB-03
- **Đơn vị thực hiện:** Nhóm ailabs26

---

## 1. Đặt vấn đề

Việc số hóa và đưa các không gian bảo tàng, triển lãm lên nền tảng số đang là nhu cầu cấp thiết nhằm giúp công chúng tiếp cận di sản, văn hóa và nghệ thuật một cách thuận tiện từ xa. Tuy nhiên, các giải pháp tham quan trực tuyến hiện nay thường gặp một số hạn chế:

- **Rào cản thiết bị và cài đặt:** Nhiều ứng dụng 3D/VR đòi hỏi người dùng phải cài đặt phần mềm chuyên biệt hoặc sở hữu các thiết bị phần cứng đắt tiền.
- **Thiếu tính tương thích đa nền tảng:** Khi chạy trên trình duyệt web, trải nghiệm thường không ổn định hoặc bị gián đoạn nếu thiết bị người dùng có cấu hình yếu hoặc không hỗ trợ công nghệ WebXR/WebGL.
- **Khả năng tiếp cận hạn chế:** Phần lớn ứng dụng 3D chưa chú trọng đến khả năng hỗ trợ người khuyết tật (khiếm thị, người chỉ điều hướng bằng bàn phím).
- **Khó khăn trong quản lý nội dung:** Dữ liệu hiện vật thường bị gắn cứng (hardcoded) vào mã nguồn 3D, gây khó khăn cho việc cập nhật, chỉnh sửa thông tin trưng bày.

---

## 2. Mục tiêu bài toán

Dự án **Aura Museum** giải quyết bài toán xây dựng một không gian bảo tàng ảo tương tác 3D/WebXR chạy trực tiếp trên trình duyệt, đảm bảo người dùng ở bất kỳ thiết bị nào cũng có thể tiếp cận được nội dung trưng bày:

1. **Trải nghiệm tham quan trực quan trên Web:**
   - Người xem có thể tự do di chuyển trong phòng trưng bày 3D trên máy tính (chuột/bàn phím), điện thoại (cảm ứng) hoặc kính thực tế ảo (teleport qua WebXR).
   - Mỗi hiện vật đi kèm điểm tương tác (hotspot), khung thông tin chi tiết, thuyết minh bằng âm thanh và phụ đề trực quan.
   - Hỗ trợ chế độ tham quan tự động (guided tour) đi qua lần lượt các hiện vật.

2. **Cơ chế dự phòng theo tầng (Graceful Degradation):**
   - **Tầng XR (Immersive VR):** Dành cho thiết bị có kính VR/XR, điều hướng không gian thực tế ảo.
   - **Tầng 3D tiêu chuẩn:** Dành cho máy tính, điện thoại hỗ trợ WebGL thông thường. Tự động giảm chất lượng hiển thị khi phát hiện giật/lag.
   - **Tầng 2D Fallback:** Giao diện danh mục web truyền thống (hình ảnh, mô tả, audio) khi thiết bị không hỗ trợ WebGL hoặc tải không thành công, đảm bảo không bỏ sót người dùng.

3. **Quản trị nội dung linh hoạt:**
   - Dữ liệu hiện vật (tiêu đề, mô tả, mô hình 3D, audio thuyết minh, giấy phép) được quản lý qua Headless CMS và xác thực qua schema dữ liệu, tách biệt hoàn toàn khỏi mã nguồn hiển thị.

4. **Khả năng tiếp cận (Accessibility - a11y):**
   - Hỗ trợ đầy đủ điều hướng bằng bàn phím, tương thích với trình đọc màn hình (screen reader), cung cấp phụ đề và tôn trọng tùy chọn giảm chuyển động của hệ điều hành.

---

## 3. Phạm vi bài toán

### Trong phạm vi (In-Scope)
- Xây dựng 01 phòng triển lãm mẫu với 5 hiện vật tiêu biểu.
- Hệ thống tương tác hiện vật: hotspot, popup thông tin, audio thuyết minh kèm phụ đề và tour tự động.
- Cơ chế phát hiện thiết bị và chuyển đổi tầng hiển thị (XR / 3D / 2D).
- Kết nối và đồng bộ nội dung từ CMS.
- Đảm bảo các tiêu chuẩn về khả năng tiếp cận cơ bản và tối ưu hiệu năng web.

### Ngoài phạm vi (Out-of-Scope)
- Tương tác đa người dùng trong cùng một phòng (Multiplayer / Realtime).
- Hệ thống bán vé và thanh toán trực tuyến.
- Bộ công cụ chỉnh sửa hoặc tạo mô hình 3D trực tiếp trên CMS.
