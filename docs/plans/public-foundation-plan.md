# Public Foundation & Shell — Implementation Plan

> **For agentic workers:** Dùng Superpowers `executing-plans` để triển khai **từng task trong phiên được giao**, kiểm chứng trước khi commit. Checklist ban đầu là TODO; chỉ đánh dấu `[x]` khi có kết quả thật. Không tự suy diễn rằng kế hoạch đã được code hoặc duyệt hình ảnh.

**Goal:** Tạo nền tảng giao diện Public Portal theo phong cách *Contemporary Heritage Editorial* đã duyệt: bộ token/typography dành riêng cho public, header và footer mới, navigation desktop/mobile thống nhất, giữ nguyên hành vi hiện có.

**Architecture:** `PublicLayout` tiếp tục sở hữu duy nhất shell (`PublicLocaleProvider`, `MuseumProvider`, `Outlet`, header/footer). Semantic design tokens đặt trong scope public, không sửa theme Mantine toàn ứng dụng. Header/Drawer/CTA dùng chung một logic điều hướng Guided Tour đã có. Các trang Homepage, Collection, Exhibit Detail giữ nguyên nội dung và luồng dữ liệu; phần redesign nội dung thuộc kế hoạch tiếp theo.

**Tech Stack:** React 18, TypeScript, Vite, Mantine 7, React Router 6, Tabler icons, CSS Modules, Vitest và Playwright (Chromium/Edge) đang có trong repo. Không bổ sung dependency mới nếu không có lý do được chấp thuận.

**Task nguồn:** [public-foundation.md](../tasks/public-foundation.md).
**Design authority:** [PUBLIC_PORTAL_DESIGN.md](../architecture/fe/PUBLIC_PORTAL_DESIGN.md), chủ yếu mục 4, 5, 10, 11 và 14; hai hình tham chiếu Homepage/Collection người dùng đã duyệt.
**Coding convention:** [Frontend coding conventions](../architecture/fe/coding-conventions.md).

## Global Constraints

- Đã fetch `origin/dev` ngày 2026-11-14; `origin/dev` và nhánh tạo mới cùng ở `946c883420b4499894fad24c05f975ff206b537b` (2026-11-13 UTC). Branch triển khai: `feat/public-foundation`, tạo từ commit này. PR hướng tới `dev` khi được yêu cầu.
- Không ghi mã PR hoặc số thứ tự PR trong tên task/branch/tài liệu. Các mã `PF-01`… chỉ là định danh **task nội bộ** để liên kết checklist và commit.
- Giữ `PublicLayout` là entry duy nhất cho shell; không tạo router, provider, layout hoặc menu quản trị mới.
- Giữ nguyên URL `/`, `/collection`, `/collection/:roomSlug/exhibits/:exhibitId`, `/tour`, và cơ chế deep link tới Guided Tour. Không phát minh route nội dung chưa tồn tại.
- Không sửa nội dung/logic của `HomePage`, `HomeFeaturedExhibits`, `CollectionPage`, `ExhibitDetailPage`, `ExhibitGrid`, visitor stores, AudioPlayer hoặc 3D scene trong nhiệm vụ này.
- Không đổi backend, DB, CMS contract, dịch vụ API, seed, thư viện React/Mantine/Three, hoặc `front-end/src/app/theme.ts` dùng chung với Admin.
- Không override `.mantine-*` toàn cục hay thay `:root` / `--aura-*` diện rộng. Public tokens phải cách ly khỏi Admin và `/tour` immersive. Nếu phát hiện CSS dùng chung cần thay, phải chứng minh lý do và regression trước.
- Giữ light/dark switch, 6 locale đang có, `skip link`, landmarks, keyboard, `prefers-reduced-motion`; UI mới dùng `t(key, fallback)` và không tự dựng nội dung CMS.
- Commit theo **task đã kiểm chứng**; không tạo commit rỗng cho đủ bảng. Bắt đầu/push/PR/merge tuân theo yêu cầu người dùng ở lượt triển khai, không tự động giả định đã được cho phép.

## Thiết kế đã duyệt và yêu cầu có thể quan sát

- Art direction: nền ivory/giấy sáng, màu forest green cho hành động, bronze dùng điểm nhấn, chữ serif cho nhận diện nghệ thuật và sans cho nút/navigation; không biến header thành khối neon/glass/glow liên tục.
- Header desktop: logo trái, 3 mục điều hướng đang có, chọn ngôn ngữ/theme và nút vào không gian 3D; sticky ổn định, active state rõ ngay cả khi không phân biệt màu.
- Mobile: logo, CTA 3D có tên truy cập, Burger + Drawer; trong Drawer có đủ links và language select. Menu đóng sau khi chọn link hoặc Escape; nội dung không tràn ở 320 px.
- Footer: thương hiệu, tuyên ngôn đúng chức năng, liên kết `/`, `/collection`, `/tour` và `/admin`, copyright; desktop chia cột, mobile một cột; không ghi claims WCAG/VR chưa có bằng chứng chứng nhận.
- Token reference từ SDD: `--public-bg: #F5EFE5`, `--public-paper: #FFF9F0`, `--public-ink: #1B2723`, `--public-forest: #064735`, `--public-bronze: #B28B56`; dark mode cần palette riêng có contrast đo được. Tránh dùng bronze nhạt làm chữ thường.
- Component/Page content hiện tại chưa đổi nên có thể chưa hoàn toàn đồng nhất về màu. **Không mở rộng scope để “sửa luôn” phần trang**; ghi lại chỗ chưa đồng nhất cho PR redesign tương ứng.

## File map và interfaces

| File | Vai trò / ranh giới |
|---|---|
| `front-end/src/layouts/PublicLayout.tsx` | Giữ `PublicLayout()` named export, providers, `Outlet`; cập nhật header/footer, mobile Drawer, điều hướng/CTA |
| `front-end/src/layouts/PublicLayout.module.css` | Public-only tokens; header/footer/grid/responsive/focus; tránh tác động Admin |
| `front-end/src/shared/components/layout/ThemeToggle.tsx` | **Ưu tiên giữ nguyên** contract đã chạy; chỉ sửa khi chứng minh lỗi cần fix |
| `front-end/src/styles/aura.css` | **Không sửa mặc định**; global `--aura-*` hiện dùng bởi phần khác |
| `front-end/src/assets/aura-mark.svg` | Tái sử dụng; không thay logo thương hiệu |
| `front-end/tests/public-foundation.spec.ts` | Bổ sung fixture/browser checks cho shell, navigation, responsive và theme/locale |
| `front-end/tests/public-language.spec.ts`, `public-ui-translations.spec.ts`, `public-tour-navigation.spec.ts` | Reuse regression cho i18n và Guided Tour |
| `front-end/tests/accessibility-keyboard.spec.ts`, `admin-navigation-keyboard.spec.ts`, `museum-immersive-ui.spec.ts` | Reuse regression để chứng minh cách ly UI public / Admin / Tour |
| `docs/plans/public-foundation-plan.md` | Kế hoạch, bước triển khai và checkpoint |
| `docs/tasks/public-foundation.md` | Scope, task/commit dự kiến, status, acceptance, evidence thực tế |

**Contract:** Public page đọc style token thông qua wrapper `.layout`; `PublicLayoutContent` tiếp tục cung cấp `<main id="public-content" tabIndex={-1}><Outlet /></main>`. Nav dùng React Router `Link`/`NavLink`, tránh `window.location` reload. `tour3dHref` và xử lý Pause phải được chia sẻ bởi link desktop, link mobile và CTA. `NativeSelect` tiếp tục đọc `LOCALES` và `usePublicLocale`. Nếu Drawer dùng portal bên ngoài `.layout`, phải style qua props/class cụ thể để không mất token.

---

## PF-01: Khảo sát baseline và chốt hợp đồng foundation

**Files:** hai tài liệu này; chưa sửa source UI.
**Consumes:** `origin/dev`, SDD, test hiện tại. **Produces:** baseline có thể so sánh, checklist và ranh giới thay đổi được thống nhất.

- [x] **Bước 1 — Đồng bộ source và kiểm tra điều kiện đầu vào.** `git fetch origin`, xem `git status --short`, so SHA của `origin/dev` với mốc khảo sát; đọc lại `PublicLayout`, `aura.css`, `ThemeToggle`, CSS page liên quan. Không tự ý xóa thay đổi chưa commit của người khác.
- [x] **Bước 2 — Chốt route/provider/locale/tour invariants.** Ghi lại các link `/`, `/collection`, `/tour`, logic `guidedTour3dPath` / Pause, `skip link`, cách mount Drawer qua portal; phân biệt sai khác đã có với sai khác sẽ phát sinh.
- [x] **Bước 3 — Chạy baseline nếu môi trường cho phép.** Từ `front-end/`, chạy typecheck, lint, build, các focused regression hiện có. Capture giao diện header/footer ở 1440 và 390 px cho light/dark; ghi thiết bị/trình duyệt. Nếu API/dev server không sẵn có, ghi blocker chứ không đánh dấu PASS.
- [x] **Bước 4 — Review/stage đúng 2 file tài liệu.** Đối chiếu với design, `git diff --check` và staged diff. Chỉ commit khi bước khảo sát có bằng chứng.

**Commit dự kiến:** `docs(public): plan foundation shell redesign`.

## PF-02: Semantic tokens và typography public-only

**Files:** chủ yếu `PublicLayout.module.css`; chỉ thêm asset font có license nếu thực sự cần.
**Consumes:** màu/typography trong SDD. **Produces:** tokens có scope rõ, giao diện shell dùng được ở light/dark, không đụng Admin.

- [ ] **Bước 1 — Định nghĩa token mới trên `.layout`.** Thiết lập màu nền/paper/sand/ink/muted/forest/bronze/border/focus, font, spacing/radius cần thiết; giữ các alias `--public-background`, `--public-surface`, `--public-accent` đang được dùng để không gây regression.
- [ ] **Bước 2 — Xử lý light/dark.** Cấp token tối thông qua selector dựa trên `data-mantine-color-scheme`, chỉ scoped trong Public Layout; không tạo chu trình `--public-*` ↔ `--aura-*`.
- [ ] **Bước 3 — Chọn font và fallback đã thử tiếng Việt.** Kiểm tra chuỗi có dấu (Đông Sơn, Trống đồng, Bảo tàng), font loading/swap và tên rất dài; không thêm font không rõ giấy phép hoặc sửa font toàn app.
- [ ] **Bước 4 — Kiểm chứng CSS.** Đo contrast text thường ≥ 4.5:1, text lớn ≥ 3:1, icon/control thiết yếu ≥ 3:1; có focus ring đủ rõ; kiểm nhanh không tràn ngang 320–1440 px; Admin và `/tour` không bị remap màu.
- [ ] **Bước 5 — Review/stage/commit.** Chỉ stage token/CSS/font thật sự cần; chạy kiểm tra liên quan và `git diff --cached --check`.

**Commit dự kiến:** `style(public): add scoped heritage tokens and typography`.

## PF-03: Header và navigation desktop

**Files:** `PublicLayout.tsx`, `.module.css`, focused Playwright test.
**Consumes:** `PublicLayout`, `NAV`, locale/theme/Guided Tour hiện có. **Produces:** header desktop mới với đầy đủ chức năng cũ.

- [ ] **Bước 1 — Viết assertion hành vi có ý nghĩa trước khi sửa.** Một `banner`, một `main`, skip link vào `#public-content`; logo trỏ `/`; ba điều hướng thực; active item có `aria-current="page"`; 3D CTA dẫn đúng `/tour` khi tour idle.
- [ ] **Bước 2 — Dựng visual header theo SDD.** Header ổn định khi scroll, khoảng cách và thứ bậc rõ; active state bằng nền/underline/weight kết hợp, tránh glow/gradient mạnh; logo dùng asset hiện có.
- [ ] **Bước 3 — Bảo toàn logic.** Không thêm tour state; tái sử dụng `tour3dHref`, `handleEnter3d`, `usePublicLocale`, `ThemeToggle`. Chuyển trang từ desktop bằng bàn phím như chuột.
- [ ] **Bước 4 — Kiểm tra 768/1024/1440, light/dark, vi/en.** Header không chồng chéo khi font đổi; sticky không che nội dung chính khi Tab/skip link. Điều kiện chưa có data không cản điều hướng.
- [ ] **Bước 5 — Test GREEN rồi commit.** Ghi lệnh/kết quả, review diff chỉ header CSS/JSX/tests. Không thay body của Homepage/Collection/Detail.

**Commit dự kiến:** `feat(public): redesign desktop header and navigation`.

## PF-04: Mobile Drawer và nối Guided Tour an toàn

**Files:** `PublicLayout.tsx`, `.module.css`, focused Playwright test.
**Consumes:** menu desktop/tour path hiện tại. **Produces:** menu mobile hành xử đồng nhất với CTA desktop, bảo toàn phiên tour.

- [ ] **Bước 1 — Viết regression cho lỗi lệch điều hướng đã xác định.** Trong code khảo sát, desktop nav và CTA dùng `tour3dHref` nhưng mobile Drawer dùng `item.to`; test trường hợp guided tour đang tạm dừng/đang chạy để xác minh chọn link Tour từ Drawer tới **đúng bước** và pause theo quy tắc hiện có.
- [ ] **Bước 2 — Cho Drawer và header CTA dùng cùng destination/handler.** Không copy-paste dựng URL `/tour?...` bằng tay; đóng menu khi chọn nav, đồng bộ route active.
- [ ] **Bước 3 — Accessibility mobile.** Burger có accessible name và trạng thái mở/đóng; Escape, backdrop, focus trapping/restore hoạt động theo Mantine Drawer; theme/language trong menu vẫn dùng được.
- [ ] **Bước 4 — Responsive 320, 390 và 768 px.** Không chồng nút 3D/Burger; tên/icon CTA rõ với screen reader; locale dài và zoom 200% không làm mất chức năng.
- [ ] **Bước 5 — Test rồi commit riêng.** Tái chạy desktop nav regression; không sửa reducer/timer Guided Tour hoặc scene.

**Commit dự kiến:** `fix(public): preserve guided tour links in mobile drawer`.

## PF-05: Footer và responsive shell

**Files:** `PublicLayout.tsx`, `.module.css`, focused browser tests.
**Consumes:** route/footer/copyright hiện có. **Produces:** footer theo bố cục editorial, hoạt động đủ ở mobile/desktop.

- [ ] **Bước 1 — Bảo toàn nội dung hợp lệ.** Logo, mô tả ngắn, liên kết public, link quản trị, copyright; bỏ/điều chỉnh claim không có bằng chứng, không thêm các route không có trong router.
- [ ] **Bước 2 — Dựng bố cục.** Desktop phân cột rõ; tablet chuyển linh hoạt, mobile stack; footer nằm đúng cuối trang khi page ít nội dung; không đè lên viewport của `/tour`.
- [ ] **Bước 3 — Kiểm tra links/keyboard/contrast.** `/`, `/collection`, `/tour`, `/admin` đều đúng; focus nhìn thấy, target chạm đủ thoáng, không tràn với text bản dịch dài.
- [ ] **Bước 4 — Screenshot 1440/1024/768/390/320, light/dark.** So với mock về bố cục, không dùng DOM checks thay cho visual review.
- [ ] **Bước 5 — Review và commit.** Stage đúng footer CSS/JSX + tests thật sự liên quan; ghi evidence.

**Commit dự kiến:** `feat(public): refine editorial footer and responsive shell`.

## PF-06: Regression, accessibility và bàn giao

**Files:** `front-end/tests/` + hai tài liệu; sửa code chỉ khi lỗi có testcase và có commit fix riêng.
**Consumes:** shell đã hoàn thành. **Produces:** bằng chứng kiểm thử, residual risks và diff nhỏ dễ review.

- [ ] **Bước 1 — Chạy focused Playwright.** `public-foundation.spec.ts` và các suite liên quan: `public-language`, `public-ui-translations`, `public-tour-navigation`, `accessibility-keyboard`, `admin-navigation-keyboard`, `museum-immersive-ui`; không skip test hỏng để nhận PASS.
- [ ] **Bước 2 — Quality gates.** Từ `front-end/`: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`. Dùng `npm run test -- <spec>` theo script Playwright; ghi đúng log và số test.
- [ ] **Bước 3 — Visual + manual checks.** Desktop/mobile light/dark, vi/en và một locale dài; keyboard-only, reduced motion, zoom 200% và 400% nếu phù hợp, kiểm ít nhất Chrome/Edge; screen reader/thiết bị thật chỉ đánh PASS khi đã kiểm thực tế.
- [ ] **Bước 4 — Cô lập Admin và Tour.** Đảm bảo CSS/typography `PublicLayout` không làm biến dạng `/admin`; `/tour` vẫn vào/thoát được, HUD và Guided Tour không bị đổi behavior.
- [ ] **Bước 5 — Review trước bàn giao.** Xem diff mỗi commit, `git diff origin/dev...HEAD`, `git diff --check`, staged file list; cập nhật trong `docs/tasks/public-foundation.md` SHA, lệnh, pass/fail, screenshot và điểm còn thiếu. Mọi fix phải có commit riêng (không gom vào commit tài liệu nếu thay source).
- [ ] **Bước 6 — Chờ duyệt giao diện và thao tác Git tiếp theo.** Không tự nhận user đã duyệt; chỉ push/tạo PR/merge nếu lượt thực thi được người dùng cho phép.

**Commit dự kiến:** `test(public): cover shell routes themes and accessibility` (khi có thay đổi tests); `docs(public): record foundation verification` (khi cập nhật bằng chứng). Không tạo commit rỗng.

## Quality gate và lệnh tham khảo

Chạy từ `front-end/` (PowerShell dùng `npm.cmd` nếu cần):

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test -- public-foundation.spec.ts public-language.spec.ts public-ui-translations.spec.ts public-tour-navigation.spec.ts accessibility-keyboard.spec.ts admin-navigation-keyboard.spec.ts museum-immersive-ui.spec.ts
```

Trước **mỗi commit**, kiểm tra từ root repo:

```bash
git status --short
git diff --check
git diff --stat
git add -- <chinh-xac-nhung-file-thuoc-task-da-review>
git diff --cached --check
git diff --cached
git commit -m "<conventional-commit-message-cua-task>"
```

Lệnh trong dấu `<...>` là placeholder để thay bằng đường dẫn/message thực tế, không chạy nguyên văn. Không `git add .`, không commit artifacts, `.env`, credentials hay logs ngoài ý muốn. Nếu test fail, ghi lỗi và sửa trước khi đánh dấu task hoàn thành; không điền SHA giả.

## Self-review và trạng thái bàn giao

- Tất cả mục trong SDD thuộc foundation được ánh xạ vào PF-01…PF-06; body của Homepage/Collection/Detail và lazy viewer nằm ngoài scope.
- Task và commit gắn trực tiếp trong hai tài liệu đúng pattern `docs/plans/<feature>-plan.md` + `docs/tasks/<feature>.md`.
- Nội dung hiện tại là **plan dự kiến**, không có bằng chứng đã chạy code, test, benchmark, visual audit, commit, push hoặc PR.
- Nếu `origin/dev` thay đổi trong thời gian chờ triển khai, đối chiếu lại các assumptions và ghi khác biệt trước khi bắt đầu.
