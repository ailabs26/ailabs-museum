# Public Locale State — Implementation Plan

> **Trạng thái:** DRAFT — tài liệu thiết kế, **chưa triển khai hoặc chạy test**.
>
> **Task / Acceptance:** [public-locale-state.md](../tasks/public-locale-state.md)

**Repository:** `ailabs26/ailabs-museum`
**Source audit:** GitHub branch `dev` tại `3ccdd731b0f04139963fbf68ecb04e5f36eaab77` (kiểm tra ngày 04/11/2026). **Khi bắt đầu code, luôn `git fetch origin` và đối chiếu `origin/dev` mới nhất; không coi SHA trên là HEAD vĩnh viễn.**
**Đề xuất branch:** `feat/public-locale-state` từ `origin/dev` mới nhất; **01 feature / 01 branch / 01 PR** vào `dev`. Chỉ push, tạo PR hoặc merge khi được yêu cầu.
**Stack:** React 18, TypeScript, React Router 6, Zod, Vitest (Node), Playwright, Mantine 7; ưu tiên tái sử dụng dependency và browser persistence hiện có.

**Goal:** Tạo một nguồn trạng thái ngôn ngữ nhất quán cho **Client công khai**, ban đầu chỉ `vi` và `en`, để các feature chuyển ngữ giao diện/nội dung/audio tiếp theo có thể đọc và cập nhật ngôn ngữ thông qua API React ổn định. Lựa chọn được duy trì khi đổi route public, reload và mở tab khác (khi storage khả dụng); khi storage lỗi, thao tác vẫn dùng được trong phiên trang hiện tại.

**Architecture:** Một `PublicLocaleProvider` bao quanh `PublicLayout` và `Outlet` của routes công khai; hook `usePublicLocale()` trả về `{ locale, setLocale, storageError }`. Dữ liệu persisted bằng **`createVisitorStore` sẵn có** và hook `useVisitorStore` (dùng `useSyncExternalStore`); không tạo global state framework, React Query cache hay storage engine mới.

---

## 1. Scope và outcome

### Trong phạm vi

1. **Locale contract:** `PublicLocale = 'vi' | 'en'`, giá trị mặc định `'vi'`, chỉ chấp nhận mã hợp lệ. Không tự suy đoán locale từ OS, IP, `navigator.language` hoặc HTTP headers.
2. **Persistence:** một key versioned `aura:visitor:locale:v1` theo định dạng `createVisitorStore`: `{ "version": 1, "value": "en" }`. Ưu tiên saved value hợp lệ hơn default, fallback an toàn nếu dữ liệu thiếu/hỏng hoặc browser chặn storage.
3. **Public provider:** một owner duy nhất cho Home, Collection, Exhibit Detail, Tour (`/tour`, `/tour.html`); không đặt provider riêng trên từng page hoặc mỗi audio player.
4. **Hook tiêu chuẩn:** các feature tiếp theo chỉ dùng `usePublicLocale()`; expose `storageError` để Language Selector sau này có thể phản hồi nếu không lưu được sở thích.
5. **Cross-tab / lifecycle:** tái sử dụng event `storage` và xử lý unsaved writes từ `createVisitorStore`; không thêm listener song song. Một thay đổi ở tab A xuất hiện tại tab B khi store nhận được event và không có thay đổi local chưa lưu cần bảo toàn.
6. **Kiểm thử:** unit test contract/default/validation/persistence và Playwright trên React fixture + đường đi thực của public routes; evidence và README chạy test trong TASK.

### Ngoài phạm vi (không làm trong PR này)

- **Không thêm dropdown/nút chọn ngôn ngữ trên giao diện sản phẩm** (Language Selector thuộc feature UI i18n kế tiếp). Chỉ fixture test được có điều khiển thử nghiệm.
- **Không dịch** Header/Footer/labels, room/exhibit/hotspot, thông báo lỗi, bản thuyết minh, WebVTT hay audio. Không đổi `mapRoomDisplays` đang lấy tiếng Việt, không sửa `AudioPlayer`, schema/API, CMS `/admin/translations`.
- **Không cập nhật `document.documentElement.lang` sang `en` trong bước này:** nội dung UI public vẫn là tiếng Việt; gán `lang=en` lúc này sẽ khiến screen reader diễn giải sai. Feature dịch UI sẽ chịu trách nhiệm gắn `lang` chính xác với phần nội dung đã dịch và rà soát accessibility.
- Không thêm locale vào URL/query (`?lang=en`), không dùng cookie, không chỉnh CDN/cache/service worker/SSR, không thêm dependency i18next; không sửa backend, DB/migration, auth, RBAC, CMS hoặc WebXR.
- Không đưa Guided Tour state/controller hoặc đồng bộ audio/2D/3D vào phạm vi. Locale state chỉ tạo hợp đồng cho các feature đó.

## 2. Source of truth — code trên `dev` đã khảo sát

| File | Hiện trạng được xác nhận | Quyết định |
|---|---|---|
| `front-end/src/AppProviders.tsx` | Cấp app gói Mantine, QueryClient, Auth, Modals, BrowserRouter. | **Không** đặt locale ở provider global để tránh vô tình thay scope Admin. |
| `front-end/src/app/router.tsx` | Home `/`, Collection `/collection`, Exhibit Detail `/collection/:roomSlug/exhibits/:exhibitId`, Tour `/tour` và `/tour.html` đều nằm dưới `<PublicLayout />`; Admin tách route. | Dùng ranh giới **PublicLayout** để giữ locale xuyên route mà không chạm Admin. |
| `front-end/src/layouts/PublicLayout.tsx` | Render header, mobile drawer, `<Outlet />`, footer, các labels vẫn là tiếng Việt. | Chỉ bọc UI hiện tại bởi `PublicLocaleProvider`; không đổi markup/nav/copy/CSS. |
| `front-end/src/helpers/visitorPersistence.ts` | `createVisitorStore` có envelope versioned, Zod validate, fallback, in-memory khi write thất bại, `storage` listener, subscribe/getSnapshot. | **Tái sử dụng nguyên trạng**, không viết lại `localStorage` try/catch/event framework. |
| `front-end/src/hooks/useVisitorStore.ts` | Hook sử dụng `useSyncExternalStore(store.subscribe, store.getSnapshot)`. | Provider consume store qua hook này. |
| `front-end/src/helpers/visitorState.ts` | Các preferences hiện dùng key `aura:visitor:*:v1` và `createVisitorStore`. | Dùng key locale riêng, không sửa favorites/reading/notes. |
| `front-end/src/helpers/mapRoomDisplays.ts` | `audio`, `transcript`, `audioLocale` đang cố định tiếng Việt. | **Giữ nguyên** trong PR locale state; sẽ dùng hook trong feature localized content/media. |
| `front-end/src/pages/client/ExhibitDetailPage.tsx` | `audio?.vi`, `locale="vi"`; transcript theo tiếng Việt. | Không đổi media hoặc hiển thị, tránh hỏng test đã nghiệm thu. |
| `front-end/src/pages/admin/TranslationsPage.tsx` và `services/translations.service.ts` | CMS có quản lý chuỗi dịch `vi/en/fr/ja/zh`. | Không đồng nhất bảng bản dịch CMS với state ngôn ngữ Client; không tích hợp API trong bước này. |
| `front-end/index.html`, `front-end/tour.html` | `html lang="vi"`. | Giữ nguyên, vì UI chưa dịch sang Anh. |
| `front-end/vitest.config.ts` | Vitest chỉ chạy `src/**/*.test.ts` trên môi trường `node`. | Unit test helper thuần; provider lifecycle test bằng Playwright browser, không tự thêm `jsdom`. |
| `front-end/playwright.config.ts` | Browser Playwright 4173; fixture ở `tests/fixtures`; `PLAYWRIGHT_PREVIEW` và `MUSEUM_LIVE_TEST` là chế độ riêng. | Fixture thử provider chạy trên Vite **dev**, không đòi production preview có HTML entry fixture. |

**Lưu ý về tính chứng cứ:** Những dòng trên được xác nhận bằng đọc source; không có test mới nào đã chạy trong lần soạn PLAN/TASK. Cần kiểm tra lại khi `dev` đổi.

## 3. Thiết kế chi tiết

### 3.1 Contract / API công khai

**Module đề xuất** `front-end/src/helpers/publicLocale.ts`:

```ts
export const PUBLIC_LOCALE_STORAGE_KEY = 'aura:visitor:locale:v1';
export const DEFAULT_PUBLIC_LOCALE = 'vi' as const;
export const publicLocaleSchema = z.enum(['vi', 'en']);
export type PublicLocale = z.infer<typeof publicLocaleSchema>;

// Ưu tiên tái sử dụng createVisitorStore (versioned data và storage event).
export const publicLocaleStore = createVisitorStore(
  PUBLIC_LOCALE_STORAGE_KEY, publicLocaleSchema, DEFAULT_PUBLIC_LOCALE,
);
```

**Module đề xuất** `front-end/src/contexts/PublicLocaleContext.tsx`:

```ts
export interface PublicLocaleContextValue {
  locale: PublicLocale;
  setLocale: (next: PublicLocale) => void;
  storageError: VisitorStorageError;
}
// PublicLocaleProvider: subscribe qua useVisitorStore(publicLocaleStore),
// cập nhật qua publicLocaleStore.update(() => next), memoize context value.
```

**Hook đề xuất** `front-end/src/hooks/usePublicLocale.ts`:

```ts
const { locale, setLocale, storageError } = usePublicLocale();
setLocale('en'); // typed API; UI chuyển ngôn ngữ thật sẽ dùng ở feature sau.
```

- Hook chỉ dùng trong cây `PublicLocaleProvider`; **throw rõ ràng nếu dùng ngoài provider** thay vì âm thầm tạo bản sao state hoặc mặc định ở CMS.
- Đảm bảo `setLocale('en')` rồi `setLocale('en')` không sinh lỗi, không cần side effect bất đồng bộ. Nếu tận dụng `update()` có publish lại snapshot, chỉ tối ưu khi cần, tránh sửa persistence chung không liên quan.
- Việc callback của Context trả `void` không xóa semantics `createVisitorStore` khi write storage fail: snapshot vẫn cập nhật trong-memory; `storageError='unavailable'` cho consumer hiển thị thông báo sau này.
- Không tạo `IntlProvider`/translation dictionary/TanStack Query mới; đây là state contract, không phải bộ engine dịch UI.

### 3.2 Lifetime / nơi mount

```text
AppProviders (giữ nguyên)
└── BrowserRouter
    └── AppRouter
        ├── Public route group
        │   └── PublicLayout
        │       └── PublicLocaleProvider
        │           ├── Header + Footer
        │           └── Outlet: Home / Collection / Exhibit Detail / Tour
        └── Admin routes (ngoài PublicLocaleProvider)
```

**Đường đi cần bảo đảm:** `Home → Collection → Detail → Tour → Collection`; `/tour.html` phải có cùng cách đọc locale như `/tour`. Khi sang `/admin/login`, không giữ một provider bao quanh CMS. Khi trở lại public, provider phục hồi từ stored value; nếu storage bị chặn, thay đổi in-memory chỉ bảo đảm trong document/tab hiện tại chứ **không hứa** còn sau full reload.

### 3.3 State lifecycle & precedence

| Sự kiện | Locale kỳ vọng | Ghi chú |
|---|---|---|
| Tab mới, chưa có saved key | `vi` | Không auto-detect `navigator.language`. |
| Saved envelope v1 hợp lệ `{value:'en'}` | `en` | Giá trị được đọc/validate trước khi provider dùng. |
| Saved key JSON hỏng, unknown version hoặc `value='fr'` | `vi` | `storageError='invalid'`; không crash/không gọi API. |
| Browser từ chối `localStorage.getItem()` | `vi` | `storageError='unavailable'` và vẫn render public. |
| `setLocale('en')` khi storage bình thường | `en` | Persist v1; reload/route giữ `en`. |
| `setLocale('en')` khi `setItem()` bị chặn/quota | `en` trong tab hiện tại | `storageError='unavailable'`; full reload có thể về `vi`. |
| Tab khác lưu `vi` hợp lệ | Đọc `vi` ở tab hiện tại | Dùng listener có sẵn; phải tôn trọng dữ liệu local chưa save. |
| Tab khác xóa key / lưu giá trị hỏng | `vi` (nếu không có unsaved local) | Default và trạng thái lỗi phù hợp; không tạo vòng lặp write. |
| Chuyển page public bằng React Router | Giữ locale | Provider không unmount giữa sibling public routes. |
| Rời public sang admin | Không đổi Admin | Không sửa quyền, nội dung, auth hoặc route. |

**Bất biến:** mọi consumer public đọc cùng một snapshot; chỉ `vi/en`; không fetch mới hoặc reset room/exhibit/query khi đổi locale; không thay caption/audio trong PR này. Không can thiệp `document.documentElement.lang` cho đến khi có bản dịch UI tương ứng.

### 3.4 Tận dụng persistence hiện có, không mở rộng quá mức

- `createVisitorStore` đã hỗ trợ envelope `{ version: 1, value }`, `Zod`, `getSnapshot/subscribe/update`, `storage` event và in-memory fallback. Dùng trực tiếp, không cần localStorage utility mới.
- Có thể export **factory có injectable storage chỉ phục vụ unit test** nếu cần test integration contract mà không mock DOM trong Vitest Node. Cân nhắc phạm vi API nhỏ; không nhân đôi logic có sẵn.
- `aura:visitor:locale:v1` là một key riêng, không làm thay đổi dữ liệu favorites/notes/reading và không thực hiện migration tự phát.
- Không bắt buộc đồng bộ qua tab nếu browser khóa storage hoặc có unsaved local change: chính sách bảo toàn in-memory của store hiện có là nguồn sự thật.

### 3.5 Accessibility và tính đúng ngữ nghĩa

- Public vẫn là tiếng Việt sau khi state đổi thành `en`, vì phần dịch UI nằm ở feature kế tiếp. **Không tuyên bố website đa ngôn ngữ sau bước này.**
- Không thay `html[lang]`, `title`, `meta description`, accessible name, ARIA text, skip-link, keyboard focus hay room locale.
- Fixture kiểm thử có label rõ ràng cho control thử locale; không xuất hiện trên production UI.
- Việc chọn locale sau này chỉ được công bố hoàn thành khi UI và content/audio thực sự cùng ngôn ngữ, rồi mới cập nhật `html.lang`/accessible text.

## 4. File map và ownership

| File | Loại thay đổi | Trách nhiệm |
|---|---|---|
| `front-end/src/helpers/publicLocale.ts` | **ADD** | Schema, type, default, storage key, singleton store. |
| `front-end/src/helpers/publicLocale.test.ts` | **ADD** | Unit contract: allowed values, default, saved/invalid/unavailable; có thể dùng injectable storage. |
| `front-end/src/contexts/PublicLocaleContext.tsx` | **ADD** | Provider/context chỉ một owner, memoize value, gọi `useVisitorStore`. |
| `front-end/src/hooks/usePublicLocale.ts` | **ADD** | Hook consumer, guard khi ngoài Provider. |
| `front-end/src/layouts/PublicLayout.tsx` | **EDIT nhỏ** | Bọc layout hiện tại trong Provider, không đổi text/UI. |
| `front-end/tests/fixtures/public-locale.html` | **ADD** | Browser test-only HTML mount point trên Vite dev. |
| `front-end/tests/fixtures/public-locale.tsx` | **ADD** | Một component test-only dùng hook, hiển thị locale/status, nút đặt `vi/en`; không thêm route production. |
| `front-end/tests/public-locale.spec.ts` | **ADD** | Playwright fixture + route lifecycle, reload/tab/storage negative, isolation. |
| `docs/plans/public-locale-state-plan.md` | **ADD** | Plan và quyết định thiết kế. |
| `docs/tasks/public-locale-state.md` | **ADD/UPDATE** | Task, checkbox, acceptance, commit ledger và evidence thực thi. |

**Chỉ sửa `visitorPersistence.ts`, `useVisitorStore.ts` hoặc `AppProviders.tsx` khi có bug đã tái hiện và được review; không tự đưa vào phạm vi thông thường.**

## 5. Chiến lược triển khai, test và commit

Một feature = một PR vào `dev`, nhưng **nhiều commit độc lập** để dễ `git bisect`, review và revert từng phần. Không commit code lỗi, test đỏ hoặc log giả PASS.

| Task | Trọng tâm | Commit dự kiến | Gate trước commit |
|---|---|---|---|
| Task 0 | Baseline, branch, source audit, PLAN/TASK | `docs(locale): plan public locale state` | `git diff --check`; đối chiếu base; người dùng duyệt plan trước coding. |
| Task 1 | Schema, storage key + unit tests | `feat(locale): add validated public locale persistence` | Unit focused GREEN + typecheck. |
| Task 2 | Context, hook, browser fixture và hook tests | `feat(locale): expose public locale provider and hook` | Browser fixture GREEN + typecheck. |
| Task 3 | PublicLayout integration + route lifecycle specs | `feat(locale): scope locale state to public routes` | Public route specs GREEN, không lỗi admin. |
| Task 4 | Regression: reload/cross-tab/storage failures/StrictMode | `test(locale): cover locale persistence and lifecycle` | All focused/affected browser tests GREEN. |
| Task 5 | Full gates, evidence, PR summary, handoff | `docs(locale): record public locale verification` | Full frontend gates, diff scope, không ghi PASS nếu chưa run. |

**Phụ thuộc:** Task 0 → 1 → 2 → 3 → 4 → 5. Mỗi commit phải có một trách nhiệm rõ; không force push / squash trong quá trình debug trừ khi nhóm chủ động quyết định tại thời điểm review.

## 6. Test strategy

### Unit (`front-end/src/helpers/publicLocale.test.ts`, Node)

- Default `'vi'`; `vi/en` hợp lệ; `fr/ja/zh` hoặc unknown bị reject.
- Saved envelope hợp lệ `en` khôi phục; missing/JSON malformed/wrong version/wrong type về `vi`, có `storageError` phù hợp.
- `setLocale` khi write fail vẫn đổi snapshot in-memory; khi retry write thành công có thể persist.
- Bảo toàn contract `createVisitorStore` hiện hữu, không test implementation của React trong Node-only Vitest.

### Playwright (Vite dev, mock API ở các public routes khi cần)

- Fixture React render hook dưới provider: default, đổi `vi → en → vi`, không tạo hai nguồn state trong cùng cây.
- Fixture load với storage seeded bằng `page.addInitScript()` **trước** `page.goto`; reload khôi phục.
- Navigate thật qua `/`, `/collection`, `/collection/:roomSlug/exhibits/:exhibitId`, `/tour`, `/tour.html`; quay về fixture và xác nhận saved locale. Với các page public cần API, dùng fixtures `installMuseumApi` / `installMedia` đã có; không gọi DB/live backend.
- Hai `page` cùng `browserContext`: tab A đổi, tab B quan sát đổi qua storage event; `context.newPage()` không đủ nếu test không cùng origin — phải truy cập cùng origin trước.
- `page.addInitScript` chặn `localStorage` đọc/ghi: app không crash; trong fixture đổi locale vẫn hoạt động in-memory. Chạy thêm invalid envelope / `removeItem` nếu thực sự cần.
- Route Admin vẫn render và không bị locale provider áp vào; không động tới login/session. Test `strict` context fixture ở dev nếu xuất hiện duplicate render/listener, không sửa runtime unrelated.
- Không kiểm `html lang=en` trong bước này; kiểm nó **vẫn đúng với nội dung Việt hiện có**.

### Regression tối thiểu

Chạy focused `public-locale.spec.ts`; affected `collection.spec.ts`, `exhibit-detail.spec.ts`, `museum-tour.spec.ts`, `public-audio.spec.ts`, `public-report-modal.spec.ts` (các tên file trên `dev` đã xác nhận). Nếu thay đổi thực tế chỉ là wrapper, có thể nhóm kiểm theo ảnh hưởng và ghi rõ lý do loại/giảm; **không dùng kết quả PR cũ thay bằng chứng mới**.

## 7. Verification commands dự kiến

**Chạy từ `front-end/` (PowerShell Windows có thể thay `npm`/`npx` bằng `npm.cmd`/`npx.cmd`):**

```bash
npm ci  # chỉ nếu chưa cài dependency; không sửa lockfile tùy tiện
npm run test:unit -- src/helpers/publicLocale.test.ts
npx playwright test tests/public-locale.spec.ts --reporter=line
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/museum-tour.spec.ts tests/public-audio.spec.ts tests/public-report-modal.spec.ts --reporter=line
npm run typecheck
npm run lint
npm run test:unit
npm run build
git diff --check
```

- Fixture HTML ở `tests/fixtures/` chỉ có qua Vite dev; **unset** `PLAYWRIGHT_PREVIEW` và `MUSEUM_LIVE_TEST` khi chạy `public-locale.spec.ts`; không bắt các fixture tests chạy trên `npm run preview` vì hiện build không xuất entry test.
- Không bật `CI=1` nếu đang dùng Vite server chạy sẵn mà muốn Playwright reuse; nếu `CI=1`, Playwright sẽ tạo server riêng theo config. Không chạy nhiều instance chiếm cùng cổng 4173.
- Ghi số PASS/FAIL/SKIP, exit code, branch/SHA, OS/browser, thời gian và đường dẫn log/trace **sau** khi chạy thực tế. Các số liệu trong PLAN là kỳ vọng, không phải kết quả.

## 8. Acceptance / Definition of Done

| AC | Điều kiện bắt buộc |
|---|---|
| AC-01 | API dùng chung đúng `{ locale, setLocale, storageError }`; chỉ nhận `vi/en`; hook ngoài provider báo lỗi rõ. |
| AC-02 | Không có key hợp lệ → `vi`; persisted `en` → `en`; invalid/blocked storage fallback không crash. |
| AC-03 | Đổi locale bằng consumer trong fixture cập nhật mọi consumer và giữ trong tab hiện tại nếu storage write fail. |
| AC-04 | Cùng lựa chọn được giữ sau reload, route public, quay lại từ `/tour` và `/tour.html` khi storage hoạt động. |
| AC-05 | Hai tab cùng origin nhận storage change, không tạo listener/race ngoài cơ chế store hiện có. |
| AC-06 | Admin/CMS/Preview, auth, URL, dữ liệu room và UI hiện hành không thay đổi; không tự dịch chuỗi hoặc đổi media. |
| AC-07 | `html lang` không bị chuyển sai sang English khi nội dung còn tiếng Việt. |
| AC-08 | Unit, browser focused, affected regressions, typecheck, lint, build đều được chạy hoặc ghi NOT RUN/BLOCKED trung thực. |
| AC-09 | PLAN/TASK, commit ledger, evidence và PR summary đầy đủ; từng commit có ranh giới dễ revert/bisect. |

**Exit rule:** Chỉ ghi `DONE` sau khi AC-01–09 đã có bằng chứng. Nếu môi trường/browser blocked, ghi `BLOCKED/NOT RUN`, không suy diễn PASS. Không đánh đồng **locale state READY** với **UI đa ngôn ngữ READY**.

## 9. Review / rủi ro

- **Thiết kế chặn scope creep:** user interface vẫn tiếng Việt dù state `en`, nên product-visible switch không xuất hiện trong PR này.
- **Tính nhất quán:** không tạo cả React state riêng và localStorage state riêng. Provider subscribe trực tiếp snapshot singleton.
- **StrictMode / tab events:** cần kiểm tra có duplicate subscription, update sau unmount hay local-only unsaved state bị ghi đè không.
- **Storage blocked:** in-memory preference chỉ bảo đảm trong document hiện tại; không khẳng định persist xuyên reload.
- **Base branch thay đổi:** sau `git fetch`, nếu đã có provider/i18n khác, dừng so sánh và tái sử dụng; không triển khai trùng.
- **Browser fixture:** test helper tách khỏi app production, không thêm debug route hoặc data-testid chỉ để test toàn hệ thống.
- **Đường tiếp nối:** feature UI internationalization dùng `usePublicLocale()` để cập nhật labels và `html lang`; feature localized content/media dùng `locale` để chọn `vi/en` và giữ audio/transcript/WebVTT cùng phiên bản ngôn ngữ.
