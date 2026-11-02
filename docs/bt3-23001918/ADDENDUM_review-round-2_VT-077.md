# PHỤ LỤC D — Vòng Review 2 (phản hồi review của nhóm)

> BT3_23001918_VT-077 — Nguyễn Đức Quang · 23001918 · SE2026-T20
> Bổ sung sau khi nộp: khép kín bước **Review** của vòng lặp Spec → Test → AI-assisted Change → Verify → **Review**.
> Phụ lục, **không tính vào giới hạn 8 trang**. PR: github.com/ailabs26/ailabs-museum/pull/130
> Commit vòng 2: `ab3b77c` (fix + test) · `5dfcc79` (dọn repo).

## D.1 Review của nhóm (reviewer `@nguyenthangdev`) — "request changes"

Reviewer **chạy lại 17/17 test, CI xanh**, nhưng chỉ ra 2 lỗi **bắt buộc sửa** và 2 lỗi **nên sửa** —
tất cả đều thuộc **đúng lớp rủi ro mà bài nộp đã tự cảnh báo**: §3 ("mock chỉ cho *cảm giác an toàn
giả*"), §4 ("chưa thay cho integration test DB thật"), §7 ("test giá trị cao nhất tiếp theo: integration
test với Postgres thật"). Review đã **biến residual risk dự đoán thành bằng chứng thực**.

| # | Mức | Lỗi reviewer chỉ ra | Vì sao unit test cũ (mock) không bắt |
|---|---|---|---|
| 1 | 🔴 | `select(['exhibit.id'])` + join + `take`: TypeORM bọc truy vấn trong subquery `distinctAlias`; cột `display_order` trong `ORDER BY` **không được select** → Postgres báo `column "distinctAlias.exhibit_display_order" does not exist` → **mọi request /rooms/search trả 500** | Fake QueryBuilder không sinh SQL thật nên không lộ subquery `distinctAlias` |
| 2 | 🔴 | Thiếu điều kiện theo phòng → **lộ hiện vật APPROVED thuộc phòng chưa ACTIVE / đã ẩn / đã xóa** ở search công khai | Mock repo không có quan hệ `room` thật để kiểm |
| 3 | 🟡 | `CAST(content AS text) ILIKE` khớp cả **khóa JSON** (`q=name`, `q=en`) và trường nội bộ (màu/tọa độ); `%`/`_` không escape → `q=%` trả tất cả | Mock chỉ assert tham số `search`, không chạy ILIKE thật |
| 4 | 🟡 | Slug `search` hợp lệ theo regex kebab-case → `GET /rooms/search` **nuốt** phòng có slug `search` | Chưa test xung đột slug/route |

## D.2 Patch vòng 2 + test chứng minh (RED → GREEN)

**Nguyên tắc test-first được lặp lại:** viết/sửa test TRƯỚC, chạy trên code cũ để thấy **đỏ đúng lý do**
(`evidence/round2/01-RED-before-fix.log`), rồi mới sửa.

```text
# RED (tạm revert fix, chạy test vòng 2):
🔴#1 "cột ORDER BY exhibit_display_order KHÔNG được select ⇒ column
     "distinctAlias.exhibit_display_order" does not exist (500)"
🔴#2 innerJoin rooms + room.status/is_deleted: FAIL
🟡  CAST(content AS text) vẫn còn + thiếu ESCAPE: FAIL
# tests 10 | pass 3 | fail 7         ← test mới bắt đúng 4 lỗi reviewer
```

| Lỗi | Sửa (`ab3b77c`) | Test gắn |
|---|---|---|
| 🔴#1 | Tách `buildPublicSearchIdQuery()`; `select(['exhibit.id','exhibit.displayOrder','exhibit.roomId'])` | `public-search-sql.spec.ts` (SQL-01, dựng SQL từ **metadata TypeORM thật**, không cần DB) + `public-search.integration.spec.ts` (Postgres thật, chỉ đọc) |
| 🔴#2 | `innerJoin('exhibit.room')` + `room.status=ACTIVE` + `room.isDeleted=false` | SQL-02 negative + integration |
| 🟡#3 | Bỏ `CAST`; tìm `content->'name'/'description'` (vi/en + chuỗi thường); `ESCAPE '\'` + escape `%`/`_` | SQL-03/04 + integration |
| 🟡#4 | `CreateRoomDto` chặn `RESERVED_ROOM_SLUGS=['search']` | `rooms-dto.spec.ts` TC-030b/030c |

```text
# GREEN (evidence/round2/02-GREEN-after-fix.log): # tests 22 | pass 22 | fail 0
# Full project (bash glob):                       # tests 1966 | pass 1966 | fail 0
# tsc --noEmit: OK · eslint .: OK
```

Phụ: `ORDER BY roomId, displayOrder, id` (khớp index `IDX_exhibits_room_order_id`, hết xen kẽ phòng);
`sort` ghi rõ bị bỏ qua; `perf/` chuyển ra khỏi `src/` (không vào `dist`); README sửa glob `public-search*`
(trước chỉ chạy 11/17 do thiếu `.contract`).

## D.3 "Who tests the tests" — bài học được củng cố

Mutation bắt buộc ("nuốt exception + trả default") vẫn bị **TC-12** bắt khi lặp ở vòng 2
(`round2/03-MUTATION-killed.log`), nhánh nộp 0 mutation. **Bài học quan trọng hơn** đến từ chính review:
unit test mock cho **17/17 xanh nhưng SQL thật 500** — đúng định nghĩa "test theater" ở tầng SQL. Khắc phục
bằng **SQL-level test trên metadata thật** (bắt lỗi ngay trong CI, không cần Postgres) + **integration test
DB thật** (xác nhận cuối). Đây là minh chứng trực tiếp cho luận điểm §7: *không dùng "test xanh" làm bằng
chứng chất lượng*.

## D.4 Coverage & perf vòng 2 (toàn suite exhibits)

| File | Line % | Branch % |
|---|---|---|
| `repositories/exhibits.repository.ts` | 92.56 | 92.50 |
| `services/exhibits.service.ts` | 92.16 | 89.47 |
| `mappers/public-exhibit.mapper.ts` | 100.00 | 86.08 |

Perf lặp lại ở 150 tác vụ đồng thời: p95 ≈ 103 ms, 0 lỗi (`round2/04-PERF-load-150.log`) — giới hạn giữ
nguyên (DB mô phỏng; p95 production cần Postgres thật, nay đã có `public-search.integration.spec.ts` để đo).

## D.5 Residual risk (cập nhật)

Đã **đóng** phần lớn residual risk §7: SQL thật không còn 500, ranh giới phòng công khai được chốt, ILIKE
chỉ khớp trường hiển thị. Còn lại cần DB thật xác nhận: collation tiếng Việt khi so khớp/sắp xếp, và hành vi
dưới contention/index thực thi ở tải production — chạy `RUN_DB_IT=1 … public-search.integration.spec.ts`.
PR vẫn **Draft, chưa merge** cho tới khi nhóm review lại (đúng quy định đề bài).
