# 01 — Thiết lập project Supabase

> Làm một lần khi bắt đầu, hoặc khi chuyển sang project Supabase khác. Kết quả: `back-end/.env`
> có đủ biến để API kết nối DB và đọc/ghi bucket.

## 1. Bức tranh: lấy gì ở đâu

| Cần | Lấy ở dashboard | Điền vào biến |
|---|---|---|
| Chuỗi kết nối DB | **Connect** → tab **Connection String** → Type **URI** → Method **Session pooler** | `DATABASE_URL` |
| Chứng chỉ CA của DB (tùy chọn) | **Project Settings → Database → SSL Configuration → Download certificate** | `DATABASE_SSL_CA` (đường dẫn file) |
| Project URL | **Project Settings → API Keys** (hoặc **Connect**, đoạn `https://<ref>.supabase.co`) | `SUPABASE_URL` |
| Khóa secret | **Project Settings → API Keys → Secret keys** (`sb_secret_...`) | `SUPABASE_SECRET_KEY` |
| Bucket | **Storage → Files → Buckets** | `SUPABASE_STORAGE_BUCKET` |

### Không chọn các tab này trong hộp thoại **Connect**

Hộp thoại Connect có tab **App Frameworks** (Next.js, Remix…), **Mobile**, **ORMs** (Prisma, Drizzle).
Chúng hướng dẫn cài `@supabase/supabase-js` / `@supabase/ssr` và dùng `NEXT_PUBLIC_SUPABASE_URL` +
`sb_publishable_...` để **trình duyệt gọi thẳng Supabase**. Dự án này **không** làm vậy:

| Hướng dẫn App Frameworks giả định | Aura Museum |
|---|---|
| Next.js (`next/headers`, `middleware.ts`, `NEXT_PUBLIC_*`) | FE React + **Vite**, BE **NestJS** |
| Trình duyệt dùng `supabase-js` | FE chỉ gọi API NestJS (`core/api/http-client`) |
| Supabase Auth (cookie session) | JWT access + refresh token tự viết, RBAC |
| Đọc bảng qua PostgREST (`supabase.from(...)`) | TypeORM + `DATABASE_URL` |

> Đừng cài `@supabase/supabase-js` vào `front-end/` hay `back-end/`. Đừng đưa bất kỳ khóa Supabase nào
> vào `front-end/`.

### `sb_publishable_...` vs `sb_secret_...`

| Khóa | Dùng ở đâu | Quyền | Dự án dùng? |
|---|---|---|---|
| `sb_publishable_...` (thay `anon`) | Trình duyệt, app mobile | Bị giới hạn bởi RLS; không đọc được bucket private nếu không có policy | **Không** |
| `sb_secret_...` (thay `service_role`) | Chỉ server | Bỏ qua RLS, đọc/ghi mọi bucket | **Có** — chỉ ở `back-end/.env` |
| `service_role` (legacy JWT) | Chỉ server | Như secret | Dùng được qua `SUPABASE_SERVICE_ROLE_KEY` nếu chưa có secret key |

## 2. Các bước trên dashboard

### Bước 1 — Database
1. Mở project → nút **Connect** ở thanh trên.
2. Tab **Connection String**, Type **URI**, Method **Session pooler**.
3. Copy chuỗi dạng:
   ```
   postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
4. Thay `[YOUR-PASSWORD]` bằng mật khẩu DB. Nếu quên: **Project Settings → Database → Reset database password**
   (mọi người đang dùng mật khẩu cũ sẽ mất kết nối — báo nhóm trước).
5. Mật khẩu có ký tự đặc biệt (`@ : / ? # & %`) phải **URL-encode** (vd `@` → `%40`).

Chọn TLS theo [02-ket-noi-database.md §2](02-ket-noi-database.md#2-tls-hai-cách-cấu-hình).

### Bước 2 — Bucket
1. **Storage → Files → New bucket**, tên `museum-assets` (nếu chưa có — bucket này dùng chung với GLB tour).
2. **Tắt "Public bucket"**. Bucket public sẽ cho phép tải file không qua API → phá AC-51 (Ẩn có hiệu lực ngay).
3. **Không đặt "File size limit" thấp hơn file lớn nhất đang có.** Hiện `models/tuong_than_shiva_champa.glb`
   ≈ 28,9 MB; giới hạn 25 MB (như plan ban đầu gợi ý) sẽ chặn ghi lại file này. Giới hạn upload qua CMS
   đã nằm ở back-end (GLB ≤ 10 MB, ảnh ≤ 2 MB, MP3 ≤ 10 MB, VTT ≤ 1 MB — xem Task 8).
4. Không cần tạo policy RLS cho bucket: back-end dùng khóa secret (bỏ qua RLS); trình duyệt không truy cập trực tiếp.

Cấu trúc thư mục trong bucket:

```
museum-assets/
├── models/                     ← GLB tour (seed:models), key cố định theo tên
│   └── tuong_vua_champa.glb …
├── uploads/                    ← media upload qua CMS, key do server sinh
│   ├── models/<uuid>.glb
│   ├── images/<uuid>.(jpg|png|webp)
│   ├── audio/<uuid>.mp3
│   └── subtitles/<uuid>.vtt
└── quarantine/<uuid>.bin       ← file nghi ngờ, KHÔNG bao giờ được phân phối
```

### Bước 3 — Khóa API
1. **Project Settings → API Keys**.
2. Project URL → `SUPABASE_URL` (không có `/` cuối; code tự cắt nếu có).
3. **Secret keys** → Reveal / Create → `sb_secret_...` → `SUPABASE_SECRET_KEY`.
   - Đặt tên khóa theo người/môi trường (vd `be-local-thanh`, `be-prod`) để thu hồi riêng khi cần.
   - **Tự dán vào `.env`**, không dán vào chat, issue, PR, ảnh chụp màn hình.

## 3. Biến môi trường

File: `back-end/.env` (đã `.gitignore`). Mẫu đầy đủ: `back-end/.env.example`.

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Chuỗi Session pooler |
| `DATABASE_SSL` | | `false` | `true` → bật TLS bằng cấu hình code (xem [02](02-ket-noi-database.md)) |
| `DATABASE_SSL_CA` | | — | Đường dẫn CA, vd `certs/supabase-ca.crt`; có → xác thực chứng chỉ |
| `MEDIA_STORAGE_DRIVER` | | `local` | `local` (đĩa) \| `supabase` |
| `SUPABASE_URL` | khi `supabase` | — | `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | khi `supabase`* | — | `sb_secret_...`, ≥ 20 ký tự |
| `SUPABASE_SERVICE_ROLE_KEY` | khi `supabase`* | — | Khóa legacy, dùng khi không có secret key |
| `SUPABASE_STORAGE_BUCKET` | | `museum-assets` | Tên bucket private |
| `MEDIA_PUBLIC_BASE_URL` | | `http://localhost:3001` | Origin công khai của API, dùng dựng URL media tuyệt đối |
| `MEDIA_URL_SIGNING_SECRET` | ✅ ở môi trường thật | khóa dev | Khóa HMAC ký URL Preview, ≥ 32 ký tự |
| `MEDIA_SIGNED_URL_TTL_SECONDS` | | `900` | Hạn URL ký, 60–86400 giây |

\* Cần **một trong hai** khóa. `SUPABASE_SECRET_KEY` được ưu tiên.

Validation ở `back-end/src/config/env.validation.ts`: app **không khởi động** nếu `MEDIA_STORAGE_DRIVER=supabase`
mà thiếu `SUPABASE_URL` hoặc cả hai khóa, hoặc `MEDIA_URL_SIGNING_SECRET` < 32 ký tự.
Ánh xạ env → config namespaced ở `back-end/src/config/media.config.ts` (`media.storageDriver`,
`media.supabase.url|serviceKey|bucket`, `media.publicBaseUrl`, `media.urlSigningSecret`, `media.signedUrlTtlSeconds`).

### Mẫu `.env` khi dùng Supabase

```env
# Database — Session pooler
DATABASE_URL=postgresql://postgres.<ref>:<mật-khẩu>@aws-0-<region>.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
DATABASE_SSL_CA=certs/supabase-ca.crt

# Storage
MEDIA_STORAGE_DRIVER=supabase
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_STORAGE_BUCKET=museum-assets

# Phân phối media
MEDIA_PUBLIC_BASE_URL=http://localhost:3001
MEDIA_URL_SIGNING_SECRET=<openssl rand -hex 32>
MEDIA_SIGNED_URL_TTL_SECONDS=900
```

Tạo khóa ký: `openssl rand -hex 32` (64 ký tự hex). Mỗi môi trường một khóa riêng; đổi khóa làm mọi URL
Preview đang mở hết hiệu lực (không ảnh hưởng URL công khai).

## 4. Kiểm tra nhanh sau khi điền

```bash
cd back-end

# 1) DB: liệt kê migration (chỉ đọc)
npx typeorm-ts-node-commonjs migration:show -d src/config/data-source.ts

# 2) Storage: đọc cấu hình bucket (chỉ đọc) — in public:false là đúng
node -e '
process.loadEnvFile(".env");
const k = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket/${process.env.SUPABASE_STORAGE_BUCKET}`,
  { headers: { apikey: k, Authorization: `Bearer ${k}` } })
  .then(r => r.json()).then(b => console.log({ name: b.name, public: b.public, limit: b.file_size_limit }));
'

# 3) Khởi động API
npm run dev
```

> **Không** nạp `.env` vào shell bằng `. ./.env` hoặc `source .env`: ký tự `&` trong `DATABASE_URL`
> (vd `?sslmode=require&...`) khiến shell tách lệnh và **in mật khẩu ra terminal**. Dùng
> `process.loadEnvFile('.env')` trong Node hoặc `dotenv`.

Kết quả mong đợi và cách xử lý lỗi: [07-van-hanh-va-xu-ly-su-co.md](07-van-hanh-va-xu-ly-su-co.md).
