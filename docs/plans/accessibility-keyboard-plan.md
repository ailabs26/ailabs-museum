# A11Y-01 — Keyboard Navigation Implementation Plan

> **For agentic workers:** Kế hoạch đã được người dùng duyệt. Chỉ triển khai **A11Y-01** theo [task breakdown](../tasks/accessibility-keyboard.md), kiểm chứng và commit riêng từng task; dừng cho người dùng review trước khi tạo PR/merge theo chỉ đạo.

**Goal:** Người dùng có thể hoàn thành các luồng chính của Aura Museum bằng bàn phím (Tab, Shift+Tab, Enter, Space, Escape và phím điều hướng 3D hiện có), không bị mắc kẹt, mất focus hoặc buộc dùng chuột.

**Architecture:** Dùng native HTML/Mantine keyboard semantics, giữ logic focus trong component sở hữu hành vi. `MuseumPage` quản lý selection/focus của panel hiện vật **non-modal**; `attachNavigationInput` quản lý shortcut chỉ khi Canvas focus; các nút DOM là đường truy cập hiện vật khi không dùng 3D. Chỉ sửa issue đã xác nhận bằng browser/keyboard test; không xây focus manager toàn cục.

**Tech Stack:** React 18, TypeScript, React Router 6, Mantine 7, React Three Fiber/Three.js, Vitest và Playwright đã có. Không cần Audio API/backend hay dependency mới.

## 1. Trạng thái và căn cứ source

- **Trạng thái:** **Implemented trên `feat/a11y-keyboard`; chưa push/PR.**
- **Baseline đã đọc:** `dev` tại `3f34a6bd9f6510316c99957ce2eddcb584989344` (19/10/2026). Agent phải fetch lại `origin/dev` trước khi triển khai và cập nhật SHA nếu đã đổi.
- Đã tham chiếu `AGENTS.md`, `front-end/docs/coding-conventions.md`, `docs/plans/audio-player-01-plan.md`, `docs/tasks/audio-player-01.md`, các luồng UI và browser tests hiện có.
- `front-end/src/layouts/PublicLayout.tsx` có skip link `#public-content`, `main` focusable bằng `tabIndex={-1}` và liên kết điều hướng.
- `front-end/src/helpers/attachNavigationInput.ts` đặt `canvas.tabIndex = 0`, `aria-label`, `aria-describedby`; chỉ nhận shortcut khi `document.activeElement === canvas`. **Hiện có `canvas.focus({ preventScroll: true })` khi attach**: nguy cơ focus chuyển ngoài dự kiến cần kiểm chứng runtime, chưa mặc định là lỗi.
- `front-end/src/pages/MuseumPage.tsx` ghi `selectionTriggerRef`, xử lý Escape và restore focus khi trigger còn trong DOM. `ExhibitDetailPanel.tsx` hiển thị `<aside>` **non-modal**, focus vào heading khi hiện vật đổi.
- `MuseumCatalogue.tsx` và `ArtifactHotspotControls.tsx` có Button DOM, `aria-pressed`; `museum-interaction.spec.ts` đã có ca Enter/Space. `SceneFallback` và trang 2D cần được giữ làm đường truy cập khi Canvas không hoạt động.
- `front-end/src/shared/components/data/DataTable.tsx` có hàng `<Table.Tr onClick>` nếu nhận `onRowClick`; `front-end/src/pages/admin/ModerationPage.tsx` dùng hành vi này để mở chi tiết, **chưa thấy control bàn phím tương đương trong cột action**. Đây là khoảng trống có căn cứ từ source, cần test trước khi sửa.
- `AdminLayout.tsx` dùng các control Mantine (Burger, Menu, NavLink); trang quản trị có Modal/Drawer riêng. **A11Y-01 chỉ audit đường điều hướng đến các control**, không làm focus trap/restore bên trong Modal/Drawer.
- `AudioPlayer.tsx` đã merge vào `dev` qua PR #59; có nút Play/Pause native. Kiểm tra hồi quy keyboard của component bằng fixture, không tích hợp nguồn Audio thật.
- Code navigation vừa merge qua PR #60; phải tránh làm hỏng WASD, joystick, camera focus, WebGL fallback và lifecycle cleanup.

## 2. Global constraints

- **Chỉ phạm vi A11Y-01 — Keyboard Navigation.** Không thiết kế/triển khai A11Y-02 (focus trap, initial/return focus của Modal/Drawer) hoặc A11Y-03 (kiểm toán, chứng nhận/bàn giao WCAG 2.2 AA toàn website). Các phần đó không nằm trong PLAN/TASK hiện tại.
- Trạng thái bàn giao hiện tại: **hai file tài liệu**. Việc sửa source/test chỉ được bắt đầu **sau khi người dùng duyệt**.
- Frontend-only; không đổi backend, database, migrations, auth/RBAC, API contracts, Storage, Audio API hoặc dữ liệu thật. Không thêm dependency theo mặc định.
- Không biến panel hiện vật non-modal thành dialog/modal và **không bẫy Tab trong panel**; không tự viết global focus trap cho CMS.
- Giữ nguyên hành vi touch/mouse, 3D movement/collision, camera owner, React query data flow và quyền CMS.
- "100% bàn phím" nghĩa là **mọi hành động thiết yếu trong phạm vi màn hình hiện hữu có cách tương đương bằng bàn phím**, không phải tạo phím riêng cho mọi thao tác vật lý/hiệu ứng trên Canvas.
- Tránh `tabIndex > 0`, `role="button"` trên `<tr>` và bắt Enter/Space giả lập khi có thể dùng native Button/Link.
- Không mặc định kết luận sản phẩm đạt WCAG 2.2 AA chỉ vì các bài test keyboard đều pass. Bằng chứng audit hiện tại chỉ là static source inspection; browser/manual results sẽ ghi sau khi thực chạy.
- Quy trình Git theo `AGENTS.md`: lấy `origin/dev` mới nhất, một nhánh feature đề xuất `feat/a11y-keyboard`, một PR dự kiến vào `dev`, không push trực tiếp `dev` hoặc `main`; chỉ merge sau khi được review/cho phép.

## 3. Lựa chọn thiết kế

| Vấn đề | Phương án chọn | Không làm |
|---|---|---|
| Điều khiển UI | Native `<button>`, `<a>`, Mantine tương ứng; Tab/Enter/Space theo semantics | Bắt `keydown` toàn trang để mô phỏng click |
| Canvas 3D | Giữ Canvas focusable, hotkeys chỉ active khi Canvas focus; kiểm chứng auto-focus trước khi sửa | Global WASD handler, trap Tab trong Canvas |
| Danh mục và hotspot | Dùng Button DOM có tên rõ, Enter/Space; vẫn dùng khi WebGL lỗi | Bắt người dùng click vật thể 3D |
| Chi tiết hiện vật | Giữ `<aside>` non-modal; focus heading hợp lý, Tab ra ngoài, Escape đóng, restore focus có điều kiện | Thêm `aria-modal`, focus trap |
| Hàng bảng kiểm duyệt | Nút hành động có accessible name cụ thể cho mỗi hàng, row-click vẫn tùy chọn cho chuột | Biến toàn `<tr>` thành pseudo-button |
| Layouts/routing | Giữ skip link, thứ tự tab tự nhiên, xử lý route focus có chủ đích khi cần | Global focus reset mọi render/refetch |
| QA | Playwright keyboard journey + kiểm tra thủ công + test hồi quy hiện có | Chỉ gọi `.click()` hoặc dispatch event rồi báo keyboard PASS |

### Keyboard behavior contract

- **Tab / Shift+Tab:** focus đi theo thứ tự có nghĩa từ header → content → tour controls → catalogue → footer, và trên CMS tới menu/nav/form/action; luôn có đường thoát khỏi Canvas/panel.
- **Enter / Space:** kích hoạt nút, item/menu theo semantics tương ứng; Enter mở liên kết. Với hotkey Canvas, giữ phím hiện có nhưng không nuốt phím của input/select ngoài Canvas.
- **Escape:** đóng panel chi tiết đang mở khi phù hợp; không nuốt Escape của input/overlay có quyền ưu tiên. Hành vi Escape của Modal/Drawer riêng sẽ thuộc đợt sau, không sửa trong A11Y-01.
- **Canvas:** chỉ xử lý WASD, Shift, Arrow, F, Home, +/− khi Canvas có focus; blur/Tab phải dừng movement; không có keyboard trap.
- **Chọn hiện vật:** từ catalogue hoặc hotspot DOM bằng Enter/Space → focus vào nội dung chi tiết thích hợp → Escape/Đóng → trả focus về trigger còn hợp lệ hoặc fallback rõ ràng.
- **Điều hướng trang:** skip link đưa focus tới nội dung chính; route/page thay đổi không làm focus mất vào phần tử đã bị unmount; refetch nền không cướp focus.

### Liên hệ WCAG (chỉ nhóm tiêu chí keyboard liên quan)

- [WCAG 2.2 — W3C](https://www.w3.org/TR/WCAG22/): **2.1.1 Keyboard (A)**, **2.1.2 No Keyboard Trap (A)**, **2.1.4 Character Key Shortcuts (A)**, **2.4.1 Bypass Blocks (A)**, **2.4.3 Focus Order (A)**, **2.4.7 Focus Visible (AA)**, **2.4.11 Focus Not Obscured (Minimum) (AA)** và **4.1.2 Name, Role, Value (A)** ở những control liên quan.
- A11Y-01 kiểm tra sự tuân thủ **trong phạm vi keyboard**, không thay thế audit đầy đủ WCAG 2.2 AA, đo contrast toàn trang hay kiểm thử screen reader chứng nhận.

## 4. Focus lifecycle và tình huống bắt buộc

| Tình huống | Hành vi mong đợi | Owner dự kiến |
|---|---|---|
| Enter “Mở phòng 3D” | Focus transition có chủ đích, không bất ngờ nhảy/biến mất khi lazy-load | `MuseumPage` + `attachNavigationInput` |
| Canvas focus / Tab ra ngoài | WASD, Arrow, F, Home hoạt động khi đúng scope; blur dừng mọi input | `attachNavigationInput` |
| Chọn hiện vật bằng catalogue/hotspot | Enter/Space mở đúng hiện vật; focus tới heading, Tab ra ngoài panel | `MuseumPage` + `ExhibitDetailPanel` |
| Escape/Đóng panel | Đóng đúng một panel, trả focus về trigger hợp lệ | `MuseumPage` |
| Đổi phòng/refresh lỗi/dừng 3D | Không focus vào node cũ; fallback/content vẫn đọc và điều hướng được | `MuseumPage` + scene fallback |
| Bảng kiểm duyệt | Tab tới nút “Xem chi tiết …”; Enter/Space mở đúng record | `ModerationPage` |
| Header/navigation/skip link | Tab hợp lý, focus visible, skip link tới nội dung | Public/Admin layouts |
| Audio Player fixture | Nút Play/Pause/Resume kích hoạt được bằng phím, không cần API | `AudioPlayer` fixture |

- Khi `selectionTriggerRef.current` mất khỏi DOM, không gọi focus vào node cũ; chọn fallback hợp lý theo context.
- Tái hiện bằng browser trước khi sửa Canvas auto-focus, Tab order hoặc keyboard menu; **đừng biến nghi vấn code thành bug chưa được xác minh**.
- Không thêm RAF/timer hay focus-manager toàn cục để chữa sự cố lifecycle.

## 5. File map dự kiến khi triển khai

| Task | File liên quan (chỉ sửa khi cần) | Trách nhiệm |
|---|---|---|
| A11Y-01.0 | Hai tài liệu A11Y-01, test matrix trong task | Baseline và repro keyboard |
| A11Y-01.1 | `front-end/src/helpers/attachNavigationInput.ts`, `front-end/src/components/MuseumScene.tsx`, `front-end/src/pages/MuseumPage.tsx`, `front-end/tests/museum-navigation.spec.ts` | Canvas focus, hotkeys và cleanup |
| A11Y-01.2 | `front-end/src/pages/MuseumPage.tsx`, `front-end/src/components/museum/ExhibitDetailPanel.tsx`, `MuseumCatalogue.tsx`, `ArtifactHotspotControls.tsx`, `SceneFallback.tsx`, interaction/fallback tests | Panel non-modal và chọn hiện vật bằng bàn phím |
| A11Y-01.3 | `front-end/src/pages/admin/ModerationPage.tsx`, `front-end/src/shared/components/data/DataTable.tsx` nếu cần, focused CMS tests | Nút action trong bảng và tương đương keyboard |
| A11Y-01.4 | `front-end/src/layouts/PublicLayout.tsx`, `AdminLayout.tsx`, CSS và page/test được repro xác nhận | Skip link, nav, route focus, focus indicator |
| A11Y-01.5 | `front-end/tests/*` có ảnh hưởng, hai tài liệu A11Y-01, README nếu cần | Regression, evidence và bàn giao A11Y-01 |

Các file ở trên là candidate list, **không bắt buộc sửa tất cả**. Không thêm code thay cho A11Y-02/03.

## 6. Test strategy

- **Baseline:** ghi kết quả dưới dạng `PASS / FAIL / NOT TESTED / NOT APPLICABLE`; có `route/flow`, sequence phím, focused element trước/sau, expected/actual, severity, affected file, liên hệ WCAG và bằng chứng. Static inspection ≠ browser PASS.
- **Browser:** Playwright thực hiện `keyboard.press('Tab')`, `locator.press('Enter')`, `locator.press('Space')`, `expect(...).toBeFocused()`; kiểm tra cả Shift+Tab, Escape và camera state sau blur. Không dùng `element.click()` thay cho ca keyboard.
- **Fixture:** có thể dùng API mocks trong `front-end/tests/` để kiểm chứng public pages/tour 3D mà không cần backend. CMS dùng auth/service fixture đã có hoặc fixture isolated đủ semantic; không gọi publish/delete/reject thật. Nếu không tái hiện đủ quyền trong môi trường, ghi NOT TESTED cùng nguyên nhân và không nhận nghiệm thu phần đó.
- **Hồi quy:** kiểm tra `museum-navigation.spec.ts`, `museum-interaction.spec.ts`, `museum-hotspots.spec.ts`, các suite fallback/tour/switching liên quan và `audio-player.spec.ts` (fixture audio giả lập).
- **Thủ công:** keyboard-only walkthrough ở viewport 320/768/1440 CSS px, light/dark, focus không bị che hoàn toàn bởi sticky nav/HUD; ghi browser và OS. Screen-reader/certification đầy đủ không thuộc scope 01.
- Chạy từ thư mục `front-end/` sau khi được duyệt (đây là lệnh dự kiến, **chưa chạy**):

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
# Chạy fixture Playwright trên Vite dev, không cần live API.
Remove-Item Env:PLAYWRIGHT_PREVIEW -ErrorAction SilentlyContinue
Remove-Item Env:MUSEUM_LIVE_TEST -ErrorAction SilentlyContinue
npm.cmd test -- museum-navigation.spec.ts museum-interaction.spec.ts museum-hotspots.spec.ts audio-player.spec.ts --reporter=line
# Chạy thêm a11y/CMS/fallback suites nếu task thực tế tạo hoặc tác động.
```

Không đánh dấu toàn bộ pass nếu mới chỉ chạy focused subset. Không dùng kết quả PR #59/#60 thay thế kết quả mới.

## 7. Acceptance và task mapping

| Yêu cầu | Task | Bằng chứng phải thu |
|---|---|---|
| Audit baseline các luồng bàn phím hiện có | A11Y-01.0 | Ma trận phím/focus, repro và issue ưu tiên |
| Canvas thao tác và thoát bằng phím, không cướp focus vô cớ | A11Y-01.1 | Real keyboard/browser, no-stuck-input, camera invariants |
| Catalogue/hotspot và panel non-modal Enter/Space/Escape | A11Y-01.2 | Browser journey, restore focus, fallback/race tests |
| CMS moderation có hành động mở record bằng phím | A11Y-01.3 | Nút accessible, test Enter/Space, giữ table semantics |
| Public/Admin navigation, skip link và focus visible | A11Y-01.4 | Tab sequence, focus screenshot/obscuration, route flow |
| Verification A11Y-01 và review gate | A11Y-01.5 | Test report, unresolved list, diff review, commit ledger |

### Mốc commit theo task

| Task | Commit dự kiến |
|---|---|
| A11Y-01.0 | `docs(a11y): plan keyboard navigation` |
| A11Y-01.1 | `fix(a11y): preserve tour keyboard focus` |
| A11Y-01.2 | `fix(a11y): stabilize exhibit focus flow` |
| A11Y-01.3 | `fix(a11y): add moderation keyboard action` |
| A11Y-01.4 | `fix(a11y): improve navigation focus order` |
| A11Y-01.5 | `test(a11y): verify keyboard navigation` |

Commit riêng khi task có thay đổi được kiểm chứng, không tạo commit rỗng; viết message tiếng Anh ngắn, không có “task N” trong subject. **Không tạo PR/merge trước review của người dùng**.

## 8. Tự review kế hoạch

- [x] Phạm vi chỉ A11Y-01; không trộn implementation Modal/Drawer trap hoặc WCAG checklist toàn trang.
- [x] Đã đối chiếu `AGENTS.md`, plan/task AUDIO-01 và source `dev` tại SHA ghi trên.
- [x] Các hành vi Canvas, non-modal panel, CMS row-click và skip link đã được ánh xạ tới owner rõ ràng.
- [x] Không làm lại tour input/camera, không đụng API/DB/Storage/Audio backend.
- [x] Có từng task, file ảnh hưởng, test/acceptance, mốc commit và review gate.
- [x] Không khẳng định đã chạy test hoặc sản phẩm đạt WCAG 2.2 AA.
- [x] Người dùng review/duyệt PLAN/TASK trước khi agent triển khai.

### Verification evidence

- Source inspection: `dev` `3f34a6b` (19/10/2026), đã đọc source và test hiện có.
- Implementation A11Y-01: hoàn tất trong phạm vi keyboard navigation; không làm A11Y-02/03.
- Frontend typecheck/lint/unit/build: PASS; focused A11Y Playwright **21/21 PASS**, Audio Player **10/10 PASS**.
- Manual keyboard-only QA: NOT RUN trên thiết bị thật; browser automation đã kiểm tra keyboard sequence, focus và reflow.
- Regression batch: final focused batch 65/66 PASS; một lazy scene touch timeout pass khi chạy riêng. Timing-sensitive failures được ghi trong task evidence.
- Feature branch/commits: đã tạo và commit riêng từng phần; chưa push/PR/merge.
