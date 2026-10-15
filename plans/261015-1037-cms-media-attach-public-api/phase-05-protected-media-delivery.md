---
phase: 5
title: "Phân phối file media có bảo vệ"
status: completed
priority: P1
effort: "6h"
dependencies: [4]
---

# Phase 5: Phân phối file media có bảo vệ (thay `express.static`)

## Overview
File media chỉ được tải khi (a) được **ít nhất một revision Published hiện hành** của exhibit còn public tham chiếu, hoặc (b) URL có chữ ký HMAC hợp lệ còn hạn (Preview admin). Sửa G3 — đây là phần "BE bảo vệ media" của task.

## Requirements
- Route `GET /media/uploads/:kind/:file` (ngoài prefix `/api`, giữ URL cũ để không phá dữ liệu) — đăng ký bằng `app.use`/controller với `@Public()`; xác định cách loại trừ global prefix (`setGlobalPrefix('api', { exclude: [...] })`) hoặc mount express handler gọi service qua `app.get(MediaDeliveryService)`.
- Kiểm tra key bằng regex chặt **trước** khi chạm DB/đĩa: `^uploads/(model|image|audio|subtitle)/[0-9a-f-]{36}\.(glb|jpg|png|webp|mp3|vtt)$` → sai = 404.
- Quy tắc truy cập:
  | Trường hợp | Kết quả |
  |---|---|
  | Media không tồn tại / is_deleted / không ready | 404 |
  | Được published revision hiện hành (exhibit visible, !deleted, !archived, room active) tham chiếu ở bất kỳ slot nào | 200 |
  | Chỉ thuộc Draft/In Review/Rejected/revision lịch sử | 404 (không 403 — không lộ sự tồn tại) |
  | `?exp=<unix>&sig=<hex>` hợp lệ, `exp` chưa qua, `exp - now ≤ TTL` | 200 (header `Cache-Control: private, no-store`) |
  | Chữ ký sai/hết hạn/thiếu một tham số | 404 |
  | Đường dẫn quarantine / traversal (`..`, `%2e%2e`, `\`) | 404 |
- Header phản hồi: `Content-Type` = `media.mime_type` từ DB (VTT: `text/vtt; charset=utf-8`), `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: cross-origin`, `ETag: "<checksum_sha256>"`, `Cache-Control: no-cache` (D4), `Accept-Ranges: bytes`.
- Hỗ trợ `Range` (seek audio — AC-39) và `If-None-Match` → 304; `HEAD`.
- CORS: route media phải trả `Access-Control-Allow-Origin` cho `app.frontendOrigin` (GLTFLoader dùng fetch) — xác minh `enableCors` có áp lên handler này.

## Architecture
```
MediaDeliveryService.resolve(key, query): Promise<{ absPath, media } | null>
  1. regex key
  2. media = repo.findDeliverableByKey(key)            // !deleted, ready
  3. if signed(query): verifySignature(key, exp, sig) (timingSafeEqual) → ok
     else repo.isPubliclyReferenced(media.id)         // EXISTS(...) dùng REVISION_MEDIA_SLOTS
  4. absPath = storage.resolvePublicPath(key)         // realpath nằm trong publicRoot
Handler: res.sendFile(absPath, { headers, etag:false(tự set), lastModified:false, acceptRanges:true, dotfiles:'deny' })
```
```sql
SELECT 1 FROM exhibits e
JOIN exhibit_revisions r ON r.id = e.published_revision_id AND r.state = 'approved'
JOIN rooms ro ON ro.id = e.room_id AND ro.status = 'active' AND ro.is_deleted = false
WHERE e.visibility = 'visible' AND e.is_deleted = false AND e.archived_at IS NULL
  AND (r.model_media_id = $1 OR r.image_media_id = $1 OR r.audio_media_id = $1
       OR r.audio_en_media_id = $1 OR r.subtitle_vi_media_id = $1 OR r.subtitle_en_media_id = $1)
LIMIT 1;
```
- Chữ ký: `sig = HMAC_SHA256(secret, `${key}\n${exp}`)` hex; `MediaUrlSigner` (`sign(key) → url`, `verify`) trong `media/services/media-url-signer.ts`. Secret từ `media.urlSigningSecret`.
- Điều kiện công khai **phải trùng** với lọc Phase 4 → tách thành một "spec" dùng chung (`publicExhibitScope(qb)`) để hai nơi không lệch nhau.
- Xóa `app.use(PUBLIC_MEDIA_URL_PREFIX, expressStatic(...))` trong `main.ts`.

## Related Code Files
- Create: `media/services/media-delivery.service.ts`, `media/services/media-url-signer.ts`, `media/controllers/media-delivery.controller.ts` (hoặc handler express trong `main.ts` gọi service)
- Create: `exhibits/repositories/public-exhibit.scope.ts` (spec dùng chung Phase 4/5)
- Modify: `main.ts`, `media/repositories/media.repository.ts` (`findDeliverableByKey`, `isPubliclyReferenced`), `media/services/media-storage.service.ts` (`resolvePublicPath` + kiểm realpath), config/env

## Implementation Steps
1. Test đỏ nhóm M-* (HTTP thật bằng app Nest + supertest/fetch như `admin-media-http.spec.ts`).
2. Signer + test (vector cố định, hết hạn, đổi 1 ký tự, độ dài sig khác → không throw từ `timingSafeEqual`).
3. Repository queries + integration PG.
4. Delivery service + handler; xóa static.
5. Kiểm thủ công: `curl -I`, `curl -H 'Range: bytes=0-99'`, `curl -H 'If-None-Match: "<sha>"'`, tải GLB trong FE tour cross-origin.
6. Đo: 200 request tuần tự tới 1 file public → p95 < 20 ms local (ghi PR; phục vụ Task 29).

## Success Criteria
- [ ] Media chỉ thuộc Draft → 404 public, 200 với URL ký (AC-36).
- [ ] Unpublish/Hide exhibit → file 404 ở request kế tiếp (AC-51), media dùng chung với exhibit khác còn public → vẫn 200.
- [ ] Range 206, 304 với ETag, Content-Type lấy từ DB, nosniff + CSP có mặt.
- [ ] Không còn `express.static` cho uploads.

## Risk Assessment
- Thêm 1 query mỗi lần tải file: có index Phase 1; file lớn chỉ tải một lần nhờ ETag/304.
- Rò rỉ secret → xoay vòng secret làm mọi URL preview hết hiệu lực (chấp nhận, TTL 15').
- Nếu sau này chuyển Supabase Storage: giữ interface `MediaDeliveryService` để thay backend lưu trữ.
