# Public Locale Regression Tests — Task Breakdown & Acceptance

> **Trạng thái:** IMPLEMENTED — mọi test case liên quan báo `ok`; Playwright CLI chưa kết thúc sau teardown nên các browser commands không có exit code 0.
>
> **PLAN:** [`../plans/public-locale-regression-tests-plan.md`](../plans/public-locale-regression-tests-plan.md)<br>
> **Repository:** `ailabs26/ailabs-museum`<br>
> **Source audit:** Đã fetch `origin`; `origin/dev` = `87c98824e074c910d8bdc1cad9c7f1f34ddfee85`, kiểm tra ngày 09/11/2026.<br>
> **Branch:** `fix/public-locale-regression-tests` từ `origin/dev`; không phụ thuộc việc merge F05.

## 1. User story / outcome

Là người duy trì dự án Aura Museum, tôi muốn các bài Playwright Public Locale phản ánh chính xác cách ứng dụng hiện nay hỗ trợ 6 ngôn ngữ và sử dụng React Query, để regressions thực sự được phát hiện và có thể merge Guided Tour Core sau đó mà không bị các bài test lỗi thời chặn lại.

**Giới hạn:** chỉ sửa test/fixture và tài liệu liên quan. Nếu nhận thấy lỗi thật ở production thì ghi bằng chứng, yêu cầu review phạm vi trước khi chỉnh code ngoài test.

## 2. Ma trận 3 lỗi

| ID | Test hiện có | Lỗi baseline được ghi trong tài liệu F05 | Nguyên nhân cần xác minh | Điều kiện PASS |
|---|---|---|---|---|
| ERR-01 | `invalid saved locale falls back to vi without crashing` | Expected `vi`, received `fr` | `fr` đã được chấp nhận trong `LOCALES` | Dữ liệu `de` bị từ chối và fallback về `vi`; dữ liệu `fr` hợp lệ được giữ |
| ERR-02 | `PublicLayout owns one locale provider across route changes` | Fixture render lỗi | Test fixture không có `QueryClientProvider` dù PublicLayout dùng `useQuery` | Render layout thật, đổi route `/first` ↔ `/second` vẫn `en` |
| ERR-03 | `public routes retain locale while Vietnamese content and admin stay unchanged` | Expected `html.lang=vi`, actual `en` | PublicLocale i18n đã gắn HTML lang bằng locale đã chọn | Public `html.lang=en`, Admin `vi`, persisted locale vẫn `en`, content assertion đúng fixture |

Các nguyên nhân đã được xác minh bằng baseline Playwright trên `origin/dev` mới nhất.

## 3. Task 00 — Baseline và khóa phạm vi

**Commit:** `docs(test): plan public locale regression fixes`
**File:** `docs/plans/public-locale-regression-tests-plan.md`, `docs/tasks/public-locale-regression-tests.md`.

- [x] `git status --short` chỉ có hai file plan/task mới; không mang thay đổi từ nhánh F05 sang.
- [x] Fetch `origin`; tạo branch fix trực tiếp từ `origin/dev` SHA `87c98824e074c910d8bdc1cad9c7f1f34ddfee85`.
- [x] Đọc `AGENTS.md`, frontend coding conventions, `public-locale.spec.ts`, `fixtures/public-locale.tsx`, `publicLocale.ts`, `core/i18n/public-locale.tsx`, `AppProviders.tsx`, `LOCALES`.
- [x] Chạy baseline đầy đủ. `npx playwright test tests/public-locale.spec.ts --reporter=line`: tái hiện ba mismatch; lần đầu dependency `qrcode`/`@types/qrcode` còn thiếu trong `node_modules`, đã cài từ lockfile mà không đổi manifest.
- [x] Ghi nhận cùng ba test lỗi (fr được giữ; layout fixture không render; public `html.lang` là `en`); các test consumer/reload/blocked storage chạy qua. Cross-tab assertions hoàn tất trong trace run nhưng Playwright runner không thoát sau khi đóng browser; suite bị ngắt và không tính là PASS.
- [x] Commit plan/task với baseline hiện tại; chưa sửa production code.

**Acceptance:** Baseline tái lập được, scope được khóa ở 3 lỗi, base đúng `dev`.
**Verification:** `git diff --check`, baseline Playwright có log thực (không cần PASS trước khi fix).

## 4. Task 01 — Invalid saved locale validation

**Commit:** `fix(test): update unsupported locale coverage`
**File:** `front-end/tests/public-locale.spec.ts`.

- [x] Thay giá trị không hợp lệ từ `fr` thành `de` trong negative test.
- [x] Giữ assertion `locale-first='vi'` và `storage-error='invalid'` khi đọc saved locale không được hỗ trợ.
- [x] Thêm positive check `fr` được giữ và không có `storage-error` (test riêng).
- [x] Tạo dữ liệu `localStorage` trước navigation; test riêng biệt.
- [x] Test `de` và `fr` đều báo `ok` trong reporter `list`.

**Acceptance:** ERR-01 PASS với đúng contract 6 ngôn ngữ.
**Verification:** `npx playwright test tests/public-locale.spec.ts -g 'invalid saved locale|valid saved locale' --reporter=line`; `git diff --check`.

## 5. Task 02 — Bổ sung QueryClientProvider cho fixture

**Commit:** `fix(test): restore query provider in locale fixture`
**File:** `front-end/tests/fixtures/public-locale.tsx`.

- [x] Bọc fixture bằng `QueryClientProvider` bên ngoài `PublicLayout`.
- [x] Khởi tạo `QueryClient` module scope với `retry:false`.
- [x] Giữ `MantineProvider`, `MemoryRouter`, `PublicLayout` và `StrictMode`.
- [x] Không tạo `PublicLocaleProvider` thứ hai; production layout vẫn sở hữu provider.
- [x] Route test báo `ok`; `npm run typecheck` exit 0.

**Acceptance:** ERR-02 PASS, locale `en` giữ khi đi `/first` → `/second` → `/first`.
**Verification:** `npx playwright test tests/public-locale.spec.ts -g 'PublicLayout owns' --reporter=line`, `npm run typecheck`.

## 6. Task 03 — Đồng bộ HTML lang và Admin boundary

**Commit:** `fix(test): align public route locale assertions`
**File:** `front-end/tests/public-locale.spec.ts`.

- [x] Public route loop mong `html.lang=en` khi saved locale là `en`.
- [x] Giữ assertion localStorage `{version:1,value:'en'}` qua navigation.
- [x] Giữ `/admin/login` ở tiếng Việt và `html.lang=vi`.
- [x] Fixture `roomA` không có bản dịch, nên tên `Hiện vật 1` là fallback được xác định; mock translation API trả dữ liệu rỗng.
- [x] Dùng assertion DOM hiện hữu, không thêm timeout/sleep; route test báo `ok`.

**Acceptance:** ERR-03 PASS mà vẫn xác minh được Public/Admin isolation.
**Verification:** `npx playwright test tests/public-locale.spec.ts -g 'public routes retain locale' --reporter=line`.

## 7. Task 04 — Deterministic fixture và focused regression

**Commit:** `test(i18n): harden public locale browser coverage` *(chỉ nếu có thay đổi test thực tế)*
**File:** `front-end/tests/public-locale.spec.ts`, `front-end/tests/fixtures/public-locale.tsx` hoặc mock helper hiện có nếu cần.

- [x] Mock `GET /api/public/translations` trước navigation, không phụ thuộc API ngoài trong route assertion.
- [x] Giữ lại mọi test hiện có; thêm một positive locale test, tổng 8.
- [x] Từng test trong full Public Locale suite đã báo `ok` (7 test cùng run, cross-tab xác minh riêng); không dùng `only`/`skip`.
- [x] Chạy 44 test public-language + collection + exhibit-detail + museum-tour; tất cả báo `ok`.
- [x] Cross-tab riêng báo `ok` trong 5.1s.
- [x] Ghi nhận Playwright CLI treo sau test cuối/teardown trong mọi run, kể cả test đơn; ngắt tiến trình sau khi test đã báo `ok`. Đây là giới hạn runner, không tính lệnh browser suite exit 0.
- [x] Không thay đổi test helper dùng chung; mock nằm trong đúng route test, không cần commit Task 04 riêng.

**Acceptance:** 8/8 test Public Locale và 44/44 regression test liên quan báo `ok`; browser console không được thu thập tự động trong run này. CLI teardown vẫn cần xử lý riêng.
**Verification:**

```bash
cd front-end
npx playwright test tests/public-locale.spec.ts tests/public-language.spec.ts --reporter=line
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/museum-tour.spec.ts --reporter=line
```

## 8. Task 05 — Full gates, review và handoff

**Commit:** `docs(test): record public locale regression verification`
**File:** cập nhật hai file tài liệu Plan/Task với kết quả thực tế.

- [x] Chạy `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` từ `front-end/`; cả bốn exit 0.
- [x] Ghi lại browser outcomes, runner teardown, unit count và build warning ở verification matrix.
- [x] Rà `git diff origin/dev...HEAD`; chỉ có hai docs và hai test/fixture files, không có production changes.
- [x] `git diff --check` sạch; không có package manifest/lockfile hoặc build artifact trong diff.
- [x] Điền commit SHA các task code/docs đã tạo vào ledger.
- [ ] Push branch và mở PR vào `dev` **chỉ khi có yêu cầu**; không merge tự động.
- [ ] Sau khi PR fix đã merge `dev`, cập nhật branch F05 từ `origin/dev` và chạy lại `public-locale` + `guided-tour-core` + full frontend gates trước khi review F05.

**Acceptance:** Đầy đủ bằng chứng, diff nhỏ, PR có thể review độc lập; không nhầm yêu cầu PR fix với việc merge F05.

## 9. Verification matrix (điền khi triển khai)

| Gate | Kỳ vọng | Kết quả thực | Evidence |
|---|---|---|---|
| Pre-fix Public Locale | Tái hiện 3 lỗi hoặc giải thích khác biệt | 3 failures tái hiện; suite teardown/cross-tab runner bị treo | `npx playwright test tests/public-locale.spec.ts --reporter=line`, Windows + Edge. `fr` giữ locale hợp lệ; fixture thiếu QueryClient; public route `html.lang=en`. Dependency lockfile được khôi phục, không đổi package files. |
| Unsupported `de` + supported `fr` | PASS | PASS | `public-locale.spec.ts`, tests 2–3 reporter `list`: both `ok`. |
| Layout fixture route persistence | PASS | PASS | `public-locale.spec.ts`, test 4 reporter `list`: `ok`; typecheck exit 0. |
| Public `html.lang=en` + Admin `vi` | PASS | PASS | `public-locale.spec.ts`, test 5 reporter `list`: `ok`; empty translations response mocked. |
| Public Locale full suite | 8/8 PASS | 8/8 cases `ok`; CLI teardown hung | Seven tests `ok` in one list run; cross-tab `ok` in isolated run; full line reporter reached test 8 then teardown did not exit. |
| Public Language + affected routes | 44/44 PASS | 44/44 cases `ok`; CLI teardown hung | `public-language.spec.ts`, `collection.spec.ts`, `exhibit-detail.spec.ts`, `museum-tour.spec.ts`, reporter `list`; all 44 printed `ok`. |
| Frontend typecheck | PASS | PASS, exit 0 | `npm run typecheck` after fixture change. |
| Frontend lint | PASS | PASS, exit 0 | `npm run lint`. |
| Frontend unit tests | PASS | PASS, 49 files / 282 tests | `npm run test:unit`, exit 0. |
| Frontend build | PASS | PASS, exit 0 | `npm run build`; Vite reported existing >500 kB chunk warning. |
| Scope/diff check | No production changes | PASS | `git diff origin/dev...HEAD` contains only plan/task and test/fixture; `git diff --check` clean. |

**Lưu ý:** `tests/guided-tour-core.spec.ts` hiện chỉ có ở branch F05, **không có trên `dev`** tại snapshot 09/11/2026. Không đưa nó vào lệnh kiểm thử trên branch fix; chỉ dùng khi F05 cập nhật từ `dev` sau merge fix.

## 10. Commit ledger

| Task | Commit message | SHA | Trạng thái |
|---|---|---|---|
| 00 | `docs(test): plan public locale regression fixes` | `ec923be` | DONE |
| 01 | `fix(test): update unsupported locale coverage` | `1ac4b96` | DONE |
| 02 | `fix(test): restore query provider in locale fixture` | `e6fe9fe` | DONE |
| 03 | `fix(test): align public route locale assertions` | `829ecd0` | DONE |
| 04 | `test(i18n): harden public locale browser coverage` | — | OMITTED — mock was included in Task 03 commit |
| 05 | `docs(test): record public locale regression verification` | This commit | DONE; branch not pushed |

## 11. Definition of Done

- [x] Không phụ thuộc merge `feat/guided-tour-core`.
- [x] Cả 3 lỗi baseline được khắc phục vì contract đúng, không phải vì xóa kiểm thử.
- [x] Tất cả test case Public Locale và affected suites đều báo `ok`; runner teardown không kết thúc tự nhiên.
- [x] Typecheck, lint, unit, build exit 0; kết quả có bằng chứng.
- [x] Không sửa runtime, backend, database hoặc migration.
- [x] Mỗi commit code nhỏ, review được; SHA và kết quả đã ghi.
- [ ] PR fix vào `dev` được review trước khi merge; F05 được kiểm thử lại sau đó.
