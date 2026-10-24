# Biên bản kiểm thử an toàn cơ sở dữ liệu — Backup/Restore, RPO/RTO, cấu hình DB (Task 27)

- **Người thực hiện:** Nguyễn Văn Thắng (Fullstack / Database & Core Backend)
- **Giai đoạn:** 2 — Test kỹ tính năng giai đoạn 1 (15/11 – 20/11/2026)
- **Ngày chạy:** 24/10/2026
- **Nhánh:** `test/phase2-core-db-safety`
- **Công cụ:** `back-end/tools/db/backup-restore-drill.sh`, `back-end/tools/db/check-db-config.sh`
- **Kết luận:** quy trình backup logic → khôi phục **đạt** trên môi trường diễn tập (khôi phục đầy đủ, RTO đo được 10–14 giây). Ở môi trường thật, backup định kỳ hằng ngày đã được lập lịch từ 24/10/2026 (RPO ≤ 24 giờ khi máy chạy backup đang bật; xem §5 #1). Kiểm cấu hình DB Supabase thấy quyền thừa của `anon`/`authenticated` và RLS tắt, nhưng **Data API đã tắt** nên hiện không khai thác được (§4.3).

## 1. Mục tiêu RPO/RTO

Requirements Baseline chưa định lượng RPO/RTO. Mục tiêu dưới đây được đề xuất dựa trên NFR-10 (availability ≥ 99%/30 ngày, tức tối đa ~7,2 giờ gián đoạn mỗi tháng) và NFR-13 (thay đổi CMS đã lưu phải còn sau restart). Cần nhóm xác nhận qua Change Request.

| Chỉ số | Mục tiêu đề xuất (MVP) | Cơ sở |
|---|---|---|
| **RPO** (lượng dữ liệu tối đa được phép mất) | ≤ 24 giờ | Backup logic hằng ngày; nội dung CMS chủ yếu do biên tập viên nhập, nhập lại được trong 1 ngày |
| **RTO** (thời gian tối đa để khôi phục dịch vụ) | ≤ 1 giờ | Nằm gọn trong ngân sách 7,2 giờ/tháng của NFR-10 |

## 2. Phương pháp diễn tập

Toàn bộ chạy trên container Docker tạm (`postgres:16-alpine`); script chỉ kết nối tới các container do chính nó tạo và xóa chúng khi kết thúc.

1. Dựng DB nguồn: chạy 4 migration + seed RBAC + dữ liệu tổng hợp có tiếng Việt và JSONB (`drill-seed.sql`), ghi marker `marker-pre`.
2. **Backup nóng:** `pg_dump -Fc -Z 6` trong khi một tiến trình liên tục ghi `audit_logs` (mô phỏng hệ thống đang chạy).
3. Ghi marker `marker-post` **sau** backup (dữ liệu phát sinh giữa lần backup cuối và sự cố).
4. **Sự cố:** xóa hẳn container nguồn (mất toàn bộ server và dữ liệu).
5. **Khôi phục:** dựng server mới → kiểm sha256 file backup → `pg_restore --exit-on-error -j 4` → `ANALYZE`.
6. **Xác minh:**
   - So vân tay của 14 bảng (số dòng + md5 toàn bộ dòng) và 4 nhóm schema (ràng buộc, index, cột, extension) với nguồn.
   - `marker-pre` phải còn, `marker-post` phải mất.
   - Các dòng ghi đồng thời có trong backup phải liên tục, không thủng chuỗi (chứng minh bản dump là một snapshot nhất quán).
   - Không còn migration chưa chạy.
   - Integration test lõi (16 test, xem báo cáo Task 26) chạy pass trên DB vừa khôi phục.

RTO được tính từ lúc xảy ra sự cố tới lúc xác minh xong, không chỉ tới lúc lệnh restore kết thúc.

## 3. Kết quả diễn tập backup/restore

### 3.1 Số liệu

| Hạng mục | Lần 1 (SCALE=20) | Lần 2 (SCALE=100) |
|---|---|---|
| Dữ liệu nguồn | 37 MB, 110.324 dòng | 150 MB, 551.204 dòng |
| File backup (`-Fc -Z 6`) | 6,0 MB, 94 mục TOC | 30 MB, 94 mục TOC |
| Thời gian backup (đang có ghi đồng thời) | 0,58 s | 2,31 s |
| Ghi đồng thời: nằm trong backup / tổng số đã ghi ở nguồn | 109 / 283, liên tục | 137 / 557, liên tục |
| Cửa sổ mất dữ liệu đo được | 1,79 s | 3,57 s |
| RTO — dựng server mới | 2,20 s | 2,38 s |
| RTO — chuyển file + kiểm checksum | 0,08 s | 0,19 s |
| RTO — `pg_restore -j 4` | 0,63 s | 2,44 s |
| RTO — `ANALYZE` | 0,37 s | 0,47 s |
| RTO — xác minh | 6,35 s | 8,37 s |
| **Tổng RTO** | **9,63 s** | **13,86 s** |
| Vân tay 14 bảng + 4 nhóm schema | Khớp tuyệt đối | Khớp tuyệt đối |
| Migration / integration test trên DB khôi phục | 4 [X] / 16 pass | 4 [X] / 16 pass |

### 3.2 Ca kiểm thử

| Mã | Ca kiểm thử | Kết quả |
|---|---|---|
| DB-01 | Backup khi hệ thống đang ghi vẫn ra một snapshot nhất quán | **ĐẠT** — chuỗi ghi đồng thời không thủng; khóa ngoại được kiểm lại khi restore với `--exit-on-error` |
| DB-02 | Khôi phục sau khi mất toàn bộ server cho dữ liệu giống hệt lúc backup | **ĐẠT** — vân tay khớp tuyệt đối, kể cả tiếng Việt và JSONB |
| DB-03 | Schema khôi phục đầy đủ (ràng buộc, index, extension `citext`/`uuid-ossp`) | **ĐẠT** — 61 ràng buộc, 33 index, 110 cột, 3 extension |
| DB-04 | Dữ liệu ghi sau lần backup cuối bị mất đúng như mô hình RPO | **ĐẠT** — `marker-post` không có trong DB khôi phục |
| DB-05 | Ứng dụng chạy đúng trên DB khôi phục | **ĐẠT** — `migration:show` đủ; 16 integration test lõi pass |
| DB-06 | Phát hiện dữ liệu khôi phục bị sai lệch (kiểm thử âm) | **ĐẠT** — sửa 1 dòng `exhibit_revisions` thì vân tay lệch đúng bảng đó |
| DB-07 | File backup hỏng/bị cắt cụt không được khôi phục âm thầm | **ĐẠT** — sha256 khác bản gốc; `pg_restore` dừng với lỗi `could not read from input file` (exit 1) |
| DB-08 | RTO ≤ 1 giờ | **ĐẠT** ở môi trường diễn tập (13,86 s với 150 MB). Ở môi trường thật cần cộng thời gian tải file và tạo project/đổi `DATABASE_URL` (§5) |
| DB-09 | RPO ≤ 24 giờ | **ĐẠT có điều kiện**: backup hằng ngày bằng `tools/db/backup.sh` (§5 #1); phụ thuộc máy chạy timer đang bật, và bản backup chưa được sao ra ngoài máy đó |

Ghi chú: lần chạy đầu, vân tay ràng buộc bị báo lệch dù dữ liệu khớp. Nguyên nhân: PostgreSQL in lại CHECK dạng `x IN (...)` theo văn bản khác sau dump/restore, nhưng ngữ nghĩa không đổi. Script đã chuẩn hóa định nghĩa trước khi băm; đã đối chiếu từng ràng buộc để xác nhận đây không phải sai lệch thật.

## 4. Kiểm tra an toàn cấu hình DB

### 4.1 Phía ứng dụng (đọc `back-end/.env` + mã nguồn, không kết nối)

| Kiểm tra | Kết quả |
|---|---|
| TypeORM `synchronize` tắt | PASS |
| `.env` bị git bỏ qua và không được track | PASS |
| Supabase pooler ở session mode (cổng 5432, hợp với advisory lock/transaction) | PASS |
| TLS có xác thực chứng chỉ server | **WARN** — `sslmode=require`, không có `DATABASE_SSL_CA`: có mã hóa nhưng không xác thực CA (trùng mục nợ kỹ thuật ở `docs/supabase/07` §5) |

### 4.2 Phía server — DB diễn tập/test cục bộ (PostgreSQL 16.15)

| Kiểm tra | Kết quả |
|---|---|
| `password_encryption = scram-sha-256` | PASS |
| PUBLIC không có quyền CREATE trên schema `public` | PASS |
| Extension bắt buộc, ràng buộc VALID, index hợp lệ, mọi bảng có khóa chính | PASS |
| Mật khẩu trong DB đều là bcrypt; refresh token đều là SHA-256 | PASS |
| Phiên kiểm tra bị khóa READ ONLY | PASS |
| Role ứng dụng là superuser | WARN (chấp nhận ở DB cục bộ) |
| `statement_timeout`, `idle_in_transaction_session_timeout` = 0 | WARN — truy vấn treo hoặc transaction bỏ dở có thể giữ khóa vô hạn |
| `archive_mode=off` | INFO — không có PITR, chỉ dựa vào backup logic |

### 4.3 Phía server — DB Supabase dùng chung (PostgreSQL 17.11, chạy 24/10/2026)

Chạy `tools/db/check-db-config.sh` với phiên bị khóa READ ONLY. Kết quả được kiểm chéo bằng truy vấn catalog chỉ đọc.

| Kiểm tra | Kết quả |
|---|---|
| TLS client → pooler | PASS — TLSv1.3 (`pg_stat_ssl` báo không mã hóa vì chỉ thấy chặng pooler → Postgres nội bộ; script đã sửa để đọc phía client) |
| `password_encryption = scram-sha-256`, role `postgres` không phải superuser, PUBLIC không có CREATE trên `public` | PASS |
| Extension, ràng buộc VALID (40), index hợp lệ (33), mọi bảng có khóa chính | PASS |
| 6 tài khoản đều bcrypt; 814 refresh session đều SHA-256 | PASS |
| `statement_timeout` | PASS — 2 phút |
| `idle_in_transaction_session_timeout` | WARN — 0 |
| Kết nối | PASS — 16/60 |
| `wal_level=logical`, `archive_mode=on` | INFO — Supabase có lưu trữ WAL ở tầng nền tảng; gói hiện tại có cho tải/khôi phục backup hay không phải xem ở Dashboard → Database → Backups |
| Migration | **WARN** — DB có 3/4 migration; thiếu `WidenHotspotLabel1792150000000` (`hotspots.label` vẫn là `varchar(200)` trong khi mã nguồn yêu cầu `text`) |
| Bảng lộ qua Data API (anon/authenticated) | **FAIL ở mức quyền, được chặn nhờ Data API tắt** (xác nhận trên Dashboard 24/10/2026): cả 14 bảng trong `public` (kể cả `users`, `refresh_sessions`, `user_roles`, `migrations`) đều cấp SELECT/INSERT/DELETE cho `anon` và `authenticated`, `anon` có USAGE trên schema `public`, và 0/13 bảng bật RLS |

**Trạng thái thực tế:** Dashboard → Integrations → Data API cho thấy *Enable Data API* đang **tắt**; mọi gọi tới `/rest/v1/` đều lỗi nên rủi ro dưới đây hiện **không khai thác được**. Đây là nợ kỹ thuật, không phải sự cố đang mở.

Ý nghĩa nếu sau này Data API (PostgREST) được bật lại, bất kỳ ai có khóa publishable/anon (khóa được thiết kế để công khai) đều có thể:
- đọc hash mật khẩu và refresh session;
- tự chèn tài khoản + gán role `admin` (`users`, `user_roles`), tức chiếm quyền quản trị;
- xóa dữ liệu.

Mình không thử khai thác để xác nhận; kết luận chỉ dựa trên quyền trong catalog.

Cách sửa an toàn cho back-end: role `postgres` của API là chủ của cả 14 bảng và có `BYPASSRLS = true`, nên bật RLS (không cần policy) **không ảnh hưởng** API, đồng thời chặn hết `anon`/`authenticated`. Chỉ cần làm khi có kế hoạch bật Data API hoặc dùng Supabase client ở front-end; khi đó phải bật RLS và thu hồi quyền của 2 role này **trước** khi bật. Chưa cần migration vì dự án chỉ truy cập DB qua NestJS (YAGNI).

## 5. Phát hiện và đề xuất

| # | Mức | Phát hiện | Đề xuất |
|---|---|---|---|
| 1 | Trung bình (đã xử lý một phần) | Trước 24/10/2026 chưa có backup định kỳ (gói Supabase không có PITR). **Đã làm:** `tools/db/backup.sh` (pg_dump -Fc, kiểm TOC, sha256, giữ 14 ngày, file 600) chạy hằng ngày 12:30 bằng systemd user timer `aura-db-backup.timer` (`Persistent=true`: máy tắt lúc đến giờ thì chạy bù khi đăng nhập). Bản đầu tiên đã kiểm khôi phục được (6 user, 816 session, 3 migration). | **Còn lại:** (a) timer chỉ chạy trên máy của Thắng và chỉ khi đã đăng nhập (Linger=no) → nên chuyển sang VPS/GitHub Actions khi có chỗ chạy; (b) sao bản backup ra ngoài máy (USB/cloud riêng), mã hóa (`age`/`gpg`) vì chứa hash mật khẩu; (c) mỗi tháng chạy `backup-restore-drill.sh` hoặc restore bản mới nhất vào container tạm. |
| 2 | Thấp (đang được chặn) | 14 bảng `public` cấp SELECT/INSERT/DELETE cho `anon`/`authenticated`, RLS tắt hết, nhưng Data API đang tắt (§4.3). | Giữ Data API tắt. Nếu sau này cần bật: trước đó `ENABLE ROW LEVEL SECURITY` cho mọi bảng + `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated`. Chạy lại `check-db-config.sh` sau mọi thay đổi cấu hình Supabase. |
| 2b | Đã xử lý | DB dùng chung thiếu migration `WidenHotspotLabel`. | Đã backup (`aura-2026-10-24-2304-pre-WidenHotspotLabel.dump`) rồi chạy `migration:run` ngày 24/10/2026; `hotspots.label` giờ là `text`, DB đủ 4 migration. |
| 3 | Trung bình | TLS tới Supabase không xác thực CA (`sslmode=require`). | Chuyển sang cách A trong `docs/supabase/02` (`DATABASE_SSL=true` + `DATABASE_SSL_CA`). |
| 4 | Trung bình | `idle_in_transaction_session_timeout = 0` trên cả DB cục bộ và Supabase (Supabase đã có `statement_timeout = 2min`). | `ALTER ROLE <app_role> SET statement_timeout = '30s'; ALTER ROLE <app_role> SET idle_in_transaction_session_timeout = '60s';` Chạy sau khi xác nhận không ảnh hưởng tới migration dài (migration chạy bằng phiên riêng thì đặt lại giá trị cho phiên đó). |
| 5 | Thấp | Ứng dụng dùng role `postgres` (quyền rộng). | Về lâu dài tạo role riêng chỉ có DML trên schema `public` cho API; migration dùng role khác. |
| 6 | Thấp | RTO đo được chưa tính phần đặc thù của môi trường thật: tải file backup về, tạo project Supabase mới hoặc khôi phục project bị pause, đổi `DATABASE_URL`. | Ghi lại thời gian thực tế ở lần diễn tập đầu tiên trên project Supabase thử nghiệm; mục tiêu ≤ 1 giờ vẫn còn dư nhiều. |

## 6. Quy trình khôi phục khi có sự cố thật (runbook rút gọn)

1. Thông báo nhóm và dừng ghi: tắt API hoặc bật chế độ bảo trì.
2. Lấy bản backup mới nhất, so sha256 với giá trị đã lưu. Nếu không khớp thì dùng bản trước đó.
3. Chuẩn bị DB đích: project/DB mới, hoặc DB cũ đã được làm sạch (cần người thứ hai xác nhận trước khi xóa).
4. Khôi phục: `pg_restore --exit-on-error --no-owner --no-privileges -j 4 -d "<url-đích>" aura-YYYY-MM-DD.dump`, sau đó chạy `ANALYZE`.
5. Xác minh:
   - `npx typeorm-ts-node-commonjs migration:show -d src/config/data-source.ts` không còn dòng `[ ]`.
   - `tools/db/check-db-config.sh` không có FAIL.
   - Đăng nhập CMS và mở tour công khai được.
6. Cập nhật `DATABASE_URL`, khởi động API, theo dõi log.
7. Ghi biên bản sự cố: thời điểm backup dùng để khôi phục (tính RPO thực tế) và thời gian từ bước 1 tới bước 6 (tính RTO thực tế).

## 7. Tái hiện

```sh
cd back-end
tools/db/backup-restore-drill.sh                     # SCALE=20, ~30 giây
SCALE=100 OUT_DIR=/tmp/drill tools/db/backup-restore-drill.sh
DATABASE_URL=postgres://...@localhost:.../db tools/db/check-db-config.sh
```

Yêu cầu: Docker, `node_modules` của back-end đã cài. Script tự dọn container khi kết thúc (đặt `KEEP=1` để giữ lại container khôi phục).

## 8. Backup định kỳ (vận hành)

```sh
tools/db/backup.sh                          # chạy tay; BACKUP_DIR (~/aura-backups), KEEP_DAYS (14)
systemctl --user list-timers aura-db-backup.timer   # xem lần chạy kế tiếp
systemctl --user start aura-db-backup.service       # chạy ngay
journalctl --user -u aura-db-backup.service -n 20   # xem log
```

Unit nằm ở `~/.config/systemd/user/aura-db-backup.{service,timer}` (không nằm trong repo). Máy khác cài lại bằng cách tạo 2 file đó trỏ `ExecStart` tới `back-end/tools/db/backup.sh`, rồi `systemctl --user enable --now aura-db-backup.timer`.
