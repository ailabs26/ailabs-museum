# Traceability & Evidence — VT-077 (đã thực thi)

**Nhánh:** `feat/VT-077-public-exhibit-search` · **Baseline slice:** `6e937c5` (từ `dev` @ `a9591858`)
**Commits:** `6e937c5` baseline → `8d66cf4` RED → `7b559e1` GREEN → `507e4c6` harness+README
→ **vòng review 2:** `ab3b77c` fix+test (review @nguyenthangdev) → `5dfcc79` dọn repo

## Bảng truy vết AC/Risk → Test → File → Commit → Kết quả

| AC/Risk | Test case | Test file | Commit | Kết quả |
|---|---|---|---|---|
| AC-1 search | TC-01, TC-02, TC-11 | `tests/public-search-service.spec.ts`, `...contract.spec.ts` | 7b559e1 | PASS |
| AC-2 filter | TC-03, TC-04 | `...service.spec.ts`, `...repository.spec.ts`, `...contract.spec.ts` | 7b559e1 | PASS |
| AC-3 pagination | TC-05, TC-06 | `...repository.spec.ts`, `...contract.spec.ts` | 7b559e1 | PASS |
| **AC-4 stable order (invariant)** | TC-07, TC-08 | `...repository.spec.ts` (addOrderBy id), `...service.spec.ts` (giữ thứ tự) | 7b559e1 | PASS |
| **AC-5 contract/backward-compat** | TC-09, TC-10 | `...contract.spec.ts` (envelope+meta, no leak) | 7b559e1 | PASS |
| Risk 400 vs 500 | TC-04, TC-05 | `...contract.spec.ts` | 7b559e1 | PASS |
| **Risk nuốt lỗi (mutation)** | TC-12 failure-path | `...service.spec.ts` (assert.rejects) | 7b559e1 | PASS (bắt mutation) |
| **Risk SQL 500 trên Postgres thật** | SQL-01 (invariant cột order-by) | `tests/public-search-sql.spec.ts` + `...integration.spec.ts` | ab3b77c | PASS (code cũ FAIL đúng lý do) |
| **Risk lộ hiện vật phòng không ACTIVE** | SQL-02 negative | `tests/public-search-sql.spec.ts` + `...integration.spec.ts` | ab3b77c | PASS |
| **Risk ILIKE khớp khóa JSON / `%` wildcard** | SQL-03/04 | `tests/public-search-sql.spec.ts` + `...integration.spec.ts` | ab3b77c | PASS |
| **Risk slug `search` nuốt route phòng** | TC-030b/030c | `rooms/tests/rooms-dto.spec.ts` | ab3b77c | PASS |

## Evidence files (`evidence/`)
| File | Chứng minh |
|---|---|
| `01-RED-test-fail.log` | 12/12 FAIL trước patch (fail đúng lý do: stub rỗng + route bị `:slug` nuốt → 500) |
| `02-GREEN-test-pass.log` | 17/17 PASS sau patch |
| `03-MUTATION-killed.log` | Mutation "nuốt exception + trả default" → TC-12 FAIL ("Missing expected rejection") |
| `04-PERF-load-150.log` | 150 đồng thời × 20 vòng = 3000 req, 0 lỗi, **p95 = 152 ms** (≤ 4000 ms) |
| `05-COVERAGE.log` | service.ts 92.16% line / 89.47% branch; repository.ts 90.13% / 92.00%; all 89.60% |
| `06-FLAKY-determinism-3runs.log` | 3 lần chạy đều 17 PASS 0 FAIL (ổn định) |
| `round2/01-RED-before-fix.log` | Tạm revert fix → test vòng 2 FAIL đúng lý do, kèm thông báo `column "distinctAlias.exhibit_display_order" does not exist (500)` |
| `round2/02-GREEN-after-fix.log` | 22/22 PASS sau fix vòng 2 |
| `round2/03-MUTATION-killed.log` | Mutation lặp lại ở vòng 2 → TC-12 bắt |
| `round2/04-PERF-load-150.log` | 150×20 req, 0 lỗi, p95 ≈ 103 ms (≤ 4000 ms) |
| `round2/05-COVERAGE-full-exhibits.log` | repo 92.56% / service 92.16% line (toàn suite exhibits) |
| `round2/06-FLAKY-3runs.log` | 3 lần chạy slice đều 22 PASS 0 FAIL |

## Coverage trong context (không dùng % đơn độc)
- **Line/branch cao** nhưng điều quan trọng là **risk coverage**: mọi AC-1..AC-5 + 2 risk (400/500, nuốt lỗi) đều có test gắn.
- Mutation experiment chứng minh assertion **đủ mạnh** (không phải "test theater"): khi tiêm lỗi, test đỏ.

## Flaky-test review (2 nguy cơ đã kiểm)
1. **Order / shared state:** test dùng fixtures dựng mới mỗi case (không chia sẻ DB) → 3 lần chạy ổn định (`06-...log`). Invariant ordering được chốt bằng tiebreaker `id`.
2. **Concurrency / time:** harness tải ban đầu lỗi 826/3000 do supertest mở listener ephemeral (cạn cổng) → sửa bằng `listen()` một lần + `http.Agent` keepAlive → 0 lỗi. Bài học: flaky do hạ tầng test, không phải do code.

## Giới hạn trung thực
- Unit/contract test chạy **không có Postgres** (mock repo / fake QueryBuilder). Ordering SQL thật + ILIKE/JSONB cần **integration test DB thật** để xác nhận cuối (characterization hiện tại chỉ chứng minh `addOrderBy('exhibit.id')` có mặt).
- Perf: service/DB **mô phỏng bằng độ trễ** → p95 152 ms là **cận dưới**, không phải số production.

## ≥2 điểm AI-generated chưa đáng tin ngay (đã phát hiện thực tế)
1. **Giả định Jest:** pattern test mặc định của AI là `describe/it` + `expect` (Jest). Repo dùng `node:test` + `node:assert` → phải viết lại theo runner thật.
2. **Weak assertion / stable order giả định:** dễ chỉ assert `data.length > 0` hoặc tin rằng `ORDER BY displayOrder` là đủ ổn định; thực tế `displayOrder` không duy nhất → thiếu tiebreaker `id` thì phân trang trùng/sót (bằng chứng: admin path cũ `exhibits.repository.ts:256` chỉ `displayOrder, createdAt`).
3. **Cast TS:** `as Record<string,unknown>` trực tiếp trên DTO bị `tsc` từ chối (TS2352) — "trông đúng" nhưng không build (bằng chứng: lần GREEN đầu fail biên dịch).
4. **(vòng 2 — xác nhận bởi reviewer) Fake QueryBuilder cho GREEN giả:** unit test mock QueryBuilder xanh 17/17 nhưng truy vấn thật sinh SQL hỏng — `select(['exhibit.id'])` + join + `take` khiến subquery `distinctAlias` tham chiếu cột `display_order` không được select → **500 trên mọi request Postgres thật**. Reviewer `@nguyenthangdev` bắt được điều mock bỏ sót (đúng cảnh báo "mock chỉ cho cảm giác an toàn giả" ở §3 bài nộp). Đã sửa `select` + thêm `public-search-sql.spec.ts` (dựng SQL từ metadata thật) để chốt.
5. **(vòng 2) Thiếu ranh giới dữ liệu khó thấy khi mock:** repo không lọc theo `room.status`/`isDeleted` → hiện vật APPROVED trong phòng nháp/đã ẩn/đã xóa vẫn lộ ra search công khai. Mock không có quan hệ room thật nên không phát hiện; chỉ integration/SQL test theo metadata mới thấy.
