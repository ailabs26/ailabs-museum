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

## 4. Phân phối tệp an toàn (`MediaDeliveryController`)

Route `GET /media/uploads/:directory/:fileName` nằm **ngoài tiền tố `/api`** (cấu hình loại trừ trong `main.ts`), gắn `@Public()` + `@UseGuards(PublicRateLimitGuard)` với `@PublicRateBucketOf('media')` (3000 req/phút/IP).

1. **Quyền truy cập tệp (`MediaDeliveryService.resolve`)**: chỉ trả tệp khi thỏa **một trong hai** điều kiện:
   - Được một `ExhibitRevision` đang công khai hiện hành (`published_revision_id` của hiện vật visible trong phòng active) tham chiếu; HOẶC
   - Có cặp query `?exp=<unix>&sig=<hmac>` hợp lệ được ký bằng `MEDIA_URL_SIGNING_SECRET` (`MediaUrlService`, hạn `MEDIA_SIGNED_URL_TTL_SECONDS = 900s`) cho chế độ Preview CMS.
   - Mọi trường hợp khác trả `404` thống nhất để tránh lộ sự tồn tại của tệp nháp.
2. **Header bảo mật & cache**:
   - `Content-Type` lấy từ DB (riêng `subtitle` ép `text/vtt; charset=utf-8`), `Content-Disposition: inline`.
   - `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: cross-origin`.
   - `ETag: "<checksumSha256>"`: trả `304 Not Modified` khi khớp `If-None-Match`.
   - `Cache-Control: no-cache` (public) để Hide/Unpublish có hiệu lực ngay ở request kế tiếp (BR-22, AC-51); `private, no-store` cho URL ký xem trước.
3. **Hỗ trợ `HEAD` và HTTP `Range` (`206 Partial Content`)**: phục vụ tua audio MP3 và tải GLB; dùng `node:stream.pipeline` và hủy stream nguồn nếu client đóng kết nối sớm để tránh unhandled upstream error từ Supabase.

## 5. Cron dọn media mồ côi (`MediaCleanupService`)

Chạy tự động lúc **03:30 hằng ngày** (`@Cron('30 3 * * *', { name: 'media-orphan-cleanup' })`), điều khiển bởi `MEDIA_ORPHAN_CLEANUP` (`off` | `dry-run` mặc định | `on`):
1. **Dọn thùng rác quá hạn**: xóa vĩnh viễn các bản ghi `media` đã xóa mềm quá `MEDIA_TRASH_RETENTION_DAYS` (mặc định 30 ngày) và không còn revision nào tham chiếu, ghi audit `media.purge` (`actorId: null`) rồi xóa file trên storage.
2. **Dọn file mồ côi trên storage**: xóa file khớp mẫu key do media quản lý nhưng không có bản ghi DB và cũ hơn 24 giờ (sót lại từ upload dở dang).
