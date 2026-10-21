# Task: Lưu trữ database + file media trên Supabase

Nhánh: `feat/supabase-storage` (tách từ `feat/cms-media-attach` vì cần code phân phối file của Task 9; PR vào `dev` **sau khi** Task 9 merge). Plan: `plans/261019-2333-supabase-db-storage/plan.md`. Thay Phase 3 (MinIO) của `plans/261017-0119-docker-vps-minio-deployment/`.

**Trạng thái:** Code + test xong (7 commit, chưa push). Chưa chạy với project Supabase thật — chờ người dùng tạo project/bucket và điền `.env`.

## Bối cảnh

Trước task này file media chỉ lưu trên đĩa (`public/media/uploads`, `storage/quarantine`), đường dẫn cứng trong `MediaStorageService`, và `MediaDeliveryController` trả file bằng `res.sendFile`. Không chuyển được sang kho lưu trữ khác, và container không giữ được file khi tạo lại. Giai đoạn đầu chọn Supabase cho cả PostgreSQL lẫn Storage thay vì tự host Postgres + MinIO trên VPS.

## Quyết định

| # | Vấn đề | Chọn | Lý do |
|---|---|---|---|
| S1 | Cách gọi Supabase Storage | REST API `/storage/v1/object/...` bằng `fetch` có sẵn của Node, khóa `service_role` ở server | Không thêm dependency; `x-upsert: false` chặn ghi đè đúng BR-21 (API S3 của Supabase ghi đè) |
| S2 | Phân phối file | Vẫn **stream qua API** `/media/...` | Giữ kiểm tra published/HMAC, `no-cache` + `ETag` → AC-36/AC-51 không đổi; không lộ URL Supabase |
| S3 | Chọn driver | Env `MEDIA_STORAGE_DRIVER=local\|supabase`, mặc định `local` | Dev không cần mạng; không thêm cột DB (YAGNI) |
| S4 | Bucket | 1 bucket **private** `museum-assets` (dùng chung với GLB của tour), giữ nguyên `storageKey` (`uploads/<kind>/<uuid>.<ext>`, `quarantine/<uuid>.bin`) | Không sửa dữ liệu bảng `media` |
| S5 | Kết nối DB | Session pooler (cổng 5432, IPv4) + TLS, xác thực bằng CA của Supabase | Direct connection chỉ IPv6; transaction pooler (6543) không hợp với migration |

## Đã làm

- **Lớp driver lưu trữ** (`src/modules/media/storage/`):
  - `media-storage-driver.ts` — interface `put` (lỗi nếu key đã có) / `delete` (bỏ qua nếu không còn) / `read` (toàn bộ hoặc đoạn byte, `null` nếu không có) + token DI `MEDIA_STORAGE_DRIVER`.
  - `local-storage.driver.ts` — chuyển nguyên code đĩa cũ (ghi `wx`, chặn đường dẫn thoát khỏi thư mục gốc); mở file trước khi tạo stream để phát hiện "file mất" trước khi gửi header.
  - `supabase-storage.driver.ts` — upload `POST` + `x-upsert: false` (trùng key → lỗi mã `EEXIST`); đọc qua endpoint `authenticated` kèm header `Range`, từ chối nếu xin Range mà nhận 200 (không trả sai đoạn byte); nhận diện "không tồn tại" cả dạng `404` lẫn `400 + statusCode "404"`; timeout 15 s tới khi có header (không cắt stream dài).
- **`MediaStorageService`** giữ sinh key + kiểm tra key an toàn, ủy quyền IO cho driver; `publicFilePath()` đổi thành `openPublic()` trả stream — key quarantine không bao giờ được mở.
- **`MediaDeliveryController`** bỏ `res.sendFile`, stream từ driver; tự xử lý Range (206 / 416), `If-None-Match` (304), HEAD, đóng stream khi client ngắt. Header bảo mật/cache của Task 9 giữ nguyên; lỗi 404/416 vẫn không mang các header đó.
- **DB TLS** (`config/data-source.ts`): `DATABASE_SSL=true` bật TLS cho cả app và CLI migration; `DATABASE_SSL_CA` → xác thực chứng chỉ, bỏ trống → mã hóa nhưng không xác thực (chỉ dùng tạm).
- **Env + validate** (`config/env.validation.ts`, `config/media.config.ts`): app không khởi động nếu `MEDIA_STORAGE_DRIVER=supabase` mà thiếu `SUPABASE_URL` hoặc cả `SUPABASE_SECRET_KEY` lẫn `SUPABASE_SERVICE_ROLE_KEY`, hoặc `DATABASE_SSL` khác `true`/`false`.
- **Script** `npm run media:upload-supabase` (`src/database/scripts/upload-media-to-supabase.ts`): đẩy file local lên bucket, giữ nguyên key; file đã có thì bỏ qua → chạy lại an toàn.
- **Sửa `.gitignore`:** dòng `storage/` cũ bỏ qua luôn thư mục code `src/modules/media/storage/`; đổi thành `/storage/` (chỉ thư mục quarantine ở gốc back-end).
- **Tài liệu:** sơ đồ C4 mức 1 (`docs/architecture/01-system-overview.md`) cập nhật — web tải file qua API `/media`, API đọc/ghi Supabase Storage bằng khóa server.

## Cấu hình mới (`.env`)

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `DATABASE_SSL` | `false` | `true` khi dùng Supabase |
| `DATABASE_SSL_CA` | (trống) | đường dẫn file CA, vd `certs/supabase-ca.crt` |
| `MEDIA_STORAGE_DRIVER` | `local` | `local` \| `supabase` |
| `SUPABASE_URL` | — | `https://<ref>.supabase.co`, bắt buộc khi driver = supabase |
| `SUPABASE_SECRET_KEY` | — | khóa `sb_secret_...`, **chỉ ở back-end**, không đưa vào FE/git |
| `SUPABASE_SERVICE_ROLE_KEY` | — | khóa legacy, dùng khi chưa có `SUPABASE_SECRET_KEY` |
| `SUPABASE_STORAGE_BUCKET` | `museum-assets` | bucket **private**, dùng chung với GLB của tour |

Các biến `SUPABASE_*` trùng với tính năng GLB tour của `dev` (`ModelStorageService`) — một bucket, một khóa cho cả hai.

`DATABASE_URL` dùng chuỗi **Session pooler**: `postgresql://postgres.<ref>:<mật-khẩu>@aws-0-<region>.pooler.supabase.com:5432/postgres` — không thêm `?sslmode=`.

## Thiết lập Supabase (người dùng làm)

1. Tạo project → **Project Settings → Database → Connection string → Session pooler** → `DATABASE_URL`.
2. Cùng trang → **SSL Configuration → Download certificate** → `back-end/certs/supabase-ca.crt`, đặt `DATABASE_SSL=true`, `DATABASE_SSL_CA=certs/supabase-ca.crt`.
3. **Storage → New bucket** `museum-assets` (nếu chưa có), **tắt Public bucket**, giới hạn file 25 MB.
4. **Project Settings → API Keys** → `SUPABASE_URL`, `SUPABASE_SECRET_KEY`; đặt `MEDIA_STORAGE_DRIVER=supabase`.
5. Trong `back-end/`: `npm run migration:run && npm run seed && npm run media:upload-supabase`.

Migration không cần sửa: `uuid-ossp` đã có sẵn trên Supabase, `citext` được `CREATE EXTENSION IF NOT EXISTS` tạo.

## Commit

| Commit | Nội dung |
|---|---|
| `bcf8d72` chore(be) | anchor `storage/` trong `.gitignore` |
| `b4b4b76` refactor(media) | tách `StorageDriver` + driver local, delivery chuyển sang stream |
| `5018811` feat(db) | TLS cho Postgres Supabase |
| `6742ace` feat(media) | driver Supabase Storage + env + test |
| `988de81` feat(media) | script đẩy file local lên Supabase |
| `c5b6847` docs(plans) | plan Docker + VPS |
| `67d4c19` docs(plans) | plan Supabase |

## Kiểm chứng ngày 19–20/10/2026

- BE `npm run typecheck`, `lint`, `build`: đạt. `npm test`: **1551/1551** (trước task 1537; thêm test driver Supabase + đọc Range của driver local).
- `test:media` 504/504 — toàn bộ test HTTP phân phối file của Task 9 (200 + header, WebVTT, Range 206, 416, 304, HEAD, CORS, 404 thống nhất, đường dẫn độc hại, file mất, URL ký) **giữ nguyên assertion**, chạy trên stream mới.
- Commit `b4b4b76` kiểm riêng trên snapshot staged: typecheck đạt, `test:media` 492/492.
- Unit test `SupabaseStorageDriver` (fetch giả, 12 case): header `x-upsert`/`apikey`/`authorization`, URL endpoint, trùng key 409 và 400+"409" → `EEXIST`, xóa object không tồn tại, Range 206, Range bị bỏ qua → lỗi, 404 dạng 400 → `null`.
- Validate env: thiếu biến Supabase → `Invalid environment: SUPABASE_URL, …KEY`; có 1 trong 2 khóa là đủ; `DATABASE_SSL=yes` → lỗi; mặc định vẫn `local`.

## Đồng bộ `dev` ngày 20/10/2026

`dev` (PR #55/#57, tour GLB) đã tự làm route `GET /api/rooms/:slug/exhibits/:id/model` đọc GLB từ Supabase qua signed URL (`PublicModelsService` + `ModelStorageService`). Khi merge (commit `46df53f`, `13ddffe`):

- **`model` trong public API theo contract của `dev`** (`{ id, storageKey, sizeBytes, checksumSha256, url: "/rooms/<slug>/exhibits/<id>/model?version=<sha256>" }`) để FE tour 3D chạy nguyên; image/audio/i18n/transform giữ contract Task 9 (URL `/media/...`).
- Vị trí hiện vật vắng mặt khi revision chưa có x/y/z hữu hạn (không mặc định 0) → FE dùng layout phòng.
- Dùng chung biến `SUPABASE_*` và bucket `museum-assets`.
- Kiểm chứng sau merge: BE typecheck/lint, `npm test` **1559/1559**, `test:models` 10/10, `test:seed` 6/6; FE typecheck/lint/build, `test:unit` 69/69, `room-contract.spec.ts` 8/8.

> Tài liệu hướng dẫn đầy đủ (thiết lập, kiến trúc, phân phối, script, kiểm thử, vận hành):
> [`docs/supabase/`](../../../docs/supabase/README.md).

## Kiểm chứng trên Supabase thật (21/10/2026)

Project dùng chung `ailabs-museum` (session pooler `aws-0-ap-southeast-1`, TLS qua `sslmode=require` trong URL), `MEDIA_STORAGE_DRIVER=supabase`, bản build chạy cổng riêng.

- **Migration:** `AddRevisionLocalizedMedia1792073130413` đã chạy (chỉ ADD COLUMN nullable + index). **Không chạy `seed`**: nhánh không đổi bộ quyền so với `dev`, còn seed đặt lại toàn bộ `role_permissions` về mặc định.
- **Không chạy `media:upload-supabase`**: 16 file trong `public/media/uploads` thuộc DB local cũ, bảng `media` trên Supabase không tham chiếu file nào → chỉ tạo file mồ côi.
- **E2E 28/29 + 1 kiểm lại bằng curl:** đăng nhập → upload GLB/PNG/MP3/VTT (file nằm ở `uploads/<kind>/` trong bucket) → gắn vào draft → preview URL ký 200 (`private, no-store`), cùng file không ký → 404 → submit thiếu rights/alt text → 422 (`media_rights_missing`, `image_alt_text_missing`) → sửa → submit → publish → public API có model/image/audio.vi → ảnh 200 (`nosniff`, `no-cache`, ETag) → HEAD → audio Range 206, ngoài file 416 → WebVTT `text/vtt` → GLB qua route tour 200 → ẩn → ảnh/audio 404 ngay. `If-None-Match` → 304 kiểm bằng curl (fetch của Node tự thêm `Cache-Control: no-cache` nên server bỏ qua 304 đúng thiết kế).
- **Hành vi Supabase (trước đây chỉ theo tài liệu):** ghi trùng key với `x-upsert: false` → HTTP 400, body `statusCode "409"`, `code "KeyAlreadyExists"`; object không có → HTTP 400, body `statusCode "404"`, `code "NoSuchKey"`; Range trên `/object/authenticated/` → 206 + `Content-Range`. Xóa media qua API dọn file trên bucket.
- **Dọn dữ liệu test:** hiện vật đã publish không xóa được qua API (đúng luật), nên xóa mềm hiện vật/room/media bằng SQL (giữ `audit_logs`), xóa file test khỏi bucket. Bucket trở về 5 GLB ở `models/`.

## Việc sau

- [x] Chạy với project Supabase thật (migration, upload → preview → public → Range → ẩn → 404).
- [x] Xác nhận hành vi Supabase: mã lỗi trùng key / không có object, Range trên endpoint `authenticated`.
- [ ] PR `feat/cms-media-attach` → `dev` (Task 9), review & merge; sau đó PR `feat/supabase-storage` → `dev`.
- DB dùng chung đã có migration của Task 9 trước khi code lên `dev`: ai chạy `migration:generate` từ `dev` trên DB này sẽ thấy drift ngược (3 cột + index) — merge Task 9 sớm.
- TLS DB đang mã hóa nhưng không xác thực chứng chỉ (`sslmode=require`); muốn xác thực thì bỏ tham số URL, dùng `DATABASE_SSL=true` + `DATABASE_SSL_CA`.
- Stream qua API tốn băng thông 2 lần (Supabase → API → client); GLB ≤ 20 MB + `ETag`/304 giảm tải. Nếu nghẽn mới cân nhắc signed URL của Supabase (phải tính lại AC-51).
- **Hai đường đọc Supabase song song:** GLB đi qua `ModelStorageService` (signed URL, chỉ chạy khi có Supabase — driver `local` sẽ trả 503 cho model), ảnh/audio/phụ đề đi qua `MediaStorageService`. Nên gộp `ModelStorageService` về `MediaStorageService` (cần SPCCPS review).
- Gói free Supabase tạm dừng project sau 7 ngày không hoạt động.
- Docker/VPS (plan cũ): khi làm Phase 4 bỏ service `postgres`/`minio` khỏi compose.
