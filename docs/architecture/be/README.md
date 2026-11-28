# Kiến trúc Backend & Các Module — Aura Museum API

> Phạm vi: toàn bộ ứng dụng `back-end/` (**NestJS 10 + TypeScript + TypeORM + PostgreSQL**).
> Tài liệu phản ánh **mã nguồn đang chạy trên `dev`** gồm tầng hạ tầng (`common/`, `config/`, `database/`) và **14 module nghiệp vụ** trong `back-end/src/modules/`.

Tài liệu này bổ sung chi tiết triển khai cho bản thiết kế tổng thể tại [02-backend-architecture.md](../02-backend-architecture.md) và quy ước mã nguồn tại [coding-conventions.md](coding-conventions.md).

## Tổng quan 14 module trong `back-end/src/modules/`

| Nhóm | Module | Trách nhiệm chính | Entity sở hữu |
|---|---|---|---|
| Xác thực & phân quyền | `auth` | Đăng nhập, JWT access, refresh token xoay vòng, phiên thiết bị, 2FA TOTP | `RefreshSession`, `UserRecoveryCode` |
| Xác thực & phân quyền | `users` | CRUD tài khoản quản trị, xóa mềm/khôi phục, gán vai trò | `User`, `UserRole` |
| Xác thực & phân quyền | `roles` | Vai trò, danh mục 31 quyền `resource:action`, ma trận phân quyền | `Role`, `Permission`, `RolePermission` |
| Nhật ký & thông báo | `audit` | Nhật ký append-only, `@Audit()` interceptor, `PermissionDeniedFilter`, xuất CSV | `AuditLog` |
| Nhật ký & thông báo | `notifications` | Chuông thông báo trong CMS theo người dùng, bộ đếm chưa đọc | `Notification` |
| Nội dung bảo tàng | `rooms` | CRUD phòng trưng bày, API public chỉ đọc, bản dịch JSONB | `Room` |
| Nội dung bảo tàng | `exhibits` | Hiện vật, phiên bản (`ExhibitRevision`), hotspot, 5 bục Gallery V1, tìm kiếm, import/export, sitemap | `Exhibit`, `ExhibitRevision`, `Hotspot` |
| Nội dung bảo tàng | `media` | Upload & kiểm tra byte thực tế, lưu trữ Local/Supabase, URL ký HMAC, Range/304, hàng đợi upload bất đồng bộ | `Media`, `MediaUploadJob` |
| Kiểm duyệt & báo cáo | `moderation` | Hàng chờ duyệt `in_review`, diff song ngữ, publish/reject, ẩn/hiện hiện vật | *(dùng `Exhibit`, `ExhibitRevision`)* |
| Kiểm duyệt & báo cáo | `content-reports` | Khách gửi báo cáo vi phạm (throttle), phân công/xử lý/bỏ qua phía admin | `ContentReport` |
| Đa ngôn ngữ & tích hợp | `translations` | Bản dịch chuỗi giao diện CMS/Public cho 6 ngôn ngữ (`vi, en, fr, zh, ko, ja`) | `Translation` |
| Đa ngôn ngữ & tích hợp | `partner-api-keys` | Cổng đối tác `/api/partner/v1/*`, API key băm SHA-256, scope và rate limit theo key | `PartnerApiKey` |
| Quan sát & vận hành | `stats` | Tổng hợp số liệu Dashboard admin (overview, biểu đồ 14 ngày, dung lượng media) | *(chỉ đọc tổng hợp)* |
| Quan sát & vận hành | `health` | Probe liveness `/api/health` và readiness `/api/health/ready` (`SELECT 1`) | *(không có entity)* |

## Sơ đồ phụ thuộc tổng thể

```text
AppModule
├── ConfigModule (isGlobal: app, database, jwt, media, reports + validateEnvironment)
├── ScheduleModule (cron dọn refresh_sessions & media mồ côi)
├── DatabaseModule (TypeORM DataSource: 18 entities, synchronize=false)
├── CommonModule (@Global: TransactionManager, PasswordService, PublicRateLimiter)
├── AuthModule (APP_GUARD: JwtAuthGuard -> ActiveSessionGuard -> PermissionsGuard)
│   ├── UsersModule ──► RolesModule
│   └── AuditModule (APP_INTERCEPTOR: AuditInterceptor; Filter: PermissionDeniedFilter)
├── RoomsModule ──► ExhibitsModule ──► MediaModule (Local / Supabase Storage)
├── ModerationModule ──► ExhibitsModule (RevisionPublishGate) + NotificationsModule
├── ContentReportsModule (ThrottlerModule) ──► NotificationsModule + UsersModule
├── TranslationsModule
├── PartnerApiKeysModule (PartnerApiKeyGuard) ──► ExhibitsModule + RoomsModule
├── StatsModule (chỉ đọc tổng hợp)
└── HealthModule (liveness + readiness)
```

## Mục lục tài liệu

| # | Tài liệu | Nội dung |
|---|---|---|
| — | [coding-conventions.md](coding-conventions.md) | Quy ước đặt tên, cấu trúc 3 lớp Controller → Service → Repository và chuẩn DTO |
| — | [public-exhibit-search.md](public-exhibit-search.md) | Chi tiết thiết kế API tìm kiếm hiện vật công khai (`GET /api/rooms/search`, VT-077) |
| 01 | [01-bootstrap-and-config.md](01-bootstrap-and-config.md) | Khởi động NestJS (`main.ts`, `AppModule`), pipeline HTTP, namespace cấu hình và kiểm định biến môi trường |
<!-- INDEX_ENTRIES -->

## Nguyên tắc kiến trúc cốt lõi

1. **Controller → Service → Repository**: chỉ tầng Repository gọi TypeORM `Repository`/`QueryBuilder`; Service nhận và trả DTO, không bao giờ lộ entity thô hay trường nhạy cảm (`passwordHash`, `totpSecretEnc`, `tokenHash`, `keyHash`).
2. **Mặc định khóa, mở tường minh**: 3 guard toàn cục chạy trên mọi route; chỉ route public mới gắn `@Public()`.
3. **Giao dịch nguyên tử qua `TransactionManager`**: mọi thao tác liên bảng (publish revision, bulk delete/restore, bật 2FA, dọn thùng rác) truyền `EntityManager` chung để đảm bảo nhất quán và khóa bản ghi (`FOR SHARE` / `FOR UPDATE`).
4. **Schema đổi qua migration**: `synchronize: false` cố định trên mọi môi trường; mọi thay đổi lược đồ đi qua `src/database/migrations/`.
