# Public Homepage Redesign — Implementation Plan

> **For agentic workers:** Dùng Superpowers `executing-plans` để triển khai **từng task và kiểm chứng trong phiên đang làm**; ưu tiên test-before-code cho thay đổi hành vi. Checklist bắt đầu ở TODO. Chỉ đánh dấu `[x]` và ghi SHA/log khi đã có bằng chứng thực tế. Không tự tạo PR/push/merge nếu người dùng chưa yêu cầu.

**Goal:** Thiết kế lại trang chủ `/` theo *Contemporary Heritage Editorial* trong `PUBLIC_PORTAL_DESIGN.md`: hero nền charcoal có ảnh hiện vật đã xuất bản (nếu có), hai CTA rõ, khu vực featured tối đa 3 hiện vật, và phần giới thiệu trải nghiệm 3D/audio. Tránh dữ liệu lịch sử/số liệu tự suy đoán, không tải WebGL trên Homepage, bảo toàn i18n và các luồng hiện có.

**Architecture:** `PublicLayout` và `ExhibitGrid`/`ExhibitCard` đã merge là phần nền không đổi. Giữ `HomePage` là chủ nội dung `/`, dùng **một luồng dữ liệu `useMuseumRooms(null)`** cho hero + featured (ưu tiên lift query ownership từ `HomeFeaturedExhibits` sang owner của trang, hoặc adapter nhỏ nếu giữ được contract). Chọn phòng đầu tiên do API trả, sắp xếp bản sao `room.exhibits` theo `displayOrder` rồi `id`; featured là tối đa ba phần tử đầu; hero chọn phần tử đầu tiên **có `image` hợp lệ** trong cùng danh sách đã sắp xếp. Hero và featured không tự fetch các phòng còn lại. UI độc lập với 3D runtime; `ExhibitImage`/`ExhibitPreview` xử lý ảnh/placeholder; UI strings dùng `usePublicLocale`. Nếu chỉ thay DOM/CSS, giới hạn thay đổi trong page và CSS Module.

**Tech Stack:** React 18, TypeScript, Vite 6, Mantine 7, React Router 6, TanStack Query 5, CSS Modules, Tabler icons, Playwright và Vitest hiện có. Không thêm package hoặc runtime phụ thuộc mới.

**Task nguồn:** [homepage-redesign.md](../tasks/homepage-redesign.md).
**Design authority:** [PUBLIC_PORTAL_DESIGN.md](../architecture/fe/PUBLIC_PORTAL_DESIGN.md), mục 3.3–3.4, 4–6, 10–12, 14.
**Coding conventions:** [frontend coding conventions](../architecture/fe/coding-conventions.md).

## Baseline và phụ thuộc

- Khi lập plan (15/11/2026), `dev` ở SHA **`95c2bbe609ef32b36f0fc272d65e104076ca0841`**, đã merge PR #196 `feat/shared-exhibit-components`; Public Foundation cũng có trong base. **Fetch và kiểm tra lại trước khi bắt đầu code**; không coi SHA này là trạng thái vĩnh viễn.
- Nhánh đề xuất: `feat/public-homepage-redesign`, tạo từ `origin/dev` mới nhất **sau khi đã chứa shared components**; một PR base `dev`. Không ghi mã PR trong tên branch/title.
- Code `HomePage.tsx` hiện tại tự import `HeroCanvas` qua `React.lazy` và mount sau `supportsWebgl()`; có showcase *Trống đồng Đông Sơn* và era cố định, stats `5+`, `100%`, `0s`, bento/glow/soundwave. Đây là **đối tượng cần thay**, không dùng làm nguồn sự thật về hiện vật.
- `HomeFeaturedExhibits.tsx` hiện chọn phòng đầu qua `useMuseumRooms(null)`, sort `displayOrder/id`, slice 3, render `ExhibitGrid` đã chuẩn hóa, đồng thời có loading/empty/error/retry. Giữ các hành vi này khi tái cấu trúc dữ liệu.
- Schema public có `RoomDetail.exhibits[].image?.url/altText`, `name`, `description`, `displayOrder`, `placeholderShape`, `placeholderColor`, `i18n`; không có cờ `featured`, category material/period, room hero photo, official stats hoặc chứng nhận accessibility.
- `ExhibitImage` mặc định `loading="lazy"` và fallback nếu hình lỗi; hero above-the-fold cần xem xét **prop priority tùy chọn** có kiểm thử, giữ mặc định lazy cho cards.
- Reference Homepage đã được người dùng duyệt trước đó nhưng **không xác minh có ảnh mockup trong checkout**; nếu chưa có, dùng SDD làm chuẩn, không tuyên bố pixel-perfect với ảnh không truy cập được.

## Global Constraints

- **Không sửa** `PublicLayout` header/footer, Collection body, Exhibit Detail, Admin CMS UI, 3D Tour/Guided Tour, visitor stores, API/service/schema, backend runtime hoặc DB migration.
- **Không tải** `HeroCanvas`, Three.js/R3F, scene chunk, `.glb`, không tạo canvas trên `/` (kể cả thiết bị có WebGL). Không tự bật video/audio, không thêm autoplay hoặc parallax bắt buộc. Không xóa component `HeroCanvas` khỏi repo nếu chưa xác minh nó không còn caller khác.
- Không bịa tên, niên đại, ảnh, room count, chất liệu, số liệu hoạt động, chứng nhận WCAG hay hỗ trợ device cụ thể. Tất cả hero label/link chỉ gắn vào **cùng một exhibit thật**; không có ảnh thật thì dùng artwork trang trí trung tính, **không gắn exhibit giả**.
- Giữ `useMuseumRooms` query key và quyền public/abort/error hiện tại. Một room owner; không tự fetch detail phòng thứ hai để lấp chỗ trống hoặc làm hero; không mutate mảng cache/DTO. Với query error/refetch error không được hiển thị exhibit stale.
- Giữ hành vi CTA `/tour`, `/collection`, deep link hero `/collection/:roomSlug/exhibits/:exhibitId`, featured room `/collection?room=<slug>` và route active/Guided Tour do `PublicLayout` sở hữu. Không thêm route hoặc nút chết.
- Locale `vi/en/fr/zh/ko/ja`, light/dark, keyboard, reduced motion phải không hồi quy. Ưu tiên **tái dùng UI keys đã có**. Nếu cần copy/key mới, update **đúng file seed UI strings và fixtures liên quan** ở một slice i18n nhỏ; đây là ngoại lệ dữ liệu bản dịch, **không thay backend API/logic và không tuyên bố DB đang có bản dịch mới nếu chưa publish/seed**.
- Style qua `HomePage.module.css` + `--public-*` scoped tokens; không dùng `:root` hoặc sửa global `--aura-*`, không thêm visual glass/glow/bento hiện có vào layout mới.
- Task có thể đi cùng test trong một commit để mỗi commit có thể build/kiểm tra độc lập. Một checkpoint không thay đổi file thì ghi `no-op`, **không tạo commit rỗng**. Không stage `.env`, `test-results`, screenshot, cache hay credential.

## Thiết kế đã chốt / cấu trúc trang

1. **Hero dark editorial (H01.1):** full-bleed charcoal edge-to-edge (không bị `Container` bo giới hạn nền); inner content tối đa 1360px, desktop khoảng 40% copy / 60% visual, chiều cao mục tiêu 520–660px. H1 serif rõ; nội dung không đưa tuyên bố lịch sử không kiểm chứng. CTA chính đến `/tour`, CTA phụ đến `/collection`. Khung ảnh hiện vật từ CMS được ưu tiên trên danh sách đã sort: ảnh thật + tên thật + link detail; thiếu ảnh/room hoặc đang load thì neutral branding frame không nhận diện hiện vật. Overlay không che ảnh/mất contrast. `ExhibitImage` và alt localized; poster không bị crop/méo.
2. **Featured editorial (H01.2):** nền ivory, section eyebrow/H2/đoạn giới thiệu và `ExhibitGrid` của shared components, **0–3 items** từ room đầu. Link tới room hiện tại chỉ khi có room hợp lệ; không ngụy tạo featured flag. Loading/error/empty và retry rõ, CTA hero vẫn dùng được khi API lỗi. Card 4:3 do shared component xử lý, không fork CSS/markup card ở Homepage.
3. **Immersive story (H01.3):** hai cột trên desktop; copy giới thiệu tour 3D và audio, hai ý nội dung minh bạch, CTA `/tour` và `/collection`; bên kia là surface/illustration có nhãn đúng vai trò, **không gắn giả làm ảnh phòng thực tế** khi không có ảnh chính thức. Không còn bento lớn, các con số không xác minh hoặc soundwave chạy vô hạn.
4. **Responsive:** desktop ≥1200 hai vùng, tablet 768–1199 tùy khoảng trống chuyển 50/50 hoặc stack, mobile ≤767 một cột; vùng media, headline, CTA và card không tràn ở 320/390px; không phụ thuộc thứ tự CSS `order` gây thứ tự tab sai. Header/footer vẫn do Public Foundation giữ.
5. **Trạng thái H01-S01…S06:** tải room, empty, lỗi ảnh, có poster hợp lệ, đổi locale/theme, prefers-reduced-motion; đều có assertion cụ thể. Light mode vẫn giữ hero charcoal theo thiết kế, dark mode điều chỉnh section body/card theo `--public-*`.

## File map và hợp đồng

| File | Chạm tới / mục đích |
|---|---|
| `front-end/src/pages/client/HomePage.tsx` | Page `HomePage()`; chủ dữ liệu, cấu trúc hero/featured/immersive, bỏ mount WebGL và stats giả |
| `front-end/src/pages/client/HomePage.module.css` | Full-bleed hero, typography, section layout, responsive/a11y; xóa bento/glow/canvas rule không còn dùng |
| `front-end/src/pages/client/HomeFeaturedExhibits.tsx` | Giữ featured states, 3 items, Grid; nhận state đã được Home owner cung cấp thay vì fetch độc lập nếu lift query |
| `front-end/src/pages/client/HomeHeroMedia.tsx` **(nếu cần)** | Thành phần presentational riêng cho ảnh hero có thật/neutral artwork + caption/link; không sở hữu API/query |
| `front-end/src/shared/components/media/ExhibitImage.tsx` **(chỉ nếu cần)** | Bổ sung optional `loading="eager"` cho hero, mặc định card vẫn lazy; giữ image failure fallback |
| `back-end/src/database/seeds/public-ui-strings.ts` **(chỉ nếu có keys mới)** | Bổ sung/điều chỉnh UI translations cho sáu locale theo contract hiện hữu; không sửa backend runtime/API |
| `front-end/tests/homepage-redesign.spec.ts` **(mới)** | Hero real/neutral, CTA, no WebGL, state, locale, resize và reduced-motion |
| `front-end/tests/home-featured.spec.ts` | Cập nhật assertions đổi heading/copy/section theo scope, giữ data contract/cases cũ |
| `front-end/tests/home-featured-live.spec.ts` | Cập nhật chỉ khi assertions cũ bị thay đổi thực sự; live API read-only opt-in |
| `front-end/tests/public-ui-translations.spec.ts`, `front-end/tests/public-image-audio.spec.ts` | Điều chỉnh nếu copy/media contract thay đổi; không làm test lỏng/skip tùy tiện |
| `docs/plans/homepage-redesign-plan.md`, `docs/tasks/homepage-redesign.md` | Plan, checklist, commit và ledger kiểm thử |

**Interface ownership:** `HomePage` hoặc một adapter nội bộ trả dữ liệu đã guard `rooms.isSuccess && selectedRoom && room.isSuccess` rồi chọn `featured[0..2]` và `heroExhibit` từ **mảng đã sắp xếp**. `HomeHeroMedia` nhận exhibit đã localize + `roomSlug` và **không query**. `HomeFeaturedExhibits` hiển thị state có typed props, không tự sort lại hoặc truy vấn phòng khác. Không ép cấu trúc props mới nếu audit chứng minh phương án tương đương đơn giản hơn. `ExhibitImage` phải tiếp tục fallback khi 404/corrupt/src thay đổi.

---

## HR-01: Baseline và duyệt tài liệu

**Files:** hai docs; đọc source và tests, chưa sửa sản phẩm.
**Consumes:** `origin/dev` mới nhất, SDD, shared component PR #196. **Produces:** baseline và phạm vi thay đổi.

- [x] **Bước 1 — Nhánh:** `git fetch origin`, xem `git status --short`, xác minh `origin/dev` đã có Foundation & Shared Card; tạo branch `feat/public-homepage-redesign` nếu sạch, ghi base SHA thực.
- [x] **Bước 2 — Audit:** đọc HomePage, HomeFeaturedExhibits, CSS, ExhibitImage/Grid/Card, `useMuseumRooms`, localization, UI seeds, HeroCanvas callers và fixtures. Khóa các route và behavior đang hoạt động.
- [x] **Bước 3 — Baseline:** chạy tests `home-featured.spec.ts`, `public-ui-translations.spec.ts`, `public-image-audio.spec.ts`, focused shared regression và typecheck/lint/unit/build; chụp screenshot 390/1440 light/dark. Ghi lệnh/log và các baseline failures, không coi các lỗi cũ là do redesign.
- [x] **Bước 4 — Review scope/commit:** đối chiếu SDD mục 6 và hai file plan/task, `git diff --cached --check`; nếu được phép bắt đầu triển khai thì commit docs riêng.

**Commit dự kiến:** `docs(home): plan public homepage editorial redesign`.

**HR-01 evidence:** Base `origin/dev` `95c2bbe609ef32b36f0fc272d65e104076ca0841`; branch `feat/public-homepage-redesign`. `npm.cmd run typecheck` and `lint` pass; `test:unit` 65 files / 408 tests pass; `build` passes with existing >500 KB warnings (main 1,126.14 KB, R3F 820.71 KB); focused Playwright: 61/61 pass. Baseline full-page captures at 390/1440 in light/dark are in ignored `.superpowers/sdd/homepage-redesign-plan/`.

## HR-02: Chủ sở hữu dữ liệu Homepage (refactor thuần túy)

**Files:** `HomePage.tsx`, `HomeFeaturedExhibits.tsx`; focused home tests.
**Consumes:** `useMuseumRooms(null)`. **Produces:** một nguồn dữ liệu/guard thống nhất, **visual hiện tại chưa đổi**.

- [x] **Bước 1 — RED/contract:** thêm/khóa fixture assertions: phòng đầu, sorted copy by `displayOrder/id`, tối đa 3 card, list/detail pending, empty, error, retry, cached refetch failure; page hero branding không phụ thuộc network. Kiểm có đúng room detail request kỳ vọng, không fetch phòng khác.
- [x] **Bước 2 — Refactor:** nâng query ownership tới `HomePage` hoặc internal Home data adapter, truyền typed state vào `HomeFeaturedExhibits`. Thao tác sort chỉ trên bản sao; giữ `localizeExhibit` sau sort/slice; mô tả/alt fallback giữ nguyên.
- [x] **Bước 3 — Tests:** chứng minh featured output/URL/callback trước-sau không đổi; không thêm request không cần thiết, không tạo query key mới; review diff độc lập rồi commit.

**Commit dự kiến:** `refactor(home): share published room state across homepage`.

## HR-03: Hero editorial tĩnh, bỏ WebGL và dữ liệu giả

**Files:** `HomePage.tsx`, `HomePage.module.css`, `homepage-redesign.spec.ts`.
**Consumes:** visual direction từ SDD, Public tokens. **Produces:** hero charcoal responsive, 2 CTA, media neutral trước khi có poster.

- [x] **Bước 1 — Viết test trước:** `/` có một H1; CTA `/tour` + `/collection`; *không có* Canvas, HeroCanvas/Three dynamic chunk, GLB requests trong **mọi** trường hợp WebGL supported/unsupported; không hiển thị `5+`, `100%`, `0s` hoặc nhãn Trống đồng/era hardcode. RED ban đầu bắt được canvas khi WebGL bật; sau triển khai cả hai chế độ pass.
- [x] **Bước 2 — Remove eager WebGL path:** bỏ `lazy/Suspense/HeroCanvas`, `supportsWebgl`, `useMediaQuery`, state/effect dựng 3D; **chỉ bỏ import ở HomePage** (xem còn caller trước khi xóa file component). Tắt các visual cũ soundwave/floating orb/stats; không ảnh hưởng `/tour`.
- [x] **Bước 3 — Dựng hero:** nền charcoal full-bleed, vùng nội dung 40/60 ở desktop, H1/copy có `t(key, fallback)`, CTA semantic Link tới route thật, neutral illustration `aria-hidden` khi chưa có ảnh; không render button play giả. Tái dùng key `ui.home.badge`/`ui.home.intro`, thay copy cũ có tuyên bố lịch sử chưa kiểm chứng ở đủ sáu locale.
- [x] **Bước 4 — Verify:** `homepage-redesign.spec.ts` 3/3 (WebGL on/off, API lỗi, keyboard focus); `public-ui-translations.spec.ts` 13/13; typecheck/lint/build pass. Chụp và xem hero light/dark tại `.superpowers/sdd/homepage-redesign-plan/hr03-hero-{light,dark}.png`; review diff và commits `06a44b9`, `b2225e0`. Visual sign-off cuối vẫn theo HR-12.

**Commit dự kiến:** `feat(home): replace webgl showcase with editorial hero`.

**HR-03 evidence:** Commit `06a44b9` (hero, copy sáu locale, no-WebGL/API regressions) và `b2225e0` (keyboard-focus regression). `npm.cmd run typecheck`, `lint`, `build` pass; Playwright homepage 3/3 và locale 13/13 pass. Build vẫn có chunk warning (main 1,123.43 KB; các chunk hiện hữu khác trên 500 KB). Thử `back-end npm.cmd run test:seed` còn fail ở key `ui.guided2d.progress` đã được dùng trên `origin/dev` nhưng chưa có trong seed; không phát sinh từ HR-03.

## HR-04: Media hero lấy từ hiện vật xuất bản

**Files:** `HomePage.tsx`, `HomeHeroMedia.tsx` (nếu tách), CSS và focused tests.
**Consumes:** danh sách đã sort của room đầu + `ExhibitImage`, `localizedAltText`. **Produces:** ảnh/tên/link cùng exhibit thật hoặc neutral fallback.

- [x] **Bước 1 — Test RED:** đảo thứ tự fixture, chèn 0/1/n exhibits, case item đầu không ảnh nhưng item sau có ảnh, tất cả không ảnh, room rỗng. Test `heroExhibit` chọn **first with valid image** từ room đầu; không tìm room thứ hai. Tie `displayOrder` được quyết định bằng ID.
- [x] **Bước 2 — Data binding:** chọn từ mảng sorted validated; `localizeExhibit`/`localizedAltText` cho title và image alt; media `ExhibitImage`; link chi tiết encode roomSlug/id. **Tên, ảnh, đường dẫn phải từ cùng exhibit**. Thiếu ảnh room -> neutral branding, không fake artifact caption/link.
- [x] **Bước 3 — Error/refresh:** HTTP image lỗi → placeholder có nhãn; exhibit đã chọn vẫn có link vì metadata thật. Query list/detail error hoặc stale invalid -> không để hero show dữ liệu cũ, hero branding tĩnh + featured alert hiện hành.
- [x] **Bước 4 — Test GREEN:** focused Playwright 22/22, typecheck/lint/build pass; poster và neutral screenshots được chụp và kiểm tra. Commit riêng.

**Commit dự kiến:** `feat(home): display published exhibit poster in hero`.

**HR-04 evidence:** Commit `4abcba5`. Bộ 22 tests gồm `homepage-redesign` (6), `home-featured` (7), `public-image-audio` (7), `shared-exhibit-media` (2); bao gồm localized name/alt, tie-break, ảnh lỗi, API/refetch error và không giữ poster stale. `npm.cmd run typecheck`, `lint`, `build` pass; build giữ chunk warnings hiện có (main 1,124.02 KB). Screenshots ignored: `hr04-hero-poster.png`, `hr04-hero-neutral.png`; ảnh poster dùng fixture kiểm thử, không phải ảnh sản phẩm/CMS thật. Visual sign-off cuối vẫn theo HR-12.

## HR-05: Tải ảnh hero có ưu tiên, media fallback

**Files:** `ExhibitImage.tsx` (nếu cần), `HomeHeroMedia.tsx`, media tests.
**Consumes:** API media absolute URL và fallback component. **Produces:** ảnh above-the-fold được tải sớm, card bên dưới vẫn lazy.

- [ ] **Bước 1 — Test behavior:** xác nhận ảnh hero có thuộc tính priority phù hợp (`loading="eager"`, `fetchPriority` nếu được React/TS hỗ trợ), featured/card khác vẫn `loading="lazy"`; `referrerPolicy` và fallback giữ nguyên. Không tự dựng media URL.
- [ ] **Bước 2 — API tối thiểu:** thêm prop optional cho `ExhibitImage`, default lazy, không fork code error/fallback; ưu tiên ảnh thật có metadata, không preload tệp GLB. Không hardcode kích thước ảnh chưa có; giữ container ratio để hạn chế CLS.
- [ ] **Bước 3 — Test:** media healthy/404/corrupt/src changed, ảnh trong suốt/portrait không crop, keyboard, no model/audio. Commit riêng cùng focused tests.

**Commit dự kiến:** `perf(home): prioritize hero poster without changing card loading`.

## HR-06: Featured section theo bố cục editorial

**Files:** `HomePage.tsx`, `HomeFeaturedExhibits.tsx`, CSS, home tests.
**Consumes:** shared `ExhibitGrid`/`ExhibitCard`, first room selection, API states. **Produces:** editorial section mới, behavior featured cũ không đổi.

- [ ] **Bước 1 — Design:** nền ivory/light paper (dark tokens tương ứng), eyebrow/H2 giới thiệu ngắn và grid cards; desktop 3 cột, tablet 2, mobile 1 theo container, giữ whitespace phù hợp. Không sửa CSS/JSX `ExhibitCard` trong PR này nếu chưa có bug thật.
- [ ] **Bước 2 — Content:** giữ tối đa 3 đầu theo sort hiện hành, link room `?room=` và tên phòng chỉ có khi đã load; section vẫn visible trong empty/error/loading, CTA hero không bị ảnh hưởng.
- [ ] **Bước 3 — Test:** cập nhật có chủ đích assertions phụ thuộc heading/copy cũ; vẫn kiểm count 0/1/2/3, tie-break ID, loading/empty/schema error/retry/refetch error, không requests phòng khác. Không xóa test để làm pass.
- [ ] **Bước 4:** screenshot 390/1024/1440, typecheck/lint, commit riêng.

**Commit dự kiến:** `feat(home): present featured exhibits in editorial section`.

## HR-07: Immersive story thay cho Bento Grid

**Files:** `HomePage.tsx`, `HomePage.module.css`; focused tests.
**Consumes:** tính năng tour/audio thực tế đang có, SDD H01.3. **Produces:** 2-column giới thiệu 3D/audio và artwork trung tính.

- [ ] **Bước 1 — Structure:** thay bento feature cards bằng editorial section: mô tả ngắn, hai thông tin 3D và audio, CTA tới `/tour`, `/collection`, artwork/motif trang trí trung tính bên phải. H2 phù hợp, không có nhiều H1.
- [ ] **Bước 2 — Content safety:** bỏ copy khẳng định đạt WCAG 2.2 AA, 100% keyboard/device compatibility, số phòng hoặc transcript có mọi ngôn ngữ nếu chưa có chứng cứ; không tự xưng ảnh minh họa là ảnh phòng thật.
- [ ] **Bước 3 — A11y:** icons decorative `aria-hidden`, link và heading order, responsive stack giữ đúng thứ tự DOM, text có contrast. Kiểm browser navigation, screenshot và commit.

**Commit dự kiến:** `feat(home): replace feature bento with immersive story`.

## HR-08: Cleanup visual và style token nội bộ

**Files:** `HomePage.module.css`, `HomePage.tsx` chỉ khi selector chết, focused style tests.
**Consumes:** new layout từ 03/06/07. **Produces:** CSS mới sạch, không còn glass/glow/parallax của Home.

- [ ] **Bước 1:** dọn `.showcase*`, `.soundwave`, `.stats`, `.bento*`, `.titleGradient`, `aura-reveal`, `--aura-delay` nếu không còn dùng trên page; đảm bảo thay đổi chỉ trong Home CSS/markup.
- [ ] **Bước 2:** dùng `--public-*` (giấy sáng, charcoal, forest, bronze) và fallback hợp lý; tránh lặp token hardcode/đổi global theme.
- [ ] **Bước 3:** kiểm visual hierarchy, hover/focus/reduced-motion, long content, font dấu Việt. Screenshot diff theo light/dark; stage đúng file và commit.

**Commit dự kiến:** `style(home): simplify editorial surfaces and remove legacy effects`.

## HR-09: Responsive & layout containment

**Files:** `HomePage.module.css`, `homepage-redesign.spec.ts`.
**Consumes:** new hero, featured, immersive. **Produces:** không overflow / CTA che ở các kích thước chính.

- [ ] **Bước 1:** test 320, 390, 768, 1024, 1440; xác nhận 2→1 column theo rộng, media không cắt vật, CTA không tràn, section không va header/footer; lang en/de? hệ thống chỉ vi/en/fr/zh/ko/ja.
- [ ] **Bước 2:** xử lý text dài/room name dài và device landscape; không dựng spacer cố định lớn ở 320, không đảo thứ tự tab bằng CSS order thiếu kiểm thử.
- [ ] **Bước 3:** test DOM `documentElement.scrollWidth <= innerWidth`, bounding boxes hero/sidebar, CTA visible/focus; chụp light/dark matrix và kiểm layout trực quan, commit riêng.

**Commit dự kiến:** `style(home): refine responsive hero and section layouts`.

## HR-10: i18n, keyboard, reduced motion và content semantics

**Files:** `HomePage.tsx`, optional public UI seed/translation tests, `homepage-redesign.spec.ts`.
**Consumes:** `PublicLocaleProvider`, SDD 11. **Produces:** copy mới không mất bản dịch, focus/contrast/reduced motion hợp lệ.

- [ ] **Bước 1 — Locale:** audit các key cũ đang có seed; dùng lại key khi cùng nghĩa. Key/copy mới (nếu có) cập nhật rõ ràng trong `public-ui-strings.ts` cho `vi/en/fr/zh/ko/ja` theo quy trình duyệt ngôn ngữ; fixtures/locales kiểm biến đổi VI→EN/FR/ZH/KO/JA và fallback API error. Không sửa backend runtime.
- [ ] **Bước 2 — Semantics:** chỉ một H1; H2 theo Hero→Featured→Immersive; `aria-labelledby` khớp, image alt đúng, neutral art `aria-hidden`, CTA và link chi tiết tiếp cận bằng bàn phím, có focus ring.
- [ ] **Bước 3 — Motion:** không infinite particle/soundwave/glow, `prefers-reduced-motion` tắt mọi hiệu ứng còn lại; không làm thông tin/CTA phụ thuộc animation. Đo contrast chữ trên hero và label trên media.
- [ ] **Bước 4 — Test/commit:** targeted locale/keyboard/reduced-motion, typecheck/lint/build. Nếu translation seeds yêu cầu publish vào CMS, ghi điều kiện triển khai tách biệt, không báo all locales production ready khi chưa verify.

**Commit dự kiến:** `fix(home): align editorial content with locale and accessibility` (nếu có fix); nếu chỉ thêm tests: `test(home): cover locale and accessible navigation`.

## HR-11: Integration tests và no-WebGL network proof

**Files:** `front-end/tests/homepage-redesign.spec.ts`, affected regressions/fixtures; nếu test lộ bug thì code fix commit riêng.
**Consumes:** feature đã ổn định. **Produces:** test evidence độc lập cho trạng thái và không tải 3D.

- [ ] **Bước 1:** kiểm ở `/`: có WebGL, không WebGL, reduced motion đều **0 canvas, 0 GLB, 0 `HeroCanvas`/Three/R3F request**; sau click CTA sang `/tour` mới có thể load tài nguyên tour. Phân biệt request tới app chunk của home và những chunk chỉ có ở tour; không fake số đo performance.
- [ ] **Bước 2:** re-run full Home states (room list empty, room empty, image absent, image HTTP 404/corrupt, schema error, retry, delayed API, stale refetch, theme/locale), existing featured/localization/visitor routes. Live API opt-in chỉ đọc nếu backend sẵn có, không yêu cầu seed dữ liệu thật.
- [ ] **Bước 3:** `public-foundation`, `shared-exhibit-*`, `public-image-audio`, `public-tour-navigation`, `collection`, affected localization tests; lỗi baseline/legacy assumptions thay bằng assertions đúng contract mới, không skip.
- [ ] **Bước 4:** nếu thêm tests mới thì review/commit riêng; mọi bug sửa trong commit `fix(home): ...` cùng regression, không gộp fix vào docs.

**Commit dự kiến:** `test(home): verify editorial page and no eager 3d`; `fix(home): ...` nếu thực sự có lỗi.

## HR-12: Quality gates cuối, visual sign-off và bàn giao

**Files:** docs plan/task và test evidence; chỉ sửa code nếu có bug và commit fix riêng.
**Consumes:** tất cả slice đã triển khai. **Produces:** trạng thái kiểm chứng có thể review, PR clean.

- [ ] **Bước 1:** chạy từ `front-end/`: typecheck, lint, test:unit, build và focused Playwright. Ghi số pass/fail, warning chunk tồn tại hay mới phát sinh, không tự nhận Lighthouse/CLS mục tiêu đã đạt.
- [ ] **Bước 2:** screenshot Home ở 320/390/768/1024/1440 light/dark, ảnh thật/neutral, full-page; so SDD/mocks nếu có, người dùng review trước khi kết luận đạt visual. Zoom 200/400%, NVDA/VoiceOver, mobile thực, network profile chỉ ghi PASS khi có thực tế.
- [ ] **Bước 3:** đối chiếu diff với `origin/dev`, `git log --oneline`, `git show <sha>` từng slice; `git diff --check` + staged diff, chỉ file scope. Không stage screenshot/log/.env.
- [ ] **Bước 4:** điền commit SHA, test counts, screenshot path, residual risks, trạng thái được người dùng chấp nhận; soạn title + PR description khi được yêu cầu; chưa tự push/PR/merge.

**Commit dự kiến:** `docs(home): record homepage redesign verification` nếu có evidence thay đổi.

## Commands và kiểm tra trước từng commit

```powershell
# Frontend checks (PowerShell dùng npm.cmd nếu npm.ps1 bị chặn)
cd front-end
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test -- homepage-redesign.spec.ts home-featured.spec.ts public-ui-translations.spec.ts public-image-audio.spec.ts public-foundation.spec.ts public-tour-navigation.spec.ts collection.spec.ts shared-exhibit-components.spec.ts shared-exhibit-grid.spec.ts shared-exhibit-locale.spec.ts shared-exhibit-media.spec.ts

# Optional read-only live API: chỉ khi backend/dev server chạy được và có dữ liệu thực
$env:MUSEUM_LIVE_TEST='1'
try { npm.cmd run test -- home-featured-live.spec.ts } finally { Remove-Item Env:MUSEUM_LIVE_TEST }
```

```bash
# Repo root — sau khi focused tests pass của slice tương ứng
 git status --short
 git diff --check
 git diff --stat
 git add -- <exact-files-reviewed-in-slice>
 git diff --cached --check
 git diff --cached
 git commit -m "<conventional-commit-message>"
```

Chỉ chạy lệnh có placeholder sau khi thay thế path/message. **Không dùng `git add .`**. Lệnh Playwright tham khảo đúng script `"test": "playwright test"`; các test mới chưa tồn tại cho đến lúc implement. Chạy các quality gates sau khi có code, không báo chúng đã pass ở giai đoạn lập kế hoạch.

## Acceptance và tự rà soát plan

- **Trước code:** plan/task phản ánh code mới nhất và SDD, branch clean, đúng `dev` base đã merge #196; mọi task TODO. Không triển khai trực tiếp `dev`.
- **Hoàn thành feature:** trang Home theo 3 tầng Hero/Featured/Immersive; hero từ ảnh thật hoặc neutral khi không có; không hardcoded stats/historical artifact; card share hoàn toàn; locale/theme/keyboard/empty/error/retry giữ đúng; không GLB/Canvas/Three ở Home; không ảnh hưởng Admin/Collection/Detail/Tour.
- **Chỉ claim đã đo:** browser tests/typecheck/unit/build, contrast và ảnh review nếu thật sự đã chạy. Lighthouse, zoom 200%+, NVDA/VoiceOver, máy di động thật là manual gate không được tự tick.
- **Bàn giao:** task ledger có commit SHAs thật hoặc no-op, lệnh và kết quả thật, ảnh QA, visual sign-off và risk còn lại; push/tạo PR theo yêu cầu tiếp theo của người dùng.
