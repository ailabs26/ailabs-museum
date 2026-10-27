# Public Collection Loading Accessibility — Task Breakdown & Acceptance

> **Trạng thái:** Đã duyệt — đang triển khai; evidence được cập nhật theo từng task.\
> **PLAN:** [public-a11y-loading-plan.md](../plans/public-a11y-loading-plan.md)\
> **Repository:** `ailabs26/ailabs-museum` — baseline `dev` SHA `fcb2b4d247f73c59c1cde5d01046f29d80aaf075` (27/10/2026); triển khai từ `origin/dev` mới nhất.\
> **Branch:** `fix/public-a11y-loading`; PR dự kiến tới `dev` (không tự tạo/merge).

## 1. User story, bug và kết quả mong muốn

**User story:** Là khách tham quan sử dụng screen reader, khi truy cập trang `/collection` hoặc đổi phòng trưng bày, tôi cần biết danh sách phòng/hiện vật đang tải để không hiểu nhầm trang đang trống hoặc bị lỗi; sau khi tải xong, tôi vẫn tiếp cận được kết quả, lỗi và các nút điều hướng bình thường.

**Vấn đề hiện tại:** `CollectionPage.tsx` hiển thị `<ExhibitSkeleton />` cho `rooms.isPending` hoặc `room.isPending`; skeleton ẩn khỏi accessibility tree bằng `aria-hidden="true"` và **chưa có một thông báo loading có thể tiếp cận riêng**. PR #99 đã ghi nhận gap này và hoãn sang task a11y chuyên biệt.

**Outcome:** Thêm **một live region persistent** với `role="status"`, lời nhắn phù hợp theo trạng thái tải, ẩn trực quan nhưng vẫn đọc được bởi assistive technology; giữ nguyên skeleton, business logic và accessibility behavior khác.

**Tiêu chí tham chiếu:** WCAG 2.2 **4.1.3 Status Messages (AA)** trong phạm vi Collection loading. Đạt các acceptance của task này **không tương đương** chứng nhận WCAG 2.2 AA toàn website.

## 2. Functional requirements

| ID | Yêu cầu | Kỳ vọng |
|---|---|---|
| FR-01 | Loading danh sách phòng lần đầu | Status thông báo `Đang tải danh sách phòng trưng bày…` trong khi skeleton hiện. |
| FR-02 | Loading hiện vật phòng đang chọn | Status thông báo `Đang tải hiện vật của phòng <tên phòng>…`, phản ánh đúng phòng hiện hành. |
| FR-03 | Một status live region | Dùng **một node persistent** khi vào/trong/sau loading; `role=status`, `aria-live=polite`, `aria-atomic=true`; có accessible name riêng `Trạng thái tải bộ sưu tập`. |
| FR-04 | Không thay đổi skeleton | `<ExhibitSkeleton>` giữ nguyên thiết kế, `aria-hidden=true`, số lượng placeholder, transition. |
| FR-05 | Khi tải thành công | Content của loading status được clear; có đúng heading/count/cards cho phòng hiện tại. |
| FR-06 | API list/detail lỗi hoặc schema invalid | Loading status không nói sai rằng vẫn đang tải; giữ `role=alert`, retry và không hiển thị stale data. |
| FR-07 | Room list trống, phòng không hợp lệ, collection rỗng | Loading status clear; giữ empty/invalid messages và role hiện có; không fetch unknown room. |
| FR-08 | Đổi phòng khi API đang pending | Status đúng phòng mới, không đọc phòng cũ; cards cũ không xuất hiện, pressed pill/URL đúng. |
| FR-09 | Background refetch với dữ liệu đã có | Không thêm thông báo loading trùng với `Đang cập nhật hiện vật…` đang có; không cướp focus. |
| FR-10 | Tương thích tests cũ | Chỉnh chính xác các assertion `getByRole('status')` không có scope để tránh Playwright strict-mode khi live region persistent xuất hiện; không bỏ case. |

## 3. Non-functional requirements / constraints

- **Frontend-only**, hạn chế thay code ở `CollectionPage.tsx`, và `.module.css` khi cần class visually hidden. Không sửa backend/API/DB, auth, CMS, 3D, audio, public reports hoặc các shared components không cần thiết.
- Không thêm dependency, global live-region manager, observer/timer, thêm autofocus, `aria-busy` đơn độc hoặc aria alert cho hoạt động loading bình thường.
- **Visually hidden ≠ inaccessible:** Không `display:none`, `visibility:hidden`, `hidden` hoặc `aria-hidden` lên status; không đưa node đó vào skeleton đang `aria-hidden`.
- Không thêm `role="status"` cho từng skeleton card hoặc một message trùng khác.
- `room.isPending` chỉ là loading có ý nghĩa khi `selectedRoom` đã được xác nhận; query detail disabled không được phát thông báo chờ vô hạn.
- Với `rooms.isFetching`/`room.isFetching` và dữ liệu cũ đã được giữ, dùng status cập nhật hiện có, không tạo thêm thông báo ban đầu.
- Playwright DOM test chứng minh semantics/transition, **không thay thế QA screen reader thủ công** nếu muốn khẳng định thông báo được nói ra trên thiết bị cụ thể.

## 4. Acceptance scenarios

| AC | Given / When | Then | Test đề xuất |
|---|---|---|---|
| AC-01 | `/collection`, `/api/rooms` bị gate pending | Skeleton hiện; **một** named status chứa `Đang tải danh sách phòng trưng bày…`; status không bị ẩn khỏi a11y tree | `collection.spec.ts` loading gate |
| AC-02 | Release list, gate `/api/rooms/sculpture` | Cùng status chuyển sang `Đang tải hiện vật của phòng <roomA.name>…`; skeleton vẫn hiện | Loading transition |
| AC-03 | Release detail API | Named status vẫn còn, content rỗng; 5 cards xuất hiện đúng thứ tự, skeleton biến mất | Loading success |
| AC-04 | Đổi từ `sculpture` sang `ceramics` lúc response B chậm | Đọc tên B, B pill pressed, không render cards phòng A; sau release B hiện nội dung B | Room switch delayed |
| AC-05 | `/api/rooms` hoặc detail trả 503/invalid schema | Không còn text đang tải; `role=alert` và `Thử lại` hoạt động | Error/retry |
| AC-06 | `rooms=[]`, room không có hiện vật, URL unknown | Giữ empty/invalid status riêng; không duplicate/đọc loading sai | Empty/invalid |
| AC-07 | Làm mới dữ liệu khi đã có detail | Không có hai thông báo trùng; giữ `Đang cập nhật hiện vật…` hiện tại | Refetch |
| AC-08 | Tab chọn room, Enter/Space và search | Focus không nhảy vào status; keyboard, pressed pills, URL và search giữ nguyên | Keyboard regression |
| AC-09 | Test cũ có `getByRole('status')` đơn lẻ | Các assert empty/no-results vẫn strict-safe, không bị xóa | Existing collection tests |
| AC-10 | Cập nhật code xong | Typecheck, lint, unit, build, focused/affected Playwright đạt hoặc thất bại được ghi minh bạch | QA gates |

## 5. File map và trách nhiệm

| File | Hành động | Tiêu chí review |
|---|---|---|
| `front-end/src/pages/client/CollectionPage.tsx` | **Sửa** | Persistent live region; điều kiện list/detail pending; không tạo focus side effect. |
| `front-end/src/pages/client/CollectionPage.module.css` | **Chỉ nếu cần** | `.srOnly` đúng visually-hidden kỹ thuật, không ảnh hưởng reflow/mobile. |
| `front-end/tests/collection.spec.ts` | **Sửa/bổ sung** | RED→GREEN; gated APIs; locators status unique; giữ tests hiện có. |
| `front-end/tests/accessibility-keyboard.spec.ts` | **Chạy regression** | Không mất focus, Tab/skip link/keyboard. |
| `front-end/tests/exhibit-detail.spec.ts`, `tour-2d-fallback.spec.ts`, `public-report-modal.spec.ts` | **Chạy regression** | Giữ đường đi public từ 2D/tour/report. |
| `docs/plans/accessibility-checklist.md` | **Chỉnh rất nhỏ sau nghiệm thu** | Ghi 4.1.3 Collection/loading và bằng chứng, không đổi tất cả WCAG thành PASS. |
| `docs/tasks/public-a11y-loading.md` | **Cập nhật execution** | Điền lệnh, kết quả thực và commit hashes. |

**Không sửa `ExhibitSkeleton.tsx` chỉ để bỏ `aria-hidden`: đó là một lớp trình bày đúng vai trò decorative.**

## 6. Task execution checklist (TDD)

### Task 0 — Baseline & branch

**Mục tiêu:** Xác nhận đầu vào hiện tại và ghi rõ điều gì là bug sản phẩm, điều gì chỉ là test.

- [x] Fetch `origin/dev`: `fcb2b4d247f73c59c1cde5d01046f29d80aaf075`; không có thay đổi tracked, chỉ hai tài liệu plan/task do người dùng cung cấp.
- [x] Tạo nhánh `fix/public-a11y-loading` từ `origin/dev`.
- [x] Đọc `docs/architecture/fe/coding-conventions.md`, `CollectionPage`, `ExhibitSkeleton`, `useMuseumRooms`, `collection.spec.ts`.
- [x] Baseline: `npx.cmd playwright test tests/collection.spec.ts -g 'loading states|switching rooms|errors|empty public' --reporter=line` — **5 passed (37.4s), exit 0**.
- [x] Source và DOM Chromium/Edge xác nhận: skeleton có `aria-hidden=true`, số named loading status bằng **0** trong lúc list API bị gate; snapshot lưu ở workspace tạm của task.
- [x] Commit tài liệu đầu; acceptance cho phần sửa vẫn chờ RED/GREEN và regression.

**Commit đề xuất:** `docs(a11y): plan accessible collection loading`

### Task 1 — Viết tests RED cho loading semantics

**Mục tiêu:** Test thất bại vì thiếu live region trước khi sửa production.

- [x] Dùng fixture có sẵn và Promise gate cho list/detail/room switch.
- [x] Test list pending kiểm skeleton, named status duy nhất, polite/atomic và không nằm trong ancestor ẩn.
- [x] Test transition list → room pending → success kiểm identity của cùng DOM node, status rỗng và 5 cards.
- [x] Test room switch kiểm status tên phòng B, không stale cards và focus giữ trên pill.
- [x] Ba assertion empty/no-match được scope theo text; vẫn giữ các trạng thái lỗi/retry cũ.
- [x] RED: `npx.cmd playwright test tests/collection.spec.ts -g 'loading states|switching rooms' --reporter=line` — **2 failed, exit 1**; cả hai `toHaveCount(1)` nhận **0** do chưa có named status. Log và trace cục bộ, không commit artifacts.

**Commit đề xuất:** `test(a11y): reproduce missing collection loading status`

### Task 2 — Sửa Collection loading a11y

**Mục tiêu:** Phát thông báo đầy đủ mà không thay giao diện.

- [x] Thêm một region persistent có `role=status`, `aria-live=polite`, `aria-atomic=true`, `aria-label=Trạng thái tải bộ sưu tập`.
- [x] Region rỗng khi mount; text update bằng effect sau mount/transition.
- [x] Ưu tiên `rooms.isPending`; chỉ xét detail pending với `selectedRoom` hợp lệ.
- [x] Trả region về rỗng khi hết pending; giữ lỗi/empty state hiện có.
- [x] Dùng Mantine `VisuallyHidden` có sẵn; đã kiểm source CSS clip/1px/absolute, không cần sửa CSS.
- [x] Giữ skeleton, route, pills, search, report và Canvas behavior.
- [x] Focused GREEN **2 passed (17.1s), exit 0**; typecheck và ESLint file thay đổi được kiểm trước commit.

**Commit đề xuất:** `fix(a11y): announce collection loading state`

### Task 3 — Regression, accessibility review

**Mục tiêu:** Xác nhận không phát lời đọc trùng/lỗi và không làm hỏng UI đã nghiệm thu.

- [x] Test list/detail HTTP/schema error và retry: status được clear, alert và retry vẫn đúng.
- [x] Test `rooms=[]`, room empty, invalid room, no-match search; status cũ được scope theo text.
- [x] Gate cả list/detail refetch; MutationObserver xác nhận live region không đổi text trong refetch/search; update status cũ chỉ có một.
- [x] Room switching, reload, Back/Forward, Tab/Enter/Space và focus PASS.
- [x] Chạy đủ 5 suite: **50 passed / 1 failed (4.0m), exit 1** trên production preview; Collection **14/14 PASS**, các suite còn lại **36/37**. Lỗi F04 tái hiện trên base `dev` như phần evidence bên dưới.
- [x] Existing responsive regression bao phủ 320–1440px, light/dark, không overflow; named status 1×1px và không bị ẩn khỏi a11y tree; không sửa CSS.
- [x] Manual listening: **NOT TESTED**, không đánh đồng DOM PASS với phát âm trên NVDA/VoiceOver.

**Commit đề xuất:** `test(a11y): cover collection loading lifecycle`

### Task 4 — Verification & handoff

**Mục tiêu:** Bàn giao có evidence, không để open checkbox chưa kiểm chứng mà đánh xong.

- [ ] `npm run typecheck` — ghi exit code.
- [ ] `npm run lint` — ghi exit code, cảnh báo còn lại nếu có; không cần `--max-warnings 0` ngoài phạm vi.
- [ ] `npm run test:unit` — ghi tổng số file/tests PASS.
- [ ] `npm run build` — ghi exit code, warning chunk nếu có.
- [ ] Focused + affected Playwright — ghi tổng passed/failed/skipped cùng log/trace khi fail.
- [ ] `git diff --check`, xem changed files; không thay backend/schema/3D/audio/CMS, không commit dist/test-results/log.
- [ ] Cập nhật matrix mục 7 bên dưới, checklist FR/AC và mục 4.1.3 của accessibility checklist đúng phạm vi.
- [ ] Chuẩn bị PR description; chỉ push/mở/merge PR khi được yêu cầu rõ.

**Commit đề xuất:** `docs(a11y): record collection loading verification`

## 7. Verification commands & evidence matrix

**Chạy từ `front-end/`:**

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build

# Smoke/RED-GREEN và hồi quy public bằng mocked API (không dùng backend thật)
npx playwright test tests/collection.spec.ts --reporter=line
npx playwright test tests/accessibility-keyboard.spec.ts tests/exhibit-detail.spec.ts tests/tour-2d-fallback.spec.ts tests/public-report-modal.spec.ts --reporter=line
```

**PowerShell:** dùng `npm.cmd` hoặc `npx.cmd` nếu bị chặn bởi execution policy. Nếu chọn production preview, build xong chạy preview trên `127.0.0.1:4173` ở terminal riêng và đặt `PLAYWRIGHT_PREVIEW=1`, `CI` rỗng để reuse; không chạy hai Vite server chung port. Không bật `MUSEUM_LIVE_TEST=1` cho fixture tests.

| Gate / scenario | Kỳ vọng | Actual | Evidence |
|---|---|---|---|
| AC-01 List pending | Live status + skeleton | PASS | Promise gate list; named polite/atomic status, skeleton `aria-hidden` |
| AC-02 Detail pending | Status đúng phòng | PASS | Cùng node đổi message sang room A |
| AC-03 Load success | Status clear + cards | PASS | Cùng node rỗng, 5 cards, skeleton biến mất |
| AC-04 Room switch pending | Không stale / status B | PASS | Gate ceramics; status B, pressed pill và focus giữ nguyên |
| AC-05 Error + retry | Alert, không loading giả | PASS | List/detail HTTP và malformed schema; recovery |
| AC-06 Empty/invalid/search | Existing statuses giữ đúng | PASS | List/room empty, unknown room không fetch, search empty |
| AC-07 Background refetch | Không thông báo trùng | PASS | Gate list/detail; MutationObserver không ghi nhận text mutation |
| AC-08 Keyboard/focus | Không cướp focus | PASS | Pills/skip link/detail return/URL history; search focus qua refresh |
| AC-09 Existing status tests | Không strict-mode failure | PASS | Scope 3 Collection assertions và 1 D06 assertion theo text |
| Collection Playwright | PASS | 14/14 PASS | Lượt production preview cuối, thuộc cùng run 51 tests |
| Affected public suites | PASS | 36 PASS / 1 FAIL | Tổng cùng Collection: 50/51, exit 1; F04 cũng FAIL tại base `fcb2b4d`, chưa đủ điều kiện báo toàn bộ PASS |
| Frontend typecheck | PASS | PASS, exit 0 | `npm.cmd run typecheck`; code runtime cuối |
| Frontend lint | Exit 0; ghi warning | PASS, exit 0 | 0 errors; 1 warning `react-hooks/exhaustive-deps` cũ tại `CollectionPage` |
| Frontend unit tests | PASS | PASS, exit 0 | `npm.cmd run test:unit`: 31 files / 170 tests, 13.20s |
| Production build | PASS | PASS, exit 0 | `npm.cmd run build`: Vite 1m47s; warning chunks >500 kB hiện hữu |
| Manual screen reader | PASS/FAIL/NOT TESTED có lý do | NOT TESTED | Không thực hiện lượt nghe NVDA/VoiceOver trong môi trường agent Windows; không suy ra speech từ DOM assertions |
| Git diff | Không lan scope | NOT RUN | — |

**Quy tắc ghi nhận:** Những giá trị `NOT RUN` là trạng thái của tài liệu **tại thời điểm soạn**. Không điền PASS chỉ vì PR #99/#104 từng chạy xanh. Nếu browser test dùng API mocked thì gọi đúng là browser/UI test với mocked API, không ghi là live API.

### Ghi nhận thực thi — 27/10/2026

- Nhánh `fix/public-a11y-loading`, base sau fetch `fcb2b4d247f73c59c1cde5d01046f29d80aaf075`.
- Baseline focused: **5/5 PASS**, exit 0. DOM khi list đang pending: skeleton `aria-hidden=true`, named loading status **0**.
- RED trước production: **2/2 FAIL** do named loading status count 0 thay vì 1. GREEN sau production: **2/2 PASS**, exit 0.
- Chỉ thêm Mantine `VisuallyHidden` và state/effect ánh xạ pending trong `CollectionPage`; không cần CSS riêng. Effect dùng message string làm dependency nên list/detail refetch với dữ liệu đã có không tạo lại thông báo ban đầu.
- Regression ban đầu trên Vite dev: **48 PASS / 3 FAIL**, exit 1 (5.7m). Hai assertion D06 được sửa trong test: scope status cập nhật khi còn ở Collection; thay kỳ vọng font Times New Roman cũ bằng display font Plus Jakarta Sans đang có từ base. Runtime/CSS trang detail không thay đổi.
- Lượt cuối trên production preview: **50 PASS / 1 FAIL (4.0m), exit 1**, không skipped. Hai ca D06 đã PASS trong lượt đầy đủ. Lệnh: `npx.cmd playwright test tests/collection.spec.ts tests/accessibility-keyboard.spec.ts tests/exhibit-detail.spec.ts tests/tour-2d-fallback.spec.ts tests/public-report-modal.spec.ts --reporter=line`; `PLAYWRIGHT_PREVIEW=1`, `CI`/`MUSEUM_LIVE_TEST` rỗng; preview mở riêng trên `127.0.0.1:4173`.
- **Lỗi còn mở:** `tour-2d-fallback.spec.ts:105` — `[F04] unrecovered context retains selection and releases in-flight GLBs after the bounded recovery deadline`. Timeout 5s tại dòng 119 vì không tìm thấy canvas có nhãn `Phòng trưng bày 3D`, trước khi test giả lập mất context. Diagnostic xác nhận có `<canvas>` nhưng chưa có nhãn; chưa kết luận nguyên nhân renderer. Không đổi timeout hoặc bỏ assertion để ép PASS.
- **Đối chiếu baseline:** export đúng source `fcb2b4d` bằng `git archive`, dùng cùng dependencies/env local và Edge **156.0.4314.42** trên Windows; chỉ đổi port fixture/dev server sang **4174** trong bản sao tạm. Chạy `node node_modules/@playwright/test/cli.js test tests/tour-2d-fallback.spec.ts -g 'unrecovered context' --reporter=line` tại bản sao: **1 FAIL, exit 1**, cùng lỗi tại dòng 119. Lỗi đã có trên base; không sửa runtime 3D trong task Collection. Source baseline/log/trace giữ trong workspace tạm git-ignored để đối chiếu.
- Review độc lập toàn diff: không có Critical/Important/Minor; phạm vi quyết định font/locator được review cùng. Kết quả chạy cuối và QA nghe screen reader do người triển khai ghi riêng.
- Browser tests dùng public API fixtures; không gọi live API hay ghi database. Log/trace/snapshot là artifacts cục bộ, không đưa vào Git.

## 8. Definition of Done

- [ ] FR-01 → FR-10 và AC-01 → AC-10 đã được kiểm chứng phù hợp, hoặc ghi ngoại lệ có evidence.
- [ ] Chỉ **một** named live region persistent cho collection loading; không `aria-hidden`/`display:none`; skeleton unchanged.
- [ ] Đủ list/detail pending, error/retry, empty, invalid URL, room switch, no stale data; không duplicate background refetch.
- [ ] Không ảnh hưởng keyboard navigation, focus, deep link, public report hay visual layout.
- [ ] Không thay API/backend/DB/3D/audio; không thêm dependencies.
- [ ] Test RED trước/GREEN sau và quality gates có kết quả mới nhất cùng exit code/log.
- [ ] Ghi riêng manual screen-reader QA và giới hạn kiểm chứng; không tuyên bố toàn bộ WCAG 2.2 AA đã được chứng nhận.
- [ ] Tài liệu cập nhật đúng kết quả; scope PR gọn, review trước merge.

## 9. Ngoài phạm vi / review notes

- Mục Reports/Audit keyboard row actions thuộc nhiệm vụ accessibility CMS riêng, **không kéo vào PR này**.
- Không chuyển skeleton thành live region hoặc render từng placeholder vào accessibility tree.
- Không tự động tạo báo cáo hoặc giao dịch DB để kiểm tra; mọi browser test trong task là public fixture.
- Không yêu cầu chạy lại Audio/WebVTT, 3D camera, Auth hoặc Bulk Delete nếu các file đó không bị tác động.
- Nếu cần thay đổi thông điệp ngoài ngữ cảnh loading (ví dụ bổ sung success announcement), hãy ghi bug/evidence và quyết định scope trước khi implement.
