# 07 — Vận hành và xử lý sự cố

> Lỗi thường gặp, bảo mật khóa/mật khẩu, giới hạn gói free, và checklist trước demo/deploy.

## 1. Bảng tra lỗi

### Khởi động / kết nối DB

| Triệu chứng | Nguyên nhân thường gặp | Xử lý |
|---|---|---|
| App không khởi động, lỗi validation `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | `MEDIA_STORAGE_DRIVER=supabase` nhưng thiếu biến, hoặc khóa < 20 ký tự | Điền đủ ([01 §3](01-thiet-lap-project.md#3-biến-môi-trường)) |
| Lỗi validation `MEDIA_URL_SIGNING_SECRET` | < 32 ký tự (vd còn chuỗi mẫu `<...>`) | `openssl rand -hex 32` |
| `getaddrinfo ENOTFOUND db.<ref>.supabase.co` / `ENETUNREACH` | Dùng Direct connection (IPv6) | Đổi sang Session pooler |
| `password authentication failed for user "postgres"` | Thiếu hậu tố `.<ref>` ở user, sai mật khẩu, hoặc mật khẩu đã bị reset | User phải là `postgres.<ref>`; lấy lại chuỗi từ **Connect** |
| `Tenant or user not found` | Sai region trong host pooler hoặc sai `<ref>` | Copy nguyên chuỗi từ dashboard |
| `self-signed certificate in certificate chain` | Bật TLS xác thực nhưng sai CA, hoặc URL vẫn có `sslmode` | [02 §2](02-ket-noi-database.md#2-tls-hai-cách-cấu-hình) |
| `no pg_hba.conf entry ... no encryption` / `SSL required` | Không bật TLS | `DATABASE_SSL=true` (hoặc `sslmode=require`) |
| `remaining connection slots are reserved` / `max clients reached` | Quá nhiều tiến trình giữ pool | Tắt `npm run dev`/test thừa; giảm số tiến trình |
| Kết nối treo rồi timeout, dashboard báo **Paused** | Gói free tạm dừng sau 7 ngày không hoạt động | Dashboard → **Restore project** (vài phút) |
| Password lạ / ký tự `@` làm hỏng URL | Mật khẩu chưa URL-encode | Encode (`@`→`%40`, `#`→`%23`…) |

### Storage / phân phối file

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Upload 500, log `Supabase Storage từ chối ghi ...: 400 Bucket not found` | Sai `SUPABASE_STORAGE_BUCKET` hoặc chưa tạo bucket | Tạo bucket / sửa tên |
| Upload 500, `... 403` / `Invalid Compact JWS` / `signature verification failed` | Dùng `sb_publishable_...`/`anon` thay vì secret, hoặc khóa đã bị thu hồi | Dùng `sb_secret_...` còn hiệu lực |
| Upload 500, `... 413` / `Payload too large` | Bucket có **File size limit** nhỏ hơn file | Nâng giới hạn bucket (GLB tour tới ~29 MB) |
| File đã publish trả 404, log `File của media <id> không còn trong kho lưu trữ` | Bản ghi `ready` nhưng object không có (đổi driver mà chưa đẩy file, hoặc bị xóa tay) | [05 §3](05-chuyen-du-lieu-va-script.md#3-đối-chiếu-db--bucket) |
| File đã publish trả 404, **không** có log trên | Không thỏa điều kiện công khai: hiện vật ẩn/xóa/lưu trữ, revision không phải published hiện hành, phòng inactive | Kiểm trạng thái hiện vật/phòng ([04 §3](04-phan-phoi-media.md#3-quyết-định-cho-phép-tải)) |
| URL Preview 404 | Hết hạn (mặc định 15 phút), sửa tay query, hoặc vừa đổi `MEDIA_URL_SIGNING_SECRET` | Tải lại trang CMS để lấy URL mới |
| URL trong JSON trỏ `localhost:3001` khi chạy cổng khác / deploy | `MEDIA_PUBLIC_BASE_URL` sai | Đặt đúng origin công khai của API |
| Seek audio/GLB không được, log `Supabase Storage bỏ qua Range` | Supabase trả 200 cho request Range | Chưa gặp (21/10 Range trả 206); báo lại kèm key + log |
| Route GLB tour 503 "Chưa cấu hình kho mô hình" | Thiếu `SUPABASE_*` (route này luôn cần, kể cả driver `local`) | Điền `SUPABASE_URL` + khóa |
| Route GLB tour 502 | Signed URL lỗi, `Content-Length` ≠ `size_bytes` trong DB, mạng ngắt | Kiểm file trên bucket khớp size/checksum ([05 §4](05-chuyen-du-lieu-va-script.md#4-glb-tour-npm-run-seedmodels)) |
| Luôn nhận 200 khi test 304 bằng script | `fetch` tự thêm `Cache-Control: no-cache` | Test bằng `curl`/trình duyệt |
| Xóa media 409 | BR-21: đang trong revision published/in_review | Gỡ khỏi revision mới rồi publish lại, hoặc ẩn/lưu trữ hiện vật trước |
| Xóa hiện vật 409 | Hiện vật đã từng xuất bản hoặc đang visible | Thiết kế; dùng Ẩn/Lưu trữ |

### Đọc log
- `MediaDeliveryController`: `error` khi file mất; `warn` khi stream gián đoạn bất thường.
- `MediaService`: `warn` khi cách ly file, khi dọn file sau xóa/lỗi DB thất bại.
- Bật log SQL TypeORM khi cần soi truy vấn (`logging: true` tạm thời trong `data-source.ts`, đừng commit).

## 2. Bảo mật

### Bí mật và nơi được phép xuất hiện

| Bí mật | Ở đâu | Không bao giờ ở |
|---|---|---|
| Mật khẩu DB (`DATABASE_URL`) | `back-end/.env` | git, chat, ảnh chụp, log, FE |
| `sb_secret_...` / `service_role` | `back-end/.env`, secret của CI/hosting | git, FE, chat |
| `MEDIA_URL_SIGNING_SECRET` | `back-end/.env` | git, FE |
| `sb_publishable_...` | — (dự án không dùng) | — |

`.env` đã nằm trong `back-end/.gitignore` (dòng `.env`). Kiểm: `git check-ignore -v back-end/.env`.

### Thói quen tránh lộ
- **Không** `source .env` / `. ./.env`: `&` trong URL làm shell tách lệnh và in giá trị ra màn hình.
- Khi cần in cấu hình để debug, che giá trị:
  ```bash
  sed -E 's#(postgres(ql)?://[^:]+:)[^@]+@#\1****@#; s/(SECRET|KEY|PASSWORD)([A-Z_]*)=(.{6}).*/\1\2=\3…/' back-end/.env
  ```
- Không dán khóa vào hội thoại AI, issue, PR. Nhờ người khác kiểm cấu hình → gửi bản đã che.

### Khi lỡ lộ — quy trình xoay vòng

| Lộ | Làm ngay | Ảnh hưởng |
|---|---|---|
| **Mật khẩu DB** | Dashboard → Project Settings → Database → **Reset database password** → cập nhật `DATABASE_URL` của **mọi người** và mọi môi trường | Mọi kết nối dùng mật khẩu cũ bị từ chối → báo nhóm trước/ngay |
| **Secret key** | Project Settings → API Keys → tạo khóa mới → cập nhật `.env` → **xóa/thu hồi khóa cũ** | Chỉ tiến trình dùng khóa cũ bị ảnh hưởng (lý do nên đặt khóa riêng theo người/môi trường) |
| **Legacy `service_role`** | Phải **rotate JWT secret** của project → mọi khóa legacy (anon + service_role) đổi | Ảnh hưởng toàn project; ưu tiên chuyển hẳn sang `sb_secret_...` |
| **Khóa ký URL** | Sinh khóa mới, khởi động lại API | Chỉ URL Preview đang mở hết hạn |

Sau khi xoay vòng: kiểm DB/Storage bằng lệnh chỉ đọc ở [01 §4](01-thiet-lap-project.md#4-kiểm-tra-nhanh-sau-khi-điền).

> **Việc còn mở (21/10/2026):** mật khẩu DB của project dùng chung đã bị in ra trong một phiên làm việc
> có AI hỗ trợ khi kiểm thử. Cần reset mật khẩu và phát `DATABASE_URL` mới cho nhóm.

## 3. Gói free và giới hạn

| Giới hạn (gói free, tham khảo) | Ảnh hưởng | Gợi ý |
|---|---|---|
| Project **tạm dừng sau 7 ngày** không hoạt động | Demo hỏng nếu để lâu không dùng | Mở dashboard/chạy API 1–2 ngày trước demo; nếu Paused → Restore |
| Dung lượng DB / Storage / băng thông có hạn mức | GLB lớn + stream qua API tốn băng thông 2 lần | ETag/304; tránh upload GLB thử lặp lại; dọn file test |
| Số kết nối pooler có hạn | Lỗi "max clients" khi nhiều người dev cùng lúc | Tắt tiến trình thừa |
| Không có backup PITR | Lỡ xóa nhầm khó khôi phục | Trước thao tác lớn: `pg_dump` qua session pooler |

Backup thủ công:
```bash
pg_dump "postgresql://postgres.<ref>:<mật-khẩu>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require" \
  --no-owner --no-privileges -Fc -f aura-$(date +%F).dump
```
(Cần `pg_dump` cùng hoặc mới hơn phiên bản Postgres của Supabase.)

## 4. Checklist

### Trước demo
- [ ] Project không ở trạng thái Paused.
- [ ] `migration:show` không còn `[ ]`.
- [ ] Checklist nghiệm thu nhanh ở [06 §6](06-kiem-thu-va-nghiem-thu.md#6-checklist-nghiệm-thu-nhanh-trước-demo--sau-khi-đổi-cấu-hình) đạt.
- [ ] Không còn phòng/hiện vật test (`e2e-*`, `[E2E]`) hiển thị công khai.

### Trước deploy môi trường thật
- [ ] `MEDIA_STORAGE_DRIVER=supabase`, bucket **private**.
- [ ] `MEDIA_URL_SIGNING_SECRET` riêng cho môi trường đó (≥ 32 ký tự ngẫu nhiên).
- [ ] `MEDIA_PUBLIC_BASE_URL` = origin HTTPS công khai của API.
- [ ] TLS DB theo **cách A** (có CA) — [02 §2](02-ket-noi-database.md#2-tls-hai-cách-cấu-hình).
- [ ] Secret key riêng cho môi trường đó, đặt tên rõ (vd `be-prod`).
- [ ] Docker/VPS (plan `261017-0119`): bỏ service `postgres`/`minio` khỏi compose.
- [ ] CORS/`FRONTEND_ORIGIN` đúng domain FE.
- [ ] Backup DB trước khi chạy migration.

## 5. Nợ kỹ thuật đã biết

| Hạng mục | Mô tả | Hướng xử lý |
|---|---|---|
| Hai đường đọc Storage | `ModelStorageService` (signed URL) tách khỏi `MediaStorageService` | Gộp về driver chung; cần review người phụ trách tour |
| Băng thông gấp đôi | Supabase → API → client | Đo trước; nếu nghẽn, cân nhắc redirect signed URL ngắn hạn (tính lại AC-51) |
| TLS chưa xác thực chứng chỉ | `.env` hiện dùng `sslmode=require` | Chuyển cách A |
| DB đi trước `dev` | Migration Task 9 đã chạy trên DB chung trước khi merge | Merge PR Task 9 sớm |
| Quyền media | Mọi route media dùng `media:upload` (chưa có `media:read`/`media:delete`) | Bổ sung permission + migration seed có kiểm soát |
| Không có cột "driver" | Chuyển driver cần đẩy file thủ công | Chấp nhận (YAGNI) tới khi cần nhiều kho |
