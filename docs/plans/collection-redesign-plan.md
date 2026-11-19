# Collection Redesign — Implementation Plan

> **For agentic workers:** Thực hiện theo thứ tự task, đọc source thật ở HEAD trước mỗi slice, test liên quan trước và sau, review staged diff rồi mới commit. Đây là **plan mới, chưa triển khai**; không tự điền kết quả kiểm thử hoặc SHA. Theo `docs/plans/client-homepage-plan.md` và `docs/plans/client-collection-plan.md`: **chỉ hai file Plan/Task, không tạo `commit-plan.md`**.

**Goal:** Thiết kế lại route `/collection` theo **Contemporary Heritage Editorial** trong `docs/architecture/fe/PUBLIC_PORTAL_DESIGN.md` §7: banner tối, thanh duyệt phòng và tìm kiếm, room feature panel, gallery hiện vật thống nhất với Home, giữ nguyên hành vi công khai của hệ thống.

**Architecture:** `CollectionPage()` vẫn là owner của `useMuseumRooms(searchParams.get('room'))`, query/filter state, `useGuidedTour2D`, Visitor/Compare/Report; các section presentational được tách **chỉ khi giúp review độc lập**. `ExhibitGrid`/`ExhibitCard` giữ contract, container query hiện có (524/800px). `GlobalExhibitSearch` giữ `useInfiniteQuery`/debounce 300ms/ít nhất 2 ký tự và logic vị trí kết quả liên phòng. CSS Module scoped và `--public-*` từ `PublicLayout`, không chuyển UI sang kiến trúc mới hoặc tạo API mới.

**Tech Stack:** React 18, TypeScript, Vite, Mantine 7, React Router 6, TanStack Query, Tabler Icons, CSS Modules, Playwright, Vitest, axe-core.

**Status:** IN PROGRESS trên `feat/public-collection-redesign`, tạo trực tiếp trong checkout project từ `origin/dev` tại `2de067bd2a2fa688aa35b65649dadedaac085e4f`.

**Baseline khảo sát:** `origin/dev` SHA `2de067bd2a2fa688aa35b65649dadedaac085e4f`, kiểm tra ngày 19/11/2026; trước khi tạo nhánh phải `git fetch origin` và ghi **SHA thực tế** mới nếu đã đổi. PR mục tiêu: `dev`. Nhánh đề xuất: `feat/public-collection-redesign`.

**Task spec:** [collection-redesign.md](../tasks/collection-redesign.md) · **Design:** [PUBLIC_PORTAL_DESIGN.md](../architecture/fe/PUBLIC_PORTAL_DESIGN.md) · **Convention:** [coding-conventions.md](../architecture/fe/coding-conventions.md).

## Global Constraints

- **Chỉ redesign `/collection`.** Không làm Homepage Hero GLB/3D tự xoay (đã bỏ), không làm Full-Bleed Hero, Detail/On-demand 3D Viewer, Admin CMS hoặc engine `/tour` trong PR này.
- Không sửa backend, database, schema/DTO, endpoint, query key, `useMuseumRooms`, visitor stores, guided tour reducer, service, global theme hoặc deps. Nếu có bug có bằng chứng cần sửa vượt scope, báo và tách ticket/commit có lý do, không âm thầm mở rộng.
- Dữ liệu: chỉ room/exhibit đã xuất bản thực tế qua API; **không có ảnh đại diện room trong DTO hiện tại**. Dùng motif/màu nền trung tính, không giả hình ảnh phòng thật, không hardcode taxonomy/năm/chất liệu/sort “nổi bật” khi API không có.
- Giữ `?room=slug` và mọi query parameter khác, Back/Forward, không âm thầm chọn phòng khác khi room không public; sort bản sao `displayOrder` rồi ID, không mutate cached DTO.
- Giữ nội dung và vị trí có ý nghĩa của: filter tìm kiếm phòng hiện tại; `GlobalExhibitSearch` khi >=2 ký tự; khi tìm trong phòng không có kết quả thì **kết quả phòng khác lên trước** room gallery; favorite filter, comparison tray/modal, report revisionId, recently viewed, guided 2D↔3D, `VisitorStorageStatus`, retry/refetch stale guard.
- Giữ khả năng dùng 6 locale (vi/en/fr/zh/ko/ja), light/dark, 320px, browser back/forward, keyboard, axe. Nếu thêm UI key thì seed **đủ sáu locale** và kiểm nhất quán fallback; không hardcode tiếng Việt vào UI khác.
- CSS scoped trong Collection (ưu tiên `--public-bg/paper/sand/ink/muted/forest/bronze/border/action-*`); không sửa `aura.css` hoặc `PublicLayout` để chữa lỗi riêng page. Chữ title dùng `--public-font-display`, body dùng `--public-font-body`; kiểm glyph tiếng Việt.
- Không tự tạo PR, push, merge hoặc reset/rebase branch của người dùng khi chưa được yêu cầu. Một feature branch, một PR, nhiều commits nhỏ theo lý do thay đổi. Không tạo commit rỗng.

## Hiện trạng code trên `dev` tại baseline

| Hạng mục | Đã có | Khoảng trống thiết kế |
|---|---|---|
| `CollectionPage.tsx` | Chọn phòng bằng chips (`aria-pressed`), search, favorites, comparison, actions 2D/3D, card grid, global search, recently viewed, loading/error | DOM vẫn intro đơn giản → toolbar → room header, chưa banner/room panel hai cột |
| `CollectionPage.module.css` | Responsive cơ bản, pill và action style | Vẫn chủ yếu dùng `--aura-*`, gradient/glow/glass, chưa theo `--public-*` Foundation |
| `ExhibitGrid` / `ExhibitCard` | Card editorial 4:3, fallback media, container query 1/2/3 cột | Không cần redesign component dùng chung lần nữa; chỉ cần đặt trong gallery đúng bề rộng |
| `GlobalExhibitSearch` | Debounce 300ms, query min 2, kết quả phòng khác, pagination | Chỉ chỉnh presentation/spacing và bảo toàn vị trí khi `noLocalMatch` |
| `ExhibitComparison`/`RecentlyViewed` | Visitor behavior và các trạng thái persisted | Cần hòa vào bố cục mới, không can thiệp state |
| `useGuidedTour2D` + helpers | Start/continue/exit/sync to 3D | Chỉ thay chỗ đặt/nút, không thay semantics |

## Layout mục tiêu (SDD §7)

```text
PUBLIC HEADER (giữ nguyên)
┌──────────────────── COLLECTION BANNER / CHARCOAL ─────────────────────┐
│  Eyebrow · H1 "Bộ sưu tập" · intro editorial · motif trung tính       │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────── BROWSE TOOLBAR ──────────────────────────────────┐
│  [Phòng A] [Phòng B] [...]        [Tìm kiếm]  [Làm mới]                │
└──────────────────────────────────────────────────────────────────────┘
  Khi local search = 0 và global search có kết quả: "Ở các phòng khác"
┌────────── ROOM FEATURE (24–27%) ─────┬──────── GALLERY (73–76%) ────┐
│  Room name/description               │  count · favorites · compare │
│  Room motif (neutral, NO fake photo) │  ExhibitGrid (responsive)    │
│  Guided Tour 2D / Visit 3D           │  loading / empty / retry     │
└──────────────────────────────────────┴───────────────────────────────┘
OTHER-ROOM RESULTS (khi local có kết quả) → RECENTLY VIEWED → FOOTER
```

- **Banner:** charcoal, 240–310px desktop, 190–240px mobile; H1 chỉ một, đoạn giới thiệu ≤2–3 dòng, motif nội bộ trung tính khi chưa có ảnh room thật; không nút đè lên ảnh khó đọc.
- **Toolbar:** chips dùng danh sách room thật; nhiều phòng thì hàng cuộn ngang có affordance và thao tác bàn phím, không tự wrap thành 3–4 hàng dài; ô tìm kiếm có label/clear; Refresh action phụ.
- **Room panel:** desktop khoảng 280–320px tùy khung; không sticky toàn viewport; room title/description/count/actions chỉ từ dữ liệu valid; trạng thái empty vẫn rõ; nút chuyển Tour dùng đúng helper khi có tiến trình Guided Tour.
- **Gallery:** dùng `ExhibitGrid` hiện có; 1/2/3 cột theo **width thực tế của vùng chứa**, không cam kết 3 cột nếu sidebar khiến gallery <800px. Card image 4:3, contain, alt thật, không clone card.
- **Mobile:** room panel **trước gallery**; chips horizontal-scroll, search full width; compare tray/modal không cắt action; 320/390/768/1024/1280/1440px. Không autoplay 3D/WebGL/GLB.
- **Fallback:** no rooms/invalid room/loading/error/refetch stale/favorites-only empty/search empty/media null đều xử lý bằng nội dung thật và thông báo rõ; không lấy cache stale sang room khác.

## File map dự kiến

| File | Vai trò / giới hạn |
|---|---|
| `front-end/src/pages/client/CollectionPage.tsx` | Owner state/query/URL/Guided Tour, cấu trúc sections, giữ UI semantics |
| `front-end/src/pages/client/CollectionPage.module.css` | CSS scoped banner, toolbar, panel/gallery layout, responsive, light/dark |
| `front-end/src/pages/client/CollectionRoomPanel.tsx` *(nếu extract)* | Component thuần trình bày room name, count, description, action slot; **không** dùng hook tour hoặc gọi API bên trong |
| `front-end/src/pages/client/CollectionRoomPanel.module.css` *(nếu extract)* | Chỉ style panel; không tạo nếu JSX trong page nhỏ/đủ review |
| `front-end/src/pages/client/visitor/GlobalExhibitSearch.tsx` *(chỉ nếu cần)* | Presentation, giữ query/pagination/room mapping; phần lớn chỉ sửa scoped CSS |
| `front-end/src/pages/client/visitor/ExhibitComparison.tsx`, `RecentlyViewed.tsx` *(nếu thực sự cần)* | Chỉ chỉnh wrapper/semantics khi có test, không sửa visitor state |
| `front-end/src/shared/components/data/ExhibitGrid.tsx`, `ExhibitCard.tsx` | **Không sửa** trừ bug được test chứng minh; đã shared với Homepage |
| `back-end/src/database/seeds/public-ui-strings.ts` *(khi có key mới)* | Chuỗi UI đủ 6 locale, không sửa API hoặc nội dung dữ liệu |
| `front-end/tests/collection-redesign.spec.ts` | E2E riêng cho visual structure/toolbar/room panel/responsive/states |
| `front-end/tests/collection.spec.ts`, `collection-global-search.spec.ts`, `collection-memo.spec.ts` | Regression hiện có; cập nhật chỉ khi thay đổi chủ đích và giữ assertions contract |
| `front-end/tests/public-a11y-axe.spec.ts`, `public-ui-translations.spec.ts`, `public-foundation.spec.ts`, `public-tour-navigation.spec.ts` | Regression affected surfaces |
| `docs/plans/collection-redesign-plan.md`, `docs/tasks/collection-redesign.md` | Kế hoạch, tiến độ, evidence, commit ledger |

**Không thay route:** `/collection` đã tồn tại; không sửa `router.tsx` nếu không cần thiết. Không nhập ảnh reference từ internet để hiển thị như ảnh thật của bảo tàng.

## Quy trình từng commit

- Review `git status --short`, `git diff --check`, staged paths và `git diff --cached` trước commit. Stage đúng file cho một slice, **không `git add .`**.
- Khi có behavior change, khóa focused tests trước (RED khi thực sự có bug/feature), implement GREEN; CSS-only commit tối thiểu cần screenshot/geometry + focused tests. Không tuyên bố test-first nếu thực tế không có RED.
- Một commit = một lý do thay đổi. `CR-*` là checkpoint, không ép phải đủ số commit. Nếu không có source diff, ghi `no-op` trong Task, không commit rỗng.
- Sau PR/merge phải có visual review thật, không tự coi DOM assertions tương đương duyệt giao diện.

---

## CR-01: Baseline, scope và tài liệu

**Files:** plan/task; đọc CollectionPage, CSS, fixtures, tests, PublicPortalDesign và `origin/dev`.

**Interfaces:** Consumes HEAD `dev`, produces danh sách invariants/baseline trước sửa UI; không sửa production.

- [ ] **Bước 1 — Kiểm nhánh.** `git fetch origin`; xác minh SHA `origin/dev`, branch hiện tại, clean tree; nếu nhánh khác đang làm dở thì không reset/rebase hoặc overwrite, báo branch base thực.
- [ ] **Bước 2 — Chụp baseline.** Chạy focused collection/global-search/visitor/guided tour tests, typecheck/lint/build nếu local sẵn; screenshot 390/1440 light/dark, ghi PASS/FAIL có log và blocker.
- [ ] **Bước 3 — Đối chiếu chức năng.** Tạo invariant checklist: URL `?room`, sorted exhibits, search min2 debounce300, noLocalMatch global-first, favorites/compare/report/tour, `aria-live`, no Canvas.
- [ ] **Bước 4 — Review docs.** Review file plan/task mới, stage riêng và commit docs chỉ khi được phép; không tạo commit code ở bước này.

**Commit dự kiến:** `docs(collection): plan editorial collection redesign` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-02: Refactor section layout, giữ nguyên behavior

**Files:** `CollectionPage.tsx`, `CollectionPage.module.css`, focused `collection.spec.ts` nếu cần.

**Interfaces:** Produces DOM skeleton banner / browse / room+gallery **chưa đổi art direction**, giữ các selector/labels/test contract hiện hành.

- [ ] **Bước 1 — Lock behaviors.** Test/kiểm role main, H1, H2 room, ExhibitGrid list, loading status, link /tour và vị trí `GlobalExhibitSearch` khi local 0.
- [ ] **Bước 2 — Cấu trúc section.** Tách wrappers layout semantic thành intro/banner, toolbar, main layout; `roomHeader`/room actions/filters vẫn nhận cùng data/handler; không gỡ visitor cards.
- [ ] **Bước 3 — Giữ states.** `detail` chỉ khi room/query success; invalid slug báo lỗi, noLocalMatch global-first; không thay thứ tự focus tab hoặc event handlers.
- [ ] **Bước 4 — Verify refactor.** Focused collection, global-search, memo, guided tests; kiểm DOM, screenshots before/after cùng viewport; review staged diff.

**Commit dự kiến:** `refactor(collection): organize page sections for editorial layout` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-03: Editorial banner (C01.1)

**Files:** `CollectionPage.tsx`, `CollectionPage.module.css`, `collection-redesign.spec.ts`.

**Interfaces:** Consumes existing `t(ui.collection.*)`; produces H1 banner charcoal 240–310/190–240, neutral motif, no new image API.

- [ ] **Bước 1 — Visual.** Charcoal full content width, subtle bronze eyebrow, serif H1 và intro; text overlay có contrast; không dùng hero ảnh của exhibit như room photo.
- [ ] **Bước 2 — Tokens.** CSS chỉ `--public-*`, hỗ trợ dark/light, reduced motion; không modify global style hoặc Header.
- [ ] **Bước 3 — Tests.** Test chính xác một H1, heading/CTA không tràn, no decorative focus targets, 320/390/1440 và long translated copy; hero/collection nav không bị ảnh hưởng.
- [ ] **Bước 4 — Review.** Chụp banner ở light/dark, đối chiếu SDD, run focused tests/typecheck/lint rồi commit.

**Commit dự kiến:** `feat(collection): introduce editorial collection banner` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-04: Room chips navigation (C01.2)

**Files:** `CollectionPage.tsx`, `.module.css`, `collection-redesign.spec.ts`, existing `collection.spec.ts`.

**Interfaces:** Consumes public rooms and selectedSlug; produces horizontally scrollable accessible room chips with URL/back-forward unchanged.

- [ ] **Bước 1 — Hành vi.** Giữ button names, `role=group`, `aria-pressed`, `handleSelectRoom` giữ query khác và reset local input như hiện hành; preserve invalid room indicator.
- [ ] **Bước 2 — Layout.** Không wrap thành nhiều hàng; scroll ngang với visible affordance, focus auto scrollIntoView nếu cần; không biến thành taxonomy/mẫu.
- [ ] **Bước 3 — Edge tests.** 10+ rooms tên dài, click/Enter/Space, Arrow/Tab khi phù hợp, URL reload/back/forward, 320px scroll mà không overflow body.
- [ ] **Bước 4 — Verify.** Chạy `collection.spec.ts`, focused new tests và screenshot toolbar cả hai themes rồi commit.

**Commit dự kiến:** `feat(collection): refine accessible room chip navigation` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-05: Search + refresh toolbar (C01.2)

**Files:** `CollectionPage.tsx`, `CollectionPage.module.css`, tests collection/global-search.

**Interfaces:** Consumes local `query`, `setQuery`, `refresh`; produces refined search, optional clear control and visually subordinate Refresh.

- [ ] **Bước 1 — UI.** Search label vẫn accessible, input full width mobile, nút clear chỉ khi query có chữ; Refresh không đổi hàm/key/state.
- [ ] **Bước 2 — Contract.** Giữ case-insensitive name+description, count `shown/total`, search reset khi đổi room, `GlobalExhibitSearch` 300ms debounce & min 2 ký tự.
- [ ] **Bước 3 — Tests.** Search Unicode Vietnamese/case, clear, no extra room request khi local filter, global search only at ≥2, network error không xóa local results.
- [ ] **Bước 4 — Review.** Responsive 320/390/768/1440, keyboard focus và click target; run focused suites, commit riêng.

**Commit dự kiến:** `feat(collection): improve search and refresh toolbar` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-06: Room feature panel — content và motif (C01.3)

**Files:** `CollectionPage.tsx`/CSS; optional `CollectionRoomPanel.tsx`/CSS; tests.

**Interfaces:** Consumes validated `detail`, `exhibits.length`; produces panel room title/description/count without image fabricated.

- [ ] **Bước 1 — Presentation.** Room panel chiếm ~24–27% desktop; title, description, count thật; motif nonsemantic trung tính không giả ảnh phòng; không sticky vượt viewport.
- [ ] **Bước 2 — Optional extract.** Nếu JSX phình to, tách `CollectionRoomPanel` thuần trình bày với `room`, `count`, `children/actionSlot`; không move `useGuidedTour2D` hook vào panel.
- [ ] **Bước 3 — Empty.** 0 exhibits vẫn có room name/description/0 count và state empty ở gallery; no fake material/year/featured image.
- [ ] **Bước 4 — Verify.** Test loading/invalid/empty/long room, snapshot desktop/mobile và scoped CSS; commit riêng.

**Commit dự kiến:** `feat(collection): add room feature panel` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-07: Guided Tour 2D / 3D actions trong room panel

**Files:** `CollectionPage.tsx`, optional panel props, focused guided-tour tests.

**Interfaces:** Consumes `tour2d.isSameRoom/currentStep/startFromRoom/resume/exit/pause` and `guidedTour3dPath`; produces same actions in new panel.

- [ ] **Bước 1 — Giữ điều hướng.** Nếu đang Guided Tour, Continue/Exit và Continue in 3D tới đúng exhibit; nếu chưa tham quan, Start 2D và `tour?room=slug` như cũ.
- [ ] **Bước 2 — Trạng thái rỗng.** Không cho bắt đầu khi 0 exhibits; giữ `aria-describedby` cùng hướng dẫn; không giấu link tới tour nếu route còn hợp lệ.
- [ ] **Bước 3 — Keyboard.** Links/buttons có min44px ưu tiên UX, focus-visible, không nested interactions; text phù hợp 6 locale.
- [ ] **Bước 4 — Verify.** Chạy `public-tour-navigation` + guided-tour suites liên quan và `collection` tests; không đổi reducer/global tour behavior.

**Commit dự kiến:** `refactor(collection): place guided tour actions in room panel` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-08: Gallery composition + Shared Grid (C01.4)

**Files:** `CollectionPage.tsx`, `.module.css`, `collection-redesign.spec.ts`, `shared-exhibit-grid.spec.ts`.

**Interfaces:** Consumes `filtered`, `ExhibitGrid` contract; produces responsive 2-column page and 1/2/3 columns **inside gallery**.

- [ ] **Bước 1 — Grid.** Desktop room panel 280–320px + gallery flexible; avoid `overflow` and preserve minimum 0 grid width, don’t alter ExhibitGrid’s 524/800 container queries.
- [ ] **Bước 2 — Hierarchy.** Gallery own heading/count/filters; preserve `ExhibitGrid` aria label, H3 cards, detail URLs, placeholder media `contain`.
- [ ] **Bước 3 — Container tests.** At widths 320/390/768/1024/1280/1440, measure actual gallery width, active card columns; never hardcode three if gallery is narrower than 800px.
- [ ] **Bước 4 — Verify.** Name/description length, images missing, light/dark; focused grid+collection tests, no shared Card changes; commit.

**Commit dự kiến:** `style(collection): compose responsive room gallery` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-09: Visitor toolbar — favorites / compare / report

**Files:** `CollectionPage.tsx`, CSS, optional visitor wrappers, tests visitor-*.

**Interfaces:** Consumes favoritesStore, `useExhibitComparison`, `PublicReportModal`, ExhibitCard callbacks; produces action area integrated without changing visitor state.

- [ ] **Bước 1 — Presentation.** Đặt favorite filter, comparison tray gần gallery theo SDD; button Report/Favorite/Compare trong Card giữ accessible và tách khỏi Detail link.
- [ ] **Bước 2 — State.** Không đổi local storage key, selection limit 2–3, verified selection, report published revisionId; retain onRemove focus behavior in favorites-only.
- [ ] **Bước 3 — Tests.** Favorite-only 0/filtered/search, compare across rooms and remove/clear/modal, report revision payload, mobile tray/modal no overflow.
- [ ] **Bước 4 — Verify.** Chạy visitor-favorites/visitor-comparison/collection/spec & axe affected; diff stage nhỏ, commit nếu có code.

**Commit dự kiến:** `style(collection): integrate visitor actions with gallery` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-10: Global search và Recently Viewed presentation

**Files:** `CollectionPage.module.css`, optional `GlobalExhibitSearch.tsx`/`RecentlyViewed.tsx`, global-search/regression tests.

**Interfaces:** Consumes `noLocalMatch`, `GlobalExhibitSearch`, `RecentlyViewed`; produces editorial results/panels preserving fetch order & semantics.

- [ ] **Bước 1 — Kết quả liên phòng.** Nếu local search 0 và query≥2, global section **đứng trước room gallery**; nếu local có results, global dưới gallery; giữ search result list names/room/description.
- [ ] **Bước 2 — Pagination.** Không thay debounce 300ms, min 2, page query, cancel/retry, result dedupe; visually distinguish remote results and available action.
- [ ] **Bước 3 — Recent.** Recently Viewed ở dưới phần chính, không xóa dữ liệu/giới hạn access hay thay resolver; chỉnh CSS chỉ nếu cần.
- [ ] **Bước 4 — Verify.** Run `collection-global-search`, visitor recent/compare, empty/error/long names and screenshots; commit riêng nếu diff.

**Commit dự kiến:** `style(collection): clarify cross-room and recent results` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-11: Loading/empty/error/no-match state polish

**Files:** `CollectionPage.tsx`, CSS, `collection-redesign.spec.ts`, existing `collection.spec.ts`.

**Interfaces:** Consumes Query pending/error/success and favorites/search/invalid slug; produces visual state wrappers keeping existing status semantics.

- [ ] **Bước 1 — Loading.** Giữ exactly one visually hidden polite status announcer, `ExhibitSkeleton` trong room/list loading; layout không nhảy quá mức.
- [ ] **Bước 2 — Error/retry.** List/detail invalid schema/API errors, retry/refetch stale guard và invalid slug không hiện content của room cũ; luôn giữ route fallback.
- [ ] **Bước 3 — Empty.** No rooms, no exhibit, favorite-only zero, no-local-match, global empty/messages rõ; no invented placeholder exhibit.
- [ ] **Bước 4 — Tests.** Reuse existing `collection` load/error/refresh tests; add screenshot case pending/error/empty & keyboard/focus; commit riêng.

**Commit dự kiến:** `style(collection): polish collection loading and empty states` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-12: i18n, responsive và accessibility hardening

**Files:** `CollectionPage.tsx`, CSS, `public-ui-translations.spec.ts`, `public-a11y-axe.spec.ts`, `collection-redesign.spec.ts`; UI seed only if required.

**Interfaces:** Produces stable VI/EN/FR/ZH/KO/JA and responsive/a11y evidence without redefining global translations.

- [ ] **Bước 1 — Locale.** Reuse `t(ui.collection.*)` keys; if new copy absolutely required, seed all 6, test missing translation and CMS overrides; no bare Vietnamese UI added.
- [ ] **Bước 2 — Responsive.** Check 320/390/768/1024/1280/1440 in light/dark, long room names/translated strings, landscape, zoom 200% when browser supports; no body horizontal scroll.
- [ ] **Bước 3 — Accessibility.** H1/H2/H3 order, link/button labels, visible focus, skip link, live updates, targets ≥24×24 minimum, reduced motion, `axe` 8 routes matrix including Collection.
- [ ] **Bước 4 — Verify.** Focused test + axe, static contrast checks and manual keyboard walkthrough; document screen reader/device gaps, no blanket WCAG certification.

**Commit dự kiến:** `fix(collection): align editorial layout with locale and accessibility` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-13: Integration regressions và resource isolation

**Files:** front-end/tests/collection-redesign.spec.ts plus existing Playwright suites and minimal test fixes.

**Interfaces:** Produces automated proof of no regression outside Collection.

- [ ] **Bước 1 — User flows.** Home → Collection → change room → search → Detail → back; Collection → Guided 2D/3D; favorites/compare/report and recently viewed.
- [ ] **Bước 2 — Resource isolation.** Collection should not mount Canvas, request GLB/Three 3D scene; no new network traffic except existing rooms/search queries.
- [ ] **Bước 3 — Full affected suites.** Run collection, collection-global-search, collection-memo, shared-exhibit-grid/components, public-ui-translations, public-a11y-axe, public-tour-navigation, visitor-favorites/comparison, public-image-audio; log actual pass/fail.
- [ ] **Bước 4 — Review.** Do not change tests to silence regressions. Fix actual problems with `fix(collection): ...` and regression in same slice; if no new test diff, mark `no-op`.

**Commit dự kiến:** `test(collection): cover editorial integration regressions` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## CR-14: Quality gates, visual sign-off và bàn giao

**Files:** plan/task evidence ledger, screenshots kept ignored (not staged); no production changes absent proven bug.

**Interfaces:** Consumes diff+tests/screenshots; produces release-ready PR evidence, **not** auto-push/merge.

- [ ] **Bước 1 — Gates.** From `front-end/`: `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test:unit`; `npm.cmd run build`; `npm.cmd run test -- <specs>`; record versions/counts/warnings exactly.
- [ ] **Bước 2 — Diff review.** `git diff origin/dev...HEAD --stat`, review each `git show <sha>`, `git diff --check`; staged paths only planned, no .env/secret/screenshots/dist.
- [ ] **Bước 3 — Visual QA.** Compare desktop banner/room panel/gallery vs SDD §7, screenshots 320…1440 light/dark, locales; user sign-off separate from automated assertions.
- [ ] **Bước 4 — Handoff.** Fill task ledger actual SHA/tests/links/gaps, note screen reader/real device/mobile zoom unverified if missing; create PR only if user requests.

**Commit dự kiến:** `docs(collection): record collection redesign verification` *(chỉ khi có thay đổi thực tế và đã kiểm chứng)*.

---


## Test matrix / commands

```powershell
# Chạy sau khi dev server/test config sẵn, từ front-end/.
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test -- collection-redesign.spec.ts collection.spec.ts collection-global-search.spec.ts collection-memo.spec.ts shared-exhibit-components.spec.ts shared-exhibit-grid.spec.ts public-a11y-axe.spec.ts public-ui-translations.spec.ts public-foundation.spec.ts public-tour-navigation.spec.ts public-image-audio.spec.ts
```

Bổ sung đúng tên `visitor-favorites.spec.ts`, `visitor-comparison.spec.ts` và Guided Tour suites nếu tồn tại tại thời điểm chạy; không đưa path không tồn tại vào script của CI. `collection-live.spec.ts` chỉ chạy khi backend live có sẵn và opt-in `MUSEUM_LIVE_TEST=1`; không dùng fixture để giả kết quả live.

| Scenario | Desktop | Mobile | Đặc biệt |
|---|---|---|---|
| Room selection + query URL/history | ✓ | ✓ | 10+ rooms / long names / invalid slug |
| Local search + clear + remote search | ✓ | ✓ | min2/debounce300/noLocalMatch ordering |
| Room feature actions 2D↔3D | ✓ | ✓ | active guided status, empty room |
| Shared Grid / favorites / compare / report | ✓ | ✓ | `renderActions`, revisionId, card intact |
| API pending/error/refetch stale | ✓ | ✓ | no stale content, focused retry |
| Locale / light-dark / reduced motion | ✓ | ✓ | vi/en/fr/zh/ko/ja |
| Accessibility / keyboard | ✓ | ✓ | axe + focus; manual NVDA/VoiceOver only with real hardware |
| Resources / no WebGL | ✓ | ✓ | no Canvas/GLB, no new heavy deps |

## Definition of Done

- [ ] Collection có banner charcoal, room chips/search toolbar, room feature panel và ExhibitGrid trong gallery theo SDD §7.
- [ ] H1 duy nhất; room H2; cards H3. Hero/Collection navigation, Back/Forward, route ?room, guided 2D/3D vẫn đúng.
- [ ] Search local, global results ordering & pagination, favorite, compare, report và recently viewed không đổi data/query/visitor behavior.
- [ ] Không fake room image, metadata, public state; no API/DB/theme/route/3D runtime edits.
- [ ] 320–1440 responsive, light/dark, VI/EN/FR/ZH/KO/JA, keyboard/axe và fallback states được kiểm chứng với bằng chứng thực tế.
- [ ] Tests + build/typecheck/lint pass hoặc các blocker được mô tả rõ; user đã xem ảnh và duyệt visual khi sẵn sàng.
- [ ] Chỉ những commit thực sự có diff và được verify mới được tạo; task ledger đúng SHA/kết quả, không có claims fake.

## Self-review và bàn giao

Đây là **bản kế hoạch trước triển khai**. Không được chuyển `TODO` thành `DONE` chỉ vì dự án đã có code chức năng từ những PR trước. Không khẳng định đã có ảnh room, performance score, live API validation, full WCAG hoặc screen reader device coverage khi chưa thực sự test. Với thay đổi CSS-only, review ảnh desktop & mobile dưới cùng dữ liệu/scheme; giữ một PR duy nhất cho Collection.
