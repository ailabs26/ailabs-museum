# 01 — Khởi động ứng dụng (Bootstrap) và Cấu hình

> Mã nguồn: `back-end/src/main.ts`, `back-end/src/app.module.ts`, `back-end/src/config/*`.

Tài liệu này mô tả thứ tự khởi tạo máy chủ NestJS (`NestExpressApplication`), chuỗi middleware/pipe/interceptor/filter toàn cục và cơ chế kiểm định biến môi trường khi khởi động.

## 1. Khởi tạo trong `main.ts`

Hàm `bootstrap()` dựng `NestExpressApplication` và cấu hình theo đúng thứ tự sau:

1. **Reverse proxy (`trust proxy`)**: gọi `app.set('trust proxy', config.getOrThrow('app.trustProxy'))` để Express giải đúng `req.ip` từ header `X-Forwarded-For` phục vụ rate limit, lưu phiên đăng nhập và audit log.
2. **Header bảo mật (`helmet`)**: gọi `app.use(helmet(SECURITY_HEADERS))` trước mọi route để áp dụng cho cả lỗi và Swagger UI. Cấu hình đặt `crossOriginResourcePolicy: { policy: 'cross-origin' }` vì front-end và API có thể chạy khác site; riêng file media tự ghi đè CSP/CORP chặt hơn tại `MediaDeliveryController`.
3. **Tiền tố toàn cục (`/api`)**: gọi `app.setGlobalPrefix(apiPrefix, { exclude: [{ path: 'media/uploads/:directory/:fileName', method: RequestMethod.GET }] })`. Mọi API nằm dưới `/api/*`, ngoại trừ route phân phối tệp media giữ nguyên đường dẫn `/media/uploads/:directory/:fileName`.
4. **Cookie parser**: bật `cookieParser()` để `AuthController` đọc refresh token từ httpOnly cookie (`aura_rt`).
5. **CORS**:
   - `origin`: `app.frontendOrigin` (`FRONTEND_ORIGIN`, mặc định `http://localhost:5173`).
   - `credentials: true`: cho phép trình duyệt gửi/nhận refresh cookie.
   - `exposedHeaders: ['Retry-After', 'Content-Disposition']`: để FE đọc số giây chờ khi gặp `429` và tên file khi tải xuống (xuất CSV audit, export hiện vật).
6. **ValidationPipe toàn cục**: `{ whitelist: true, forbidNonWhitelisted: true, transform: true }` — tự loại bỏ/chặn thuộc tính lạ không khai báo trong DTO và ép kiểu primitive theo metadata.
7. **Interceptor & Exception Filter toàn cục**:
   - `ResponseInterceptor` bọc mọi kết quả không phải `StreamableFile` vào envelope `ApiResponse<T>`.
   - `app.useGlobalFilters(new AllExceptionsFilter(), app.get(PermissionDeniedFilter))` — lưu ý NestJS xét filter **từ cuối danh sách lên đầu**, nên `PermissionDeniedFilter` bắt `PermissionDeniedException` (ghi audit `access.denied`) trước khi fallback sang `AllExceptionsFilter`.
8. **Swagger / OpenAPI**: gắn tại `/api/docs` (`OPENAPI_DOCS_PATH`) dùng chung hàm `buildOpenApiConfig()` với script xuất spec tĩnh `npm run openapi:export`.
9. **Graceful shutdown**: bật `app.enableShutdownHooks()` để khi nhận `SIGTERM`/`SIGINT`, NestJS dừng cron (`ScheduleModule`) và đóng pool kết nối PostgreSQL trước khi thoát tiến trình.

## 2. Cấu trúc `AppModule`

`AppModule` thực thi `NestModule` và đăng ký `RequestIdMiddleware` cho mọi route (`*`). Danh sách import theo nhóm:

- **Hạ tầng**: `ConfigModule.forRoot({ isGlobal: true, load: [...], validate: validateEnvironment })`, `ScheduleModule.forRoot()`, `DatabaseModule`, `CommonModule`.
- **Quản trị & bảo mật**: `AuthModule`, `UsersModule`, `RolesModule`, `AuditModule`.
- **Nội dung bảo tàng**: `RoomsModule`, `ExhibitsModule`, `MediaModule`.
- **Kiểm duyệt & báo cáo**: `ModerationModule`, `ContentReportsModule`.
- **Hỗ trợ & tích hợp**: `StatsModule`, `TranslationsModule`, `PartnerApiKeysModule`, `NotificationsModule`, `HealthModule`.

## 3. Các namespace cấu hình (`src/config/`)

Mỗi nhóm cấu hình dùng `registerAs('<namespace>', ...)` và được nạp tập trung từ `src/config/index.ts`:

| Namespace | File | Biến môi trường chính & mặc định |
|---|---|---|
| `app` | `app.config.ts` | `NODE_ENV` (`development`), `PORT` (`3001`), `FRONTEND_ORIGIN` (`http://localhost:5173`), `API_PREFIX` (`api`), `TRUST_PROXY` (`false`), `PUBLIC_API_RATE_LIMIT` (`600`/phút), `PUBLIC_MEDIA_RATE_LIMIT` (`3000`/phút) |
| `database` | `database.config.ts` | `DATABASE_URL` (bắt buộc), `DATABASE_SSL` (`true`/`false`), `DATABASE_SSL_CA` (đường dẫn chứng chỉ CA) |
| `jwt` | `jwt.config.ts` | `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL` (`15m`), `JWT_REFRESH_TTL_DAYS` (`7`), `REFRESH_COOKIE_NAME` (`aura_rt`), `BCRYPT_ROUNDS` (`12`), `TOTP_ENCRYPTION_KEY`, `REFRESH_RATE_LIMIT_PER_SESSION` (`30`), `REFRESH_RATE_LIMIT_PER_IP` (`300`), `REFRESH_RATE_LIMIT_INVALID_PER_IP` (`20`) |
| `media` | `media.config.ts` | `MEDIA_PUBLIC_BASE_URL` (`http://localhost:3001`), `MEDIA_URL_SIGNING_SECRET`, `MEDIA_SIGNED_URL_TTL_SECONDS` (`900`), `MEDIA_STORAGE_DRIVER` (`local` \| `supabase`), `MEDIA_ORPHAN_CLEANUP` (`dry-run`), `MEDIA_TRASH_RETENTION_DAYS` (`30`), `MEDIA_UPLOAD_JOB_CONCURRENCY` (`3`), `MEDIA_UPLOAD_JOB_RETENTION_DAYS` (`7`), `SUPABASE_URL`, `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` (`museum-assets`) |
| `reports` | `reports.config.ts` | `PUBLIC_REPORT_RATE_LIMIT` (`5` request/phút) |
| `swagger` | `swagger.config.ts` | Hằng số `OPENAPI_DOCS_PATH = 'api/docs'`, `OPENAPI_VERSION = '0.1.0'`, `buildOpenApiConfig()`, `createOpenApiDocument()` |

## 4. Kiểm định biến môi trường (`env.validation.ts`)

`validateEnvironment()` chạy ngay khi `ConfigModule` khởi tạo bằng `class-transformer` + `class-validator`:

- **Fail-fast không lộ bí mật**: nếu bất kỳ biến nào sai kiểu/ngưỡng, ứng dụng ném `Error('Invalid environment: <danh sách tên biến>')` — chỉ in tên biến, tuyệt đối không in giá trị.
- **Xác thực `TRUST_PROXY` (`parseTrustProxy`)**: chấp nhận `false`, `true`, số hop nguyên không âm (`1`, `2`), tên dải mạng (`loopback`, `linklocal`, `uniquelocal`) hoặc danh sách IPv4/IPv6/CIDR phân tách bằng dấu phẩy.
- **Điều kiện khi `MEDIA_STORAGE_DRIVER=supabase`**: bắt buộc có `SUPABASE_URL` hợp lệ và ít nhất một trong hai khóa `SUPABASE_SECRET_KEY` (ưu tiên `sb_secret_...`) hoặc `SUPABASE_SERVICE_ROLE_KEY` (≥ 20 ký tự).
- **Chính sách khóa bí mật ở `NODE_ENV=production`**: các khóa trong `PRODUCTION_SECRETS` (`JWT_ACCESS_SECRET`, `MEDIA_URL_SIGNING_SECRET`, `TOTP_ENCRYPTION_KEY`) bắt buộc phải đặt tường minh, độ dài tối thiểu 32 ký tự và không được trùng giá trị mẫu/dev (`PLACEHOLDER_SECRETS`).
