# 06 — Kiểm thử và nghiệm thu

> Hai lớp kiểm chứng: **test tự động** (không cần Supabase) và **E2E trên Supabase thật** (cần project,
> ghi dữ liệu thật — làm theo đúng quy trình dọn dẹp).

## 1. Test tự động

Chạy trong `back-end/`. Runner: `node --test` + `ts-node`.

| Lệnh | Phạm vi | Kết quả gần nhất |
|---|---|---|
| `npm run typecheck` / `npm run lint` / `npm run build` | Toàn BE | Đạt (20/10/2026) |
| `npm test` | Toàn bộ spec BE | **1559/1559** (20/10/2026, sau merge `dev`) |
| `npm run test:media` | Module media | **504/504** (không DB) |
| `npm run test:exhibits` | Exhibits + Task 9 | 568/568 |
| `npm run test:models` | Route GLB tour + `seed:models` | 10/10 |
| `npm run test:seed` | `seed:demo` | 6/6 |
| `npm run test:moderation` | Duyệt/xuất bản/ẩn | 20/20 (15/10) |

### Spec liên quan tới Supabase/phân phối
| File (`src/modules/media/tests/`) | Kiểm gì |
|---|---|
| `supabase-storage-driver.spec.ts` | Driver với `fetchFn` giả: URL/headers, `x-upsert: false`, 409 → `EEXIST` (HTTP và body), 404/`not_found` → `null`/bỏ qua, Range → 206 bắt buộc, timeout, encode key |
| `media-storage.spec.ts` | `SAFE_KEY`, chặn quarantine, path traversal, `wx` không ghi đè |
| `media-delivery-http.spec.ts` | HTTP thật: 200 + header, WebVTT, Range 206, 416, 304, HEAD, CORS, 404 thống nhất, đường dẫn độc hại, file mất, URL ký |
| `media-url.spec.ts`, `media-signature.spec.ts` | Ký/kiểm HMAC, hết hạn, TTL vượt mức, định dạng tham số |
| `media-repository.integration.spec.ts`, `media-attach.integration.spec.ts` | Cần PostgreSQL thật (xem dưới) |

### Integration với PostgreSQL
```bash
MEDIA_TEST_DATABASE_URL=postgresql://user:pass@localhost:5433/aura_test npm run test:media
```
Spec integration **chỉ nhận DB `localhost`** — cố ý, để không bao giờ chạy test xóa/ghi trên DB Supabase dùng
chung. Dựng nhanh: `docker run --rm -e POSTGRES_PASSWORD=pass -p 5433:5432 postgres:16`.

## 2. E2E trên Supabase thật — chuẩn bị

| Việc | Lý do |
|---|---|
| `.env` đủ biến ([01](01-thiet-lap-project.md)) + `MEDIA_STORAGE_DRIVER=supabase` | |
| Migration đã chạy (`migration:show` không còn `[ ]`) | Task 9 cần 3 cột mới |
| Có tài khoản admin (`SEED_ADMIN_EMAIL`/`PASSWORD`) đăng nhập được | Admin có mọi quyền, kể cả publish/hide |
| Build rồi chạy trên **cổng riêng** | Không đụng server dev đang chạy |
| Tạo **phòng tạm** riêng cho test | Không chen hiện vật test vào phòng thật |
| Ghi lại mọi ID tạo ra | Để dọn chính xác |

```bash
cd back-end
npm run build
PORT=3091 MEDIA_PUBLIC_BASE_URL=http://localhost:3091 node dist/main.js
# chờ: curl -s localhost:3091/api/health → 200
```

## 3. Kịch bản E2E (29 bước)

Biến dùng trong ví dụ: `A=http://localhost:3091`, `T=<accessToken>`.

| # | Bước | Lệnh / API | Kỳ vọng |
|---|---|---|---|
| 1 | Đăng nhập | `POST $A/api/auth/login {email,password}` | 200, `data.accessToken` |
| 2–5 | Upload 4 loại | `POST $A/api/admin/media/upload` multipart `file`, `kind` = model/image/audio/subtitle | 201, `processingState: ready` |
| 6 | File nằm trong bucket | list `uploads/images` | có object mới |
| 7 | Supabase: ghi trùng key | `POST /storage/v1/object/<bucket>/<key>` + `x-upsert: false` | từ chối (body `409 KeyAlreadyExists`) |
| 8 | Supabase: Range | `GET /object/authenticated/...` + `Range: bytes=0-9` | 206, 10 byte |
| 9 | Supabase: không có object | `GET` key ngẫu nhiên | body `404 NoSuchKey` |
| 10 | Tạo phòng tạm | `POST $A/api/admin/rooms {slug:"e2e-task9-<ts>", name}` | 201 |
| 11 | Tạo draft + gắn media | `POST $A/api/admin/exhibits {roomId, name{vi,en}, description{vi,en}, position, modelId, imageId, audioViId, subtitleViId, transcript{vi}}` | 201 |
| 12 | Preview trả URL ký | `GET $A/api/admin/exhibits/:id/preview` | `media.image.url` có `exp`, `sig` |
| 13 | Tải qua URL ký | `GET <url ký>` | 200, `private, no-store` |
| 14 | Cùng file không ký | `GET <url bỏ query>` | **404** (chưa publish) |
| 15 | Submit khi thiếu rights/alt | `POST $A/api/admin/exhibits/:id/submit-review` | **422** `media_rights_missing` ×4, `image_alt_text_missing` ×2 |
| 16 | Bổ sung | `PATCH /api/admin/media/:id {source,author,license}` ×4; `PATCH /api/admin/exhibits/:id {altText{vi,en}}` | 200 |
| 17 | Submit | như 15 | 201 |
| 18 | Publish | `POST $A/api/revisions/<revId in_review>/publish {version}` | 201 |
| 19 | Public API | `GET $A/api/rooms/<slug>` | có hiện vật, `image`, `audio.vi`, `model` |
| 20 | Ảnh công khai | `GET image.url` | 200, `nosniff`, `no-cache`, ETag |
| 21 | 304 | `curl -H 'If-None-Match: "<sha256>"'` | **304** (đừng dùng `fetch` — xem [04 §6](04-phan-phoi-media.md#304)) |
| 22 | HEAD | `curl -I` | 200, thân rỗng |
| 23 | Seek audio | `Range: bytes=100-199` | 206 |
| 24 | Range ngoài file | `Range: bytes=999999-` | 416 |
| 25 | Phụ đề | `GET audio.vi.subtitle.url` | 200 `text/vtt; charset=utf-8` |
| 26 | GLB qua route tour | `GET $A/api<model.url>` | 200 |
| 27 | Ẩn | `POST $A/api/exhibits/:id/hide {version}` | 201 |
| 28–29 | Sau khi ẩn | `GET image.url`, `GET audio url` | **404 ngay** |

Lưu ý:
- `revId` lấy từ `GET /api/admin/exhibits/:id` → `data.revisions.find(r => r.state === 'in_review').id`.
- `version` (optimistic lock) đọc lại **ngay trước** publish/hide/unhide; mỗi thao tác tăng version.
- Admin tự publish revision của chính mình được (không áp quy tắc 4 mắt ở BE hiện tại).

## 4. Kết quả nghiệm thu 21/10/2026

Môi trường: DB + bucket dùng chung `ailabs-museum`, session pooler `ap-southeast-1`, bản build nhánh
`feat/supabase-storage` (đã gồm Task 9), cổng 3091.

| Nhóm | Kết quả |
|---|---|
| Upload 4 loại lên Supabase | ✅ 4/4 |
| Hành vi Supabase (trùng key, không có object, Range) | ✅ 3/3 |
| Draft + Preview URL ký + 404 khi không ký | ✅ |
| Cổng Submit (422 đúng mã) → Submit → Publish | ✅ |
| Public API + phân phối (200/HEAD/206/416/VTT/GLB) | ✅ |
| 304 | ✅ qua curl (fetch báo 200 do tự thêm `no-cache` — không phải lỗi app) |
| Ẩn → 404 ngay | ✅ |
| **Tổng** | **29/29** |

Lần chạy đầu có 3 bước đỏ do **kịch bản** đọc sai field revision id (không phải lỗi app); sửa kịch bản và
chạy lại.

## 5. Dọn dữ liệu test

### Vì sao không xóa hết được qua API
- Hiện vật **đã từng xuất bản** (`published_revision_id IS NOT NULL`) → `DELETE /api/admin/exhibits/:id`
  trả **409** (cố ý, giữ lịch sử xuất bản).
- Media đang được revision published tham chiếu → `DELETE /api/admin/media/:id` trả **409** (BR-21).
- Phòng còn hiện vật → `DELETE /api/admin/rooms/:id` trả **409**.
- `audit_logs.revision_id`, `content_reports.*`, `hotspots.revision_id` có FK `ON DELETE RESTRICT` → xóa
  cứng revision kéo theo phải xóa **audit log** — không nên sửa nhật ký kiểm toán.

### Cách đã làm: xóa mềm có phạm vi hẹp
Nếu hiện vật test **chưa** publish: xóa qua API theo thứ tự hiện vật → media → phòng (API tự dọn file).

Nếu **đã** publish: ẩn hiện vật qua API trước, rồi chạy một transaction chỉ nhắm đúng ID đã ghi lại:

```sql
BEGIN;
UPDATE exhibits SET is_deleted = true, deleted_at = now(), updated_at = now(), visibility = 'hidden'
 WHERE id = '<exhibitId>' AND is_deleted = false;
UPDATE media SET is_deleted = true, deleted_at = now()
 WHERE id = ANY('{<m1>,<m2>,<m3>,<m4>}') AND is_deleted = false;
UPDATE rooms SET is_deleted = true, deleted_at = now(), updated_at = now()
 WHERE id = '<roomId>' AND slug LIKE 'e2e-task9-%' AND is_deleted = false;
COMMIT;
```

Rồi xóa object khỏi bucket bằng API `DELETE /storage/v1/object/<bucket>` với danh sách key
([05 §6](05-chuyen-du-lieu-va-script.md#6-dọn-file-trong-bucket-bằng-api-khi-cần)).

Kiểm lại:
- `GET /api/public/rooms` không còn slug `e2e-task9-*`.
- `uploads/*` trong bucket không còn key test; `models/` giữ nguyên 5 GLB.
- `audit_logs` giữ nguyên (lịch sử thao tác test vẫn truy được).

Ngày 21/10/2026 đã dọn đúng như trên: 1 hiện vật + 1 phòng + 4 media xóa mềm; 8 object test (2 lần chạy)
không còn trên bucket — 4 object của lần chạy đầu đã được API tự xóa khi xóa media (bằng chứng luồng
xóa hoạt động với driver Supabase).

## 6. Checklist nghiệm thu nhanh (trước demo / sau khi đổi cấu hình)

- [ ] `migration:show` không còn `[ ]`.
- [ ] API khởi động không lỗi validation env.
- [ ] Đăng nhập CMS, upload 1 ảnh → 201 `ready`, thấy object mới trong `uploads/images/`.
- [ ] Preview hiện vật Draft thấy ảnh.
- [ ] Trang tour/2D của một phòng đã xuất bản tải được ảnh/audio, tua audio được.
- [ ] GLB tour trong `bo-suu-tap-glb` tải được.
- [ ] Ẩn một hiện vật thử → file 404; Hiện lại → 200.
- [ ] Dọn dữ liệu thử.
