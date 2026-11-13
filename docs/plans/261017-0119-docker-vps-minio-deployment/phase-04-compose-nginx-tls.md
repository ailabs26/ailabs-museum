# Phase 4 — Compose stack + Nginx + TLS

## File
- `deploy/docker-compose.yml`, `deploy/.env.production.example`
- `deploy/nginx/conf.d/museum.conf`
- `deploy/minio/init.sh`

## `docker-compose.yml` — điểm chính
- Service đúng bảng trong `plan.md`; image có tag cố định (không `latest`).
- `restart: unless-stopped` cho service chạy lâu; `minio-init`, `migrate` chạy 1 lần.
- Thứ tự: `db`, `minio` (healthcheck) → `minio-init`, `migrate` (`service_completed_successfully`) → `api` (healthcheck) → `web` → `proxy`.
- Networks: `edge`, `backend` (`internal: true`).
- `db`, `minio` không publish port; nếu cần quản trị: `127.0.0.1:5432:5432`, `127.0.0.1:9001:9001` rồi SSH tunnel.
- Secrets qua `deploy/.env.production` (chmod 600, không commit).
- `mem_limit` theo bảng gợi ý.

## `minio/init.sh` (chạy bằng `minio/mc`)
1. `mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD`
2. `mc mb --ignore-existing local/aura-media` (mặc định private — **không** `anonymous set`)
3. Tạo policy chỉ `s3:GetObject/PutObject/DeleteObject/ListBucket` trên `aura-media/*` → `mc admin user add` user app → gán policy. API dùng user này, không dùng root.

## Nginx `museum.conf`
- `:80` → chỉ phục vụ `/.well-known/acme-challenge/` + redirect 301 sang HTTPS.
- `:443` TLS (cert từ certbot), HSTS, `server_tokens off`.
- `location /api/` → `http://api:3001`; `client_max_body_size 25m`; `proxy_set_header X-Forwarded-For/Proto/Host`; timeout upload ~120s.
- `location /media/` → `http://api:3001`; `proxy_buffering off` (stream file lớn), giữ nguyên header `ETag`/`Range` từ API.
- `location /` → `http://web:80`.
- Rate limit nhẹ cho `/api/auth/` (`limit_req`).

## TLS
Lần đầu: chạy proxy chỉ với block `:80` → `certbot certonly --webroot` → bật block `:443`. Gia hạn: container `certbot` chạy `renew` định kỳ + `nginx -s reload` (cron host).

## Tiêu chí xong
- `docker compose up -d` từ VPS sạch dựng toàn bộ stack.
- `https://domain` tải SPA, đăng nhập CMS được (cookie refresh hoạt động), upload GLB → preview → publish → khách xem 3D được.
- `curl` từ ngoài tới `:5432`, `:9000`, `:9001`, `:3001` đều thất bại.
- SSL Labs ≥ A.
