# Kế hoạch Kiểm thử E2E CMS Admin & Bug Fixing Sprint (Task 34 & 35)

> Tài liệu hướng dẫn và đặc tả kỹ thuật cho QA Lead / Fullstack Engineer thực hiện Task 34 và Task 35.

## 1. Kiến trúc Kiểm thử E2E

Hệ thống kiểm thử kết hợp 2 tầng:
1. **Tầng Kịch bản Giao diện (Playwright Browser Tests):**
   - Đặt tại `front-end/tests/cms-e2e-*.spec.ts`.
   - Mô phỏng tương tác người dùng thực tế: điều hướng qua menu admin, mở Drawer, nhập Form với Mantine UI, xác nhận qua Confirm Modal, kiểm tra thông báo Toast và bảng dữ liệu Mantine DataTable.
2. **Tầng Tự động hóa Luồng dữ liệu (Automated E2E Workflow Runner):**
   - Script chạy độc lập: `front-end/scripts/e2e-cms-runner.ts` (hoặc `scripts/e2e-cms-test.ts`).
   - Gọi trực tiếp chuỗi API RESTful tuần tự qua HTTP với JWT xác thực thật, xác thực toàn bộ tính toàn vẹn cơ sở dữ liệu, các ràng buộc toàn vẹn khóa ngoại, trạng thái version concurrency và quy tắc BR-21 (xóa media bảo vệ hiện vật đã xuất bản).

---

## 2. Ma trận Kịch bản Kiểm thử E2E (Test Matrix)

| STT | Kịch bản Kiểm thử | Mục tiêu kiểm chứng | Mã lỗi / Trạng thái mong đợi |
| :---: | :--- | :--- | :---: |
| **TC-01** | Tạo và quản lý Phòng trưng bày | Thêm phòng mới với slug, tên tiếng Việt/Anh, mô tả, sửa thông tin | `201 Created` / `200 OK` |
| **TC-02** | Upload Media hợp lệ và không hợp lệ | Upload PNG, JPEG, MP3, VTT, GLB thật. Thử upload file HTML/SVG giả dạng PNG | `201 Created` / `422 Unprocessable` |
| **TC-03** | Tạo Hiện vật & Phiên bản nháp | Thêm hiện vật mới trong phòng, gắn media, tọa độ 3D, hotspot | `201 Created` |
| **TC-04** | Gửi yêu cầu duyệt phiên bản | Chuyển trạng thái từ `draft` sang `in_review` | `200 OK` |
| **TC-05** | Hàng chờ kiểm duyệt & So sánh Diff | Hiển thị trong hàng chờ `/admin/moderation`, xem chi tiết diff | `200 OK` |
| **TC-06** | Từ chối phiên bản có lý do | Từ chối duyệt kèm lý do, chuyển về trạng thái `rejected` | `200 OK` |
| **TC-07** | Phê duyệt xuất bản phiên bản | Duyệt xuất bản, tăng version hiện vật, cập nhật `publishedRevisionId` | `200 OK` |
| **TC-08** | Kiểm soát xung đột sửa đổi (409) | Gửi yêu cầu xuất bản hoặc tạm ẩn với phiên bản cũ | `409 Conflict` |
| **TC-09** | Tạm ẩn và Mở lại hiện vật | Đổi visibility thành `hidden` kèm lý do, sau đó `unhide` lại | `200 OK` |
| **TC-10** | Ràng buộc xóa Media BR-21 | Cố gắng xóa media đang được dùng bởi exhibit đã xuất bản | `409 Conflict` |
| **TC-11** | Gửi Báo cáo vi phạm (Client) | Gửi báo cáo vi phạm công khai, kiểm tra rate-limiting (throttler) | `201 Created` / `429 Too Many` |
| **TC-12** | Xử lý Báo cáo vi phạm (Admin) | Admin tiếp nhận (`assign`), duyệt xử lý (`resolve`), bác bỏ (`dismiss`) | `200 OK` |
| **TC-13** | Nhật ký hệ thống (Audit Trail) | Kiểm tra toàn bộ chuỗi hành động trên được ghi vết đầy đủ | `200 OK` |
| **TC-14** | Thống kê Dashboard | Kiểm tra số liệu tổng quan và biểu đồ cập nhật chính xác | `200 OK` |
| **TC-15** | Dọn dẹp an toàn | Xóa hiện vật nháp, dọn dẹp phòng thử nghiệm | `200 OK` |
