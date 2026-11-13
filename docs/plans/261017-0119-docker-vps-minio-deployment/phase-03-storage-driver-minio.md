# Phase 3 — StorageDriver + MinIO

Phase duy nhất đổi code nghiệp vụ. Giữ nguyên: `storageKey`, entity `Media`, `MediaUrlService` (HMAC), logic kiểm tra "được revision public tham chiếu" trong `MediaDeliveryService`, header bảo mật và `ETag` của Task 9.

## File
- `back-end/src/modules/media/storage/storage-driver.ts` (mới) — interface + token DI
- `back-end/src/modules/media/storage/local-storage.driver.ts` (mới) — chuyển code fs hiện có sang
- `back-end/src/modules/media/storage/s3-storage.driver.ts` (mới) — `@aws-sdk/client-s3`
- `back-end/src/modules/media/services/media-storage.service.ts` — ủy quyền cho driver, giữ `createKey()`/`resolvePath`-validation key
- `back-end/src/modules/media/services/media-delivery.service.ts`, `controllers/media-delivery.controller.ts` — bỏ `sendFile`, dùng stream
- `back-end/src/config/media.config.ts`, `env.validation.ts`, `.env.example` — biến mới
- `back-end/src/modules/media/media.module.ts` — provider chọn driver theo env
- Test trong `back-end/src/modules/media/tests/`

## Interface (tối thiểu, chỉ những gì code đang dùng)
```ts
interface StorageDriver {
  put(key: string, body: Buffer | Readable, contentType: string): Promise<void>; // lỗi nếu key đã tồn tại (BR-21)
  get(key: string, range?: { start: number; end?: number }): Promise<{ stream: Readable; size: number }>;
  exists(key: string): Promise<boolean>;
  move(fromKey: string, toKey: string): Promise<void>; // quarantine → uploads
  delete(key: string): Promise<void>;
}
```
Rà toàn bộ chỗ dùng `MediaStorageService` hiện tại để xác nhận đủ/thừa method trước khi chốt.

## S3 driver với MinIO
- `S3Client({ endpoint: 'http://minio:9000', region: 'us-east-1', forcePathStyle: true, credentials })`.
- `put` không ghi đè: `PutObject` với header `If-None-Match: *` (MinIO hỗ trợ conditional write) — nếu bản MinIO đang dùng không hỗ trợ thì `HeadObject` trước + chấp nhận race rất hẹp (key là UUID).
- `move` = `CopyObject` + `DeleteObject`.
- `get` có `Range` → trả 206 + `Content-Range` trong controller (GLTFLoader/audio seek cần).
- Upload vẫn qua API (multer memory, ≤ 20 MB) → validator GLB chạy trên buffer như hiện tại → `put` vào `quarantine/` → kiểm tra xong `move` sang `uploads/`.

## Env mới
```
MEDIA_STORAGE_DRIVER=local        # local | s3
MEDIA_S3_ENDPOINT=http://minio:9000
MEDIA_S3_REGION=us-east-1
MEDIA_S3_BUCKET=aura-media
MEDIA_S3_ACCESS_KEY=
MEDIA_S3_SECRET_KEY=
```
`env.validation.ts`: các biến `MEDIA_S3_*` bắt buộc khi driver = `s3`.

## Đồng bộ giới hạn GLB
Code `maxBytes` 10 MB (`media-formats.ts`) ≠ SRS 20 MB (`01-system-overview.md:34`). Chốt 1 con số, đặt `client_max_body_size` Nginx lớn hơn một chút (vd 25m).

## Di chuyển dữ liệu cũ (D5)
`mc mirror ./public/media/uploads local/aura-media/uploads` — key không đổi nên DB không cần sửa. Đối chiếu `checksumSha256` trên vài file mẫu.

## Test
- Unit: `LocalStorageDriver` + `S3StorageDriver` (mock `S3Client`) cùng 1 bộ contract test.
- Integration: chạy MinIO thật bằng `docker run minio/minio` khi test local (tùy chọn, không chặn CI).
- Hồi quy: toàn bộ `media-delivery-http.spec.ts`, `media-url.spec.ts` phải xanh với driver local; thêm case Range 206, object không tồn tại → 404 đồng nhất (không lộ tồn tại).

## Tiêu chí xong
- Dev chạy với `local` như cũ; đổi env sang `s3` + MinIO local → upload, preview signed URL, xem public, unpublish → 404 ngay (AC-51) đều đúng.
- `npm run typecheck && npm run lint && npm test` xanh.
