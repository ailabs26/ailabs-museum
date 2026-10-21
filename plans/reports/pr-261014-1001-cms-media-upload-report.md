# feat(be): CMS media upload pipeline (Task 8)

**Base:** `dev` ← **Compare:** `feat/cms-media-upload` · 10 commit · 39 file (+4367 / −11)
**Tạo PR:** https://github.com/ailabs26/ailabs-museum/compare/dev...feat/cms-media-upload

## Tóm tắt

Admin upload và quản lý model 3D, hình ảnh, audio guide và phụ đề cho CMS (FR-55–57). Backend kiểm tra **nội dung thực tế** của file (magic bytes + parse cấu trúc), không tin `Content-Type` hay đuôi file từ client (NFR-19). Có lưu metadata quyền sử dụng (FR-97) và chặn xóa media mà exhibit đã xuất bản đang dùng (BR-21).

> ⚠️ **PR có sửa một file dùng chung ngoài module media:** `audit.interceptor.ts` (commit `a1857a1`). Xem mục [Sửa lỗi audit](#sửa-lỗi-audit-có-sẵn-commit-a1857a1).

## API mới — `/api/admin/media` (quyền `media:upload`)

| Method | Route | Mô tả | Audit |
|---|---|---|---|
| `GET` | `/admin/media` | Danh sách, lọc `kind`/`state`, tìm `q` theo tên file + metadata, phân trang | — |
| `GET` | `/admin/media/:id` | Chi tiết | — |
| `POST` | `/admin/media/upload` | `multipart/form-data`: `file` + tùy chọn `kind`, `altText`, `source`, `author`, `license` | `media.upload` |
| `PATCH` | `/admin/media/:id` | Sửa metadata (không thay file) | `media.update` |
| `DELETE` | `/admin/media/:id` | Xóa mềm; 409 nếu đang được dùng | `media.delete` |

**Mã lỗi** (`errors[0].code`, `field: "file"`): `media_file_required` (400) · `media_empty_file`, `media_unsupported_type`, `media_markup_rejected`, `media_corrupted`, `media_external_resource`, `media_kind_mismatch`, `media_quarantined` (422) · `media_too_large` (413).

## Pipeline upload

```
multer (trần 10 MB + 1 byte) → nhận diện magic bytes → khớp kind (nếu gửi)
  → giới hạn theo định dạng thực tế (413) → parse/decode (422)
  → lưu file (key UUID, không ghi đè) → tạo bản ghi → 201
```

| Định dạng | Giới hạn | Kiểm tra cấu trúc |
|---|---|---|
| GLB | ≤ 10 MB | glTF 2.0, độ dài header, JSON parse được, bounds của buffer/bufferView, **chỉ chấp nhận tài nguyên nhúng** |
| JPEG / PNG / WebP | ≤ 2 MB, ≤ 8192 px/cạnh | JPEG: segment, SOF/SOS/EOI · PNG: CRC, chunk, giải nén IDAT · WebP: RIFF, VP8/VP8L/VP8X |
| MP3 | ≤ 10 MB | ID3v2, ≥ 3 khung Layer III liên tiếp |
| WebVTT | ≤ 1 MB | UTF-8, timestamp hợp lệ, kết thúc > bắt đầu, cue tăng dần |

MB = 1.000.000 byte theo SRS.

## Bảo mật

- Từ chối SVG/HTML/XML/PHP/JS và mọi định dạng ngoài danh sách, kể cả khi đổi tên hoặc khai báo `image/png`.
- File bị từ chối **không được lưu** (không có bản ghi, không có file trên đĩa).
- Lỗi phân tích không rõ nguyên nhân → `processing_state = quarantined`, file lưu ở `storage/quarantine/` (**ngoài thư mục public**, không có URL).
- Client không thể gửi `url`/`storageKey`/`mimeType` để bypass pipeline (whitelist DTO → 400).
- `/media` phục vụ với `X-Content-Type-Options: nosniff`, tắt index và dotfile.
- Storage key do server sinh, ghi file với cờ `wx` (không bao giờ ghi đè), chặn path traversal.
- Chống decompression bomb: giới hạn kích thước ảnh và dung lượng giải nén của PNG.

## BR-21 — xóa media

Chạy trong transaction có khóa dòng (`SELECT … FOR UPDATE`). Trả **409** nếu media nằm trong:
- revision **đang published** của exhibit chưa xóa (kể cả exhibit đang ẩn), hoặc
- revision **`in_review`** (để moderator không duyệt nội dung bị hỏng).

Nếu không bị chặn: xóa mềm, sau đó dọn file sau khi commit. `PATCH` chỉ sửa metadata, không bao giờ thay file.

## Database — migration `1791948600000-ExtendMediaUploadPipeline`

- Thêm `media.author varchar(200)`, `media.original_name varchar(255)`, `media.created_at timestamptz default now()`.
- `CHK_media_kind` thêm `subtitle` · `CHK_media_state` thêm `quarantined`.
- Dùng `processing_state` có sẵn thay cho cột `status` đề xuất trong plan, để tránh hai cột trạng thái chồng nhau.
- Đã kiểm tra trên PostgreSQL 16: up → `migration:generate` không thấy drift → down/up. `down` chuyển `quarantined` → `failed` và **từ chối** nếu còn bản ghi `subtitle` (tránh mất dữ liệu âm thầm).

## Sửa lỗi audit có sẵn (commit `a1857a1`)

`AuditInterceptor` đăng ký qua `APP_INTERCEPTOR`, nên Nest đặt nó **bên ngoài** `ResponseInterceptor` (đăng ký trong `main.ts`). Vì vậy nó nhận response đã bọc `{ success, data, message }` và không tìm thấy `id`:
- Các route tạo mới không có `:id` — **`room.create`, `user.create`, `role.create`, `exhibit.create`** — **không được ghi audit** trên production.
- Route gán role ghi id của user thay vì từng roleId.

Cách sửa: bóc envelope trước khi lấy id (+13/−1 dòng). Có test chạy interceptor trong app Nest thật theo đúng thứ tự đăng ký như production; test đỏ trước khi sửa và xanh sau khi sửa. Đã kiểm tra trên app thật: `room.create` giờ có bản ghi audit. Commit này tách riêng để review hoặc revert độc lập.

## Kiểm thử

| Loại | Kết quả |
|---|---|
| `npm run typecheck` / `lint` / `build` | ✅ Đạt |
| `npm test` (đã thêm media vào script) | ✅ 898/898 |
| `npm run test:exhibits` · `test:seed` | ✅ 485/485 · 6/6 |
| `npm run test:media` — định dạng, validator, storage, DTO, service, HTTP multipart thật | ✅ 424/424 |
| Integration repository trên PostgreSQL 16 (Docker) | ✅ 29/29 |
| Fuzz validator: cắt cụt ở mọi độ dài + 2000 lần lật byte cho mỗi mẫu | ✅ chỉ ném lỗi đã kiểm soát |
| Mutation test service (cài 4 lỗi) | ✅ bắt được 4/4 |
| 32 file thật (ImageMagick, ffmpeg, mẫu Khronos glTF như Avocado 8,1 MB) | ✅ không từ chối nhầm file nào |
| E2E: bản build production + PostgreSQL + JWT thật, upload bằng `curl` | ✅ 59/59 |

Test phát hiện thêm một lỗi biên đã được sửa: busboy coi file dài **đúng bằng** `fileSize` là vượt giới hạn, nên file đúng 10 MB từng bị 413. Đã đặt trần multer = 10 MB + 1 byte.

### Điều kiện nghiệm thu (plan Task 8)

- [x] Upload `.glb` hợp lệ ≤ 10 MB → `201` và trả về `mediaId`
- [x] Upload `.png` hợp lệ ≤ 2 MB → `201`
- [x] Upload `.mp3` hợp lệ ≤ 10 MB → `201`
- [x] Upload `.exe` đổi tên thành `.glb` → `422`
- [x] Upload SVG → `422` (kể cả khi khai báo `image/png`)
- [x] Upload `.glb` > 10 MB → `413`
- [x] Upload `.png` > 2 MB → `413`
- [x] Upload `.glb` hỏng (magic bytes đúng, nội dung lỗi) → `422`
- [x] `DELETE` media đang được Published exhibit dùng → `409`
- [x] `DELETE` media không được dùng → `200`

## Cách test thử cho reviewer

```bash
cd back-end
npm install && npm run typecheck && npm run lint && npm test

# Integration với PostgreSQL cục bộ (chỉ nhận URL localhost — không chạy trên Supabase)
docker run -d --name media-testdb -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=t -p 127.0.0.1:55432:5432 postgres:16-alpine
MEDIA_TEST_DATABASE_URL=postgresql://postgres:pw@127.0.0.1:55432/t npm run test:media
```

Kiểm tra thủ công qua Swagger `/api/docs` → **Admin · Media** → `POST /admin/media/upload`.

## Lưu ý cho reviewer

- **Quyền:** cả 5 route dùng `media:upload` vì bộ quyền chưa có `media:read`/`media:delete`. Hệ quả là Moderator chưa xem được thư viện media. Nếu muốn tách quyền, nên làm ở PR riêng (cần seed lại).
- **"Decode được"** nghĩa là parse cấu trúc, không giải mã toàn bộ pixel/âm thanh (trừ PNG có giải nén IDAT). MP3/VTT bị cắt đúng ranh giới khung/cue vẫn là file hợp lệ theo bản chất định dạng.
- **Race publish ↔ delete:** luồng publish của moderation không khóa dòng media, nên vẫn có một cửa sổ rất nhỏ khi publish và xóa xảy ra đồng thời.
- **Ngoài phạm vi (Task 9):** gắn media vào revision, kiểm tra media `ready`/chưa xóa khi attach, API public. Lưu trữ hiện là đĩa cục bộ; Supabase Storage để làm sau.
- Fixture test được sinh bằng code (`media-test-files.ts`), không commit file nhị phân.

## Triển khai

1. Người phụ trách database chạy `npm run migration:run` (migration chỉ thêm cột và nới CHECK, không khóa bảng lâu).
2. Thư mục runtime `public/media/uploads/` và `storage/` đã nằm trong `.gitignore`. Server cần có quyền ghi vào hai thư mục này.
