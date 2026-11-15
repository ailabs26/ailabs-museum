# Shared Exhibit Components — Implementation Plan

> **For agentic workers:** Dùng Superpowers `executing-plans` để triển khai từng task trong phiên được giao. Ưu tiên test trước code khi thay đổi hành vi, kiểm chứng từng slice rồi commit; không đánh dấu hoàn thành nếu chưa có bằng chứng thực tế. Không tự push, tạo PR hoặc merge nếu chưa được yêu cầu.

**Goal:** Chuẩn hóa các thành phần thẻ và lưới hiện vật dùng chung trên Homepage và Collection theo `PUBLIC_PORTAL_DESIGN.md`: trải nghiệm hình ảnh nhất quán, typography kiểu bảo tàng, điều hướng rõ ràng, các action hoạt động độc lập và tương thích mobile/keyboard/i18n.

**Architecture:** Giữ `ExhibitGrid` làm API hiển thị danh sách hiện vật dùng chung (hiện đã được `HomeFeaturedExhibits` và `CollectionPage` sử dụng). Tách phần hiển thị của **một** hiện vật thành `ExhibitCard` presentational, do `ExhibitGrid` lặp qua dữ liệu đã được consumer chọn/sắp xếp. Dùng `ExhibitImage` → `ExhibitPreview` hiện có để hiển thị poster/placeholder, không dựng 3D. Tái sử dụng `localizeExhibit`, `localizedAltText` và `usePublicLocale`; không phát minh field chưa có trong `RoomDetail`. Style qua CSS Modules và semantic tokens `--public-*` được scope ở `PublicLayout`.

**Tech Stack:** React 18, TypeScript, Mantine 7, React Router 6, CSS Modules, TanStack Query/Zod từ consumer hiện có, Vitest và Playwright (Chromium/Edge); không thêm dependency nếu không có phê duyệt.

**Task nguồn:** [shared-exhibit-components.md](../tasks/shared-exhibit-components.md).\
**Thiết kế chuẩn:** [PUBLIC_PORTAL_DESIGN.md](../architecture/fe/PUBLIC_PORTAL_DESIGN.md), mục 3.3, 4.5–4.6, H01.2, C01.4, 10.1, 11 và 14.\
**Convention:** [Frontend coding conventions](../architecture/fe/coding-conventions.md).

## Current state / dependency gate

- Kiểm tra khi bắt đầu triển khai: fetch `origin/dev` mới nhất (`e63677f`), xác nhận PR #195 đã đưa Public Foundation vào `dev`; base hợp lệ. Nhánh `feat/shared-exhibit-components` được tạo trực tiếp từ `origin/dev` tại `e63677f`.
- Public Foundation đã merge vào `dev` qua PR #195. Nhánh này không stacked; base PR dự kiến là `dev`, không mang commit Foundation riêng.
- `ExhibitGrid.tsx` đã render `ul/li`, `ExhibitImage`, tên, mô tả, đường dẫn chi tiết, `onReport` và `renderActions`. Đây **không** phải task “tạo shared grid từ đầu”. `HomeFeaturedExhibits.tsx` đang dùng grid với tối đa 3 mục; `CollectionPage.tsx` dùng grid sau lọc/tìm kiếm và chèn action qua callbacks.
- `ExhibitGrid.module.css` còn dùng glass/glow và một số `--aura-*`; đổi sang visual system Foundation nhưng không sửa global `aura.css` hoặc theme Admin.
- Ảnh đang lấy `image.altText.vi` trong grid; cần áp dụng `localizedAltText(...)` và thử locale khác. `CollectionPage` đang gọi `localizeExhibit`; `HomeFeaturedExhibits` đưa DTO gốc xuống grid. Chốt một ranh giới localization rõ ràng để hai nơi cho kết quả thống nhất, không double translation hay mutate source.
- `ExhibitImage` đã dùng `loading="lazy"`, fallback sang `ExhibitPreview` khi thiếu ảnh/lỗi. Giữ contract, quyền media và placeholder; chỉ thay nếu test chứng minh cần.

## Global Constraints

- **Một PR nhỏ cho shared exhibit components**; commit theo task, không chia PR theo số thứ tự nội bộ và không ghi tên PR dạng `PR02`.
- Không redesign Hero/section Homepage, banner/filters/room sidebar Collection, Exhibit Detail, full Museum Room hay 3D Viewer ở lượt này.
- Không chỉnh backend, CMS/database/schema, media URLs, mô hình GLB, query key, `museumService`, `useMuseumRooms`, visitor stores hoặc các reducer Guided Tour.
- Giữ `HomeFeaturedExhibits` lấy **phòng đầu tiên, tối đa 3 hiện vật** theo `displayOrder` rồi `id`. Grid/Card không tự fetch, sort, filter, paginate hoặc chọn featured.
- Giữ `CollectionPage` quản lý `?room=`, search trong phòng/tìm toàn bảo tàng, favorites-only, compare, report, Guided Tour 2D và pending/error/empty/retry. `ExhibitGrid` không quản lý những state đó.
- Dùng dữ liệu đã xuất bản; không hardcode tên, hình ảnh, số hiện vật, nhãn niên đại/chất liệu/“bảo vật”, badge category hay số liệu ngoài DTO. Badge ordinal hiện có là **vị trí hiển thị**, không phải định danh hiện vật; nếu giữ thì phải thể hiện đúng ý nghĩa, không để nhầm là mã hồ sơ.
- Thẻ không tự download GLB/khởi tạo Canvas, không phát audio; không dùng ảnh mẫu thay cho dữ liệu thật. Hình ảnh thiếu/hỏng không làm biến mất tiêu đề và đường dẫn.
- Tránh nested interactive: không đặt `button`, FavoriteButton, Compare hoặc Report bên trong `Link`; nếu muốn media/title clickable, dùng liên kết độc lập, đảm bảo thứ tự tab có chủ đích.
- Sử dụng `t(key, fallback)` cho copy UI và `localizeExhibit`/`localizedAltText` cho dữ liệu; hỗ trợ fallback khi CMS chưa có dịch. Giữ đúng tên/description do API cung cấp; ellipsis chỉ làm ngắn **visual**, không xóa nội dung khỏi DOM/accessible name.
- Chỉ dùng CSS tokens `--public-*` dưới public shell. `PublicLayout` hiện cũng chứa `/tour`; regression phải kiểm xem card không ảnh hưởng Admin, Guided Tour hay 3D.
- TypeScript strict, named export, alias `@/`, CSS Module tên tương ứng; không tạo abstraction chưa có ít nhất hai nơi sử dụng.
- Không khẳng định test pass, visual review hay hiệu năng đã đạt khi chưa chạy. Mỗi commit chứa thay đổi nhỏ, review staged diff, không stage `.env`/build output/screenshot tự động.

## Thiết kế cần thực hiện

### ExhibitCard

- **Media:** khung poster cố định tỷ lệ 4:3 mặc định; nếu có ảnh thì `object-fit: contain`, padding/nền phù hợp để giữ nguyên hình dáng hiện vật. Cho phép chiều cao card tự nhiên; không stretch image gây méo/crop.
- **Fallback:** không ảnh, URL lỗi hoặc không hiển thị được phải dùng `ExhibitPreview`/placeholder có nhãn; tuyệt đối không biểu diễn hình minh họa như ảnh hiện vật thật.
- **Typography:** tên serif 21–26 px desktop / 20–23 px mobile (cân theo grid thực), body sans 14–16 px, line-height dễ đọc. Tên dự kiến 2 dòng và mô tả 2–3 dòng ở chế độ preview; nội dung đầy đủ vẫn có tại trang Detail; không cắt text ở alt/aria-label.
- **Cấu trúc:** media → tên → đoạn mô tả → link “Xem chi tiết” → actions phụ của consumer. Đường dẫn chính dùng `/collection/${encodeURIComponent(roomSlug)}/exhibits/${encodeURIComponent(id)}`. H3 trong cards do Home/Collection đều dùng H2 section; không đưa H1/H2 mới vào card.
- **Màu:** surface paper/ivory, viền sand/bronze tiết chế, forest cho action chính. Hover chỉ nâng nhẹ/đổi viền; focus nổi rõ, không chỉ biểu thị bằng màu. Tránh glow, gradient neon và backdrop-filter nặng.
- **Action:** giữ khả năng report qua `onReport`, các hành động yêu thích/so sánh qua `renderActions`, nhãn aria-pressed/disabled từ component đang có. Nút còn focus được trên mobile, không bị overlay chặn; không gây click vào route khi nhấn action.

### ExhibitGrid

- Giữ `ul` có accessible name và `li key={exhibit.id}`. Reuse chung trên Homepage và Collection.
- 1/2/3 cột theo **chiều rộng khả dụng của grid**, không dựa mù vào viewport: Collection sau này có room sidebar. Chiều rộng một card tối thiểu lý tưởng 230–260 px; tại 320 px vẫn 1 cột và không overflow. Bố cục desktop tối đa 3 cột theo SDD.
- `variant` nhỏ gọn chỉ thêm nếu hai consumer cần cách bố trí được chứng minh; mặc định hành vi hiện có, không tạo variant cho mỗi trang. Nếu API thêm prop, giữ tương thích với mọi call site hiện tại.
- Không chuyển logic fetch, sort hoặc error/empty từ Home/Collection vào Grid. Không tạo spinner hoặc badge loading giả trong card; trạng thái request do page/consumer sở hữu.

### Media/i18n contract

- Ưu tiên giữ `ExhibitImage` hiện tại. Dùng `image?.url`, `image.altText` và helper `localizedAltText(altText, locale, exhibit.name)`; nếu ảnh lỗi thì placeholder của CMS (`placeholderShape`, `placeholderColor`).
- Image phải có kích thước khung trước khi load để tránh CLS; ảnh ngoài fold lazy; `alt` chính xác theo locale và không gán alt của image placeholder là ảnh thật. Nếu thay `ExhibitImage` nên có test fail trước cho lỗi URL, đổi `src`, media null; không sửa chung cho Detail ngoài lỗi được chứng minh.
- Dùng `localizeExhibit` trong `ExhibitCard` **hoặc** trong consumer nhưng thống nhất giữa Home và Collection; lựa chọn mặc định: card nhận DTO và localize nội dung hiển thị, không mutate mảng. Collection có thể tiếp tục localize trước cho search; cùng locale phải cho kết quả không đổi.

## File map / ownership

| File | Trách nhiệm và thay đổi dự kiến |
|---|---|
| `front-end/src/shared/components/data/ExhibitGrid.tsx` | Giữ public props `exhibits`, `roomSlug`, `onReport`, `renderActions`; render `<ExhibitCard />` cho mỗi `li` hoặc để Card tự là `li` nhưng chỉ **một** `li`/hiện vật |
| `front-end/src/shared/components/data/ExhibitGrid.module.css` | Chỉ sở hữu grid/breakpoints/gaps; bỏ style/card details sau khi tách |
| `front-end/src/shared/components/data/ExhibitCard.tsx` | Tạo presentational card, dùng DTO, locale/image/link/action slots, không state fetch |
| `front-end/src/shared/components/data/ExhibitCard.module.css` | Tạo art direction, media ratio, card typography/actions/focus/hover/reduced motion |
| `front-end/src/shared/components/media/ExhibitImage.tsx` | Ưu tiên giữ nguyên; chỉ sửa nếu có test chứng minh thiếu sót cụ thể |
| `front-end/src/shared/components/data/ExhibitPreview.tsx` | Giữ placeholder và nhãn dịch hiện có; sửa chỉ khi cần và có regression |
| `front-end/src/pages/client/HomeFeaturedExhibits.tsx` | Chỉ thay prop variant/localization thực sự cần; **không đổi** source, sort, limit, state |
| `front-end/src/pages/client/CollectionPage.tsx` | Giữ `onReport`/`renderActions`, room/search/favorite/compare/Guided Tour; chỉ cập nhật adapter props nếu cần |
| `front-end/tests/shared-exhibit-components.spec.ts` | Tạo test focused: card media/fallback/link/actions/locale/responsive/keyboard/no 3D |
| `front-end/tests/home-featured.spec.ts`, `collection.spec.ts`, `collection-global-search.spec.ts`, `visitor-favorites.spec.ts`, `visitor-comparison.spec.ts`, `public-image-audio.spec.ts` | Regression suites cần chạy, ưu tiên không sửa assertion khi không có thay đổi đúng sản phẩm |
| `docs/plans/shared-exhibit-components-plan.md`, `docs/tasks/shared-exhibit-components.md` | Plan, checklist, bằng chứng thực tế và commit ledger |

**Không có nhu cầu sửa mặc định:** `front-end/src/styles/aura.css`, `front-end/src/app/theme.ts`, router, APIs, admin, 3D scene hoặc CSS page-specific. Nếu một file không có lý do rõ, không đưa vào commit.

## SEC-01: Baseline, dependency gate và chốt phạm vi

**Files:** `docs/plans/shared-exhibit-components-plan.md`, `docs/tasks/shared-exhibit-components.md`; đọc source/tests, không sửa UI.\
**Consumes:** `origin/dev`, SDD, Foundation và regressions. **Produces:** baseline có thể tái hiện, nhánh đúng base và scope được kiểm tra.

- [x] **Bước 1 — Xác nhận base.** Fetch `origin/dev` tại `e63677f`; PR #195 đã merge Foundation. Tạo `feat/shared-exhibit-components` trực tiếp từ base này, không stacked.
- [x] **Bước 2 — Audit callers.** Dùng CodeGraph và đọc design/coding conventions; xác nhận Grid có Home/Collection consumers, Collection localize trước Grid, Home chưa localize, các media/action contracts hiện hữu.
- [x] **Bước 3 — Baseline.** Typecheck/lint/unit/build pass; focused Playwright 51/53 với hai assertion sai phạm vi/loading (được ghi trong task); chụp Home/Collection tại 390/1440 light/dark.
- [ ] **Bước 4 — Review hai tài liệu.** Đối chiếu đúng SDD, stage docs và xem staged diff; chỉ commit sau khi được chấp thuận triển khai.

**Commit dự kiến:** `docs(public): plan shared exhibit component redesign`.

## SEC-02: Extract `ExhibitCard` — refactor thuần túy

**Files:** `ExhibitGrid.tsx`, `ExhibitGrid.module.css`, tạo `ExhibitCard.tsx` và `ExhibitCard.module.css`; focused tests nếu cần khóa contract.\
**Consumes:** Grid và callback API hiện có. **Produces:** Card riêng, DOM/visual/hành vi chưa đổi.

- [ ] **Bước 1:** Viết/khóa assertions về `ul/li` một hiện vật một item, thứ tự, H3, link encoded slug/ID, callback `onReport`, `renderActions`, không Canvas.
- [ ] **Bước 2:** Di chuyển JSX của từng item sang `ExhibitCard`; giữ `ExhibitGrid` chỉ lặp và giữ nguyên chữ ký props, key, accessible labels, action slots.
- [ ] **Bước 3:** Chuyển các CSS selector thuộc card từ Grid CSS sang Card CSS với cùng style cũ. **Chưa đổi token, tỉ lệ ảnh, breakpoint hay copy.**
- [ ] **Bước 4:** Chạy focused Home + Collection + favorite/compare và typecheck/lint; bảo đảm không có nested interactive; review staged diff rồi commit.

**Commit dự kiến:** `refactor(public): extract presentational exhibit card`.

## SEC-03: Palette, typography và bề mặt thẻ

**Files:** chỉ `ExhibitCard.module.css`, cập nhật test visual/contrast nếu cần.\
**Consumes:** `--public-*` từ Foundation. **Produces:** art direction mới cho card, chưa thay image geometry hoặc grid.

- [ ] **Bước 1:** Thay glass/glow/gradient bằng paper, forest, bronze và border semantic tokens; giữ CSS scoped, không sửa `aura.css`/Admin.
- [ ] **Bước 2:** Typography serif cho tên, sans cho mô tả/nút, spacing/radius/shadow theo SDD; giữ tên và đoạn văn từ CMS, không thêm badge category/năm/chất liệu.
- [ ] **Bước 3:** Kiểm token light/dark, text contrast, focus/hover có state không chỉ dựa màu. So ảnh card Home/Collection ở cùng điều kiện; test/commit riêng.

**Commit dự kiến:** `style(public): apply heritage palette and card typography`.

## SEC-04: Media frame và poster/placeholder presentation

**Files:** `ExhibitCard.module.css`; `ExhibitImage.tsx`/`ExhibitPreview.tsx` chỉ nếu phát hiện bug có test.\
**Consumes:** poster image hoặc CMS placeholder đã có. **Produces:** media frame 4:3 nhất quán, không cắt hiện vật.

- [ ] **Bước 1:** Đặt tỷ lệ 4:3 và khung giữ chỗ trước load; poster dùng `object-fit: contain`, ảnh ngang/dọc và nền trong suốt không bị crop/méo; không tăng nguy cơ CLS không cần thiết.
- [ ] **Bước 2:** Giữ đúng `ExhibitImage` và `ExhibitPreview`; không làm placeholder trông giống ảnh hiện vật thật, không tự sinh URL.
- [ ] **Bước 3:** Viết focused tests ảnh thật, null, lỗi và ảnh đổi URL nếu thay shared image logic. Nếu chỉ CSS, xác nhận geometry/screenshot trước–sau và focused tests.
- [ ] **Bước 4:** Kiểm mobile, light/dark, image loading; review staged diff và commit riêng.

**Commit dự kiến:** `style(public): standardize exhibit media frame`.

## SEC-05: Container-responsive `ExhibitGrid`

**Files:** `ExhibitGrid.module.css` và test layout.\
**Consumes:** Grid API hiện có. **Produces:** 1/2/3 cột theo bề ngang có thật của vùng chứa, không ép 3 cột khi Collection có sidebar.

- [ ] **Bước 1:** Chọn CSS Grid/breakpoints dựa trên available width (container query hoặc cơ chế tương đương có fallback); không làm thay đổi thứ tự DOM hay số items.
- [ ] **Bước 2:** Card tối thiểu khoảng 230–260 px khi đủ chỗ, tại 320 px là 1 cột; giới hạn tối đa 3 cột, không bóp card hay tràn sidebar.
- [ ] **Bước 3:** Test vùng chứa hẹp hơn viewport, responsive 320/390/768/1024/1440, tên dài và zoom nếu môi trường hỗ trợ. Không gộp sửa Header/Collection Sidebar vào commit này.
- [ ] **Bước 4:** Chạy test Home/Collection, xem screenshots + staged diff rồi commit.

**Commit dự kiến:** `style(public): make exhibit grid container responsive`.

## SEC-06: Nội dung đa ngôn ngữ và accessible image alt

**Files:** `ExhibitCard.tsx`, `HomeFeaturedExhibits.tsx` nếu cần adapter; `CollectionPage.tsx` chỉ khi có bằng chứng cần thiết; focused tests.\
**Consumes:** `localizeExhibit`, `localizedAltText`, `usePublicLocale`. **Produces:** tên, mô tả và alt nhất quán, không dịch lặp hoặc mutate dữ liệu.

- [ ] **Bước 1 — Test RED cho lỗi thật.** Vi/en và locale thiếu bản dịch; kiểm Home featured có nội dung/alt cùng quy tắc với Collection. Hiện grid dùng `altText.vi`, còn Collection đã `localizeExhibit` trước search.
- [ ] **Bước 2 — Chốt ownership.** **Ưu tiên localize trước khi truyền vào Grid:** Collection giữ mapping đã có; HomeFeatured dùng `localizeExhibit` cho danh sách đã chọn nhưng không đổi order/limit; Card dùng `localizedAltText(altText, locale, name)` để tạo alt. Không localize lần hai trong Card khi consumer đã làm.
- [ ] **Bước 3:** Giữ fallback nội dung VI và fallback alt có ý nghĩa; không dùng UI locale để giả định audio/ảnh mới tồn tại. Kiểm không đổi search/filter và không mutate React Query cache.
- [ ] **Bước 4:** Chạy tests i18n + Home/Collection; commit riêng khi mọi contract đã xanh.

**Commit dự kiến:** `fix(public): localize shared exhibit content and image alt`.

## SEC-07: Detail link, Report/Favorite/Compare và keyboard

**Files:** `ExhibitCard.tsx` hoặc style focus, adapter consumer chỉ nếu cần; focused tests.\
**Consumes:** `onReport`, `renderActions`, Detail route. **Produces:** thao tác độc lập với link, không nhảy trang ngoài ý muốn.

- [ ] **Bước 1:** Test click/Enter cho link detail encoded; click/Space/Enter cho Report, Favorite, Compare. Không nested `button` trong `Link`, không bubbling gây navigation.
- [ ] **Bước 2:** Kiểm focus ring, tab order và touch targets với actions có thật. Không bỏ `aria-pressed`, disabled hoặc trạng thái visitor; không sửa visitor store nếu không có lỗi.
- [ ] **Bước 3:** Chỉ sửa code khi test làm lộ lỗi; giữ renderActions callback và onReport contract. Chạy focused visitor regressions, staged diff rồi commit.

**Commit dự kiến:** `fix(public): keep exhibit card actions independent` **nếu có code fix**; nếu chỉ thêm tests, dùng `test(public): cover exhibit card actions`. Không tạo commit rỗng.

## SEC-08: Media error và giới hạn tải tài nguyên

**Files:** chủ yếu `front-end/tests/shared-exhibit-components.spec.ts`; image component chỉ khi có regression được chứng minh.\
**Consumes:** `ExhibitImage` / fallback hiện hữu. **Produces:** bằng chứng riêng cho trường hợp media lỗi và không tải 3D/audio do card.

- [ ] **Bước 1:** Test ảnh hợp lệ, không có ảnh, URL lỗi/404, thay src và placeholder CMS (shape/color) đúng nhãn.
- [ ] **Bước 2:** Theo dõi request: chỉ render card không được tự gọi GLB, scene, Canvas/Three hoặc phát audio; không thêm timeout giả định.
- [ ] **Bước 3:** Nếu phát hiện bug, viết test fail trước và commit fix độc lập với regression; nếu hành vi hiện tại đúng, chỉ commit focused tests.
- [ ] **Bước 4:** Chạy tests liên quan đến image/audio và Home/Collection, review staged diff rồi commit.

**Commit dự kiến:** `test(public): cover exhibit media fallbacks and resource isolation`; thêm commit `fix(public): ...` chỉ khi thật sự có bug.

## SEC-09: Integration regression, responsive và accessibility QA

**Files:** tests/fixtures khi cần, không thay production code nếu không có bug cụ thể.\
**Consumes:** shared Card/Grid đã ổn định. **Produces:** test hồi quy và ảnh QA cho hai consumer.

- [ ] **Bước 1:** Chạy `home-featured`, `collection`, `collection-global-search`, `visitor-favorites`, `visitor-comparison`, `public-image-audio`, `public-language`, `public-ui-translations` cùng suite mới; giữ featured tối đa 3, search/room/filter/compare/report, loading/empty/error/retry.
- [ ] **Bước 2:** Xác minh layout ở 320/390/768/1024/1440, light/dark; ảnh và text dài, keyboard, focus, reduced motion; zoom 200/400%, screen reader và mobile thật chỉ đánh PASS nếu đã thử thực tế.
- [ ] **Bước 3:** So sánh ảnh theo SDD và reference có thật, không nhận pixel-perfect khi thiếu mockup. Check Admin `/tour` không đổi do CSS scoped.
- [ ] **Bước 4:** Nếu thêm test e2e/fixtures để khóa integration, commit test riêng. Nếu lỗi production, fix bằng commit riêng đi kèm regression.

**Commit dự kiến:** `test(public): verify shared cards across home and collection` (chỉ nếu có test mới).

## SEC-10: Quality gates cuối và bàn giao

**Files:** `docs/plans/shared-exhibit-components-plan.md`, `docs/tasks/shared-exhibit-components.md`; source chỉ sửa trong commit fix riêng nếu phát hiện lỗi.\
**Consumes:** tất cả slice trước. **Produces:** báo cáo kiểm chứng, SHA đúng, trạng thái review và phạm vi còn lại.

- [ ] **Bước 1:** `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, focused Playwright; ghi số test, pass/fail, cảnh báo; không suy luận đã đạt từ log cũ.
- [ ] **Bước 2:** Review `git diff origin/dev...HEAD`, từng `git show <sha>`, `git diff --check`, staged file list; bảo đảm không có file `.env`, artifact hoặc source ngoài scope.
- [ ] **Bước 3:** Ghi commit SHA, lệnh/đầu ra kiểm thử, screenshots, giới hạn của browser/device/screen reader và các hạng mục cần duyệt vào task ledger.
- [ ] **Bước 4:** Gửi ảnh/kết quả để người dùng duyệt; chưa tự push, tạo PR hay merge khi chưa được yêu cầu.

**Commit dự kiến:** `docs(public): record shared exhibit verification` (chỉ khi có evidence thực). Không tạo commit rỗng.


## Test commands / review gates

Chạy từ `front-end/` (Windows PowerShell có thể dùng `npm.cmd`):

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test -- shared-exhibit-components.spec.ts home-featured.spec.ts collection.spec.ts collection-global-search.spec.ts visitor-favorites.spec.ts visitor-comparison.spec.ts public-image-audio.spec.ts public-language.spec.ts public-ui-translations.spec.ts
```

Trước từng commit, tại repository root:

```powershell
git status --short
git diff --check
git diff --stat
git add -- <chinh-xac-cac-file-cua-task>
git diff --cached --check
git diff --cached
git commit -m "<conventional-commit-message>"
```

**Chú ý:** Lệnh trong `<...>` là placeholder, thay bằng đường dẫn/message thực tế. Không chạy nguyên văn; không `git add .` làm trộn changes ngoài scope. Nếu test fail, ghi lỗi và sửa; không xóa test hoặc sửa expectation để hợp thức hóa bug.

## Nguyên tắc commit nhỏ và review

- Mười mục SEC-* là **checkpoint công việc**, không bắt buộc phải có đúng mười Git commits. Không tạo commit rỗng để đủ số lượng; nếu không sửa code thì ghi `no-op` có lý do trong task ledger.
- Mỗi commit chỉ giải quyết **một lý do thay đổi**, giữ project buildable, chạy targeted checks, review `git diff --cached --check` và staged diff trước commit. Khi một thay đổi cần test để chứng minh, commit **code và regression test cùng một slice**.
- Test-first cho behavior fixes; refactor SEC-02 phải không đổi hình thức UI. Các commit style SEC-03/04/05 tách riêng, và bug phát hiện trong SEC-08/09 có commit `fix` riêng kèm test.
- Các message Conventional Commits trong plan là **đề xuất**, sửa wording theo diff thực tế; không rewrite lịch sử để ép khớp kế hoạch. PR duy nhất vẫn là `feat/shared-exhibit-components` → `dev` sau khi base Foundation hợp lệ.

## Definition of Done / self-review

- [ ] `ExhibitGrid` và `ExhibitCard` dùng chung cho Homepage + Collection; API props/callers tương thích.
- [ ] Featured vẫn tối đa 3, giữ sort và room selection; Collection vẫn room/filter/search/favorite/compare/report/Guided Tour.
- [ ] Cards đẹp theo SDD, media không crop, fallback có thật, không thêm dữ liệu tưởng tượng.
- [ ] Link Detail và các action độc lập, keyboard/accessible; i18n/alt tương ứng locale.
- [ ] Grid 1/2/3 cột theo **available width** và không overflow ở 320 px, light/dark/reduced motion.
- [ ] Không tải GLB/khởi tạo Canvas; không thay backend/Admin/3D scene hoặc global tokens.
- [ ] Affected browser/unit/typecheck/lint/build PASS có log thực, screenshot/giới hạn thiết bị rõ.
- [ ] Các slice SEC-01…SEC-10 có commit độc lập khi thực sự có thay đổi, mỗi commit build/test được, staged diff clean; người dùng duyệt kết quả trước khi PR/merge.

**Trạng thái tại lúc viết:** mới lập kế hoạch, chưa tạo branch/code/commit/test cho Shared Exhibit Components. Đây là kế hoạch đề xuất, không phải bằng chứng đã triển khai.
