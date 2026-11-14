# Task T-PUBLIC-FOUNDATION: Public Foundation & Shell

**Trạng thái:** Implementation và regression đã hoàn tất trên nhánh `feat/public-foundation`; đang chờ người dùng xem giao diện. Chưa push/PR/merge.
**Base code:** `origin/dev` tại `946c883420b4499894fad24c05f975ff206b537b` (13/11/2026 UTC), xác nhận mới nhất ngày 14/11/2026.
**Nhánh triển khai:** `feat/public-foundation` (đã tạo từ `origin/dev`).
**Plan:** [public-foundation-plan.md](../plans/public-foundation-plan.md).
**Design:** [PUBLIC_PORTAL_DESIGN.md](../architecture/fe/PUBLIC_PORTAL_DESIGN.md).
**Convention:** [Frontend coding conventions](../architecture/fe/coding-conventions.md).

## Mục tiêu

Thiết lập **hệ thống nhận diện và khung giao diện public dùng chung** cho Aura Museum (design tokens, typography, header, mobile navigation, footer), làm nền để tiếp tục redesign Homepage, Collection và Exhibit Detail. Mỗi phần triển khai được **kiểm thử và commit riêng**, dễ rà soát/hoàn tác, không thay nội dung ba trang ngay trong task này.

## Phạm vi đã được người dùng đồng ý

- Phong cách *Contemporary Heritage Editorial*: ivory, forest-green, bronze tiết chế, serif cho heading nghệ thuật, sans cho hành động/đọc.
- Light/dark mode vẫn hoạt động, font đủ dấu tiếng Việt và locale hiện có.
- Header logo, `/`, `/collection`, `/tour`; active state, sticky header, CTA vào 3D.
- Navigation mobile qua Drawer, locale/theme, đầy đủ keyboard/Escape/focus; đường vào `/tour` giữ trạng thái Guided Tour hiện có.
- Footer thương hiệu, các route public/`/admin`, responsive và copyright.
- CSS/tokens phải được **scope cho Public**; không làm đổi Admin CMS hoặc HUD/scene của `/tour`.
- Giữ toàn bộ feature hiện có của ba trang và các tính năng visitor, audio, 3D, report, search, tour.

## Phụ thuộc và giới hạn

- SDD là nguồn quyết định visual. Hai ảnh Homepage/Collection đã duyệt là tham chiếu về bố cục/màu nhưng không có trong checkout; không coi ảnh AI là media hiện vật production.
- Tái dùng React 18, Mantine 7, CSS Modules, React Router 6, `usePublicLocale`, `ThemeToggle`, `guidedTour3dPath` và logo hiện tại.
- Không thêm route, data/API mới, dependency, backend/database/CMS, không sửa shared `app/theme.ts`.
- Không đổi `HomePage`, `CollectionPage`, `ExhibitDetailPage`, `ExhibitGrid`, AudioPlayer hoặc MuseumScene trong phần này.
- `PublicLayout` là shell chung cho `/tour`; CSS không được làm thay đổi trải nghiệm 3D. Mantine Drawer có portal nên phải kiểm tra style/locale khi mở.
- Không tự động commit/push/PR trước khi nhận yêu cầu thao tác Git; bảng dưới là **đề xuất ranh giới commit**, không phải commit đã tồn tại.

## Task dự kiến và commit

| Task | Deliverable | Commit message(s) | Commit SHA(s) |
|---|---|---|---|
| PF-01 | Khảo sát source, baseline và tài liệu | `docs(public): plan foundation shell redesign` | `07e6071942afb8b113948131a2e27defd265ef96` |
| PF-02 | Public-scoped tokens, light/dark, typography | `style(public): add scoped heritage tokens and typography` | `e738dc8c3b69928974b5f2bec0c1927e63b4419f` |
| PF-03 | Header + desktop nav + CTA 3D | `feat(public): redesign desktop header and navigation` | `670b6f1c280e5c3268d8ff9d3c52fdf07fdc71a1` |
| PF-04 | Drawer mobile + bảo toàn Guided Tour deep link | `fix(public): preserve guided tour links in mobile drawer` | `c751b8b0ef7ee9748746eb412ff84e271f2f58e1` |
| PF-05 | Footer + responsive public shell | `feat(public): refine editorial footer and responsive shell` | `94627b7c264055b3f2e6849b0d059f83cd44e209` |
| PF-06 | Kiểm thử tổng thể, ghi bằng chứng và bàn giao | `test(public): cover shell routes themes and accessibility`; `docs(public): record foundation verification` | test `049566c0f5e320568c5986305e2f4a9b7a9a0409`; docs this handoff commit |

> Các mã PF-* chỉ để liên kết task và commit, **không phải mã PR**. Chỉ commit sau khi thay đổi đã được kiểm chứng; không tạo commit rỗng để khớp số dòng trong bảng. Nếu phát hiện bug ngoài phạm vi, ghi issue; nếu bug nằm trong phạm vi thì commit `fix(...)` riêng cùng regression test.

## Checklist thực hiện

### PF-01 — Khảo sát và baseline

- [x] Fetch `origin/dev`, kiểm tra working tree; xác nhận source mới nhất không xung đột design.
- [x] Kiểm tra `PublicLayout`, tokens hiện có, header/footer, active nav, mobile Drawer, locale/theme và Tour state.
- [x] Ghi baseline typecheck/lint/build/Playwright và screenshot (kể cả blocker nếu không chạy được).
- [x] Review đúng plan/task, commit tài liệu khi đã có quyền thực thi và có bằng chứng kiểm tra.

### PF-02 — Tokens và typography

- [x] Định nghĩa semantic public tokens trong `PublicLayout.module.css`, có light/dark scoped, giữ alias đang tiêu thụ.
- [x] Bảo đảm không override `:root`, `--aura-*` toàn cục hoặc Mantine theme của Admin.
- [x] Kiểm font tiếng Việt, font fallback/font swap, locale dài, contrast text/controls/focus.
- [x] Kiểm screenshot 320/390/768/1440 light/dark và CSS isolation; review/stage/commit riêng.

### PF-03 — Header và desktop navigation

- [x] Viết Playwright assertions cho landmarks, skip link, logo, 3 nav items, `aria-current`, 3D CTA.
- [x] Dựng header theo visual reference, giữ tour href/pause, locale/theme hoạt động.
- [x] Kiểm desktop keyboard, scroll sticky, 768/1024/1440 px và vi/en; test rồi commit.

### PF-04 — Drawer mobile và Guided Tour

- [x] Thêm regression chứng minh mobile Tour link dùng đích `tour3dHref` phù hợp khi tour đang dở.
- [x] Đồng bộ handler/href giữa mobile Drawer, desktop nav và CTA; đóng Drawer sau chọn link.
- [x] Kiểm Burger, Escape, backdrop, focus trap/restore, locale/theme, 320/390/768 px; commit riêng.
- [ ] Chưa kiểm zoom trình duyệt 200% thực tế.

### PF-05 — Footer và responsive

- [x] Dựng footer editorial, giữ liên kết `/`, `/collection`, `/tour`, `/admin`; không thêm nội dung tự suy đoán.
- [x] Kiểm keyboard, long text, light/dark, page ngắn và mobile một cột.
- [x] Chụp screenshot 1440/1024/768/390/320; test và commit riêng.

### PF-06 — Regression và bàn giao

- [x] Chạy focused Playwright và các regression locale/Tour/Admin/3D đã liệt kê trong plan.
- [x] Chạy `npm run typecheck`, `lint`, `test:unit`, `build`; ghi pass/fail, không đánh dấu PASS bằng dự đoán.
- [x] Đo contrast và kiểm keyboard/focus/Drawer; stylesheet có rule reduced-motion.
- [ ] Chưa xác minh zoom 200/400%, screen reader hoặc thiết bị thật.
- [x] Kiểm tra diff toàn branch, staged files, diff check; sửa bug có regression trong commit `fix` riêng.
- [x] Ghi SHA thực tế, logs/screenshot/giới hạn kiểm thử, và trạng thái duyệt UI/PR vào tài liệu.

## Điều kiện nghiệm thu

- [x] Header/footer thống nhất art direction của SDD; route, text và logo đúng dữ liệu thật.
- [x] Không thêm menu route không tồn tại; desktop và mobile nhấn vào 3D cho kết quả đúng, không mất phiên Guided Tour.
- [x] Public token hoạt động light/dark mà Admin CMS và `/tour` không bị ảnh hưởng ngoài ý muốn.
- [x] Ngôn ngữ vi/en và các locale dài không mất nhãn, lỗi font hoặc chữ có dấu; menu/theme toggle còn dùng được.
- [x] `skip link`, 1 main landmark, focus visible, active route, Burger/Drawer keyboard/Escape/return-focus đúng.
- [x] Không overflow ngang ở 320, 390, 768, 1024, 1440 px theo Playwright.
- [ ] Chưa kiểm browser zoom 200/400% hoặc xác minh reduced-motion bằng trình duyệt.
- [x] Contrast text thường ≥4.5:1, chữ lớn ≥3:1, non-text controls thiết yếu ≥3:1 trên nền thực tế.
- [x] Không đổi API, backend, CMS, 3D engine, viewer, visitor flow hay nội dung body của ba trang.
- [x] Typecheck/lint/build/unit và affected browser tests đạt hoặc có blocker được nêu rõ trước bàn giao.
- [x] Mỗi commit có mục đích cụ thể và test/evidence tương ứng; reviewer có thể xem `git show <SHA>` theo từng slice.
- [ ] Người dùng chưa review/sign off ảnh cuối; không push/PR/merge khi chưa được yêu cầu.

## Ngoài phạm vi

Không implement hero/featured Homepage, bố cục/filter Collection, trang Exhibit Detail, 3D lazy viewer, model GLB, layout phòng 3D, admin CMS hoặc API/backend. Không thay nguồn dữ liệu/số liệu lịch sử, không thêm thư viện visual mới. Những phần khác biệt tạm thời giữa shell và page cũ được ghi lại cho lượt redesign sau.

## Kiểm chứng và bàn giao

**Dự kiến chạy từ `front-end/`:**

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test -- public-foundation.spec.ts public-language.spec.ts public-ui-translations.spec.ts public-tour-navigation.spec.ts accessibility-keyboard.spec.ts admin-navigation-keyboard.spec.ts museum-immersive-ui.spec.ts
```

**Trước mỗi commit (từ repository root):** `git status --short`, `git diff --check`, chạy test liên quan, stage đúng file của task, `git diff --cached --check`, `git diff --cached`, sau đó commit.

**Ledger thực thi (chỉ điền sau khi code):**

| Task | SHA thực tế | Lệnh/test và kết quả | Screenshot/đánh giá | Trạng thái |
|---|---|---|---|---|
| PF-01 | `07e6071942afb8b113948131a2e27defd265ef96` | Fetch `origin/dev`; base matches current remote at `946c883420b4499894fad24c05f975ff206b537b`. Baseline typecheck/lint/unit/build and focused regressions recorded at start. | Baseline shots were not retained by Playwright output cleanup; final screenshots captured below. | Done |
| PF-02 | `e738dc8c3b69928974b5f2bec0c1927e63b4419f` | Typecheck/lint/unit/build pass; contrast ratios measured; global `--aura-*` unchanged. | Vietnamese text and light/dark palette checked; Admin/immersive regressions pass. | Done |
| PF-03 | `670b6f1c280e5c3268d8ff9d3c52fdf07fdc71a1` | Desktop navigation, landmarks, active route, CTA and responsive tests pass in 52-test suite. | Header checked at 1024/1440; tablet 768 uses Drawer to avoid wrapped nav. | Done |
| PF-04 | `c751b8b0ef7ee9748746eb412ff84e271f2f58e1` | Guided Tour deep link/pause, locale/theme, Escape, backdrop, focus trap/restore pass. | 320/390/768 tested; actual browser zoom not checked. | Done with zoom limitation |
| PF-05 | `94627b7c264055b3f2e6849b0d059f83cd44e209` | Footer routes, unsupported claim removal, short-page positioning and focus contrast tests pass. | Header/footer captured light/dark at 320/390/768/1024/1440; Drawer at 390/768. | Done |
| PF-06 | test `049566c0f5e320568c5986305e2f4a9b7a9a0409`; docs evidence in this handoff commit | Playwright 52/52; unit 65 files / 408 tests; typecheck, lint and build pass. Build reports >500 kB chunks. | Contrast values and remaining manual checks listed below. | Automated checks done; manual zoom/screen-reader/device checks remain |

### Kết quả kiểm chứng thực tế

- Quality gates (`front-end/`): `npm run typecheck` PASS; `npm run lint` PASS; `npm run test:unit` PASS (65 files, 408 tests); `npm run build` PASS (cảnh báo chunk JS lớn hơn 500 kB).
- Focused browser command theo plan — **52 passed**: `npm run test -- public-foundation.spec.ts public-language.spec.ts public-ui-translations.spec.ts public-tour-navigation.spec.ts accessibility-keyboard.spec.ts admin-navigation-keyboard.spec.ts museum-immersive-ui.spec.ts`.
- Screenshot artifacts: `front-end/test-results/public-foundation-after-*` (ignored, không commit). Header/footer light/dark tại 320/390/768/1024/1440 px; Drawer tại 390 light/dark và 768.
- Contrast: light ink 13.49:1, muted 6.17:1, forest 9.37:1, bronze text 6.81:1, focus 7.82:1, CTA 10.23:1 (hover 7.51:1); dark ink 14.46:1, muted 10.23:1, forest 9.15:1, bronze text 8:1, focus 8.47:1, CTA 5.64:1 (hover 6.04:1). Footer text/muted/hover/focus: 13.58:1 / 9.60:1 / 8.56:1 / 9.06:1.
- Chưa kiểm browser zoom 200/400%, screen reader hoặc điện thoại thật; không ghi các mục này là PASS.
- Hai mockup được nhắc trong SDD không có trong checkout; đánh giá dựa trên design text và ảnh QA, cần người dùng xem/sign off.
- Branch local-only; không push/PR/merge.

Khi bàn giao cần nêu branch, base SHA thật, danh sách commit, số test pass/fail, screenshot desktop/mobile, những điểm chưa được test thực tế và trạng thái push/PR. **Bảng trên ghi nhận commit và kiểm chứng đã chạy.** UI sign-off của người dùng và các manual checks liệt kê ở trên còn mở.
