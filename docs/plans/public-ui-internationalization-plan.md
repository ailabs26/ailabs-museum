# Public UI Internationalization — Implementation Plan

> **Trạng thái:** PR #161 đang mở trên nhánh `feat/public-ui-internationalization`; đã push, chưa merge. Catalog đã nạp vào DB remote theo xác nhận của người dùng; DB không cô lập và chứng chỉ TLS chưa được xác thực theo CA.
> **Task / Acceptance:** [public-ui-internationalization.md](../tasks/public-ui-internationalization.md)

**Repository:** `ailabs26/ailabs-museum`
**Baseline đã kiểm tra:** nhánh `dev` tại `91f40e35a1cb17db7d72a841f8601df7a032d46b` (05/11/2026). Luôn `git fetch origin` và chốt SHA mới trước khi triển khai.
**Branch:** `feat/public-ui-internationalization` từ `origin/dev`; PR #161 vào `dev` đã mở theo yêu cầu.
**Stack:** React 18, TypeScript, Mantine 7, TanStack Query, NestJS/TypeORM seed hiện có, Vitest, Playwright. Không bổ sung thư viện i18n khác.
**Goal:** Hoàn thiện **dịch chuỗi giao diện khách tham quan**, tận dụng dịch vụ CMS và Language Selector đã có, đảm bảo các trang công khai chính dùng đúng bản dịch, có fallback an toàn, không làm thay đổi nội dung hiện vật/audio ngoài phạm vi.

**Architecture:** Tái sử dụng `PublicLocaleProvider` và `usePublicLocale()` từ `src/core/i18n/public-locale.tsx`, `publicLocaleStore`, `GET /public/translations?locale=`, và các chuỗi CMS thuộc category `ui`. Không tạo context, kho lưu trữ, thư viện dịch hoặc endpoint thứ hai. Các component dùng chung với CMS không được phụ thuộc bắt buộc vào public context.

---

## 1. Mục tiêu, phạm vi và quy tắc bàn giao

### Trong phạm vi

1. **Chốt hành vi sau merge:** rà soát test/contract trên HEAD mới: nguồn ngôn ngữ UI hiện là `vi/en/fr/ja/zh`; `PublicLocaleStore` đã tương thích `LOCALES` và có migration cho key cũ. Sửa kỳ vọng test lỗi thời, không sửa ngược code hợp lệ để chiều test.
2. **UI copy:** dịch các nhãn tĩnh, tiêu đề, CTA, nút, tooltip/aria-label, modal, empty/loading/error state của các trang Public: Home, Collection, Exhibit Detail và Tour (DOM/3D shell/VR controls trong phạm vi UI). Giữ chính xác tên riêng, UUID, URL và giá trị người dùng nhập.
3. **Bản dịch CMS:** đăng ký thêm `ui.*` theo đúng API public đã có; bổ sung `vi/en` cho các key UI mới bằng seed idempotent, bảo toàn nội dung Admin đã sửa. Locale `fr/ja/zh` vẫn là lựa chọn hợp lệ, dùng bản dịch nếu CMS có, fallback tiếng Việt nếu thiếu.
4. **Phần dùng chung:** dịch nhãn hiển thị của media player, report modal, favorites/comparison/reading controls, và các trạng thái khách thấy; giữ behavior/playback/focus nguyên trạng.
5. **QA:** kiểm vi/en trên các trang chính, fallback với locale chưa đủ dịch, reload, multi-tab, 320px, API lỗi/chậm, report/audio/tour regression và không ảnh hưởng CMS.

### Ngoài phạm vi

- Không tạo Guided Tour state/controller hoặc thay đổi luồng tour Manual/Auto.
- Không chọn bản thuyết minh, track audio, transcript hay WebVTT theo locale; thuộc feature multilingual media tiếp theo. **Được dịch nhãn điều khiển AudioPlayer**, không thay đổi nguồn audio.
- Không mở rộng data model `rooms` để dịch tên/mô tả phòng; không sửa publish/revision, CMS editor hoặc nội dung exhibit đã xuất bản. `localizeExhibit` đã có được giữ nguyên, không làm lại.
- Không dịch nội dung người dùng, nội dung do backend trả tự do (`error.message` không có mã ổn định), hoặc toàn bộ hệ thống Admin.
- Không thay DB schema/migration; không truy cập DB dùng chung hoặc chạy seed vào môi trường thật khi chưa được phê duyệt. Trong follow-up này, người dùng đã cho phép chèn riêng catalog vào DB remote; không chạy migration hoặc seed tổng thể.
- Không đưa thêm thư viện i18n, event bus, global store hay test debug panel vào production.

## 2. Source audit trên `dev` (đã đọc mã nguồn, chưa chạy test mới)

| Thành phần | Hiện trạng xác nhận | Hướng xử lý |
|---|---|---|
| `src/helpers/publicLocale.ts` | Hỗ trợ danh sách `LOCALES` gồm `vi/en/fr/ja/zh`, lưu versioned key, migrate key cũ | Giữ nguồn state hiện có, kiểm không phát sinh duplicate owner |
| `src/core/i18n/public-locale.tsx` | Provider lồng stored-provider, gọi API bản dịch `ui` qua React Query; `t(key, fallback)`, cập nhật `html.lang` | Tái sử dụng, chỉ harden nếu có bug tái hiện |
| `src/layouts/PublicLayout.tsx` | Language Selector header/mobile Drawer, nhiều nhãn `t()` đã có | Dịch phần copy còn lại, không thêm selector khác |
| `src/pages/client/CollectionPage.tsx` | Đã dịch một số title/intro/search/refresh; copy trạng thái, search, favorites, count còn cứng | Hoàn thiện UI copy, giữ logic/filter/focus |
| `src/pages/client/HomePage.tsx`, `HomeFeaturedExhibits.tsx` | Hầu hết hero, CTA, features, loading/error bằng tiếng Việt | Gắn key `ui.home.*`, không dịch tên riêng/dữ liệu hiện vật trong phạm vi này |
| `src/pages/client/ExhibitDetailPage.tsx` | `localizeExhibit()` dùng cho tên/mô tả; nhiều nút/section/feedback còn tiếng Việt | Dịch phần nhãn UI; audio vẫn `audio.vi` |
| `src/pages/MuseumPage.tsx`, `components/museum/*` | Tour controls, catalogue, panel, loading/fallback và VR labels còn tiếng Việt | Gắn dịch UI mà không làm reset WebGL/camera hoặc thay URL/query |
| `shared/components/media/AudioPlayer.tsx`, `shared/components/feedback/PublicReportModal.tsx` | Nhãn mặc định và trạng thái tiếng Việt; AudioPlayer còn dùng ở nơi khác | Prop labels hoặc adapter public; không bắt buộc hook public trong component dùng chung |
| `back-end/src/database/seeds/seed.ts` | Có 13 `PUBLIC_UI_STRINGS` `vi/en`, dùng `orIgnore()` | Bổ sung key mới idempotent, không ghi đè bản dịch đã chỉnh trong CMS |
| `docs/tasks/public-translations.md` | Đã ghi rõ chỉ một phần chuỗi UI được nối, audio và room chưa dịch | Bổ sung, không nhân bản phần đã hoàn thành |
| `tests/public-language.spec.ts` | Có 4 kịch bản chọn ngôn ngữ/placeholder/fallback/reload/mobile | Mở rộng, không copy test trùng |
| `tests/public-locale.spec.ts` | Còn test `fr` là invalid và `html.lang` vẫn `vi` khi chọn `en` | **Kỳ vọng cũ sau merge:** điều chỉnh test theo contract thực và kiểm regressions; không tuyên bố PASS trước khi chạy |

**Lưu ý:** PR #156 (public translations) đã merge trước PR #153 (Public Locale State). Commit `6259aba8` trên lịch sử `dev` có xử lý xung đột locale. Test chạy trên PR cũ không chứng minh HEAD mới vẫn xanh.

## 3. Thiết kế chọn và bất biến

### 3.1. Single source of truth

- Duy trì một `PublicLocaleProvider` trong `PublicLayout`; component public dùng `usePublicLocale()` từ `core/i18n/public-locale` để nhận `{locale,setLocale,storageError,t}`.
- Không dùng raw context từ `contexts/PublicLocaleContext` trực tiếp cho UI translations; raw hook có thể tiếp tục phục vụ fixture của persistence.
- `vi` là nguồn và fallback. Các locale đang có trong selector vẫn hợp lệ; chỉ `vi/en` được yêu cầu đạt bộ UI dịch đầy đủ trong giai đoạn này. `fr/ja/zh` không được giả định đã có đủ bản dịch.
- Không fetch API bản dịch đối với `vi`; query key bao gồm locale, kết quả cũ không được hiển thị như ngôn ngữ mới. Không tự động phát audio khi đổi locale.
- `html.lang` phản ánh locale được chọn khi vào public; khi sang Admin cần trả về nguồn tiếng Việt, tránh context/copy lọt sang Admin.

### 3.2. Quy ước key và fallback

- Key có namespace nhất quán, ví dụ `ui.home.hero.title`, `ui.collection.count.published`, `ui.detail.back`, `ui.tour.exit`, `ui.report.submit`, `ui.audio.pause`. Không đưa UUID, roomSlug, exhibitId, email hoặc văn bản người dùng vào key.
- Fallback tiếng Việt ở FE phải đúng với bản `vi` trong seed/CMS theo thời điểm đăng ký; không hiển thị raw `ui.*` key khi thiếu bản dịch.
- Chuỗi biến động dùng template rõ ràng, ví dụ `{count}`, `{name}`. Chỉ thêm helper interpolation nhỏ nếu thực sự cần, có unit test biến thiếu và chuỗi đầu vào; không dùng `innerHTML`, eval hoặc template engine khác.
- Không dịch giá trị riêng của database (`room.name`, `exhibit.description`), chỉ dịch nhãn bao quanh. `localizeExhibit` đã có không bị nhân bản.
- Giữ tên trạng thái/aria-label và thông báo nhất quán về ngữ nghĩa với bản tiếng Việt. Kiểm tra accessibility name và focus khi locale đổi trong dialog/drawer.

### 3.3. Shared component boundary

- Tránh gọi public-only hook trong một shared component có thể render bên Admin hoặc fixture không có Provider, vì sẽ throw. Nếu component cần dịch: truyền `labels`/`t` qua props tùy chọn, mặc định copy tiếng Việt; hoặc tạo wrapper tại public layer.
- Không thay `src`/`subtitleUrl`/`locale` của `<AudioPlayer>` chỉ để dịch nút. Không reset `currentTime` khi locale UI thay đổi mà nguồn media không đổi.
- Khi dịch report modal, giữ `category` gửi server và `reportedRevisionId` nguyên dạng; chỉ đổi label. Không đặt lại form/đóng modal trong lúc chuyển locale.

### 3.4. CMS translation seed

- Chốt danh sách key mới từ file map trước khi thêm seed, tránh key tạo rồi không dùng.
- Dùng `PUBLIC_UI_STRINGS` hiện có, thêm record `category='ui'` với cặp `vi/en`; `orIgnore` giữ các bản dịch Admin đã sửa, không update hàng loạt.
- Thêm unit/integration test cho seed/lọc category nếu logic backend thay đổi. Test với DB riêng hoặc mocked repository; **không** chạy seed trên production/staging/shared DB khi chưa được phép. Kết quả DB remote được phép trong lần triển khai này và giới hạn xác minh được ghi ở TASK.
- UI khi chưa seed vẫn không hỏng, hiển thị fallback tiếng Việt; report đây là mode suy giảm được kiểm soát, không ghi “English UI complete” nếu bản dịch thực tế thiếu.

## 4. File map dự kiến

| File/thư mục | Loại | Trách nhiệm |
|---|---|---|
| `front-end/src/core/i18n/public-locale.tsx` | REVIEW/MODIFY nếu cần | Giữ translator hiện có; interpolation/safe fallback nếu có test chứng minh |
| `front-end/src/helpers/publicLocale.ts`, `src/helpers/publicLocale.test.ts` | REVIEW | Không sửa nếu contract đã khớp, chỉ test regression |
| `front-end/tests/public-locale.spec.ts` | MODIFY | Sửa assertions lỗi thời sau merge và kiểm routes/`html.lang` |
| `front-end/src/layouts/PublicLayout.tsx` | MODIFY | Hoàn thiện shell/footer/mobile/aria copy |
| `front-end/src/pages/client/{HomePage,HomeFeaturedExhibits,CollectionPage,ExhibitDetailPage}.tsx` | MODIFY | Dịch nhãn UI còn thiếu |
| `front-end/src/pages/client/visitor/*` | MODIFY có chọn lọc | Favorites, search, comparison, reading, notifications |
| `front-end/src/pages/MuseumPage.tsx`, `src/components/museum/*` | MODIFY có chọn lọc | Tour DOM/3D/VR UI labels, không dịch nội dung hiện vật |
| `front-end/src/shared/components/{media/AudioPlayer,feedback/PublicReportModal}.tsx` | MODIFY có chọn lọc | Nhãn qua props/adapters, giữ tương thích CMS/fixture |
| `back-end/src/database/seeds/seed.ts` | MODIFY | Thêm seed idempotent cho `ui.*` mới |
| `front-end/tests/{public-language,public-locale,collection,exhibit-detail,museum-tour,public-audio,public-report-modal}.spec.ts` | MODIFY có chọn lọc | Test behavior, fallback và regression |
| `docs/plans/public-ui-internationalization-plan.md`, `docs/tasks/public-ui-internationalization.md` | ADD | Kế hoạch, checklist, acceptance, commit ledger |

## 5. Thứ tự triển khai và commit

| Task | Phạm vi commit | Commit đề xuất |
|---|---|---|
| 0 | Baseline/review và tài liệu | `docs(i18n): plan public UI localization completion` |
| 1 | Test drift sau merge: sửa assertions phù hợp contract; fix runtime **chỉ nếu repro** | `test(i18n): align locale regression with merged behavior` |
| 2 | Public shell và Home (bao gồm featured/error states) | `feat(i18n): complete public shell and home translations` |
| 3 | Collection, tìm kiếm, favorites và visitor controls | `feat(i18n): translate collection and visitor UI` |
| 4 | Exhibit Detail, report modal và nhãn AudioPlayer | `feat(i18n): translate exhibit detail and feedback UI` |
| 5 | Tour DOM controls, catalogue, fallback/VR UI | `feat(i18n): translate tour interface controls` |
| 6 | CMS UI seed và backend tests | `feat(i18n): seed remaining public UI strings` |
| 7 | Playwright end-to-end đa ngôn ngữ và affected regression | `test(i18n): cover public language switching journeys` |
| 8 | Verification evidence, PR handoff | `docs(i18n): record UI localization verification` |

**Quy tắc:** commit chỉ khi quality gates phù hợp xanh, không commit test đỏ kéo dài qua task. Nếu Task 1 phát hiện bug runtime thực, tách `fix(i18n): ...` riêng và ghi nguyên nhân thay vì giấu trong commit test. Một task có thể phải chia hai commit khi ranh giới rõ hơn; tránh squash các commit hữu ích cho `git bisect`.

## 6. Test strategy

1. **Baseline:** chạy `typecheck`, `lint`, unit, build; browser tập trung `public-locale.spec.ts`, `public-language.spec.ts`. Ghi rõ tests lỗi sẵn trước khi sửa.
2. **Locale & translation:** với `vi` không gọi `/public/translations`; với `en` gọi đúng endpoint và render translated strings; đổi `en → ja → vi` hoặc tương tự, kiểm fallback không hiện key và không lẫn cache.
3. **Navigation:** chọn `en` ở Home → Collection → Detail → Tour, có thể reload/đổi tab, kiểm `html.lang`, labels, title/CTA, Admin không bị translate.
4. **Responsive/a11y:** 320px/desktop, keyboard `Tab/Enter`, Drawer/modal focus, aria-label bằng đúng locale, không overflow.
5. **Dynamic messages:** số lượng/count, search result, error/retry, success toast, report categories; ngôn ngữ fallback khi key thiếu/API 500.
6. **Media/tour:** khi đổi locale UI vẫn không tự phát audio, không đổi track hoặc mất `currentTime` bất ngờ; Tour/VR scene không bị remount ngoài ý muốn, 2D fallback/escape/report hoạt động.
7. **Backend:** `GET /public/translations` chỉ trả category `ui`, không tiết lộ `exhibit`/`room` chưa publish; seed idempotent và không ghi đè bản dịch Admin. Trong lần triển khai này chỉ chạy parameterized catalog insert hai lần vào DB remote đã được cho phép, không chạy seed runner; không có hàng catalog cũ để kiểm tra preservation.

## 7. Verification commands (dự kiến)

Chạy từ `front-end/`, API ở browser test là **mocked** trừ khi run riêng live được phê duyệt:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx playwright test tests/public-locale.spec.ts tests/public-language.spec.ts --reporter=line
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/public-report-modal.spec.ts tests/public-audio.spec.ts tests/museum-tour.spec.ts --reporter=line
```

Khi có thay đổi seed ở `back-end/`, chạy `npm run typecheck`, `npm run lint`, `npm run build` và các test liên quan từ `back-end/`; không chạy migration hoặc seed lên DB dùng chung khi chưa được phép. Với Windows PowerShell có thể dùng `npm.cmd`/`npx.cmd` nếu execution policy chặn lệnh.

## 8. Acceptance / Definition of Done

| AC | Điều kiện nghiệm thu |
|---|---|
| AC-01 | Locale contract và test từ các PR đã merge khớp nhau; không còn expectation cũ về `fr` hay `html.lang` |
| AC-02 | `vi` có đầy đủ UI copy gốc; `en` có các chuỗi UI trong scope trên Home, Collection, Detail, Tour |
| AC-03 | `fr/ja/zh` vẫn chọn được và fallback tiếng Việt an toàn khi CMS chưa đủ dịch, không hiện key nội bộ |
| AC-04 | Thay đổi locale giữ route/query, không reset form, audio, camera, selection và không xâm phạm Admin |
| AC-05 | Các thành phần shared hoạt động cả khi không có public context |
| AC-06 | API translations chỉ trả `ui`, seed idempotent không overwrite bản dịch Admin |
| AC-07 | Desktop/mobile, keyboard, reload, multi-tab, API fail và affected regressions có bằng chứng |
| AC-08 | Typecheck/lint/unit/build, browser tests và backend gates liên quan có kết quả chạy thực tế |
| AC-09 | PLAN/TASK/commit ledger/PR summary được cập nhật, không tuyên bố media/content localization hoàn chỉnh |

## 9. Review notes và rủi ro

- **Rủi ro lớn nhất:** dịch UI nhưng CMS chưa có bản dịch mới => trang vẫn tiếng Việt; cần test với fixture đầy đủ và kiểm tra dữ liệu thực tế, không chỉ kiểm fallback. Lần này catalog đã được nạp vào DB remote, nhưng không có hàng cũ để xác minh preservation giá trị Admin.
- **Regression sau merge:** bộ `public-locale.spec.ts` từ PR cũ có assertions không còn đúng; không đánh dấu PASS dựa vào PR #153/#156 trước đó.
- **Phạm vi shared:** AudioPlayer, Modal có thể được dùng bởi CMS/fixture; hook public bắt buộc gây crash ngoài Provider.
- **Phạm vi marketing copy:** các tuyên bố 100% hoặc “song ngữ hoàn chỉnh” trong Home là nội dung cố định hiện có, không xem là bằng chứng chứng nhận WCAG hay media đa ngôn ngữ.
- **Kiểm thử:** thời điểm soạn PLAN chỉ đọc GitHub source, không chạy lệnh local. Kết quả triển khai và giới hạn xác minh được ghi trong [TASK](../tasks/public-ui-internationalization.md): parameterized catalog insert chạy hai lần vào DB remote đã được người dùng cho phép, nhưng không chạy seed runner; DB không cô lập, TLS certificate không được xác thực theo CA, và preservation bản dịch Admin chưa được thực nghiệm.
