# 08 — Pipeline Media, Phân phối tệp và Hàng đợi Upload bất đồng bộ (`modules/media/`)

> Mã nguồn: `back-end/src/modules/media/` (`controllers/`, `entities/`, `services/`, `storage/`, `inspection/`, `repositories/`, `dto/`).

`MediaModule` chịu trách nhiệm toàn bộ vòng đời tài nguyên nhị phân (model 3D GLB, ảnh, audio MP3, phụ đề WebVTT): kiểm tra an toàn byte thực tế khi upload, lưu trữ trừu tượng qua driver Local/Supabase, phân phối có kiểm soát quyền và xử lý upload bất đồng bộ.

## 1. Entity `Media` (`media`) và Các định dạng được phép

Bảng `media` lưu metadata đầy đủ: `kind` (`model` | `image` | `audio` | `subtitle`), `storage_key` (unique), `mime_type` (xác định từ nội dung thực tế), `size_bytes` (`bigint`), `checksum_sha256` (`char(64)`), `status` (`ready` / ...), `original_name`, `alt_text`, `rights`, `source_credit`, `license`, `created_by`, `is_deleted`, `deleted_at`.

### Kiểm tra byte thực tế (`MediaInspectionService` — NFR-19)
Backend **không bao giờ tin** `Content-Type` hay phần mở rộng tên file client gửi lên. Mọi buffer tải lên phải qua 2 bước `identify()` (magic bytes) và `validateStructure()` (parse/decode cấu trúc):

| Định dạng (`MediaFormat`) | `MediaKind` | MIME chuẩn lưu DB | Giới hạn kích thước (1 MB = 1.000.000 B) |
|---|---|---|---|
| `glb` | `model` | `model/gltf-binary` | 10 MB |
| `jpeg` | `image` | `image/jpeg` | 2 MB |
| `png` | `image` | `image/png` | 2 MB |
| `webp` | `image` | `image/webp` | 2 MB |
| `mp3` | `audio` | `audio/mpeg` | 10 MB |
| `vtt` | `subtitle` | `text/vtt` | 1 MB |

- **Chống XSS / polyglot**: hàm `looksLikeMarkup()` từ chối tuyệt đối SVG, HTML, XML hoặc script (`MARKUP_REJECTED`).
- **Chống decompression bomb**: ảnh bị giới hạn cạnh tối đa `MAX_IMAGE_DIMENSION = 8192` px và dung lượng điểm ảnh sau giải nén tối đa `MAX_DECODED_IMAGE_BYTES = 100 MB`.

## 2. Lớp trừu tượng lưu trữ (`storage/media-storage-driver.ts`)

`MediaStorageService` ủy quyền ghi/đọc/xóa/liệt kê file cho một trong 2 driver tùy biến môi trường `MEDIA_STORAGE_DRIVER`:
- **`LocalStorageDriver` (`local`)**: lưu file trên đĩa cục bộ (phù hợp phát triển local & kiểm thử).
- **`SupabaseStorageDriver` (`supabase`)**: kết nối bucket private `SUPABASE_STORAGE_BUCKET` (mặc định `museum-assets`) bằng `SUPABASE_SECRET_KEY` (hoặc legacy `SUPABASE_SERVICE_ROLE_KEY`). Toàn bộ secret chỉ nằm trên back-end, không bao giờ gửi xuống trình duyệt.

## 3. Endpoint quản trị Media (`AdminMediaController` — `/api/admin/media`)

Tất cả route quản trị đều yêu cầu quyền `media:upload`:
- `GET /api/admin/media`, `GET /api/admin/media/:id`, `GET /api/admin/media/:id/content`
- `POST /api/admin/media/upload` (`@Audit('media.upload')`)
- `PATCH /api/admin/media/:id` (`@Audit('media.update')` — cập nhật `altText`, `rights`, `license`…)
- `DELETE /api/admin/media/:id`, `POST /api/admin/media/bulk-delete` (`@Audit('media.delete')`) — chặn xóa nếu còn revision tham chiếu (BR-21, `DeletionBlockedException`).
- `POST /api/admin/media/bulk-restore` (`@Audit('media.restore')`).
