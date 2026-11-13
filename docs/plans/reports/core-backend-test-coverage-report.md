# Báo cáo test coverage — NestJS Core, Transactions, RBAC Guards (Task 26)

- **Người thực hiện:** Nguyễn Văn Thắng (Fullstack / Database & Core Backend)
- **Giai đoạn:** 2 — Test kỹ tính năng giai đoạn 1 (10/11 – 14/11/2026)
- **Nhánh:** `test/phase2-core-db-safety`
- **Kết luận:** 210/210 test pass; coverage phạm vi lõi **97,28% line · 98,27% branch · 98,58% function** (ngưỡng nghiệm thu 80%).

## 1. Phạm vi đo

| Nhóm | Đường dẫn | Nội dung |
|---|---|---|
| Hạ tầng NestJS dùng chung | `src/common/**` | Guard, filter, interceptor, middleware, exception, decorator, `TransactionManager`, `BaseRepository`, `PasswordService` |
| Cấu hình | `src/config/**` | `env.validation`, `registerAs` config, `data-source` |
| Xác thực | `src/modules/auth/**` | Đăng nhập, xoay vòng refresh token, chống reuse, cookie, chặn Origin lạ |
| Người dùng & RBAC | `src/modules/users/**`, `src/modules/roles/**` | CRUD user, gán vai trò, ma trận quyền, bảo vệ Admin cuối cùng |

Không tính trong phạm vi: các module nội dung (rooms, exhibits, media, moderation, reports, audit, stats) — đã có bộ test riêng của người phụ trách.

## 2. Cách chạy

```sh
cd back-end
# PostgreSQL tạm cho integration test (không bao giờ dùng DB Supabase)
docker run -d --rm --name aura-pg-test -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aura_test \
  -p 55432:5432 postgres:16-alpine

export CORE_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/aura_test
npm run test:core       # 210 test lõi
npm run test:coverage   # đo coverage, fail nếu line/branch/function < 80%
npm test                # toàn bộ back-end (1.802 test)
```

- Runner: `node:test` + `ts-node` (giữ nguyên công cụ đang dùng của dự án); coverage bằng `--experimental-test-coverage` của Node 24, map về file `.ts` qua source map.
- Integration test trên DB thật chỉ chạy khi `CORE_TEST_DATABASE_URL` trỏ tới `localhost`/`127.0.0.1`; URL khác bị bỏ qua để không chạm DB dùng chung. Test chỉ tạo/xóa bản ghi có tiền tố riêng, chạy xong DB trở về nguyên trạng (đã kiểm: 1 user, 3 role, 27 quyền như sau seed).
- **Lưu ý:** không có DB thì 16 test repository/transaction thật bị skip, function coverage còn 73,51% và `test:coverage` fail **có chủ đích**. Repository được kiểm trên PostgreSQL thật, không mock TypeORM.

## 3. Kết quả

### 3.1 Tổng hợp

| Chỉ số | Có DB thật | Không có DB |
|---|---|---|
| Test pass / tổng | 210 / 210 | 194 / 194 (16 skip theo thiết kế) |
| Line coverage | **97,28%** | 86,08% |
| Branch coverage | **98,27%** | 96,90% |
| Function coverage | **98,58%** | 73,51% |
| Thời gian chạy | ~17,5 s | ~15 s |

`npm test` toàn back-end: 1.802/1.802 pass; `npm run typecheck` và `npm run lint` sạch.

### 3.2 Coverage theo file (có DB thật)

| Nhóm | File đạt 100% line | File dưới 100% (line %) |
|---|---|---|
| `common` | guards (2), filter, interceptor, middleware, `transaction.manager`, `password.service`, exception (4), decorator (3), `common.module`, constants, enum | `base.repository` 85,71 · `api-response` 81,82 · `id-param.dto` 85,71 · `pagination-query.dto` 96,88 · `paginated.type` 95,00 |
| `config` | `app.config`, `database.config`, `jwt.config` | `data-source` 98,08 · `env.validation` 86,92 · `index` 80,00 · `media.config` 52,17 |
| `auth` | controller, guard, repository, 2 service, entity, module | `login.dto` 92,31 |
| `roles` | 2 controller, 2 repository, service, 3 entity, module | DTO 88,89–96,43 |
| `users` | controller, service (98,51% branch), `user-roles.repository`, 2 entity, module | `users.repository` 98,46 · DTO 88,89–97,44 · `user-access.util` 80,00 |

Dòng "chưa phủ" còn lại chủ yếu là dòng `import`/khai báo decorator mà source map gán sai (ví dụ dòng 1–12 của `base.repository.ts`), cộng với `media.config.ts` (thuộc module media, chỉ được nạp chứ không gọi trong phạm vi lõi). Nhánh duy nhất chưa phủ có ý nghĩa: `users.repository.ts:75-76` — lỗi DB khác vi phạm unique email khi `saveNew` (ném lại nguyên lỗi).

### 3.3 Danh mục test

| File | Loại | Số test | Nội dung chính |
|---|---|---|---|
| `common/tests/rbac-guards.spec.ts` | Unit | 23 | `JwtAuthGuard`: public handler/class, thiếu/sai scheme Bearer, sai secret, hết hạn, sửa payload; `PermissionsGuard`: quyền AND, so khớp chính xác, thiếu user; thứ tự `APP_GUARD` (JWT trước RBAC) |
| `common/tests/rbac-http.integration.spec.ts` | Integration HTTP | 53 | Đọc metadata của **toàn bộ 16 route** Users/Roles/Permissions: 401 khi thiếu token, 403 khi thiếu đúng quyền yêu cầu (service không bị gọi, ghi audit `access.denied`), 2xx khi đủ quyền; quyền mặc định của editor/moderator |
| `common/tests/transaction-repository.spec.ts` | Unit | 8 | `TransactionManager` ủy quyền và lan truyền lỗi; `BaseRepository` paginate/exists/count; ghi đi qua `EntityManager` của transaction |
| `common/tests/common-core.spec.ts` | Unit | 29 | `AllExceptionsFilter` (400/404/409/422/500, không lộ stack), `ResponseInterceptor`, `RequestIdMiddleware`, DTO phân trang, `@CurrentUser`, `PasswordService` (bcrypt, dummy hash) |
| `common/tests/core-db.integration.spec.ts` | Integration DB thật | 16 | Commit, rollback khi lỗi/vi phạm unique, cô lập dữ liệu chưa commit; advisory lock tuần tự hóa transaction đồng thời; repository Users/UserRoles/Roles/Permissions; 2 refresh đồng thời cùng token |
| `config/tests/config.spec.ts` | Unit | 16 | Từ chối secret ngắn, bcrypt rounds/TTL ngoài khoảng, `DATABASE_SSL` sai, driver supabase thiếu khóa |
| `auth/tests/token-service.spec.ts` | Unit | 12 | Chỉ lưu SHA-256 token, xoay vòng cùng family, reuse → thu hồi cả family, hết hạn/user khóa/race → 401, lỗi giữa chừng → rollback |
| `auth/tests/auth-service.spec.ts` | Unit | 14 | Login chống dò user qua thời gian phản hồi, tài khoản khóa, refresh/me/logout; `RefreshCookieOriginGuard` |
| `auth/tests/auth-controller-http.spec.ts` | Integration HTTP | 6 | Cookie `HttpOnly`/`SameSite=Lax`, token không lộ trong body, xóa cookie khi 401, chặn Origin lạ trước khi chạm service |
| `users/tests/users-service.spec.ts` | Unit | 20 | Mọi thao tác ghi chạy trong 1 transaction sau advisory lock, cần `role:assign` khi gán role, 409/422/404, **bảo vệ Admin hoạt động cuối cùng** |
| `roles/tests/roles-service.spec.ts` | Unit | 13 | Chặn xóa role hệ thống/đang dùng, chặn sửa quyền admin, ma trận quyền nhiều role trong 1 transaction và rollback toàn bộ khi lỗi |
| **Tổng** | | **210** | |

## 4. Kịch bản rủi ro đã được kiểm chứng

| Rủi ro | Bằng chứng |
|---|---|
| Route quản trị quên khai báo `@Permissions` | `rbac-http` duyệt metadata mọi route, fail nếu route nào thiếu |
| Guard chạy sai thứ tự (RBAC trước khi có `request.user`) | Kiểm thứ tự provider `APP_GUARD` trong `AuthModule` |
| Giả mạo/sửa JWT | Token sai secret, hết hạn, sửa payload đều 401 |
| Refresh token bị đánh cắp và dùng lại | Reuse → thu hồi cả family, kể cả token mới (unit + DB thật) |
| Hai tab refresh cùng lúc | DB thật: đúng 1 request thành công, family bị thu hồi (đúng thiết kế reuse-detection) |
| Lỗi giữa transaction làm dữ liệu nửa vời | Rollback kiểm trên DB thật và trên service (ma trận quyền, xoay vòng token) |
| Mất quyền quản trị hệ thống | Không khóa/xóa/bỏ role của Admin hoạt động cuối; advisory lock tuần tự hóa các thay đổi |
| Lộ `passwordHash` / refresh token | Response user không có `passwordHash`; refresh token chỉ ở cookie, DB chỉ lưu hash |

## 5. Phát hiện và đề xuất

| # | Mức | Phát hiện | Đề xuất |
|---|---|---|---|
| 1 | Cao | `jwt.config.ts` và `env.validation.ts` có giá trị mặc định cho `JWT_ACCESS_SECRET` (`dev-access-secret-change-me-please`). Nếu môi trường thật quên đặt biến, API vẫn khởi động với secret công khai trong mã nguồn → ai cũng ký được token admin. Tương tự `MEDIA_URL_SIGNING_SECRET`. | Khi `NODE_ENV=production` bắt buộc khai báo 2 secret và từ chối giá trị mặc định (task riêng, ngoài phạm vi kiểm thử). |
| 2 | Thấp | Coverage của Node chỉ báo file đã được nạp. Đối chiếu danh sách file trong phạm vi: 3 file chỉ có `interface`/`type` (không sinh mã) và 2 file enum `common/enums/revision-status.enum.ts`, `report-status.enum.ts` không xuất hiện. Hai enum này **không được import ở đâu** và giá trị đã lệch với ràng buộc CHECK của DB (revision: `draft/in_review/approved/rejected`; report: `open/in_progress/resolved/dismissed`). | Xóa 2 enum chết, hoặc sửa cho khớp DB trước khi có ai dùng. Nếu tính cả 2 file (16 dòng) vào mẫu số thì line coverage vẫn > 96%. |
| 3 | Thấp | Không có CI chạy test. | Đưa `test:core` + PostgreSQL service container vào GitHub Actions khi dự án có CI. |

Không phát hiện lỗi chức năng trong mã lõi khi viết bộ test này.
