# Exhibit Deletion Policy — Implementation Plan

> **For agentic workers:** Người dùng đã duyệt. Dùng `executing-plans` theo [task breakdown](../tasks/exhibit-deletion-policy.md), một nhánh `fix/exhibit-deletion-policy` cho docs và code, mỗi task có commit riêng sau verification. Dừng trước push/PR/merge.

**Goal:** Xóa toàn hiện vật có điều kiện nhất quán ở CMS/backend, bảo vệ bản đã duyệt/chờ duyệt và báo cáo; hiện vật đang public có đường Ẩn rõ ràng.

**Architecture:** Backend kiểm tra điều kiện ở Service, Repository thực hiện các truy vấn/khóa/xóa trong cùng transaction. CMS dùng metadata hiện có để chặn những trường hợp đã biết và gọi API Hide hiện có theo đúng permission/version; backend vẫn quyết định cuối cùng. Giữ file media và lịch sử đã xuất bản.

**Tech Stack:** NestJS, TypeORM/PostgreSQL, React, Mantine, TanStack Query, node:test/Playwright hiện có.

## 1. Baseline

- `origin/dev` đã fetch, đồng bộ tại `f4ab406`; nhánh `fix/exhibit-deletion-policy`.
- Đã đối chiếu AGENTS.md và conventions tại `docs/architecture/{be,fe}/coding-conventions.md`, BR-20/21/22 trong `docs/requirements.md`.
- Source owners: `ExhibitsPage.handleDelete`/deleteMutation, `AdminExhibitsController.deleteDraft`, `ExhibitsService.deleteExhibitDraft`, `ExhibitsRepository.deleteCascadeDraft`; Hide qua `moderationService.hide` → `ModerationService.setVisibility`.
- Xóa toàn hiện vật hiện chặn publishedRevisionId/visible, chưa xét trạng thái tất cả revisions và report references. Xóa là hard-delete hotspots → revisions → exhibit trong transaction, không xóa media.
- Xóa riêng revision đã chặn Approved/In Review nhưng không thuộc nhiệm vụ này.
- Đã kiểm chứng bằng service mocks: whole-exhibit delete vẫn gọi cascade cho hidden/non-published In Review; hidden exhibit còn publishedRevisionId trả 409 nhưng DTO có status=draft, UI có thể bật nút xóa.
- Hide giữ nguyên publishedRevisionId, đổi visibility/archivedAt và tăng version. Vì vậy hướng dẫn backend “ẩn trước rồi xóa” hiện sai.
- `content_reports` có FK RESTRICT tới exhibit và reported revision; lỗi FK có thể xuất hiện khi xóa. Chưa tái hiện DB live.
- 31 focused tests cũ PASS ở phiên khảo sát nhưng chưa bao phủ các khoảng trống trên; không dùng làm evidence implementation mới.

## 2. Global constraints

- Gate lập kế hoạch đã hoàn tất: người dùng duyệt, docs được commit trước source; tiếp tục trên cùng nhánh và dừng trước push/PR/merge.
- **Không thêm UI xóa revision; không thay endpoint/hành vi xóa riêng revision.**
- Không migration/schema, seed, database writes thật, dependency mới, đổi permission hoặc ép gỡ ràng buộc FK.
- Không soft-delete mới, purge/history cleanup hay xóa file media theo exhibit. Không tự gỡ publishedRevisionId để cho xóa.
- Giữ API DELETE hiện có, quyền `exhibit:update`, audit `exhibit.delete`; Hide dùng `revision:hide`, API/version/audit hiện có.
- Không thêm quyền `exhibit:delete`, không bypass guard, không biến Hide thành delete. Không thêm chức năng Unhide mới trong task này.
- Không refactor form editing, publish gate, moderation workflow hoặc global exception filter ngoài phần phối hợp khóa thực sự cần cho race xóa.
- Controller → Service → Repository; không truy vấn TypeORM ở service/frontend.
- Sau duyệt kiểm chứng cả app bị ảnh hưởng: typecheck/lint/build, focused backend tests và browser regression phù hợp. Mọi mutation browser chỉ API mock.

## 3. Chính sách được đề xuất để duyệt

| Điều kiện toàn hiện vật | Kết quả DELETE |
|---|---|
| Không tồn tại/đã xóa | 404 |
| Có publishedRevisionId hoặc visibility=visible | 409; hướng dẫn Ẩn nếu đang public, không hứa ẩn rồi xóa được |
| Bất kỳ revision Approved trong lịch sử, dù hidden/pointer bất thường | 409 bảo vệ lịch sử đã duyệt |
| Bất kỳ revision In Review | 409; cần hoàn tất/từ chối kiểm duyệt trước, không xóa queue ngầm |
| Có report tham chiếu exhibit **hoặc** bất kỳ revision của exhibit | 409 giữ lịch sử báo cáo, không phân biệt open/resolved/dismissed |
| Không vướng các điều kiện trên, revisions chỉ Draft/Rejected hoặc không có revision | Cho xóa vĩnh viễn trong transaction |

Các thông điệp mẫu:
- Published/Approved: **“Hiện vật có lịch sử xuất bản hoặc phê duyệt nên không thể xóa vĩnh viễn. Có thể ẩn hiện vật đang công khai khỏi bảo tàng.”**
- In Review: **“Hiện vật có phiên bản đang chờ kiểm duyệt, không thể xóa.”**
- Reports: **“Hiện vật hoặc phiên bản có báo cáo liên quan nên không thể xóa vĩnh viễn.”**
- Conflict đồng thời: **“Trạng thái hiện vật vừa thay đổi. Vui lòng tải lại và thử lại.”**

Chỉ chặn report đang tồn tại, không xóa/resolve report để mở khóa xóa. Không sửa các báo cáo có reportedRevisionId không khớp exhibit; truy vấn kiểm tra phải vẫn phát hiện tham chiếu thực tới revision bị xóa.

## 4. Backend và an toàn đồng thời

### 4.1 Kiểm tra và xóa trong cùng transaction

- Di chuyển decision snapshot của `deleteExhibitDraft` vào `tx.run`, lấy exhibit chưa xóa với khóa `FOR UPDATE` trên riêng dòng exhibit (tránh FOR UPDATE trên outer joins).
- Đọc/khóa các revision thuộc exhibit, kiểm tra mọi state và report references trong cùng transaction/manager trước cascade.
- Kiểm tra reports theo `exhibitId = id OR reportedRevisionId IN (revisionIds)` bằng repository. Không tải nội dung report hoặc sửa reports. Giữ cascade thứ tự hiện có và rollback toàn bộ nếu bất kỳ bước lỗi.
- Xóa không gọi MediaService/storage delete; FK media là revision → media, xóa revision không được dẫn đến xóa media dùng chung.
- Dùng error code PostgreSQL `23503` và **constraint identity** để chuyển đúng FK report/exhibit/revision của thao tác này thành 409 sau rollback. Xác định tên FK từ metadata TypeORM thay vì đoán chuỗi. Lỗi khác không được biến thành thành công/409 chung; không catch toàn cục mọi FK của hệ thống.

### 4.2 Không coi khóa ở DELETE là đủ

Submit/update hiện đọc active revision trước transaction; publish/reject dùng optimistic version/state. Nếu DELETE khóa dòng nhưng writer giữ snapshot cũ rồi save sau đó, vẫn có thể race. Phải xác nhận và phối hợp ở các writer thực tế, không chỉ thêm lock rồi tuyên bố atomic.

- Thêm regression lịch biểu cho DELETE↔submit, DELETE↔publish, DELETE↔update và report insert↔DELETE.
- Trong cùng transaction, writer liên quan phải re-read/kiểm tra tồn tại và trạng thái sau khi có khóa phù hợp, trước ghi. Không dùng `save` snapshot cũ có thể insert lại dữ liệu sau khi exhibit đã bị xóa.
- Giữ thứ tự khóa media hiện có của publish gate: media → exhibit → revision khi writer có bước media. DELETE không khóa media, chỉ exhibit → revision; không chuyển publish thành exhibit → media vì có nguy cơ deadlock với update/submit.
- Không sửa payload, validate gate hoặc quyền; nếu phải mở rộng method repository để nhận manager/lock, giới hạn ở method phục vụ decision này và writer có test race chứng minh.
- Báo cáo được bảo vệ bởi FK: report commit trước thì DELETE phải từ chối; DELETE commit trước thì report insert phải thất bại, không có orphan. Không yêu cầu viết lại public report flow để tạo global lock.
- Nếu chưa đủ bằng chứng phối hợp writer hoặc thứ tự khóa tạo deadlock, dừng tại task backend để review; không nhận nghiệm thu race chỉ từ mocks fluent-chain.

## 5. CMS Xóa/Ẩn

### 5.1 Nút Xóa

- Chỉ hiện khi có `exhibit:update`; disable khi `publishedRevisionId != null`, visibility=visible, revisionState Approved/In Review. Không dùng riêng `status` vì hidden published có thể status=draft.
- Tooltip và thông báo đúng lý do; nút icon có accessible name và điều khiển bằng keyboard. Disable là UX, backend vẫn kiểm toàn history/report/current state.
- Trước confirm DELETE, fetch detail mới (không chỉ cache 30 giây) để đối chiếu tất cả revisions/pointer/state; nếu mới chuyển In Review/Approved thì dừng confirm và làm mới danh sách. Không tải báo cáo bằng quyền report:read để quyết định xóa; backend trả 409 nếu có tham chiếu.
- Confirm nói rõ **xóa vĩnh viễn hiện vật + toàn bộ revisions/hotspots**, media vẫn giữ trong thư viện; cancel không gửi request. Trong mutation pending khóa thao tác lặp; 409 giữ thông báo nguyên nhân, refetch record/caches thay vì báo thành công.
- Thành công: invalidate danh sách/chi tiết hiện vật, room counts/select/tour-order và moderation queue liên quan; dùng query keys thực tế, không clear toàn app. Focus về heading/control còn tồn tại. Nếu trang hiện tại rỗng sau xóa, chuyển trang trước khi page>1.

### 5.2 Nút Ẩn khỏi bảo tàng

- Đặt action ở danh sách hiện vật, chỉ khi có `revision:hide`, visible và có publishedRevisionId. Không phụ thuộc hiện vật còn nằm trong hàng chờ kiểm duyệt.
- Có xác nhận: **“Ẩn hiện vật khỏi trang công khai? Lịch sử, bản nháp và media vẫn được giữ.”**
- Dùng `moderationService.hide(id, version)` sẵn có; lấy detail/version mới tại thời điểm xác nhận (không giữ version list cũ). 409 phải báo rõ/refetch, không tự retry với version mới để vượt optimistic conflict.
- Sau success giữ exhibit/history/media, invalidate admin detail/list, moderation và public room queries liên quan để lần đọc mới không giữ public snapshot cũ trong CMS. Giữ backend hiện tại tăng version/archivedAt; không thêm “archive” endpoint.
- Không đổi API status draft/published trong bản fix; UI giải thích hidden published vẫn có lịch sử và không đủ điều kiện hard-delete.

## 6. File map dự kiến sau duyệt

| File | Trách nhiệm |
|---|---|
| `back-end/src/modules/exhibits/services/exhibits.service.ts` | DELETE policy trong tx, thông báo, writer revalidation nếu race test yêu cầu |
| `back-end/src/modules/exhibits/repositories/exhibits.repository.ts` | Scoped row locks, revision state/report queries, cascade giữ media |
| `back-end/src/modules/moderation/{services/moderation.service.ts,repositories/moderation.repository.ts}` | Phối hợp publish/reject locks/revalidation chỉ khi cần race correctness |
| `back-end/src/modules/exhibits/tests/exhibit-deletion-policy.spec.ts` | Policy + transaction/rollback + FK/race regression mới |
| `back-end/src/modules/exhibits/tests/{exhibits-service,exhibits-repository,admin-exhibits-controller}.spec.ts` | Cập nhật mocks/contracts và guard/response/audit regression |
| `back-end/src/modules/moderation/tests/moderation-service.spec.ts` | Hồi quy publish/hide và writer phối hợp |
| `front-end/src/pages/admin/ExhibitsPage.tsx` | Nút Xóa/Ẩn, confirm/fresh snapshot/cache/errors/focus |
| `front-end/tests/exhibit-deletion-policy.spec.ts` | Stateful mock browser Xóa/Ẩn/permission/races 409 |
| `front-end/tests/fixtures/exhibitDeletionApi.ts` | Fixture auth/record/media/DELETE/Hide và deferred responses |
| Hai docs nhiệm vụ | Acceptance/evidence/ledger |

Không bắt buộc sửa mọi candidate. Không sửa UI/backend endpoint xóa riêng revision. Nếu backend entity FK đã đủ, không tạo migration.

## 7. Verification

- Backend matrix: Draft/Rejected/no revisions cho xóa; published/hidden published/Approved history/In Review (cả revision không phải latest)/reports mọi trạng thái chặn đúng 409 trước delete.
- Kiểm report cross-reference reportedRevisionId; FK report insert phát sinh giữa check/delete chuyển 409 đúng constraint; lỗi DB khác vẫn lỗi, cascade rollback giữ toàn dữ liệu.
- Transaction manager phải truyền mọi method; test thứ tự query/delete, affected rows và media không bị gọi xóa. Không cho tx callback mock thành bằng chứng row lock thật.
- Race tests: lịch biểu fake manager/SQL runner cho kiểm tra revalidation không resurrect stale snapshot. Không mở DB thật hoặc chạy migrations. Nếu không có isolated PostgreSQL đã provision và schema sẵn được cho phép, ghi **NOT TESTED database lock/concurrency thực tế**, blocker reviewer phải đánh giá trước merge; không cài/chạy DB/migration tự động.
- Browser: ẩn/khóa nút theo permission và state, confirm cancel/Enter/Space, DELETE/Hide payload đúng, hidden published không xóa được, stale version/state/report 409, pending không double invoke, focus và pagination, media records còn nguyên trong mock.
- Hồi quy stale form, keyboard/nested modal, moderation queue khi source/fixture liên quan; không chạy smoke scripts có mutation CMS thật.
- Typecheck/lint/build cả hai app và focused tests. Chỉ chạy test DB nếu có phê duyệt riêng; không dùng suite integration tự `runMigrations()`.

## 8. Self-review / gate

- [x] Không thêm xóa revision, soft-delete hoặc gỡ published pointer.
- [x] Có guard tất cả revision/report, UI/backend nhất quán và đường Hide hiện hữu.
- [x] Không coi ẩn là đủ để xóa lịch sử; media dùng chung không bị xóa.
- [x] Đề cập race writer snapshots, khóa sau publish media gate và FK report; không hứa DB concurrency PASS từ mock.
- [x] Có task/file/test/acceptance/commit boundaries và giới hạn rõ.
- [x] Người dùng duyệt trước implementation/commit.

**Trạng thái (2026-10-22):** Đã triển khai DELETE-00–03 và hoàn tất regression/evidence local của DELETE-04; chờ review trước tích hợp. Ledger và matrix chi tiết ở [task breakdown](../tasks/exhibit-deletion-policy.md).

- Backend focused: **409/409 PASS**; moderation HTTP: **8/8 PASS**.
- Browser mocked API: **56/56 PASS** (bao gồm 15 test Xóa/Ẩn); typecheck/lint/build cả hai app PASS. Vite còn cảnh báo chunk >500 kB.
- Regression response DELETE preflight về muộn: bỏ guard → FAIL, khôi phục → PASS; response không mở confirm chồng lên form mới.
- **Review blocker / NOT TESTED:** row-lock, deadlock, FK/report insert đồng thời và rollback thực tế trên PostgreSQL. Fake manager/metadata/transaction runner chỉ chứng minh control flow và hợp đồng query; không thay thế DB proof. Chưa được phép chạy DB integration/migration/seed.
- Giữ nhánh `fix/exhibit-deletion-policy`; chưa push, chưa tạo PR, chưa merge.
