# VT-077: Tìm kiếm hiện vật công khai (Filter, Pagination, Stable Ordering)

Nhánh: `feat/VT-077-public-exhibit-search` (từ `dev`). PR [#130](https://github.com/ailabs26/ailabs-museum/pull/130).

## Đã làm

### Endpoint & Contract
- `GET /api/rooms/search?q=<kw>&roomId=<uuid>&page=<n>&pageSize=<1..100>` (`@Public()`).
- Trả envelope phân trang chuẩn: `{ success: true, data: PublicExhibitDto[], message: null, meta: { page, pageSize, total } }`.
- Chỉ trả hiện vật **APPROVED + đang hiển thị (`visible`), thuộc phòng `ACTIVE` và chưa xóa**; tham số query sai định dạng (`roomId` không phải UUID, `page < 1`, `pageSize > 100`) → **400 Bad Request**.
- Thứ tự cố định `roomId ASC, displayOrder ASC, id ASC` (khớp index `IDX_exhibits_room_order_id`, tiebreaker duy nhất `id` đảm bảo hợp nhất các trang không trùng/sót); tham số `sort` bị bỏ qua.
- Tài liệu kiến trúc & hợp đồng chi tiết: [docs/architecture/be/public-exhibit-search.md](../../architecture/be/public-exhibit-search.md).

### File thay đổi chính

| File | Vai trò |
|---|---|
| `back-end/src/modules/exhibits/dto/public-search-query.dto.ts` | DTO query (kế thừa `PaginationQueryDto`, thêm `roomId`; ghi rõ `sort` bị bỏ qua) |
| `back-end/src/modules/exhibits/controllers/exhibits.controller.ts` | Route `GET /rooms/search` (đặt **trước** `:slug`) |
| `back-end/src/modules/exhibits/services/exhibits.service.ts` | `publicSearch()` — ánh xạ `PublicExhibitDto`, giữ nguyên thứ tự và không nuốt lỗi |
| `back-end/src/modules/exhibits/repositories/exhibits.repository.ts` | `buildPublicSearchIdQuery()` + `searchPublicExhibits()` — `innerJoin` lọc phòng `ACTIVE`, ILIKE theo trường hiển thị (escape `%`/`_`), `ORDER BY roomId, displayOrder, id`, phân trang 2 bước |
| `back-end/src/modules/rooms/dto/create-room.dto.ts` | Chặn slug dành riêng (`RESERVED_ROOM_SLUGS = ['search']`) tránh xung đột với route `/rooms/search` |
| `back-end/perf/public-search-load.ts` | Script kiểm thử tải đồng thời ngoài `src/` (không đi vào `dist/`) |

## Kiểm chứng & Ma trận Test

| File test | Mức | Nội dung |
|---|---|---|
| `src/modules/exhibits/tests/public-search-service.spec.ts` | Unit | Ánh xạ DTO công khai, `meta`, giữ thứ tự, loại bản nháp, lan truyền lỗi (failure-path) |
| `src/modules/exhibits/tests/public-search-repository.spec.ts` | Unit | Bất biến thứ tự, lọc phòng `ACTIVE`, phân trang |
| `src/modules/exhibits/tests/public-search-sql.spec.ts` | SQL (metadata TypeORM thật) | Khẳng định mọi cột `ORDER BY` đều nằm trong `SELECT` của subquery `distinctAlias`, lọc phòng `ACTIVE`, ILIKE không cast toàn bộ JSONB và có `ESCAPE '\\'` |
| `src/modules/exhibits/tests/public-search.contract.spec.ts` | Contract (HTTP) | Envelope + `meta`, lỗi 400 khi query sai, không lộ trường nội bộ, ưu tiên route `/rooms/search` trước `:slug` |
| `src/modules/exhibits/tests/public-search.integration.spec.ts` | Integration (Postgres thật, tùy chọn) | Chạy truy vấn chỉ đọc trên Postgres thật (`RUN_DB_IT=1`): không lỗi 500, không khớp khóa JSON, wildcard `%`/`_` được escape chỉ khớp ký tự literal, hợp nhất các trang không trùng `id` |

### Lệnh chạy kiểm thử (từ thư mục `back-end/`)

```bash
# Chạy toàn bộ test của slice (node:test) — glob public-search* bắt cả .contract và .sql
node -r reflect-metadata -r ts-node/register --test \
  src/modules/exhibits/tests/public-search*.spec.ts

# Toàn bộ suite exhibits (kiểm regression)
npm run test:exhibits

# Coverage
node -r reflect-metadata -r ts-node/register --enable-source-maps --test \
  --experimental-test-coverage src/modules/exhibits/tests/public-search*.spec.ts

# Typecheck + lint
npm run typecheck && npm run lint

# (Tùy chọn) Integration với Postgres thật — chỉ đọc:
RUN_DB_IT=1 DATABASE_URL=postgres://... \
  node -r reflect-metadata -r ts-node/register --test \
  src/modules/exhibits/tests/public-search.integration.spec.ts

# Harness tải (150 tác vụ đồng thời, DB mô phỏng độ trễ):
node -r reflect-metadata -r ts-node/register/transpile-only \
  perf/public-search-load.ts 150 20 25
```

