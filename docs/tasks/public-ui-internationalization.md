# Public UI Internationalization — Task Breakdown & Acceptance

> **Trạng thái:** IN PROGRESS — branch `feat/public-ui-internationalization`; baseline đã chạy, chưa tạo PR.
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
| AC-09 | Chạy seed hai lần trên DB cô lập | Không sinh duplicate, không ghi đè bản dịch CMS được chỉnh; API chỉ category `ui` | Backend tests |
| AC-10 | Full gates và diff scope | Có evidence và số PASS/FAIL/SKIP thực tế, không có tệp build/cache commit | Verification ledger |

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

- [ ] Bỏ sót còn lại ở header/footer/Drawer/nav labels, icon aria-label/status, `ThemeToggle` khi dùng tại public (không làm hỏng Admin).
- [ ] Dịch hero/badge/title/intro/CTA, section headings, feature cards và featured loading/empty/error/retry.
- [ ] Không đổi tên riêng của hiện vật hoặc tuyên bố WCAG/media thành bằng chứng tính năng; dịch đúng nghĩa bản copy hiện có.
- [ ] Add Playwright fixture English đầy đủ cho Home, khẳng định `vi` không fetch translation API và `en` render đúng nhãn.
- [ ] Chạy affected tests `public-language`, homepage, navigation/responsive (các tên spec cần xác minh từ HEAD).

**Acceptance:** Home + shell dùng tiếng Anh khi đủ key; không hardcode copy UI quan trọng; mobile 320px không tràn.

**Commit dự kiến:** `feat(i18n): complete public shell and home translations`.

### Task 3 — Collection và visitor tools

**Mục tiêu:** Hoàn thiện giao diện Collection mà không đổi lọc/tìm kiếm/so sánh.

**Files:** `CollectionPage.tsx`, `pages/client/visitor/*`, shared `ExhibitGrid` nếu cần.

**Steps**

- [ ] Dịch filter pill labels, search placeholder/aria-label, số lượng/tìm kiếm, empty/loading/error/retry và link sang Tour.
- [ ] Dịch Favorites/Comparison/Global Search/Reading/Recently Viewed/Storage Status và các action labels trên cards.
- [ ] Thêm phương án nội suy `{count}`/`{name}` nếu cần; viết unit test chuỗi chứa biến, không dùng HTML interpolation.
- [ ] Giữ `localizeExhibit` (đã có) để tên/mô tả revision được xuất bản; không tạo đường dịch CMS cho `exhibit/room` chưa kiểm duyệt.
- [ ] Test locale switch với query, favorites, sorting, URL và loading/failure, không gãy locator tiếng Việt trong locale mặc định.

**Acceptance:** UI Collection có copy `en` đầy đủ trong scope; behavior collection cũ giữ nguyên.

**Commit dự kiến:** `feat(i18n): translate collection and visitor UI`.

### Task 4 — Exhibit Detail, feedback và media labels

**Mục tiêu:** Dịch text giao diện nhưng không đổi audio/transcript/submit payload.

**Files:** `ExhibitDetailPage.tsx`, `PublicReportModal.tsx`, `AudioPlayer.tsx` và wrappers/props thực tế nếu cần.

**Steps**

- [ ] Dịch breadcrumb, section header, form/action, error/empty/retry và aria-label trên trang Detail.
- [ ] Dịch nhãn category, submit/cancel/error/success trong report modal; giữ **value category** và revision ID gửi API nguyên dạng.
- [ ] Truyền `labels`/`t` dạng prop tùy chọn cho shared player/modal nếu đang được dùng ngoài Public; không bắt buộc public hook ở Admin.
- [ ] Dịch Play/Pause/Stop/captions/volume labels của AudioPlayer mà **không đổi** `src`, `subtitleUrl`, `audio.vi`, `currentTime` và track locale.
- [ ] Test mở modal, chuyển locale khi đang nhập, submit đúng payload; audio đang phát không bị reset chỉ vì text UI đổi.

**Acceptance:** labels đổi theo locale, dữ liệu và media không thay đổi; shared usage không throw.

**Commit dự kiến:** `feat(i18n): translate exhibit detail and feedback UI`.

### Task 5 — Tour DOM/3D/VR UI copy

**Mục tiêu:** Các nút/nhãn/hướng dẫn và trạng thái Tour theo locale, không thay state của tour/renderer.

**Files:** `MuseumPage.tsx`, `components/museum/{ImmersiveTour,MuseumCatalogue,ExhibitDetailPanel,SceneFallback,MuseumLoading,XrDetailsPanel,...}.tsx` chọn lọc sau inventory.

**Steps**

- [ ] Dịch CTA mở 3D, room selector label, overlay exit, catalogue, selection, empty/error/loading/retry và hướng dẫn điều khiển.
- [ ] Dịch DOM label của điều khiển 3D, hotspot controls và các panel; với UI VR CanvasTexture, truyền copy qua props từ owner, tránh gọi hook trong Three canvas/low-level objects không đúng nơi.
- [ ] Không động vào geometry/camera/movement, load model, URL/query/exhibit IDs, Tour reducer (chưa có) hoặc XR session lifecycle.
- [ ] Test đổi locale khi scene đang mở, modal/fallback/close, keyboard Escape, renderer không bị remount ngoài ý muốn.

**Acceptance:** Tour UI đổi theo locale nhưng runtime 3D/2D không regress; không nhầm với Guided Tour điều khiển tự động.

**Commit dự kiến:** `feat(i18n): translate tour interface controls`.

### Task 6 — Đăng ký bản dịch UI trong CMS seed

**Mục tiêu:** Những key dùng mới có giá trị `vi/en` trong môi trường vận hành mà không đè Admin.

**Files:** `back-end/src/database/seeds/seed.ts`, test liên quan `modules/translations/tests/*` nếu cần.

**Steps**

- [ ] Liệt kê key UI sử dụng ở các task 2–5, loại bỏ key trùng/không có consumer, bảo đảm category `ui`.
- [ ] Thêm cặp `vi/en` cho các key mới, dùng `orIgnore()` hiện có; không update những record Admin đã sửa.
- [ ] Test seed chạy hai lần trên **DB cô lập được phép**, kiểm bản dịch Admin còn nguyên; không viết migration.
- [ ] Test endpoint `/public/translations?locale=en` chỉ trả `ui` và không tiết lộ data unpublished; phản hồi lỗi/validation giữ nguyên.
- [ ] Backend typecheck/lint/build và tests liên quan; ghi rõ seed trên DB nào và lệnh, không chạy vào môi trường dùng chung khi chưa được phê duyệt.

**Acceptance:** có bản dịch tiếng Anh cho toàn bộ UI keys trong scope và không overwrite CMS.

**Commit dự kiến:** `feat(i18n): seed remaining public UI strings`.

### Task 7 — Integration/Playwright regression

**Mục tiêu:** Nghiệm thu end-to-end cho chuyển ngôn ngữ UI thay vì chỉ test từng component.

**Files:** `front-end/tests/public-language.spec.ts`, relevant `public-*.spec.ts`, `collection`, `exhibit-detail`, `museum-tour`, `public-audio`, `public-report-modal`.

**Steps**

- [ ] Hành trình `vi → en`: Home → Collection → Detail → Tour; kiểm cả nhãn, heading, placeholder, aria, error/retry.
- [ ] Hành trình `en → ja/fr/zh → vi`: dịch có sẵn thì hiện, key thiếu fallback tiếng Việt, không hiện `ui.*` raw.
- [ ] API slow/500, reload, multi-tab, 320px Drawer/keyboard, admin boundary, focus/modal behavior.
- [ ] Regression audio (không tự phát/không reset source), report payload, favorites/comparison, route/URL và Tour/GLB rendering.
- [ ] Ưu tiên reuse fixture đã có, không viết lại tests không liên quan; ghi mocked vs live trung thực.

**Acceptance:** tests mới/affected chạy đủ; mọi fail được phân loại (regression/fixture/environment), không chỉ kiểm compile.

**Commit dự kiến:** `test(i18n): cover public language switching journeys`.

### Task 8 — Verification, review và PR handoff

**Mục tiêu:** Bàn giao bằng chứng đầy đủ và lịch sử commit dễ bisect.

**Steps**

- [ ] Chạy frontend typecheck/lint/unit/build và focused/affected Playwright; backend gates nếu đã sửa seed.
- [ ] `git diff --check` và rà file change; không commit `dist`, `test-results`, screenshot/log, credentials, DB dumps.
- [ ] Kiểm 10 acceptance scenarios có evidence và cập nhật trạng thái đúng `PASS/FAIL/BLOCKED/NOT RUN`.
- [ ] Ghi source SHA, working OS/browser, command, count/exit, commit SHA và giới hạn chưa làm.
- [ ] Chuẩn bị title/description PR tiếng Việt; không push/PR/merge khi chưa được yêu cầu.

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
| Frontend typecheck | 0 lỗi | BASELINE PASS | `npm.cmd run typecheck`, exit 0 |
| Frontend lint | 0 lỗi mới | BASELINE PASS | `npm.cmd run lint`, exit 0 |
| Frontend unit | All relevant PASS | BASELINE PASS | `npm.cmd run test:unit`, 45 files / 255 tests |
| Frontend build | exit 0 | BASELINE PASS | `npm.cmd run build`, exit 0; chunk >500 kB warning |
| Playwright locale + language | All PASS | BASELINE RED | language 4/4; locale 4/7, 3 stale/fixture failures listed above |
| Playwright affected public/tour/media | All PASS | NOT RUN | Chưa triển khai |
| Backend tests/seed (nếu thay đổi) | All relevant PASS | NOT RUN | Chưa triển khai |
| Diff/PR scope | No unintended changes | NOT RUN | Chưa triển khai |

**Nguyên tắc:** không ghi số lượng test dự đoán, không tuyên bố `PASS` dựa trên ledger lịch sử của các PR đã merge. Khi dùng Playwright fixture, ghi rõ API/mock; không thay bằng kiểm thử live DB.

## 7. Commit ledger (điền khi thực thi)

| Task | Commit dự kiến | SHA thực tế | Verification | Trạng thái |
|---|---|---|---|---|
| 0 | `docs(i18n): plan public UI localization completion` | `263f11d` | Baseline recorded above | DONE |
| 1 | `test(i18n): align locale regression with merged behavior` | pending | `public-locale` 7/7, `public-language` 4/4, unit 255/255, typecheck PASS | DONE |
| 2 | `feat(i18n): complete public shell and home translations` | — | — | NOT STARTED |
| 3 | `feat(i18n): translate collection and visitor UI` | — | — | NOT STARTED |
| 4 | `feat(i18n): translate exhibit detail and feedback UI` | — | — | NOT STARTED |
| 5 | `feat(i18n): translate tour interface controls` | — | — | NOT STARTED |
| 6 | `feat(i18n): seed remaining public UI strings` | — | — | NOT STARTED |
| 7 | `test(i18n): cover public language switching journeys` | — | — | NOT STARTED |
| 8 | `docs(i18n): record UI localization verification` | — | — | NOT STARTED |

## 8. Definition of Done và bàn giao

- [ ] `FR-01` đến `FR-10`, `AC-01` đến `AC-10` đã có bằng chứng kiểm chứng và không có lỗi blocker chưa xử lý.
- [ ] Toàn bộ giao diện Public trong scope có bản tiếng Việt gốc và bản dịch tiếng Anh khi CMS có đủ key; fallback cho `fr/ja/zh` an toàn.
- [ ] Phần dùng chung không yêu cầu Public Provider khi render trong Admin/fixture.
- [ ] Không thay đổi nguồn audio, track phụ đề, transcript, Guided Tour, published data hoặc database migration.
- [ ] API công khai không trả bản dịch thuộc category `exhibit`/`room` chưa qua publication.
- [ ] Backend seed idempotent, không đè bản dịch của người quản trị.
- [ ] Browser/Unit/Typecheck/Lint/Build và mọi gate liên quan có kết quả thực, ghi lại đầy đủ.
- [ ] Từng commit có mục đích rõ ràng; PR mô tả cả phạm vi và known limitations.

**PR title đề xuất khi hoàn thành:** `feat(i18n): hoàn thiện bản dịch giao diện khách tham quan`

**Known limitations cần giữ trong PR:** bản dịch tên/mô tả phòng hiện chưa có trong data model; media/audio/subtitle chưa đổi theo locale; bản dịch `fr/ja/zh` phụ thuộc dữ liệu CMS; chưa triển khai Guided Tour Controller.
