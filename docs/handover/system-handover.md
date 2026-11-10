# Bàn giao hệ thống — Aura Museum (WebXR 3D-WEB-03)

Tài liệu bàn giao kỹ thuật – vận hành cho đội tiếp nhận: kiến trúc, cấu hình môi
trường, cách cài đặt – chạy – triển khai, migration/seed, và runbook vận hành.

- **Repository:** `ailabs26/ailabs-museum` (monorepo: `back-end/`, `front-end/`, `docs/`).
- **Nhánh tích hợp:** `dev` (PR vào `dev` rồi merge; không merge thẳng `main`).
- **Ngày bàn giao:** 2026-11-11.

---

## 1. Kiến trúc tổng quan

```
Visitor (trình duyệt)                 Admin/Moderator/Editor (trình duyệt)
        │  giao diện 2D/3D (public)            │  Admin Portal /admin
        ▼                                      ▼
┌───────────────────────────── Front-end (React 18 + Vite) ─────────────────────────────┐
│  core/api (axios) · services (theo domain) · TanStack Query · Mantine 7 · R.Router 6   │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │ REST /api  (JWT access + refresh cookie)
                                         ▼
┌───────────────────────────── Back-end (NestJS 10 + TypeScript) ───────────────────────┐
│  Controller → Service → Repository (TypeORM)  ·  RBAC guard toàn cục  ·  Audit         │
│  Swagger /api/docs  ·  Rate limit (throttler)  ·  Helmet  ·  ResponseInterceptor       │
└──────────────┬──────────────────────────────────────────────┬──────────────────────────┘
               │ TypeORM                                       │ media
               ▼                                               ▼
        PostgreSQL (migrations)                     Lưu trữ media: local | Supabase Storage
```

- **Back-end:** NestJS 10, TypeScript, PostgreSQL + TypeORM 0.3 (`synchronize` luôn tắt,
  dùng migration). Auth JWT access + refresh (bcryptjs), RBAC theo `resource:action`,
  audit log bất biến. Swagger tại `/api/docs`.
- **Front-end:** React 18 + TypeScript + Vite, Mantine 7, React Router 6, TanStack Query 5, axios.
- **Yêu cầu runtime:** **Node.js ≥ 20**, npm; PostgreSQL 14+.

Chi tiết kiến trúc: [`docs/architecture/`](../architecture/) (`01`–`09`, `README`, thư mục `be/` và `fe/`).

---

## 2. Cấu trúc mã nguồn (tóm tắt)

- `back-end/src/`: `common/` (hạ tầng global), `config/` (app/database/jwt, env validation,
  data-source, **swagger.config.ts**), `database/` (migrations, seeds), `modules/<domain>/`
  (auth, users, roles, rooms, exhibits, media, moderation, content-reports, audit,
  translations, partner-api-keys, notifications, health, stats).
- `back-end/scripts/`: công cụ ngoài runtime (vd `export-openapi.ts`).
- `front-end/src/`: `core/` (api, auth, config), `services/`, `shared/components/`,
  `app/` (router, theme), `pages/` (admin, client), `layouts/`.
- `docs/`: nguồn tài liệu duy nhất (architecture, plans, tasks, requirements, **api**,
  **guides**, **handover**).

---

## 3. Cấu hình môi trường

Mỗi app có `.env` (không commit) sao từ `.env.example` (commit). `.env` giữ **đúng các
dòng** như `.env.example`, chỉ khác giá trị.

### 3.1. Back-end (`back-end/.env`)

Các biến quan trọng (xem `back-end/.env.example` để biết đầy đủ + chú thích):

| Nhóm | Biến | Ghi chú |
| --- | --- | --- |
| Máy chủ | `NODE_ENV`, `PORT`, `FRONTEND_ORIGIN`, `TRUST_PROXY` | `production` bật kiểm tra khóa bí mật chặt hơn; `TRUST_PROXY` khi đứng sau reverse proxy |
| Database | `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_SSL_CA` | Supabase: Session pooler cổng 5432, `DATABASE_SSL=true` |
| Xác thực | `JWT_ACCESS_SECRET`, `TOTP_ENCRYPTION_KEY`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, `REFRESH_COOKIE_NAME`, `BCRYPT_ROUNDS` | **Production bắt buộc tự đặt** secret ≥ 32 ký tự (`openssl rand -hex 32`); không dùng khóa mẫu |
| Rate limit | `REFRESH_RATE_LIMIT_*`, `PUBLIC_API_RATE_LIMIT`, `PUBLIC_MEDIA_RATE_LIMIT`, `PUBLIC_REPORT_RATE_LIMIT` | Khách chung Wi-Fi bảo tàng dùng chung IP → đặt rộng |
| Media | `MEDIA_STORAGE_DRIVER` (`local`\|`supabase`), `MEDIA_PUBLIC_BASE_URL`, `MEDIA_URL_SIGNING_SECRET`, `MEDIA_SIGNED_URL_TTL_SECONDS`, `MEDIA_ORPHAN_CLEANUP`, `MEDIA_TRASH_RETENTION_DAYS`, `MEDIA_UPLOAD_JOB_*` | Driver `supabase` cần `SUPABASE_URL` + `SUPABASE_SECRET_KEY` + `SUPABASE_STORAGE_BUCKET` |
| Seed | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_RESET_RBAC` | Chỉ dùng khi chạy `npm run seed` |

> **Bảo mật khi bàn giao:** không commit `.env`; cấp secret thật qua kênh an toàn; xoay
> (rotate) mọi khóa mẫu trước khi lên production. Đổi `TOTP_ENCRYPTION_KEY` = mọi người
> phải thiết lập lại 2FA.

### 3.2. Front-end (`front-end/.env`)

| Biến | Ghi chú |
| --- | --- |
| `VITE_API_BASE_URL` | Gốc API, vd `http://localhost:3001/api` |
| `VITE_MEDIA_BASE_URL` | Gốc media, vd `http://localhost:3001/media` |
| `VITE_PUBLIC_SITE_URL` | Địa chỉ trang khách in trên QR hiện vật; trống thì dùng origin đang mở CMS |

---

## 4. Cài đặt & chạy local

```bash
# 0. Yêu cầu: Node >= 20, PostgreSQL đang chạy, đã tạo database trống.

# 1. Back-end
cd back-end
cp .env.example .env            # rồi điền DATABASE_URL, secret...
npm install
npm run migration:run           # tạo schema (synchronize luôn tắt)
npm run seed                    # tạo RBAC + tài khoản admin đầu tiên (SEED_ADMIN_*)
npm run seed:translations       # (tùy chọn) chuỗi dịch UI công khai
npm run seed:demo               # (tùy chọn) nội dung demo
npm run dev                     # API watch tại http://localhost:3001 (Swagger: /api/docs)

# 2. Front-end (terminal khác)
cd front-end
cp .env.example .env
npm install
npm run dev                     # http://localhost:5173
```

Tiện lợi: script `./start.sh` ở gốc repo tự kiểm tra Node, copy `.env`, cài đặt và chạy
cả hai app.

---

## 5. Lệnh thường dùng

| Việc | Back-end (trong `back-end/`) | Front-end (trong `front-end/`) |
| --- | --- | --- |
| Chạy dev | `npm run dev` | `npm run dev` |
| Build | `npm run build` | `npm run build` |
| Typecheck | `npm run typecheck` | `npm run typecheck` |
| Lint | `npm run lint` | `npm run lint` |
| Test | `npm test`, `npm run test:coverage` | `npm run test:unit`, `npm test` (Playwright) |
| Migration | `npm run migration:generate`, `migration:run`, `migration:revert` | — |
| Seed | `npm run seed`, `seed:translations`, `seed:demo`, `seed:models` | — |
| Xuất OpenAPI | `npm run openapi:export` → `docs/api/openapi.json` | — |

---

## 6. Database: migration & seed

- Schema **chỉ** thay đổi qua migration (`back-end/src/database/migrations/`, hiện có 13
  migration). `synchronize` luôn tắt để tránh sửa schema ngoài kiểm soát.
- Khi đổi entity: `npm run migration:generate` → review file sinh ra → commit → triển khai
  bằng `npm run migration:run`. Có `migration:revert` để lùi một bước.
- Seed:
  - `npm run seed` — RBAC (3 vai trò admin/moderator/editor + quyền) và tài khoản admin
    đầu tiên theo `SEED_ADMIN_EMAIL/PASSWORD`. Idempotent; đặt `SEED_RESET_RBAC=true` để
    khôi phục quyền mặc định cho vai trò đã tùy chỉnh.
  - `seed:translations`, `seed:demo`, `seed:models` — nội dung/bản dịch/model mẫu (tùy chọn).

---

## 7. Lưu trữ media

- `MEDIA_STORAGE_DRIVER=local`: lưu đĩa máy chủ (phù hợp dev). `supabase`: lưu Supabase
  Storage bucket **private**, phục vụ qua URL đã ký ngắn hạn (`MEDIA_SIGNED_URL_TTL_SECONDS`).
- Job nền: dọn **media mồ côi** 03:30 hằng đêm (`MEDIA_ORPHAN_CLEANUP`: `off`/`dry-run`/`on`;
  mặc định `dry-run` vì xóa file không lấy lại được — bật `on` sau khi xem log dry-run);
  **Thùng rác** giữ media xóa mềm `MEDIA_TRASH_RETENTION_DAYS` ngày; dọn job upload đã kết
  thúc khi API khởi động.

---

## 8. Triển khai (deploy)

1. Chuẩn bị biến môi trường production (secret thật ≥ 32 ký tự, `NODE_ENV=production`,
   `DATABASE_SSL=true` nếu dùng Supabase, `TRUST_PROXY` đúng số proxy).
2. Back-end: `npm ci && npm run build && npm run migration:run && npm run start:prod`
   (chạy `node dist/main.js`). API bật shutdown hooks: nhận SIGTERM/SIGINT để dừng cron,
   đóng DB rồi mới thoát.
3. Front-end: `npm ci && npm run build` → phục vụ thư mục `dist/` bằng web server tĩnh
   (CDN/Nginx). Đặt `VITE_*` trỏ đúng API/media production tại thời điểm build.
4. Health check: `GET /api/health` (liveness) và `GET /api/health/ready` (readiness) cho
   load balancer / orchestrator.
5. Bảo mật: Helmet đặt security headers cho mọi response; CORS theo `FRONTEND_ORIGIN`;
   refresh token là cookie `httpOnly`.

---

## 9. CI/CD

Workflow `.github/workflows/ci.yml` chạy trên PR:

- **Back-end:** `typecheck` → `lint` → `build` → `test` → `test:coverage`.
- **Front-end:** `typecheck` → `lint` → `test:unit` → `build` (và E2E Playwright).

Quy ước Git: nhánh từ `dev`, commit nhỏ & chi tiết, luôn mở PR vào `dev` rồi merge; CI
phải xanh trước khi merge.

---

## 10. Runbook vận hành (sự cố thường gặp)

| Tình huống | Hướng xử lý |
| --- | --- |
| API không khởi động, log `Invalid environment: ...` | Thiếu/sai biến env (thường `DATABASE_URL` hoặc secret production yếu). Kiểm tra `.env` theo `.env.example`. |
| Không kết nối được DB | Kiểm tra `DATABASE_URL`, `DATABASE_SSL`, mạng/pooler; Supabase dùng Session pooler cổng 5432. |
| Visitor không thấy nội dung mới | Nội dung còn ở revision chờ duyệt — cần kiểm duyệt viên xuất bản (xem CMS guide §3). |
| Ảnh/model 3D không tải | Kiểm tra driver media, `MEDIA_PUBLIC_BASE_URL`, hạn URL ký; với Supabase kiểm tra bucket/khóa. |
| Bị rate limit (429) ở trang công khai | Khách chung IP: tăng `PUBLIC_API_RATE_LIMIT`/`PUBLIC_MEDIA_RATE_LIMIT`. |
| Cần điều tra hành động quản trị | Tra **Audit log** (`/admin/audit`, cần `audit:read`): ai, làm gì, khi nào. |
| Rò rỉ/nghi lộ secret | Xoay khóa (`JWT_ACCESS_SECRET`, `MEDIA_URL_SIGNING_SECRET`, `TOTP_ENCRYPTION_KEY`), buộc đăng nhập lại; lưu ý đổi TOTP key = reset 2FA toàn hệ thống. |

---

## 11. Tài liệu liên quan

- API: [`docs/api/README.md`](../api/README.md), Swagger `/api/docs`, spec [`docs/api/openapi.json`](../api/openapi.json).
- CMS: [`docs/guides/cms-user-guide.md`](../guides/cms-user-guide.md).
- Yêu cầu & nghiệm thu: [`docs/requirements.md`](../requirements.md), [`docs/handover/acceptance-report.md`](./acceptance-report.md).
- Kiến trúc: [`docs/architecture/`](../architecture/).
