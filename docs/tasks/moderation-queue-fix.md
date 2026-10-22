# Moderation Queue Fix — Task breakdown

**Trạng thái:** Đã duyệt, đang triển khai.
**Plan:** [moderation-queue-fix-plan.md](../plans/moderation-queue-fix-plan.md).
**Branch/base:** `fix/moderation-queue` từ `origin/dev` `5556f79`, fetch mới nhất trước tạo nhánh.

## Quy tắc

- Người dùng đã duyệt; commit docs trước source, chưa push/PR/merge.
- Sau duyệt triển khai cùng nhánh theo QUEUE-00 → 01 → 02 → 03 → 04, commit riêng từng task có thay đổi đã kiểm chứng.
- Không sửa migration/schema/RBAC/business flow hoặc ghi dữ liệu CMS thật; không thêm dependency.
- Trước commit kiểm tra status, toàn diff, recent log, whitespace và secrets; stage đúng task. Không commit test đỏ, không amend/squash hoặc commit rỗng.

## QUEUE-00 — Chốt docs đã duyệt

**Files:** `docs/plans/moderation-queue-fix-plan.md`, `docs/tasks/moderation-queue-fix.md`.

**Bước thực hiện**
- [ ] Người dùng duyệt phạm vi backend 500 + UI render/error/cache và giới hạn diff song ngữ.
- [ ] Fetch lại origin/dev, kiểm tra baseline/thay đổi liên quan, giữ nguyên user work.
- [ ] Cập nhật trạng thái đã duyệt, review mapping file/test/acceptance.
- [ ] Stage đúng hai docs, `git diff --cached --check`, commit `docs(moderation): plan queue loading fixes`.

**Test:** review tài liệu/whitespace, chưa cần build chỉ vì Markdown.
**Acceptance:** Docs commit trước source, một branch cho toàn nhiệm vụ.

## QUEUE-01 — Sửa TypeORM joined pagination

**Files**
- `back-end/src/modules/moderation/repositories/moderation.repository.ts`.
- Tạo `back-end/src/modules/moderation/tests/moderation-repository.spec.ts`.
- `back-end/src/modules/moderation/tests/moderation-http.spec.ts`.
- Evidence trong task này.

**Interface:** Giữ `queue(ListQueueQueryDto): Promise<Paginated<ExhibitRevision>>`, GET queue route/envelope/meta và quyền `revision:publish`.

**Bước thực hiện**
- [ ] Tạo test metadata TypeORM không initialize DB; lấy builder thực từ `Repository<ExhibitRevision>` đủ relation entities. Cho repository queue đi qua bước dựng joined order/select trước trả fixture tại ranh giới DB.
- [ ] Chạy test và quan sát RED `databaseName` do `rev.created_at`; không chấp nhận mock fluent chain không thực thi metadata làm regression duy nhất.
- [ ] Đổi order thành `rev.createdAt ASC`, thêm `rev.id ASC` cho tie-breaker; không đổi joins/IN_REVIEW/FIFO.
- [ ] Kiểm page=1/2, pageSize, room filter và output total/items; HTTP GET queue trả envelope/meta, invalid query trả 400. Không gọi publish/reject thật.
- [ ] Chạy test/gates backend, review và commit `fix(moderation): correct queue pagination ordering`.

**Test commands — `back-end/`**
```powershell
node -r reflect-metadata -r ts-node/register --test src/modules/moderation/tests/moderation-repository.spec.ts src/modules/moderation/tests/moderation-http.spec.ts src/modules/moderation/tests/moderation-service.spec.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

**Acceptance**
- [ ] Test bắt đúng lỗi ORM trước fix, sau fix phân giải được metadata của pagination order; không connect DB/run migrations.
- [ ] Queue output/paging/filter/quyền giữ nguyên; không catch lỗi trả mảng rỗng.
- [ ] Focused test và backend gates có output đạt; ghi rõ chưa có live SQL evidence nếu chưa chạy.

## QUEUE-02 — Hiển thị nội dung và lỗi tải đúng

**Files**
- `front-end/src/pages/admin/ModerationPage.tsx`.
- `front-end/src/services/moderation.service.ts` nếu cần chỉnh type `RevisionContent`.
- Tạo `front-end/tests/moderation-queue.spec.ts`, `front-end/tests/fixtures/moderationQueueApi.ts`.
- Task evidence.

**Interface:** Giữ raw API content song ngữ; tái dùng `resolveBilingualText`; query prefix `['moderation','queue']`; không thêm API.

**Bước thực hiện**
- [ ] Stateful fixture queue có `{vi,en}`, string cũ, JSON string, vi trống/en có và record trùng tên; auth giả lập admin có quyền cần thiết. Mock chỉ pathname `/api/`, chặn mọi mutation không khai báo.
- [ ] Browser RED chứng minh object name crash cột/title, hoặc action name `[object Object]`; thêm test 500/403 hiển thị lỗi thay vì empty.
- [ ] Resolve tên qua helper có sẵn cho cột/button/title; fallback có nghĩa khi cả hai ngôn ngữ trống; chỉnh type frontend theo shape thật, không stringify object để che lỗi.
- [ ] Error branch Alert + Retry; chỉ empty sau GET success; cached refetch error không bị coi rỗng. Thêm nút Làm mới dùng refetch query hiện tại, không polling/reset global cache.
- [ ] Test pending, empty 200, error 500/403, Retry phục hồi, duplicate accessible name và mở Drawer; giữ table semantics và keyboard/focus hiện có.
- [ ] Chạy test mới và moderation keyboard/nested modal, frontend gates; review/commit `fix(moderation): render bilingual queue and load errors`.

**Test / acceptance**
- [ ] `{vi,en}` không còn crash, queue name/Drawer/action đúng văn bản; tên legacy/fallback đúng.
- [ ] API lỗi có thông báo/retry, không báo “không có bản chờ duyệt”; empty/loading/error phân biệt.
- [ ] Retry/Làm mới gọi đúng API/page, không bypass guard hoặc thay dữ liệu response.

## QUEUE-03 — Đồng bộ hàng chờ sau submit

**Files:** `front-end/src/pages/admin/ExhibitsPage.tsx`, browser test/fixture QUEUE-02, task evidence.

**Interface:** Giữ submit payload và guard session/422 đã có. Invalidate prefix `['moderation','queue']` chỉ khi submit thành công; không chèn `ExhibitRow` vào queue Revision cache.

**Bước thực hiện**
- [ ] Browser RED: vào queue rỗng → sang hiện vật → submit mock success → quay queue trong 30 giây. Khẳng định cần GET mới và hiện revision vừa gửi, không chỉ toast success.
- [ ] Thêm queue đã có dữ liệu và nhiều page cache; fixture lọc IN_REVIEW, phân trang server. Revision mới có thể ở trang sau do FIFO, không ép vị trí đầu.
- [ ] Bổ sung queue prefix invalidation trong `submitReviewMutation.onSuccess`, giữ exhibit invalidation và không thay stale form fixes.
- [ ] Test submit 422/403/409 không báo success hoặc tạo record queue; 422 vẫn hydrate đúng form/tab theo session, không tự publish.
- [ ] Chạy queue test + exhibit-edit persistence regression + frontend gates; review/commit `fix(moderation): refresh queue after draft submission`.

**Test / acceptance**
- [ ] Queue inactive bị mark stale sau submit; quay trang gọi lại API dù cache dưới 30 giây, active query refetch nếu có.
- [ ] Cache các page cùng prefix không bị bỏ sót; submit fail không thêm record giả; không đổi quyền/publish.

## QUEUE-04 — Regression, evidence và handoff

**Files:** Test/fixture thực sự cần bổ sung, hai tài liệu nhiệm vụ; không mở rộng source ngoài lỗi đã xác nhận.

**Bước thực hiện**
- [ ] Chạy backend focused moderation + exhibits-service tests xác nhận submit state; không integration suite tự initialize DB/migration.
- [ ] Chạy frontend queue, moderation keyboard, nested modal, exhibit edit persistence và admin navigation tests.
- [ ] Typecheck/lint/build cả hai app; không nhận kết quả cũ từ phiên điều tra làm verification bản sửa.
- [ ] Nếu có môi trường/session cho phép, chỉ đọc GET queue sau fix và ghi HTTP status/meta/count; không cần gửi bản nháp thật. Thiếu môi trường thì ghi NOT TESTED, không nhận DB/SQL live PASS từ mock.
- [ ] Review toàn diff, không backend schema/migration/dependency/auth changes, không `.env`/token/artifact; `git diff --check`.
- [ ] Cập nhật matrix, test counts, failed/skipped/NOT TESTED và commit ledger. Commit `test(moderation): verify submit to queue workflow`, DỪNG trước push/PR/merge.

**Commands frontend dự kiến — `front-end/`**
```powershell
npm.cmd test -- moderation-queue.spec.ts moderation-keyboard.spec.ts accessibility-modal.spec.ts exhibit-edit-persistence.spec.ts admin-navigation-keyboard.spec.ts --reporter=line
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

**Acceptance**
- [ ] Log 500 thật có regression ORM có ý nghĩa; các lỗi UI/render/error/cache đều có test trước/sau.
- [ ] Test counts/gates chính xác cho cả app, tồn đọng có mức độ/giới hạn rõ; không tuyên bố SQL live chưa chạy.
- [ ] Mỗi task commit riêng trên nhánh fix; chỉ tạo PR về dev khi người dùng yêu cầu.

## Review gate hiện tại

- [x] Log người dùng xác nhận `databaseName`; metadata repro và browser reproductions đã có ở phiên điều tra.
- [x] Đã fetch origin/dev và tạo nhánh `fix/moderation-queue` tại `5556f79`.
- [x] Đã chia task có file, bước, test, acceptance và commit dự kiến; self-review trong plan.
- [x] Người dùng duyệt PLAN/TASK.
- [ ] Commit docs rồi triển khai sau duyệt.

**Evidence hiện tại:** chỉ tạo hai file Markdown; chưa sửa source/test, chưa commit/push/PR và chưa chạy verification bản fix.
