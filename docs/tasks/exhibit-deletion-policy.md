# Exhibit Deletion Policy — Task breakdown

**Trạng thái:** Đã duyệt, bắt đầu triển khai; chưa push/PR.
**Plan:** [exhibit-deletion-policy-plan.md](../plans/exhibit-deletion-policy-plan.md).
**Branch/base:** `fix/exhibit-deletion-policy` từ `origin/dev` `f4ab406`, đã fetch và đồng bộ.

## Quy tắc

- Chỉ viết docs trong phiên này, dừng chờ duyệt. Sau duyệt commit docs trước source, mỗi task có commit riêng trên cùng branch; không push/PR/merge khi chưa được yêu cầu.
- Không thêm xóa revision; giữ endpoint xóa riêng revision hiện có. Không migration/schema/RBAC/dependency mới hoặc mutation dữ liệu thật.
- Trước commit kiểm status/diff/log/secrets/whitespace, stage đúng task; source commit chỉ sau focused tests và gates đạt, không squash/amend/commit rỗng.
- Chỉ test mocks/metadata/isolated runner mặc định; không tự chạy suites PostgreSQL có migration/seed. DB concurrency chưa kiểm chứng phải ghi blocker/NOT TESTED để reviewer quyết định.

## DELETE-00 — Duyệt và commit kế hoạch

**Files:** hai tài liệu hiện tại.

**Bước**
- [x] Người dùng duyệt policy/report protection, đường Hide và phạm vi phối hợp writer locks.
- [x] Fetch lại origin/dev, đối chiếu thay đổi liên quan từ baseline, bảo toàn user work.
- [ ] Đánh dấu đã duyệt, review file/task/tests và commit `docs(exhibits): plan deletion policy fixes` sau whitespace check.

**Test:** docs review + `git diff --cached --check`.
**Acceptance:** Docs duyệt/commit trước implementation, đúng một branch cho feature.

## DELETE-01 — Backend policy và transaction correctness

**Files**
- `back-end/src/modules/exhibits/services/exhibits.service.ts`.
- `back-end/src/modules/exhibits/repositories/exhibits.repository.ts`.
- `back-end/src/modules/moderation/services/moderation.service.ts`, `repositories/moderation.repository.ts` chỉ nếu race test yêu cầu phối hợp writer.
- Tạo `back-end/src/modules/exhibits/tests/exhibit-deletion-policy.spec.ts`.
- Cập nhật `exhibits-service.spec.ts`, `exhibits-repository.spec.ts`, `admin-exhibits-controller.spec.ts` và `moderation-service.spec.ts` tương ứng khi contract repository/tx đổi.

**Interface**
- Giữ `deleteExhibitDraft(id): Promise<{ success: boolean; message: string }>` và route/permission/audit hiện có.
- Repo bổ sung tên method cụ thể như `findForDeletion(id, manager)`, `findRevisionsForDeletion(id, manager)`, `hasReportReferences(id, revisionIds, manager)`; tất cả queries trong tx dùng manager.
- Chỉ dùng native PostgreSQL row locks trong repository, không service truy cập TypeORM/global mutex.

**Bước**
- [ ] Test trước policy matrix: chưa published Draft/Rejected/no revision cho xóa; pointer/visible/Approved bất kỳ/In Review bất kỳ/reports open/resolved/dismissed chặn.
- [ ] Test guard/reports từ snapshot **trong tx**, truyền cùng manager, check report exhibitId hoặc reportedRevisionId, không gọi media/storage delete.
- [ ] Chạy RED để chứng minh In Review/hidden published UI/backend gaps; test message không còn “ẩn trước rồi xóa”.
- [ ] Implement khóa exhibit riêng dòng, đọc/khóa revision, xét policy/report rồi cascade trong cùng transaction; report check qua repository.
- [ ] Test FK 23503 report phát sinh sau precheck → rollback và 409; constraint khác/exception khác không bị nuốt. Xác định tên constraint từ entity metadata thay vì hardcode đoán.
- [ ] Test lịch biểu DELETE↔submit/update/publish. Đọc và kiểm tra lại record/state sau lock trước ghi, không save stale entity để resurrect record. Tôn trọng media→exhibit→revision cho writer có gate; DELETE exhibit→revision và không khóa media.
- [ ] Chỉ bổ sung writer revalidation/lock cần thiết với failing test. Nếu không thể giải quyết race gọn trong phạm vi hoặc có deadlock, dừng xin review trước tiếp tục; không tuyên bố atomic chỉ vì mock tx callback PASS.
- [ ] Test DELETE báo 404/409 chuẩn envelope và quyền `exhibit:update`/audit không đổi; xóa riêng revision vẫn giữ behavior cũ.
- [ ] Chạy focused tests + typecheck/lint/build backend, review diff và commit `fix(exhibits): enforce safe whole-exhibit deletion`.

**Test commands — `back-end/`**
```powershell
node -r reflect-metadata -r ts-node/register --test src/modules/exhibits/tests/exhibit-deletion-policy.spec.ts src/modules/exhibits/tests/exhibits-service.spec.ts src/modules/exhibits/tests/exhibits-repository.spec.ts src/modules/exhibits/tests/admin-exhibits-controller.spec.ts src/modules/moderation/tests/moderation-service.spec.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

**Acceptance**
- [ ] Không hard-delete hiện vật có Published/Approved/In Review hoặc report refs; media không bị xóa theo.
- [ ] Guard và cascade chung transaction, rollback không mất hotspots/revisions khi delete thất bại; không resurrect từ writer stale.
- [ ] FK report chuyển đúng 409, DB errors khác không bị che; không schema/migration/RBAC changes.
- [ ] Test/lock evidence và giới hạn DB concurrency thật được ghi rõ trước nghiệm thu.

## DELETE-02 — CMS guard và xác nhận xóa đúng nghĩa

**Phụ thuộc:** DELETE-01.
**Files:** `front-end/src/pages/admin/ExhibitsPage.tsx`; tạo `front-end/tests/exhibit-deletion-policy.spec.ts`, `front-end/tests/fixtures/exhibitDeletionApi.ts`.

**Interface:** dùng `ExhibitRow.publishedRevisionId/visibility/revisionState`, detail revisions và `exhibitsService.delete(id)` hiện có; không đổi DTO status để chữa UI.

**Bước**
- [ ] Stateful fixture có never-published Draft/Rejected, hidden published, visible published, Approved history/In Review, mock report 409 và deferred DELETE/GET; auth permissions rõ, không gửi mutation thật.
- [ ] Test RED: hidden published và In Review không được mở confirm xóa; nút không phụ thuộc riêng status=draft.
- [ ] Disable/giải thích các trạng thái đã biết; native icon/button có aria-label, keyboard usable. Không dùng disabled tooltip làm cách duy nhất thông báo 409.
- [ ] Fetch detail mới trước confirm; nếu state chuyển Approved/In Review/pointer có từ lần render cũ thì dừng action và refetch. Guard response muộn không mở nhầm confirm cho record khác.
- [ ] Confirm nói xóa vĩnh viễn toàn hiện vật/revisions/hotspots, media vẫn trong thư viện; Hủy/Escape không DELETE, xác nhận một lần, pending không double invoke.
- [ ] Xử lý report/version/state 409 từ server bằng toast/inline rõ nghĩa và refetch; không báo thành công. Không bắt người dùng có report:read để precheck reports.
- [ ] Success invalidate đúng keys thực tế exhibit list/detail, room counts/select/tour-order, moderation; xử lý trang cuối bị rỗng và focus đích còn tồn tại.
- [ ] Chạy tests + frontend gates, review và commit `fix(exhibits): align delete controls with protected states`.

**Acceptance**
- [ ] Có quyền update mới thấy Xóa; không hard-delete hidden published/In Review qua UI, backend vẫn bảo vệ direct API.
- [ ] Stale detail/409 giữ record và message đúng; cancel/confirm không double requests; media giữ nguyên.
- [ ] Refetch/paging/focus hợp lệ sau success; không thêm nút xóa revision.

## DELETE-03 — Đường Ẩn cho hiện vật đang public

**Phụ thuộc:** DELETE-02.
**Files:** `ExhibitsPage.tsx`, tests/fixture DELETE-02; dùng `services/moderation.service.ts` có sẵn, chỉ đổi file service nếu thiếu optional typing thực sự cần.

**Interface:** `moderationService.hide(id, version)`, permission `revision:hide`, response `ExhibitBrief`, không đổi endpoint hoặc gỡ publishedRevisionId.

**Bước**
- [ ] Test action Ẩn chỉ khi visible + published pointer + đúng hide permission; user chỉ update không được gọi hide, user chỉ hide vẫn thao tác Ẩn được.
- [ ] Test confirm nội dung bảo toàn history/media, Cancel không request, confirm fetch version mới và POST hide đúng payload; không tự unhide/delete/publish.
- [ ] Implement nút Ẩn khỏi bảo tàng trong danh sách và loading/error/409 guards; gọi API hiện có, không yêu cầu record còn trong moderation queue.
- [ ] Test 409 do version stale không tự retry để vượt lock; refetch hiển thị state mới. Test success row chuyển hidden, giữ pointer và Xóa vẫn bị chặn.
- [ ] Invalidate admin exhibit/detail/moderation/public-room queries liên quan, không clear toàn query client. Test public GET fixture sau ẩn không còn item; history/media mock vẫn giữ.
- [ ] Chạy tests + frontend gates, review và commit `fix(exhibits): expose hide action for published items`.

**Acceptance**
- [ ] Có đường Ẩn độc lập queue cho đúng quyền, version lấy mới và xử lý conflict rõ ràng.
- [ ] Ẩn không làm mất history/media hoặc mở khóa hard-delete; public refresh phản ánh trạng thái ẩn.

## DELETE-04 — Regression/evidence và dừng review

**Files:** hai docs nhiệm vụ, tests thực sự liên quan; README chỉ nếu cần hướng dẫn Xóa/Ẩn mới.

**Bước**
- [ ] Chạy focused backend DELETE-01, moderation hide/publish và frontend deletion-policy, edit-persistence, readonly-drawer, moderation keyboard/nested queue regression bị ảnh hưởng.
- [ ] Typecheck/lint/build cả hai app; không tự chạy integration DB/migration/seed. Nếu cần DB lock proof thật, xin phê duyệt riêng và không báo PASS khi chưa có.
- [ ] Review full diff chống scope creep; không revision-delete feature, schema/RBAC/storage/file changes hoặc secrets/artifacts.
- [ ] Ghi matrix PASS/FAIL/NOT TESTED theo từng policy, concurrent schedules, cache/focus/version; báo lock concurrency thật NOT TESTED nếu chỉ mock, không che blocker dữ liệu phá hủy.
- [ ] Ghi commit ledger và còn thiếu; commit `test(exhibits): verify deletion and hiding policy`, báo cáo rồi DỪNG trước push/PR/merge để con người review.

**Frontend commands dự kiến — `front-end/`**
```powershell
npm.cmd test -- exhibit-deletion-policy.spec.ts exhibit-edit-persistence.spec.ts readonly-drawer-focus.spec.ts moderation-keyboard.spec.ts accessibility-modal.spec.ts moderation-queue.spec.ts --reporter=line
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

**Acceptance**
- [ ] Đủ policy + UI Xóa/Ẩn có test, guards/focus/media không regress; counts/log thật.
- [ ] Lỗi data-loss/race chưa giải quyết không được nhận hoàn thành; mọi thiếu DB live proof ghi review blocker rõ ràng.
- [ ] Một nhánh/những commit nhỏ, không push/PR/merge trước yêu cầu.

## Gate hiện tại

- [x] Đã đọc source/requirements và tái hiện gaps bằng mocks ở phiên khảo sát.
- [x] Đã fetch origin/dev, tạo `fix/exhibit-deletion-policy` tại `f4ab406`.
- [x] PLAN/TASK có file, bước, test, acceptance, commit và giới hạn race.
- [x] Người dùng duyệt trước triển khai/commit.

**Evidence hiện tại:** Chỉ tạo nhánh và hai docs; chưa code/test implementation, chưa commit/push/PR.
