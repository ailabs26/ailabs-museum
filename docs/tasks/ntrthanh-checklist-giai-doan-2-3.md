# Checklist việc còn lại — Nguyễn Trọng Thành (Giai đoạn 2–3)

Ngày lập: 13/11/2026 · Nguồn phân công: [`docs/architecture/fe/tasks-and-validation.md`](../architecture/fe/tasks-and-validation.md)

## Tổng quan

| Task | Nội dung | Giai đoạn / hạn | Trạng thái 13/11 |
|---|---|---|---|
| 6–10 | Rooms, Exhibit form, Media upload, gắn media, Preview | GĐ 1 | Xong (đã merge `dev`) |
| 28 | Fuzz upload (AC-33) | GĐ 2 · 20/11 | Một phần: có 52 test magic bytes (`media-signature.spec.ts`), chưa có fuzz HTTP + bằng chứng |
| 29 | k6 API 100–200 CCU, p95 ≤ 500 ms, lỗi < 1% (AC-49) | GĐ 2 · 20/11 | Chưa bắt đầu |
| 38 | Bulk import/export JSON/CSV | GĐ 3 · 21/11–08/12 | Chưa có (chỉ có `GET audit/export`) |
| 39 | i18n nội dung đa ngôn ngữ, fallback vi | GĐ 3 | Đã xong — PR #163/#164/#165 (nguyenthangdev); cần cập nhật sheet |

Thứ tự gợi ý: **29.1–29.7** (2 ngày) → **28.1–28.5** (2 ngày) → đo + báo cáo (29.10–12, 28.7–9) trước 20/11. Mục C làm xen kẽ khi chờ k6 chạy.

---

## A. Task 29 — k6 tải API (hạn 20/11)

**Chuẩn bị**
- [ ] **29.1** Tạo nhánh `feat/k6-api-load` từ `dev`.
- [ ] **29.2** Viết spec `docs/tasks/be/k6-api-load.md`: mục tiêu AC-49 (p95 ≤ 500 ms, lỗi < 1%), danh sách endpoint, cấu hình máy/DB, commit hash.
- [ ] **29.3** Môi trường đo riêng: Postgres local (Docker) → `npm run migration:run` → `npm run seed` → chạy `node dist/main.js` ở cổng khác 3001. **Không** đo trên Supabase dùng chung, không tắt dev server.
- [ ] **29.4** Cài k6 (binary), ghi phiên bản vào spec.

**Script** (`back-end/load/k6/`)
- [ ] **29.5** `config.js`: base URL từ env; thresholds `http_req_duration: ['p(95)<500']`, `http_req_failed: ['rate<0.01']`.
- [ ] **29.6** Kịch bản khách xem (mix có trọng số):
  - `GET /api/public/rooms`, `GET /api/public/rooms/:slug`
  - danh sách / chi tiết / tìm kiếm hiện vật (có `locale`)
  - `GET /api/public/exhibits/:id/location`
- [ ] **29.7** Stages: smoke 5 VU → 100 VU → 200 VU (ramp-up + giữ 3–5 phút mỗi mức).
- [ ] **29.8** *(tùy chọn)* Kịch bản admin đọc: login lấy JWT → `GET /api/admin/media` (VU thấp).
- [ ] **29.9** Thêm npm script `load:k6` + README lệnh chạy.

**Đo & báo cáo**
- [ ] **29.10** Chạy baseline, lưu summary/JSON vào `docs/tasks/be/evidence/k6/`.
- [ ] **29.11** Nếu trượt ngưỡng: tìm endpoint chậm (EXPLAIN, index, N+1), ghi lại; sửa ở commit riêng.
- [ ] **29.12** Báo cáo: bảng p50/p95/p99 + error rate theo endpoint ở 100 và 200 VU; baseline vs sau tối ưu; kết luận đạt/không đạt + giới hạn đo.
- [ ] **29.13** PR vào `dev`.

---

## B. Task 28 — Fuzz upload (hạn 20/11)

- [ ] **28.1** Nhánh `test/media-upload-fuzz` + spec `docs/tasks/be/media-upload-fuzz.md` (AC-33), liệt kê nhóm đầu vào.
- [ ] **28.2** Bộ sinh dữ liệu fuzz có seed cố định (tái lập được):
  - đột biến byte trên file hợp lệ (PNG/JPEG/WebP/GLB/MP3/VTT);
  - lệch đuôi ↔ MIME ↔ nội dung (`.png` chứa `.exe`);
  - polyglot (PNG + HTML/JS);
  - file rỗng, 1 byte, đúng giới hạn, giới hạn + 1 byte;
  - tên file độc: `../`, null byte, rất dài, Unicode.
- [ ] **28.3** HTTP fuzz `POST /api/admin/media/upload`: mọi đầu vào xấu → 4xx (không 5xx), không tạo bản ghi media, không để file rác trong storage.
- [ ] **28.4** Cùng bộ đầu vào cho `POST /api/admin/media/upload-jobs`: job `failed` đúng `errorCode`, không có `mediaId`.
- [ ] **28.5** Ca giữ media cũ: hiện vật đang có media A, upload thay bằng file xấu bị từ chối → hiện vật vẫn trỏ A.
- [ ] **28.6** GLB/VTT ở mức cấu trúc: header GLB đúng nhưng chunk hỏng; VTT chứa `<script>` → bị từ chối hoặc được làm sạch.
- [ ] **28.7** npm script `test:fuzz` (N vòng), lưu log vào `evidence/`.
- [ ] **28.8** Lỗi phát hiện được → sửa ở commit riêng + thêm test hồi quy.
- [ ] **28.9** Báo cáo (số ca, nhóm, kết quả, lỗi đã sửa) + PR.

---

## C. Việc tồn đọng (15–30 phút mỗi việc)

- [ ] **C.1** Quyết định chạy migration `1792150000000-WidenHotspotLabel` (hotspots.label → `text`) trên Supabase dùng chung; kiểm tra bảng `migrations` trước.
- [ ] **C.2** Sửa dòng 5 [`docs/bt3-23001934/README.md`](../bt3-23001934/README.md): "chưa merge" → đã merge PR #133 ngày 05/11/2026.
- [ ] **C.3** Cập nhật báo cáo BT3 (docx/pdf): thêm AC6–AC9, số test mới (upload-jobs 78/78, backend 2166/2166), trạng thái merge (ghi rõ review cuối của reviewer vẫn là CHANGES_REQUESTED).
- [ ] **C.4** Nit: JSDoc `deleteFinishedBefore` đặt nhầm phía trên `linkMedia` trong `media-upload-job.repository.ts`.
- [ ] **C.5** Điền bản quyền media cho 5 hiện vật seed đã xuất bản (trang Media CMS) để khách thấy ghi công.
- [ ] **C.6** Báo nhóm cập nhật sheet: Task 39 đã xong.
- [ ] **C.7** *(tùy chọn)* Review PR #186 (Draco/LOD/WebP, CI xanh, chưa có reviewer).

---

## D. Task 38 — Bulk import/export JSON/CSV (GĐ 3, sau 21/11)

- [ ] **38.1** Spec: định dạng file, cột/trường, validate theo dòng, phân biệt thành công một phần.
- [ ] **38.2** BE: `GET /api/admin/exhibits/export?format=json|csv`.
- [ ] **38.3** BE: `POST /api/admin/exhibits/import` có dry-run, báo lỗi theo dòng, transaction, `@Audit`.
- [ ] **38.4** Test BE: hợp lệ, lỗi một phần, sai định dạng, file quá lớn.
- [ ] **38.5** FE: trang import (chọn file → xem trước kết quả → xác nhận) + nút export.
- [ ] **38.6** Doc + PR.
