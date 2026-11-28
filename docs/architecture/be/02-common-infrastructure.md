# 02 — Tầng hạ tầng dùng chung (`back-end/src/common/`)

> Mã nguồn: `back-end/src/common/common.module.ts` và các thư mục `repository/`, `database/`, `dto/`, `exceptions/`, `filters/`, `guards/`, `interceptors/`, `middleware/`, `rate-limit/`, `security/`, `constants/`, `enums/`, `types/`, `utils/`.

`CommonModule` được đánh dấu `@Global()`, cung cấp và export 3 dịch vụ hạ tầng cho mọi module mà không cần import lặp lại: `TransactionManager`, `PasswordService` và `PublicRateLimiter`.

## 1. Repository Pattern (`common/repository/`)

- **Port (`IBaseRepository<T>`)**: định nghĩa hợp đồng truy cập dữ liệu thuần cho Service (`findById`, `findOne`, `findMany`, `paginate`, `exists`, `count`, `create`, `save`, `update`, `softDelete`, `remove`).
- **Adapter (`BaseRepository<T>`)**: bọc TypeORM `Repository<T>`. Mọi repository từng module kế thừa `BaseRepository<T>` và bổ sung truy vấn đặc thù của domain.
- **Hỗ trợ giao dịch**: các phương thức ghi chấp nhận tham số tùy chọn `manager?: EntityManager`; khi có `manager`, repository chuyển sang `manager.getRepository(Entity)` để chạy chung giao dịch.

## 2. Quản lý giao dịch (`TransactionManager`)

`common/database/transaction.manager.ts` bọc `dataSource.transaction()` theo tinh thần UnitOfWork:

```ts
await this.tx.run(async (manager) => {
  await this.publishGate.assertPublishable(revision, manager);
  await this.repo.save(revision, manager);
});
```

Mọi nghiệp vụ nhiều bước (publish revision, bulk delete/restore, bật/tắt 2FA, dọn media mồ côi) đều đi qua `TransactionManager` để đảm bảo nguyên tử và rollback hoàn toàn khi phát sinh lỗi.

## 3. Envelope `ApiResponse<T>` và `ResponseInterceptor`

- **`common/dto/api-response.ts`**: định nghĩa chuẩn `ApiResponse<T> = { success, data, message, errors?, meta? }` cùng 2 helper `ok(data, meta?)` và `fail(message, errors?)`.
- **`ResponseInterceptor`**: tự động bọc dữ liệu trả về từ controller thành `ok(data)` (hoặc nhận diện đối tượng `Paginated<T>` `{ items, total, page, pageSize }` để tách `meta`). Các giá trị đã là `ApiResponse` hoặc `StreamableFile` (như tải GLB, `sitemap.xml`, xuất CSV) được giữ nguyên không bọc JSON.
- **`RequestIdMiddleware`**: đọc `X-Request-Id` từ request (cắt tối đa 100 ký tự) hoặc sinh `randomUUID()`, gán lại vào cả `req.headers['x-request-id']` lẫn response header `X-Request-Id` để tương quan log và bảng `audit_logs`.

## 4. Hệ thống ngoại lệ và `AllExceptionsFilter`

Các lớp ngoại lệ domain trong `common/exceptions/` ánh xạ trực tiếp sang HTTP status và mã lỗi có cấu trúc:

| Lớp ngoại lệ | HTTP Status | Mục đích |
|---|---|---|
| `DomainNotFoundException` | `404` | Tài nguyên không tồn tại hoặc đã bị ẩn/xóa khỏi phạm vi truy cập |
| `DomainValidationException` | `422` | Lỗi nghiệp vụ/chính sách dữ liệu kèm mảng `{ field?, code, message }[]` (vd `RevisionPublishGate`) |
| `BusinessException` | `409` | Xung đột trạng thái / sửa đồng thời (optimistic lock, trùng bục, trùng khóa) |
| `PermissionDeniedException` | `403` | Thiếu quyền RBAC, mang thêm metadata quyền yêu cầu và quyền thiếu cho `PermissionDeniedFilter` |
| `DeletionBlockedException` | `409` | Chặn xóa tài nguyên đang được tham chiếu (vd phòng còn hiện vật, media còn revision tham chiếu BR-21) |

`AllExceptionsFilter` chuẩn hóa cả `HttpException`, lỗi validation của `class-validator` và lỗi hệ thống `500` về cùng định dạng `{ success: false, data: null, message, errors? }`, đồng thời không làm rò rỉ stack trace hay chi tiết SQL ra client.

## 5. Bảo mật & Tiện ích dùng chung (`common/security/`, `rate-limit/`, `interceptors/`, `utils/`)

- **`PasswordService` & `password-policy.ts`**: hash mật khẩu bằng `bcrypt` (cost `BCRYPT_ROUNDS`, mặc định 12). Chính sách mật khẩu áp qua decorator `@IsStrongPassword()` và hàm `assertPasswordPolicy()` (kiểm độ dài, đa dạng ký tự và cấm chứa email/tên cá nhân với mã lỗi `password_personal`).
- **`secret-box.ts` (`sealSecret` / `openSecret`)**: mã hóa đối xứng **AES-256-GCM** cho bí mật lưu DB (hiện dùng cho secret TOTP 2FA). Khóa 32 byte dẫn xuất qua SHA-256; chuỗi lưu dạng `v1.<iv>.<tag>.<ciphertext>` (base64url) để xác thực tính toàn vẹn.
- **`PublicRateLimiter` & `PublicRateLimitGuard`**: bộ đếm cửa sổ cố định 1 phút theo IP trong bộ nhớ (tối đa `10_000` key, tự dọn cửa sổ hết hạn) với 2 bucket:
  - `api`: mặc định **600 req/phút/IP** cho các endpoint JSON/XML công khai.
  - `media`: mặc định **3000 req/phút/IP** (đặt bằng `@PublicRateBucketOf('media')`) cho luồng ảnh/audio/GLB.
  - Gắn header `X-RateLimit-Limit`, `X-RateLimit-Remaining`; khi vượt ngưỡng trả `429` kèm `Retry-After`.
- **`UploadFileInterceptor`**: bọc Multer memoryStorage áp trần dung lượng `MAX_UPLOAD_BYTES` (10 MB) ngay tại tầng nhận multipart trước khi vào kiểm tra magic bytes.
- **`csv.util.ts`**: thoát ký tự và chống CSV formula injection (`=`, `+`, `-`, `@`) cho xuất báo cáo audit và export hiện vật.

## 6. Danh mục 31 quyền RBAC & Vai trò mặc định (`permissions.constant.ts`)

Hệ thống định nghĩa cố định **31 permission** dạng `resource:action` làm nguồn sự thật chung cho `@Permissions(...)` ở controller và script `seed.ts`:

| Nhóm | Danh sách quyền |
|---|---|
| Người dùng & phân quyền (10) | `user:read`, `user:create`, `user:update`, `user:delete`, `role:read`, `role:create`, `role:update`, `role:delete`, `role:assign`, `permission:read` |
| Phòng & hiện vật (7) | `room:read`, `room:create`, `room:update`, `room:delete`, `exhibit:read`, `exhibit:create`, `exhibit:update` |
| Revision & Media (7) | `revision:create`, `revision:submit`, `revision:publish`, `revision:reject`, `revision:hide`, `media:upload`, `media:attach` |
| Báo cáo & Nhật ký (3) | `report:read`, `report:resolve`, `audit:read` |
| Đa ngôn ngữ & Đối tác (4) | `translation:read`, `translation:manage`, `apikey:read`, `apikey:manage` |

Phân bổ mặc định theo `RoleKey` (`DEFAULT_ROLE_PERMISSIONS`):
- **`admin`**: toàn bộ **31 quyền**.
- **`moderator`** (9 quyền): `room:read`, `exhibit:read`, `revision:publish`, `revision:reject`, `revision:hide`, `report:read`, `report:resolve`, `audit:read`, `permission:read`.
- **`editor`** (11 quyền): `room:read/create/update/delete`, `exhibit:read/create/update`, `revision:create/submit`, `media:upload/attach`.

## 7. DTO và Enum dùng chung

- **DTO**: `PaginationQueryDto` (`page`, `pageSize`), `IdParamDto` (`UUID`), `BulkIdsDto` (mảng UUID cho xóa mềm/khôi phục hàng loạt), `DeletedFilterDto` (`active` | `deleted` | `all` cho tab Thùng rác).
- **Enum**: `RoleKey` (`admin`, `moderator`, `editor`), `RevisionStatus`, `ReportStatus`.
- **Type**: `AuthUser` (gắn vào `req.user` sau `JwtAuthGuard`), `JwtPayload`, `Paginated<T>`.
