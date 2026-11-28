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
