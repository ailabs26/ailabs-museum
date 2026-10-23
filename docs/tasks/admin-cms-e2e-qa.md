# Task 34 & 35 — Kiểm thử E2E toàn bộ luồng CMS Admin & Tổng hợp Bug Log

Nhánh thực hiện: `feat/cms-admin-e2e-quality` (từ `dev`).  
Phụ trách: Nguyễn Đức Quang (Fullstack / CMS Frontend & QA Lead).  
Ánh xạ SRS: FR-21–25, FR-51–60, FR-90–97, NFR-19, BR-21.

---

## 1. Mục tiêu Task 34: Kiểm thử E2E toàn bộ luồng CMS Admin
Xây dựng bộ kịch bản kiểm thử End-to-End (E2E) tự động hóa, bao phủ toàn bộ vòng đời dữ liệu và tương tác người dùng trên CMS Quản trị Bảo tàng Aura Museum:
1. **Quản lý phòng trưng bày (Rooms):** Tạo phòng mới, cập nhật thông tin, thay đổi trạng thái Active/Archived, xóa phòng an toàn.
2. **Quản lý hiện vật (Exhibits):** Tạo hiện vật nháp (draft), chỉnh sửa nội dung song ngữ Việt/Anh, định vị không gian 3D (X, Y, Z), gắn các điểm tương tác (Hotspots).
3. **Pipeline Upload Media:** Tải lên các loại media (Hình ảnh PNG/JPEG/WebP, Mô hình 3D GLB, Âm thanh MP3, Phụ đề WebVTT). Kiểm tra nghiêm ngặt magic bytes và cấu trúc thực tế; từ chối file giả mạo định dạng.
4. **Quy trình Kiểm duyệt nội dung (Moderation):** Gửi duyệt phiên bản nháp (`in_review`), xem danh sách hàng chờ, kiểm tra chi tiết thay đổi (Diff), duyệt xuất bản (`publish`), từ chối (`reject`) kèm lý do, tạm ẩn (`hide`) và mở lại (`unhide`).
5. **Kiểm soát xung đột đồng thời (Optimistic Concurrency 409):** Đảm bảo hai phiên làm việc cùng sửa/duyệt một hiện vật sẽ kích hoạt mã lỗi `409 Conflict` và xử lý thông báo UI chuẩn xác.
6. **Xử lý Báo cáo vi phạm (Content Reports):** Client gửi báo cáo vi phạm kèm lý do (rate limit chống spam), Admin tiếp nhận (`assign`), phê duyệt xử lý (`resolve`), hoặc bác bỏ (`dismiss`).
7. **Nhật ký hệ thống (Audit Trail):** Tự động ghi nhận đầy đủ mọi hành động quản trị viên (tạo, sửa, xóa, duyệt, xuất bản, xử lý báo cáo) kèm thông tin định danh actor và revisionId.
8. **Thống kê tổng quan (Dashboard):** Đồng bộ số liệu tổng quan và biểu đồ sau mỗi thao tác.

---

## 2. Mục tiêu Task 35: Tổng hợp Bug Log & Điều phối Bug Fixing Sprint
1. Xây dựng tài liệu **Bug Log** chi tiết, phân loại theo mức độ nghiêm trọng:
   - **Blocker:** Lỗi chặn luồng nghiệp vụ cốt lõi, không thể tiếp tục vận hành.
   - **Critical:** Lỗi ảnh hưởng nghiêm trọng đến tính toàn vẹn dữ liệu, quyền truy cập hoặc trải nghiệm người dùng chính.
   - **Minor/Trivial:** Lỗi hiển thị giao diện nhỏ, thông báo chưa tối ưu hoặc xử lý ngoại lệ biên.
2. Thực hiện sửa lỗi (Bug Fixing) trực tiếp trong sprint kiểm thử để gia cố mã nguồn, đảm bảo hệ thống đạt độ tin cậy cao nhất cho Production v1.
3. Bàn giao báo cáo nghiệm thu kiểm thử E2E (`E2E Test CMS Report`) với đầy đủ số liệu kiểm chứng.

