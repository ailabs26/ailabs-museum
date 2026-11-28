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
