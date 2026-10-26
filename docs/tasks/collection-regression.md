# Collection Regression — Task & Acceptance Spec

**Trạng thái:** Đã duyệt ngày 26/10/2026; đang triển khai trên `test/collection-regression`.

**Plan:** [collection-regression-plan.md](../plans/collection-regression-plan.md)<br>
**Branch:** `test/collection-regression` từ `origin/dev` mới nhất → PR vào `dev`.<br>
**Base triển khai:** `origin/dev` `89119dfb43702357c6028fd0ef232d72d6a97a72`, fetch ngày 26/10/2026. Working tree ban đầu chỉ có hai file PLAN/TASK mới do người dùng thêm.

## 1. Bài toán & user story

Sau đợt UI redesign, Collection đổi từ `NativeSelect` sang **room filter pills**, thêm **tìm kiếm hiện vật** và **loading skeleton**. Các bài Playwright trước đây còn thao tác `<select>` cũ, assert giá trị `select.value` và chờ thông báo loading văn bản cũ, khiến bộ regression không còn phản ánh UI sản phẩm.

**User story:** Là người xem bộ sưu tập, tôi cần chọn phòng bằng chuột hoặc bàn phím, tìm hiện vật, đi đến chi tiết rồi quay về đúng phòng, được thông báo rõ khi dữ liệu đang tải/lỗi, không thấy hiện vật từ phòng cũ và vẫn sử dụng được trên mobile/dark mode.

**Goal của task:** Sửa đúng test drift và thêm regression cho UI đã triển khai. Không sửa production UI để thỏa selector cũ; nếu tìm thấy bug thật (đặc biệt a11y loading), đưa evidence và xin quyết định scope.

## 2. Acceptance criteria chi tiết

### A. Room filter pills

- [ ] A1. Tại `/collection`, room đầu tiên có `aria-pressed="true"` và các room còn lại `false`; container có `role="group"`, accessible name `Chọn phòng trưng bày`.
- [ ] A2. Click pill `Gốm Việt` chuyển `?room=ceramics`, cards/heading thuộc room B, room A không còn selected.
- [ ] A3. URL giữ mọi query param khác (ví dụ `source=home`) khi đổi phòng; reload vẫn chọn đúng room.
- [ ] A4. Browser Back/Forward phục hồi room selection tương ứng từ URL; không trộn cards/phòng.
- [ ] A5. URL `room=unknown` không fetch unknown room, có error rõ ràng, nhấn một pill hợp lệ phục hồi trạng thái.
- [ ] A6. Không yêu cầu ArrowDown như select; `Tab`, `Enter`, `Space` sử dụng được trên native button; `:focus-visible` và pressed state được kiểm chứng.

### B. API lifecycle & state

- [ ] B1. Fixture trả 5 exhibits đảo thứ tự vẫn render theo `displayOrder`, dữ liệu không hardcode, không tải Canvas 3D.
- [ ] B2. API list/detail pending không hiển thị cards stale. Phân biệt rõ skeleton UI và thông báo đang tải tới screen reader.
- [ ] B3. Khi chuyển phòng A → B trong lúc B pending, cards A biến mất; sau khi B trả dữ liệu có đúng danh sách B.
- [ ] B4. List/detail HTTP error, response schema sai và retry hiển thị đúng lỗi, không fallback demo/stale data.
- [ ] B5. Room list rỗng, room không có exhibits, room invalid và empty-result search phải có empty-state riêng.
- [ ] B6. Refetch thất bại ẩn dữ liệu stale theo contract hiện tại; retry thành công phục hồi.

### C. Live search mới sau redesign

- [ ] C1. Search dùng tên + mô tả (case-insensitive, trim leading/trailing whitespace); filter ngay trên các card đã tải.
- [ ] C2. `count` đổi đúng `n/tổng hiện vật khớp tìm kiếm`; không kết quả có trạng thái riêng.
- [ ] C3. Xóa từ khóa trả lại đủ các exhibits, không đổi room hoặc gọi thêm API do gõ tìm kiếm.
- [ ] C4. Chuyển phòng bằng pill reset search input (đúng code hiện tại), hiển thị đầy đủ exhibits phòng mới.
- [ ] C5. Search không tạo Canvas 3D, không thay đổi liên kết report/detail của từng exhibit.

### D. Cross-page regressions

- [ ] D1. Homepage featured/collection card → chi tiết 2D → quay lại collection đúng room; assert button `aria-pressed`, không assert select cũ.
- [ ] D2. Tour WebGL fallback → collection đúng room, focus heading đúng; ở **tour** vẫn dùng `NativeSelect` như cũ.
- [ ] D3. Collection → Tour giữ đúng slug; Tour → Collection không phá deeplink đã merge PR #93.
- [ ] D4. PublicReportModal trên card mở được và giữ đúng `exhibitId`/`reportedRevisionId`; không thay backend/report API.

### E. Responsive / accessibility

- [ ] E1. Viewport 320, 375, 768, 1024, 1440 × chiều cao đủ dùng, light/dark: không overflow ngang; pills/search/card/action nhìn và thao tác được.
- [ ] E2. Tab focus pill, Enter/Space chọn, focus visible; skip link và điều hướng tour không regression.
- [ ] E3. Loading skeleton hiện `aria-hidden` và **không có `role="status"`** trong `CollectionPage` hiện tại. Kiểm tra với Playwright accessibility tree/DOM. Nếu thiếu thông báo loading cho người dùng screen reader, ghi **product a11y gap** và đề xuất bổ sung status ẩn trực quan kèm RED test, không xóa assertion loading chỉ để pass.
- [ ] E4. Không chặn phát hành test-only vì các bug tour/3D/Tab focus đã được ghi nhận ở baseline; phân loại chính xác phạm vi và test result.

## 3. Tập test bị ảnh hưởng (đã đọc code)

| File | Vấn đề / kiểm tra | Hành động |
|---|---|---|
| `front-end/tests/collection.spec.ts` | `selectOption` tại các bài chọn/invalid/switch; `toHaveValue`; ArrowDown; loading text cũ | **Sửa chính và thêm search/keyboard cases** |
| `front-end/tests/exhibit-detail.spec.ts` | D05: về collection còn assert dropdown | **Đổi thành `aria-pressed`** |
| `front-end/tests/tour-2d-fallback.spec.ts` | F04: sau về collection còn assert dropdown; F02 chọn phòng ngay trong tour vẫn NativeSelect | **Chỉ sửa assertion F04 ở trang Collection** |
| `front-end/tests/home-featured.spec.ts` | ExhibitGrid và link featured | Chạy regression, sửa chỉ khi chứng minh test drift |
| `front-end/tests/public-report-modal.spec.ts` | Report từ card Collection | Chạy regression, giữ fixture/payload expectations |
| `front-end/tests/public-tour-navigation.spec.ts` | Tour link và keyboard | Chạy regression |
| `front-end/tests/tour-exhibit-deep-link.spec.ts` | Deep link vừa merge | Chạy regression để bảo vệ URL/selection |
| `front-end/tests/collection-live.spec.ts` | API thật, bộ 5 exhibits mẫu đã seed | **Optional live/read-only**, không giả định môi trường có seed |

**Đặc biệt:** Không thay mọi `getByLabel('Chọn phòng trưng bày').selectOption` toàn repo: `/tour` thật sự vẫn có `<select>`; làm vậy sẽ tạo regression mới.

## 4. Quy trình thực hiện — TDD & commits

### Task 0 — Baseline, chốt phạm vi và tạo branch

**Mục tiêu:** Có kết quả thực tế trước khi sửa assertions.

- [x] Fetch `origin/dev` SHA `89119dfb43702357c6028fd0ef232d72d6a97a72`; working tree ban đầu sạch ngoài PLAN/TASK mới; tạo branch `test/collection-regression`.
- [x] Đọc `AGENTS.md`, `docs/architecture/fe/coding-conventions.md`, README, `CollectionPage`, các test và fixture liên quan. `front-end/docs/coding-conventions.md` theo root AGENTS không tồn tại; dùng convention được chỉ định trong plan.
- [x] Chạy baseline `collection.spec.ts`: 4 case đi qua không báo lỗi; 5 case fail do locator `<select>` cũ / loading status cũ; case responsive cuối không kết thúc sau hơn 100 giây, dừng thủ công. Không có summary sạch từ runner.
- [x] Chạy D05 và F04 baseline: mỗi lượt xác nhận assertion cũ `toHaveValue` không dùng được với room pills; các lượt runner bị treo sau lỗi/ở case kế tiếp và được dừng thủ công.
- [x] Giữ Playwright error-context và trace trong `front-end/test-results/` (ignored). Source cho thấy skeleton `aria-hidden` và initial loading chưa có `role="status"`; ghi nhận product a11y gap cần quyết định riêng, không sửa UI trong scope này.
- [x] Commit hai docs PLAN/TASK sau khi cập nhật baseline evidence (`docs(test): plan collection regression`).

**Baseline:** `collection.spec.ts` 10 cases: 4 không báo lỗi, 5 fail, 1 responsive case bị runner hang rồi dừng thủ công. `[D05]` case return-to-room fail tại `toHaveValue`; case URL-encoding không có kết quả trước khi lượt test bị dừng. `[F04]` fail tại `toHaveValue` sau khi URL và focus heading đã đúng. Error context/trace được tạo cho các lỗi locator. Đây là test drift đã có trước runtime changes; chưa có sửa UI.

**Commit gợi ý:** `docs(test): plan collection regression`.

### Task 1 — Khôi phục room-selection tests

**Mục tiêu:** RED do stale selector trở thành GREEN mà không thay UI.

- [x] Đổi `getByLabel(...).selectOption('ceramics')` của Collection thành:

```ts
const rooms = page.getByRole('group', { name: 'Chọn phòng trưng bày' });
await rooms.getByRole('button', { name: roomB.name, exact: true }).click();
await expect(rooms.getByRole('button', { name: roomB.name, exact: true }))
  .toHaveAttribute('aria-pressed', 'true');
```

- [x] Đổi test `toHaveValue(roomSlug)` thành `aria-pressed=true` và kiểm room tương ứng `false`.
- [x] Test `?source=home` giữ nguyên khi chọn phòng, URL/reload/Back/Forward.
- [x] Test unknown room không request dữ liệu không có, bấm pill hợp lệ phục hồi.
- [x] Test delayed API room switch không giữ cards A hoặc pressed A.
- [x] Thay ArrowDown cũ bằng keyboard Enter/Space của button; kiểm Tab, focus-visible và không trap.
- [x] Chạy lại 5 focused cases trên preview: cả 5 PASS. Một lần chạy riêng trước đó timeout ở lúc chờ detail; diagnostic rerun xác nhận request `ceramics` được fixture trả 200 và test PASS, không tái hiện lỗi ứng dụng.

**Task 1 execution:** `PLAYWRIGHT_PREVIEW=1 npx playwright test tests/collection.spec.ts -g "selecting a room|browser back and forward|invalid URL selection|switching rooms|room pills support" --reporter=line --timeout=20000` — 5 passed (31.6s). Diagnostic single-case run logged GET `/api/rooms/ceramics` → 200; earlier timeout was transient and not reproducible. Targeted ESLint and production build also pass.

**Commit gợi ý:** `test(collection): align room selection with filter pills`.

### Task 2 — Loading, search và accessibility

**Mục tiêu:** Test phản ánh skeleton/search mới mà không che bug UX.

- [x] Chặn list/detail API bằng gate; xác nhận skeleton `aria-hidden` xuất hiện và cards stale không xuất hiện khi request pending.
- [x] Xác nhận skeleton không cung cấp thông báo loading cho screen reader; ghi product a11y gap bên dưới, giữ nguyên scope test-only đã duyệt.
- [x] Loading skeleton biến mất sau response và exhibit cards hiển thị.
- [x] Chưa thêm status production; đề xuất xử lý ở task a11y riêng với test RED trước khi sửa.
- [x] Test search theo tên/mô tả, hoa thường, khoảng trắng, non-match, count và empty state.
- [x] Test clear search, room change reset search; xác nhận chỉ gọi thêm detail endpoint của phòng mới.
- [x] Bổ sung test responsive 320/375/768/1024/1440 × light/dark: overflow, pills, search, link tour và text dài.

**Product a11y gap (ghi nhận, không sửa trong scope này):** Khi tải danh sách hoặc chi tiết lần đầu, `ExhibitSkeleton` có `aria-hidden="true"` và `CollectionPage` không phát thông báo `role="status"`; người dùng screen reader không được báo trạng thái đang tải. Cần task riêng bổ sung thông báo loading có thể đọc được và test tương ứng. Test hiện tại vẫn xác nhận skeleton, dữ liệu cũ không hiện khi pending, và dữ liệu mới sau khi tải.

**Commit gợi ý:** `test(collection): cover loading search and keyboard`.

### Task 3 — Cross-page navigation regressions

**Mục tiêu:** Bảo vệ các trang liên quan sau đổi Collection UI.

- [ ] Sửa D05 `exhibit-detail.spec.ts`: sau `Quay lại bộ sưu tập`, kiểm pill đúng `aria-pressed`; giữ URL/history và heading chi tiết.
- [ ] Sửa assertion F04 `tour-2d-fallback.spec.ts` **chỉ ở Collection**. Giữ select của `MuseumPage` trong các test F02/F03.
- [ ] Chạy regressions `home-featured`, `public-report-modal`, `public-tour-navigation`, `tour-exhibit-deep-link`, `accessibility-keyboard` subset liên quan.
- [ ] Với lỗi test liên quan WebGL/lifecycle/Tab focus nền, ghi rõ không do task này và bảo tồn coverage cũ.
- [ ] Không xóa case/hạ expectation để tránh phải sửa lỗi thực tế.

**Commit gợi ý:** `test(collection): update cross-page navigation regressions`.

### Task 4 — Verification, evidence, handoff

**Mục tiêu:** Có evidence đủ review và scope gọn.

- [ ] Chạy focused collection và D05/F04; đảm bảo mỗi case sửa được kiểm lại.
- [ ] Chạy affected browser suites; nếu test không ổn định, tái hiện riêng và ghi flake, không coi timed-out teardown là clean PASS.
- [ ] Chạy `typecheck`, `test:unit`, `build`, targeted ESLint và `npm run lint`; phân biệt lỗi nền 37 lint errors với lỗi mới.
- [ ] Test live collection (nếu bật) chỉ read-only, có published seed; nếu thiếu môi trường: `NOT TESTED`, không ngầm tính PASS.
- [ ] Kiểm `git diff --check`, không commit `.env`, `dist`, `test-results` hoặc screenshots.
- [ ] Ghi matrix thực tế dưới đây (counts, SHA, lệnh, PASS/FAIL/SKIP, blocker, screenshot refs nếu có).
- [ ] Hoàn tất PR-ready handoff; **không tự push hoặc mở PR** nếu chưa có yêu cầu.

**Commit gợi ý:** `docs(test): record collection regression verification`.

## 5. Lệnh chạy

Từ `front-end/`:

```bash
# Baseline/focused
npx playwright test tests/collection.spec.ts --reporter=line
npx playwright test tests/exhibit-detail.spec.ts -g '\[D05\]' --reporter=line
npx playwright test tests/tour-2d-fallback.spec.ts -g '\[F04\]' --reporter=line

# Affected regression
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/tour-2d-fallback.spec.ts tests/public-report-modal.spec.ts tests/home-featured.spec.ts tests/public-tour-navigation.spec.ts tests/tour-exhibit-deep-link.spec.ts --reporter=line

# Quality gates
npm run typecheck
npm run test:unit
npm run build
npx eslint tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/tour-2d-fallback.spec.ts
npm run lint
```

PowerShell: thay `npm` bằng `npm.cmd` nếu cần; khi dùng `-g`, quote pattern đúng PowerShell. Playwright fixture mặc định trên `127.0.0.1:4173`; không bật `MUSEUM_LIVE_TEST=1` cho fixture. Nếu chạy full browser suite phải kiểm kết quả thật và phân loại lỗi ngoài scope.

## 6. Execution evidence matrix (chưa chạy)

| Gate / scenario | Kỳ vọng | Actual | Evidence |
|---|---|---|---|
| Collection room pills | click, pressed state, URL, reload, Back/Forward | PASS | 5 focused Playwright cases |
| Keyboard pills | Tab, Enter, Space, focus visible | PASS | Focused Playwright run |
| Invalid room & retry | Không fetch unknown, recover đúng | PASS | Focused Playwright run |
| Search | name/description, count, empty, reset | PASS | Playwright search case; no extra request while typing |
| Loading & stale data | Skeleton, pending, no stale cards | PASS; product a11y gap recorded (no initial loading announcement) | Playwright gates; `CollectionPage` / `ExhibitSkeleton` |
| Cross-page D05 / F04 | Về collection đúng phòng | D05/F04 fail ở stale `toHaveValue`; runner không kết thúc sạch | Playwright context + trace trong ignored `test-results/` |
| Report & featured | Không regression | NOT RUN | — |
| Mobile/light/dark | 320/375/768/1024/1440 × light/dark; no horizontal overflow | PASS (10 combinations) | Playwright responsive case |
| Frontend typecheck | PASS | NOT RUN | — |
| Frontend unit | PASS | NOT RUN | — |
| Production build | PASS | NOT RUN | — |
| Targeted ESLint | PASS | NOT RUN | — |
| Full frontend lint | Ghi PASS/FAIL thật, không giấu lỗi nền | NOT RUN | — |
| Live API | Optional, read-only | NOT RUN | — |

## 7. Definition of Done / review gate

- [ ] Không còn test dùng `selectOption`/`toHaveValue` trên **Collection room filter pills**; select thật của Tour và PublicReportModal không thay đổi.
- [ ] Collection test phản ánh UI 2.0 mà không mất các ca API/error/empty/keyboard/URL đã có.
- [ ] Search và room switching có test mới, không render stale content hoặc Canvas.
- [ ] D05, F04 destination và các regressions quan trọng được chạy và phân loại chính xác.
- [ ] Không có product a11y bug bị giấu bằng cách xóa assertion; vấn đề loading nếu còn phải được ghi blocker/issue.
- [ ] Các gate có evidence từ lần chạy thực tế, không claim full PASS vì test timeout hoặc lint cũ.
- [ ] Chỉ docs/test trong diff theo mặc định; mọi code production fix phải có bug repro và duyệt scope.
- [ ] Có commit ledger, không tự tạo/merge PR.

## 8. Ngoài phạm vi

- Backend/database/API contract, migration hoặc seed.
- Chỉnh UI/Design System 2.0 để phục hồi dropdown cũ.
- Chuyển tour 3D từ `NativeSelect` sang pills.
- Fix WebGL focus/camera, Photo Mode, WebXR, AudioPlayer, transcript.
- Dọn full lint của tests/scripts khác hoặc thiết lập CI (tách nhánh quality gates).
- Thay đổi PublicReportModal hoặc quy trình moderation.
