# 02 — Kết nối database Supabase

> TypeORM 0.3 + driver `pg` kết nối PostgreSQL của Supabase. Tài liệu này giải thích chọn kiểu
> kết nối, cấu hình TLS, và cách chạy migration an toàn trên **DB dùng chung của nhóm**.

## 1. Chọn kiểu kết nối

Supabase cho 3 cách kết nối. Dự án dùng **Session pooler** cho cả app lẫn migration.

| Kiểu | Host / cổng | IPv4 | Prepared statement / session | Dùng? |
|---|---|---|---|---|
| Direct connection | `db.<ref>.supabase.co:5432` | ❌ chỉ IPv6 (gói free) | ✅ | Không — mạng nhà/trường thường không có IPv6 |
| **Session pooler** | `aws-0-<region>.pooler.supabase.com:5432` | ✅ | ✅ (giữ nguyên session) | **Có** |
| Transaction pooler | `aws-0-<region>.pooler.supabase.com:6543` | ✅ | ❌ (trả kết nối sau mỗi transaction) | Không — migration TypeORM dùng nhiều lệnh/advisory lock, dễ lỗi |

Đặc điểm chuỗi Session pooler: user là `postgres.<ref>` (có hậu tố project ref), cổng **5432**.

### Kích thước pool
Session pooler giới hạn số client theo gói (free ≈ vài chục). Mỗi tiến trình API giữ một pool `pg`
(mặc định 10 kết nối). Khi chạy nhiều tiến trình cùng lúc (dev của nhiều người + script + test) có thể
gặp `remaining connection slots are reserved` / `max clients reached` → tắt bớt tiến trình thừa
(`npm run dev` để quên, test integration).

## 2. TLS: hai cách cấu hình

Supabase yêu cầu TLS. Code ở `back-end/src/config/data-source.ts`:

```ts
function sslOptions() {
  if (process.env.DATABASE_SSL !== 'true') return undefined;
  const caPath = process.env.DATABASE_SSL_CA;
  return caPath ? { ca: readFileSync(caPath, 'utf8') } : { rejectUnauthorized: false };
}
```

| Cách | Cấu hình | Mã hóa | Xác thực chứng chỉ server | Khuyên dùng |
|---|---|---|---|---|
| **A — CA (khuyên dùng)** | URL **không** có `?sslmode=`; `DATABASE_SSL=true`; `DATABASE_SSL_CA=certs/supabase-ca.crt` | ✅ | ✅ chống MITM | Môi trường thật, demo |
| B — không CA | `DATABASE_SSL=true`, bỏ trống `DATABASE_SSL_CA` | ✅ | ❌ (`rejectUnauthorized: false`) | Tạm thời |
| C — tham số URL | `...postgres?sslmode=require&uselibpqcompat=true`, không đặt `DATABASE_SSL` | ✅ | ❌ (`require` theo ngữ nghĩa libpq) | Tạm thời — đang dùng ở `.env` của Thành (21/10/2026) |

### Đừng trộn A/B với C
Driver `pg` **ưu tiên tham số SSL trong connection string** hơn object `ssl` của code. Nếu URL còn
`sslmode=...` thì `DATABASE_SSL_CA` bị bỏ qua âm thầm → tưởng đã xác thực chứng chỉ nhưng thực ra không.
Chọn một cách duy nhất.

### Chuyển sang cách A
1. Dashboard → **Project Settings → Database → SSL Configuration → Download certificate**.
2. Lưu thành `back-end/certs/supabase-ca.crt` (thư mục `certs/` chỉ chứa CA công khai; vẫn không commit
   nếu nhóm chưa thống nhất).
3. Sửa `.env`:
   ```env
   DATABASE_URL=postgresql://postgres.<ref>:<mật-khẩu>@aws-0-<region>.pooler.supabase.com:5432/postgres
   DATABASE_SSL=true
   DATABASE_SSL_CA=certs/supabase-ca.crt
   ```
4. Kiểm tra: `npx typeorm-ts-node-commonjs migration:show -d src/config/data-source.ts`.
   Lỗi `self-signed certificate in certificate chain` → sai file CA hoặc URL vẫn còn `sslmode`.

`DATABASE_SSL_CA` là đường dẫn **tương đối với thư mục chạy lệnh** (`back-end/`).

## 3. Một nguồn cấu hình duy nhất

| Nơi | Dùng cho | Cách lấy cấu hình |
|---|---|---|
| `dataSource` | TypeORM CLI: `migration:run/revert/generate/show`, `seed`, script | `back-end/src/config/data-source.ts` — đọc thẳng `process.env` (qua `dotenv`) |
| `DatabaseModule` | App NestJS khi chạy | `TypeOrmModule.forRoot({ ...dataSource.options, autoLoadEntities: false })` trong `back-end/src/database/database.module.ts` |

App và CLI **dùng chung `dataSource.options`** → URL, TLS, danh sách entity, migration luôn giống nhau.
`config/database.config.ts` (namespace `database`) chỉ để đọc `database.url` khi cần, **không** quyết định
kết nối. Sửa TLS/entity → sửa `data-source.ts`. Thêm entity mới → thêm vào mảng `entities` ở đó.

## 4. Migration trên DB dùng chung

Project `ailabs-museum` (org của nguyenthangdev, branch `main` gắn nhãn **PRODUCTION**) là **DB dùng chung
của cả nhóm**. Mọi lệnh ghi ở đây ảnh hưởng tới mọi người.

### Quy tắc
1. **Xem trước, chạy sau:**
   ```bash
   npx typeorm-ts-node-commonjs migration:show -d src/config/data-source.ts
   # [X] = đã chạy, [ ] = chờ chạy
   ```
2. **Đọc file migration** trước khi chạy. Chỉ chạy ngay nếu là thay đổi cộng thêm
   (ADD COLUMN nullable, CREATE INDEX, bảng mới). DROP/RENAME/đổi kiểu → báo nhóm, có kế hoạch backup.
3. **Ưu tiên chạy migration sau khi code đã vào `dev`.** Nếu chạy từ nhánh chưa merge, DB đi trước
   `dev`: người khác chạy `migration:generate` từ `dev` sẽ thấy "drift ngược" và có thể sinh migration
   xóa cột của bạn.
4. Không dùng `synchronize: true` (luôn tắt — xem CLAUDE.md).
5. `migration:revert` chỉ khi chắc chắn; một số `down()` cố ý **từ chối** nếu còn dữ liệu
   (vd `AddRevisionLocalizedMedia`, `ExtendMediaUploadPipeline`).

### Lịch sử trên DB dùng chung

| Migration | Nội dung | Chạy |
|---|---|---|
| `AlignMuseumMvpSchema1791483209234` | Schema MVP | trước 14/10 |
| `ExtendMediaUploadPipeline1791948600000` | Task 8: `author`, `original_name`, `created_at`; kind `subtitle`; state `quarantined` | 14/10/2026 |
| `AddRevisionLocalizedMedia1792073130413` | Task 9: `audio_en_media_id`, `subtitle_vi_media_id`, `subtitle_en_media_id` + FK `RESTRICT` + 7 index một phần | **21/10/2026** (từ `feat/supabase-storage`, trước khi Task 9 vào `dev`) |

> Hệ quả của dòng cuối: cho tới khi PR Task 9 merge, ai chạy `migration:generate` từ `dev` trên DB này
> sẽ thấy 3 cột + index "thừa". **Không commit migration sinh ra như vậy**; merge Task 9 trước.

## 5. `npm run seed` — đọc kỹ trước khi chạy

`back-end/src/database/seeds/seed.ts` làm 3 việc:

| Bước | Hành vi | An toàn chạy lại? |
|---|---|---|
| `seedPermissions` | Thêm permission còn thiếu (theo `ALL_PERMISSIONS`) | ✅ chỉ thêm |
| `seedRoles` | Thêm role còn thiếu, rồi **`DELETE` toàn bộ `role_permissions` của từng role và ghi lại theo `DEFAULT_ROLE_PERMISSIONS`** | ⚠️ **Xóa mọi chỉnh sửa ma trận quyền đã làm qua UI** |
| `seedAdmin` | Tạo `SEED_ADMIN_EMAIL` nếu chưa có, gán role admin | ✅ không đổi mật khẩu user đã có |

**Chỉ chạy `seed` trên DB dùng chung khi** nhánh thêm permission mới **và** nhóm đồng ý reset ma trận quyền.
Kiểm tra nhánh có đổi quyền không:

```bash
git diff origin/dev -- back-end/src/common/constants/permissions.constant.ts
```

Không có diff → không cần `seed`. (Task 9 / Supabase: không có diff → đã **không** chạy seed ngày 21/10.)

Các seed khác:

| Lệnh | Làm gì | Ghi chú |
|---|---|---|
| `npm run seed:demo` | 5 hiện vật `[Mẫu]` placeholder ở phòng `phong-lich-su-quan-su-viet-nam` | Đã có trên DB chung |
| `npm run seed:models` | Kiểm checksum 5 GLB trên bucket rồi tạo phòng `bo-suu-tap-glb` + media/hiện vật | Cộng thêm, khóa advisory, dừng nếu trùng ID/path — xem [05](05-chuyen-du-lieu-va-script.md) |

## 6. Truy vấn chỉ-đọc khi cần soi dữ liệu

Dùng `dataSource` của dự án (đã có TLS) thay vì cài `psql`:

```bash
cd back-end
cat > src/__q.ts <<'EOF'
import { dataSource } from './config/data-source';
(async () => {
  await dataSource.initialize();
  console.log(await dataSource.query(`SELECT kind, processing_state, storage_key FROM media WHERE is_deleted = false`));
  await dataSource.destroy();
})();
EOF
npx ts-node src/__q.ts; rm -f src/__q.ts
```

Hoặc **SQL Editor** trên dashboard. Đừng chạy `UPDATE/DELETE` tay trên DB chung nếu không có lý do rõ
và không ghi lại (xem cách dọn dữ liệu test ở [06 §5](06-kiem-thu-va-nghiem-thu.md#5-dọn-dữ-liệu-test)).
