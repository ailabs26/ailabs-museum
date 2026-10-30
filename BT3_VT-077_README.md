# BT cá nhân 3 — VT-077 · Public Exhibit Search

**SV:** Nguyễn Đức Quang — 23001918 · **Nhóm:** SE2026-T20 · **Đề tài:** 3D-WEB-03 (Aura Museum)
**Nhánh:** `feat/VT-077-public-exhibit-search` · **Baseline:** `6e937c5` (tạo từ `dev` @ `a9591858`)

## Change request
Thêm tính năng **tìm kiếm hiện vật công khai có lọc + phân trang + thứ tự kết quả ổn định**.
- Risk trọng tâm: schema/API thay đổi làm client cũ bị hỏng → giữ **backward-compatible** envelope.
- Invariant: thứ tự là total order xác định (tiebreaker `id`) ⇒ union các trang không trùng/sót.

## Endpoint
`GET /rooms/search?q=<kw>&roomId=<uuid>&page=<n>&pageSize=<1..100>`
Trả envelope chuẩn: `{ success, data: PublicExhibitDto[], message, meta: { page, pageSize, total } }`.
Chỉ trả hiện vật **APPROVED + đang hiển thị, thuộc phòng ACTIVE**; input sai → **400** (không 500).
Thứ tự cố định `roomId, displayOrder, id` (khớp index `IDX_exhibits_room_order_id`); `sort` bị bỏ qua.

## File thay đổi chính
| File | Vai trò |
|---|---|
| `back-end/src/modules/exhibits/dto/public-search-query.dto.ts` | DTO query (kế thừa `PaginationQueryDto`, thêm `roomId`; ghi rõ `sort` bị bỏ qua) |
| `back-end/src/modules/exhibits/controllers/exhibits.controller.ts` | Route `GET /rooms/search` (đặt **trước** `:slug`) |
| `back-end/src/modules/exhibits/services/exhibits.service.ts` | `publicSearch()` — map DTO công khai, không nuốt lỗi |
| `back-end/src/modules/exhibits/repositories/exhibits.repository.ts` | `buildPublicSearchIdQuery()` + `searchPublicExhibits()` — lọc phòng ACTIVE, ILIKE theo trường hiển thị (escape %/_), `ORDER BY roomId, displayOrder, id`, phân trang 2 bước |
| `back-end/src/modules/rooms/dto/create-room.dto.ts` | Chặn slug dành riêng (`search`) tránh xung đột route |

## Test của slice
| File | Mức | Nội dung |
|---|---|---|
| `tests/public-search-service.spec.ts` | unit | map, meta, giữ thứ tự, loại draft, **failure-path (propagate)** |
| `tests/public-search-repository.spec.ts` | unit | invariant ordering, filter phòng ACTIVE, phân trang |
| `tests/public-search-sql.spec.ts` | **SQL (metadata thật, không DB)** | bắt lỗi SQL 500 (cột order-by phải được select), ranh giới phòng, ILIKE không khớp khóa JSON + escape |
| `tests/public-search.contract.spec.ts` | **contract (HTTP)** | envelope + meta, negative 400, không rò rỉ field nội bộ |
| `tests/public-search.integration.spec.ts` | **integration (Postgres thật, tùy chọn)** | thực thi SQL thật: không 500, không khớp khóa JSON, union trang không trùng |

## Lệnh chạy (từ thư mục `back-end/`)
```bash
# Chạy toàn bộ test của slice (node:test, KHÔNG dùng Jest) — glob public-search* bắt cả .contract và .sql
node -r reflect-metadata -r ts-node/register --test \
  src/modules/exhibits/tests/public-search*.spec.ts

# Toàn bộ suite exhibits (kiểm regression)
node -r reflect-metadata -r ts-node/register --test src/modules/exhibits/tests/*.spec.ts

# Coverage (Node 18: dùng --experimental-test-coverage)
node -r reflect-metadata -r ts-node/register --enable-source-maps --test \
  --experimental-test-coverage src/modules/exhibits/tests/public-search*.spec.ts

# Typecheck + lint
npx tsc --noEmit && npx eslint src/modules/exhibits src/modules/rooms

# (TÙY CHỌN) Integration với Postgres thật — chỉ đọc, chứng minh SQL không còn 500:
RUN_DB_IT=1 DATABASE_URL=postgres://... \
  node -r reflect-metadata -r ts-node/register --test \
  src/modules/exhibits/tests/public-search.integration.spec.ts

# Harness tải: 150 tác vụ đồng thời, mục tiêu p95 ≤ 4.0s
#   (service/DB mô phỏng bằng độ trễ — KHÔNG phải Postgres thật; xem giới hạn trong output)
node -r reflect-metadata -r ts-node/register/transpile-only \
  perf/public-search-load.ts 150 20 25
```

## Giới hạn & evidence
- Log thực thi (RED→GREEN vòng review, mutation, perf, coverage, flaky) nằm trong **phụ lục PDF**
  (`BT3_23001918_VT-077.pdf`), KHÔNG commit vào repo.
- `public-search-sql.spec.ts` dựng SQL từ metadata TypeORM thật nên bắt được lỗi cấp SQL mà
  fake QueryBuilder bỏ sót; kết luận production cuối cùng vẫn nên chạy `public-search.integration.spec.ts`
  với Postgres thật (collation/ILIKE thực tế).

## Lưu ý review
- Route `search` **phải** đứng trước `:slug`; đồng thời DTO tạo phòng đã chặn slug `search` (phòng 2 lớp).
- **Không merge khi nhóm chưa review** (quy định đề bài).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
