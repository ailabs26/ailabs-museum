# Public Locale Regression Tests — Task Breakdown & Acceptance

> **Trạng thái:** IN PROGRESS — branch `fix/public-locale-regression-tests` từ `origin/dev` tại `87c98824`.
>
> **PLAN:** [`../plans/public-locale-regression-tests-plan.md`](../plans/public-locale-regression-tests-plan.md)<br>
> **Repository:** `ailabs26/ailabs-museum`<br>
> **Source audit:** Đã fetch `origin`; `origin/dev` = `87c98824e074c910d8bdc1cad9c7f1f34ddfee85`, kiểm tra ngày 09/11/2026.<br>
> **Branch:** `fix/public-locale-regression-tests` từ `origin/dev`; không phụ thuộc việc merge F05.

## 1. User story / outcome

Là người duy trì dự án Aura Museum, tôi muốn 7 bài Playwright Public Locale phản ánh chính xác cách ứng dụng hiện nay hỗ trợ 6 ngôn ngữ và sử dụng React Query, để regressions thực sự được phát hiện và có thể merge Guided Tour Core sau đó mà không bị 3 bài test lỗi thời chặn lại.

**Giới hạn:** chỉ sửa test/fixture và tài liệu liên quan. Nếu nhận thấy lỗi thật ở production thì ghi bằng chứng, yêu cầu review phạm vi trước khi chỉnh code ngoài test.

## 2. Ma trận 3 lỗi

| ID | Test hiện có | Lỗi baseline được ghi trong tài liệu F05 | Nguyên nhân cần xác minh | Điều kiện PASS |
|---|---|---|---|---|
| ERR-01 | `invalid saved locale falls back to vi without crashing` | Expected `vi`, received `fr` | `fr` đã được chấp nhận trong `LOCALES` | Dữ liệu `de` bị từ chối và fallback về `vi`; dữ liệu `fr` hợp lệ được giữ |
| ERR-02 | `PublicLayout owns one locale provider across route changes` | Fixture render lỗi | Test fixture không có `QueryClientProvider` dù PublicLayout dùng `useQuery` | Render layout thật, đổi route `/first` ↔ `/second` vẫn `en` |
| ERR-03 | `public routes retain locale while Vietnamese content and admin stay unchanged` | Expected `html.lang=vi`, actual `en` | PublicLocale i18n đã gắn HTML lang bằng locale đã chọn | Public `html.lang=en`, Admin `vi`, persisted locale vẫn `en`, content assertion đúng fixture |

**Không khẳng định nguyên nhân đã được thực nghiệm xác nhận trong tài liệu này.** Source đã cho thấy mismatch; bước đầu triển khai phải chạy baseline trên `dev` mới nhất.

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

- [ ] Thay giá trị không hợp lệ từ `fr` thành `de` trong negative test.
- [ ] Giữ assertion `locale-first='vi'` và `storage-error='invalid'` khi đọc saved locale không được hỗ trợ.
- [ ] Thêm positive check `fr` được giữ và không có `storage-error` (test riêng hoặc `test.step`).
- [ ] Đảm bảo dữ liệu `localStorage` được tạo trước khi navigation, không bị lẫn state giữa tests.
- [ ] Chạy focused test, review diff chỉ thay logic test.

**Acceptance:** ERR-01 PASS với đúng contract 6 ngôn ngữ.
**Verification:** `npx playwright test tests/public-locale.spec.ts -g 'invalid saved locale|valid saved locale' --reporter=line`; `git diff --check`.

## 5. Task 02 — Bổ sung QueryClientProvider cho fixture

**Commit:** `fix(test): restore query provider in locale fixture`
**File:** `front-end/tests/fixtures/public-locale.tsx`.

- [ ] Bọc layout fixture bằng `QueryClientProvider` theo thứ tự bên ngoài `PublicLayout`.
- [ ] Khởi tạo `QueryClient` ổn định, không khởi tạo lại mỗi render, `retry:false` cho test.
- [ ] Giữ `MantineProvider`, `MemoryRouter`, `PublicLayout` và `StrictMode` đang dùng.
- [ ] Không tạo `PublicLocaleProvider` thứ hai cho layout fixture; provider của production layout là owner.
- [ ] Chạy riêng route test với console/pageerror; nếu còn lỗi dependency, xử lý trong fixture, không bỏ kiểm thử.

**Acceptance:** ERR-02 PASS, locale `en` giữ khi đi `/first` → `/second` → `/first`.
**Verification:** `npx playwright test tests/public-locale.spec.ts -g 'PublicLayout owns' --reporter=line`, `npm run typecheck`.

## 6. Task 03 — Đồng bộ HTML lang và Admin boundary

**Commit:** `fix(test): align public route locale assertions`
**File:** `front-end/tests/public-locale.spec.ts`.

- [ ] Trong loop các public routes, đổi expectation `html.lang` thành `en` khi saved locale `en`.
- [ ] Giữ assert localStorage vẫn có `{version:1,value:'en'}` qua navigation.
- [ ] Giữ assert `/admin/login` dùng tiếng Việt; đảm bảo không vô tình buộc Admin chịu Public Locale.
- [ ] Rà soát assertion `Hiện vật 1` sau `/tour.html`: chỉ giữ nếu fixture thực sự cung cấp Việt fallback; nếu muốn English thì thêm bản dịch cố định vào fixture và assert theo bản dịch đó.
- [ ] Sử dụng điều kiện DOM có ý nghĩa thay cho sleep/timeouts; nếu test lỗi khác lộ ra sau sửa `lang` thì ghi lỗi mới, không bỏ qua.

**Acceptance:** ERR-03 PASS mà vẫn xác minh được Public/Admin isolation.
**Verification:** `npx playwright test tests/public-locale.spec.ts -g 'public routes retain locale' --reporter=line`.

## 7. Task 04 — Deterministic fixture và focused regression

**Commit:** `test(i18n): harden public locale browser coverage` *(chỉ nếu có thay đổi test thực tế)*
**File:** `front-end/tests/public-locale.spec.ts`, `front-end/tests/fixtures/public-locale.tsx` hoặc mock helper hiện có nếu cần.

- [ ] Mock `GET /api/public/translations` (đăng ký trước navigation) cho các route cần kiểm tra text/translation; không phụ thuộc API ngoài.
- [ ] Bảo toàn các 4 test không lỗi: shared consumers, full reload, blocked storage, cross-tab.
- [ ] Chạy `public-locale.spec.ts` full **không filter**; không dùng `test.only`, `test.skip` hoặc bỏ assertion để đạt xanh.
- [ ] Chạy `public-language.spec.ts` và các affected routes (`collection`, `exhibit-detail`, `museum-tour`).
- [ ] Nếu cross-tab treo/timing bất ổn, thu trace và điều tra; không đánh dấu PASS nếu chưa chạy xanh.
- [ ] Review nếu có thay đổi test helper rộng hơn cần tách commit; không tạo commit rỗng nếu không sửa gì.

**Acceptance:** Locale suite 7/7 (hoặc số mới nếu bổ sung case) PASS, test i18n liên quan PASS, browser console không có lỗi chưa giải thích.
**Verification:**

```bash
cd front-end
npx playwright test tests/public-locale.spec.ts tests/public-language.spec.ts --reporter=line
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/museum-tour.spec.ts --reporter=line
```

## 8. Task 05 — Full gates, review và handoff

**Commit:** `docs(test): record public locale regression verification`
**File:** cập nhật hai file tài liệu Plan/Task với kết quả thực tế.

- [ ] Chạy `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` từ `front-end/`.
- [ ] Ghi exit code, số tests, browser/OS/Node, log hoặc trace, kết quả từng gate.
- [ ] `git diff origin/dev...HEAD`, rà từng dòng test changed, bảo đảm không thay production code.
- [ ] `git diff --check`; rà không có test artifact, secret, ảnh chụp hoặc file build không cần thiết.
- [ ] Điền commit SHA và kết quả thực vào ledger phía dưới.
- [ ] Push branch và mở PR vào `dev` **chỉ khi có yêu cầu**; không merge tự động.
- [ ] Sau khi PR fix đã merge `dev`, cập nhật branch F05 từ `origin/dev` và chạy lại `public-locale` + `guided-tour-core` + full frontend gates trước khi review F05.

**Acceptance:** Đầy đủ bằng chứng, diff nhỏ, PR có thể review độc lập; không nhầm yêu cầu PR fix với việc merge F05.

## 9. Verification matrix (điền khi triển khai)

| Gate | Kỳ vọng | Kết quả thực | Evidence |
|---|---|---|---|
| Pre-fix Public Locale | Tái hiện 3 lỗi hoặc giải thích khác biệt | 3 failures tái hiện; suite teardown/cross-tab runner bị treo | `npx playwright test tests/public-locale.spec.ts --reporter=line`, Windows + Edge. `fr` giữ locale hợp lệ; fixture thiếu QueryClient; public route `html.lang=en`. Dependency lockfile được khôi phục, không đổi package files. |
| Unsupported `de` + supported `fr` | PASS | NOT RUN | — |
| Layout fixture route persistence | PASS | NOT RUN | — |
| Public `html.lang=en` + Admin `vi` | PASS | NOT RUN | — |
| Public Locale full suite | 7/7 PASS, hoặc số tăng nếu thêm test | NOT RUN | — |
| Public Language suite | PASS | NOT RUN | — |
| Collection, Exhibit Detail, Museum Tour | PASS | NOT RUN | — |
| Frontend typecheck | PASS | NOT RUN | — |
| Frontend lint | PASS | NOT RUN | — |
| Frontend unit tests | PASS | NOT RUN | — |
| Frontend build | PASS | NOT RUN | — |
| Scope/diff check | No production changes | NOT RUN | — |

**Lưu ý:** `tests/guided-tour-core.spec.ts` hiện chỉ có ở branch F05, **không có trên `dev`** tại snapshot 09/11/2026. Không đưa nó vào lệnh kiểm thử trên branch fix; chỉ dùng khi F05 cập nhật từ `dev` sau merge fix.

## 10. Commit ledger

| Task | Commit message | SHA | Trạng thái |
|---|---|---|---|
| 00 | `docs(test): plan public locale regression fixes` | — | TODO |
| 01 | `fix(test): update unsupported locale coverage` | — | TODO |
| 02 | `fix(test): restore query provider in locale fixture` | — | TODO |
| 03 | `fix(test): align public route locale assertions` | — | TODO |
| 04 | `test(i18n): harden public locale browser coverage` | — | TODO / OMIT IF NO DIFF |
| 05 | `docs(test): record public locale regression verification` | — | TODO |

## 11. Definition of Done

- [ ] Không phụ thuộc merge `feat/guided-tour-core`.
- [ ] Cả 3 lỗi baseline được khắc phục vì contract đúng, không phải vì xóa kiểm thử.
- [ ] Public Locale full suite PASS và các affected tests PASS.
- [ ] Typecheck, lint, unit, build PASS; kết quả có bằng chứng.
- [ ] Không sửa runtime, backend, database hoặc migration.
- [ ] Mỗi commit nhỏ, review được; ghi lại SHA và kết quả.
- [ ] PR fix vào `dev` được review trước khi merge; F05 được kiểm thử lại sau đó.
