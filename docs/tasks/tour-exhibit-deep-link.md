# Tour Exhibit Deep Link — Task & Acceptance Spec

**Trạng thái:** **Đã duyệt triển khai ngày 25/10/2026; Task 0 đang thực hiện, runtime chưa bắt đầu.**<br>
**Plan:** [tour-exhibit-deep-link-plan.md](../plans/tour-exhibit-deep-link-plan.md).<br>
**Repo/base đã đọc:** `ailabs26/ailabs-museum`, `origin/dev` `7f14ccd3f0a0306b3d947e230cafde7fe9411441`, fetch ngày 25/10/2026.<br>
**Nhánh dự kiến:** `fix/tour-exhibit-deep-link` (một nhánh/một PR vào `dev`; tên là chức năng, không đánh series 01/02).

## 1. Bài toán / SPEC

Tại trang chi tiết hiện vật 2D, nút **“Xem trong không gian 3D”** đã tạo link dạng:

```text
/tour?room=sculpture&exhibit=10000000-0000-4000-8000-000000000002
```

Hiện `MuseumPage` chỉ áp dụng `room`; `exhibit` không được đọc. Kết quả là khách vào đúng phòng nhưng chưa thấy **chi tiết hiện vật đã chọn**. Mục tiêu của fix là khôi phục chính xác selection qua URL mà vẫn giữ WebGL mở theo yêu cầu và luồng fallback/keyboard hiện tại.

### Hợp đồng UI/URL cần nghiệm thu

1. **Đi từ 2D:** Nhấn hoặc Enter trên “Xem trong không gian 3D” → `/tour?room=<slug>&exhibit=<uuid>`; khi API room xong, hiển thị panel đúng hiện vật, heading panel được focus; catalogue có **duy nhất một** item `aria-pressed="true"`.
2. **Direct/reload:** Dán URL trực tiếp hoặc reload vẫn chọn đúng hiện vật từ public API. Không cần/không được tự bật Canvas 3D hoặc tự Enter VR.
3. **Chỉ room/không exhibit:** Tour tải như hiện tại, không tự chọn hiện vật đầu tiên.
4. **Invalid ID:** `exhibit` không phải UUID → không crash, không request API exhibit riêng, không panel; có thông báo dễ hiểu sau khi room sẵn sàng.
5. **Cross-room/unpublished/removed:** ID không có trong `detail.exhibits` của phòng đang xem → không chọn nhầm, không lộ bản nháp hay thông tin từ cache; thông báo không tìm thấy trong phòng. Nếu API đang pending thì giữ loading thay vì báo không tìm thấy sớm.
6. **Chọn thủ công:** Chọn hiện vật khác từ catalogue, hotspot, scene, mini-map hoặc dock → panel, selected state và URL `exhibit` cùng ID; không giữ query ID cũ; không ghi history liên tục (dùng replace).
7. **Đóng:** Nút Đóng, Escape hoặc deselect từ Canvas → xóa riêng `exhibit` khỏi URL; không mất `room` hay query param khác; panel ẩn, focus trả về trigger hợp lệ, fallback tới nút Mở phòng 3D hoặc heading tour khi truy cập direct.
8. **Đổi phòng:** Chọn room khác → xóa exhibit trong cùng navigation; catalogue mới không còn trạng thái selected của phòng cũ. Back/Forward từ navigation giữa các phòng/URL chọn lại đúng ngữ cảnh.
9. **API race:** Response room cũ đến muộn, refresh lỗi hoặc exhibit bị unpublish → không render panel/report/audio/fallback link từ dữ liệu lỗi thời. Retry thành công có thể khôi phục panel nếu ID của URL vẫn còn trong response public hiện tại.
10. **WebGL và 3D:** Panel DOM/danh mục đọc được trước khi Canvas mở; khi người dùng chủ động mở 3D, highlight/selectedId đúng. Khi renderer fail, `SceneFallback` giữ link 2D đúng hiện vật; `isOutsideRoom` vẫn cho đọc panel nhưng không ép camera focus trái guard hiện tại.
11. **Accessibility:** Panel là non-modal; không trap Tab; Enter/Space/Escape và focus lifecycle giữ như hiện tại. Không tự focus lại heading ở mỗi background refetch hoặc đánh cắp focus khi khách đang thao tác.
12. **CMS/dữ liệu:** Không thay CMS draft preview, public API, DB, Auth, media/audio; không nhập `revisionId` từ URL thay cho nguồn public đã validate.

### Ví dụ acceptance

| Input/action | URL/UX kỳ vọng |
|---|---|
| `/tour?room=sculpture&exhibit=<id-2>` | Panel **Hiện vật 2**, pressed ID 2, canvas chưa có |
| Reload URL trên | Vẫn chọn ID 2 sau API; không auto WebGL |
| Click Hiện vật 3 | `?room=sculpture&exhibit=<id-3>` (replace), panel ID 3 |
| Escape từ panel | `?room=sculpture`, panel đóng, focus hợp lệ |
| Chuyển sang ceramics | `?room=ceramics`, không có `exhibit` cũ |
| `/tour?room=ceramics&exhibit=<id-của-sculpture>` | Không panel; thông báo hiện vật không thuộc phòng này |
| WebGL context lost khi đã chọn | Fallback link `/collection/sculpture/exhibits/<id>`; không redirect |

## 2. Quy tắc thực thi

- **Chỉ hai tài liệu ở giai đoạn này**; code/tests thực hiện sau khi duyệt. Không tự tạo nhánh, commit, push, PR hoặc merge trong lượt soạn SPEC/PLAN.
- Từ `origin/dev` mới nhất, chỉ một branch `fix/tour-exhibit-deep-link`; commit ngắn theo nội dung, không mã series; mỗi task có test/evidence trước commit.
- `MuseumPage` là owner selection; **URL single source of truth** thay cho `selection` state song song. Dùng public `displays` đã map từ `room.data`, không tìm item từ room khác.
- Manual chọn/đóng ghi URL với `replace:true`; đổi phòng push URL và delete `exhibit` trong cùng lần cập nhật; bảo tồn các params không liên quan.
- Không tự bật Canvas/WebGL/VR cho deep link; không thay camera/cinematic nếu không chứng minh regression bằng test.
- Test với fixtures hiện có, bổ sung live read-only có điều kiện; không mutate DB production. Không tuyên bố PASS khi chưa chạy.

## 3. Task breakdown — checklist triển khai

### Task 0 — Review/baseline và tài liệu

**Files:** hai tài liệu này, `AGENTS.md`, conventions và related tests.<br>
**Mục tiêu:** Có baseline/repro trước sửa.

- [x] Người dùng duyệt behavior URL, manual selection (`replace:true`), direct focus và không auto WebGL ngày 25/10/2026.
- [x] Fetch `origin/dev` ngày 25/10/2026; baseline `7f14ccd3f0a0306b3d947e230cafde7fe9411441`. Tracked working tree sạch; chỉ có đúng hai tài liệu PLAN/TASK mới do người dùng thêm.
- [x] Tạo branch `fix/tour-exhibit-deep-link` từ `origin/dev`; commit PLAN/TASK trước runtime.
- [ ] Chạy/review baseline test `museum-interaction`, `tour-2d-fallback`, `exhibit-detail`, `accessibility-keyboard`; ghi lỗi hiện có riêng.
- [ ] Repro URL 2D → tour chọn sai/không chọn hiện vật, chụp DOM/focus và test RED.

**Nghiệm thu:** Root cause ghi đúng; baseline log minh bạch, không có thay đổi backend/không sửa test ngoài scope.<br>
**Commit gợi ý:** `docs(tour): plan exhibit deep links`.

### Task 1 — Resolve deep link từ public room

**Files:** `front-end/src/pages/MuseumPage.tsx`, `front-end/tests/tour-exhibit-deep-link.spec.ts`.<br>
**Mục tiêu:** Deep link trực tiếp/reload chọn đúng hiện vật public sau tải API.

- [ ] RED test `?room=<slug>&exhibit=<validID>`: kỳ vọng panel đúng tên + `aria-pressed`, không có canvas/chunk scene trước user gesture.
- [ ] RED tests invalid UUID, ID thuộc room khác, ID không xuất bản, room unknown, pending response và API error.
- [ ] Parse UUID hợp lệ, resolve ID **chỉ** trong `displays` đã validate của `detail` hiện tại; derive selected state từ URL (không setState dư thừa).
- [ ] Khi URL exhibit không khớp dữ liệu đã tải xong, hiển thị status dễ hiểu, không tự select item đầu tiên, không redirect/chỉnh URL tự động.
- [ ] GREEN focused tests, typecheck/lint/build và review diff.

**Nghiệm thu:** Direct URL/reload một ID hợp lệ chọn đúng; invalid/cross-room không panel hoặc stale content.<br>
**Commit gợi ý:** `fix(tour): resolve exhibit deep links`.

### Task 2 — Selection/URL/history consistency

**Files:** `MuseumPage.tsx`, new test, `museum-interaction.spec.ts`, `tour-2d-fallback.spec.ts` nếu assertion URL cũ cần đổi.<br>
**Mục tiêu:** Không để URL và selection lệch sau thao tác thủ công.

- [ ] RED tests catalogue + hotspot/scene/dock (fixture/harness phù hợp): manual pick đổi ID URL và panel/pressed/caption/report target đồng bộ.
- [ ] Chọn/đóng bằng query update bảo toàn `room`/custom query; `replace:true` tránh history spam.
- [ ] Đóng bằng Escape, nút Đóng, click empty scene: URL xóa exhibit; focus về trigger đang kết nối hoặc fallback hợp lệ.
- [ ] Đổi phòng xóa exhibit ngay cùng navigation; Back/Forward phục hồi selection theo location đang hoạt động.
- [ ] API refresh/room race không khôi phục exhibit của request cũ, không focus jump không cần thiết.
- [ ] Sửa assertion chính đáng ở `tour-2d-fallback` đang mong URL chỉ có room sau click chọn; **không xoá test**.
- [ ] GREEN focused browser suites và typecheck/lint/build, review diff.

**Nghiệm thu:** Dù bắt đầu từ deep link hay chọn thủ công, URL, panel, selected item và fallback thống nhất.<br>
**Commit gợi ý:** `fix(tour): sync selection with tour URL`.

### Task 3 — Focus, renderer và fallback regression

**Files:** các tests ở trên; `MuseumScene.tsx` chỉ nếu RED chứng minh cần fix tối thiểu.<br>
**Mục tiêu:** Không hồi quy 3D, accessibility hoặc đọc 2D.

- [ ] Truy cập deep link mà chưa click 3D: panel đọc được bằng keyboard; no WebGL network/canvas.
- [ ] Bắt đầu Canvas chủ động: selected ID/highlight đúng, không phá intro/camera focus; item outside room không được force camera focus.
- [ ] WebGL null/contextlost/chunk failure: fallback link đúng selected exhibit và có catalogue; không auto redirect.
- [ ] Focus panel heading trên direct selection; đóng trả trigger/fallback; Escape hoạt động, Tab thoát panel; không trap focus.
- [ ] Mobile 320px + desktop, light/dark không tràn; refresh lỗi/đổi room gỡ owner stale và audio.
- [ ] Regression cho `museum-interaction`, `tour-2d-fallback`, `museum-tour`, `museum-navigation`, `accessibility-keyboard`; ghi pass/fail/skip thật.

**Nghiệm thu:** Scene/fallback không bị thay đổi logic ngoài phạm vi, behavior keyboard và focus được chứng minh bằng test.<br>
**Commit gợi ý:** `test(tour): cover exhibit deep-link lifecycle` (hoặc `fix(tour): stabilize deep-link focus` nếu có fix code).

### Task 4 — Verification và handoff

**Files:** `docs/tasks/tour-exhibit-deep-link.md`, `docs/plans/tour-exhibit-deep-link-plan.md`, README nếu cần.<br>
**Mục tiêu:** Có log/evidence và PR reviewable.

- [ ] Chạy `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` trong `front-end/`, ghi chính xác kết quả.
- [ ] Chạy focused Playwright và affected regression; nếu full lint có lỗi cũ trong `tests/scripts`, báo FAIL nền rõ ràng, không ghi full lint PASS.
- [ ] Nếu có backend local để thử, chạy live read-only cho `/api/rooms` → detail → `/tour?room=&exhibit=`, reload; nếu không có, đánh **NOT TESTED**.
- [ ] `git diff --check`, review staged files, secret/.env/tmp/screenshots/test-output, clean status.
- [ ] Cập nhật evidence/test matrix, commit ledger, rủi ro còn lại; mô tả PR về `dev` để người dùng review, không tự tạo/merge.

**Nghiệm thu:** Các acceptance được PASS hoặc có blocker/NOT TESTED kèm lý do, không claim kết quả chưa chạy.<br>
**Commit gợi ý:** `test(tour): verify exhibit deep-link flows` nếu có thay đổi tài liệu/test thực sự.

## 4. Test matrix bàn giao

| Case | Cách test | Kỳ vọng | Evidence sau triển khai |
|---|---|---|---|
| 2D button → tour | Playwright click/Enter | URL đúng + panel ID + focused heading | NOT TESTED |
| Direct link / reload | Playwright page.goto/reload | Selected đúng, không Canvas tự chạy | NOT TESTED |
| ID invalid / cross-room | Fixture public API | Không panel/không stale data | NOT TESTED |
| Manual catalogue/3D/hotspot | Playwright input | URL + panel + aria-pressed đồng bộ | NOT TESTED |
| Escape / đóng / room change | Playwright keyboard & navigation | Param xóa, focus hợp lệ | NOT TESTED |
| Back/Forward | Playwright history | URL mới resolve selection đúng | NOT TESTED |
| Delayed/error/refetch | Deferred API fixture | Không chọn phòng cũ, recover an toàn | NOT TESTED |
| WebGL failure | Existing fallback fixtures | Đúng link 2D, không redirect | NOT TESTED |
| Browser/gates | Typecheck/lint/unit/build + affected suites | Không regress ngoài phạm vi | NOT TESTED |
| Live read-only | Opt-in public API | Published exhibit đúng ID | NOT TESTED |

**Bàn giao hiện tại:** Người dùng đã duyệt plan/task; branch `fix/tour-exhibit-deep-link` từ `origin/dev` `7f14ccd`. Docs được commit trước runtime theo Task 0; baseline tests và triển khai còn pending. Chưa push/PR.
