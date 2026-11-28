# 13 — Danh mục Kiểm thử và Xác minh Backend

> Mã nguồn kiểm thử: **104 file `*.spec.ts`** trong `back-end/src/` chạy bằng Node built-in test runner (`node -r reflect-metadata -r ts-node/register --test`).

## 1. Phân bổ 104 file kiểm thử theo tầng và module

| Phạm vi (`back-end/src/...`) | Số file `*.spec.ts` | Lệnh npm chạy riêng | Trọng tâm kiểm thử |
|---|---:|---|---|
| `common/tests/` | 11 | `npm run test:core` | `BaseRepository`, `TransactionManager`, RBAC guards, `PublicRateLimitGuard`, `PasswordPolicy`, `SecurityHeaders`, `CsvUtil`, `DeletedFilter`, trash-restore integration |
| `config/tests/` | 1 | `npm run test:core` | `validateEnvironment`, `parseTrustProxy`, khóa production |
| `database/seeds/` | 4 | `npm run test:seed` / `test:models` | Bảo toàn RBAC khi seed lại, idempotency `seed-demo-content`, `seed-storage-models`, `public-ui-strings` |
| `modules/auth/tests/` | 13 | `npm run test:core` | Login, refresh rotation/reuse, `ActiveSessionGuard`, rate limit, change-password, sessions cleanup, 2FA TOTP (unit + integration) |
| `modules/users/tests/` | 2 | `npm run test:core` | `UsersService`, xóa mềm/khôi phục (`users-restore.spec.ts`) |
| `modules/roles/tests/` | 1 | `npm run test:core` | `RolesService` CRUD, soft-delete và ma trận quyền |
| `modules/audit/tests/` | 3 | `npm run test:audit` | `AuditService`, `AuditInterceptor`, xuất CSV |
| `modules/rooms/tests/` | 7 | `npm run test:rooms` | Controller/Service/Repo/DTO, bulk-delete, `room-translations` |
| `modules/exhibits/tests/` | 22 | `npm run test:exhibits` | CRUD, `RevisionPublishGate`, 6 slot media, autosave, deletion policy, gallery slot guard, public search (SQL/contract/integration), bulk transfer, public models, location QR, sitemap XML |
| `modules/media/tests/` | 22 | `npm run test:media` / `test:upload-jobs` | Magic-byte signature/structure, fuzz validator/upload, Local & Supabase driver, URL signing, delivery HTTP (Range/304), cleanup cron, 7 file spec cho async upload jobs |
| `modules/moderation/tests/` | 3 | `npm run test:moderation` | Hàng chờ duyệt, diff song ngữ, publish/reject/hide |
| `modules/content-reports/tests/` | 6 | `npm run test:reports` | Public intake, throttle rate limit, authorization HTTP, triage service/repo |
| `modules/notifications/tests/` | 3 | `npm run test:notifications` *(hoặc `npm test`)* | Service, HTTP endpoints và integration test |
| `modules/partner-api-keys/tests/` | 2 | `npm run test:partner` | Quản lý key, `PartnerApiKeyGuard`, scope & rate limit |
| `modules/translations/tests/` | 2 | `npm run test:translations` | Admin CRUD i18n và endpoint public |
| `modules/stats/tests/` | 1 | `npm run test:stats` | `StatsService` overview/charts/storage |
| `modules/health/tests/` | 1 | `npm run test:health` | Liveness `/health` và readiness `/health/ready` |
| **Tổng cộng** | **104** | `npm test` | Kiểm chứng toàn bộ back-end |

## 2. Cổng chất lượng bắt buộc trước khi merge

Chạy từ thư mục `back-end/`:

```sh
npm run typecheck      # tsc --noEmit && tsc --noEmit -p tsconfig.scripts.json
npm run lint           # eslint .
npm run build          # nest build
npm test               # toàn bộ bộ spec
npm run test:coverage  # ngưỡng bắt buộc >= 80% lines/branches/functions cho phạm vi lõi
```

## 3. Kiểm thử nâng cao: Fuzz, Load Testing và An toàn Database

| Hạng mục | Lệnh / Công cụ | Mô tả |
|---|---|---|
| **Fuzzing kiểm định media** | `npm run test:fuzz` | Chạy `media-upload-fuzz.spec.ts` và `media-validator-fuzz.spec.ts` kiểm chứng chống file lỗi cấu trúc, decompression bomb và payload đánh lừa magic bytes |
| **Tải hàng đợi Upload Jobs** | `npm run load:upload-jobs` | Chạy `src/modules/media/tests/load/upload-jobs.load.ts` đánh giá hành vi FIFO concurrency (`MEDIA_UPLOAD_JOB_CONCURRENCY`) và idempotency dưới tải đồng thời |
| **K6 Load Test API công khai** | `npm run load:k6:prepare` rồi `npm run load:k6` | Kịch bản `load/k6/public-visitor.js` đo độ trễ và thông lượng luồng khách tham quan (`/rooms`, `/rooms/:slug`, `/rooms/search`) |
| **Kiểm thử script load** | `npm run test:load-scripts` | Chạy `scripts/*.spec.ts` xác minh script chuẩn bị dữ liệu k6 |
| **Integration test trên PostgreSQL thật** | Đặt biến `CORE_TEST_DATABASE_URL` | Các file `*.integration.spec.ts` (core DB, RBAC HTTP, trash-restore, 2FA, autosave, gallery-slot-guard, public-search, media-attach, upload-jobs, notifications) chạy trực tiếp trên PostgreSQL cục bộ (vd container `postgres:16-alpine`), không chạm DB production/staging |
| **Diễn tập an toàn & backup/restore DB** | `tools/db/check-db-config.sh` và `tools/db/backup-restore-drill.sh` | Kiểm cấu hình DB chỉ đọc và diễn tập khôi phục trên container tạm đo RPO/RTO |
