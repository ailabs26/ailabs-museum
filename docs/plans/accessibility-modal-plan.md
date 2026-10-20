# A11Y-02 — Modal/Drawer Focus Management Implementation Plan

> **For agentic workers:** Người dùng đã duyệt triển khai **A11Y-02** theo [task breakdown](../tasks/accessibility-modal.md). Viết code theo từng task trên `feat/a11y-modal-focus`, kiểm chứng rồi commit riêng; dừng để người dùng review trước khi push/tạo PR/merge.

**Goal:** Các Modal, Drawer và confirm dialog trong CMS có vòng đời focus đúng khi mở, Tab/Shift+Tab, Escape, hủy, hoàn tất thao tác và đóng; không để focus rơi ra nền, vào DOM đã unmount hoặc overlay phía dưới.

**Architecture:** Giữ Mantine 7 `Modal`/`Drawer`/`ModalsProvider` làm owner của focus trap và focus return. Chỉ đặt initial focus, semantic labels và fallback focus cục bộ nơi kết quả browser test chứng minh cần thiết. Overlay xếp lớp cần trả focus về overlay cha khi overlay con đóng. Không tạo hook/focus manager toàn cục hoặc keydown trap thủ công.

**Tech Stack:** React 18, TypeScript, Mantine 7 (`@mantine/core`, `@mantine/modals`, `@mantine/hooks`), React Router 6, Playwright và Vitest đang có. Không cần API mới hoặc Audio API.

## 1. Trạng thái và căn cứ source

- **Trạng thái:** Planned — chỉ viết PLAN/TASK; **chưa code, chưa test A11Y-02, chưa commit/push/PR**.
- **Source baseline đã kiểm tra:** `dev` tại `56060dff10a550a766d79dbda9846a9ad1949c3b` (20/10/2026), sau khi A11Y-01 merge qua PR [#61](https://github.com/ailabs26/ailabs-museum/pull/61). Khi thực hiện phải fetch lại `origin/dev` và kiểm tra xung đột trước khi tạo nhánh.
- Đã đối chiếu `AGENTS.md`, `front-end/docs/coding-conventions.md`, mẫu [`audio-player-01-plan.md`](audio-player-01-plan.md)/[`audio-player-01.md`](../tasks/audio-player-01.md), và tài liệu A11Y-01.
- `front-end/src/AppProviders.tsx` có `ModalsProvider`; `front-end/src/shared/components/feedback/confirm.ts` mở xác nhận qua `modals.openConfirmModal`.
- Các Drawer trong CMS: `UsersPage`, `RolesPage`, `RoomsPage`, `ExhibitsPage` (form và detail), `ModerationPage`, `ReportsPage`, `AuditPage`.
- Modal con trong Drawer: `ModerationPage` (từ chối phiên bản) và `ReportsPage` (xử lý/đóng báo cáo). Cần test **chỉ overlay trên cùng** nhận focus và Escape, sau đó focus quay lại Drawer cha.
- `UsersPage` có `closeOnEscape`/`closeOnClickOutside` phụ thuộc `saveMutation.isPending`; không được phá cơ chế chặn đóng khi lưu.
- Một số Drawer mở từ hàng `DataTable onRowClick` như `ReportsPage`/`AuditPage`: hàng không tự có keyboard activation. Đây là vấn đề trigger của luồng khác; phải ghi rõ giới hạn và **không nhận keyboard end-to-end PASS** nếu không có cách mở bằng bàn phím.
- `ExhibitDetailPanel` ở tour 3D là `<aside>` **non-modal**, đã thuộc A11Y-01; không được trap focus trong component đó.
- Mantine v7 mặc định hỗ trợ `trapFocus`, `returnFocus`, `closeOnEscape` và `data-autofocus`; cần kiểm chứng runtime thay vì thêm `FocusTrap` lồng nhau. Nguồn: [Mantine v7 Modal](https://v7.mantine.dev/core/modal/), [Mantine Drawer](https://mantine.dev/core/drawer/).

## 2. Global constraints

- **Chỉ A11Y-02 — Modal/Drawer focus lifecycle.** Không làm A11Y-03 (audit/checklist/chứng nhận WCAG 2.2 AA toàn site), không sửa lại navigation 3D, Audio Player hoặc tour non-modal.
- Chỉ frontend; không sửa backend/API contract/database/migration/Storage/RBAC, không gọi mutation thật trong tests.
- Không thêm thư viện mới, không tự tạo `document.keydown` handler cho Tab/Escape, không đặt `tabIndex > 0` hoặc tắt `trapFocus`/`returnFocus` để làm test pass.
- Tái dùng behavior native/Mantine. Chỉ thêm `data-autofocus`, `FocusTrap.InitialFocus` hoặc focus-return fallback **khi có lý do và test**; tránh đặt đồng loạt lên tất cả overlay.
- Giữ nguyên business flow save/delete/approve/reject/close; không đổi mutation payload, quyền hạn, toast, trạng thái loading hoặc UX close guard.
- Mọi thay đổi focus phải an toàn khi record bị xóa, permission đổi, phân trang, navigation/route change, async success hoặc overlay cha đóng cùng lúc.
- Không diễn giải một vài keyboard tests là chứng nhận WCAG 2.2 AA. Static source review là **RISK/NOT TESTED**, không phải PASS.
- Quy trình: từ `origin/dev` mới nhất, một nhánh `feat/a11y-modal-focus`, một PR về `dev` **sau review**, mỗi task có commit nhỏ tiếng Anh ngắn (không ghi task number trong subject).

## 3. Lựa chọn thiết kế

| Vấn đề | Cách chọn | Không chọn |
|---|---|---|
| Trap Tab/Shift+Tab | Focus trap của Mantine cho overlay modal thực | Custom global Tab interception / focus manager |
| Initial focus | Theo ngữ cảnh: field hợp lệ, tiêu đề/nội dung cho drawer nhiều thông tin, nút Hủy cho confirm nguy hiểm | Luôn focus nút đầu tiên hoặc auto-focus destructive confirm |
| Escape | Đóng đúng overlay trên cùng theo default Mantine; giữ guard khi mutation pending | Escape đồng thời đóng cả Drawer cha và Modal con |
| Return focus | Mặc định Mantine trả invoker còn hợp lệ; fallback cục bộ nếu trigger đã biến mất | Focus node detached / document.body / menu ẩn |
| Nested overlays | Modal con giữ Tab và trả focus vào control của Drawer cha; nếu thành công đóng cả hai thì focus đích có nghĩa trên trang | Hai trap hoạt động đồng thời / focus về nền khi cha vẫn mở |
| Confirm | Dùng `confirmAction` + `ModalsProvider` hiện có; lựa chọn an toàn được ưu tiên khi phù hợp | Tạo dialog thay thế chỉ để quản lý focus |

### Contract bắt buộc

- **Open:** overlay có `role="dialog"`, accessible name từ title; keyboard focus di chuyển **vào trong overlay** sau mở và không tự nhảy lại ngoài do async load.
- **Tab/Shift+Tab:** mọi bước focus nằm trong overlay trên cùng, bao gồm vòng lặp qua phần tử cuối/đầu; nền không nhận thao tác bàn phím khi overlay mở.
- **Escape/close:** nếu được phép đóng, đóng đúng một lớp; Hủy/đóng bằng nút tương đương; nếu đang lưu và sản phẩm cố ý khóa đóng, trạng thái/phản hồi vẫn rõ, sau settle không bị mắc kẹt.
- **Return:** sau đóng focus về nút/cell/action đã mở nếu còn tồn tại và hợp lệ; nếu không, đến heading/toolbar hoặc control hợp lý trong context, không làm kích hoạt side effect.
- **Success:** nếu thao tác xóa/ghi làm biến mất invoker, **không tái focus record bị xóa**; nếu overlay con + cha cùng đóng, focus về trang; nếu chỉ đóng con, focus về nút trên Drawer cha.
- **Error:** overlay vẫn mở, focus không bị rơi ra ngoài; lỗi phải có thể đọc bằng keyboard/screen reader từ UI hiện hữu (chỉ sửa phần trực tiếp liên quan focus nếu repro).
- **Non-modal:** tour exhibit panel **không dùng** `aria-modal` hoặc focus trap.

### WCAG/APG liên quan (không phải tuyên bố đạt AA)

- WCAG 2.2: **2.1.1 Keyboard**, **2.1.2 No Keyboard Trap**, **2.4.3 Focus Order**, **2.4.7 Focus Visible**, **2.4.11 Focus Not Obscured (Minimum)**, **4.1.2 Name, Role, Value**.
- [W3C APG Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): focus vào dialog khi mở, Tab/Shift+Tab tuần hoàn, Escape, trả focus về invoker hoặc điểm logic khác khi kết thúc workflow.

## 4. Overlay focus lifecycle và các case ưu tiên

| Luồng | Rủi ro phải kiểm chứng | Hành vi chấp nhận |
|---|---|---|
| Users/Roles/Rooms/Exhibits form Drawer | Autocomplete/disabled field, form error, đóng Hủy/Escape, save pending | Focus đầu hợp lý; trap bên trong; return focus khi cancel; mutation guard không làm kẹt |
| Exhibits detail Drawer; Audit read-only Drawer | Dữ liệu tải muộn, nhiều nội dung/ít control, row-trigger không focusable | Có initial focus phù hợp và Tab vẫn dùng được; không khẳng định keyboard opening khi chưa có native trigger |
| `confirmAction` (xóa/gửi duyệt) | Xác nhận phá hủy, cancel/Escape, invoker mất sau success | Focus mặc định vào lựa chọn an toàn khi phù hợp; return hoặc fallback khi xóa |
| Moderation Drawer → Reject Modal | Hai overlay xếp lớp, cancel hoặc mutation success | Modal trên cùng giữ focus; Escape đóng modal, drawer giữ nguyên; success đóng đúng trạng thái và return hợp lý |
| Reports Drawer → Resolve/Dismiss Modal | Tương tự, async success đóng cả modal và Drawer | Focus chỉ ở overlay trên; tránh return về trigger đã bị unmount |
| Route/page change hoặc list refetch | Trigger biến mất; double focus/return race khi animation đóng | Focus ổn định tới đích còn tồn tại; không điều hướng sai hoặc đóng nhầm overlay |

## 5. File map dự kiến khi triển khai

| Task | Candidate files (chỉ sửa nếu có FAIL đã chứng minh) | Trách nhiệm |
|---|---|---|
| A11Y-02.0 | `docs/plans/accessibility-modal-plan.md`, `docs/tasks/accessibility-modal.md`, `front-end/tests/*` focused | Audit overlay inventory và repro |
| A11Y-02.1 | `front-end/src/shared/components/feedback/confirm.ts`, `front-end/src/AppProviders.tsx`, confirm fixture/test | Confirm modal, initial focus, Escape, return |
| A11Y-02.2 | `front-end/src/pages/admin/{Users,Roles,Rooms,Exhibits}Page.tsx`, focused tests | CRUD Drawers: initial/trap/return, save/error |
| A11Y-02.3 | `front-end/src/pages/admin/{Moderation,Reports}Page.tsx`, focused tests | Nested Modal/Drawer và async closing |
| A11Y-02.4 | `front-end/src/pages/admin/{Audit,Exhibits}Page.tsx`, `front-end/src/shared/components/data/DataTable.tsx` **nếu thật sự cần**, tests | Read-only Drawer, detached invoker, fallback và regressions |
| A11Y-02.5 | Focused browser tests, hai tài liệu A11Y-02, README **nếu cần** | Evidence, test matrix, review handoff |

Không thay đổi tất cả file theo danh sách; test PASS trên behavior mặc định thì **không code thêm cho đủ task**.

## 6. Test strategy

- **Baseline matrix:** `flow | overlay/trigger | keyboard sequence | expected focus | actual focus | PASS/FAIL/NOT TESTED | priority | source/test`. Dùng `P0` cho overlay khiến không thể thao tác, `P1` cho focus rơi/mất/lớp sai, `P2` cho focus khởi đầu chưa tối ưu.
- **Playwright real keyboard:** dùng `keyboard.press('Tab')`, `Shift+Tab`, `Escape`, `locator.press('Enter'/'Space')`, `toBeFocused()`, kiểm tra `document.activeElement` ở trong dialog trên cùng. Không chỉ `.click()` rồi báo keyboard PASS; `.click()` được phép thiết lập riêng cho trigger chưa keyboard-accessible nhưng phải ghi hạn chế.
- **Overlay lifecycle:** mở/đóng nhiều lần, cancel vs confirm, disabled/loading, slow GET, error, success; khi nested khẳng định chỉ dialog trên cùng nhận focus và Escape đóng một lớp; khi row bị xóa/paginate không focus vào detached node.
- **Fixtures:** tái dùng `front-end/tests/fixtures/moderationApi.ts` và fixture có sẵn; thêm mocks xác thực read/write khi cần. Mọi mutation phải bị intercept và chỉ ghi mock request, không gọi API thật; không tạo/xóa dữ liệu CMS.
- **Responsive:** 320/768/1440px, light/dark, Tab focus visible/không bị overlay header/footer che; ít nhất một case dialog dài scroll + một case no-tabbable/disabled controls.
- **Regression:** A11Y-01 keyboard (`accessibility-keyboard.spec.ts`, `admin-navigation-keyboard.spec.ts`, `moderation-keyboard.spec.ts`), CMS tests bị ảnh hưởng và `museum-interaction.spec.ts` (bảo vệ panel non-modal). Không đổi API hoặc 3D.
- **Manual:** keyboard-only và screen-reader spot check trên môi trường có thể chạy; nếu không có báo NOT TESTED, không tự chứng nhận accessibility.

Chạy **sau khi được duyệt**, trong `front-end/`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
# Tests fixture trên Vite dev; không dùng backend/live API.
Remove-Item Env:PLAYWRIGHT_PREVIEW -ErrorAction SilentlyContinue
Remove-Item Env:MUSEUM_LIVE_TEST -ErrorAction SilentlyContinue
npm.cmd test -- accessibility-modal.spec.ts accessibility-keyboard.spec.ts admin-navigation-keyboard.spec.ts moderation-keyboard.spec.ts --reporter=line
# Mở rộng bằng các suite thực tế bị sửa/ảnh hưởng; báo cáo số pass/fail thật.
```

## 7. Acceptance và task mapping

| Nghiệm thu | Task | Bằng chứng yêu cầu |
|---|---|---|
| Inventory overlay và chứng minh failure trước fix | A11Y-02.0 | Matrix, test/repro, owner và scope |
| Confirm nhận focus đúng, Tab trap, Escape/cancel/confirm | A11Y-02.1 | Browser real-keyboard, safe initial focus, return |
| CMS CRUD Drawer mở/đóng/lưu/lỗi không mất focus | A11Y-02.2 | Focused tests với disabled/loading, return success/cancel |
| Nested Modal → Drawer không leak focus, Escape một lớp | A11Y-02.3 | Layered-dialog test, async success/error |
| Read-only Drawer và invalidated trigger có fallback | A11Y-02.4 | Slow data, detached DOM, focus target hợp lệ |
| Quality gates, regression, evidence và review | A11Y-02.5 | Log chính xác; danh sách NOT TESTED/blocked; clean diff |

### Mốc commit theo task (khi có thay đổi thực sự)

| Task | Commit đề xuất |
|---|---|
| A11Y-02.0 | `docs(a11y): plan modal focus management` |
| A11Y-02.1 | `fix(a11y): refine confirmation focus` |
| A11Y-02.2 | `fix(a11y): improve form drawer focus` |
| A11Y-02.3 | `fix(a11y): preserve nested dialog focus` |
| A11Y-02.4 | `fix(a11y): handle detached focus targets` |
| A11Y-02.5 | `test(a11y): verify modal focus lifecycle` |

Không tạo commit rỗng khi behavior đã đúng; test-only commit vẫn hợp lệ nếu bổ sung regression evidence. Khi code hoàn thành, dừng chờ người dùng review rồi mới push/PR theo chỉ dẫn.

## 8. Tự review kế hoạch

- [x] Phạm vi A11Y-02 riêng; không gộp A11Y-03 hoặc làm lại A11Y-01.
- [x] Căn cứ từ `dev` sau PR #61, `AGENTS.md` và mẫu file AUDIO-01.
- [x] Có case riêng cho confirm, CRUD Drawer, nested Modal, read-only Drawer và detached trigger.
- [x] Mantine là focus trap owner; không thêm trap/manager khác theo suy đoán.
- [x] Test với fixture mock, không cần backend và không ghi dữ liệu thật.
- [x] Có file map, test strategy, acceptance, mốc commit và review gate.
- [x] Người dùng review/duyệt PLAN/TASK.

### Verification evidence

- **PLAN ONLY:** source `dev` `56060df` đã đọc; tài liệu Mantine v7/W3C APG đã đối chiếu.
- Chưa chạy A11Y-02 Playwright, unit, lint, typecheck hoặc build; không có test PASS mới để báo.
- Chưa tạo branch/commit/PR. Các kết quả test A11Y-01 trong PR #61 không thay thế verification cho A11Y-02.
