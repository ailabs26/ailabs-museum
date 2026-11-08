# Guided Tour Core — Task Breakdown & Acceptance

> **Trạng thái:** IMPLEMENTED — 18 task commit trên `feat/guided-tour-core`; đã kiểm chứng, branch local chưa push/mở PR.
>
> **PLAN:** [guided-tour-core-plan.md](../plans/guided-tour-core-plan.md)<br>
> **Repository:** `ailabs26/ailabs-museum`<br>
> **Source audit:** Đã fetch `origin`; `origin/dev` không đổi và vẫn ở `6e40d356bdb8411d2acfd3f431fb3ce2e9f22add` (08/11/2026).<br>
> **Branch:** `feat/guided-tour-core`, tạo từ `origin/dev`; branch local, chưa push/mở PR.

## 1. User story / outcome

Là khách tham quan, tôi muốn một chuyến tham quan có hướng dẫn đi theo thứ tự các hiện vật công khai trong phòng, có thể bắt đầu, tạm dừng, tiếp tục, sang bước sau/trước và kết thúc; để sau này các giao diện 2D/3D điều khiển cùng một phiên tour nhất quán.

**Đây là headless feature.** Chưa có thanh nút tour trên giao diện khách, camera auto-focus/teleport, tự phát media, timer hay Auto Tour. F06/F07 làm UI; F08 nối state với route/selection/mode. Không sửa schema DB, API/backend hay CMS Tour Order.

## 2. Requirements và constraints

| ID | Yêu cầu | Tiêu chí |
|---|---|---|
| FR-01 | Xây dựng bước | Từ `RoomDetail.exhibits` của API public, `sortForTour()` theo `displayOrder` rồi ID; không giữ payload media/content. |
| FR-02 | Session một phòng | `roomId`, `roomSlug`, `steps`, `currentIndex`; ID ổn định xuyên đổi locale. |
| FR-03 | State machine | `idle`, `running`, `paused`, `completed` với invariant rõ và commands có guard. |
| FR-04 | Điều hướng | `start/pause/resume/next/previous/goTo/exit` không wrap, invalid no-op. |
| FR-05 | Hòa giải dữ liệu | Reorder giữ ID; xóa step có fallback deterministic; room invalid → idle. |
| FR-06 | React owner | `MuseumProvider` dưới `PublicLocaleProvider` và trên `Outlet` trong PublicLayout; admin ngoài scope. |
| FR-07 | API cho feature sau | `useGuidedTour()` trả snapshot, selectors và commands type-safe. |
| NFR-01 | Pure reducer | Không đọc/ghi network, storage, URL, DOM, React Query, audio, Three.js. |
| NFR-02 | Không regress | Không ảnh hưởng route, existing 3D scene, audio, locale, backend. |
| NFR-03 | Commit nhỏ và test | **18 commits dự kiến**, test ngay cùng thay đổi, không fake PASS. |

**Out of scope:** thanh Start/Pause/Next trên UI (F06/F07), đồng bộ URL/selection/2D↔3D (F08), Auto Tour, audio/subtitle switching (F04), timer/dwell, cross-tab persistence. `useImmersiveTour()` chỉ quản lý immersive overlay, không phải Guided Tour controller.

## 3. Acceptance scenarios

| AC | Kịch bản | Expected |
|---|---|---|
| AC-01 | Room 0/1/N exhibits, displayOrder trùng | Thứ tự `(displayOrder, id)` ổn định, không mutate input |
| AC-02 | Start room có bước / initial ID hợp lệ | Running, đúng index, không giữ nội dung hiện vật |
| AC-03 | Start room rỗng / ID không hợp lệ | No-op, không tạo phiên giả |
| AC-04 | Pause, Resume và commands không hợp lệ | Chỉ chuyển đúng trạng thái; giữ current step |
| AC-05 | Next tại step cuối | Completed, giữ step cuối, Next tiếp không wrap |
| AC-06 | Previous và GoTo | Đúng index; biên/ID lạ no-op; từ completed trở lại paused |
| AC-07 | Exit/restart | Reset về idle; exit nhiều lần idempotent; start mới có chủ đích |
| AC-08 | Reorder cùng room | Giữ exhibitId hiện tại, cập nhật index, không restart |
| AC-09 | Current exhibit bị rút xuống / room rỗng | Chọn next theo thứ tự cũ, nếu không còn thì previous; paused hoặc idle |
| AC-10 | Room khác, locale-only thay đổi, mạng lỗi tạm | Không làm mất/trôi session |
| AC-11 | Public route đổi / admin boundary | Một Provider giữ state trong public; không rò sang Admin |
| AC-12 | Integration, regression, verification | Chạy test thực; ghi PASS/FAIL/SKIP và giới hạn chứng cứ |

## 4. Task execution checklist

**Quy tắc thực thi:** Mỗi task dưới đây là **một commit dự kiến**, giữ test của hành vi cùng commit. Dùng `git diff --check`, focused Vitest và `npm run typecheck` ở từng task thay code; lint theo cụm; cuối feature chạy full gates. Nếu source `dev` thay đổi gây overlap thì cập nhật task trước, **không cố tạo commit rỗng** để đủ 18.

### Task 00 — Baseline, branch và khóa contract

**Phạm vi file:** `docs/plans/guided-tour-core-plan.md`, `docs/tasks/guided-tour-core.md`.

**Checklist:**
- [x] Fetch `origin`; xác nhận `origin/dev` = `6e40d35`; tạo `feat/guided-tour-core` từ base đó, giữ nguyên hai tài liệu task/plan mới.
- [x] Đọc `AGENTS.md`, frontend conventions, `museum-experience.md`, và truy vết schema/order/data/layout bằng CodeGraph; reducer/context vẫn là placeholder.
- [x] Baseline typecheck/lint/unit/build đã chạy; browser regressions đã chạy và phân loại lỗi cũ, kết quả chi tiết nằm trong plan.
- [x] Ghi SHA, OS, Node, browser và fixture mode; chưa chỉnh production source.

**Acceptance:** Base/source đã được xác minh; có log/checkpoint baseline.

**Commit dự kiến:** `docs(tour): plan guided tour core checkpoints`

### Task 01 — Types và invariant của session

**Phạm vi file:** `front-end/src/interfaces/guidedTour.ts`.

**Checklist:**
- [x] Khai báo `GuidedTourStatus`, `GuidedTourStep`, `GuidedTourSession`, `GuidedTourState`, initial shape, chỉ dùng stable `roomId/exhibitId`.
- [x] Mô tả bằng type và comment invariant: idle không session; các trạng thái khác có ≥1 step cùng room và index hợp lệ.
- [x] Không đưa `name`, `description`, `revision`, media URLs hoặc dữ liệu CMS vào state.
- [x] Typecheck + `git diff --check`; không import module mới vào runtime khi còn chưa có reducer.

**Acceptance:** Hợp đồng dữ liệu TypeScript rõ, không phụ thuộc React/DOM.

**Commit dự kiến:** `feat(tour): define guided tour session types`

### Task 02 — Builder thứ tự các bước từ public room

**Phạm vi file:** `front-end/src/helpers/buildGuidedTourSteps.ts`, `front-end/src/helpers/buildGuidedTourSteps.test.ts`.

**Checklist:**
- [x] Viết RED tests: 0/1/N, tie displayOrder, thứ tự khác input, bất biến input.
- [x] Implement `buildGuidedTourSteps(room: RoomDetail)` tái dùng `sortForTour()`; step chỉ `{roomId, exhibitId}`.
- [x] Test builder không bị ảnh hưởng bởi locale/title/description; không gọi API admin hoặc tự lấy draft.
- [x] GREEN: focused Vitest + typecheck.

**Acceptance:** Order parity với `mapRoomDisplays`, đầu vào không mutate.

**Commit dự kiến:** `feat(tour): build ordered public tour steps`

### Task 03 — Reducer initial state và START

**Phạm vi file:** `front-end/src/reducers/museumReducer.ts`, `front-end/src/reducers/museumReducer.test.ts`.

**Checklist:**
- [x] Viết RED test idle state, START hợp lệ, initial exhibit ID, start phòng rỗng hoặc ID sai.
- [x] Implement pure reducer initial + START; payload đã được chuẩn hóa từ builder, guard empty/unknown ID.
- [x] START khi phiên khác đang tồn tại là thay thế có chủ đích; không dùng title/index UI hoặc side effect.
- [x] GREEN: unit/typecheck; không thêm logic PAUSE/NEXT chưa thuộc task này.

**Acceptance:** AC-02, AC-03, START deterministic.

**Commit dự kiến:** `feat(tour): start guided tour sessions`

### Task 04 — PAUSE và RESUME transitions

**Phạm vi file:** `front-end/src/reducers/museumReducer.ts`, `front-end/src/reducers/museumReducer.test.ts`.

**Checklist:**
- [x] RED: `running→paused→running`, index/steps bất biến; pause/resume khi idle/completed và lặp lại là no-op.
- [x] Implement PAUSE/RESUME, trả lại cùng state reference khi invalid.
- [x] GREEN: focused Vitest, typecheck và diff check.

**Acceptance:** AC-04, không làm drift bước.

**Commit dự kiến:** `feat(tour): handle pause and resume transitions`

### Task 05 — EXIT và restart semantics

**Phạm vi file:** `front-end/src/reducers/museumReducer.ts`, `front-end/src/reducers/museumReducer.test.ts`.

**Checklist:**
- [x] RED: EXIT từ running/paused/completed; exit lần 2 no-op; START sau EXIT luôn tạo session mới.
- [x] Implement EXIT → `idle`, xóa session; START thay phiên cũ mà không trộn room/steps.
- [x] GREEN: focused Vitest/typecheck; không lưu storage.

**Acceptance:** AC-07, reset idempotent.

**Commit dự kiến:** `feat(tour): reset and restart guided sessions`

### Task 06 — NEXT và COMPLETED

**Phạm vi file:** `front-end/src/reducers/museumReducer.ts`, `front-end/src/reducers/museumReducer.test.ts`.

**Checklist:**
- [x] RED: 1 bước, N bước, next từ running/paused; next tại cuối → completed; next sau completed no-op.
- [x] Implement NEXT tăng đúng 1 index, giữ running/paused trước step cuối; hoàn tất không xóa step.
- [x] GREEN: unit/typecheck; không auto-wrap, auto-advance, timer.

**Acceptance:** AC-05, off-by-one và completed đã test.

**Commit dự kiến:** `feat(tour): advance steps and complete tours`

### Task 07 — PREVIOUS và ranh giới đầu tour

**Phạm vi file:** `front-end/src/reducers/museumReducer.ts`, `front-end/src/reducers/museumReducer.test.ts`.

**Checklist:**
- [x] RED: previous ở index 0 no-op; previous từ running/paused trừ đúng 1; previous từ completed → paused tại bước trước nếu có.
- [x] Implement PREVIOUS; không tự resume khi rời completed; giữ cùng object khi command invalid.
- [x] GREEN: focused Vitest/typecheck.

**Acceptance:** AC-06 phần PREVIOUS.

**Commit dự kiến:** `feat(tour): navigate to previous tour steps`

### Task 08 — GO_TO theo ID hiện vật

**Phạm vi file:** `front-end/src/reducers/museumReducer.ts`, `front-end/src/reducers/museumReducer.test.ts`.

**Checklist:**
- [x] RED: goto first/middle/last, ID lạ, idle, goto cùng ID, goto từ completed.
- [x] Implement GO_TO theo `exhibitId` trong session, không theo array index hoặc tên đã dịch.
- [x] Từ completed, goto hợp lệ chuyển `paused`; không chạm URL/scene/camera.
- [x] GREEN: unit/typecheck.

**Acceptance:** AC-06 phần GO_TO, ID guards.

**Commit dự kiến:** `feat(tour): jump to published exhibit steps`

### Task 09 — Pure selectors và progress contract

**Phạm vi file:** `front-end/src/helpers/guidedTourSelectors.ts`, `front-end/src/helpers/guidedTourSelectors.test.ts`.

**Checklist:**
- [x] Khai báo selector thuần cho `currentStep`, `currentIndex`, `total`, `progress`, `canNext`, `canPrevious`; chốt chính xác progress tính cả completed.
- [x] RED: idle/one-step/multi-step/completed, index boundary; không chia cho 0 và không lưu derived values trong reducer.
- [x] GREEN: unit/typecheck và lint phần mới.

**Acceptance:** FR-07 selectors nhất quán cho UI F06/F07.

**Commit dự kiến:** `feat(tour): derive guided tour progress selectors`

### Task 10 — Reconcile khi CMS đổi thứ tự

**Phạm vi file:** `front-end/src/reducers/museumReducer.ts`, `front-end/src/reducers/museumReducer.test.ts`.

**Checklist:**
- [x] RED: reorder với step hiện tại giữ nguyên ID, index thay đổi; room khác ID không tác động.
- [x] Implement RECONCILE từ published steps mới, id-based; nếu danh sách ID+order giống nhau thì no-op dù text/locale khác.
- [x] Giữ status khi current step vẫn tồn tại; không reset session theo object query mới.
- [x] GREEN: unit/typecheck.

**Acceptance:** AC-08, AC-10.

**Commit dự kiến:** `feat(tour): preserve current step across reorders`

### Task 11 — Reconcile khi hiện vật bị gỡ xuất bản

**Phạm vi file:** `front-end/src/reducers/museumReducer.ts`, `front-end/src/reducers/museumReducer.test.ts`.

**Checklist:**
- [x] RED: current ID mất; chọn **next còn public theo thứ tự phiên cũ**, rồi previous; tránh trỏ ID đã mất.
- [x] Implement fallback chọn current index trong **thứ tự mới** và status `paused`; room không còn step → `idle`.
- [x] Kiểm thay đổi khi đang paused/completed, xóa nhiều ID, input immutable.
- [x] GREEN: focused Vitest/typecheck.

**Acceptance:** AC-09, deterministic removal behavior.

**Commit dự kiến:** `feat(tour): reconcile removed exhibit steps`

### Task 12 — INVALIDATE_ROOM và chính sách dữ liệu lỗi/tới muộn

**Phạm vi file:** `front-end/src/reducers/museumReducer.ts`, `front-end/src/reducers/museumReducer.test.ts`.

**Checklist:**
- [x] RED: invalidate đúng room đang tour → idle; invalidate room khác → no-op; reconcile response room khác đến muộn → no-op.
- [x] Implement INVALIDATE_ROOM chỉ nhận roomId; loading/isFetching/network error **không** được coi là xác nhận mất room.
- [x] Ghi rõ adapter F06–F08 chỉ dispatch invalidate từ bằng chứng room đã biến mất/không còn public, không từ lỗi tạm thời.
- [x] GREEN: focused unit/typecheck.

**Acceptance:** AC-09, AC-10 và tránh stale-response reset.

**Commit dự kiến:** `feat(tour): guard room invalidation events`

### Task 13 — MuseumProvider và typed dispatch API

**Phạm vi file:** `front-end/src/contexts/MuseumContext.tsx`.

**Checklist:**
- [x] Thay placeholder bằng Context/`MuseumProvider` dùng `useReducer(museumReducer, INITIAL_...)` và dispatch typed actions.
- [x] Context cung cấp snapshot và actions (start/pause/resume/next/previous/goTo/exit/reconcile/invalidate) nhưng **không fetch dữ liệu**.
- [x] `start(room, initialId?)` và `reconcileRoom(room)` gọi builder từ API `RoomDetail` đã validate; không chạy side effects.
- [x] Chưa mount vào layout; typecheck/lint/build smoke.

**Acceptance:** Một controller headless có owner rõ, chưa tác động production routes.

**Commit dự kiến:** `feat(tour): provide shared museum tour context`

### Task 14 — useGuidedTour hook và contract consumer

**Phạm vi file:** `front-end/src/hooks/useGuidedTour.ts`.

**Checklist:**
- [x] Expose hook type-safe lấy context, selectors, commands; không tạo store/provider khác.
- [x] Khi gọi ngoài Provider: ném lỗi rõ (kiểm trong test-only fixture Task 16).
- [x] API không mang chi tiết scene 2D/3D và không expose state setter trực tiếp.
- [x] Typecheck/lint. Không thêm button để thử trực tiếp trong giao diện thật.

**Acceptance:** FR-07, một hook ổn định cho F06–F08.

**Commit dự kiến:** `feat(tour): expose guided tour consumer hook`

### Task 15 — Mount Provider đúng public boundary

**Phạm vi file:** `front-end/src/layouts/PublicLayout.tsx`.

**Checklist:**
- [x] Bọc `MuseumProvider` duy nhất trong `PublicLocaleProvider`, trên `PublicLayoutContent` và `<Outlet />`.
- [x] Giữ admin và CMS ở ngoài Provider; không chỉnh router không cần thiết.
- [x] Không tự START khi mount; StrictMode không tạo tour hay timer; reload → idle theo memory scope.
- [x] GREEN: typecheck/lint/build + smoke Public routes.

**Acceptance:** AC-11, không regress PublicLayout/locale.

**Commit dự kiến:** `feat(tour): scope tour session to public layout`

### Task 16 — Browser contract, accessibility boundary và regression

**Phạm vi file:** `front-end/tests/fixtures/*` hoặc `front-end/tests/guided-tour-core.spec.ts` (test-only), affected Playwright specs`.

**Checklist:**
- [x] Tạo test-only fixture/route (không publish debug UI) kiểm hook và transition qua React Provider khi đổi public routes.
- [x] Kiểm `start→pause→resume→next→exit`, state không sang Admin, reload idle; Provider bắt đầu ở idle và không tự start.
- [x] Chạy affected Playwright: guided-tour-core 2/2; public-language/collection/exhibit-detail/museum-tour tổng 46/46; museum-navigation 10/10; public-locale 4/7, với 3 lỗi baseline đã biết. Fixture/API mock, Edge channel.
- [x] Chạy full Vitest 51 files / 299 tests, typecheck và lint đều PASS; regression được ghi cụ thể bên dưới.

**Acceptance:** AC-11, AC-12; không nhầm smoke với Guided UI E2E.

**Commit dự kiến:** `test(tour): verify provider and public regressions`

### Task 17 — Full gates, diff review và handoff PR

**Phạm vi file:** `docs/plans/guided-tour-core-plan.md`, `docs/tasks/guided-tour-core.md`.

**Checklist:**
- [x] Chạy frontend `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, affected Playwright; ghi kết quả, OS/browser và số test.
- [x] Review đầy đủ `git diff origin/dev...HEAD`, kiểm tra scope và artifact; `git diff --check` không báo lỗi sau khi chuẩn hóa Markdown.
- [x] Ghi commit SHAs vào ledger, review AC và rủi ro; cập nhật tài liệu theo kết quả thật.
- [x] Handoff branch `feat/guided-tour-core` sẵn sàng mở PR vào `dev`; chưa push/mở PR/merge khi chưa có yêu cầu cho nhánh này.

**Acceptance:** AC-12; implementation hoàn tất, branch local sẵn sàng handoff.

**Commit dự kiến:** `docs(tour): record guided tour core handoff`

## 5. Verification checkpoints

| Sau task | Lệnh/check tối thiểu | Lưu ý |
|---|---|---|
| 00 | Baseline typecheck/lint/unit/build + Playwright public | Ghi số thật, không tự coi PASS |
| 01 | `npm run typecheck`; `git diff --check` | Type-only commit vẫn phải compile |
| 02–12 | Focused Vitest mới + `npm run typecheck` + `git diff --check` | Test RED/GREEN nằm cùng commit tính năng |
| 13–15 | `npm run typecheck`, `npm run lint`, smoke `npm run build` | Không thêm UI tour thật |
| 16 | Full `npm run test:unit` + targeted Playwright + typecheck/lint | Browser fixture test-only; API mocked nếu có |
| 17 | Full typecheck/lint/unit/build, affected Playwright, diff review | Điền counts, timeout, warnings chính xác |

**Lệnh tham khảo, chạy từ `front-end/`:**

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx vitest run src/helpers/buildGuidedTourSteps.test.ts src/helpers/guidedTourSelectors.test.ts src/reducers/museumReducer.test.ts
npx playwright test tests/public-locale.spec.ts tests/public-language.spec.ts tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/museum-tour.spec.ts --reporter=line
```

Với browser contract test mới, thêm `tests/guided-tour-core.spec.ts` nếu đã tạo. Không bật `MUSEUM_LIVE_TEST`; không chạy DB/migration/seed. Nếu lệnh test thay đổi do `dev` mới, kiểm tra package scripts và cập nhật ở Task 00.

| Gate | Hiện tại | Evidence khi chạy |
|---|---|---|
| Baseline source/tests | COMPLETE WITH EXISTING FAILURES | 2026-11-08; Windows; Node v22.23.2, npm 10.9.8; branch `feat/guided-tour-core`; base `6e40d35`; API fixtures, Chromium via Microsoft Edge channel. Typecheck PASS; lint PASS; unit PASS 48 files / 276 tests; build PASS (Vite warned about chunks >500 kB). Playwright `npx playwright test tests/public-locale.spec.ts tests/public-language.spec.ts tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/museum-tour.spec.ts --reporter=line`: 47 observed pass, 3 existing `public-locale.spec.ts` failures (invalid saved locale expected `vi`/received `fr`; PublicLayout fixture missing; public route expected `lang=vi`/received `en`); final cross-tab test hung >4 minutes and run was interrupted. No production source changes during baseline. |
| Builder + reducer + selectors unit | PASS | `npm run test:unit`: 51 files / 299 tests passed, gồm builder (3), reducer (17) và selectors (3). |
| React provider browser contract | PASS | `guided-tour-core.spec.ts`: 2/2; route persistence, pause/resume/next/exit, Admin boundary, reload reset, missing-provider error. Test-only fixture, mock translations, validated room fixture. |
| Typecheck/lint/build | PASS | `npm run typecheck`, `npm run lint`, `npm run build` đều exit 0. Build cảnh báo các chunk lớn hơn 500 kB (main 1,078.02 kB; React Three Fiber 820.69 kB; ApexCharts 543.94 kB). |
| Public E2E regression | PASS WITH BASELINE FAILURES | 46/46 qua public-language, collection, exhibit-detail, museum-tour và guided-tour-core; museum-navigation 10/10. `public-locale.spec.ts`: 4/7 pass, 3 fail với cùng kỳ vọng stale đã có ở baseline (locale `fr`, fixture thiếu QueryClient provider, kỳ vọng `lang=vi` sau chọn English); 3 test locale ổn định chạy riêng pass 3/3. Browser Microsoft Edge channel; không dùng DB thật. |
| Diff and scope review | PASS | 14 files: 12 frontend files + 2 plan/task docs. Không đổi backend/API/DB/audio/Three.js; không có build/test artifacts trong diff. |

## 6. Commit ledger (18 commit dự kiến)

| Task | Commit message | SHA thực tế | Verification | Status |
|---|---|---|---|---|
| 00 | `docs(tour): plan guided tour core checkpoints` | `1bf4a84` | Baseline; typecheck/lint/unit/build | DONE |
| 01 | `feat(tour): define guided tour session types` | `d5a7f00` | Typecheck | DONE |
| 02 | `feat(tour): build ordered public tour steps` | `3659feb` | Builder 3 tests + typecheck | DONE |
| 03 | `feat(tour): start guided tour sessions` | `1be0de2` | Reducer tests + typecheck | DONE |
| 04 | `feat(tour): handle pause and resume transitions` | `acb1312` | Reducer tests + typecheck | DONE |
| 05 | `feat(tour): reset and restart guided sessions` | `dd09ba9` | Reducer tests + typecheck | DONE |
| 06 | `feat(tour): advance steps and complete tours` | `dc8c4a1` | Reducer tests + typecheck | DONE |
| 07 | `feat(tour): navigate to previous tour steps` | `dba52a9` | Reducer tests + typecheck | DONE |
| 08 | `feat(tour): jump to published exhibit steps` | `9a2da40` | Reducer tests + typecheck | DONE |
| 09 | `feat(tour): derive guided tour progress selectors` | `4f3a227` | Selector tests + typecheck/lint | DONE |
| 10 | `feat(tour): preserve current step across reorders` | `606793c` | Reducer tests + typecheck | DONE |
| 11 | `feat(tour): reconcile removed exhibit steps` | `165fb7c` | Reducer tests + typecheck | DONE |
| 12 | `feat(tour): guard room invalidation events` | `3c8f084` | Reducer tests + typecheck | DONE |
| 13 | `feat(tour): provide shared museum tour context` | `f9af07b` | Lint/build | DONE |
| 14 | `feat(tour): expose guided tour consumer hook` | `f20ba63` | Typecheck/lint | DONE |
| 15 | `feat(tour): scope tour session to public layout` | `5ef0c1b` | Typecheck/lint/build | DONE |
| 16 | `test(tour): verify provider and public regressions` | `bfe16dd` | Unit 299; browser regressions | DONE |
| 17 | `docs(tour): record guided tour core handoff` | `this commit` | Full gate evidence and diff review | DONE |

## 7. Definition of Done

- [x] 18 task hoàn tất theo ranh giới riêng; 18 commit có ý nghĩa.
- [x] Steps được xây từ public validated `RoomDetail`, đúng `(displayOrder, id)`; không giữ nội dung hiện vật trong state.
- [x] Reducer typed, mọi valid/invalid transition có test, các command ở biên không wrap và no-op giữ nguyên state.
- [x] Reorder/removal/invalidate/response khác room giữ hoặc xóa đúng phiên; lỗi mạng không tự invalidate.
- [x] Provider/hook public-only, giữ state khi chuyển route trong PublicLayout, Admin ở ngoài Provider.
- [x] Không đưa control bar, auto-tour, timer, audio changes, teleport, URL selection sync (thuộc F06–F08/F04).
- [x] Browser+unit+typecheck+lint+build có kết quả thực tế; ngoại lệ baseline được ghi riêng.
- [x] Review diff hoàn tất; branch local sẵn sàng mở PR vào `dev` khi được yêu cầu.

**Handoff:** F06 kết nối UI 2D với `useGuidedTour()` và `reconcileRoom()` khi dữ liệu phòng đã xác nhận mới; F07 dùng cùng hook ở overlay/scene 3D; F08 làm adapter URL/selection/2D↔3D, bảo đảm không đồng thời có hai chủ tour state. Không tự phát audio/camera trong F05.
