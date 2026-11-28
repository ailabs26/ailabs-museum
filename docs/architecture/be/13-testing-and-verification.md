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
