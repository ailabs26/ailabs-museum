# Moderation Queue Fix — Implementation Plan

> **For agentic workers:** Người dùng đã duyệt. Dùng `executing-plans` triển khai tuần tự theo [task breakdown](../tasks/moderation-queue-fix.md), commit riêng từng task trên `fix/moderation-queue`. Dừng trước push/PR/merge.

**Goal:** Bản nháp gửi duyệt thành công xuất hiện trong hàng chờ; API queue không lỗi phân trang, UI render được tên song ngữ và phân biệt lỗi tải với danh sách rỗng.

**Architecture:** Sửa tên property order tại repository TypeORM; giữ response revision hiện có. Frontend chuẩn hóa tên qua helper song ngữ đang có, thể hiện query errors và invalidate đúng queue cache sau submit. Không thêm abstraction/cache manager hoặc sửa quyền nghiệp vụ.

**Tech Stack:** NestJS, TypeORM/PostgreSQL, React, Mantine, TanStack Query, node:test và Playwright hiện có.

## 1. Baseline và bằng chứng

- Nhánh: `fix/moderation-queue`, tạo từ `origin/dev` `5556f79`; đã fetch và xác nhận dev đồng bộ, worktree sạch trước tạo nhánh.
- Hướng dẫn: `AGENTS.md`, `docs/architecture/be/coding-conventions.md`, `docs/architecture/fe/coding-conventions.md`.
- Người dùng cung cấp log request thật:
  `GET /api/moderation/queue?page=1&pageSize=20 -> 500: Cannot read properties of undefined (reading 'databaseName')`.
- `ModerationRepository.queue` dùng `orderBy('rev.created_at', 'ASC')` với join + skip/take. Repro bằng metadata/query-builder TypeORM thật, không kết nối DB: lỗi `databaseName`; đối chứng dùng `rev.createdAt` phân giải metadata thành công.
- Browser/API mock với admin + `revision:publish` đã tái hiện ba lỗi frontend:
  1. Queue có `content.name: { vi, en }` làm React lỗi “Objects are not valid as a React child”. Cột tên và title Drawer render object trực tiếp; tên action cũng thành `[object Object]`.
  2. Mở queue rỗng → submit thành công ở trang hiện vật → quay lại trong 30s: không GET queue mới vì submit chỉ invalidate exhibit caches.
  3. GET queue 403 bị hiển thị “Không có phiên bản nào chờ duyệt”; page không có error branch. 500 cần được kiểm tra tương đương.
- Backend queue chỉ lọc `in_review`, room tùy chọn, không lọc theo người gửi. Quyền queue là `revision:publish`; không có bằng chứng cần thay quyền admin.
- 20 backend moderation tests hiện có PASS trong phiên điều tra, nhưng không kiểm đường query-builder queue thực. Không dùng kết quả đó làm bằng chứng bản fix đã đạt.

## 2. Global constraints

- PLAN/TASK đã duyệt; triển khai trên cùng nhánh và dừng trước push/PR/merge.
- Một nhánh chung docs + backend + frontend; sau duyệt mỗi task kiểm chứng xong có commit riêng.
- Không migration, schema/database changes, seed, đổi quyền/RBAC, API route/envelope hoặc submit/publish/reject business flow.
- Không chạy mutation thật hoặc test tự chạy migrations. Tests dùng metadata/query runner giả lập và API mocks; nếu cần đọc API thật, chỉ GET bằng môi trường người dùng cho phép, không lấy/in token.
- Backend giữ Controller → Service → Repository. Chỉ repository thay query; không bắt exception rồi trả queue rỗng để che lỗi 500.
- Giữ dữ liệu song ngữ trong API; không ép backend trả tên chuỗi để chữa riêng UI. Không sửa entity content types diện rộng.
- Không thêm thư viện, polling, global staleTime=0 hoặc refactor CMS không liên quan.
- Không sửa form stale-data fix PR #67 ngoài điểm submit cache cần thiết; giữ guard session/422 và workflow lưu nháp → gửi duyệt → xuất bản.

## 3. Thiết kế

### 3.1 Backend — thứ tự phân trang đúng metadata

Trong `ModerationRepository.queue` thay order bằng property entity:

```ts
qb.orderBy('rev.createdAt', 'ASC')
  .addOrderBy('rev.id', 'ASC')
  .skip((page - 1) * pageSize)
  .take(pageSize);
```

- `createdAt` ánh xạ tới `created_at` qua TypeORM. `rev.id` là tie-breaker để trang ổn định khi timestamp bằng nhau.
- Giữ FIFO theo createdAt hiện tại; không thêm submittedAt/schema mới. Room filter, joins, total/page/pageSize và điều kiện IN_REVIEW giữ nguyên.
- Regression không được chỉ mock fluent chain rồi assert chuỗi `orderBy`: cần builder + entity metadata thật thực hiện bước tạo order/select cho joined pagination và chứng minh trước fix ném `databaseName`.
- Test có thể chặn `getManyAndCount` tại ranh giới thực thi DB, cho bước dựng pagination thật chạy trước trả fixture. Nếu phải gọi method không-public của TypeORM, giới hạn typed cast trong test và ghi rõ phụ thuộc phiên bản; không thêm hook production chỉ phục vụ test.
- Không gọi initialize/runMigrations/query database thật. Test metadata tách config khỏi env/credentials và dùng danh sách entities hiện có đủ relations.

### 3.2 Frontend — tên song ngữ và trạng thái tải

- Tái dùng `resolveBilingualText` từ `helpers/exhibitHotspots.ts` cho legacy string, object và JSON string. Hiển thị vi có nội dung, fallback en rồi tên thay thế rõ ràng; không render object hoặc `[object Object]`.
- Dùng cùng quy tắc cho tên cột queue, accessible name nút Xem chi tiết và title Drawer. Giữ revision ID/no để phân biệt trùng tên.
- Điều chỉnh type `RevisionContent.name`/description của frontend cho dữ liệu song ngữ đang có nếu cần; không khai báo type string sai thực tế, không tạo helper trùng.
- `queueQuery.isError`: hiện Alert `role="alert"`, thông báo từ API và nút **Thử lại**. Không render empty state từ `data ?? []` khi request thất bại, kể cả có cache cũ. Không dump stack/query/credentials ra UI.
- Empty chỉ khi GET thành công với 0 items; pending có loading; có thể thêm **Làm mới** queue để kiểm tra thay đổi từ phiên khác, disabled/loading trong lúc fetching.
- Service `diff` đang `String(value)` cho name/description/transcript có thể cho `[object Object]`; chỉ ghi nhận là giới hạn ở nhiệm vụ này, không thay diff/API ngoài lỗi hiển thị tên queue/Drawer đã xác nhận. Detail/diff GET lỗi không được dùng làm bằng chứng queue rỗng.

### 3.3 Cache — submit phải làm stale hàng chờ

- Sau `submitReviewMutation.onSuccess` gọi thêm:
  `queryClient.invalidateQueries({ queryKey: ['moderation', 'queue'] })`.
- Prefix bao phủ mọi page/filter của queue; active refetch, inactive stale để mount kế tiếp fetch. Không tự chèn row vào queue từ response `ExhibitRow` không đúng shape `Revision`.
- Giữ invalidation exhibit caches hiện có và toast chỉ khi submit request thành công. Submit fail 422/403/409 không báo success hoặc thêm bản giả vào queue.
- Không cần tự publish, đổi role hoặc reset cache toàn ứng dụng. Queue hiện có FIFO/pageSize 20 nên bản mới có thể nằm ở trang sau; tests phải xác nhận pagination, không khẳng định luôn nằm trang 1.

## 4. File map dự kiến sau duyệt

| File | Nội dung |
|---|---|
| `back-end/src/modules/moderation/repositories/moderation.repository.ts` | Order property + tie-breaker |
| `back-end/src/modules/moderation/tests/moderation-repository.spec.ts` | Regression metadata/pagination, room filter và paging |
| `back-end/src/modules/moderation/tests/moderation-http.spec.ts` | GET queue envelope/page validation, lỗi rõ ràng |
| `front-end/src/pages/admin/ModerationPage.tsx` | Tên song ngữ, query error/retry/refresh |
| `front-end/src/services/moderation.service.ts` | Type nội dung tên khớp song ngữ, nếu cần |
| `front-end/src/pages/admin/ExhibitsPage.tsx` | Queue invalidation sau submit success |
| `front-end/tests/moderation-queue.spec.ts` | Queue states, tên, submit→queue và cache |
| `front-end/tests/fixtures/moderationQueueApi.ts` | Stateful mocks, auth quyền rõ, capture requests; tái dùng fixture auth/envelope |
| Hai tài liệu nhiệm vụ này | Checklist, bằng chứng và commit ledger |

## 5. Kiểm chứng và nghiệm thu

- Backend test dùng TypeORM thật đến ranh giới dựng joined pagination: trước fix RED đúng lỗi, sau fix không ném; page 1/2, room filter và IN_REVIEW không đổi; HTTP envelope/meta đúng.
- Browser: admin có quyền queue + tên `{vi,en}` render đúng và mở Drawer không crash; legacy string, vi trống/en có, tên trùng/JSON string có coverage.
- Error 500/403 khác empty 200; Retry phục hồi. Failed refetch với cache không được báo danh sách rỗng; không bypass quyền thật.
- Queue cache rỗng/đã có items → submit success → vào queue ngay, có GET mới và đúng revision. Submit fail không tạo record. Phân trang và prefix invalidation không bỏ sót cache page khác.
- Regression: moderation keyboard/nested modal, exhibit edit persistence và admin navigation liên quan; fixtures không mutate dữ liệu thật.
- Chạy typecheck/lint/build cho **cả backend và frontend**; chạy backend focused moderation/exhibits tests và Playwright mới + affected regressions. Test metadata không thay thế xác nhận API/SQL thật; báo NOT TESTED nếu không chạy read-only live GET.

## 6. Self-review kế hoạch

- [x] Lỗi 500 có log người dùng và repro ORM thực, không đổ lỗi do tài khoản admin.
- [x] Backend/query fix đi cùng frontend error/render/cache, tránh hết 500 rồi vẫn không thấy bản duyệt.
- [x] Không che lỗi bằng empty, không ép response song ngữ thành string hoặc thay RBAC.
- [x] Mỗi task có file/test/acceptance và commit riêng; không migration/live mutation/dependency mới.
- [x] Phân biệt test mocks/metadata với persistence/SQL thật, giữ FIFO hiện tại.
- [x] Người dùng duyệt trước commit/implementation.

## 7. Verification sau triển khai

- Đã sửa order `rev.createdAt` và tie-breaker `rev.id`; test repository đi qua metadata/order resolution TypeORM thật, không initialize DB hoặc chạy migration. RED trước fix đúng exception `databaseName` cả trang 1/2.
- Backend focused moderation + exhibit-service: **162/162 PASS**, 0 fail/skip. Typecheck, lint và build backend PASS.
- Frontend affected regression: **43/43 PASS**, 0 fail/skip, gồm 11 queue tests, 13 exhibit-edit, 8 nested-modal, 3 moderation-keyboard, 8 admin-navigation. Typecheck, lint và build frontend PASS; build còn cảnh báo chunk >500 kB hiện hữu.
- Fixture queue stateful: submit thành công mới thêm revision; test quay lại queue dưới 30 giây, invalidation cả trang 1/2, FIFO, 422/403/409 không báo success/tạo record giả.
- Shared frontend RevisionContent type song ngữ ảnh hưởng Reports: cập nhật đúng hai field reported name/description và thêm browser regression; không đổi report mutation/behavior.
- Browser Edge/Chromium trên Windows; mocked APIs chặn mutation thật. Output ignored tại `front-end/tmp/queue-final-regression/`.
- **NOT TESTED:** GET queue có xác thực trên database/session thật của người dùng; tests metadata/HTTP mock không chứng minh SQL live, không có migration hoặc ghi dữ liệu CMS thật.
- Giới hạn đã duyệt còn giữ: service diff dùng `String(value)` với text object có thể hiện `[object Object]`; không sửa diff/contract trong task này. Không kiểm thử screen reader/thiết bị thật.
- Đã review diff/phạm vi, không schema/RBAC/dependency changes; commit ledger ở task document. Chưa push/PR/merge.
