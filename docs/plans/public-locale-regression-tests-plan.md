# Public Locale Regression Tests — Implementation Plan

> **Trạng thái:** IMPLEMENTED — branch `fix/public-locale-regression-tests` từ `origin/dev` tại `87c98824`; 52/52 browser tests PASS và Playwright CLI thoát bình thường sau khi chuyển Vite sang global setup in-process.
>
> **Task & Acceptance:** [`../tasks/public-locale-regression-tests.md`](../tasks/public-locale-regression-tests.md)

**Repository:** `ailabs26/ailabs-museum`<br>
**Source audit:** Đã fetch `origin`; `origin/dev` hiện ở `87c98824e074c910d8bdc1cad9c7f1f34ddfee85` (09/11/2026).<br>
**Branch:** `fix/public-locale-regression-tests`, tạo trực tiếp từ SHA trên; F05 không được đưa vào branch.<br>
**Stack:** React 18, TypeScript, React Router 6, TanStack Query, Zod, Vitest, Playwright.
**Quy ước:** `AGENTS.md`, `docs/architecture/fe/coding-conventions.md`, `front-end/playwright.config.ts`.

## 1. Mục tiêu và kết quả

Khắc phục **ba Playwright regressions của `front-end/tests/public-locale.spec.ts`** xuất phát từ kỳ vọng cũ sau khi Public Locale được tích hợp với hệ thống đa ngôn ngữ hiện tại. Mục tiêu là làm các bài test phản ánh **contract production đã được chấp nhận**, không sửa hành vi sản phẩm để làm xanh bài test lỗi thời.

**Outcome:** 8 test Public Locale và 44 test đa ngôn ngữ/route liên quan PASS trong một run `52 passed`; Playwright CLI thoát với exit code 0. Frontend typecheck/lint/unit/build PASS.

## 2. Bằng chứng trên `dev` (09/11/2026)

| Vấn đề | Bằng chứng code | Lý do dự kiến | Quyết định |
|---|---|---|---|
| A — Invalid saved locale | `public-locale.spec.ts` ghi `{value:"fr"}` rồi mong fallback `vi`, lỗi `invalid` | `publicLocaleSchema` hiện kiểm tra `LOCALES`, trong đó `fr` đã hợp lệ | Đổi negative input sang locale *không hỗ trợ* (`de`), thêm positive assertion cho `fr` để tránh hồi quy |
| B — PublicLayout fixture | `tests/fixtures/public-locale.tsx` tạo `MemoryRouter` + `PublicLayout` chỉ dưới `MantineProvider` | `PublicLayout` đang dùng `core/i18n/public-locale.tsx`; `PublicTranslationsProvider` gọi `useQuery` và cần `QueryClientProvider` | Bổ sung React Query provider **cho fixture**, không thêm provider thứ hai vào ứng dụng thật |
| C — Public route lang | Test chọn `en` rồi vẫn đòi `<html lang="vi">` trên các public route | `PublicTranslationsProvider` hiện set `document.documentElement.lang = locale` | Expect `en` trên Public Client, `vi` sau khi vào Admin; kiểm tra content phụ thuộc fixture một cách đáng tin cậy |

**Kiểm thử baseline được ghi lại ở F05:** `public-locale.spec.ts` đạt 4/7, 3 test lỗi nói trên; các test F05 khác không phát sinh lỗi liên quan. Đây là số liệu lịch sử của nhánh F05, không phải kết quả chạy lại tại `dev` HEAD khi viết plan.

**Nguồn lịch sử:** PR #153 tạo locale state và 7 Playwright tests; PR #156 kết nối CMS translation; commit `6259aba829cdcb9835e77d651f353d88e06a9996` đã đổi unit negative input từ `fr` sang `de` nhưng chưa đồng bộ Playwright; PR #166 hoàn thiện UI translation. Phân tích root cause dựa trên mã nguồn, cần xác minh lại bằng browser run ở Task 00.

## 3. Phạm vi

### In scope

1. **Sửa test invalid locale**: kiểm tra `de` bị từ chối, có thể kiểm `fr` hợp lệ; vẫn giữ kiểm tra localStorage bị hỏng, fallback và `storageError`.
2. **Sửa test-only fixture**: cung cấp `QueryClientProvider` đúng lifecycle; giữ `PublicLayout` thực + `MemoryRouter`, không fake `usePublicLocale`, không mock React Query hook.
3. **Sửa route semantics**: khi lưu `en`, public routes giữ `html.lang=en` và lựa chọn persisted; khi sang Admin, `html.lang=vi`; nội dung hiện vật phải được assert theo **mock dữ liệu được xác định** (có thể là tiếng Việt fallback hoặc bản dịch do fixture cung cấp).
4. **Ổn định test**: mock `GET /api/public/translations?locale=...` trước navigation nếu route test cần kiểm chứng nội dung hoặc tránh phụ thuộc backend thật; dùng hàm fixture hiện hữu, không đưa mock API vào production.
5. Chạy kiểm thử focused, affected regression và cập nhật evidence trong task.

### Out of scope

- Không đổi `publicLocaleSchema`, `PublicLocaleProvider`, `PublicLayout` production hay CMS translations để làm test PASS.
- Không sửa F05 `MuseumProvider`/Guided Tour; không merge/cherry-pick F05 trong branch fix.
- Không sửa backend/API/DB/migration, không seed, không đổi nghiệp vụ audio, tour, WebGL, UX.
- Không cải tổ tổng thể framework test hoặc xử lý các lỗi Playwright **khác** không liên quan; nếu phát hiện lỗi production thật thì báo và mở phạm vi qua review riêng.

## 4. Thiết kế sửa chi tiết

### 4.1. Test invalid locale

Hiện trạng negative case dùng `fr`; thay thành `de` vì `de` không thuộc `LOCALES = vi/en/fr/zh/ko/ja`. Negative case phải xác nhận `locale-first = vi` và `storage-error = invalid`. Nên có positive case cho một locale mở rộng hợp lệ (ví dụ `fr`) để bảo đảm không lùi contract về `vi/en`.

Không thay `DEFAULT_PUBLIC_LOCALE` hoặc enum production.

### 4.2. Fixture Provider

`PublicLayoutFixture` đang mount `PublicLayout` thật. Trong app thật, `AppProviders` bọc `QueryClientProvider` bên ngoài Router, còn fixture không có. Thêm provider vào **test fixture**, khởi tạo `QueryClient` dùng riêng cho fixture (tạo ở module scope hoặc memoize một lần, không tạo mới trên mỗi render), với `retry:false` để test ổn định. Vị trí bọc ưu tiên ở outer fixture để áp dụng cho nhánh `?layout`, bảo toàn kiểm thử `PublicLocaleFixture` thuần.

Nếu `PublicLayout` cần những dependency khác của app sau khi bọc, chỉ bổ sung dependency thực sự cần thiết vào fixture; không mock toàn bộ layout. Đánh giá React `StrictMode` và console/pageerror trong test.

### 4.3. Public routes + lang

Trong test `public routes retain locale...`, khi người dùng đã chọn `en`, các route `/`, `/collection`, `/collection/:roomSlug/exhibits/:exhibitId`, `/tour`, `/tour.html` phải có `html.lang=en`, còn localStorage vẫn `en`. Sau khi vào `/admin/login`, DOM phải về `lang=vi` và CMS không bị lồng Public Locale Provider.

Không đơn thuần đổi assertion nếu test vô tình phụ thuộc vào bản dịch fixture: xác nhận `installMuseumApi` và translation response, kiểm tra nội dung fallback có chủ đích. Test tên hiện vật có thể giữ tiếng Việt nếu fixture không cấp bản dịch; nếu có bản dịch thì assert đúng tên đã mock. **Không mặc định rằng English UI đồng nghĩa mọi exhibit đều có English content**.

### 4.4. Phòng ngừa regression

- Bảo toàn các test còn lại: shared consumers, reload persistence, blocked storage, cross-tab sync.
- Test fixture không tự mở route admin production sai khác; dùng URL thật `/admin/login` khi xác minh boundary.
- Test không dùng `waitForTimeout`; đợi state/DOM/API có tín hiệu xác thực, capture trace khi lỗi.
- Khi mismatch do code production thực sự sai, dừng và báo evidence thay vì nới lỏng assertion bừa bãi.

## 5. Kế hoạch task/commit

| Task | Phạm vi | Commit đề xuất |
|---|---|---|
| 00 | Baseline, chốt contract, tạo Plan/Task | `docs(test): plan public locale regression fixes` |
| 01 | Invalid locale negative + valid locale positive | `fix(test): update unsupported locale coverage` |
| 02 | QueryClientProvider trong layout fixture | `fix(test): restore query provider in locale fixture` |
| 03 | Public route `html.lang`, Admin boundary, exhibit assertion | `fix(test): align public route locale assertions` |
| 04 | Tính quyết định của API mock và focused regression | `test(i18n): harden public locale browser coverage` |
| 05 | Full gates, evidence, diff review, PR handoff | `docs(test): record public locale regression verification` |
| 06 | Fix Playwright teardown trên Windows bằng global setup quản lý Vite in-process | `fix(test): close vite in playwright process` |

**Nguyên tắc:** Một task = một commit khi có thay đổi có nghĩa. Test của một hành vi nằm cùng commit sửa hành vi. Task 04 chỉ tạo commit khi có thay đổi test/fixture thực tế; không tạo commit rỗng để đủ số lượng.

## 6. Verification plan

Chạy từ `front-end/` (PowerShell hoặc shell tương đương), dùng Playwright fixture mặc định; **không đặt `MUSEUM_LIVE_TEST=1`**:

**Lệnh thực tế trên branch fix tạo từ `dev`:**

`tests/guided-tour-core.spec.ts` thuộc nhánh F05 chưa merge, nên **không chạy file đó ở branch fix**. Chỉ chạy Guided Tour test sau khi cập nhật F05 từ `dev` đã merge bản fix.


```bash
npx playwright test tests/public-locale.spec.ts tests/public-language.spec.ts --reporter=line
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/museum-tour.spec.ts --reporter=line
npm run typecheck && npm run lint && npm run test:unit && npm run build
```

Ghi lại: command, base/head SHA, OS/Node/browser, PASS/FAIL/SKIP, thời gian, console/pageerrors, giới hạn (mock API, không dùng DB thật). Root cause runner hang là `webServer` teardown gọi `taskkill /T /F` trên Windows; lệnh bị `Access denied`, làm Playwright chờ Vite child process. Vite nay chạy trong global setup và đóng bằng API, không tạo child process.

## 7. Acceptance & Definition of Done

- [x] Trước khi sửa, ghi nhận ba lỗi trên `origin/dev` mới nhất.
- [x] `de` invalid -> fallback `vi`; `fr` hợp lệ -> được giữ.
- [x] Layout fixture mount React Query và chuyển `/first` ↔ `/second` mà locale vẫn giữ.
- [x] Public routes `html.lang=en` sau khi chọn English; Admin trả `vi`.
- [x] Nội dung fallback được xác định bởi fixture và translations response mock rỗng.
- [x] Cả 8 test Public Locale báo `ok` (7 test cùng run và test cross-tab riêng); không skip/only.
- [x] 52 Public Locale + public-language/affected route tests PASS, CLI exit 0; typecheck/lint/unit/build exit 0.
- [x] Diff chỉ chứa tài liệu và test/fixture; không sửa production, backend hay F05.
- [ ] Có PR độc lập `fix/public-locale-regression-tests` → `dev` và reviewer xác nhận trước khi merge; không tự merge.

## 8. Rủi ro, ranh giới bàn giao

| Rủi ro | Biện pháp |
|---|---|
| `dev` đổi giữa lúc thực thi | Fetch và đối chiếu `origin/dev`, cập nhật baseline trước khi code |
| Fixture render sâu hơn app, cần provider khác | Bổ sung dependency tối thiểu; không sửa production và không mock hook cốt lõi |
| UI text phụ thuộc translation API | Chặn API trong test/fixture, assert fallback hoặc bản dịch đã khai báo |
| Cross-tab Playwright không ổn định | Tái hiện và ghi trace; không ghi PASS khi chưa chứng minh |
| Nhánh F05 đang chờ merge | Merge PR fix vào `dev` trước, sau đó cập nhật F05 và chạy lại regression |

**Handoff:** Sau khi PR fix merge `dev`, cập nhật `feat/guided-tour-core` bằng `git fetch origin` + `git merge origin/dev` (hoặc rebase theo quy trình nhóm), chạy `public-locale`, `guided-tour-core`, typecheck/lint/unit/build, rồi mới review/merge PR F05.
