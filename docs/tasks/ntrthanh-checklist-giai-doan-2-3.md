# Checklist việc còn lại & Báo cáo Nghiệm thu — Nguyễn Trọng Thành (Giai đoạn 2–3)

Ngày cập nhật: **13/11/2026** · Nguồn phân công: [`docs/architecture/fe/tasks-and-validation.md`](../architecture/fe/tasks-and-validation.md)

---

## 1. Tổng quan Tiến độ Thực tế theo Nhiệm vụ Phân công

| Task | Nội dung chính | Giai đoạn / Deadline | Trạng thái hiện tại | Tham chiếu Pull Request / Nhánh |
|---|---|---|:---:|---|
| **6–10** | Quản lý Rooms, Exhibit form, Media upload, Gắn media, 3D Preview | GĐ 1 (MVP) | ✅ **HOÀN THÀNH** | Đã merge vào `origin/dev` |
| **28** | Fuzz upload & Bảo vệ tệp độc hại (AC-33) | GĐ 2 (20/11) | ✅ **HOÀN THÀNH** | **PR #192** (`test/media-upload-fuzz`) |
| **29** | Kiểm thử tải k6 100–200 CCU, $p95 \le 500\text{ ms}$, lỗi $< 1\%$ (AC-49) | GĐ 2 (20/11) | ✅ **HOÀN THÀNH** | **PR #191** (`feat/k6-api-load`) |
| **38** | Bulk import / export hiện vật định dạng JSON / CSV | GĐ 3 (21/11–08/12) | ✅ **HOÀN THÀNH** | **PR #194** (`feat/exhibits-bulk-import-export`) |
| **39** | i18n nội dung đa ngôn ngữ, fallback tiếng Việt | GĐ 3 | ✅ **HOÀN THÀNH** | Đã merge (PR #163, #164, #165) |

---

## 2. Danh mục Tài liệu Kỹ thuật Bổ sung (Mới cập nhật)

1. [Cẩm nang Vận hành & Xử lý Sự cố Media Pipeline](be/media-pipeline-troubleshooting-runbook.md): Quy trình thẩm tra magic bytes, cơ chế cách ly quarantine, bảo vệ BR-21 và bảng mã lỗi xử lý sự cố.
2. [Đặc tả Kỹ thuật Nhập / Xuất Hiện vật Hàng loạt](be/exhibits-bulk-io-specification.md): Cấu trúc CSV RFC 4180, giải pháp chống CSV Formula Injection, mô hình kiểm tra theo dòng và partial import.
3. [Kiến trúc Phòng thủ Đa tầng & Phương pháp luận Fuzzing](be/upload-security-fuzzing-methodology.md): 5 lớp phòng thủ chống tấn công qua upload, động cơ đột biến bit-flipping và kết quả kiểm thử trên 1,2 triệu ca validator.
4. [Báo cáo Phân tích Hiệu năng & Năng lực Chịu tải k6](be/api-load-testing-benchmark-analysis.md): Dữ liệu phân vị thời gian phản hồi ở 100 và 200 VUs, phân tích điểm nghẽn và khuyến nghị hạ tầng production.

---

## 3. Chi tiết Nghiệm thu Từng Hạng mục

### A. Task 29 — k6 Tải API (Đã hoàn thành - PR #191)
- [x] **29.1** Tạo nhánh `feat/k6-api-load` từ `dev`.
- [x] **29.2** Viết spec `docs/tasks/be/k6-api-load.md`: mục tiêu AC-49, danh sách endpoint, cấu hình máy/DB.
- [x] **29.3** Môi trường đo riêng: PostgreSQL local qua Docker, chạy độc lập với dev server.
- [x] **29.4** Cài đặt và tích hợp công cụ k6.
- [x] **29.5** `config.js`: ngưỡng `http_req_duration: ['p(95)<500']`, `http_req_failed: ['rate<0.01']`.
- [x] **29.6** Kịch bản khách xem mix trọng số (`/rooms`, `/rooms/:slug`, `/location`, `/translations`).
- [x] **29.7** Ramping stages: 5 VUs → 100 VUs → 200 VUs → 500 VUs stress.
- [x] **29.8** Thêm kịch bản đọc của quản trị viên.
- [x] **29.9** Tích hợp script `load:k6` và hướng dẫn chạy kiểm thử.
- [x] **29.10** Lưu trữ kết quả đo baseline và summary JSON vào repository.
- [x] **29.11** Tối ưu hóa truy vấn TypeORM, kết nối connection pool và loại bỏ triệt để N+1 queries.
- [x] **29.12** Báo cáo nghiệm thu: $p95 = 245\text{ ms}$ tại 200 CCU, tỷ lệ lỗi $0.02\%$ (đạt chuẩn AC-49).
- [x] **29.13** Mở **PR #191** vào nhánh `dev`.

---

### B. Task 28 — Fuzzing Upload Pipeline (Đã hoàn thành - PR #192)
- [x] **28.1** Tạo nhánh `test/media-upload-fuzz` và đặc tả kịch bản AC-33.
- [x] **28.2** Bộ sinh dữ liệu đột biến nhị phân tự động:
  - Đột biến byte, bit-flipping trên GLB, PNG, JPEG, WebP, MP3, VTT.
  - Lệch định dạng ↔ MIME header ↔ phần mở rộng tệp.
  - Tấn công Polyglot (kết hợp PNG và mã thực thi JavaScript).
  - Tấn công giới hạn biên ($Limit - 1$, $Limit$, $Limit + 1$ byte).
  - Tên tệp độc hại: Path Traversal (`../`), Null Byte (`\0`), ký tự điều khiển ASCII.
- [x] **28.3** HTTP Fuzzing `POST /api/admin/media/upload`: 100% tệp xấu nhận mã lỗi `4xx`, không có lỗi 500.
- [x] **28.4** Kiểm thử hàng đợi upload bất đồng bộ `POST /api/admin/media/upload-jobs`.
- [x] **28.5** Bảo toàn media cũ: upload tệp hỏng thay thế không làm mất liên kết hiện tại của hiện vật.
- [x] **28.6** Kiểm tra cấu trúc sâu: chặn chunk GLB dị dạng, làm sạch mã script trong WebVTT.
- [x] **28.7** Tích hợp script `npm run test:fuzz` chạy tự động.
- [x] **28.8** Sửa lỗi chuẩn hóa thông điệp lỗi của Multer/Busboy sang envelope tiếng Việt đồng nhất.
- [x] **28.9** Lập báo cáo kiểm chứng chi tiết và mở **PR #192** vào nhánh `dev`.

---

### C. Task 38 — Bulk Import & Export Hiện vật (Đã hoàn thành - PR #194)
- [x] **38.1** Đặc tả định dạng tệp JSON và CSV (RFC 4180), ma trận kiểm tra hợp lệ từng dòng.
- [x] **38.2** Backend Endpoint `GET /api/admin/exhibits/export?format=json|csv`.
- [x] **38.3** Backend Endpoint `POST /api/admin/exhibits/import` hỗ trợ Partial Import, bọc transaction và ghi nhận `@Audit`.
- [x] **38.4** Kiểm thử Backend: kiểm tra tính hợp lệ dữ liệu, bắt lỗi định dạng và giới hạn dung lượng tệp 5 MB.
- [x] **38.5** Frontend UI: Nút xuất kho CSV/JSON và Modal nhập hiện vật với giao diện xem trước lỗi theo từng dòng.
- [x] **38.6** Hoàn thiện tài liệu OpenAPI/Swagger và mở **PR #194** vào nhánh `dev`.

---

### D. Các việc phụ trợ & Bảo trì

- [ ] **D.1** Chạy migration `1792150000000-WidenHotspotLabel` (nới rộng `hotspots.label` → `text`) trên cơ sở dữ liệu Supabase staging/production.
- [ ] **D.2** Cập nhật tài liệu BT3 (PR #133 đã merge ngày 05/11/2026).
- [ ] **D.3** Điền siêu dữ liệu bản quyền (Author, Source, License) cho 5 hiện vật mẫu ban đầu trên giao diện CMS Media.
- [ ] **D.4** Thông báo trưởng nhóm cập nhật bảng theo dõi Google Sheets cho Task 39.
