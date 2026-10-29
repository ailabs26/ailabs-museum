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
Chỉ trả hiện vật **đã xuất bản (APPROVED) + đang hiển thị**; input sai → **400** (không 500).

## File thay đổi chính
| File | Vai trò |
|---|---|
| `back-end/src/modules/exhibits/dto/public-search-query.dto.ts` | DTO query (kế thừa `PaginationQueryDto`, thêm `roomId`) |
| `back-end/src/modules/exhibits/controllers/exhibits.controller.ts` | Route `GET /rooms/search` (đặt **trước** `:slug`) |
| `back-end/src/modules/exhibits/services/exhibits.service.ts` | `publicSearch()` — map DTO công khai, không nuốt lỗi |
| `back-end/src/modules/exhibits/repositories/exhibits.repository.ts` | `searchPublicExhibits()` — lọc + ILIKE + `ORDER BY displayOrder ASC, id ASC` + phân trang |

## Test của slice
| File | Mức | Nội dung |
|---|---|---|
| `tests/public-search-service.spec.ts` | unit | map, meta, giữ thứ tự, loại draft, **failure-path (propagate)** |
| `tests/public-search-repository.spec.ts` | unit | **invariant ordering (addOrderBy id)**, filter, phân trang |
| `tests/public-search.contract.spec.ts` | **contract (HTTP)** | envelope + meta, negative 400, không rò rỉ field nội bộ |

## Lệnh chạy (từ thư mục `back-end/`)
```bash
# Chạy test của slice (node:test, KHÔNG dùng Jest)
node -r reflect-metadata -r ts-node/register --test \
  src/modules/exhibits/tests/public-search-service.spec.ts \
  src/modules/exhibits/tests/public-search-repository.spec.ts \
  src/modules/exhibits/tests/public-search.contract.spec.ts

# Toàn bộ suite exhibits (kiểm regression)
node -r reflect-metadata -r ts-node/register --test src/modules/exhibits/tests/*.spec.ts

# Coverage (Node 18: dùng --experimental-test-coverage, không hỗ trợ --test-coverage-include)
node -r reflect-metadata -r ts-node/register --enable-source-maps --test \
  --experimental-test-coverage src/modules/exhibits/tests/*.spec.ts

# Typecheck + lint
npx tsc --noEmit && npx eslint src/modules/exhibits

# Harness tải: 150 tác vụ đồng thời, mục tiêu p95 ≤ 4.0s
#   (service/DB mô phỏng bằng độ trễ — KHÔNG phải Postgres thật; xem giới hạn trong output)
node -r reflect-metadata -r ts-node/register \
  src/modules/exhibits/perf/public-search-load.ts 150 20 25
```

## Kết quả đã ghi (thư mục `HomeWork/Assignment_03/evidence/`)
- `01-RED-test-fail.log` — test đỏ trước khi code (fail đúng lý do).
- `02-GREEN-test-pass.log` — 17/17 pass sau patch.
- `03-MUTATION-killed.log` — mutation “nuốt exception, trả default” bị TC-12 phát hiện.
- `04-PERF-load-150.log` — p95 ≈ 152 ms (0 lỗi) so với mục tiêu 4.0 s.
- `05-COVERAGE.log` — service 92% / repo 90% line coverage.
- `06-FLAKY-determinism-3runs.log` — 3 lần chạy đều ổn định.

## Lưu ý review
- Route `search` **phải** đứng trước `:slug` — nếu không `/rooms/search` bị khớp vào `getRoom('search')` (đã quan sát 500 ở bước RED).
- **Không merge khi nhóm chưa review** (quy định đề bài).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
