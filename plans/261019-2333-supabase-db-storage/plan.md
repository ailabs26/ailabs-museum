---
title: Lưu trữ DB + media trên Supabase (thay MinIO giai đoạn đầu)
status: in_progress
branch: feat/supabase-storage (tách từ feat/cms-media-attach — cần code delivery của Task 9)
created: 2026-10-19
---

# Supabase: PostgreSQL + Storage

Người dùng chốt: giai đoạn đầu dùng **Supabase** cho cả database lẫn file media. Thay Phase 3
(MinIO) của [plan Docker/VPS](../261017-0119-docker-vps-minio-deployment/plan.md); các phase
container/Nginx vẫn giữ nhưng bỏ service `minio` và `postgres` khỏi compose khi triển khai.

## Quyết định
| # | Vấn đề | Chọn | Lý do |
|---|---|---|---|
| S1 | Cách gọi Supabase Storage | REST API (`/storage/v1/object/...`) bằng `fetch` có sẵn của Node, khóa `service_role`/secret ở server | Không thêm dependency; `x-upsert: false` → chặn ghi đè đúng BR-21 (S3 API của Supabase ghi đè) |
| S2 | Phân phối file | Vẫn **qua API stream** (giữ kiểm tra published/HMAC, `no-cache` + `ETag`, Range) | Giữ nguyên AC-36/AC-51; bucket **private**, không lộ URL Supabase |
| S3 | Chọn driver | `MEDIA_STORAGE_DRIVER=local\|supabase`; dev mặc định `local` | Không cần cột DB mới (YAGNI) |
| S4 | Bucket | 1 bucket private `aura-media`, key giữ nguyên `uploads/<kind>/<uuid>.<ext>`, `quarantine/<uuid>.bin` | Không phải sửa dữ liệu `media.storage_key` |
| S5 | Kết nối DB | **Session pooler** (cổng 5432, IPv4) cho cả app lẫn migration; `DATABASE_SSL=true` + CA của Supabase | Direct connection chỉ IPv6; transaction pooler (6543) không hợp với migration |
| S6 | File cũ ở `public/media` | Script 1 lần `npm run media:upload-supabase` đẩy file local lên bucket (bỏ qua file đã có) | Key không đổi → DB không cần sửa |

## Việc cần làm
- [x] Interface `MediaStorageDriver` + `LocalStorageDriver` (chuyển code fs hiện có) + `SupabaseStorageDriver`
- [x] `MediaStorageService` ủy quyền driver, giữ kiểm tra key an toàn
- [x] Delivery bỏ `res.sendFile` → stream; tự xử lý Range 206/416, `If-None-Match` 304, HEAD
- [x] Env mới + validate (`MEDIA_STORAGE_DRIVER`, `SUPABASE_*`, `DATABASE_SSL*`)
- [x] Script đẩy file local lên Supabase
- [x] Test: hồi quy delivery/storage với driver local + unit test Supabase driver (fetch giả)
- [ ] Người dùng tạo project Supabase, bucket, điền `.env` → chạy `migration:run`, `seed`, `media:upload-supabase`
- [ ] Kiểm thử thật: upload, preview signed URL, public view, unpublish → 404 ngay

## Hướng dẫn thiết lập (người dùng làm trên dashboard)
1. Tạo project → **Project Settings → Database → Connection string → Session pooler** → dán vào `DATABASE_URL`
   (dạng `postgresql://postgres.<ref>:<mật-khẩu>@aws-0-<region>.pooler.supabase.com:5432/postgres`, KHÔNG thêm `?sslmode=`).
2. Cùng trang → **SSL Configuration → Download certificate** → lưu vd `back-end/certs/supabase-ca.crt`, đặt
   `DATABASE_SSL=true`, `DATABASE_SSL_CA=certs/supabase-ca.crt`.
3. **Storage → New bucket** `aura-media`, **tắt Public**, giới hạn file 25 MB.
4. **Project Settings → API Keys**: lấy Project URL → `SUPABASE_URL`, khóa `service_role` (hoặc `sb_secret_...`)
   → `SUPABASE_SERVICE_ROLE_KEY`. Khóa này chỉ để ở back-end, không đưa vào FE/git.
5. `MEDIA_STORAGE_DRIVER=supabase` → `npm run migration:run && npm run seed && npm run media:upload-supabase`.

## Rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| Free tier pause project sau 7 ngày không hoạt động | Ghi chú cho demo; vào dashboard bật lại |
| Stream qua API tốn băng thông 2 lần (Supabase → API → client) | GLB ≤ 20 MB, `ETag` → 304; nếu nghẽn mới tính signed URL của Supabase |
| Rò khóa `service_role` | Chỉ ở `.env` back-end; `.env` đã gitignore |
