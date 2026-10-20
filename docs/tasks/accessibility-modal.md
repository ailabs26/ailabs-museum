# A11Y-02 — Task breakdown: Modal/Drawer Focus Management

**Trạng thái:** Planned — chỉ PLAN/TASK, chưa triển khai.
**Plan:** [accessibility-modal-plan.md](../plans/accessibility-modal-plan.md).
**Source đã khảo sát:** `dev` SHA `56060dff10a550a766d79dbda9846a9ad1949c3b` (20/10/2026; PR #61 A11Y-01 đã merge).
**Execution gate:** Người dùng đã duyệt. `origin/dev` đã fetch, baseline `56060df`; triển khai tuần tự trên `feat/a11y-modal-focus` và commit riêng từng task có thay đổi được chứng minh. Không tự push/tạo PR/merge.

Checkbox là kế hoạch **chưa thực hiện**, không phải evidence. Chỉ tick `[x]` khi có test và diff thật.

## Quy tắc chung

- Chỉ **A11Y-02**: focus trap/modal lifecycle cho `Modal`, `Drawer`, `confirmAction` ở CMS; initial focus, Tab/Shift+Tab, Escape, return/fallback, nested overlay và mutation states.
- Không làm A11Y-03/WCAG site-wide checklist, không trap panel tour `ExhibitDetailPanel` non-modal, không sửa Audio API/tour/WebGL.
- Mantine 7 giữ trách nhiệm focus trap/return; không tự viết keyboard listener toàn cục, không tắt các mặc định hỗ trợ accessibility chỉ để pass test.
- Không thay backend/DB/migration/Storage/RBAC/business logic. Không thêm thư viện, trừ khi có lý do được duyệt riêng.
- Thứ tự **A11Y-02.0 → 02.1 → 02.2 → 02.3 → 02.4 → 02.5** trên cùng feature branch. Nếu task chỉ audit và không cần code, ghi PASS/NOT APPLICABLE và không tạo commit rỗng.
- Mỗi task có file/test/acceptance; chỉ stage đúng phần liên quan, commit tiếng Anh ngắn. Trước commit: `git status`, `git diff`, `git diff --check`, kiểm tra secrets và test.
- Tests chỉ dùng fixtures/mocked API. Không ghi/xóa/duyệt dữ liệu CMS thật; báo rõ `NOT TESTED` nếu chưa mô phỏng được auth/quyền hoặc device.

## A11Y-02.0 — Baseline Modal/Drawer và duyệt tài liệu

**Mục tiêu:** Ghi đầy đủ overlay và xác nhận lỗi keyboard bằng browser trước khi sửa.

### File tác động

- `docs/plans/accessibility-modal-plan.md`, `docs/tasks/accessibility-modal.md`.
- Có thể bổ sung `front-end/tests/accessibility-modal.spec.ts` hoặc focused fixture repro sau duyệt, nếu cần.

### Interface

- Matrix: `route/component | trigger | key sequence | expected/actual focus | state | priority | owner/test`.
- Severity: P0 = kẹt/không thể dùng overlay; P1 = trap/return/layer sai; P2 = initial focus/announcement chưa hợp lý.

### Các bước thực hiện

- [ ] Fetch latest `origin/dev`, kiểm tra working tree, `AGENTS.md`, conventions và source Mantine đang dùng; chốt SHA.
- [ ] Inventory confirm qua `confirmAction`; Drawer Users/Roles/Rooms/Exhibits/Moderation/Reports/Audit; nested modal ở Moderation/Reports.
- [ ] Dùng Tab, Shift+Tab, Enter, Space, Escape trên overlay; kiểm tra `role=dialog`, accessible name, initial focus và focus return.
- [ ] Tái hiện các trạng thái loading, close, save error/success, trigger đã bị unmount và hai lớp overlay; phân biệt lỗi có thật với risk tĩnh.
- [ ] Ghi PASS/FAIL/NOT TESTED, owner, bước tái hiện. Trigger row-click không keyboard-accessible ở Audit/Reports phải ghi giới hạn, không suy đoán đạt keyboard end-to-end.
- [ ] Review tài liệu, chỉ sau khi người dùng duyệt mới commit `docs(a11y): plan modal focus management`.

### Test / acceptance criteria

- [ ] Matrix bao phủ tất cả loại overlay đã kiểm kê, không tự báo PASS từ source inspection.
- [ ] Mỗi FAIL có repro ngắn, owner, priority và test dự kiến; không kéo tính năng A11Y-03 vào scope.
- [ ] Có đường test qua mocks/fixture, không yêu cầu API backend chạy.

## A11Y-02.1 — Confirm Modal và focus an toàn

**Phụ thuộc:** A11Y-02.0.
**Mục tiêu:** Confirm dialog có initial focus hợp lý, bẫy focus đúng và đóng/trả focus an toàn.

### File tác động

- `front-end/src/shared/components/feedback/confirm.ts`, `front-end/src/AppProviders.tsx` **nếu thực sự có lỗi**.
- `front-end/tests/accessibility-modal.spec.ts` và fixture mock confirm được test (ưu tiên dùng flow Users/Roles/Rooms/Exhibits hiện có).

### Interface

- Giữ public `confirmAction(options)`; không đổi callback payload.
- Confirm hủy/xóa: cân nhắc đặt initial focus vào **Hủy** nếu test chứng minh mặc định không phù hợp; không tự focus nút nguy hiểm.

### Các bước thực hiện

- [ ] Tạo test mở confirm bằng keyboard từ action có thể focus; xác minh tên dialog, focus trong modal, Tab/Shift+Tab không ra nền.
- [ ] Test Escape, Hủy và close button không thực hiện mutation; sau đóng focus về invoker còn hợp lệ.
- [ ] Test Enter/Space confirm đúng một lần với API mock, không submit/trigger nền vô tình.
- [ ] Test xác nhận xóa khiến hàng/invoker biến mất: focus về vị trí tồn tại có nghĩa thay vì body/detached node.
- [ ] Chỉ sửa props/config Mantine v7 khi xác nhận lỗi; không dựng dialog mới; giữ nguyên confirm semantics.
- [ ] Chạy focused test, typecheck, lint, build; review diff và commit nếu có thay đổi.

### Test / acceptance criteria

- [ ] Focus luôn ở dialog trên cùng khi confirm mở; Escape/Hủy không mutate; Enter/Space chỉ xác nhận có chủ đích.
- [ ] Return/fallback focus hợp lệ kể cả sau xóa; không gây double mutation hoặc fake keyboard PASS.
- [ ] `confirmAction` caller hiện tại không bị đổi behavior nghiệp vụ.

## A11Y-02.2 — CRUD Form Drawer: initial focus, Tab và save

**Phụ thuộc:** A11Y-02.1.
**Mục tiêu:** Form Drawer CMS dùng bàn phím hoàn chỉnh, không mất focus khi loading/error/save.

### File tác động

- `front-end/src/pages/admin/UsersPage.tsx`, `RolesPage.tsx`, `RoomsPage.tsx`, `ExhibitsPage.tsx` **chỉ nơi cần fix**.
- `front-end/tests/accessibility-modal.spec.ts` hoặc chia `admin-drawer-focus.spec.ts`; mock API fixtures nếu cần.

### Interface

- Trong Drawer, Tab/Shift+Tab tuần hoàn trong overlay; focus đầu vào trường editable có nghĩa (không focus field bị disable), hoặc heading khi form dài.
- Hủy/Escape khôi phục invoker; save pending tôn trọng `closeOnEscape` guard; save error giữ Drawer và cho phép sửa/đọc lỗi.

### Các bước thực hiện

- [ ] Browser test mở Tạo/Sửa bằng Enter/Space từ trigger, verify focus đi vào Drawer và title được accessible name.
- [ ] Test Tab/Shift+Tab first→last→first, kể cả Select/MultiSelect và disabled/edit fields; không chui ra bảng phía dưới.
- [ ] Test Hủy, nút X và Escape khi không pending, confirm return tới đúng trigger.
- [ ] Test save loading và error bằng mocked response; trên UsersPage tôn trọng việc không đóng khi pending, sau settle không trap vĩnh viễn.
- [ ] Test save success và refetch làm trigger đổi/xóa: focus đích vẫn hợp lệ, không tự đẩy focus về body.
- [ ] Dùng `data-autofocus`/`FocusTrap.InitialFocus` đúng chỗ nếu cần; không thêm custom focus loop, không đổi validation hoặc mutation.
- [ ] Chạy tests + gates; review/commit nếu có fix.

### Test / acceptance criteria

- [ ] Forms không thể Tab ra nền; focus ban đầu không rơi vào disabled element; Enter/Space hoạt động theo control semantics.
- [ ] Escape/Hủy/Close đúng trạng thái; error không mất focus, success đưa focus về ngữ cảnh hợp lệ.
- [ ] Không làm thay đổi RBAC hoặc create/update payload.

## A11Y-02.3 — Nested Modal bên trong Drawer

**Phụ thuộc:** A11Y-02.2.
**Mục tiêu:** Chỉ overlay trên cùng giữ focus và chỉ lớp đó đóng khi bấm Escape.

### File tác động

- `front-end/src/pages/admin/ModerationPage.tsx`, `front-end/src/pages/admin/ReportsPage.tsx`.
- `front-end/tests/accessibility-modal.spec.ts` hoặc focused nested-dialog tests; mở rộng mock `front-end/tests/fixtures/moderationApi.ts` nếu cần, không ghi dữ liệu thật.

### Interface

- Moderation: Drawer revision → Modal từ chối; Reports: Drawer báo cáo → Modal xử lý/đóng.
- Khi Modal con mở, focus của Drawer cha không nhận Tab; khi Hủy/Escape Modal, focus về action trong Drawer; success đóng cả hai chỉ trả focus về trang.

### Các bước thực hiện

- [ ] Test keyboard mở Drawer (nếu có native trigger) và Modal con; với trigger row-click-only, setup bằng click nhưng **đánh dấu giới hạn**.
- [ ] Test dialog topmost có accessible name và focus đầu hợp lý (Textarea hoặc tiêu đề); Tab/Shift+Tab không thoát sang Drawer cha.
- [ ] Test Escape/Hủy đóng đúng Modal, Drawer vẫn mở, focus trả đúng nút `Từ chối`/`Xử lý xong`/`Đóng/bác`.
- [ ] Test validation lỗi/textarea rỗng và async reject giữ Modal; không tự close khi mutation fail.
- [ ] Mock success đóng Modal + Drawer; kiểm tra return focus về phần tử hợp lệ của trang, không leak qua backdrop hoặc node đã unmount.
- [ ] Không thêm focus trap tay hoặc thay đổi logic publish/reject/resolve; chỉ sửa owner focus đúng chỗ.
- [ ] Chạy tests/gates; review/commit nếu có thay đổi.

### Test / acceptance criteria

- [ ] Escape chỉ đóng overlay trên cùng, background không nhận focus khi Modal con đang mở.
- [ ] Close modal mà giữ Drawer vẫn trả focus vào Drawer; đóng cả hai trả ra trang có nghĩa.
- [ ] Form data và mutation side effects không đổi.

## A11Y-02.4 — Read-only Drawer và detached trigger

**Phụ thuộc:** A11Y-02.2–02.3.
**Mục tiêu:** Focus hợp lý khi dữ liệu tải muộn/không có form và khi invoker biến mất.

### File tác động

- `front-end/src/pages/admin/AuditPage.tsx`, `ExhibitsPage.tsx` (detail drawer), `ModerationPage.tsx`/`ReportsPage.tsx` nếu cần sửa fallback.
- `front-end/src/shared/components/data/DataTable.tsx` **chỉ nếu có bằng chứng bắt buộc**, không tự đổi public interface.
- Browser tests và mocked GET cho slow/error/empty.

### Interface

- Read-only Drawer: initial focus vào vị trí an toàn (đóng/title/content) và label có nghĩa, Tab không thoát nền.
- Detached trigger: restore về heading/list toolbar/nút tương đương còn tồn tại, không vào DOM đã mất hoặc ẩn.

### Các bước thực hiện

- [ ] Dùng fixture slow GET để mở detail Drawer lúc loading → ready/error; xác minh focus không nhảy ngẫu nhiên vào content load muộn.
- [ ] Test read-only Drawer có ít control vẫn dùng Tab/Shift+Tab/Escape và close button được.
- [ ] Test refetch/pagination/xóa record/route change làm invoker mất; đóng Drawer vẫn có focus target hợp lệ.
- [ ] Ghi rõ giới hạn keyboard-opening với bảng click-row-only (Audit/Reports) để xử lý theo phạm vi được duyệt, không che giấu.
- [ ] Chỉ sửa fallback focus cục bộ; không tự tạo global listener, không thay click-row semantics chưa được duyệt.
- [ ] Chạy affected tests/gates; review/commit nếu có change.

### Test / acceptance criteria

- [ ] Open/close và async update không gây leaked/vanished focus, keyboard trap luôn thuộc Drawer thực.
- [ ] Có fallback focus có nghĩa khi invoker mất; không refocus button disabled/hidden.
- [ ] Giới hạn trigger keyboard của một số bảng được công khai; không tự nhận tất cả CMS fully keyboard accessible.

## A11Y-02.5 — Regressions, evidence và review handoff

**Phụ thuộc:** A11Y-02.1–02.4.
**Mục tiêu:** Nghiệm thu riêng A11Y-02 có bằng chứng và các giới hạn rõ ràng.

### File tác động

- Tests mới/cập nhật thực sự ảnh hưởng; `docs/plans/accessibility-modal-plan.md`, `docs/tasks/accessibility-modal.md`; README nếu có thay đổi cách dùng overlay.

### Các bước thực hiện

- [ ] Chạy `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test:unit`, `npm.cmd run build` từ `front-end/`.
- [ ] Chạy focused Playwright cho confirm, CRUD Drawer, nested dialog, read-only Drawer, invalidated triggers.
- [ ] Chạy affected keyboard regressions A11Y-01 và các suites CMS/Museum nếu sửa shared components; ghi số passed/failed/skipped thật.
- [ ] Spot check keyboard-only ở 320/768/1440 và light/dark; nếu không chạy screen reader/thiết bị thật phải ghi NOT TESTED.
- [ ] Review diff/files/dependencies, `git diff --check`, kiểm tra không có `tmp/`, `.env`, API keys hoặc test artifacts lọt commit.
- [ ] Cập nhật baseline matrix, outcomes theo task, commit ledger, lingering issues. Không báo đạt WCAG 2.2 AA toàn site.
- [ ] Báo cáo nhánh, commit, files, test evidence và DỪNG để người dùng review; chỉ push/tạo PR/merge khi được yêu cầu.

### Test / acceptance criteria

- [ ] Mỗi overlay/flow có kết quả PASS hoặc issue/NOT TESTED và repro; lỗi P0/P1 tồn đọng phải chặn nghiệm thu hoặc được người review xử lý rõ.
- [ ] Gates đạt trên code đã thay đổi hoặc có blocker minh bạch; không dùng kết quả A11Y-01 làm bằng chứng thay thế.
- [ ] Không làm các mục A11Y-03/tour non-modal/Audio API; task commits không bị squash/force-push ngoài quyết định người dùng.

## Review gate hiện tại

- [x] Đọc `AGENTS.md`, mẫu AUDIO-01, A11Y-01 và mã nguồn `dev` mới nhất đã xác định.
- [x] Chỉ thiết kế A11Y-02; có file map, test/acceptance và task phân rõ phạm vi.
- [x] Phân biệt nested modal thực, Drawer và non-modal panel.
- [x] Người dùng duyệt PLAN/TASK.
- [ ] Implementation bắt đầu sau duyệt.

## Evidence sau triển khai

- **PLAN ONLY**: chưa chạy test A11Y-02, chưa sửa source và chưa có commit.
- Baseline GitHub: `dev` `56060df` (20/10/2026), PR #61 (A11Y-01) đã merge.
- Các test của A11Y-01 chỉ làm baseline tham khảo; không được ghi thành kết quả A11Y-02.
- Điền verification log và commit SHA thực tế vào đây **sau** mỗi task được triển khai/kiểm chứng.
