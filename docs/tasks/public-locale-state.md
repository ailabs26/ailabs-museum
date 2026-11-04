# Public Locale State — Task Breakdown & Acceptance

> **Trạng thái:** IN PROGRESS — Task 0 baseline hoàn tất; Task 1 implementation và focused verification đã pass. Chưa push/PR/merge.
>
> **PLAN:** [public-locale-state-plan.md](../plans/public-locale-state-plan.md)
> **Repository:** `ailabs26/ailabs-museum`; baseline GitHub `dev` đã đọc: `3ccdd731b0f04139963fbf68ecb04e5f36eaab77` (04/11/2026). **Fetch lại `origin/dev` trước khi làm.**
> **Đề xuất branch:** `feat/public-locale-state` → PR vào `dev` (chỉ push/tạo PR/merge theo yêu cầu).

**User story:** Là khách tham quan Aura Museum, tôi muốn hệ thống giữ một lựa chọn ngôn ngữ nhất quán khi di chuyển giữa các trang Public Client hoặc tải lại trang; các phần giao diện/nội dung/audio được dịch trong những nhiệm vụ tiếp theo phải có một API duy nhất để đọc và cập nhật lựa chọn ấy.

**Outcome:** Public-only locale provider, `vi/en`, persisted/safe fallback, type-safe hook, unit + browser tests, commit ledger. **Không tạo language selector hoặc dịch UI trong nhiệm vụ này.**

---

## 0. Checklist tổng quan

| Task | Deliverable | Phạm vi commit | Trạng thái |
|---|---|---|---|
| Task 0 — Baseline & plan | BASE SHA, PLAN/TASK và checklist đầu vào | Docs only | NOT STARTED |
| Task 1 — Locale persistence contract | Locale schema/key/store + unit tests | Helper + unit | NOT STARTED |
| Task 2 — Provider & hook | Context, consumer hook, React fixture + focused browser tests | Provider/hook + fixture/spec | NOT STARTED |
| Task 3 — Public route integration | Provider trong PublicLayout + route tests | One production wrapper + tests | NOT STARTED |
| Task 4 — Lifecycle & regression | Invalid/blocked storage, cross-tab, admin isolation, affected specs | Test / targeted bug fix nếu có | NOT STARTED |
| Task 5 — Evidence & handoff | Full gates, commit ledger, PR description | Docs only | NOT STARTED |

### Quy tắc thực thi chung

- **Một feature, một nhánh `feat/public-locale-state`, một PR vào `dev`, nhiều commit nhỏ.** Chỉ commit những file đúng task; không `git add .` khi working tree có file ngoài phạm vi. Không push trực tiếp `dev`, không merge vào `main`.
- Luôn kiểm tra `git status`, `git diff --check`, `git diff --cached` trước mỗi commit; tuân theo root `AGENTS.md` và convention `docs/architecture/fe/coding-conventions.md` (nếu repo có hướng dẫn gần hơn, ưu tiên hướng dẫn gần hơn).
- Từ Task 1 trở đi, commit chỉ khi **focused tests của task GREEN**. Không commit test đỏ hoặc code lỗi chỉ để làm điểm mốc; TDD RED giữ local trước rồi commit GREEN.
- Không sửa backend/database/migration, auth, CMS translation CRUD, `AudioPlayer`, `mapRoomDisplays`, i18n UI, Guided Tour, media hoặc API contracts trong nhiệm vụ này.
- Tránh tạo dependency; reuse `createVisitorStore` và `useVisitorStore`. Không tạo `localStorage` wrapper/event listener thứ hai.
- Nếu đã có commit/PR khác đưa một phần locale vào `dev`, dừng và đối chiếu để tránh duplicate. Nếu bug phát hiện nằm ngoài scope, ghi finding/issue thay vì kéo vào PR.
- Các test trên Vite dev + mock fixtures **không** chứng minh tích hợp backend/live; ghi đúng môi trường.

## Task 0 — Baseline, branch và chốt tài liệu

**Mục tiêu:** Đảm bảo agent làm đúng đầu vào và giữ ranh giới feature.

**Files:** `docs/plans/public-locale-state-plan.md`, `docs/tasks/public-locale-state.md` (ADD).

### Steps

- [x] Fetch `origin/dev`; base SHA `3ccdd731b0f04139963fbf68ecb04e5f36eaab77`; working tree trước code chỉ có PLAN/TASK mới chưa track, được giữ nguyên. Tạo `feat/public-locale-state` từ base này.
- [x] Đọc root instructions, FE conventions, PLAN/TASK và source liên quan: AppProviders, router, PublicLayout, visitor persistence/state, useVisitorStore.
- [x] Xác nhận Home/Collection/Detail/Tour nằm dưới PublicLayout; Admin ngoài public layout. `mapRoomDisplays` và ExhibitDetail vẫn dùng `audio.vi`; `index.html`/`tour.html` giữ `lang="vi"`.
- [x] Baseline unit: `npm run test:unit` — 39 files, 218 tests passed, exit 0. Baseline browser: `npx playwright test tests/collection.spec.ts tests/museum-tour.spec.ts --reporter=line` chạy tới case 26/26 nhưng bị ngắt sau khi case cuối không kết thúc/không có summary; exit 1 do Ctrl+C, kết quả baseline E2E chưa xác định.
- [x] Đối chiếu PLAN/TASK; user yêu cầu đọc và triển khai nên bắt đầu coding theo đúng phạm vi. Không tạo PR/merge.

### Acceptance

- [ ] Base SHA mới nhất, working tree, test baseline, các file chịu tác động và giới hạn scope có evidence.
- [ ] PLAN và TASK link hai chiều, không chứa mã feature theo convention cuộc trao đổi; tên commit có hậu tố `locale` dễ grep.

**Commit sau khi duyệt:** `docs(locale): plan public locale state`.

---

## Task 1 — Validated locale persistence contract

**Mục tiêu:** Có một storage contract `vi/en` tương thích với browser persistence đã dùng trong Client.

**Files:** `front-end/src/helpers/publicLocale.ts` (ADD), `front-end/src/helpers/publicLocale.test.ts` (ADD).

### Interface

```ts
export const PUBLIC_LOCALE_STORAGE_KEY = 'aura:visitor:locale:v1';
export const DEFAULT_PUBLIC_LOCALE = 'vi' as const;
export const publicLocaleSchema = z.enum(['vi', 'en']);
export type PublicLocale = z.infer<typeof publicLocaleSchema>;
export const publicLocaleStore = createVisitorStore(
  PUBLIC_LOCALE_STORAGE_KEY, publicLocaleSchema, DEFAULT_PUBLIC_LOCALE,
);
```

Có thể thêm factory `createPublicLocaleStore(getStorage?)` **nếu cần** fake storage cho Node tests; không tạo abstraction khác khi `createVisitorStore` đã giải quyết vấn đề. Tránh cast không an toàn hoặc import DOM vào Node test.

### Steps

- [ ] Viết unit test mặc định `'vi'` và type/validation chỉ cho `vi/en` (bao gồm input lạ `fr`, rỗng, number).
- [ ] Test key chưa có → `vi` và `error=null`; key lưu envelope hợp lệ `{version:1,value:'en'}` → `en`.
- [ ] Test JSON hỏng, wrong version, wrong type/locale → default `vi`, `error='invalid'`.
- [ ] Test `getItem` ném lỗi → `vi`, `error='unavailable'`; test `setItem` ném lỗi vẫn có snapshot `en` trong memory, error unavailable.
- [ ] Viết helper chỉ khai báo schema/type/key/store, tái sử dụng `createVisitorStore`; không chỉnh `visitorPersistence.ts` hoặc các key favorites/notes.
- [ ] Chạy focused unit + typecheck, tự review API và dữ liệu saved v1, commit sau GREEN.

### Acceptance

- [ ] `PublicLocale` typed `vi | en`; tất cả các trường hợp lưu/đọc kể trên được unit test xác nhận.
- [ ] Không thêm dependency, network/API, `navigator.language` hay locale URL.

**Verification:**

```bash
cd front-end
npm run test:unit -- src/helpers/publicLocale.test.ts
npm run typecheck
```

**Commit:** `feat(locale): add validated public locale persistence`.

---

## Task 2 — PublicLocaleProvider, consumer hook và browser fixture

**Mục tiêu:** Consumer React có thể đọc/set cùng một locale; không dùng hook ngoài Provider một cách im lặng.

**Files:**

- `front-end/src/contexts/PublicLocaleContext.tsx` (ADD)
- `front-end/src/hooks/usePublicLocale.ts` (ADD)
- `front-end/tests/fixtures/public-locale.html` (ADD)
- `front-end/tests/fixtures/public-locale.tsx` (ADD)
- `front-end/tests/public-locale.spec.ts` (ADD phần fixture)

### Interface

```ts
interface PublicLocaleContextValue {
  locale: PublicLocale;
  setLocale: (next: PublicLocale) => void;
  storageError: VisitorStorageError;
}
```

- Provider dùng `useVisitorStore(publicLocaleStore)` để subscribe; `setLocale` thực thi `publicLocaleStore.update(() => next)`.
- Giá trị `Context` ổn định qua `useMemo`/stable callback khi cần; hook `usePublicLocale()` throw nếu ngoài `PublicLocaleProvider`.
- Không tạo state thứ hai `useState` bên cạnh visitor store, không tạo manual storage listener và không đụng HTML language attribute.

### Steps

- [ ] Tạo Context + Provider giữ singleton store đúng một nguồn dữ liệu.
- [ ] Tạo hook `usePublicLocale` tại `hooks/` đọc context và guard ngoài Provider.
- [ ] Tạo fixture test-only mount provider + ít nhất 2 consumer hiển thị locale để kiểm cùng snapshot; control `setLocale('vi')`, `setLocale('en')` bằng button có accessible name, hiển thị storage error.
- [ ] Thêm Playwright: default `vi`, 2 consumer cùng cập nhật `en` rồi `vi`, invalid saved → `vi`, không crash.
- [ ] Đảm bảo fixture không được thêm vào route production/SPA router; không thêm component đổi locale thật vào Header.
- [ ] Chạy focused browser và typecheck, commit khi GREEN.

### Acceptance

- [ ] API consumer hoàn chỉnh; `setLocale` cập nhật cùng state ở mọi consumer.
- [ ] Outside-provider usage có lỗi developer rõ; không fallback giả hoặc create store mới.
- [ ] Không thay các màn hình public thực tế trước Task 3.

**Verification:**

```bash
cd front-end
# PLAYWRIGHT_PREVIEW và MUSEUM_LIVE_TEST phải unset
npx playwright test tests/public-locale.spec.ts --reporter=line
npm run typecheck
```

**Commit:** `feat(locale): expose public locale provider and hook`.

---

## Task 3 — Scope provider đúng public routes

**Mục tiêu:** Cùng locale xuyên route Home, Collection, Exhibit Detail, Tour; CMS không bị ảnh hưởng.

**Files:** `front-end/src/layouts/PublicLayout.tsx` (EDIT nhỏ), `front-end/tests/public-locale.spec.ts` (EDIT).

### Steps

- [ ] Bọc nội dung `PublicLayout` với `PublicLocaleProvider`; bảo toàn `<header>`, `<main id="public-content" tabIndex={-1}>`, `<Outlet />`, `<footer>` và mobile Drawer hiện có.
- [ ] **Không** đưa Provider vào `AppProviders` toàn cục; không wrap lại ở `MuseumPage`/`ExhibitDetailPage`.
- [ ] Test đường đi public: từ fixture set `en` rồi truy cập `/`, `/collection`, detail, `/tour`, `/tour.html`; dùng API mocks hiện có khi cần; quay về fixture kiểm giá trị persisted.
- [ ] Test route navigation không xóa `aura:visitor:locale:v1`, không thay room/exhibit search params hiện có; Admin `/admin/login` vẫn render được.
- [ ] Test `index.html` và `tour.html` vẫn `html lang="vi"` do copy chưa dịch. Không thêm `lang=en` chỉ để làm test xanh.
- [ ] Chạy focused E2E + affected navigation smoke, typecheck, commit sau GREEN.

### Acceptance

- [ ] Public route group có một provider owner, không remount khi chuyển giữa sibling routes trong cùng SPA.
- [ ] `en` được giữ khi đổi route/reload **nếu** browser cho phép storage; Admin không nhận side effect ngôn ngữ.
- [ ] Không làm mất skip link, focus, drawer navigation, tour hoặc đường dẫn hiện vật.

**Verification:**

```bash
cd front-end
npx playwright test tests/public-locale.spec.ts tests/collection.spec.ts tests/exhibit-detail.spec.ts --reporter=line
npm run typecheck
```

**Commit:** `feat(locale): scope locale state to public routes`.

---

## Task 4 — Storage lifecycle, cross-tab và regression

**Mục tiêu:** Bắt lỗi edge cases thực tế, không chỉ happy path; test thay vì refactor sản phẩm không cần thiết.

**Files:** chủ yếu `front-end/tests/public-locale.spec.ts` (EDIT), `front-end/src/helpers/publicLocale.test.ts` (EDIT nếu cần). Chỉ sửa source liên quan khi có repro và được review.

### Steps

- [ ] Browser `page.addInitScript()` seed `en` trước khi load: fixture hiển thị `en`; reload vẫn `en`.
- [ ] Browser seeded `fr`/JSON corrupt/version sai: fixture về `vi` và có lỗi invalid nhưng render bình thường.
- [ ] Browser chặn `localStorage.getItem`: không crash. Khi chặn `setItem`, set `en` vẫn cập nhật **in-memory**; sau full reload có thể về default (đúng expectation, không viết test sai).
- [ ] Hai tab cùng browser context và origin: đổi tab A → tab B nhận qua `storage` event, không gây vòng lặp update. Kiểm thêm trường hợp key bị xóa nếu ổn định.
- [ ] Navigation từ public sang `/admin/login` rồi quay lại public không ảnh hưởng session/auth; không yêu cầu API/DB thật.
- [ ] Re-run các Playwright regression ảnh hưởng: `collection.spec.ts`, `exhibit-detail.spec.ts`, `museum-tour.spec.ts`, `public-audio.spec.ts`, `public-report-modal.spec.ts`; phân loại lỗi app/test/fixture/environment.
- [ ] Review không có timer/listener mới, không duplicate subscriptions ở StrictMode, không test fixture nào lọt production build.
- [ ] Nếu phát sinh bug trong `createVisitorStore` dùng chung: ghi bằng chứng/issue, xin review scope; không kéo sửa persistence chung vào task tùy tiện.

### Acceptance

- [ ] Default/invalid/unavailable/cross-tab/reload được chứng minh bằng test.
- [ ] Không regression navigation, media, PublicReportModal và các preference khác; mọi lỗi được phân loại minh bạch.

**Verification:**

```bash
cd front-end
npx playwright test tests/public-locale.spec.ts --reporter=line
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/museum-tour.spec.ts tests/public-audio.spec.ts tests/public-report-modal.spec.ts --reporter=line
```

**Commit:** `test(locale): cover locale persistence and lifecycle`.

---

## Task 5 — Final verification, commit ledger và bàn giao

**Mục tiêu:** Có đủ bằng chứng tái chạy, rõ commit nào làm phần nào và giới hạn feature.

**Files:** cập nhật `docs/tasks/public-locale-state.md` (trạng thái/evidence/commit ledger), `docs/plans/public-locale-state-plan.md` chỉ nếu cần phản ánh quyết định đã duyệt.

### Steps

- [ ] Chạy từ `front-end/`: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, focused và affected Playwright; ghi exit codes + số PASS/FAIL/SKIP.
- [ ] Kiểm tra `git diff --check`, `git status --short`, `git log --oneline origin/dev..HEAD`, `git diff --name-status origin/dev...HEAD`; không chứa file ngoài scope, screenshot/log/credential, `dist`, `test-results`.
- [ ] Chạy kiểm chứng `aura:visitor:favorites:v1`, reading, recent/notes không bị thay bởi key locale; không làm `html[lang]` sai và không thêm language selector production.
- [ ] Ghi OS, browser/channel/version, branch/base SHA, commit hash cho từng task; lưu logs/trace vào path có thể kiểm tra (không nhất thiết commit logs nhạy cảm).
- [ ] Lập PR summary: problem, outcome, key API, test results, evidence, screenshot **chỉ nếu có UI change** (bình thường không có), known limitations và next steps.
- [ ] Báo cáo trạng thái cuối đúng sự thật (`DONE`/`BLOCKED`/`NOT RUN`), không lấy pass từ PR cũ làm pass hiện tại.
- [ ] Không tự push, tạo PR, merge nếu chưa có yêu cầu rõ.

### Acceptance

- [ ] Plan/Task phản ánh đúng commit thực tế, không còn placeholder PASS vô căn cứ.
- [ ] Feature chỉ cung cấp state contract, **không tuyên bố đã đa ngôn ngữ hóa UI, dữ liệu hay audio**.
- [ ] 01 PR nhỏ, 05–06 commit có thông điệp và phạm vi nhất quán, dễ bisect/revert.

**Commit:** `docs(locale): record public locale verification`.

---

## 1. Acceptance matrix (nghiệm thu tổng thể)

| AC | Điều kiện | Test / Evidence | Trạng thái |
|---|---|---|---|
| AC-01 | Hook typed `vi/en`, `locale/setLocale/storageError`, ngoài Provider throw rõ | Fixture + source review | NOT RUN |
| AC-02 | No saved key → `vi`; valid `en` → `en`; unknown/invalid → safe fallback | Unit + browser | NOT RUN |
| AC-03 | Set locale cập nhật nhiều consumer; blocked storage giữ in-memory | Browser fixture | NOT RUN |
| AC-04 | Lựa chọn được giữ qua reload và các route public, kể cả `/tour.html` | Playwright navigation | NOT RUN |
| AC-05 | Cross-tab event hoạt động và không tạo vòng lặp event listener | Playwright multi-page | NOT RUN |
| AC-06 | Admin/Auth/CMS, URL, 2D/3D, media, report không regress | Affected regression + diff review | NOT RUN |
| AC-07 | `html lang` vẫn phản ánh nội dung tiếng Việt hiện tại | DOM/source assertions | NOT RUN |
| AC-08 | Unit, browser, typecheck, lint, build có bằng chứng thực thi | Log + exit code | NOT RUN |
| AC-09 | Plan, TASK, commit ledger và PR-ready handoff đầy đủ | Git log + Docs | NOT RUN |

**Không thay `NOT RUN` bằng PASS trước khi thực thi.** Các kịch bản có API mock phải được ghi là Playwright browser test với mocked API. Số lượng test sẽ ghi theo kết quả thực tế, không dự đoán.

## 2. Execution ledger (cập nhật sau từng commit)

| Task | Commit message dự kiến | Commit SHA thực tế | Focused verification | Status |
|---|---|---|---|---|
| 0 | `docs(locale): plan public locale state` | — | Unit 218/218 PASS; Playwright baseline INTERRUPTED; `git diff --check` pending | IN PROGRESS |
| 1 | `feat(locale): add validated public locale persistence` | — | Unit + typecheck | NOT STARTED |
| 2 | `feat(locale): expose public locale provider and hook` | — | Fixture Playwright + typecheck | NOT STARTED |
| 3 | `feat(locale): scope locale state to public routes` | — | Route Playwright + typecheck | NOT STARTED |
| 4 | `test(locale): cover locale persistence and lifecycle` | — | Focused + affected E2E | NOT STARTED |
| 5 | `docs(locale): record public locale verification` | — | Full gates + diff review | NOT STARTED |

**Thông tin môi trường điền khi chạy:**

```text
Base dev SHA: 3ccdd731b0f04139963fbf68ecb04e5f36eaab77
Feature branch SHA: feat/public-locale-state (at origin/dev base)
OS / Node / Browser(channel, version): Windows; Node v22.23.2; Playwright 1.64.0 (Chromium/MS Edge channel)
Vitest focused: publicLocale 8/8 PASS; baseline 218/218 PASS
Playwright focused: NOT RUN
Playwright affected: baseline collection + museum-tour interrupted at final case, no summary
Frontend typecheck / lint / unit / build: NOT RUN
Regression findings: NOT RUN
PR URL / merge state: NOT CREATED
```

## 3. Kiểm tra sau mỗi commit / quy trình debug

1. `git show --stat HEAD` để bảo đảm commit chỉ thay file đúng task.
2. `git show --check HEAD` và focused tests tương ứng (test không liên quan giữ nguyên).
3. Nếu lỗi xuất hiện ở phiên bản sau, xác định commit đầu tiên bằng `git bisect` trên nhánh feature; không gộp sửa không liên quan vào một commit khổng lồ.
4. Không sửa lịch sử công khai bằng `git reset --hard`/force push khi chưa có sự thống nhất; fix-forward bằng commit mới khi cần.
5. Khi task chuyển scope, ghi rõ finding, nguyên nhân và commit điều chỉnh trong ledger.

## 4. Definition of Done và bàn giao

- [ ] AC-01 → AC-09 có evidence hoặc ghi blocker minh bạch; các checkbox Task 0–5 chỉ tick khi hoàn tất thật.
- [ ] Có danh sách commit 1-1 với từng bước, không nhầm định danh feature trong các kế hoạch khác.
- [ ] Public Locale API dùng chung có thể được feature UI internationalization và localized content/audio tiêu thụ mà không thêm store mới.
- [ ] Chưa làm dropdown, dịch strings, chọn transcript/WebVTT theo locale hoặc Guided Tour; các công việc đó là PR riêng.
- [ ] Người review xác nhận test và scope; chỉ tạo PR/merge khi được yêu cầu.

**Tiêu đề PR đề xuất:** `feat(locale): establish public locale state and persistence`.

**Mô tả PR gợi ý:**

```text
Summary
- Introduce typed vi/en locale state exclusively for public client routes.
- Reuse versioned visitor persistence with safe fallback and cross-tab updates.
- Add focused unit/browser tests and route integration without changing public copy, CMS, audio or backend.

Verification
- [Fill in actual commands, pass/fail/skip and environment after running.]

Out of scope
- Language selector, translated UI, localized exhibit/media, Guided Tour and WCAG certification.

Review focus
- One locale owner, no duplicate browser storage listeners, no Admin side effects,
  no false html[lang] declaration and an easily bisectable commit history.
```
