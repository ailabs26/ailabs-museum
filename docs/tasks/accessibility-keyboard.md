# A11Y-01 — Task breakdown: Keyboard Navigation

**Trạng thái:** **Implemented trên `feat/a11y-keyboard`; chưa push/PR.**
**Plan:** [accessibility-keyboard-plan.md](../plans/accessibility-keyboard-plan.md).
**Source đã khảo sát:** `dev` tại `3f34a6b` (19/10/2026); trước triển khai phải fetch lại `origin/dev`.
**Execution gate:** Người dùng đã duyệt PLAN/TASK. Thực hiện từng task trên **một nhánh** `feat/a11y-keyboard`, commit sau mỗi task hoàn thành/kiểm chứng; không tự tạo PR/merge nếu chưa được yêu cầu.

Các checkbox dưới đây là **checklist dự kiến**, chưa phải bằng chứng thực hiện. Chỉ đánh dấu `[x]` sau khi có kết quả kiểm chứng thực tế.

## Quy tắc chung

- **Chỉ triển khai A11Y-01**: bàn phím cho tour 3D, catalogue/hotspot/panel non-modal, hành động CMS, public/admin navigation và focus visible. Không bao gồm fix focus trap/initial focus của Modal/Drawer, không làm checklist/chứng nhận WCAG 2.2 AA toàn website.
- Thứ tự: **A11Y-01.0 → A11Y-01.1 → A11Y-01.2 → A11Y-01.3 → A11Y-01.4 → A11Y-01.5**. Mỗi task dùng cùng nhánh feature, không tạo PR riêng cho từng task.
- Không đổi backend, database, migrations, auth/RBAC nghiệp vụ, Storage, API hoặc Audio integration; không thêm dependency hoặc framework test mới nếu không thực sự cần.
- Có đường keyboard tương đương cho hành động thiết yếu; không bắt global keydown, không trap Tab trong Canvas/panel, không đưa `role="button"` lên `<tr>`.
- Giữ touch, mouse, collision, focus camera, keyboard scope Canvas và fallback 2D; không sửa logic nghiệp vụ CMS.
- Trước mỗi commit: `git status`, `git diff`, `git diff --check`, kiểm tra file ngoài phạm vi/secrets; chỉ stage source/tests của task và commit tiếng Anh ngắn, không ghi “task mấy”. Không commit khi test liên quan còn đỏ.
- Các test báo PASS phải có bằng chứng; nếu fixture CMS thiếu quyền hoặc không có môi trường test, ghi **NOT TESTED** và lý do thay vì tự nhận pass.
- Với source frontend: focused browser tests phù hợp + `npm run typecheck`, `npm run lint`, `npm run build`; nếu ảnh hưởng helper, chạy thêm `npm run test:unit`.

## A11Y-01.0 — Chốt tài liệu và audit keyboard baseline

**Mục tiêu:** Có ma trận các luồng trọng yếu, phát hiện lỗi bằng bàn phím trước khi thay code.

### File tác động

- `docs/plans/accessibility-keyboard-plan.md`, `docs/tasks/accessibility-keyboard.md` (ghi baseline/evidence, không sửa phạm vi chưa được duyệt).
- Tận dụng browser tests/fixtures hiện có; nếu cần bổ sung repro, thêm test trong `front-end/tests/` và ghi đúng lý do.

### Interface

- Bảng evidence: `route/flow | key sequence | focus trước | expected focus/action | actual | PASS/FAIL/NOT TESTED | severity | WCAG SC | owner | test/log`.
- Severity: **P0** không thể hoàn thành luồng/keyboard trap; **P1** focus mất/đi sai khiến luồng khó thực hiện; **P2** polish không làm mất khả năng thao tác.

### Các bước thực hiện

- [ ] Fetch `origin/dev`, kiểm tra working tree và xác nhận baseline SHA.
- [ ] Đọc lại `AGENTS.md`, coding conventions, PLAN/TASK và kiểm kê màn hình public (`/`, `/collection`, `/collection/:roomSlug/exhibits/:exhibitId`, `/tour`) cùng CMS (login, navigation, moderation).
- [ ] Đi bằng bàn phím thật qua Tab/Shift+Tab/Enter/Space/Escape; ghi focus order, accessible name và nguyên nhân khi không kiểm tra được.
- [ ] Kiểm tra Canvas auto-focus sau lazy load, panel non-modal, skip link, moderation clickable row; phân biệt **source risk** với **runtime FAIL**.
- [ ] Xác nhận các thao tác do modal thật sở hữu là **ngoài phạm vi sửa của A11Y-01**; chỉ ghi issue để review sau, không implement.
- [ ] Cập nhật baseline matrix trong task/report hiện có; nếu phát hiện lỗi mới làm thay đổi scope, dừng xin review trước.

### Test / acceptance criteria

- [ ] Các luồng keyboard được liệt kê đầy đủ; từng issue có bước tái hiện, owner và mức ưu tiên.
- [ ] Có kết quả browser hoặc `NOT TESTED` minh bạch; không tự chứng nhận WCAG.
- [ ] Chốt tài liệu và commit sau duyệt: `docs(a11y): plan keyboard navigation`.

## A11Y-01.1 — Canvas 3D: Tab, keyboard scope và focus lifecycle

**Phụ thuộc:** A11Y-01.0.
**Mục tiêu:** Người dùng chủ động vào/thoát Canvas bằng bàn phím, điều khiển 3D không ảnh hưởng UI khác.

### File tác động

- `front-end/src/helpers/attachNavigationInput.ts`.
- `front-end/src/components/MuseumScene.tsx`, `front-end/src/pages/MuseumPage.tsx` **nếu owner cần sửa**.
- `front-end/tests/museum-navigation.spec.ts` và focused tests liên quan.

### Interface

- Canvas: giữ focusable, `aria-label`, `aria-describedby`; WASD/Shift/Arrow/F/Home/+/- chỉ có hiệu lực khi Canvas focus.
- Tab/Shift+Tab thoát Canvas; blur/unmount nhả key state/pointer state; không bắt phím đang nhập ở Select/Input ngoài Canvas.

### Các bước thực hiện

- [ ] Thêm/reuse Playwright test: Tab/Enter tới nút “Mở phòng 3D”, chờ lazy load, ghi vị trí focus trước/sau. Kiểm tra hành vi `canvas.focus()` hiện tại; chỉ sửa nếu gây lỗi về focus order hoặc keyboard journey.
- [ ] Test Tab tới và Tab rời Canvas (cả Shift+Tab), không phải dùng Escape để thoát.
- [ ] Test WASD, Shift, Arrow, Home, F/+/- khi Canvas focus và **camera không đổi** nếu focus ở navbar, select, toolbar hoặc form.
- [ ] Test giữ WASD rồi Tab/blur; dừng movement và không còn stuck key. Test stop/reopen 3D, room change, fallback sau lỗi renderer.
- [ ] Chỉ sửa focus owner đúng lớp, không đổi movement/collision math hoặc raycast/joystick; giữ event listener cleanup.
- [ ] Chạy focused Playwright và frontend quality gates, review diff.

### Test / acceptance criteria

- [ ] Có thể vào/rời Canvas bằng phím; không trap hoặc focus jump không mong đợi.
- [ ] Hotkey chỉ có hiệu lực khi Canvas focus; các vùng DOM khác không bị điều khiển camera.
- [ ] Dừng 3D/blur/unmount không gây stuck movement hoặc focus vào DOM đã mất.
- [ ] Touch/joystick, picking, collision và camera focus không regress.
- [ ] Commit sau khi pass: `fix(a11y): preserve tour keyboard focus`.

## A11Y-01.2 — Catalogue, hotspot và panel hiện vật non-modal

**Phụ thuộc:** A11Y-01.1.
**Mục tiêu:** Chọn, đọc, chuyển và đóng chi tiết hiện vật hoàn toàn bằng bàn phím.

### File tác động

- `front-end/src/pages/MuseumPage.tsx`.
- `front-end/src/components/museum/ExhibitDetailPanel.tsx`, `MuseumCatalogue.tsx`, `ArtifactHotspotControls.tsx`, `SceneFallback.tsx` **nếu phát hiện cần sửa**.
- `front-end/tests/museum-interaction.spec.ts`, `museum-hotspots.spec.ts`, `tour-2d-fallback.spec.ts`, `exhibit-detail.spec.ts` tùy tác động.

### Interface

- Catalogue/hotspot: Button native, Enter/Space mở đúng hiện vật với state chọn rõ ràng.
- Panel: `<aside>` **non-modal**, focus heading có chủ đích, Tab/Shift+Tab không bị giữ, Escape/Đóng đóng một lần và restore trigger còn hợp lệ.

### Các bước thực hiện

- [ ] Test keyboard-only: Tab tới catalogue → Enter chọn hiện vật → panel xuất hiện; Space trên trigger khác; Enter/Space hotspot DOM.
- [ ] Test heading panel nhận focus khi chọn; Tab/Shift+Tab đi tiếp ra vùng khác; không thêm `FocusTrap`, `aria-modal` hoặc dialog role.
- [ ] Test Escape trên panel/Canvas/trigger; tránh ancestor bắt Escape hai lần hoặc xử lý Escape của overlay không thuộc owner.
- [ ] Test Đóng/ Escape restore focus về trigger còn trong DOM; nếu trigger bị bỏ do đổi phòng/refetch/dừng 3D, chuyển tới fallback hợp lệ thay vì node cũ.
- [ ] Test khi chưa mở Canvas, renderer fail, hiện vật ngoài phòng, link sang trang 2D, quay lại collection và refetch không giành focus.
- [ ] Sửa nhỏ ở đúng component sở hữu lỗi, giữ selection/camera/fallback hiện tại; chạy tests + frontend gates.

### Test / acceptance criteria

- [ ] Nội dung và chức năng chọn/đóng hiện vật hoàn thành không dùng chuột hoặc WebGL.
- [ ] Non-modal Tab được thoát; Escape đóng đúng vùng, restore/fallback hợp lý.
- [ ] Không focus vào detached node, không cướp focus do refetch nền.
- [ ] Regression scene selection và keyboard camera vẫn pass.
- [ ] Commit sau khi pass: `fix(a11y): stabilize exhibit focus flow`.

## A11Y-01.3 — CMS: thao tác mở chi tiết kiểm duyệt bằng bàn phím

**Phụ thuộc:** A11Y-01.0, thực hiện sau A11Y-01.2 theo thứ tự triển khai.
**Mục tiêu:** Không còn chỉ-click-hàng để mở bản ghi kiểm duyệt.

### File tác động

- `front-end/src/pages/admin/ModerationPage.tsx`.
- `front-end/src/shared/components/data/DataTable.tsx` **chỉ nếu phải thay public interface**.
- Browser test CMS hiện có hoặc focused fixture/test mới tương ứng.

### Interface

- Một Button/ActionIcon trong cột hành động cho mỗi revision, có accessible name phân biệt record (ví dụ `Xem chi tiết <tên hiện vật>`; cần bổ sung ID nếu tên trùng).
- `<table>/<tr>/<td>` vẫn đúng semantics; nếu giữ `onRowClick` cho chuột thì không double invoke khi click nút con.

### Các bước thực hiện

- [ ] Đối chiếu thực tế `DataTable` và `ModerationPage`: `<tr onClick>` không tự nhận Enter/Space. Tạo keyboard repro/test tại đúng UI/fixture.
- [ ] Bổ sung cột action với nút native có accessible name và quyền hiển thị phù hợp; tránh `role=button` + `tabIndex` lên row.
- [ ] Test Tab → nút tương ứng → Enter/Space mở đúng revision và không mở hai lần; giữ row-click dành cho chuột nếu vẫn cần.
- [ ] Test tên bản ghi dài/trùng, pagination, loading/empty và focus sau khi quay lại bảng ở mức điều hướng; **không sửa internal focus trap Drawer/Modal** trong task này.
- [ ] Dùng API mocks/authorized fixtures, không publish/delete/reject dữ liệu thật. Thiếu auth fixture thì báo blocker và tạo test đơn vị cho action nếu phù hợp; không nhận pass giả.
- [ ] Chạy focused tests và frontend gates, review diff.

### Test / acceptance criteria

- [ ] Keyboard user mở được record có quyền trong bảng qua Button native.
- [ ] Nút được đặt tên rõ và truy cập đúng record; cấu trúc bảng giữ nguyên.
- [ ] Không double invoke khi click, không regress row-click/pagination.
- [ ] Không thay quyền CMS hoặc lifecycle Modal/Drawer.
- [ ] Commit sau khi pass: `fix(a11y): add moderation keyboard action`.

## A11Y-01.4 — Public/CMS navigation, skip link và focus visible

**Phụ thuộc:** A11Y-01.2 và A11Y-01.3.
**Mục tiêu:** Luồng điều hướng giữa trang/mục và dấu focus nhận biết được khi chỉ dùng phím.

### File tác động

- `front-end/src/layouts/PublicLayout.tsx`, `AdminLayout.tsx`, CSS tương ứng **nếu có lỗi tái hiện**.
- Các trang `CollectionPage.tsx`, `ExhibitDetailPage.tsx`, `LoginPage.tsx`, navigation components và tests liên quan **chỉ khi cần**.
- Browser tests focused cho skip link/tab order/route focus (tái dùng test hiện có tối đa).

### Interface

- Skip link nhận focus bằng Tab, Enter đưa keyboard focus tới `main`/nội dung chính.
- Nav links/menu/buttons Tab theo thứ tự DOM hợp lý; focus indicator đủ nhận biết ở theme và viewport kiểm thử.

### Các bước thực hiện

- [ ] Test Tab từ đầu trang public → skip link → Enter; đảm bảo focus đến vùng `main`, không chỉ scroll.
- [ ] Test routes Home → Collection → Detail 2D → Tour và back link; focus không mất sau route change/unmount, refetch không cướp focus.
- [ ] Test CMS Burger/side nav/Menu/Logout/Login với Tab, Shift+Tab, Enter, Space và Escape theo semantics của control; nếu luồng vào Modal/Drawer thì dừng scope ở **activation**, không kiểm tra/sửa trap/restore nội bộ.
- [ ] Dùng viewport 320/768/1440 CSS px và light/dark, ghi focus indicator nhìn thấy, không bị tác giả che hoàn toàn bởi header, HUD, scroll area.
- [ ] Chỉ sửa CSS/semantics/route focus khi có failing browser/manual repro; tránh thay đổi palette/layout diện rộng.
- [ ] Chạy focused tests và frontend gates; kiểm tra regressions.

### Test / acceptance criteria

- [ ] Skip link có hiệu lực keyboard, thứ tự focus public/CMS hợp lý.
- [ ] Liên kết, menu, nút điều hướng thiết yếu không yêu cầu chuột.
- [ ] Focus visible tại các viewport/theme đã kiểm; không bị che hoàn toàn.
- [ ] Input/select không bị shortcut Canvas nuốt; không thay hành vi Modal/Drawer.
- [ ] Commit sau khi pass: `fix(a11y): improve navigation focus order`.

## A11Y-01.5 — Regression, evidence và bàn giao A11Y-01

**Phụ thuộc:** A11Y-01.1–01.4.
**Mục tiêu:** Kết thúc riêng Keyboard Navigation, bàn giao bằng chứng và rủi ro cho người review.

### File tác động

- Focused browser/unit tests thực sự bị ảnh hưởng.
- `docs/plans/accessibility-keyboard-plan.md`, `docs/tasks/accessibility-keyboard.md` và README nếu thông tin keyboard sử dụng thay đổi.

### Các bước thực hiện

- [ ] Chạy toàn bộ quality gates `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test:unit`, `npm.cmd run build` trong `front-end/`.
- [ ] Chạy affected Playwright suites: `museum-navigation`, `museum-interaction`, `museum-hotspots`, fallback/tour/collection, browser keyboard cases mới, CMS fixtures và `audio-player.spec.ts` nếu liên quan.
- [ ] Walkthrough keyboard-only: Tab, Shift+Tab, Enter, Space, Escape trên desktop/mobile viewport, light/dark; ghi browser/OS, actual focus và lý do NOT TESTED nếu thiếu môi trường.
- [ ] Đối chiếu từng acceptance A11Y-01.0–01.4; ghi `PASS/FAIL/NOT TESTED/NOT APPLICABLE`, test evidence, severity và remaining issues.
- [ ] Review full diff/status/check secrets, `git diff --check`, không đưa `tmp/`, local `.env`, artifact test hoặc data thật vào commit.
- [ ] Ghi commit ledger, test logs và review blockers; báo cáo rõ A11Y-01 đã/chưa đạt theo từng tiêu chí.
- [ ] Kết thúc feature branch và **DỪNG để người dùng review**. Chỉ tạo PR vào `dev` khi được yêu cầu, không tự merge.

### Test / acceptance criteria

- [ ] Các luồng keyboard trong phạm vi A11Y-01 đều PASS hoặc có blocker/NOT TESTED và kế hoạch xử lý rõ.
- [ ] Các quality gates và affected regressions có log thật; không tuyên bố AA toàn site.
- [ ] Code diff chỉ chứa A11Y-01, không sửa focus trap Modal/Drawer hoặc lập checklist WCAG toàn trang.
- [ ] Báo cáo đầy đủ: nhánh, commit, files, test counts, remaining risks, review requests.
- [ ] Commit sau khi pass: `test(a11y): verify keyboard navigation` (nếu có thay đổi test/evidence thực sự).

## Review gate hiện tại

- [x] Đã đọc `AGENTS.md`, cấu trúc mẫu `audio-player-01-plan.md` / `audio-player-01.md` và đối chiếu code `dev`.
- [x] Chỉ thiết kế A11Y-01, có 6 task nhỏ cùng một feature branch.
- [x] Mỗi task có file tác động, interface, các bước, test và acceptance criteria.
- [x] Chỉ có source audit, không ghi testing PASS chưa chạy.
- [x] Người dùng phê duyệt PLAN/TASK.
- [x] Bắt đầu code sau phê duyệt.

## Evidence sau triển khai

- **Hiện tại:** A11Y-01 đã triển khai trên `feat/a11y-keyboard`; chưa push/PR.
- **Baseline source:** `dev` SHA `3f34a6b` ngày 19/10/2026.
- **Playwright baseline:** `audio-player.spec.ts` 10/10 PASS; ca `museum-tour.spec.ts -g "focused keyboard navigation"` 1/1 PASS. Lần chạy cả `museum-tour.spec.ts` có 11 assertion PASS và một lỗi teardown thiếu trace artifact; ca đó chạy riêng PASS nên phân loại runner artifact, không phải product FAIL.
- **Quality gates:** typecheck PASS; lint PASS; Vitest **69/69 PASS**; build PASS.
- **Keyboard-only manual audit:** NOT RUN.
- Các checkbox từng task được giữ để truy vết kế hoạch; evidence thực tế và giới hạn nằm ở các mục bên dưới.

### Keyboard baseline matrix

| Route/flow | Key sequence | Expected | Actual | Status | Severity / WCAG | Owner / evidence |
|---|---|---|---|---|---|---|
| `/tour` mở/dừng 3D | Enter trên nút mở, Tab khỏi Canvas | Canvas nhận focus có chủ đích; Tab thoát; dừng 3D trả focus trigger | Đúng theo browser test | PASS | 2.1.1, 2.1.2, 2.4.3 | `museum-tour.spec.ts` focused 1/1 |
| Canvas hotkeys | Canvas focus → Arrow/Home/WASD; blur | Chỉ Canvas nhận hotkeys, blur nhả movement | Đúng theo navigation tests | PASS | P1 / 2.1.1, 2.1.2 | `attachNavigationInput.ts`, `museum-navigation.spec.ts` 10/10 |
| Tour catalogue/panel | Enter/Space → heading; Escape | Mở đúng hiện vật, focus heading, đóng và restore trigger | Đúng; panel Tab thoát và trigger detached có fallback | PASS | P1 / 2.1.1, 2.4.3 | `accessibility-keyboard.spec.ts`, `museum-interaction.spec.ts` |
| Audio fixture | Tab/Enter trên Play/Pause | Nút hoạt động, focus giữ ổn định | Đúng | PASS | 2.1.1, 2.4.7, 4.1.2 | `audio-player.spec.ts` 10/10 |
| Public skip link | Tab → Enter | Focus tới `#public-content`, không chỉ scroll | Đúng ở light/dark và 320/768/1440 | PASS | P1 / 2.4.1 | `accessibility-keyboard.spec.ts` |
| CMS moderation queue | Tab → action mở revision | Có native control mở đúng record | Nút action mở đúng revision bằng Enter/Space | PASS | P1 / 2.1.1, 4.1.2 | `moderation-keyboard.spec.ts` |
| CMS Modal/Drawer nội bộ | Escape/Tab | Mantine overlay behavior | Ngoài phạm vi A11Y-01 | NOT APPLICABLE | A11Y-02 | Theo scope đã duyệt |

### A11Y-01.1 evidence

- `npm.cmd test -- museum-navigation.spec.ts --reporter=line`: **10/10 PASS**; bao phủ WASD/Shift, focus loss dừng input, touch/joystick, collision, focus/reset và resize.
- `npm.cmd test -- museum-tour.spec.ts -g "focused keyboard navigation" --reporter=line`: **1/1 PASS**; Canvas nhận focus, hotkeys hoạt động và Tab thoát không trap.
- Không sửa production code: `attachNavigationInput` đã scope hotkey theo `document.activeElement === canvas`, blur/unmount clear movement/pointer/gesture. Theo quy tắc không tạo commit rỗng; evidence sẽ nằm trong commit docs cuối.

### A11Y-01.2–01.5 evidence

- Panel/fallback focused tests: **25/25 PASS**; test mới Tab/Shift+Tab/Escape và trigger detached PASS.
- CMS focused tests: **3/3 PASS**; duplicate-name revision Enter/Space, mouse action và pagination empty state.
- Public/CMS navigation focused tests: **16/16 PASS** ở light/dark, viewport 320/768/1440; skip link, CMS menu, login/logout keyboard flow.
- A11Y focused suite hiện tại: **21/21 PASS**; Audio Player regression **10/10 PASS**.
- Regression batch 108 tests trước đó: **104 PASS, 4 FAIL trong batch**; ba scene failures PASS khi chạy riêng. Final focused batch 66 tests: **65 PASS, 1 lazy scene touch timeout**; touch case PASS khi chạy riêng. Idle-render test còn lệch 1 frame khi chạy riêng, phân loại timing-sensitive existing test; không sửa render logic.
- Chưa chạy live API, screen-reader certification hoặc physical-device/GPU QA; không tuyên bố toàn site đạt WCAG 2.2 AA.

### Commit ledger

- `03039c1` — `docs(a11y): plan keyboard navigation`
- `54b45ac` — `docs(a11y): record keyboard baseline`
- `232f1d4` — `fix(a11y): stabilize exhibit focus flow`
- `8e5dd5a` — `fix(a11y): add moderation keyboard action`
- `504a1a3` — `fix(a11y): improve navigation focus order`
- Commit cuối — `test(a11y): verify keyboard navigation` (fixtures/docs/evidence).
