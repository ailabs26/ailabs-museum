# Exhibit Deletion Policy — Task breakdown

**Trạng thái:** Đã triển khai và kiểm chứng local; dừng chờ review PostgreSQL concurrency trước tích hợp. Chưa push/PR/merge.
**Plan:** [exhibit-deletion-policy-plan.md](../plans/exhibit-deletion-policy-plan.md).
**Branch/base:** `fix/exhibit-deletion-policy` từ `origin/dev` `f4ab406`, đã fetch và đồng bộ.

## Quy tắc

- Gate docs đã được duyệt và commit trước source; mỗi task có commit riêng trên cùng branch. Không push/PR/merge khi chưa được yêu cầu.
- Không thêm xóa revision; giữ endpoint xóa riêng revision hiện có. Không migration/schema/RBAC/dependency mới hoặc mutation dữ liệu thật.
- Trước commit kiểm status/diff/log/secrets/whitespace, stage đúng task; source commit chỉ sau focused tests và gates đạt, không squash/amend/commit rỗng.
- Chỉ test mocks/metadata/isolated runner mặc định; không tự chạy suites PostgreSQL có migration/seed. DB concurrency chưa kiểm chứng phải ghi blocker/NOT TESTED để reviewer quyết định.

## DELETE-00 — Duyệt và commit kế hoạch

**Files:** hai tài liệu hiện tại.

**Bước**
- [x] Người dùng duyệt policy/report protection, đường Hide và phạm vi phối hợp writer locks.
- [x] Fetch lại origin/dev, đối chiếu thay đổi liên quan từ baseline, bảo toàn user work.
- [x] Đánh dấu đã duyệt, review file/task/tests và commit `docs(exhibits): plan deletion policy fixes` sau whitespace check.

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
- [x] Test trước policy matrix: chưa published Draft/Rejected/no revision cho xóa; pointer/visible/Approved bất kỳ/In Review bất kỳ/reports chặn; query report không lọc status.
- [x] Test guard/reports từ snapshot **trong tx**, truyền cùng manager, check report exhibitId hoặc reportedRevisionId, không gọi media/storage delete.
- [x] Chạy RED để chứng minh In Review/hidden published UI/backend gaps; test message không còn “ẩn trước rồi xóa”.
- [x] Implement khóa exhibit riêng dòng, đọc/khóa revision, xét policy/report rồi cascade trong cùng transaction; report check qua repository.
- [x] Mock lỗi report FK sau precheck → rollback và 409; constraint khác/exception khác không bị nuốt. Identity từ metadata TypeORM. FK thực tế vẫn NOT TESTED.
- [x] Fake schedules DELETE↔submit/update/publish kiểm chứng revalidation/conditional update không resurrect snapshot. Review lock order media→exhibit→revision; chưa có DB deadlock proof.
- [x] Chỉ bổ sung writer revalidation/lock cần thiết với failing test; giữ PostgreSQL concurrency là review blocker, không nhận atomic từ mock tx callback.
- [x] Test DELETE báo 404/409 chuẩn envelope và metadata quyền `exhibit:update`/audit không đổi; xóa riêng revision giữ behavior cũ.
- [x] Chạy focused tests + typecheck/lint/build backend, review diff và commit `fix(exhibits): enforce safe whole-exhibit deletion`.

**Test commands — `back-end/`**
```powershell
node -r reflect-metadata -r ts-node/register --test src/modules/exhibits/tests/exhibit-deletion-policy.spec.ts src/modules/exhibits/tests/exhibits-service.spec.ts src/modules/exhibits/tests/exhibits-repository.spec.ts src/modules/exhibits/tests/admin-exhibits-controller.spec.ts src/modules/moderation/tests/moderation-service.spec.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

**Acceptance**
- [x] Policy tests chặn Published/Approved/In Review/report refs; cascade không xóa media.
- [x] Guard/cascade chung manager; fake transaction runner rollback hotspots/revisions khi lỗi; writer revalidation tests không save stale snapshot. DB rollback/concurrency chưa kiểm chứng.
- [x] Mock FK report đúng identity chuyển 409, lỗi khác không bị che; không schema/migration/RBAC changes.
- [x] Test/lock evidence và giới hạn DB concurrency thật được ghi rõ; cần reviewer quyết định gate DB trước merge.

## DELETE-02 — CMS guard và xác nhận xóa đúng nghĩa

**Phụ thuộc:** DELETE-01.
**Files:** `front-end/src/pages/admin/ExhibitsPage.tsx`; tạo `front-end/tests/exhibit-deletion-policy.spec.ts`, `front-end/tests/fixtures/exhibitDeletionApi.ts`.

**Interface:** dùng `ExhibitRow.publishedRevisionId/visibility/revisionState`, detail revisions và `exhibitsService.delete(id)` hiện có; không đổi DTO status để chữa UI.

**Bước**
- [x] Stateful fixture có Draft, hidden/visible published, Approved history/In Review, report 409, deferred DELETE/GET và auth permissions; Rejected được kiểm backend matrix. Không mutation thật.
- [x] Test RED: hidden published và In Review không được mở confirm xóa; nút không phụ thuộc riêng status=draft.
- [x] Disable/giải thích các trạng thái đã biết; native icon/button có aria-label, keyboard usable. 409 được toast riêng.
- [x] Fetch detail mới trước confirm, chặn Approved/In Review/pointer; guard response muộn khi mở form/detail/create.
- [x] Confirm nêu toàn hiện vật/revisions/hotspots/media; Escape không DELETE, keyboard confirm và pending một request.
- [x] Report/state 409 hiện nguyên nhân và refetch; không yêu cầu report:read, không báo thành công.
- [x] Invalidate lifecycle keys, trang cuối về trang trước, focus heading còn tồn tại.
- [x] Tests + frontend gates và commit `fix(exhibits): align delete controls with protected states`.

**Acceptance**
- [x] Có quyền update mới thấy Xóa; UI chặn hidden published/In Review, backend có policy guards.
- [x] Stale detail/409 giữ record/message; cancel/pending một request; media fixture giữ nguyên.
- [x] Refetch/paging/focus hợp lệ; không thêm nút xóa revision.

## DELETE-03 — Đường Ẩn cho hiện vật đang public

**Phụ thuộc:** DELETE-02.
**Files:** `ExhibitsPage.tsx`, tests/fixture DELETE-02; dùng `services/moderation.service.ts` có sẵn, chỉ đổi file service nếu thiếu optional typing thực sự cần.

**Interface:** `moderationService.hide(id, version)`, permission `revision:hide`, response `ExhibitBrief`, không đổi endpoint hoặc gỡ publishedRevisionId.

**Bước**
- [x] Action Ẩn đúng visible/pointer/permission; user chỉ update không thấy Ẩn, user chỉ hide thực hiện thành công.
- [x] Confirm bảo toàn history/media, Escape không request, confirm lấy version mới và POST đúng payload.
- [x] Nút Ẩn độc lập queue, có pending/error/409 guards và dùng API hiện có.
- [x] 409 không retry; success row hidden, giữ pointer và Xóa vẫn bị chặn.
- [x] Invalidate admin/moderation/public keys, không clear dữ liệu khác; public GET fixture sau ẩn bỏ item, history/media giữ nguyên.
- [x] Tests + frontend gates, commit `fix(exhibits): expose hide action for published items`.

**Acceptance**
- [x] Ẩn độc lập queue, đúng quyền/version mới và conflict rõ ràng.
- [x] Fixture kiểm history/media/pointer giữ nguyên, Xóa vẫn khóa và public GET bỏ item.

## DELETE-04 — Regression/evidence và dừng review

**Files:** hai docs nhiệm vụ, tests thực sự liên quan; README chỉ nếu cần hướng dẫn Xóa/Ẩn mới.

**Bước**
- [x] Focused backend 409/409, moderation HTTP 8/8 và browser regression 56/56 PASS.
- [x] Typecheck/lint/build cả hai app PASS; không chạy integration DB/migration/seed; DB proof cần phê duyệt riêng.
- [x] Full diff review: phạm vi policy/UI/tests/docs; không revision-delete feature, schema/RBAC/storage/dependency changes hoặc secrets/artifacts.
- [x] Matrix PASS/NOT TESTED ở dưới; PostgreSQL concurrency/rollback/FK thực tế là review blocker.
- [x] Ghi commit ledger và còn thiếu trong commit `test(exhibits): verify deletion and hiding policy`; dừng ở nhánh local trước push/PR/merge để con người review.

**Frontend commands dự kiến — `front-end/`**
```powershell
npm.cmd test -- exhibit-deletion-policy.spec.ts exhibit-hide-policy.spec.ts exhibit-edit-persistence.spec.ts readonly-drawer-focus.spec.ts moderation-keyboard.spec.ts accessibility-modal.spec.ts moderation-queue.spec.ts --reporter=line
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

**Acceptance**
- [x] Policy/UI/guards/focus/media có mocked tests và counts thật (matrix bên dưới).
- [x] Không nhận hoàn thành DB safety từ mocks; live proof là review blocker trước merge.
- [x] Một nhánh, commit theo task; dừng trước push/PR/merge.

## Gate hiện tại

- [x] Đã đọc source/requirements và tái hiện gaps bằng mocks ở phiên khảo sát.
- [x] Đã fetch origin/dev, tạo `fix/exhibit-deletion-policy` tại `f4ab406`.
- [x] PLAN/TASK có file, bước, test, acceptance, commit và giới hạn race.
- [x] Người dùng duyệt trước triển khai/commit.

## Evidence triển khai

- DELETE-00: `caee7c3` — docs duyệt/commit trước source, origin/dev không đổi baseline.
- DELETE-01: RED 13/14 cases (sau sửa một lỗi type fixture); policy + repository tests sau fix **18/18 PASS**, backend typecheck/lint/build PASS. Suites service/repository/controller/moderation hiện có đã chạy PASS trước mở rộng hai repository tests.
- DELETE decision nằm trong tx, khóa exhibit → revisions, check reports exhibit hoặc revision rồi cascade; nhận diện FK report qua metadata + PostgreSQL 23503, rollback trước map 409.
- Update/submit sau media checks phải lấy lại exhibit dưới FOR UPDATE và re-read active revision, so version/ID/state; nếu bị xóa thì 404, state thay đổi thì 409 trước mọi save. Publish/hide hiện dùng UPDATE affected/version, không save snapshot có thể insert lại; không thay writer đó khi chưa có failure.
- **NOT TESTED:** row-lock/concurrency/FK thực trên PostgreSQL; mocks mô phỏng lịch biểu và metadata không thay DB proof. Cần reviewer đánh giá blocker trước merge; không chạy migrations hoặc dữ liệu thật.
- Chưa push/PR/merge.
- DELETE-02: browser Xóa **5/5 PASS**, frontend typecheck/lint/build PASS (cảnh báo chunk hiện hữu). Fixture auth ban đầu che route rooms do đăng ký hai lần đã sửa bằng optional permissions của overlay fixture. Fresh detail kiểm toàn revisions; pending guards, report conflict, confirm media text, pagination và focus đã kiểm chứng bằng mocked API.
- DELETE-03: hide RED 3/4 trước implementation; sau fix Xóa/Ẩn **9/9 PASS**, frontend typecheck/lint/build PASS. Version GET mới tại confirm, permission hide/update tách riêng, 409 không tự retry; hidden row giữ published pointer nên không mở khóa xóa. Test hide tách `exhibit-hide-policy.spec.ts` để review riêng.

### DELETE-04 — Verification ngày 2026-10-22

- Fetch lại `origin/dev`: vẫn `f4ab406`; nhánh hiện có hơn baseline 4 commit trước commit regression cuối. Giữ workspace/branch đang triển khai.
- Lệnh focused backend ở DELETE-01: **409 tests / 42 suites PASS**, 0 fail/skip; trong đó policy repository/HTTP mới **22 tests PASS**. Chạy thêm `node -r reflect-metadata -r ts-node/register --test --test-reporter=spec src/modules/moderation/tests/moderation-http.spec.ts`: **8/8 PASS**.
- Browser command ở trên: **56/56 PASS**, Chromium qua Edge, API mocks; riêng Xóa/Ẩn **15/15 PASS**. Fixture history Approved không rỗng và media được so sánh trước/sau Hide; public GET trước có item, sau Hide không còn.
- Sau khi bổ sung history Approved không rỗng vào fixture, chạy lại riêng Xóa/Ẩn: **15/15 PASS**; các regression khác không đổi.
- Regression late DELETE preflight: tạm bỏ 6 dòng guard đang dở → test FAIL (confirm vẫn xuất hiện trên form sửa), khôi phục guard → **1/1 PASS**. Không ghi nhận chạy RED mới cho các bổ sung test chỉ kiểm hành vi đã có.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`: **PASS cho cả hai app**. Frontend build có cảnh báo chunk >500 kB; không làm build thất bại.
- Một lượt chạy song song ban đầu bị lỗi tool `ChildProcess.kill`, không tính là PASS. Đã chạy lại từng gate và các suite, lấy counts ở trên.

| Acceptance / scenario | Evidence local | Kết quả |
|---|---|---|
| Draft / Rejected / không revision được xóa; pointer/visible/Approved history/In Review bị chặn | Policy matrix + service suite | PASS (mocks) |
| Reports mọi status, exhibitId OR revisionId thực tế kể cả cross-reference | Repository assertion OR query, không có filter status; service chặn trước cascade | PASS (query contract/mocks) |
| Transaction manager xuyên suốt, exhibit→revisions→report→cascade, không xóa media | Policy log + repo suite; cascade fake runner kiểm thứ tự/khôi phục và media giữ nguyên | PASS (fake manager/runner) |
| Report FK `23503` đúng identity → 409; lỗi khác propagate | TypeORM entity metadata + injected error + HTTP error envelope | PASS (metadata/mocks) |
| DELETE trước submit/update/publish không resurrect snapshot | Revalidation sau media gate + conditional publish UPDATE affected=0 | PASS (fake schedules) |
| Endpoint/permission/audit và xóa riêng revision | Controller metadata/execution suite; service regression | PASS |
| Stale detail/review conflict/report 409, preflight error và response về muộn | Browser Xóa; RED→GREEN late-preflight | PASS |
| Keyboard cancel/confirm, pending một request, paging/focus | Browser Xóa/Ẩn và readonly/nested overlay suites | PASS |
| Hide đúng quyền/version, không retry conflict, giữ published pointer/history/media | Browser Hide (user chỉ hide thực hiện thật trong mock) | PASS |
| Public refresh và cache keys liên quan, cache khác giữ nguyên | Public GET fixture + query invalidation assertions | PASS (fixture/cache contract) |
| PostgreSQL row locks/deadlock/report insert↔DELETE/FK/rollback với giao dịch thật | Không có isolated DB được cho phép; không chạy migration/schema/seed | **NOT TESTED — REVIEW BLOCKER** |

**Giới hạn nghiệm thu:** Fake rollback chủ động khôi phục state chỉ kiểm Repository/TransactionManager truyền lỗi đúng đường; không chứng minh PostgreSQL rollback. Report insert commit trước/sau DELETE và hai chiều lock contention chưa chạy trên DB. Người phụ trách database/reviewer cần quyết định kiểm chứng bổ sung trước merge; chưa nhận nghiệm thu concurrency thực tế.

### Commit ledger

| Task | Commit | Nội dung |
|---|---|---|
| DELETE-00 | `caee7c3` | Docs đã duyệt trước source |
| DELETE-01 | `dc13c1d` | Backend policy và writer revalidation |
| DELETE-02 | `90825da` | CMS guard/xác nhận Xóa |
| DELETE-03 | `3abfec2` | CMS action Ẩn |
| DELETE-04 | Commit mang message `test(exhibits): verify deletion and hiding policy` | Regression/evidence cuối; hash báo trong báo cáo hoàn thành để tránh tự tham chiếu hash trong chính commit |

**Integration:** Giữ nhánh local `fix/exhibit-deletion-policy`. Chưa push, chưa có URL PR, chưa merge. Dừng để con người review, đặc biệt gate PostgreSQL ở trên.

### Follow-up — Xuất bản lại sau khi Ẩn

- Người dùng tái hiện: Ẩn → sửa/gửi duyệt → Publish báo đã xuất bản trong CMS nhưng public không có hiện vật.
- Nguyên nhân: Hide ghi `archivedAt`; Publish đổi `visibility=visible` nhưng không xóa marker này. Public exhibit query và media delivery đều yêu cầu `archivedAt IS NULL`; admin status chỉ xét visibility/published pointer.
- Sửa Publish đặt `archivedAt: null` trong cùng conditional update đang có. Regression stateful chạy service thật: Hide→Unhide PASS trước fix, Hide→Publish FAIL vì còn timestamp; sau fix kiểm cả hai đường phục hồi.
- API bỏ ẩn hiện có: `POST /exhibits/:id/unhide`, body `{ version }`, quyền `revision:hide`; giữ published pointer và xóa `archivedAt`. CMS nay có nút Bỏ ẩn cho hidden published, lấy version mới, confirm, xử lý conflict và invalidate các cache liên quan.
- Sửa code không tự cập nhật các record đã Publish lỗi trước đó. Các record đó cần Unhide qua API hiện có hoặc Publish một revision mới sau khi backend nạp bản sửa; không sửa DB/migration trực tiếp.
- Verification trước commit: focused backend **419/419 PASS**; browser deletion/hiding/edit/moderation/accessibility regression **59/59 PASS**; frontend/backend typecheck, lint, build PASS. Frontend build chỉ còn cảnh báo chunk >500 kB hiện hữu. Chưa xác thực trên DB/live record của người dùng.
