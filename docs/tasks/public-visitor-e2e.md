# PUBLIC-E2E — Task Breakdown & Acceptance: Visitor Journey 2D / Audio / Transcript / Report

> **Trạng thái:** **DONE** — người dùng duyệt ngày 28/10/2026; triển khai trên `test/public-visitor-e2e`, base `702aeb7`.
> **Nghiệm thu bổ sung (28/10/2026):** Người dùng xác nhận đã test DB thật và mọi thứ OK (**USER-REPORTED PASS**); đã yêu cầu chốt và push nhánh, chưa tạo PR. Các số liệu automated bên dưới vẫn là kết quả API mock do Codex chạy.
>
> **Repo/base đã audit:** `ailabs26/ailabs-museum`, `dev` tại `702aeb75d20ceae7c1cd5ef4e909c4eae77e2d19` (28/10/2026). **Khi implement: fetch mới, ghi SHA base thực tế.**
>
> **Đề xuất branch:** `test/public-visitor-e2e` → `dev`. Kế hoạch: [`../plans/public-visitor-e2e-plan.md`](../plans/public-visitor-e2e-plan.md).

**User task:** “Viết E2E test bằng Playwright cho luồng 2D, nghe audio, xem transcript và gửi báo cáo nội dung; bàn giao bộ test script E2E.”

**Thực trạng:** Browser tests riêng cho 2D, audio/captions/transcript và report **đã tồn tại**. Task mới **không làm lại** chúng; tập trung 1 browser journey liền mạch, regression đủ và báo cáo bàn giao.

**Không thuộc task:** Audit WCAG 2.2 AA bằng NVDA/VoiceOver đã được người dùng tạm hoãn. Không sửa runtime/backend/DB, không thay báo cáo CMS E2E, không bật live POST tạo report.

---

## 0. Checklist tổng quát

| Mã | Task | Deliverable | Trạng thái |
|---|---|---|---|
| T0 | Baseline/branch/source audit | Commit SHA, baseline logs, test coverage map | DONE |
| T1 | Journey test — collection → detail | Phần đầu `public-visitor-journey.spec.ts` | DONE |
| T2 | Journey test — audio → VTT → transcript | Assertions media thật/DOM và no autoplay | DONE |
| T3 | Journey test — report submit | Mocked POST + payload revision + success UX | DONE |
| T4 | Focused/affected regression + gates | Test counts, failures phân loại, diff review | DONE |
| T5 | E2E report / script handoff | `public-visitor-e2e-report.md` + PR-ready summary | DONE |

**Quy tắc chung:** Chỉ đánh `[x]` khi có lệnh thực tế và bằng chứng. Kết quả thực tế: affected dev 69/69, preview 15/15, unit 170/170 PASS; xem báo cáo bàn giao. Không chỉnh runtime để che test drift; không bắt người dùng test lại mọi tính năng đã xác nhận trước.

---

## T0 — Baseline, nhánh và kiểm tra hiện trạng

**Mục tiêu:** Chốt đúng baseline trước khi viết test, không dùng dữ liệu/stats cũ làm kết quả mới.

**File đọc/đối chiếu:** root `AGENTS.md`, `front-end/playwright.config.ts`, `package.json`, `src/pages/client/{CollectionPage,ExhibitDetailPage}.tsx`, `shared/components/{data/ExhibitGrid,feedback/PublicReportModal,media/AudioPlayer}.tsx`, `services/reports.service.ts`, `tests/fixtures/{publicMediaApi,publicRoomWithMedia,museumApi}.ts`, các specs hiện có.

### Steps

- [x] `git fetch origin`; xác nhận `origin/dev` HEAD mới và working tree; ghi SHA + thời gian ở execution ledger.
- [x] Tạo nhánh **một nhiệm vụ** `test/public-visitor-e2e` từ `origin/dev` cập nhật. Không push/PR khi chưa được người dùng yêu cầu.
- [x] Rà lại routes `GET /api/rooms`, `GET /api/rooms/:slug`, `POST /api/public/reports`, `**/media/uploads/**` cùng fixture, xác minh chính xác action selectors.
- [x] Chạy baseline trước khi sửa: ít nhất `collection.spec.ts`, `exhibit-detail.spec.ts`, `public-audio.spec.ts`, `public-report-modal.spec.ts`; ghi counts/exit/môi trường, không tự tuyên bố PASS.
- [x] Xác minh browser runner: Chromium/Edge version, OS, Vite dev/preview, env `MUSEUM_LIVE_TEST` unset và trạng thái dependencies.
- [x] Ghi coverage hiện có: collection, detail, audio/captions/transcript, report, error/429, live media optional; highlight **thiếu journey trong cùng browser session**.
- [x] Review PLAN/TASK với người dùng trước khi viết test/code nếu triển khai trên repo.

### Acceptance

- [x] Base SHA, exact command và baseline outcome được ghi; mọi lỗi đã có trước được tách khỏi lỗi mới.
- [x] Không đổi code ngoài scope và không ghi DB.

**Commit đề xuất (nếu đã được duyệt để thao tác repo):** `docs(test): plan public visitor e2e journey`.

---

## T1 — Viết hành trình 2D Collection → Exhibit Detail

**Mục tiêu:** Test phải xuất phát từ Collection bằng thao tác thật; không chỉ `page.goto` trực tiếp sang Detail.

**File:** `front-end/tests/public-visitor-journey.spec.ts` (**ADD**), tái sử dụng `fixtures/publicMediaApi.ts`.

### Steps

- [x] Import `test`, `expect` từ `@playwright/test`, `installMedia` và `fulfillMuseum` đã có; không tạo media fixture mới trùng lặp.
- [x] Tạo một primary `test('visitor follows 2D detail, audio, transcript and reports content', async ({ page }) => {...})` (tên có thể rút gọn, giữ intent).
- [x] `const room = await installMedia(page)`; dùng `const exhibit = room.exhibits[0]`; guard dữ liệu fixture nếu cần, không hardcode URL room/exhibit.
- [x] Gắn `page.route('**/api/public/reports', ...)` **trước** `page.goto`, chặn POST ra ngoài và thu payload/call count; 201 response phải theo ApiResponse envelope như test hiện có.
- [x] `page.goto('/collection')`; kiểm H1 `Bộ sưu tập`, room/card đúng và danh sách đã render.
- [x] Scope card theo `getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })`, tìm heading `exhibit.name` hoặc `getByRole('link', {name: ...})`; tránh `.first()` khi có nhiều card.
- [x] Dùng hành vi người dùng `click()` hoặc `focus()` + `press('Enter')` trên link `Xem chi tiết ${exhibit.name}`; không dùng `page.goto('/collection/...')` cho bước chuyển trang.
- [x] `await expect(page).toHaveURL(...)` với `encodeURIComponent(room.slug/exhibit.id)`; kiểm H1, mô tả, link quay lại room.
- [x] Đảm bảo phần public 2D không mount Tour 3D; nếu kiểm Canvas, dùng scope/dự đoán hợp lệ, tránh sai lệch vì Hero 3D ở `/`.

### Acceptance

- [x] **AC-01/02:** Collection → Detail chạy trong **một page**, route + identity đúng, không sử dụng demo fallback hoặc fake click.
- [x] Không request admin API/room khác không liên quan; nếu đếm network, không dựa vào thứ tự ngẫu nhiên.

**Commit đề xuất sau khi có test đã kiểm:** `test(public): cover 2d visitor navigation` (có thể gộp T1–T3 thành một commit vì cùng một spec).

---

## T2 — Kiểm audio thật, WebVTT và transcript

**Mục tiêu:** Xác minh người dùng nghe được media và đọc transcript, **không** chỉ có component.

**Code đã có:** `AudioPlayer` nằm trong `ExhibitDetailPage.tsx`; `installMedia` mock WAV hợp lệ và VTT một cue `Thuyết minh đồng bộ`.

### Steps

- [x] Trong cùng visitor test sau T1, scope vùng `Thuyết minh audio`; audio element ban đầu `paused = true` / chưa playback, không autoplay.
- [x] Có thể ghi `request.url()` cho `/media/uploads/audio/` và xác minh không fetch trước tương tác, nếu deterministic với fixture hiện tại.
- [x] Click nút `Phát` theo accessible name. Kiểm `expect.poll(() => page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0)`; không mock `play()`/tự set `currentTime`.
- [x] Kiểm cue hiển thị `page.getByLabel('Phụ đề hiện tại')` có text `Thuyết minh đồng bộ`; dùng polling nếu browser cần thời gian.
- [x] Kiểm section `Bản thuyết minh`/region theo heading, nội dung từ `exhibit.audio?.vi?.transcript` (hoặc `exhibit.i18n.vi.transcript` theo source fallback), không nhầm với caption.
- [x] Pause qua nút `Tạm dừng` trước khi mở report nếu test cần ổn định; không assert report làm audio dừng khi spec không yêu cầu.
- [x] Không copy toàn bộ trường hợp Stop/replay/404/VTT404/locale từ `public-audio.spec.ts` — chỉ chạy regression các case ấy ở T4.

### Acceptance

- [x] **AC-03:** HTMLMediaElement thật tăng `currentTime`, audio không autoplay.
- [x] **AC-04:** Cue được render đúng từ VTT, transcript đọc được độc lập trong section 2D.
- [x] Không có `waitForTimeout()` để chờ playback; không yêu cầu sound output/loa vật lý trong automated test.

**Commit đề xuất:** cùng commit journey hoặc `test(public): verify journey audio and transcript`.

---

## T3 — Submit report từ trang Detail và kiểm đúng revision

**Mục tiêu:** Chứng minh người dùng từ chính trang Detail có thể báo cáo hiện vật/revision đang xem trong cùng hành trình.

**Files tái dùng:** `PublicReportModal.tsx`, `reports.service.ts`, `tests/public-report-modal.spec.ts` (đã kiểm riêng category, validation và lỗi 429).

### Steps

- [x] Tại trang Detail hiện tại, click `Báo nội dung`, kiểm `getByRole('dialog', { name: 'Báo cáo nội dung' })` visible; mọi locator input/button scope trong dialog.
- [x] Chọn `Danh mục` → `wrong_info`, điền `Nội dung bổ sung` → `'  Sai niên đại  '`.
- [x] Submit `Gửi báo cáo`; route handler ghi phương thức POST, request JSON và số lần gọi, trả HTTP **201** với envelope thành công/ID giả hợp lệ.
- [x] Assert đúng **một** POST, payload *deep equal*: `{ exhibitId: exhibit.id, reportedRevisionId: exhibit.revisionId, category: 'wrong_info', message: 'Sai niên đại' }`.
- [x] Check modal đóng và notification `Đã gửi báo cáo nội dung` xuất hiện; URL/H1 Detail vẫn đúng.
- [x] Đảm bảo request report **không escape** mock ra real server. Không bật `MUSEUM_LIVE_TEST` hoặc dùng test account/DB thật để chạy happy path.
- [x] Không viết lặp validation empty và 429 trong primary journey vì đã có `public-report-modal.spec.ts`; nếu run phát hiện bug mới, ghi separate repro và xin scope nếu phải sửa runtime.

### Acceptance

- [x] **AC-05/06/07/08:** Complete submit flow có request thật từ browser tới mocked endpoint, đúng revision, UI thành công và không ghi DB.
- [x] Không giả `POST` bằng direct HTTP client trong test thay cho thao tác người dùng.

**Commit đề xuất:** `test(public): add visitor journey report submission` (khuyến nghị một commit cuối cho toàn spec).

---

## T4 — Test regression, quality gates và triage

**Mục tiêu:** Có bằng chứng green trên đúng diff, tránh tạo một spec mới nhưng làm hỏng các màn cũ.

### Run matrix

| Test group | Lệnh từ `front-end/` | Bắt buộc? | Status |
|---|---|---|---|
| Focused journey dev + D06 | `npx playwright test tests/public-visitor-journey.spec.ts tests/exhibit-detail.spec.ts --grep 'visitor follows\|D06' --reporter=line` | YES | 4/4 PASS |
| Collection | `npx playwright test tests/collection.spec.ts --reporter=line` | YES | PASS |
| Detail | `npx playwright test tests/exhibit-detail.spec.ts --reporter=line` | YES | PASS |
| Public audio | `npx playwright test tests/public-audio.spec.ts --reporter=line` | YES | PASS |
| Report modal | `npx playwright test tests/public-report-modal.spec.ts --reporter=line` | YES | PASS |
| Audio standalone | `npx playwright test tests/audio-player.spec.ts --reporter=line` | YES | PASS |
| Keyboard subset | `npx playwright test tests/accessibility-keyboard.spec.ts --reporter=line` | YES | PASS |
| Production preview focused | `PLAYWRIGHT_PREVIEW=1 npx playwright test tests/public-visitor-journey.spec.ts tests/public-audio.spec.ts tests/public-report-modal.spec.ts --reporter=line` (Unix; Windows xem PLAN) | YES | PASS |
| Typecheck | `npm run typecheck` | YES | PASS |
| Lint | `npm run lint` | YES | PASS |
| Unit | `npm run test:unit` | YES | PASS |
| Production build | `npm run build` (trước preview) | YES | PASS |
| Targeted ESLint | `npx eslint tests/public-visitor-journey.spec.ts` | YES | PASS |
| Diff | `git diff --check` | YES | PASS |
| Optional live media | `MUSEUM_LIVE_TEST=1 ... public-image-audio-live.spec.ts` read-only | OPTIONAL; không ghi DB | NOT TESTED |

### Steps

- [x] Chạy focused test sau khi T1–T3 hoàn tất; lưu counts, exit, trace lỗi nếu có, sửa chỉ test implementation drift hợp lệ.
- [x] Chạy các affected suites và ghi rõ **per-suite PASS/FAIL/SKIP**; có thể batch thay vì từng lệnh nhưng báo cáo phải phân tách số liệu đúng.
- [x] Chạy typecheck/lint/unit/build từ đúng frontend checkout. Nếu warning nền có sẵn, phân biệt errors và warnings, không ghi lint clean tuyệt đối nếu có warning.
- [x] Chạy production preview **sau build mới**, kiểm `MUSEUM_LIVE_TEST` không bật, ghi chính xác browser channel/OS/port.
- [x] Nếu timeout media, dùng trace/request timeline/response headers, kiểm đối chiếu fixture WAV/VTT rồi rerun focused; không tăng timeout vô hạn hoặc `sleep` để che lỗi.
- [x] Nếu `home-featured.spec.ts` fail vì Hero 3D canvas mới, ghi known external test drift; không kéo homepage refactor vào PR. Nếu hồi quy thực tế ảnh hưởng journey, tạo issue đề nghị xử lý riêng.
- [x] Rà source diff có đúng test/docs; không commit `dist/`, `.env`, output media, `test-results/`, API key/credential.
- [x] `git diff --check`, review diff lần cuối, lưu thống kê `git status`/`git log` và chỉ commit đã được duyệt.

### Acceptance

- [x] **AC-09/10/12:** Focused + affected suites và gates xanh hoặc có failure/blocker ghi đúng, được review; không có thay đổi production không được duyệt.
- [x] Không có số liệu test “ước lượng”, không dùng baseline historical làm kết quả run mới.

**Commit đề xuất:** `test(public): verify visitor journey regressions` (chỉ nếu thực sự có test/evidence thay đổi).

---

## T5 — Báo cáo kết quả, đóng gói scripts và bàn giao

**Mục tiêu:** Người nhận có thể checkout đúng commit và tự tái chạy, hiểu mock/live và kết quả nghiệm thu.

**File mới:** `docs/plans/reports/public-visitor-e2e-report.md` (**chỉ tạo/điền sau khi có execution evidence**).

### Cấu trúc bắt buộc của report

1. **Header:** task ID, repo, branch/base SHA, HEAD commit được test, ngày, người thực hiện; không đưa thông tin cá nhân không cần thiết.
2. **Environment:** OS, browser/Playwright version, Node/npm, Vite dev/preview, base URL, flags (`PLAYWRIGHT_PREVIEW`, `MUSEUM_LIVE_TEST`), fixture/real API.
3. **Test matrix:** E2E-01→08 và AC-01→12; expected, actual, result `PASS`/`FAIL`/`SKIP`/`NOT TESTED`, evidence file/log.
4. **Run ledger:** command chính xác, started/finished date, total PASS/FAIL/SKIP, exit code, trace path nếu lỗi. Tách focused/affected/quality gates.
5. **Fixture description:** `installMedia`, WAV/VTT, rooms/auth GET, report POST mocked; API/backend DB không bị ghi.
6. **Coverage mapping:** link đến `collection`, `exhibit-detail`, `public-audio`, `audio-player`, `public-report-modal`, `public-image-audio-live` (optional) và spec mới.
7. **Risk/limitation:** UI mock khác DB E2E; media live đọc được nhưng không chứng minh live submission; không có NVDA/VoiceOver trong task này; known WebGL/Home hero test drift nếu quan sát được.
8. **Handoff:** lệnh tái chạy, dependencies, quyết định về blocker và next steps; PR link nếu đã thực sự mở (không invent).

### Steps

- [x] Tạo `docs/plans/reports/public-visitor-e2e-report.md` sau khi có logs, điền đầy đủ theo structure trên.
- [x] Nêu rằng Browser/UI E2E với API mock là kiểm thử giao diện thật; không tuyên bố kiểm thử DB end-to-end.
- [x] Link nguồn test scripts tương ứng và bổ sung lệnh cài/chạy trong báo cáo, không cần ZIP source repo (PR đã chứa scripts).
- [x] Ghi rõ lịch sử test người dùng đã thực hiện trước đây là **historical evidence**, không yêu cầu lặp lại manual UI test chung nếu không phát hiện lỗi mới.
- [x] Có verdict có điều kiện: `DONE` nếu tất cả bắt buộc đã PASS, `PARTIAL` nếu lỗi ngoài scope đã được chấp nhận, `BLOCKED` nếu không thể chứng minh AC chính.
- [x] Review report và PLAN/TASK so với diff/commits, không có chữ “chưa làm” sai sau khi task thực thi.
- [x] Bàn giao branch, commit, tài liệu, counts và đề xuất PR vào `dev`; **không tự push/PR/merge** khi người dùng chưa yêu cầu.

### Acceptance

- [x] **AC-11:** report đầy đủ; người review có thể tự rerun; số liệu có execution evidence.
- [x] Handoff nêu đúng giới hạn, không tự gọi PASS cho task WCAG/NVDA bị hoãn hoặc live-DB report chưa làm.

**Commit đề xuất:** `docs(test): hand off public visitor e2e evidence`.

---

## 6. Execution ledger — 28/10/2026

Báo cáo đầy đủ: [public-visitor-e2e-report.md](../plans/reports/public-visitor-e2e-report.md).

| Step | Kết quả thực tế | Exit | Evidence |
|---|---|---:|---|
| Fetch/base/branch | origin/dev `702aeb7`, branch `test/public-visitor-e2e` | 0 | git log/status |
| Baseline dev | 41 PASS / 1 FAIL (D06 false positive), 0 SKIP | 1 | baseline.json |
| Focused journey + D06 | 4/4 PASS (23.7s) | 0 | focused-dev.log |
| Affected dev (7 suites) | 69/69 PASS (6.2m), 0 SKIP/flaky | 0 | affected-dev.json |
| Preview (journey/audio/report) | 15/15 PASS (36.0s), 0 SKIP/flaky | 0 | preview.json |
| Typecheck/lint/unit/build | PASS; lint 0 errors/1 warning; unit 31 files/170 tests; build chunk warning | 0 | gate logs in report |
| Targeted ESLint/diff/review | PASS; independent reviewer: no actionable finding | 0 | targeted-lint.log, git diff --check |
| Optional live / screen readers | NOT TESTED, outside approved scope | See report | Limitations in report |
| Người dùng kiểm thử DB thật (nghiệm thu bổ sung) | USER-REPORTED PASS — người dùng xác nhận mọi thứ OK | — | Xác nhận trực tiếp ngày 28/10/2026; không phải automated live run của Codex |

Initial expanded preview run was aborted because component HTML fixtures are dev-only; replaced by the approved dev/preview matrix, not counted as passing evidence. D06 media-request filter was corrected after a real baseline repro; production runtime unchanged.

### Final QA matrix

| Acceptance | Status | Evidence |
|---|---|---|
| AC-01/02 — Collection→Detail | PASS | Journey dev + preview |
| AC-03/04 — Audio / WebVTT / transcript | PASS | Real WAV playback + scoped DOM assertions |
| AC-05/06/07 — Report / revision / UX | PASS | Captured POST deep equality + 201 mocked + UX |
| AC-08 — No live writes | PASS | Interceptors before navigation; live env unset |
| AC-09/10 — Regression & quality gates | PASS | 69/69 dev, 15/15 preview, gates exit 0 |
| AC-11 — Report handoff | PASS | Linked report, environment/commands/counts |
| AC-12 — Scope/diff | PASS | Only tests/docs, fresh review |

## 7. Known risks và quyết định phạm vi

- Test chính đi từ `/collection`, **không** lấy thẳng URL Detail; dùng fixture slug `room.slug` không assume `sculpture`.
- Tách caption (cue `Thuyết minh đồng bộ`) khỏi transcript (`Thuyết minh`) bằng scoped locators.
- Report payload có `reportedRevisionId` do API trả; phải assert chính xác, không thay bằng `revisionId` lấy từ record Admin/latest.
- Không gọi live POST khi chạy để tránh tạo record công khai; endpoint POST được mock trên browser trước khi truy cập trang.
- `public-image-audio-live.spec.ts` là read-only, opt-in và có thể SKIP nếu backend/content thiếu; SKIP không phải PASS.
- Tối thiểu một browser test xuyên suốt có giá trị hơn hàng loạt bản sao của specs đang xanh. Không tự tạo nhiều test trùng lặp để tăng counts.
- Không lấy task accessibility audit (NVDA/VoiceOver) trở lại trừ khi người dùng chủ động yêu cầu báo cáo công việc hoặc thực hiện task đó.
- `home-featured.spec.ts` có assertion `canvas=0` trong khi Homepage hiện mount Hero 3D khi WebGL hoạt động. Nếu run rộng gặp fail, phân loại độc lập ngoài scope.
- Theo `AGENTS.md`, một task một nhánh/PR, base từ `origin/dev`, PR vào `dev`, không sửa DB/migration, không tự merge.

**Definition of Done:** journey spec + report đã được tạo và thực thi; AC-01→12 có bằng chứng; kết quả test trung thực; regression không suy giảm; không có DB write thật; artifacts và commit/PR status được bàn giao rõ ràng.
