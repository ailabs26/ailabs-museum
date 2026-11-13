# Task 8: CMS media + upload pipeline

Nhánh: `feat/cms-media-upload` (từ `dev`). SRS: FR-55–57, FR-90, FR-91, FR-97, NFR-19, BR-21.

## Đã làm

- **API** (`/api/admin/media`, quyền `media:upload`): `GET /`, `GET /:id`, `POST /upload` (multipart, field `file`), `PATCH /:id`, `DELETE /:id`. Upload/sửa/xóa có audit `media.upload|update|delete`.
- **Pipeline upload:** nhận diện định dạng từ magic bytes → khớp `kind` (nếu gửi) → giới hạn dung lượng theo định dạng thực tế (413) → parse/decode (422) → lưu file → tạo bản ghi. Không dùng `Content-Type`/đuôi file của client. Thiếu file → 400.
- **Giới hạn (MB = 1.000.000 byte):** GLB ≤ 10 MB, JPEG/PNG/WebP ≤ 2 MB, MP3 ≤ 10 MB, WebVTT ≤ 1 MB. Ảnh tối đa 8192 px mỗi cạnh (chống decompression bomb).
- **Kiểm tra cấu trúc:** PNG (CRC, chunk, giải nén IDAT), JPEG (segment, SOF/SOS/EOI), WebP (RIFF, VP8/VP8L/VP8X), MP3 (ID3v2, ≥ 3 khung Layer III liên tiếp), GLB (glTF 2.0, JSON, bounds, **chỉ chấp nhận tài nguyên nhúng**), WebVTT (UTF-8, timestamp, cue tăng dần).
- **Bảo mật:** từ chối SVG/HTML/XML/PHP/JS và mọi định dạng ngoài danh sách; file bị từ chối không được lưu. Lỗi phân tích không rõ nguyên nhân → `quarantined`, file lưu ở `storage/quarantine/` (ngoài thư mục public, không có URL). DTO không có `url`/`storageKey` nên client không thể bypass pipeline (400). `/media` phục vụ với `nosniff`, tắt index/dotfile.
- **Storage:** key do server sinh `uploads/<kind>/<uuid>.<ext>`, ghi với cờ `wx` → không bao giờ ghi đè. DB lỗi sau khi ghi file → dọn file.
- **BR-21:** xóa trong transaction có khóa dòng; 409 nếu media nằm trong revision đang published của exhibit chưa xóa, hoặc trong revision `in_review`. Xóa mềm rồi dọn file sau commit. `PATCH` chỉ sửa metadata, không thay file.
- **Schema:** migration `1791948600000-ExtendMediaUploadPipeline` thêm `author`, `original_name`, `created_at`; kind `subtitle`; state `quarantined`. Dùng `processing_state` có sẵn thay cho cột `status` trong plan.
- **Sửa lỗi chung (`fix(audit)`):** `AuditInterceptor` nhận response đã bọc `ApiResponse` nên các route tạo mới không có `:id` (`room/user/role/exhibit.create`) không được ghi audit, và gán role ghi sai id. Đã bóc envelope trước khi lấy id.

## Kiểm chứng ngày 14/10/2026

- `npm run typecheck`, `npm run lint`, `npm run build`: đạt. `npm test`: 898/898; `npm run test:exhibits`: 485/485.
- `npm run test:media`: 424 test (định dạng, validator + fuzz cắt cụt/lật byte, storage, DTO, service, HTTP multipart thật với guard/audit/pipe thật). Mutation test: 4/4 lỗi cài vào bị phát hiện.
- Integration repository trên PostgreSQL 16 (Docker): 29/29 — chạy bằng `MEDIA_TEST_DATABASE_URL=postgresql://...@localhost:.../db npm run test:media` (chỉ nhận DB localhost).
- Migration: up → không drift entity → down/up; down từ chối khi còn bản ghi `subtitle`.
- 32 file thật (ImageMagick, ffmpeg, mẫu Khronos glTF) đều hợp lệ, không từ chối nhầm.
- E2E trên bản build + PostgreSQL + JWT thật: 59/59, gồm toàn bộ điều kiện nghiệm thu của plan.

## Giới hạn & việc sau

- Kiểm tra "decode được" là parse cấu trúc, không giải mã toàn bộ pixel/âm thanh (trừ PNG giải nén IDAT). MP3/WebVTT bị cắt đúng ranh giới khung/cue vẫn là file hợp lệ.
- Mọi route dùng `media:upload` vì bộ quyền chưa có `media:read`/`media:delete`; Moderator chưa xem được thư viện media.
- Chưa khóa chéo với luồng publish của moderation: publish đồng thời với xóa có thể lọt (cửa sổ rất nhỏ).
- Gắn media vào revision và kiểm tra media `ready`/chưa xóa khi attach thuộc Task 9. Lưu trữ cục bộ; Supabase Storage là việc sau.
- Trước khi deploy: người phụ trách database chạy `npm run migration:run`.

## Cập nhật sau (20/10/2026)

- **Khóa chéo publish ↔ xóa media:** đã đóng ở Task 9 (`RevisionPublishGate` kiểm lại tham chiếu media, khóa `FOR SHARE`) — xem [cms-media-attach.md](cms-media-attach.md).
- **Lưu trữ:** `/media` không còn dùng `express.static` (Task 9: route phân phối có kiểm tra published/URL ký). File lưu qua driver `local` (đĩa, như trên) hoặc `supabase` (Supabase Storage, bucket private) chọn bằng `MEDIA_STORAGE_DRIVER` — xem [supabase-db-storage.md](supabase-db-storage.md). Luật key do server sinh và không ghi đè (BR-21) giữ nguyên ở cả hai driver.
