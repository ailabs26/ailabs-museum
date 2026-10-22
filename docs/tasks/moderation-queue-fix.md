# Moderation Queue Fix — Task breakdown

**Trạng thái:** Đã triển khai và kiểm chứng trên `fix/moderation-queue`, chờ review; chưa push/PR/merge.
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
- [x] Người dùng duyệt phạm vi backend 500 + UI render/error/cache và giới hạn diff song ngữ.
- [x] Fetch lại origin/dev, kiểm tra baseline/thay đổi liên quan, giữ nguyên user work.
- [x] Cập nhật trạng thái đã duyệt, review mapping file/test/acceptance.
- [x] Stage đúng hai docs, `git diff --cached --check`, commit `docs(moderation): plan queue loading fixes`.

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
- [x] Tạo test metadata TypeORM không initialize DB; lấy builder thực từ `Repository<ExhibitRevision>` đủ relation entities. Cho repository queue đi qua bước dựng joined order/select trước trả fixture tại ranh giới DB.
- [x] Chạy test và quan sát RED `databaseName` do `rev.created_at`; không chấp nhận mock fluent chain không thực thi metadata làm regression duy nhất.
- [x] Đổi order thành `rev.createdAt ASC`, thêm `rev.id ASC` cho tie-breaker; không đổi joins/IN_REVIEW/FIFO.
- [x] Kiểm page=1/2, pageSize, room filter và output total/items; HTTP GET queue trả envelope/meta, invalid query trả 400. Không gọi publish/reject thật.
- [x] Chạy test/gates backend, review và commit `fix(moderation): correct queue pagination ordering`.

**Test commands — `back-end/`**
```powershell
node -r reflect-metadata -r ts-node/register --test src/modules/moderation/tests/moderation-repository.spec.ts src/modules/moderation/tests/moderation-http.spec.ts src/modules/moderation/tests/moderation-service.spec.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

**Acceptance**
- [x] Test bắt đúng lỗi ORM trước fix, sau fix phân giải được metadata của pagination order; không connect DB/run migrations.
- [x] Queue output/paging/filter/quyền giữ nguyên; không catch lỗi trả mảng rỗng.
- [x] Focused test và backend gates có output đạt; ghi rõ chưa có live SQL evidence nếu chưa chạy.

## QUEUE-02 — Hiển thị nội dung và lỗi tải đúng

**Files**
- `front-end/src/pages/admin/ModerationPage.tsx`.
- `front-end/src/services/moderation.service.ts` nếu cần chỉnh type `RevisionContent`.
- Tạo `front-end/tests/moderation-queue.spec.ts`, `front-end/tests/fixtures/moderationQueueApi.ts`.
- Task evidence.

**Interface:** Giữ raw API content song ngữ; tái dùng `resolveBilingualText`; query prefix `['moderation','queue']`; không thêm API.

**Bước thực hiện**
- [x] Stateful fixture queue có `{vi,en}`, string cũ, JSON string, vi trống/en có và record trùng tên; auth fixture có quyền cần thiết. Mock chỉ pathname `/api/`, chặn mọi mutation không khai báo ngoài auth/submit đã định nghĩa.
- [x] Browser RED chứng minh object name crash cột/title, hoặc action name `[object Object]`; thêm test 500/403 hiển thị lỗi thay vì empty.
- [x] Resolve tên qua helper có sẵn cho cột/button/title; fallback có nghĩa khi cả hai ngôn ngữ trống; chỉnh type frontend theo shape thật, không stringify object để che lỗi.
- [x] Error branch Alert + Retry; chỉ empty sau GET success; cached refetch error không bị coi rỗng. Thêm nút Làm mới dùng refetch query hiện tại, không polling/reset global cache.
- [x] Test pending, empty 200, error 500/403, Retry phục hồi, duplicate accessible name và mở Drawer; giữ table semantics và keyboard/focus hiện có.
- [x] Chạy test mới và moderation keyboard/nested modal, frontend gates; review/commit `fix(moderation): render bilingual queue and load errors`.

**Test / acceptance**
- [x] `{vi,en}` không còn crash, queue name/Drawer/action đúng văn bản; tên legacy/fallback đúng.
- [x] API lỗi có thông báo/retry, không báo “không có bản chờ duyệt”; empty/loading/error phân biệt.
- [x] Retry/Làm mới gọi đúng API/page, không bypass guard hoặc thay dữ liệu response.

## QUEUE-03 — Đồng bộ hàng chờ sau submit

**Files:** `front-end/src/pages/admin/ExhibitsPage.tsx`, browser test/fixture QUEUE-02, task evidence.

**Interface:** Giữ submit payload và guard session/422 đã có. Invalidate prefix `['moderation','queue']` chỉ khi submit thành công; không chèn `ExhibitRow` vào queue Revision cache.

**Bước thực hiện**
- [x] Browser RED: vào queue rỗng → sang hiện vật → submit mock success → quay queue trong 30 giây. Khẳng định cần GET mới và hiện revision vừa gửi, không chỉ toast success.
- [x] Thêm queue đã có dữ liệu và nhiều page cache; fixture phân trang server, chỉ thêm revision sau submit thành công. Revision mới có thể ở trang sau do FIFO, không ép vị trí đầu.
- [x] Bổ sung queue prefix invalidation trong `submitReviewMutation.onSuccess`, giữ exhibit invalidation và không thay stale form fixes.
- [x] Test submit 422/403/409 không báo success hoặc tạo record queue; 422 vẫn hydrate đúng form/tab theo session, không tự publish.
- [x] Chạy queue test + exhibit-edit persistence regression + frontend gates; review/commit `fix(moderation): refresh queue after draft submission`.

**Test / acceptance**
- [x] Queue inactive bị mark stale sau submit; quay trang gọi lại API dù cache dưới 30 giây; prefix invalidation giữ semantics active refetch của React Query (không có mounted queue đồng thời với trang exhibits trong router hiện tại).
- [x] Cache các page cùng prefix không bị bỏ sót; submit fail không thêm record giả; không đổi quyền/publish.

## QUEUE-04 — Regression, evidence và handoff

**Files:** Test/fixture thực sự cần bổ sung, hai tài liệu nhiệm vụ; không mở rộng source ngoài lỗi đã xác nhận.

**Bước thực hiện**
- [x] Chạy backend focused moderation + exhibits-service tests xác nhận submit state; không integration suite tự initialize DB/migration.
- [x] Chạy frontend queue, moderation keyboard, nested modal, exhibit edit persistence và admin navigation tests.
- [x] Typecheck/lint/build cả hai app; không nhận kết quả cũ từ phiên điều tra làm verification bản sửa.
- [ ] Nếu có môi trường/session cho phép, chỉ đọc GET queue sau fix và ghi HTTP status/meta/count; không cần gửi bản nháp thật. Thiếu môi trường thì ghi NOT TESTED, không nhận DB/SQL live PASS từ mock.
- [x] Review toàn diff, không backend schema/migration/dependency/auth changes, không `.env`/token/artifact; `git diff --check`.
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
- [x] Commit docs rồi triển khai sau duyệt.

## Evidence triển khai

- QUEUE-00: `bb0e992`, docs commit trước source; baseline không thay đổi sau fetch.
- QUEUE-01: test TypeORM metadata thật RED đúng `databaseName` cả page 1/2; sau đổi createdAt + tie-breaker **25/25 focused backend tests PASS**, typecheck/lint/build PASS. Không initialize DB/run migrations; HTTP tests dùng service giả, không chứng minh SQL live.
- Chưa push/PR/merge.
- QUEUE-02: UI RED 5/5, sau fix queue states/name **6/6 PASS**, moderation keyboard+nested **11/11 PASS**; frontend typecheck/lint/build PASS. Shared RevisionContent type ảnh hưởng Reports nên sửa hiển thị đúng hai trường reported name/description và thêm regression riêng, không đổi report mutations.
- QUEUE-03: RED 2/2 đúng cache queue fresh không fetch; thêm prefix invalidation sau submit success → queue + exhibit edit **24/24 PASS**, frontend typecheck/lint/build PASS. FIFO/paging và submit failure 422/403/409 có coverage.

### QUEUE-04 — Verification cuối

- Backend focused **162/162 PASS**, 0 fail/skip; typecheck/lint/build PASS.
- Frontend **43/43 PASS** (5.3m), 0 fail/skip, `--timeout=60000` tổng mỗi test, giữ assertion timeout: queue 11, exhibit edit 13, moderation keyboard 3, nested modal 8, admin navigation 8.
- Frontend typecheck/lint/build PASS; cảnh báo chunk >500 kB hiện hữu, không thêm dependency.
- Metadata tests xây entities trực tiếp bằng test-only DataSource, không import app config/env hoặc mở DB. Internal TypeORM pagination helper dùng typed cast chỉ trong test, có phụ thuộc phiên bản ORM.
- Mọi browser mutation bị mocked; không submit/publish/reject dữ liệu thật. Edge/Chromium trên Windows, artifacts ignored tại `front-end/tmp/queue-final-regression/`.
- **NOT TESTED:** authenticated GET queue trên môi trường người dùng/SQL thật, browser khác/thiết bị thật/screen reader. Không lấy token hoặc chạy migrations/seed.
- Giới hạn còn giữ theo plan: diff text song ngữ có thể hiện `[object Object]` do service `String(value)`; không đổi diff/API trong lần fix queue này.
- Reports thay đổi tối thiểu vì dùng chung content type: resolve hai field name/description rồi render; regression báo cáo có dữ liệu song ngữ PASS.

### Commit ledger

- `bb0e992` — `docs(moderation): plan queue loading fixes`.
- `0daf9f5` — `fix(moderation): correct queue pagination ordering`.
- `f6a2684` — `fix(moderation): render bilingual queue and load errors`.
- `de1ff02` — `fix(moderation): refresh queue after draft submission`.
- Commit evidence cuối: `test(moderation): verify submit to queue workflow`.

Chưa push/PR/merge; dừng để người dùng review. Các checkbox live/tiêu chí không chứng minh đầy đủ vẫn để trống, không nhận SQL live PASS từ mock.
