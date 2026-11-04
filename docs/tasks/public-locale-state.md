# Public Locale State — Task Breakdown & Acceptance

> **Trạng thái:** DONE — triển khai và verification hoàn tất trên `feat/public-locale-state`. Chưa push/PR/merge.
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
| Task 0 — Baseline & plan | BASE SHA, PLAN/TASK và checklist đầu vào | Docs only | DONE (baseline Playwright ban đầu bị ngắt; đã chạy regression sau triển khai) |
| Task 1 — Locale persistence contract | Locale schema/key/store + unit tests | Helper + unit | DONE |
| Task 2 — Provider & hook | Context, consumer hook, React fixture + focused browser tests | Provider/hook + fixture/spec | DONE |
| Task 3 — Public route integration | Provider trong PublicLayout + route tests | One production wrapper + tests | DONE |
| Task 4 — Lifecycle & regression | Invalid/blocked storage, cross-tab, admin isolation, affected specs | Test / targeted bug fix nếu có | DONE |
| Task 5 — Evidence & handoff | Full gates, commit ledger, PR description | Docs only | DONE (PR chưa tạo theo yêu cầu trong task) |

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

- [x] Base SHA mới nhất, working tree, test baseline, các file chịu tác động và giới hạn scope có evidence.
- [x] PLAN và TASK link hai chiều; các commit dùng hậu tố `locale` dễ grep.

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

- [x] Unit test mặc định `'vi'`, chỉ nhận `vi/en`, key trống/saved v1, dữ liệu hỏng, sai version/type/locale, read/write lỗi.
- [x] Helper dùng schema/type/key/store và `createVisitorStore`; không chỉnh persistence chung hoặc các key favorites/notes.
- [x] Focused unit 9/9 và typecheck pass; API và envelope v1 đã được review.

### Acceptance

- [x] `PublicLocale` typed `vi | en`; các trường hợp lưu/đọc được unit test xác nhận.
- [x] Không thêm dependency, network/API, `navigator.language` hay locale URL.

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

- [x] Context + Provider dùng singleton store làm một nguồn dữ liệu.
- [x] Hook `usePublicLocale` đọc context và throw rõ ràng khi dùng ngoài Provider.
- [x] Fixture test-only có hai consumer, nút đổi locale và trạng thái storage.
- [x] Playwright xác nhận default, cập nhật đồng bộ, invalid saved và không crash.
- [x] Fixture không nằm trong route production; không thêm language selector vào Header.
- [x] Focused browser 2/2 và typecheck pass.

### Acceptance

- [x] API consumer hoàn chỉnh; `setLocale` cập nhật cùng state ở mọi consumer.
- [x] Outside-provider usage có lỗi developer rõ; không fallback giả hoặc tạo store mới.
- [x] Không thay màn hình public trước Task 3.

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

- [x] Bọc PublicLayout mà giữ nguyên header, main, Outlet, footer và mobile Drawer.
- [x] Provider nằm trong public layout; không đưa vào AppProviders hoặc các page riêng.
- [x] Route test chạy `/`, `/collection`, detail, `/tour`, `/tour.html`, sau đó quay lại fixture và đọc lại `en`.
- [x] `/admin/login` render; `html lang="vi"` giữ nguyên. Regression collection xác nhận query/navigation hiện có.
- [x] Focused route suite 32/32 và typecheck pass.

### Acceptance

- [x] Public route group có một provider owner, được fixture xác nhận qua sibling route SPA.
- [x] `en` được giữ qua route/reload khi storage hoạt động; Admin không nhận side effect locale.
- [x] Regression route/navigation và các gate ảnh hưởng pass.

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

- [x] Browser restore `en` sau reload.
- [x] Invalid locale fallback `vi` được xác nhận trong browser; unit test bổ sung wrong-version, malformed JSON và wrong-type.
- [x] Chặn `getItem`/`setItem`: app không crash, `en` vẫn hoạt động trong tab hiện tại với `unavailable`.
- [x] Hai tab cùng origin đồng bộ đổi locale và remove key qua storage event.
- [x] Public → Admin login → public route smoke pass; không dùng API/DB thật.
- [x] Affected Playwright regression: 54/54 pass.
- [x] Review source không có listener/timer mới; fixture không có trong production dist (`Test-Path` false).
- [x] Không phát hiện bug trong `createVisitorStore`; file persistence chung không đổi.

### Acceptance

- [x] Default/invalid/unavailable/cross-tab/reload được chứng minh bằng test.
- [x] 54/54 affected regression pass; visitor keys, media và PublicReportModal không đổi.

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

- [x] Final gates: typecheck 0, lint 0, unit 227/227, build exit 0; focused Playwright 7/7, route suite 32/32, affected suite 54/54.
- [x] `git diff --check` pass; branch diff chỉ gồm 10 file trong scope, không có artifacts/logs/credentials/dist/test-results.
- [x] New locale key tách riêng; `visitorState`, media, `html lang` không đổi; không có selector trong production.
- [x] Ghi OS, runtime/browser, branch/base và commit ledger bên dưới. Windows Playwright dev server teardown limitation được ghi.
- [x] PR summary và known limits được ghi; chưa push/tạo PR/merge theo task.
- [x] Trạng thái hoàn thành được ghi dựa trên kết quả hiện tại.
- [x] Không push, tạo PR hoặc merge.

### Acceptance

- [x] Plan/Task phản ánh commit và evidence thực tế; baseline E2E ban đầu được ghi interrupted.
- [x] Feature chỉ cung cấp state contract, không tuyên bố UI/data/audio đã được dịch.
- [x] Một branch với 6 commit tách nhiệm vụ, dễ review và revert.

**Commit:** `docs(locale): record public locale verification`.

---

## 1. Acceptance matrix (nghiệm thu tổng thể)

| AC | Điều kiện | Test / Evidence | Trạng thái |
|---|---|---|---|
| AC-01 | Hook typed `vi/en`, `locale/setLocale/storageError`, ngoài Provider throw rõ | Fixture + source review | PASS |
| AC-02 | No saved key → `vi`; valid `en` → `en`; unknown/invalid → safe fallback | Unit + browser | PASS |
| AC-03 | Set locale cập nhật nhiều consumer; blocked storage giữ in-memory | Browser fixture | PASS |
| AC-04 | Lựa chọn được giữ qua reload và các route public, kể cả `/tour.html` | Playwright navigation | PASS |
| AC-05 | Cross-tab event hoạt động và không tạo vòng lặp event listener | Playwright multi-page | PASS |
| AC-06 | Admin/Auth/CMS, URL, 2D/3D, media, report không regress | Affected regression + diff review | PASS (CMS source untouched) |
| AC-07 | `html lang` vẫn phản ánh nội dung tiếng Việt hiện tại | DOM/source assertions | PASS |
| AC-08 | Unit, browser, typecheck, lint, build có bằng chứng thực thi | Log + exit code | PASS |
| AC-09 | Plan, TASK, commit ledger và PR-ready handoff đầy đủ | Git log + Docs | PASS (PR not created) |

**Không thay `NOT RUN` bằng PASS trước khi thực thi.** Các kịch bản có API mock phải được ghi là Playwright browser test với mocked API. Số lượng test sẽ ghi theo kết quả thực tế, không dự đoán.

## 2. Execution ledger (cập nhật sau từng commit)

| Task | Commit message dự kiến | Commit SHA thực tế | Focused verification | Status |
|---|---|---|---|---|
| 0 | `docs(locale): plan public locale state` | `6d9b2062` | Unit baseline 218/218 PASS; initial collection/tour baseline interrupted; diff check PASS | DONE (baseline limit recorded) |
| 1 | `feat(locale): add validated public locale persistence` | `82ad3738` | Unit 9/9 PASS; typecheck exit 0 | DONE |
| 2 | `feat(locale): expose public locale provider and hook` | `06dd3b23` | Fixture Playwright 2/2 PASS; typecheck exit 0 | DONE |
| 3 | `feat(locale): scope locale state to public routes` | `9b20c109` | Locale + collection + detail Playwright 32/32 PASS; typecheck exit 0 | DONE |
| 4 | `test(locale): cover locale persistence and lifecycle` | `58bb08d5` | Unit 9/9, locale Playwright 7/7, affected Playwright 54/54 PASS | DONE |
| 5 | `docs(locale): record public locale verification` | `HEAD (this commit)` | Typecheck/lint exit 0; unit 227/227; build exit 0; diff check PASS | DONE |

**Thông tin môi trường điền khi chạy:**

```text
Base dev SHA: 3ccdd731b0f04139963fbf68ecb04e5f36eaab77
Feature branch SHA: feat/public-locale-state (at origin/dev base)
OS / Node / Browser(channel, version): Windows; Node v22.23.2; Playwright 1.64.0; Microsoft Edge 156.0.4314.58
Vitest focused: publicLocale 9/9 PASS; final full suite 227/227 PASS; baseline 218/218 PASS
Playwright focused: public locale lifecycle 7/7 PASS
Playwright route suite: locale + collection + detail 32/32 PASS
Playwright affected: collection, detail, tour, audio, report modal 54/54 PASS
Frontend typecheck / lint / unit / build: 0 / 0 / 227 passed / 0
Regression findings: none in application; initial baseline command was interrupted during Windows Playwright teardown; passed runs reused the Vite server and the owned server was stopped after testing
PR URL / merge state: NOT CREATED
```

## 3. Kiểm tra sau mỗi commit / quy trình debug

1. `git show --stat HEAD` để bảo đảm commit chỉ thay file đúng task.
2. `git show --check HEAD` và focused tests tương ứng (test không liên quan giữ nguyên).
3. Nếu lỗi xuất hiện ở phiên bản sau, xác định commit đầu tiên bằng `git bisect` trên nhánh feature; không gộp sửa không liên quan vào một commit khổng lồ.
4. Không sửa lịch sử công khai bằng `git reset --hard`/force push khi chưa có sự thống nhất; fix-forward bằng commit mới khi cần.
5. Khi task chuyển scope, ghi rõ finding, nguyên nhân và commit điều chỉnh trong ledger.

## 4. Definition of Done và bàn giao

- [x] AC-01 → AC-09 có evidence; checkbox được tick sau khi hoàn tất.
- [x] Có danh sách commit 1-1 cho Task 0–5.
- [x] Public Locale API dùng chung với một store.
- [x] Không thêm dropdown, dịch strings, chọn transcript/WebVTT theo locale hoặc Guided Tour.
- [x] Review độc lập whole-branch trên `3ccdd731..f375d5a`: Ready to merge = Yes; không có Critical, Important hoặc Minor finding. Chưa push/tạo PR/merge.

**Kết quả review:** reviewer xác nhận một locale owner, không thêm storage listener, Admin nằm ngoài provider, `html lang="vi"` đúng nội dung hiện tại, fixture không vào production build và commit chia nhỏ đúng phạm vi. Không cần sửa sau review.

**Tiêu đề PR đề xuất:** `feat(locale): establish public locale state and persistence`.

**Mô tả PR gợi ý:**

```text
Summary
- Introduce typed vi/en locale state exclusively for public client routes.
- Reuse versioned visitor persistence with safe fallback and cross-tab updates.
- Add focused unit/browser tests and route integration without changing public copy, CMS, audio or backend.

Verification
- `npm run typecheck` — PASS; `npm run lint` — PASS; `npm run test:unit` — 227/227 PASS; `npm run build` — PASS with existing large-chunk warning.
- `npx playwright test tests/public-locale.spec.ts --reporter=line` — 7/7 PASS.
- `npx playwright test tests/public-locale.spec.ts tests/collection.spec.ts tests/exhibit-detail.spec.ts --reporter=line` — 32/32 PASS.
- `npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/museum-tour.spec.ts tests/public-audio.spec.ts tests/public-report-modal.spec.ts --reporter=line` — 54/54 PASS.
- Browser evidence: Windows, Node v22.23.2, Playwright 1.64.0, Microsoft Edge 156.0.4314.58; API fixtures mocked, no live DB/API.

Out of scope
- Language selector, translated UI, localized exhibit/media, Guided Tour and WCAG certification.

Review focus
- One locale owner, no duplicate browser storage listeners, no Admin side effects,
  no false html[lang] declaration and an easily bisectable commit history.
```
