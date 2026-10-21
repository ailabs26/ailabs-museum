---
title: "Triển khai production trên VPS bằng Docker Compose + MinIO"
description: "Container hóa back-end/front-end, chuyển lưu trữ media (GLB/ảnh/audio/phụ đề) từ local disk sang MinIO qua StorageDriver, dựng stack Compose sau Nginx + TLS trên 1 VPS, kèm backup và checklist go-live."
status: pending
priority: P1
effort: "4–6 ngày công"
branch: "feat/deploy-docker-vps (tách từ dev)"
owner: "Nguyễn Trọng Thành"
tags: [devops, docker, deployment, minio, storage, nginx]
blockedBy: []
blocks: []
created: 2026-10-17
---

> **Cập nhật 2026-10-19:** giai đoạn đầu dùng **Supabase** (PostgreSQL + Storage) thay cho
> Postgres/MinIO tự host — xem [plan Supabase](../261019-2333-supabase-db-storage/plan.md).
> `StorageDriver` của Phase 3 đã làm (driver `local` | `supabase`); MinIO/S3 chỉ cần thêm
> driver mới khi quay lại tự host. Khi làm Phase 4, bỏ service `postgres`/`minio` khỏi compose.

# Triển khai Docker trên VPS + MinIO

## Hiện trạng đã kiểm chứng

| # | Hiện trạng | Vị trí | Ảnh hưởng khi lên Docker |
|---|---|---|---|
| H1 | Chưa có Dockerfile/compose/tài liệu deploy nào | toàn repo | Làm mới hoàn toàn |
| H2 | Media lưu local fs, root hardcode `public/media` + `storage/quarantine`, không có driver interface | `media-storage.service.ts:16-19` | Container stateless → mất file khi recreate nếu không đổi |
| H3 | Delivery dùng `res.sendFile(storage.publicFilePath())` | `media-delivery.controller.ts` | Phải đổi sang stream khi dùng MinIO |
| H4 | Migration chạy bằng `typeorm-ts-node-commonjs` trên `src/config/data-source.ts` | `package.json:12-15` | Image prod chỉ có `dist/` → cần lệnh migration trên JS đã build |
| H5 | `data-source.ts` glob `*{.ts,.js}` theo `__dirname` | `data-source.ts:38` | Chạy được với `dist/config/data-source.js` — tốt |
| H6 | Swagger luôn bật ở `/api/docs` | `main.ts:46` | Nên tắt/che ở production |
| H7 | Không `trust proxy` | `main.ts` | Sau Nginx, `req.ip` = IP của proxy → audit log/rate limit sai IP |
| H8 | CORS 1 origin + refresh token httpOnly cookie | `main.ts:24-29` | Đặt FE và API **cùng domain** → hết rắc rối CORS/cookie SameSite |
| H9 | FE nhận `VITE_API_BASE_URL`, `VITE_MEDIA_BASE_URL` lúc build | `front-end/.env.example` | Phải truyền qua build-arg, không đổi được lúc runtime |
| H10 | Media có `Cache-Control: no-cache` + `ETag` để unpublish có hiệu lực ngay (AC-51) | Task 9 D4 | Quyết định cách serve từ MinIO (xem D2) |

## Danh sách service (docker-compose)

| Service | Image | Vai trò | Port ra host | Network | Volume | Giới hạn RAM gợi ý |
|---|---|---|---|---|---|---|
| `proxy` | `nginx:1.27-alpine` | Điểm vào duy nhất: TLS, `/` → web, `/api` + `/media` → api, `client_max_body_size`, gzip, security headers | **80, 443** | `edge` | `./deploy/nginx`, `certbot-etc`, `certbot-www` | 128 MB |
| `certbot` | `certbot/certbot` | Cấp/gia hạn Let's Encrypt (webroot) | — | — | `certbot-etc`, `certbot-www` | 64 MB |
| `web` | build `front-end/Dockerfile` (Vite build → `nginx:alpine`) | Phục vụ SPA tĩnh, fallback `index.html`, cache dài cho `/assets/*` có hash | — | `edge` | — | 64 MB |
| `api` | build `back-end/Dockerfile` (multi-stage, `node:20-alpine`, user non-root) | NestJS API + route `/media/*` stream từ MinIO | — (nội bộ :3001) | `edge`, `backend` | — (stateless) | 512 MB |
| `migrate` | **cùng image `api`**, chạy 1 lần | `migration:run` trên `dist/`, chạy trước `api` (`depends_on: service_completed_successfully`) | — | `backend` | — | 256 MB |
| `db` | `postgres:16-alpine` | PostgreSQL | — (chỉ `127.0.0.1:5432` nếu cần tunnel) | `backend` | `pgdata` | 1 GB |
| `minio` | `minio/minio:<tag cố định>` | Object storage S3 | — (console `127.0.0.1:9001` để SSH tunnel) | `backend` | `minio-data` | 512 MB–1 GB |
| `minio-init` | `minio/mc` | 1 lần: tạo bucket private, user app + policy chỉ trên bucket đó | — | `backend` | — | 64 MB |
| `backup` | `postgres:16-alpine` + `mc` (script cron) | `pg_dump` hằng đêm + `mc mirror` MinIO ra đích ngoài VPS, xoay vòng 7/4 | — | `backend` | `./backups` | 128 MB |

**Mạng:** `edge` (proxy, web, api) và `backend` với `internal: true` (api, migrate, db, minio, minio-init, backup). `proxy` **không** tới được `db`/`minio`; chỉ `api` đứng ở cả hai.

**Không đưa vào (YAGNI):** Redis (chưa có queue/cache), Prometheus/Grafana (VPS đơn — dùng `docker stats` + uptime check ngoài là đủ đến Phase 3), service xử lý Draco/LOD (Phase 3 roadmap; khi làm sẽ thêm `media-worker`).

**VPS tối thiểu:** 2 vCPU / 4 GB RAM / SSD 60 GB+ (GLB ≤ 20 MB, ước tính dung lượng theo số hiện vật × số revision giữ lại), Ubuntu 22.04/24.04, mở 22/80/443.

## Quyết định thiết kế (chốt ở Phase 0)

| ID | Quyết định | Đề xuất | Phương án khác |
|---|---|---|---|
| D1 | Domain | **1 domain**: `museum.example` → `/` FE, `/api` API, `/media` file. `FRONTEND_ORIGIN = MEDIA_PUBLIC_BASE_URL = https://museum.example` | Subdomain `api.` riêng → phải chỉnh CORS + cookie `SameSite=None; Secure` |
| D2 | Cách serve media từ MinIO | **API stream** (`GetObject` → pipe về client), giữ nguyên kiểm tra published/HMAC, `no-cache` + `ETag`, hỗ trợ `Range` | Presigned URL MinIO redirect: nhẹ cho API nhưng phải public MinIO qua Nginx và khó đảm bảo AC-51 khi client/CDN cache |
| D3 | Cấu trúc bucket | 1 bucket private `aura-media`, prefix `uploads/<kind>/<uuid>.<ext>` (giữ nguyên `storageKey`) và `quarantine/...` | 2 bucket riêng — tăng cấu hình, không lợi gì rõ |
| D4 | Chọn driver | Env `MEDIA_STORAGE_DRIVER=local\|s3`; local cho dev, s3 cho prod. Không cần cột mới trong DB | Cột `storage_driver` trên `media` — chỉ cần khi chạy song song 2 backend (YAGNI) |
| D5 | Migration file cũ | Script 1 lần `mc mirror public/media/uploads → aura-media/uploads` (key không đổi) | — |
| D6 | Cấp phát image | Build trên VPS (`docker compose build`) giai đoạn đầu | Build ở GitHub Actions → push GHCR → VPS chỉ `pull` (Phase 6, khuyến nghị khi ổn định) |
| D7 | Swagger prod | Tắt khi `NODE_ENV=production` (hoặc env `SWAGGER_ENABLED`) | Giữ nhưng Nginx basic-auth |

## Phases

| # | Phase | Ưu tiên | Effort | Phụ thuộc | Trạng thái |
|---|---|---|---|---|---|
| 0 | [Chốt quyết định & chuẩn bị VPS](phase-00-decisions-and-vps.md) | P1 | 0.5 ngày | — | pending |
| 1 | [Container hóa back-end](phase-01-backend-image.md) | P1 | 0.5–1 ngày | 0 | pending |
| 2 | [Container hóa front-end](phase-02-frontend-image.md) | P1 | 0.5 ngày | 0 | pending |
| 3 | [StorageDriver + MinIO](phase-03-storage-driver-minio.md) | P1 | 1.5–2 ngày | 1 | pending |
| 4 | [Compose stack + Nginx + TLS](phase-04-compose-nginx-tls.md) | P1 | 1 ngày | 1, 2, 3 | pending |
| 5 | [Backup, restore, vận hành](phase-05-backup-ops.md) | P1 | 0.5 ngày | 4 | pending |
| 6 | [CI/CD + checklist go-live](phase-06-cicd-go-live.md) | P2 | 0.5–1 ngày | 4, 5 | pending |

Phase 1 và 2 làm song song được. Phase 3 là phần duy nhất đổi code nghiệp vụ → cần test kỹ nhất.

## Cấu trúc file dự kiến

```
deploy/
  docker-compose.yml
  .env.production.example      # không commit .env thật
  nginx/conf.d/museum.conf
  minio/init.sh
  backup/backup.sh
back-end/Dockerfile, back-end/.dockerignore
front-end/Dockerfile, front-end/nginx.conf, front-end/.dockerignore
docs/architecture/10-deployment.md
```

## Rủi ro chính

| Rủi ro | Giảm thiểu |
|---|---|
| Mất dữ liệu do VPS 1 disk | Backup ra ngoài VPS (Phase 5) + snapshot nhà cung cấp; **thử restore** trước go-live |
| Stream GLB qua API tốn tài nguyên khi đông người | GLB ≤ 20 MB, `ETag` → 304 cho lượt xem lại; nếu nghẽn thì Nginx `proxy_cache` cho file published hoặc chuyển D2 sang presigned |
| Lộ MinIO console/root key | Console chỉ bind `127.0.0.1`, app dùng user riêng có policy giới hạn bucket |
| Migration lỗi giữa chừng khi deploy | `migrate` chạy trước `api`; backup DB ngay trước mỗi lần deploy |
| Sai IP trong audit log sau proxy | `trust proxy` = 1 hop (Phase 1) |

## Câu hỏi còn mở

1. Domain chính thức đã có chưa? (cần cho TLS ở Phase 4)
2. Đích backup ngoài VPS: VPS thứ 2, máy nhóm, hay object storage rẻ (R2/B2)?
3. Có cần môi trường staging trên cùng VPS (compose project thứ 2, subdomain `staging.`) không?
4. Giữ bao nhiêu revision cũ / media không còn dùng — ảnh hưởng ước tính dung lượng disk.
