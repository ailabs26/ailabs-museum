# Public UI Internationalization — Task Breakdown & Acceptance

> **Trạng thái:** LOCAL IMPLEMENTATION COMPLETE — branch `feat/public-ui-internationalization`; catalog đã nạp vào DB remote theo xác nhận của người dùng. DB không cô lập; TLS được mã hóa nhưng chứng chỉ chưa được xác thực theo CA. Không push/PR/merge theo yêu cầu.
> **PLAN:** [public-ui-internationalization-plan.md](../plans/public-ui-internationalization-plan.md)
> **Repository:** `ailabs26/ailabs-museum`; source audit `dev` `91f40e35a1cb17db7d72a841f8601df7a032d46b` (05/11/2026); trước khi code bắt buộc fetch lại.
> **Branch:** đề xuất `feat/public-ui-internationalization` → PR vào `dev` (không push/PR/merge tự động).

## 1. User story và outcome

Là khách tham quan, tôi muốn chọn ngôn ngữ trên giao diện công khai và thấy **các câu lệnh điều hướng, nút, trạng thái, hướng dẫn, modal** tương ứng với ngôn ngữ đó, để có thể khám phá Home, Collection, Exhibit Detail và Tour mà không gặp giao diện nửa tiếng Việt nửa tiếng Anh ở phần UI được triển khai.

**Bối cảnh:** PR #156 đã có Language Selector và bản dịch một phần từ CMS; PR #153 bổ sung persistence/state. Task này **hoàn thiện tích hợp, không xây lại từ đầu**. Dữ liệu hiện vật/audio/subtitle là scope các feature khác.

## 2. Functional requirements

| ID | Yêu cầu | Kỳ vọng |
|---|---|---|
| FR-01 | Sử dụng locale hiện có | Cùng `locale` và `t()` xuyên public routes, không có Provider thứ hai |
| FR-02 | Locale choices & persistence | `vi/en/fr/ja/zh` hợp lệ theo contract hiện có, key versioned vẫn tương thích |
| FR-03 | Dịch Public shell/Home | Header, Footer, hero, CTA, feature cards, featured states đúng bản dịch UI |
| FR-04 | Dịch Collection | Filter labels, search, counts, empty/loading/error, visitor controls và action labels đúng locale |
| FR-05 | Dịch Exhibit Detail | Breadcrumb/back, section headers, CTA, report labels và trạng thái UI đúng locale |
| FR-06 | Dịch Tour | Nút/nhãn/thông báo UI trong DOM và 3D/VR, không reset renderer hay selection |
| FR-07 | Shared media/report UI | Dịch labels, không đổi src/audio/subtitles hoặc payload report |
| FR-08 | CMS fallback | API chỉ trả `ui`; key chưa dịch/API lỗi fallback tiếng Việt, không lộ key/chuỗi dữ liệu unpublished |
| FR-09 | Accessibility/responsive | Hỗ trợ desktop, mobile 320px, keyboard và accessible labels khi đổi locale |
| FR-10 | Regression/handoff | Baseline, tests, logs, commit ledger và scope bảo toàn đầy đủ |

## 3. Non-functional requirements / constraints

- Không thêm dependency i18n, không thay data model/revision/publishing, không migration, không tự chạy seed trên DB chia sẻ.
- Một feature = một branch = một PR vào `dev`; mỗi commit chỉ thay phần liên quan, có test/checkpoint trước commit.
- Phải chạy lại baseline trên **HEAD mới**, không dùng kết quả test từ PR #153 hoặc #156 làm kết quả của lần triển khai này.
- Không viết thêm fixture debug route trong production. Không sao chép logic `localizeExhibit`, không tự dịch nội dung backend chưa công bố.
- Giữ nguyên behavior, focus, form values, API payload, WebGL/audio lifecycle; chỉ thay phần hiển thị và dữ liệu dịch trong scope.
- Nếu phụ thuộc CMS chưa seed, ghi rõ khả năng fallback và cách chuẩn bị dữ liệu; không tuyên bố có tiếng Anh hoàn chỉnh khi chưa có key.

## 4. Acceptance scenarios

| AC | Given / When | Then | Test đề xuất |
|---|---|---|---|
| AC-01 | Chạy test cũ sau khi PR locale đã merge | Assertions phù hợp contract hiện tại; không còn coi `fr` là invalid hoặc bắt `html.lang='vi'` khi chọn `en` | `public-locale.spec.ts` |
| AC-02 | Chọn `en` tại Home | Header, hero, CTA, featured states là tiếng Anh (với CMS fixture chứa đủ key) | `public-language.spec.ts` |
| AC-03 | Từ Home sang Collection và Detail | Nhãn UI, search/count/action/report đúng locale, giữ URL/selection | Public journey |
| AC-04 | Chuyển `en` trong `/tour` khi đang xem 3D | Labels/control đổi, không reset renderer hoặc mất selected exhibit | `museum-tour.spec.ts` + locale case |
| AC-05 | Chọn `ja/fr/zh` khi thiếu bản dịch | Lựa chọn được lưu, key thiếu fallback tiếng Việt; không lộ raw key | `public-language.spec.ts` |
| AC-06 | API translations chậm/lỗi/500 | Không trắng trang, không dùng bản dịch locale trước, UI có fallback | Network-controlled Playwright |
| AC-07 | Reload, multi-tab, từ public sang Admin | Locale khôi phục trong public; Admin không bị dịch/side effect | `public-locale.spec.ts` |
| AC-08 | 320px + keyboard + modal | Ô chọn ngôn ngữ dùng được; focus, accessible names và form hoạt động | Responsive/Modal tests |
| AC-09 | Chạy catalog seed hai lần trên DB được phê duyệt | Không sinh duplicate, không ghi đè bản dịch CMS được chỉnh; API chỉ category `ui` | Backend tests + kiểm tra DB/API |
| AC-10 | Full gates và diff scope | Có evidence và số PASS/FAIL/SKIP thực tế, không có tệp build/cache commit | Verification ledger |

### Acceptance evidence — 06/11/2026

| Scenario | Status | Evidence |
|---|---|---|
| AC-01 | PASS | `public-locale.spec.ts` 7/7; locale contract và `html.lang` sau đổi locale. |
| AC-02 | PASS | `public-language.spec.ts` 11/11; Home/shell English, API fixture mocked. |
| AC-03 | PASS | Journey vi → en: Home → Collection → Detail → Tour. |
| AC-04 | PASS | `museum-tour.spec.ts` 13/13; đổi locale trong scene không thay renderer. |
| AC-05 | PASS | Journey kiểm `ja/fr/zh` fallback tiếng Việt và không lộ `ui.*`. |
| AC-06 | PASS | Controlled slow response + API 500; fallback giữ nguyên khi chờ/lỗi. |
| AC-07 | PASS | `public-locale.spec.ts` kiểm reload, multi-tab và ranh giới Admin. |
| AC-08 | PASS | 320px/Drawer, keyboard, focus và `public-report-modal.spec.ts` 3/3. |
| AC-09 | PARTIAL | DB remote `postgres` được người dùng xác nhận quyền cập nhật. Parameterized catalog insert (không chạy seed runner) thêm 347 khóa ở lượt đầu và 0 ở lượt hai; API trả 348 khóa `ui` (có 1 khóa cũ ngoài catalog). Không có hàng cũ trùng namespace catalog để kiểm tra giá trị Admin đã sửa; DB không cô lập. TLS mã hóa, chứng chỉ không được xác thực theo CA. |
| AC-10 | PASS | Frontend/backend gates và suites liên quan PASS; diff/review được ghi ở Task 8. |

## 5. Task execution checklist (TDD + commit nhỏ)

### Task 0 — Baseline, đối chiếu source và chốt plan

**Mục tiêu:** Xác minh HEAD hiện tại, so sánh PR #153/#156 và tách lỗi trước feature với lỗi mới.

**Steps**

- [x] `git fetch origin`, kiểm tra `git status`, `git rev-parse origin/dev`, tạo `feat/public-ui-internationalization` từ HEAD mới nhất.
- [x] Đọc `AGENTS.md`, frontend conventions, `docs/tasks/public-translations.md`, PLAN/TASK Public Locale State và source liên quan.
- [x] Kiểm `publicLocaleStore`, `PublicLocaleProvider`, `usePublicLocale`, endpoint, seed, existing keys và `LanguageSelect` (không giả định vẫn đúng bản khảo sát).
- [x] Chạy baseline: frontend typecheck/lint/unit/build và Playwright `public-locale.spec.ts`, `public-language.spec.ts`; ghi môi trường, test counts, stderr và exit codes.
- [x] Inventory UI strings còn tiếng Việt theo từng screen/role/aria, chốt key `ui.*` và map seed. Phân biệt strings UI với room/exhibit/media.
- [x] Review PLAN/TASK để xác định điểm giao với code người khác trước khi sửa.

**Acceptance:** branch/base/evidence rõ; identified existing failures không bị che; không thay code ngoài docs.

**Baseline — 2026-11-05 (trước khi sửa code)**

- Branch/base: `feat/public-ui-internationalization` từ `origin/dev` `91f40e35a1cb17db7d72a841f8601df7a032d46b`; workspace chỉ có hai tài liệu PLAN/TASK mới ở trạng thái untracked.
- Môi trường: Windows PowerShell, Node `v22.23.2`, npm `10.9.8`, Playwright Chromium qua Edge mặc định; các API trong browser specs dùng fixture/mock.
- `npm.cmd run typecheck`: PASS, exit 0. `npm.cmd run lint`: PASS, exit 0.
- `npm.cmd run test:unit`: PASS, 45 files / 255 tests, exit 0.
- `npm.cmd run build`: PASS, exit 0; cảnh báo hiện hữu về chunk lớn hơn 500 kB.
- `npx.cmd playwright test tests/public-language.spec.ts --reporter=line --global-timeout=30000 --trace=off`: PASS, 4/4, exit 0.
- `npx.cmd playwright test tests/public-locale.spec.ts --reporter=line --global-timeout=60000 --trace=off`: 4 PASS / 3 FAIL, exit 1. Failures trước triển khai: test coi `fr` là invalid; route fixture render `PublicLayout` thiếu `QueryClientProvider`; test đòi `html.lang=vi` khi locale đã chọn là `en`. Ca cross-tab cuối cùng PASS.
- Source audit: shell đã có selector/provider/API translator; seed có 13 `ui.*` và dùng `orIgnore()`, endpoint public lọc category `ui`; Home, phần lớn Collection/visitor controls, Detail, shared report/audio labels và Tour/VR UI còn chuỗi tiếng Việt.

**Commit dự kiến:** `docs(i18n): plan public UI localization completion`.

### Task 1 — Khớp regression test với behavior sau merge

**Mục tiêu:** Chỉnh test bị cũ mà không làm lại một feature đã merge.

**Files:** `front-end/tests/public-locale.spec.ts`, `src/helpers/publicLocale.test.ts` nếu thật sự cần test thêm; production sửa **chỉ khi có lỗi tái hiện**.

**Steps**

- [x] Chạy case `fr` cũ: xác minh locale mới thuộc `LOCALES`, kỳ vọng valid; dùng `de` hoặc giá trị sai khác để test invalid fallback.
- [x] Sửa assertion `html.lang` trên routes public theo locale đã chọn, xác minh `/admin/login` reset về `vi` và app vẫn hiển thị nội dung hợp lệ.
- [x] Kiểm behavior key migration `aura:public-locale` → `aura:visitor:locale:v1` và refresh/multi-tab.
- [x] Chạy `public-language.spec.ts`, `public-locale.spec.ts`, unit, typecheck; phân loại failure thực nếu có.
- [x] Không phát hiện bug runtime cần production fix trong Task 1.

**Acceptance:** hai suite contract i18n có kết quả thực tế; không giới hạn về `vi/en` khi `LOCALES` đang cung cấp 5 locale.

**Commit dự kiến:** `test(i18n): align locale regression with merged behavior`.

**Verification:** `public-locale.spec.ts` PASS 7/7; `public-language.spec.ts` PASS 4/4 trước khi thêm test của Task 2; `test:unit` PASS 45 files / 255 tests; frontend typecheck PASS. Lượt chạy `public-locale.spec.ts` với timeout mỗi test 10 giây hết hạn ở lần chuyển route; chạy lại với timeout mặc định và global timeout 60 giây PASS 7/7.

### Task 2 — Public shell và Home

**Mục tiêu:** Các nhãn điều hướng, thông điệp giới thiệu, CTA và featured states có khóa dịch.

**Files:** `PublicLayout.tsx`, `HomePage.tsx`, `HomeFeaturedExhibits.tsx`; seed key tổng hợp ở Task 6.

**Steps**

- [x] Dịch header/footer/Drawer/nav, skip link, theme toggle và nhãn trợ năng; `ThemeToggle` vẫn mặc định dùng tiếng Việt ngoài public.
- [x] Dịch hero/badge/title/intro/CTA, section headings, feature cards và featured loading/empty/error/retry.
- [x] Giữ tên riêng và thông tin hiện vật trong showcase; chỉ dịch copy giao diện và dịch đúng nghĩa nội dung WCAG hiện có.
- [x] Mở rộng Playwright English fixture cho Home/shell; xác minh `vi` không fetch translation API và `en` render đúng nhãn.
- [x] Chạy affected tests `public-language`, navigation và responsive 320px.

**Acceptance:** Home + shell dùng tiếng Anh khi đủ key; không hardcode copy UI quan trọng; mobile 320px không tràn.

**Commit dự kiến:** `feat(i18n): complete public shell and home translations`.

**Verification:** `public-language.spec.ts` PASS 6/6 và `public-locale.spec.ts` PASS 7/7 (API fixture/mock); frontend typecheck PASS, lint PASS, unit PASS 45 files / 255 tests. Kịch bản Home và Collection ở 320px không tràn ngang; Drawer, theme toggle, navigation và footer dùng nhãn English fixture.

### Task 3 — Collection và visitor tools

**Mục tiêu:** Hoàn thiện giao diện Collection mà không đổi lọc/tìm kiếm/so sánh.

**Files:** `CollectionPage.tsx`, `pages/client/visitor/*`, shared `ExhibitGrid` nếu cần.

**Steps**

- [x] Dịch filter pill labels, search placeholder/aria-label, số lượng/tìm kiếm, empty/loading/error/retry và link sang Tour.
- [x] Dịch Favorites/Comparison/Global Search/Reading/Recently Viewed/Storage Status và các action labels trên cards.
- [x] Nội suy `{count}`/`{name}` trực tiếp tại nơi dùng, không tạo helper HTML; Playwright kiểm tra số đếm và tên động.
- [x] Giữ `localizeExhibit` và dùng lại cho tên hiện vật trong Recently Viewed; không tạo đường dịch CMS cho `exhibit/room` chưa kiểm duyệt.
- [x] Kiểm behavior Collection mặc định tiếng Việt, English fixture, favorites/comparison/search, URL, responsive và loading/failure; locator tiếng Việt mặc định vẫn hợp lệ.

**Acceptance:** UI Collection có copy `en` đầy đủ trong scope; behavior collection cũ giữ nguyên.

**Commit dự kiến:** `feat(i18n): translate collection and visitor UI`.

**Verification:** frontend `typecheck`, `lint`, `test:unit` PASS (45 files / 255 tests); `public-language.spec.ts` PASS 8/8 sau khi đồng bộ fixture English trước khi kiểm featured empty state; `collection.spec.ts` + `collection-global-search.spec.ts` PASS 17/17 trong lượt kết hợp. API browser fixtures đều mocked. `git diff --check` sạch. Suite kết hợp ban đầu có 24/25 do race trong Home English fixture; đã sửa bằng cách nạp locale từ trước khi khởi tạo app và xác nhận lại suite `public-language` PASS 8/8.

### Task 4 — Exhibit Detail, feedback và media labels

**Mục tiêu:** Dịch text giao diện nhưng không đổi audio/transcript/submit payload.

**Files:** `ExhibitDetailPage.tsx`, `PublicReportModal.tsx`, `AudioPlayer.tsx` và wrappers/props thực tế nếu cần.

**Steps**

- [x] Dịch breadcrumb, section header, form/action, error/empty/retry và aria-label trên trang Detail.
- [x] Dịch nhãn category, submit/cancel/error/success trong report modal; giữ **value category** và revision ID gửi API nguyên dạng.
- [x] Truyền `translate` dạng prop tùy chọn cho shared player/modal; mặc định tiếng Việt khi không có prop.
- [x] Dịch Play/Pause/Stop/captions/volume labels của AudioPlayer mà **không đổi** `src`, `subtitleUrl`, `audio.vi`, `currentTime` và track locale.
- [x] Test mở modal, chuyển locale khi đang nhập, submit đúng payload; audio đang phát tiếp tục phát mà không đổi nguồn hoặc reset thời điểm.

**Acceptance:** labels đổi theo locale, dữ liệu và media không thay đổi; shared usage không throw.

**Verification:** `npm.cmd run typecheck` PASS; `npm.cmd run lint` PASS; `git diff --check` PASS. Playwright command `npx.cmd playwright test tests/public-language.spec.ts tests/public-audio.spec.ts tests/public-report-modal.spec.ts tests/exhibit-detail.spec.ts --reporter=line --trace=off` PASS 38/38 (3m; API dùng fixture/mock); sau khi tăng ca audio từ paused sang actively playing, ca đó chạy lại riêng và PASS 1/1. Ca mới kiểm tra modal giữ category/message qua locale switch và payload giữ nguyên exhibit/revision/category; audio UI đổi tiếng Anh trong khi cùng phần tử audio tiếp tục phát và giữ nguyên `currentTime`, `src`, subtitle URL và `srclang`. Unit/build sẽ chạy ở Task 8.

**Commit dự kiến:** `feat(i18n): translate exhibit detail and feedback UI`.

### Task 5 — Tour DOM/3D/VR UI copy

**Mục tiêu:** Các nút/nhãn/hướng dẫn và trạng thái Tour theo locale, không thay state của tour/renderer.

**Files:** `MuseumPage.tsx`, `components/museum/{ImmersiveTour,MuseumCatalogue,ExhibitDetailPanel,SceneFallback,MuseumLoading,XrDetailsPanel,...}.tsx` chọn lọc sau inventory.

**Steps**

- [x] Dịch CTA mở 3D, room selector label, overlay exit, catalogue, selection, empty/error/loading/retry và hướng dẫn điều khiển.
- [x] Dịch DOM label của điều khiển 3D, hotspot controls và các panel; với UI VR CanvasTexture, truyền copy qua props từ owner, tránh gọi hook trong Three canvas/low-level objects không đúng nơi.
- [x] Không động vào geometry/camera/movement, load model, URL/query/exhibit IDs, Tour reducer (chưa có) hoặc XR session lifecycle.
- [x] Test đổi locale khi scene đang mở, modal/fallback/close, keyboard Escape, renderer không bị remount ngoài ý muốn.

**Acceptance:** Tour UI đổi theo locale nhưng runtime 3D/2D không regress; không nhầm với Guided Tour điều khiển tự động.

**Commit dự kiến:** `feat(i18n): translate tour interface controls`.

**Verification:** frontend typecheck PASS (`npm run build` chạy `tsc -b` trước Vite), lint PASS, build PASS (Vite báo chunk lớn nhất vượt ngưỡng 500 kB). `museum-tour.spec.ts` PASS 13/13; ca locale trong scene xác nhận EN → JA fallback tiếng Việt, UI/aria đổi theo locale, canvas và renderer giữ nguyên. `museum-fullscreen.spec.ts` PASS 8/8. Một lượt kết hợp ban đầu có 4 timeout WebGL ở suite fullscreen; chạy lại suite riêng PASS 8/8. Targeted report-modal case assertions PASS, nhưng Playwright runner kết thúc với timeout teardown của plugin harness sau khi test qua; không phải assertion failure. API browser tests dùng fixture/mock. `git diff --check` sạch.

### Task 6 — Đăng ký bản dịch UI trong CMS seed

**Mục tiêu:** Những key dùng mới có giá trị `vi/en` trong môi trường vận hành mà không đè Admin.

**Files:** `back-end/src/database/seeds/seed.ts`, test liên quan `modules/translations/tests/*` nếu cần.

**Steps**

- [x] Kiểm kê 331 key tham chiếu tĩnh và bổ sung 7 key report được tạo động cùng 9 key ghi công media; tổng 347 hàng, không trùng và đều có consumer public.
- [x] Thêm 334 cặp `vi/en`, giữ nguyên 13 hàng seed cũ và dùng `orIgnore()` hiện có.
- [x] Dùng parameterized catalog insert hai lần vào DB remote đã được người dùng cho phép: lượt đầu thêm 347 khóa, lượt hai thêm 0; không chạy seed runner, migration hoặc seed tổng thể. DB không cô lập; không có hàng catalog cũ để kiểm tra bản dịch Admin đã chỉnh.
- [x] Endpoint tests xác nhận chỉ trả `ui`, không tiết lộ `exhibit/room`, và giữ validation 400.
- [x] Backend typecheck/lint/build và tests liên quan PASS; không chạy migration hoặc seed tổng thể.

**Acceptance:** có bản dịch tiếng Anh cho toàn bộ UI keys trong scope và không overwrite CMS.

**Commit dự kiến:** `feat(i18n): seed remaining public UI strings`.

**Verification:** Static inventory ghi nhận 331 key tham chiếu; regression test xác nhận thêm 7 key report động và 9 key ghi công media (347 hàng tổng), mọi hàng có `vi/en`. `test:translations` 11/11; `test:seed` 11/11; backend typecheck/lint/build PASS. Sau xác nhận của người dùng, parameterized catalog-only SQL insert thêm 347 hàng thiếu vào DB remote `postgres` qua TLS được mã hóa; lượt thứ hai thêm 0. Không chạy seed runner. API local trả 348 khóa `ui` (1 khóa cũ nằm ngoài catalog). Không có hàng cũ nào trùng namespace catalog, nên không có bản dịch Admin đã sửa để kiểm thử bảo toàn. Chứng chỉ TLS không được xác thực theo CA; không sửa `.env` và không chạy migration/seed tổng thể.

### Task 7 — Integration/Playwright regression

**Mục tiêu:** Nghiệm thu end-to-end cho chuyển ngôn ngữ UI thay vì chỉ test từng component.

**Files:** `front-end/tests/public-language.spec.ts`, relevant `public-*.spec.ts`, `collection`, `exhibit-detail`, `museum-tour`, `public-audio`, `public-report-modal`.

**Steps**

- [x] Hành trình `vi → en`: Home → Collection → Detail → Tour; kiểm heading/CTA/locale.
- [x] Hành trình `en → ja/fr/zh → vi`: locale có sẵn vẫn hiện, key thiếu fallback tiếng Việt, không hiện `ui.*` raw.
- [x] API slow/500, reload, multi-tab, 320px Drawer/keyboard, admin boundary, focus/modal behavior.
- [x] Regression audio (không tự phát/không reset source), report payload, favorites/comparison, route/URL và Tour renderer.
- [x] Reuse fixture hiện có và ghi rõ browser API dùng mock.

**Acceptance:** tests mới/affected chạy đủ; mọi fail được phân loại (regression/fixture/environment), không chỉ kiểm compile.

**Commit dự kiến:** `test(i18n): cover public language switching journeys`.

**Verification:** Trước follow-up review, `public-language.spec.ts` 11/11; `public-locale.spec.ts` 7/7; `collection.spec.ts` + `exhibit-detail.spec.ts` + `public-audio.spec.ts` 40/40; `public-report-modal.spec.ts` 3/3; `museum-tour.spec.ts` 13/13; `museum-fullscreen.spec.ts` 8/8 (Task 5). Sau khi bổ sung key còn thiếu và sửa callback động, chạy lại 3 ca browser liên quan (journey, media credits, Collection search `$&`) và ca locale canvas trong Tour; cả 4 ca PASS. Sau DB update, mở app tại `http://localhost:5173`, chọn English và xác nhận Home/shell/nhãn ảnh dịch thật qua API local; nội dung phòng/hiện vật giữ tiếng Việt theo scope. API browser của các spec vẫn mocked. Playwright runner giữ tiến trình sau khi in kết quả PASS; đã ngắt bước teardown, không có assertion failure.

### Task 8 — Verification, review và bàn giao local

**Mục tiêu:** Chốt bằng chứng thực tế, diff đã review và lịch sử commit dễ bisect.

**Steps**

- [x] Chạy frontend typecheck/lint/unit/build và focused/affected Playwright; backend typecheck/lint/build và tests liên quan.
- [x] `git diff --check` và rà file change; không commit `dist`, `test-results`, screenshot/log, credentials, DB dumps.
- [x] Ghi trạng thái thực tế cho 10 acceptance scenarios; AC-09 là PARTIAL.
- [x] Ghi source SHA, working OS/browser, lệnh/count và giới hạn chưa làm.
- [x] Giữ title PR tiếng Việt đã đề xuất trong task; không push/PR/merge theo yêu cầu.

**Acceptance:** tài liệu phản ánh kết quả thực tế; code chỉ trong scope, có file map và commit ledger.

**Commit dự kiến:** `docs(i18n): record UI localization verification`.

## 6. Verification commands & evidence matrix

**Frontend — chạy từ `front-end/`:**

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx playwright test tests/public-locale.spec.ts tests/public-language.spec.ts --reporter=line
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/public-report-modal.spec.ts tests/public-audio.spec.ts tests/museum-tour.spec.ts --reporter=line
```

**Backend (chỉ khi có thay đổi backend/seed) — chạy từ `back-end/`:**

```bash
npm run typecheck
npm run lint
npm run build
# Chọn test runner/flags từ package.json thực tế; không tự chạy seed trên DB dùng chung.
```

| Gate | Dự kiến kiểm | Kết quả hiện tại | Evidence / Log |
|---|---|---|---|
| Frontend typecheck | 0 lỗi | PASS | `npm.cmd run typecheck`, exit 0 |
| Frontend lint | 0 lỗi mới | PASS | `npm.cmd run lint`, exit 0 |
| Frontend unit | All relevant PASS | PASS | `npm.cmd run test:unit`, 45 files / 255 tests |
| Frontend build | exit 0 | PASS | `npm.cmd run build`, exit 0; Vite chunk >500 kB warning |
| Playwright locale + language | All PASS | PASS | Full earlier run: `public-language.spec.ts` 11/11, `public-locale.spec.ts` 7/7. Post-review: journey, media-credit and Collection `$&` cases PASS; mocked API. |
| Playwright affected public/tour/media | All PASS | PASS | Earlier suites: collection/detail/audio 40/40; report 3/3; museum-tour 13/13; fullscreen 8/8. Post-review canvas locale case 1/1 PASS. Playwright reported PASS, then required interruption during harness teardown. |
| Backend typecheck/lint/build | 0 errors | PASS | From `back-end/`: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, all exit 0 |
| Backend translation/seed unit tests | Relevant PASS | PASS | From `back-end/`: `npm.cmd run test:translations` 11/11; `npm.cmd run test:seed` 11/11 |
| Public UI catalog DB write | Insert twice; inspect API | PASS WITH LIMITS | Configured remote DB `postgres`, user-approved; targeted parameterized SQL insert (not seed runner) added 347 on pass 1, 0 on pass 2; API returns 348 keys including 1 legacy key. No matching old catalog rows; edited Admin-value preservation not exercised. No migration/full seed. TLS encrypted; certificate validation unavailable. |
| Diff/review scope | No unintended changes | PASS | `git diff --check` sạch; reviewer findings đã sửa, frontend lint và targeted regressions PASS; không push/PR/merge |

**Nguyên tắc:** không ghi số lượng test dự đoán, không tuyên bố `PASS` dựa trên ledger lịch sử của các PR đã merge. Khi dùng Playwright fixture, ghi rõ API/mock; không thay bằng kiểm thử live DB.

**Môi trường:** Windows PowerShell; Playwright `chromium` qua channel mặc định `msedge` với SwiftShader. Các Playwright specs dùng API mock; smoke check thật chạy tại `localhost:5173` qua API local đến DB remote đã được người dùng cho phép. TLS được mã hóa nhưng certificate không được xác thực. Source/base SHA: `91f40e35a1cb17db7d72a841f8601df7a032d46b`.

## 7. Commit ledger (điền khi thực thi)

| Task | Commit dự kiến | SHA thực tế | Verification | Trạng thái |
|---|---|---|---|---|
| 0 | `docs(i18n): plan public UI localization completion` | `263f11d` | Baseline recorded above | DONE |
| 1 | `test(i18n): align locale regression with merged behavior` | `4182d24` | `public-locale` 7/7, `public-language` 4/4, unit 255/255, typecheck PASS | DONE |
| 2 | `feat(i18n): complete public shell and home translations` | `5c423077c738850723e1cab855f91428e342d9e0` | `public-language` 6/6, `public-locale` 7/7, unit 255/255, typecheck/lint PASS | DONE |
| 3 | `feat(i18n): translate collection and visitor UI` | `a856ea0d3af55d67db831bfd3ab1d2d9c3fb1ad2` | `public-language` 8/8; collection 14/14; global search 3/3; unit 255/255; typecheck/lint PASS | DONE |
| 4 | `feat(i18n): translate exhibit detail and feedback UI` | `53176aec0a1fa2a77575772ead85cbc0fe86ae8e` | `public-language` + `public-audio` + `public-report-modal` + `exhibit-detail` 38/38; typecheck/lint PASS | DONE |
| 5 | `feat(i18n): translate tour interface controls` | `fb2561051cced714a9cd356564ee7452e7038189` | `museum-tour` 13/13, `museum-fullscreen` 8/8; typecheck/lint/build PASS | DONE |
| 6 | `feat(i18n): seed remaining public UI strings` | `733f6fa322b7bcedb0a1068baad108b5dcf0af9b` | 331 static + 16 report/media-credit keys; backend gates PASS; configured remote DB: 347 added, second pass 0; API returns 348 `ui` keys; no old catalog rows matched | DONE WITH LIMITS |
| 7 | `test(i18n): cover public language switching journeys` | `818c64d6d634004cdbabaf84f955cb0b0122c5cd` | Earlier suites pass; post-review browser regressions 4/4; API mocked | DONE |
| Review follow-up | `fix(i18n): complete missing public UI translations` | `a2ef105` | Seed keys and media/ARIA fallbacks; front-end and back-end gates PASS; focused browser regressions 4/4 | DONE |
| 8 | `docs(i18n): record UI localization verification` | local docs commit; see git history | AC-01..08, AC-10 PASS; AC-09 PARTIAL; no PR/push/merge | DONE |

## 8. Definition of Done và bàn giao

- [x] `AC-01` đến `AC-08` và `AC-10` PASS; `AC-09` PARTIAL vì target DB remote không cô lập và không có hàng cũ để xác minh preservation bản dịch Admin đã chỉnh.
- [x] Toàn bộ giao diện Public trong scope có tiếng Việt và tiếng Anh; `fr/ja/zh` fallback an toàn.
- [x] Shared components không yêu cầu Public Provider khi render trong Admin/fixture.
- [x] Không đổi nguồn audio, track phụ đề, transcript, Guided Tour, published data hay migration.
- [x] API công khai chỉ trả category `ui`; endpoint tests xác nhận `exhibit/room` không lộ.
- [x] Idempotency của parameterized catalog insert đã xác minh trên DB remote được người dùng cho phép: 347 hàng thêm, lượt hai 0. Seed runner không chạy; không có namespace cũ trùng catalog để kiểm tra Admin edits.
- [x] Browser/Unit/Typecheck/Lint/Build có kết quả thực; smoke check thật xác nhận English UI sau khi nạp DB.
- [x] Commit theo task; PR title và known limitations đã ghi; chưa tạo PR theo yêu cầu.

**PR title đề xuất khi hoàn thành:** `feat(i18n): hoàn thiện bản dịch giao diện khách tham quan`

**Known limitations cần giữ trong PR:** bản dịch tên/mô tả phòng hiện chưa có trong data model; media/audio/subtitle chưa đổi theo locale; bản dịch `fr/ja/zh` phụ thuộc dữ liệu CMS; chưa triển khai Guided Tour Controller.
