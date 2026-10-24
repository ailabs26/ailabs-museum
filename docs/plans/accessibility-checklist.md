# Bảng Kiểm tra Khả năng Tiếp cận (Accessibility Checklist — WCAG 2.2 AA)
**Dự án:** Aura Museum (Giai đoạn 1 - MVP)  
**Phụ trách:** Đinh Quang Tiến (Frontend / Client UI Lead)  
**Tiêu chuẩn đối chiếu:** [W3C WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/) & [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/)  
**Ngày cập nhật:** 24/10/2026  
**Phạm vi:** Client Public Pages (`/`, `/collection`, `/collection/:roomSlug/:exhibitId`, `/tour`) & Admin CMS Overlays.

---

## 1. Mục tiêu và Nguyên tắc Tiếp cận

Bảo đảm mọi người dùng, kể cả người khuyết tật vận động (chỉ dùng bàn phím), người khiếm thị/thị lực kém (dùng screen reader, phóng to màn hình, chế độ tương phản cao), hoặc người dùng không hỗ trợ WebGL đều có thể tiếp cận trọn vẹn nội dung hiện vật của Aura Museum.

### Nguyên tắc 100% Bàn phím:
- Mọi chức năng thiết yếu đều có thể kích hoạt bằng bàn phím (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`).
- Không có bẫy bàn phím (No Keyboard Trap).
- Thứ tự duyệt Tab tuần tự, hợp lý theo luồng đọc trực quan (Logical Focus Order).
- Focus indicator hiển thị rõ ràng, không bị ẩn hoặc che khuất (Focus Visible).

---

## 2. Bảng Kiểm tra Chi tiết theo Tiêu chuẩn WCAG 2.2 AA

| Tiêu chuẩn WCAG | Mức độ | Yêu cầu kỹ thuật | Thành phần thực hiện trong Aura Museum | Trạng thái |
|---|---|---|---|:---:|
| **2.1.1 Keyboard** | Level A | Tất cả chức năng kích hoạt được bằng bàn phím mà không yêu cầu thời gian nhấn cụ thể. | - Skip link `#public-content`<br>- Danh mục 2D, chọn phòng, mở chi tiết<br>- Nút Play/Pause Audio, thanh tua<br>- Form báo cáo vi phạm | **ĐẠT (PASS)** |
| **2.1.2 No Keyboard Trap** | Level A | Tiêu điểm không bị kẹt trong bất kỳ vùng hoặc thành phần nào. Người dùng có thể Tab hoặc Esc ra ngoài. | - `PublicReportModal` cho phép `Esc` đóng modal<br>- Canvas 3D chỉ bắt WASD khi canvas có focus, `Tab` thoát tự nhiên ra ngoài | **ĐẠT (PASS)** |
| **2.1.4 Character Key Shortcuts** | Level A | Phím tắt ký tự đơn có thể tắt được hoặc chỉ hoạt động khi component có focus. | Phím WASD, F, Home chỉ kích hoạt khi `document.activeElement === canvas`, không can thiệp form nhập liệu | **ĐẠT (PASS)** |
| **2.4.1 Bypass Blocks** | Level A | Cung cấp cơ chế bỏ qua khối nội dung lặp lại (Skip Navigation). | `<a href="#public-content" className="skip-link">Bỏ qua tới nội dung chính</a>` tại `PublicLayout.tsx` | **ĐẠT (PASS)** |
| **2.4.3 Focus Order** | Level A | Thứ tự Tab di chuyển hợp lý theo thứ tự đọc và logic giao diện. | Cấu trúc DOM tuần tự: Header → Main → Catalogue/Grid → Detail Aside → Footer | **ĐẠT (PASS)** |
| **2.4.7 Focus Visible** | Level AA | Chỉ báo tiêu điểm bàn phím hiển thị rõ nét trên mọi phần tử tương tác. | CSS Mantine và biến theme `:focus-visible` với outline tương phản cao (2px solid teal.7) | **ĐẠT (PASS)** |
| **2.4.11 Focus Not Obscured** | Level AA | Phần tử có tiêu điểm không bị che khuất hoàn toàn bởi sticky header hoặc drawer/modal. | Padding container an toàn, `scroll-margin-top` cho các section tiêu đề | **ĐẠT (PASS)** |
| **1.3.1 Info and Relationships** | Level A | Cấu trúc ngữ nghĩa (Semantic HTML, headings, ARIA) phản ánh đúng mối quan hệ nội dung. | Heading hierarchy rõ ràng (`h1` tên hiện vật/trang, `h2` các phần mô tả/thuyết minh/bản quyền, `role="region"` hoặc `article`) | **ĐẠT (PASS)** |
| **1.4.3 Contrast (Minimum)** | Level AA | Tỷ lệ tương phản chữ và nền tối thiểu 4.5:1 (chữ thường) và 3:1 (chữ lớn). | Bảng màu trung tính `#1A1B1E` trên nền `#F8F9FA` hoặc `#FFFFFF` đạt tỷ lệ tương phản >= 7:1 | **ĐẠT (PASS)** |
| **1.4.11 Non-text Contrast** | Level AA | Các thành phần UI và icon tương tác có độ tương phản tối thiểu 3:1 với nền kế cận. | Các nút bấm viền Mantine, icon điều hướng, thanh trượt audio đạt tương phản >= 3.5:1 | **ĐẠT (PASS)** |
| **1.2.2 Captions / Transcripts** | Level A | Cung cấp bản thuyết minh (transcript) hoặc phụ đề WebVTT kèm theo âm thanh. | `AudioPlayer.tsx` tích hợp đồng bộ phụ đề WebVTT và hiển thị toàn văn Transcript bên dưới hiện vật | **ĐẠT (PASS)** |
| **4.1.2 Name, Role, Value** | Level A | Các control tùy chỉnh có accessible name, role và state thông báo được qua Assistive Tech. | Nút đóng `aria-label="Đóng"`, tab chọn phòng có `aria-selected`, modal có `role="dialog"` | **ĐẠT (PASS)** |

---

## 3. Kiểm thử Kịch bản Thực tế (Interactive Scenarios)

### Kịch bản 1: Điều hướng Trang chủ và Bộ sưu tập bằng bàn phím
- **Thao tác:** Từ thanh địa chỉ trình duyệt, nhấn `Tab` liên tục.
- **Kết quả mong đợi:**
  1. Xuất hiện Skip Link "Bỏ qua tới nội dung chính", nhấn `Enter` nhảy thẳng tới tiêu đề trang.
  2. Tab lần lượt qua các liên kết menu: "Bộ sưu tập", "Tham quan 3D".
  3. Tại `/collection`: Tab vào dropdown chọn phòng, dùng phím Mũi tên lên/xuống để đổi phòng, nhấn `Enter` để chọn.
  4. Tab vào từng thẻ hiện vật trong lưới 2D (`ExhibitGrid`), nhấn `Enter` mở trang chi tiết hiện vật.

### Kịch bản 2: Vòng đời Focus của Báo cáo vi phạm (Public Report Modal)
- **Thao tác:** Tại trang chi tiết `/collection/:roomSlug/:exhibitId`, Tab tới nút "Báo nội dung" và nhấn `Enter`.
- **Kết quả mong đợi:**
  1. `PublicReportModal` mở ra, bẫy focus (Focus Trap) giữ tiêu điểm bên trong Modal.
  2. Tab qua Dropdown Danh mục → Vùng nhập nội dung → Nút Hủy → Nút Gửi báo cáo → quay lại Nút Đóng modal (không rơi ra nền).
  3. Nhấn `Escape`: Modal đóng lại, focus quay trở về nút "Báo nội dung" ban đầu.
  4. Khi gửi báo cáo thành công: Toast thông báo hiển thị và focus quay về vùng nội dung hợp lý.

### Kịch bản 3: Dự phòng 2D khi không có WebGL (Fallback Mode)
- **Thao tác:** Truy cập `/tour` trên trình duyệt tắt tăng tốc phần cứng hoặc chặn WebGL.
- **Kết quả mong đợi:**
  1. Hệ thống phát hiện WebGL context loss hoặc không khởi tạo được 3D canvas.
  2. Tự động hiển thị `SceneFallback` với thông báo thân thiện và nút chuyển hướng sang Bộ sưu tập 2D (`/collection`).
  3. Tiêu điểm bàn phím tự động chuyển về tiêu đề `<h1>` của trang Bộ sưu tập, không bị mất tiêu điểm vào `<body>`.

---

## 4. Bàn giao và Duy trì

Checklist này được tích hợp vào quy trình kiểm thử CI/E2E định kỳ của dự án Aura Museum. Bất kỳ thay đổi giao diện hoặc thêm mới component đều phải vượt qua checklist này trước khi phát hành phiên bản tiếp theo.

