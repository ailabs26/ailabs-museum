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

## 3. Lịch sử 13 Migration (`src/database/migrations/`)

Toàn bộ lược đồ hiện tại được dựng tuần tự qua **13 file migration**:

| # | Timestamp & Tên migration | Thay đổi chính |
|---|---|---|
| 1 | `1791483209234-AlignMuseumMvpSchema` | Khởi tạo extension (`uuid-ossp`, `citext`) và lược đồ nền MVP (rooms, exhibits, revisions, hotspots, media, users, roles, permissions, sessions, reports, audit) |
| 2 | `1791948600000-ExtendMediaUploadPipeline` | Mở rộng bảng `media` cho pipeline kiểm tra định dạng, checksum, rights, alt text và xóa mềm |
| 3 | `1792073130413-AddRevisionLocalizedMedia` | Thêm các cột media đa ngôn ngữ (`audio_en_media_id`, `subtitle_vi_media_id`, `subtitle_en_media_id`) và partial index trên `exhibit_revisions` |
| 4 | `1792150000000-WidenHotspotLabel` | Mở rộng độ dài nhãn hotspot hỗ trợ mô tả đa ngôn ngữ/chi tiết hơn |
| 5 | `1792943375524-AddRefreshSessionDeviceInfo` | Bổ sung thông tin thiết bị (`signed_in_at`, `user_agent`, `ip`) vào `refresh_sessions` cho quản lý phiên đăng nhập |
| 6 | `1793033761577-SoftDeleteRoles` | Bổ sung `is_deleted`, `deleted_at` và partial unique index `UQ_roles_code_active` cho `roles` |
| 7 | `1793300000000-AddTranslationsAndPartnerApiKeys` | Tạo bảng `translations` (CMS i18n) và `partner_api_keys` (tích hợp đối tác) |
| 8 | `1793400000000-PartnerApiKeyRateLimitAndSoftDelete` | Thêm `rate_limit_per_minute`, `is_deleted`, `deleted_at` cho `partner_api_keys` |
| 9 | `1793500000000-AuditNullableResourceAndClientInfo` | Cho phép `resource_id` nullable và bổ sung `ip`, `user_agent` vào `audit_logs` |
| 10 | `1793600000000-AddNotifications` | Tạo bảng `notifications` kèm index `(user_id, created_at)` và partial index chưa đọc |
| 11 | `1793700000000-AddTwoFactor` | Thêm các cột TOTP (`totp_enabled_at`, `totp_secret_enc`, `totp_pending_enc`, `totp_last_step`) vào `users` và tạo bảng `user_recovery_codes` |
| 12 | `1793800000000-AddMediaUploadJobs` | Tạo bảng `media_upload_jobs` cho hàng đợi upload bất đồng bộ hỗ trợ `idempotency_key` |
| 13 | `1793900000000-AddRoomTranslations` | Thêm cột JSONB `translations` cho bảng `rooms` |

### Quy tắc an toàn migration

- Chỉ người phụ trách database chạy `npm run migration:run` / `migration:revert` trên DB dùng chung.
- Không sửa hoặc xóa file migration đã chạy; luôn tạo migration mới cho thay đổi tiếp theo.
- Không chỉnh sửa thủ công bảng `public.migrations` do TypeORM quản lý.
