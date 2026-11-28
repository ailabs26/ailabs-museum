# 03 — Cơ sở dữ liệu, Migration và Seed

> Mã nguồn: `back-end/src/database/database.module.ts`, `back-end/src/config/data-source.ts`, `back-end/src/database/migrations/*`, `back-end/src/database/seeds/*`, `back-end/src/database/scripts/*`.

## 1. Kết nối `DatabaseModule` và `data-source.ts`

`DatabaseModule` gọi `TypeOrmModule.forRoot({ ...dataSource.options, autoLoadEntities: false })`, dùng chung đúng một đối tượng `DataSource` với TypeORM CLI để đảm bảo danh sách entity và migration ở runtime luôn trùng khớp 100% với CLI.

- **`synchronize: false`**: cố định, không bao giờ tự sửa bảng khi boot app.
- **TLS / SSL (`sslOptions()`)**:
  - Khi `DATABASE_SSL !== 'true'`: không bật SSL (dùng cho PostgreSQL local/Docker).
  - Khi `DATABASE_SSL === 'true'` và có `DATABASE_SSL_CA`: đọc tệp chứng chỉ CA để xác thực chứng chỉ server (khuyến nghị cho Supabase).
  - Khi `DATABASE_SSL === 'true'` và không có `DATABASE_SSL_CA`: bật mã hóa với `rejectUnauthorized: false` (chỉ dùng tạm thời).

## 2. Danh mục 18 Entity đã đăng ký trong `dataSource`

| # | Entity | Bảng PostgreSQL | Module sở hữu |
|---|---|---|---|
| 1 | `Room` | `rooms` | `rooms` |
| 2 | `Exhibit` | `exhibits` | `exhibits` |
| 3 | `ExhibitRevision` | `exhibit_revisions` | `exhibits` |
| 4 | `Hotspot` | `hotspots` | `exhibits` |
| 5 | `Media` | `media` | `media` |
| 6 | `MediaUploadJob` | `media_upload_jobs` | `media` |
| 7 | `User` | `users` | `users` |
| 8 | `Role` | `roles` | `roles` |
| 9 | `Permission` | `permissions` | `roles` |
| 10 | `UserRole` | `user_roles` | `users` |
| 11 | `RolePermission` | `role_permissions` | `roles` |
| 12 | `RefreshSession` | `refresh_sessions` | `auth` |
| 13 | `UserRecoveryCode` | `user_recovery_codes` | `auth` |
| 14 | `ContentReport` | `content_reports` | `content-reports` |
| 15 | `AuditLog` | `audit_logs` | `audit` |
| 16 | `Translation` | `translations` | `translations` |
| 17 | `PartnerApiKey` | `partner_api_keys` | `partner-api-keys` |
| 18 | `Notification` | `notifications` | `notifications` |
