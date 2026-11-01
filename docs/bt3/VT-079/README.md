# BT3 · VT-079 — Lưu nháp tự động, bản cũ không ghi đè bản mới

- Sinh viên: Nguyễn Văn Thắng (23001938). Team: SE2026-T20. Đề tài: 3D-WEB-03.
- Nhánh: `feat/vt079-draft-autosave`. Baseline: `dev@4c2a6d0`.
- Phạm vi: form **sửa** hiện vật trong CMS, đi qua `PATCH /admin/exhibits/:id`.

## 1. Specification

**Problem statement.** Biên tập viên CMS mất nội dung nếu quên bấm Lưu. Thêm autosave một cách ngây thơ sẽ gây *lost update*. Lý do: `PATCH /admin/exhibits/:id` không mang version mà client đang thấy; `updateExhibitDraft` chỉ so với version do chính server đọc ở đầu request. Vì vậy một request cũ đến sau (retry muộn, tab khác, autosave chậm) vẫn ghi đè được bản mới hơn.

**Acceptance criteria**

| ID | Tiêu chí kiểm thử được |
|---|---|
| AC1 | Đang sửa hiện vật (draft/rejected/approved), ngừng nhập 1.5 s và form hợp lệ → FE tự `PATCH` kèm `expectedVersion`. Thành công thì hiện "Đã lưu lúc hh:mm", cập nhật version, drawer **không** đóng. |
| AC2 | `expectedVersion` ≠ version trong DB → `409`, content/revision/hotspots/version không đổi. Thiếu hoặc sai kiểu → `400`. |
| AC3 | N request đồng thời cùng `expectedVersion` → đúng 1 thành công, N−1 nhận `409`; version tăng đúng 1. |
| AC4 | Gửi lại (replay) một request đã thành công → `409`, state không đổi (idempotent về state). |
| AC5 | FE chỉ có tối đa 1 autosave in-flight; thay đổi phát sinh trong lúc chờ được gộp thành 1 lần lưu kế tiếp với version mới. `409` → dừng autosave, giữ nội dung form, cảnh báo, không tự ghi đè. Lỗi mạng/5xx → giữ snapshot, thử lại với **cùng** `expectedVersion`. |

**Non-functional constraints**
- NFR1: 200 autosave đồng thời có p95 ≤ 5.0 s, 0 lỗi 5xx (môi trường local, xem §5).
- NFR2: không thêm dependency, không migration (cột `exhibits.version` đã có).
- NFR3: mỗi form tối đa 1 request mỗi 1.5 s; snapshot không đổi thì không gửi. Mục đích là giới hạn số dòng audit `exhibit.update`.

**Invariant / contract.** Mọi lần ghi bản nháp là *compare-and-swap* trên `(exhibitId, expectedVersion)`: write chỉ được commit nếu dựa trên đúng version mới nhất; `version` tăng đơn điệu, đúng +1 cho mỗi commit.

## 2. Decision table — `PATCH /admin/exhibits/:id`

C1 exhibit tồn tại, chưa xóa · C2 `expectedVersion` hợp lệ (int ≥ 0) · C3 so với version DB · C4 trạng thái revision.

| Rule | C1 | C2 | C3 | C4 | Hành động |
|---|---|---|---|---|---|
| R1 | Y | Y | = | draft / rejected | 200, sửa tại chỗ, version+1 |
| R2 | Y | Y | < (stale) | bất kỳ | 409, không đổi gì |
| R3 | Y | Y | > (future) | bất kỳ | 409, không đổi gì |
| R4 | – | N (thiếu / −1 / "abc") | – | – | 400 |
| R5 | Y | Y | = | in_review | 409 (BR-26, hành vi có sẵn) |
| R6 | N | Y | – | – | 404 (hành vi có sẵn) |
| R7 | Y | Y | = | approved | 200, fork revision mới, version+1 |
| R8 | Y | 2 request đồng thời | cả hai = | draft | đúng 1×200 + 1×409 |

**Decision table FE queue (`createDraftAutosaver`).**

| Rule | Đang in-flight? | Snapshot khác bản đã lưu? | Kết quả lần trước | Hành động |
|---|---|---|---|---|
| Q1 | N | Y | ok | gửi ngay với version hiện tại |
| Q2 | Y | Y | – | không gửi; giữ snapshot **mới nhất** để gửi sau |
| Q3 | N | N | ok | bỏ qua (NFR3) |
| Q4 | – | – | 409 | dừng hẳn, không gửi nữa |
| Q5 | N | Y | lỗi mạng/5xx | giữ snapshot, lần sau gửi với **cùng** version |

**Cách chọn test data:** boundary quanh version hiện tại `v`: `v−1` (stale), `v`, `v+1` (future); `0` là cận dưới của `@Min(0)`; `−1`, `"abc"` và thiếu field là dữ liệu không hợp lệ. Payload v1/v2 phân biệt bằng tên (`Bản A`/`Bản B`) để oracle "DB vẫn giữ bản mới" không phụ thuộc vào implementation.

## 3. Test cases

| ID | AC / Rule | Level | Precondition / input | Expected | P | File |
|---|---|---|---|---|---|---|
| TC01 | AC2/R4 | unit DTO | body thiếu `expectedVersion` | lỗi validate `expectedVersion` | P1 | `back-end/src/modules/exhibits/tests/exhibit-autosave.spec.ts` |
| TC02 | R4 | unit DTO | `-1`, `"abc"`; `0` | 2 lỗi; `0` hợp lệ | P2 | idem |
| TC03 | AC2/R2 | unit service | DB v=3, `expectedVersion=2` | `ConflictException`, không `save`/`saveRevision` | P1 | idem |
| TC04 | R3 | unit service | DB v=3, `expectedVersion=4` | `ConflictException`, không ghi | P2 | idem |
| TC05 | AC1/R1 | unit service | DB v=3, `expectedVersion=3` | ghi, version=4 | P1 | idem |
| TC06 | AC2/AC4 | integration PG | lưu `Bản A` (v1→2), `Bản B` (v2→3), replay `Bản A` với v=1 | 409; DB còn `Bản B`, version=3 | P1 | `.../exhibit-autosave.integration.spec.ts` |
| TC07 | AC3/R8 | integration PG | 2 và 10 request song song cùng version | đúng 1 thành công; version+1 | P1 | idem |
| TC08 | R7 | integration PG | revision approved, version khớp | fork revision mới, version+1; stale sau fork → 409 | P2 | idem |
| TC09 | R5 | integration PG | submit review rồi autosave với version cũ | 409; revision vẫn in_review | P2 | idem |
| TC10 | R4 | API (HTTP + ValidationPipe thật) | `PATCH` thiếu version | 400, service không được gọi | P1 | `.../exhibit-autosave.spec.ts` |
| TC11 | AC5/Q1–Q2 | unit FE | save đang treo, 3 lần `schedule` | 1 in-flight; lần 2 gửi snapshot mới nhất với version trả về | P1 | `front-end/src/helpers/draftAutosave.test.ts` |
| TC12 | AC5/Q4 | unit FE | save trả 409 | `onConflict`, mọi `schedule` sau đó không gửi | P1 | idem |
| TC13 | AC5/Q5 | unit FE | save lỗi mạng | `onError`, retry với cùng version | P2 | idem |
| TC14 | NFR3/Q3 | unit FE | snapshot giống bản đã lưu | không gọi save | P3 | idem |
| TC15 | AC1/AC5 | E2E Playwright (API mock) | gõ tên → chờ; tab khác tăng version → gõ tiếp | "Đã lưu", PATCH có `expectedVersion`; banner xung đột, form giữ nội dung, không PATCH ghi đè | P1 | `front-end/tests/cms-exhibit-autosave.spec.ts` |
| TC16 | NFR1/AC3 | load | 200 PATCH/200 exhibit; 200 PATCH/1 exhibit | p95 ≤ 5 s; đúng 1×200 + 199×409 | P2 | `back-end/scripts/bt3-autosave-load.ts` |

Negative: TC01, TC02, TC04, TC10. Failure path gắn với risk riêng: TC06 (stale replay), TC12 (409 ở FE), TC13 (lỗi mạng).

**Không làm:** E2E với backend thật cho từng rule (chậm, dễ flaky, integration PG đã phủ); đo thời gian debounce trong E2E (đã kiểm bằng fake timers ở unit); visual test; luồng tạo mới (ngoài scope).

## 4. Cách chạy test

```bash
# PostgreSQL tạm, chỉ localhost (KHÔNG dùng DB trong back-end/.env)
docker run -d --name vt079-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aura_test \
  -p 127.0.0.1:5433:5432 postgres:16-alpine
export PG=postgres://postgres:postgres@127.0.0.1:5433/aura_test
export DATABASE_URL=$PG DATABASE_SSL=false AUTOSAVE_TEST_DATABASE_URL=$PG

cd back-end
node -r reflect-metadata -r ts-node/register --test \
  src/modules/exhibits/tests/exhibit-autosave.spec.ts \
  src/modules/exhibits/tests/exhibit-autosave.integration.spec.ts
npm test                       # toàn bộ suite back-end

cd ../front-end
npx vitest run src/helpers/draftAutosave.test.ts
# Máy không có browser của Playwright: dùng Chrome hệ thống
PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/cms-exhibit-autosave.spec.ts --reporter=line
```

Integration test tự `skip` nếu `AUTOSAVE_TEST_DATABASE_URL` không trỏ tới localhost (log GREEN ghi `skipped 0`).

**Tải (TC16).** Build và chạy server cục bộ trỏ vào PG Docker, ghi đè mọi biến của `.env`: `DATABASE_URL`, `DATABASE_SSL=false`, `SUPABASE_*=` rỗng, `MEDIA_STORAGE_DRIVER=local`, `PORT=3101`, secret test, `SEED_ADMIN_EMAIL/PASSWORD`. Thứ tự: `npm run build && npm run migration:run && npm run seed && node dist/main.js`. Sau đó chạy:

```bash
API_URL=http://127.0.0.1:3101/api LOAD_EMAIL=... LOAD_PASSWORD=... node scripts/bt3-autosave-load.mjs
```

Script từ chối chạy nếu `API_URL` không phải localhost.

**Lặp TC07 (flaky / mutation):** `docs/bt3/VT-079/scripts/repeat-tc07.sh back-end 30 "Patch"`.

## 5. Kết quả (evidence trong `evidence/`)

| Bước | Kết quả | Log |
|---|---|---|
| Baseline `dev@4c2a6d0` | BE 2040/2040. 13/13 E2E edit-persistence **crash trên dev** vì fixture thiếu `/admin/stats/overview`; sau khi vá fixture (`4ae85f4`) đạt 13/13 | `00-baseline-*` |
| RED (trước patch) | BE 7 fail đúng lý do (bản cũ được chấp nhận / DTO cho thiếu version / PATCH trả 200). FE unit 6 fail, E2E 2 fail (không có autosave). Lần chạy đầu fail **sai lý do** (oracle TC05, fixture TC09), đã sửa test, không sửa sản phẩm | `00-red-first-run-wrong-reason.log`, `01-red-*` |
| GREEN | VT-079 BE 12/12; toàn bộ BE 2052/2052 (`skipped 0`); FE unit 201/201; E2E 15/15 | `02-green-*` |
| Regression E2E khác | Tập test fail trùng với baseline (22 test có sẵn: 18 crash stats, 3 cần backend thật, 1 assertion cũ). Khác biệt duy nhất `exhibit-preview › WebGL unavailable` chạy lại 3/3 pass, kết luận là flaky | `02-regression-other-e2e.log` |
| Mutation | M1 bỏ guard version → bị bắt (TC03/04/06/08; TC07 chỉ bắt 3/30). M2 bỏ khóa dòng → TC07 bắt 30/30. M3 bỏ guard 1 in-flight → TC11 bắt. M4 gửi lại sau 409 → TC12 bắt. Không mutant nào sống sót | `03-mutation-*` |
| Coverage BE | `exhibits.service.ts` 96.3% line / 81.7% branch (cả suite exhibits); riêng spec VT-079 là 43.4% / 37.9%. `update-exhibit.dto.ts` 89.7% line | `04-coverage-backend.log` |
| AI review sau test | 2 nhận xét đúng được tái hiện (RED), sửa và chuyển GREEN (`e5e546d`) | `05-review-fix-*` |
| Tải 200 đồng thời | A: p95 2967 / 2787 / 2778 ms (≤ 5000, **đạt**), 600/600 trả 200, 0 lỗi 5xx. B: 1×200 + 199×409, version +1, nội dung là của request thắng | `06-load-200-concurrent.log` |
| Flaky | shuffle 5 seed 9/9; E2E ×5 15/15; integration chạy 2 lần và đảo thứ tự đều pass; 0 dữ liệu rác; TC07 ×30 30/30 | `07-flaky-review.log` |

**Risk coverage theo AC** (không dùng một tỷ lệ % duy nhất):

| AC / risk | Bằng chứng mạnh nhất | Còn hở |
|---|---|---|
| AC1 autosave chạy, drawer mở | E2E TC15-1 | Đo thời gian thật chỉ dùng clock giả |
| AC2 bản cũ → 409, không đổi | TC03/04/06/08 trên PG thật; giết M1 | – |
| AC3 song song đúng 1 thắng | TC07 giết M2 30/30; tải B | TC07 yếu với M1 (10%) |
| AC4 replay idempotent về state | TC06 | Retry sau khi server đã commit nhưng response bị mất → người dùng thấy 409 (chưa xử lý) |
| AC5 FE queue | TC11–14, TC11b, TC13c; giết M3/M4; E2E race | Đóng drawer khi còn thay đổi chưa gửi thì mất ≤ 1.5 s nhập liệu |
| NFR1 p95 ≤ 5 s | tải A/B | Một máy, không có mạng thật, pool 10, NODE_ENV=development |

## 6. Traceability

| AC / Risk | Test case | File test | Commit | Kết quả |
|---|---|---|---|---|
| AC2, R4 | TC01, TC02, TC10 | `back-end/src/modules/exhibits/tests/exhibit-autosave.spec.ts` | test `d1676a4` → fix `86acaa3` | RED → GREEN |
| AC2, R2/R3 | TC03, TC04 | idem | `d1676a4` → `86acaa3` | RED → GREEN, giết M1 |
| AC1, R1 | TC05 | idem | `d1676a4` | GREEN (characterization) |
| AC2/AC4 | TC06 | `.../exhibit-autosave.integration.spec.ts` | `d1676a4` → `86acaa3` | RED → GREEN, giết M1 |
| AC3, R8 | TC07 | idem | `d1676a4` | GREEN cả trước patch; giết M2 30/30 |
| R7 | TC08 | idem | `d1676a4` → `86acaa3` | RED → GREEN, giết M1 |
| R5 | TC09 | idem | `d1676a4` | GREEN (hành vi BR-26 có sẵn) |
| AC5 | TC11–TC14 | `front-end/src/helpers/draftAutosave.test.ts` | `d1676a4` → `d67fdff` | RED → GREEN, giết M3/M4 |
| AC5 (AI review #1, #3) | TC11b, TC13c, E2E race | idem + `front-end/tests/cms-exhibit-autosave.spec.ts` | `e5e546d` | RED → GREEN |
| AC1/AC5 | TC15 | `front-end/tests/cms-exhibit-autosave.spec.ts` | `d1676a4` → `d67fdff` | RED → GREEN |
| NFR1, AC3 | TC16 | `back-end/scripts/bt3-autosave-load.mjs` | (commit docs cuối) | Đạt |
| Regression | 13 E2E edit-persistence + 2052 BE | – | `4ae85f4`, `4f67fef` | GREEN |
