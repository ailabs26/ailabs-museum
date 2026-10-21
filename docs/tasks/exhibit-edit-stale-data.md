# CMS Exhibit Edit — Task breakdown: Fix dữ liệu cũ khi mở lại form

**Trạng thái:** Đã duyệt, bắt đầu triển khai.
**Plan:** [exhibit-edit-stale-data-plan.md](../plans/exhibit-edit-stale-data-plan.md).
**Branch/base:** `fix/exhibit-edit-stale-data` từ `origin/dev` `37f5de7`.

## Quy tắc thực thi

- Người dùng đã duyệt hai tài liệu; commit docs trước source và dừng sau triển khai để review.
- Sau duyệt, dùng cùng nhánh cho docs và code; commit riêng mỗi task sau kiểm chứng, không push/PR/merge nếu chưa được yêu cầu.
- Giữ workflow lưu nháp → gửi duyệt → xuất bản. Không sửa backend/API/database/migration hoặc thêm UI audio/ảnh vào trang khách.
- Mỗi task gồm source + tests liên quan và bằng chứng trong docs. Trước commit xem status, toàn diff và `git log --oneline -10`, kiểm tra secrets/whitespace; chỉ stage file thuộc task.
- Test-first cho thay đổi hành vi; lỗi runner/fixture không tính RED sản phẩm. Không tạo commit rỗng, không amend/squash task đã commit.

## EDIT-00 — Duyệt và commit tài liệu

**Files:** Hai tài liệu `docs/plans/exhibit-edit-stale-data-plan.md`, `docs/tasks/exhibit-edit-stale-data.md`.

**Các bước**
- [x] Người dùng duyệt luồng GET detail mới, session guard và cache sau save.
- [x] Fetch lại dev, so sánh thay đổi liên quan với baseline; bảo toàn worktree người dùng.
- [x] Cập nhật trạng thái đã duyệt và review đủ file/test/acceptance trong tài liệu.
- [ ] Chạy whitespace check cho hai docs; stage đúng hai file và commit `docs(exhibits): plan fresh edit form loading`.

**Test:** review nội dung + `git diff --cached --check`; không chạy frontend chỉ vì Markdown.
**Acceptance:** Docs được duyệt trước source; cùng một nhánh fix cho toàn nhiệm vụ.

## EDIT-01 — Hydrate form từ detail mới và ngăn stale response

**Files**
- Sửa `front-end/src/pages/admin/ExhibitsPage.tsx`: `openEdit`, loader detail/hotspots, create/close handlers, Drawer loading/error và save guard.
- Tạo `front-end/tests/exhibit-edit-persistence.spec.ts`.
- Tạo `front-end/tests/fixtures/exhibitEditApi.ts`.
- Cập nhật evidence trong task hiện tại.

**Interface**
- Giữ `exhibitsService.get(id): Promise<ExhibitDetail>` và API payload.
- `openEdit(exhibit)` có thể trả `Promise<boolean>`: true chỉ khi detail đúng phiên đã hydrate; false khi stale/error. Cập nhật submit-review 422 caller theo cùng contract.
- Phiên mở/retry/create/close được nhận diện bằng token ref, không chỉ ID.

**Các bước**
- [ ] Tái dùng auth fixture có optional permissions; cài route API mock giới hạn pathname `/api/`, không chặn module `/src/core/api/`.
- [ ] Viết stateful fixture PATCH lưu v2 và GET detail trả v2, list có thể giữ v1 pending. Mọi mutation bị intercept, không truy cập API thật.
- [ ] Viết test mở Sửa từ list v1 nhưng detail v2: loading không có form cũ editable, sau ready toàn bộ trường khớp detail.
- [ ] Viết test lỗi GET + Retry, detail cache còn fresh, request cũ pending, A→B, đóng→mở lại cùng A và A→Tạo mới; cho response đến đảo thứ tự.
- [ ] Chạy `npm.cmd test -- exhibit-edit-persistence.spec.ts --reporter=line`, xác nhận RED ở dữ liệu form/guard thực tế.
- [ ] Implement loader detail fresh, hydrate một lần toàn bộ fields bằng response đúng phiên; dùng localized getter không fallback chéo ngôn ngữ; bỏ loader chỉ hydrate hotspots.
- [ ] Kiểm tra IN_REVIEW/quyền từ detail mới và không bật Lưu nếu không còn được sửa; không đổi chính sách RBAC hoặc bypass guard backend.
- [ ] Bổ sung loading/error/retry và chặn Lưu; invalidate token trên mọi đường đóng/create/retry; guard sau cancel và sau response.
- [ ] Cập nhật nhánh 422 submit-review: chỉ map error/tab sau đúng phiên hydrate thành công; nếu GET lỗi thì giữ retry và không map lỗi sang form khác.
- [ ] Test refetch nền khi form dirty không reset input; test closing không bị stale response mở lại Drawer.
- [ ] Chạy focused tests, typecheck/lint/build; review diff, cập nhật evidence và commit `fix(exhibits): load edit forms from fresh detail`.

**Test / acceptance**
- [ ] Tên/mô tả/song ngữ, transforms, 6 slot media, altText/transcript/hotspots đều từ cùng detail mới, không trộn list/detail khác phiên.
- [ ] Không PATCH khi loading/error; Retry phục hồi. Không hydrate từ cache detail 30 giây hoặc pending query trước save.
- [ ] Token phân biệt cùng ID mở lại; response cũ không thay form mới và không xóa dữ liệu đang nhập.
- [ ] Caller 422, retry hotspot và tạo mới không regress; không thay payload/RBAC/publish.
- [ ] Frontend gates và focused test có output đạt trước commit.

## EDIT-02 — Đồng bộ cache và bảo vệ lần lưu kế tiếp

**Phụ thuộc:** EDIT-01.
**Files:** `ExhibitsPage.tsx`, test và fixture EDIT-01, evidence task.

**Interface**
- PATCH trả `ExhibitRow`; cache list `Page<ExhibitRow>`, prefix `['admin-exhibits']`.
- Cache detail `ExhibitDetail` giữ key `['admin-exhibit-detail', id]`; không ép kiểu row thành detail.

**Các bước**
- [ ] Test PATCH v2 thành công, list v1 pending: toast báo lưu nháp, mở ngay form phải lấy v2. PATCH tiếp theo không được gửi lại text/IDs v1.
- [ ] Test đổi/gỡ ảnh và audio: `null` giữ nghĩa tháo, UUID giữ nghĩa gắn; roundtrip đủ altText/transcript/hotspots.
- [ ] Test cache nhiều bộ lọc/trang: chỉ thay row đúng ID đã tồn tại, giữ meta/order/record khác; không chèn row vào cache không khớp. Server refetch vẫn quyết định membership.
- [ ] Test response GET/list từ trước PATCH resolve muộn không phục hồi cache/form v1. Test list refetch lỗi không được dùng row cũ thay nguồn detail editable.
- [ ] Chạy focused test để thấy RED ở cache/toast hoặc overwrite tương ứng.
- [ ] Trong success handler, cancel pending queries cũ cần thiết, seed row save response qua `setQueriesData`, mark detail stale và refetch list; khóa thao tác trong lúc handler đang xử lý để không đóng phiên form mới.
- [ ] Đổi toast edit thành “Đã lưu bản nháp hiện vật …”; xác nhận không gọi submit-review/publish sau save. Giữ create flow rõ là bản nháp.
- [ ] Chạy focused tests và gates; cập nhật evidence, review và commit `fix(exhibits): synchronize saved drafts with list cache`.

**Test / acceptance**
- [ ] Reopen khi list refetch chậm vẫn hiển thị detail mới; lần Lưu tiếp không rollback trường mới/media mới.
- [ ] Cache list không bị response cũ ghi đè trong cửa sổ success xử lý; detail không bị thay bằng row thiếu dữ liệu.
- [ ] Filter/meta/order giữ đúng cho đến server refetch; refetch lỗi có trạng thái phù hợp và không mở đường lưu stale form.
- [ ] Toast phân biệt save/publish; payload và request workflow không thay đổi.

## EDIT-03 — Regression, bằng chứng và bàn giao

**Phụ thuộc:** EDIT-02.
**Files:** test/fixture nhiệm vụ nếu phát hiện thiếu case; hai tài liệu hiện tại. Chỉ cập nhật README nếu có hướng dẫn dùng thay đổi cần ghi.

**Các bước**
- [ ] Chạy test mới cùng `admin-drawer-focus.spec.ts`, `readonly-drawer-focus.spec.ts`, `moderation-keyboard.spec.ts`; thêm `accessibility-modal.spec.ts`, `modal-responsive-focus.spec.ts` cho hồi quy Drawer.
- [ ] Chạy frontend typecheck/lint/build; nếu sửa helper, chạy unit tương ứng. Không chạy test DB/migration hoặc smoke script CMS thật.
- [ ] Review toàn diff so với base: lỗi sửa đúng lớp, không backend/dependency hoặc cleanup ngoài nhiệm vụ; không có artifact/credentials.
- [ ] Ghi test counts, failed/skipped/NOT TESTED, môi trường và ledger commit thật. Không đánh dấu DB persistence/live đã kiểm tra bằng kết quả mock.
- [ ] Commit evidence `test(exhibits): verify edit save and reopen lifecycle`, rồi DỪNG cho người dùng review; chưa push/PR/merge.

**Lệnh verification dự kiến, working directory `front-end/`**

```powershell
npm.cmd test -- exhibit-edit-persistence.spec.ts admin-drawer-focus.spec.ts readonly-drawer-focus.spec.ts moderation-keyboard.spec.ts accessibility-modal.spec.ts modal-responsive-focus.spec.ts --reporter=line
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

**Acceptance**
- [ ] Lỗi điều tra có regression kiểm tra cả UI hiển thị và payload lần save kế tiếp.
- [ ] Loading/error/stale sessions/dirty form/422/media/null/cache filters có bằng chứng; blocker phải ghi rõ, không nhận nghiệm thu giả.
- [ ] Từng task có commit nhỏ, diff chỉ frontend + tài liệu/test; public publication flow giữ nguyên.
- [ ] Báo cáo nhánh, commits, verification và phần thiếu; dừng trước push/PR.

## Review gate hiện tại

- [x] Đã điều tra source và tái hiện bằng browser/API mock ở phiên trước.
- [x] `origin/dev` đã fetch, baseline `37f5de7`; nhánh fix đã tạo.
- [x] Đã viết PLAN/TASK có bước/file/test/acceptance và mốc commit.
- [x] Người dùng duyệt hai tài liệu.
- [ ] Commit docs và bắt đầu implementation sau duyệt.

## Evidence triển khai

- EDIT-00: `4bc772f` — docs đã duyệt, fetch origin/dev không đổi baseline.
- EDIT-01: RED 4/5 fail đúng symptom (loading/error/stale detail/in-review), 1 ca create đã đúng; sau fix **7/7 PASS**, gồm 422 và A→B. Typecheck/lint/build PASS; build còn cảnh báo chunk >500 kB hiện hữu.
- Form nạp detail mới với staleTime 0, cancel promise query cũ và token phiên; chỉ hydrate một lần toàn bộ fields. API/schema/backend không đổi.
- EDIT-02: RED ở toast/cache list; bổ sung race 422 cũ mở đè form B đã fail rồi sửa guard phiên. Sau sửa **12/12 PASS**, typecheck/lint/build PASS. Test kiểm tra cache nhiều filter/meta, pending list cũ, dirty form, null media và payload lần save kế tiếp.
- Chưa push/PR; test browser dùng stateful API mocks, không xác nhận DB production persistence.
