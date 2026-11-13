# Phase 2 — Container hóa front-end

## File
- `front-end/Dockerfile`, `front-end/nginx.conf`, `front-end/.dockerignore` (mới)

## Dockerfile
1. `build`: `node:20-alpine`, `npm ci`, nhận `ARG VITE_API_BASE_URL`, `ARG VITE_MEDIA_BASE_URL` → `ENV`, `npm run build`.
2. `runtime`: `nginx:1.27-alpine`, copy `dist/` vào `/usr/share/nginx/html`, copy `nginx.conf`.

Giá trị build-arg production (D1 cùng domain): `VITE_API_BASE_URL=https://museum.example/api`, `VITE_MEDIA_BASE_URL=https://museum.example/media`.

## `nginx.conf` (nội bộ container web)
- `try_files $uri /index.html;` (React Router).
- `/assets/*` (tên có hash): `Cache-Control: public, max-age=31536000, immutable`.
- `index.html`: `no-cache` để deploy mới có hiệu lực ngay.
- gzip cho js/css/json/svg. **Không** gzip `.glb` ở đây (GLB đi qua API, không qua web).

## Tiêu chí xong
- Image chạy được, F5 ở route sâu (`/admin/exhibits/...`) không 404.
- Bundle 3D (three/R3F) được tách chunk, kiểm tra kích thước trong output build.
