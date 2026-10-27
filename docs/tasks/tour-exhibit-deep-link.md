# Tour Exhibit Deep Link — Task & Acceptance Spec

**Trạng thái:** **Đã triển khai ngày 25/10/2026 trên `fix/tour-exhibit-deep-link`; chưa push/PR.** Typecheck, unit, build và lint riêng file đổi đạt; full lint còn lỗi nền được ghi bên dưới.<br>
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
- [x] Chạy/review baseline test `museum-interaction`, `tour-2d-fallback`, `exhibit-detail`, `accessibility-keyboard`; ghi lỗi hiện có riêng.
- [x] Repro URL 2D → tour không chọn hiện vật bằng test RED và lưu Playwright DOM failure context.

**Baseline trước runtime:** Bộ 49 test bắt đầu nhưng tiến trình kẹt ở F04 cuối nên bị dừng trước summary. Các lỗi quan sát được: `accessibility-keyboard` không focus lại trigger sau Tab; `exhibit-detail` có selector NativeSelect bị kiểm tra như input và font assertion cũ; `museum-interaction` có mismatch navigation mode, overflow ở 200%, frame count chưa ổn định và annotation không mở panel; `tour-2d-fallback` có selector NativeSelect và Canvas label không khớp. Test F04 reflow cũng kẹt khi chạy riêng. Đây là lỗi nền, không phát sinh từ thay đổi này.

**Nghiệm thu:** Root cause ghi đúng; baseline log minh bạch, không có thay đổi backend/không sửa test ngoài scope.<br>
**Commit gợi ý:** `docs(tour): plan exhibit deep links`.

### Task 1 — Resolve deep link từ public room

**Files:** `front-end/src/pages/MuseumPage.tsx`, `front-end/tests/tour-exhibit-deep-link.spec.ts`.<br>
**Mục tiêu:** Deep link trực tiếp/reload chọn đúng hiện vật public sau tải API.

- [x] RED test direct URL: `aria-pressed` sai; link từ trang 2D không mở panel.
- [x] RED tests invalid UUID, ID không thuộc dữ liệu public, room unknown, pending response và API error/retry.
- [x] Parse UUID bằng Zod và resolve ID **chỉ** trong `displays` đã map từ public `detail` hiện tại; selection lấy từ URL.
- [x] URL exhibit không hợp lệ/không tồn tại có status sau khi room tải xong; không tự chọn item, redirect hoặc sửa URL.
- [x] GREEN focused tests: 6/6; typecheck/build PASS; lint file đổi PASS. Full lint FAIL do lỗi nền (Task 4).

**Nghiệm thu:** Direct URL/reload một ID hợp lệ chọn đúng; invalid/cross-room không panel hoặc stale content.<br>
**Commit gợi ý:** `fix(tour): resolve exhibit deep links`.

### Task 2 — Selection/URL/history consistency

**Files:** `MuseumPage.tsx`, new test, `museum-interaction.spec.ts`, `tour-2d-fallback.spec.ts` nếu assertion URL cũ cần đổi.<br>
**Mục tiêu:** Không để URL và selection lệch sau thao tác thủ công.

- [x] RED/GREEN test catalogue: chọn thủ công cập nhật URL, panel và `aria-pressed`; các kênh scene dùng chung callback `handleSelectDisplay`.
- [x] Chọn/đóng giữ `room`/query khác; chọn/đóng dùng `replace:true`.
- [x] Escape/nút Đóng xóa exhibit; focus về trigger hoặc nút Mở 3D khi vào từ deep link.
- [x] Đổi phòng push navigation và xóa exhibit; Back/Forward khôi phục query selection.
- [x] Test đổi phòng khi API đang pending xác nhận không hiện panel/hiện vật cũ; test API lỗi rồi retry thành công.
- [x] Cập nhật assertion F03 ở `tour-2d-fallback` để kiểm tra URL chứa exhibit khi đã chọn; không xóa test.
- [x] 3 test đồng bộ URL/history PASS (runner báo timeout ở teardown sau khi đã ghi 3 passed); typecheck và lint file đổi PASS.

**Nghiệm thu:** Dù bắt đầu từ deep link hay chọn thủ công, URL, panel, selected item và fallback thống nhất.<br>
**Commit gợi ý:** `fix(tour): sync selection with tour URL`.

### Task 3 — Focus, renderer và fallback regression

**Files:** các tests ở trên; `MuseumScene.tsx` chỉ nếu RED chứng minh cần fix tối thiểu.<br>
**Mục tiêu:** Không hồi quy 3D, accessibility hoặc đọc 2D.

- [x] Deep link không khởi chạy Canvas/chunk; panel và heading focus ngay sau khi public data tải.
- [x] Sau thao tác chủ động Mở 3D, Canvas hiện và catalogue vẫn giữ đúng exhibit được chọn; regression ngoài phạm vi phòng 3D PASS.
- [x] Lazy scene failure và F02/F03 WebGL/context/chunk variants giữ link 2D đúng exhibit và catalogue; 7/7 F02/F03 PASS.
- [x] Focus deep link, đóng bằng Escape/nút và trả focus sau khi dừng 3D PASS. Test Tab escape cũ vẫn FAIL như baseline: sau Tab focus không ở trigger.
- [ ] Chưa chạy kiểm tra tràn 320px/light/dark riêng cho deep-link mới; không sửa scene/camera.
- [x] Regression thực hiện: `museum-interaction` 5/5 PASS; `tour-2d-fallback` F02/F03 7/7 PASS; accessibility đóng sau khi dừng 3D PASS; Tab escape FAIL nền. Không chạy toàn bộ `museum-tour`/`museum-navigation` vì scene/camera không đổi.

**Nghiệm thu:** Scene/fallback không bị thay đổi logic ngoài phạm vi, behavior keyboard và focus được chứng minh bằng test.<br>
**Commit gợi ý:** `test(tour): cover exhibit deep-link lifecycle` (hoặc `fix(tour): stabilize deep-link focus` nếu có fix code).

### Task 4 — Verification và handoff

**Files:** `docs/tasks/tour-exhibit-deep-link.md`, `docs/plans/tour-exhibit-deep-link-plan.md`, README nếu cần.<br>
**Mục tiêu:** Có log/evidence và PR reviewable.

- [x] Frontend gates: `typecheck` PASS; `test:unit` PASS (27 files/152 tests); `build` PASS (có cảnh báo chunk lớn); full `lint` FAIL 37 lỗi ở 3 file không đổi và 1 warning ở `CollectionPage.tsx`. ESLint riêng các file đổi PASS.
- [x] Playwright focused cases và regression subsets đã chạy; không chạy toàn bộ `exhibit-detail`, `museum-tour`, `museum-navigation`, `museum-lifecycle`. Kết quả chi tiết ở matrix; test Tab escape nền và timeout teardown được nêu rõ.
- [x] Live API **NOT TESTED**; toàn bộ kiểm tra feature dùng API fixtures, không gọi API/DB thật.
- [x] `git diff --check` sạch; review diff theo phạm vi; build artifacts nằm trong ignore; không thêm `.env`/screenshot/test output vào Git.
- [x] Cập nhật evidence/matrix; các commit riêng theo task được lưu trong lịch sử Git. Chưa mô tả/tạo PR theo yêu cầu chưa push/PR.

**Nghiệm thu:** Các acceptance được PASS hoặc có blocker/NOT TESTED kèm lý do, không claim kết quả chưa chạy.<br>
**Commit gợi ý:** `test(tour): verify exhibit deep-link flows` nếu có thay đổi tài liệu/test thực sự.

## 4. Test matrix bàn giao

| Case | Cách test | Kỳ vọng | Evidence sau triển khai |
|---|---|---|---|
| 2D button → tour | Playwright fixture | URL, panel, focus | PASS |
| Direct link / reload | Playwright fixture | Đúng exhibit, không auto Canvas | PASS |
| ID invalid / cross-room / unknown room | Public API fixture | Không panel/stale data; status đúng | PASS |
| Manual catalogue selection | Playwright fixture | URL, panel, `aria-pressed`, params phụ | PASS |
| 3D mở theo thao tác người dùng | Playwright + SwiftShader | Canvas mở, selection còn đúng | PASS |
| Escape / đóng / đổi phòng | Playwright keyboard & navigation | Xóa đúng param, giữ focus, room change push | PASS |
| Back/Forward | Playwright history | Query selection được khôi phục | PASS; teardown timeout sau 3 passed |
| Delayed/error/retry | Deferred API fixtures | Không hiện exhibit cũ; retry phục hồi | PASS |
| WebGL/context/chunk fallback | F02/F03 + deep-link fixture | Link 2D đúng ID, catalogue còn dùng được | PASS (7/7 + deep-link case) |
| Accessibility Tab escape | Existing keyboard test | Rời panel và focus trigger | FAIL nền (cùng lỗi baseline) |
| Frontend gates | Typecheck/lint/unit/build | Nêu kết quả thật | Typecheck PASS; lint FAIL 37 lỗi nền/1 warning; unit 152 PASS; build PASS |
| Live read-only | Opt-in public API | Published exhibit thật | NOT TESTED |
| Mobile 320px/light/dark deep-link | Browser viewport | Không tràn layout | NOT TESTED |

**Bàn giao:** Nhánh `fix/tour-exhibit-deep-link` từ `origin/dev` `7f14ccd3f0a0306b3d947e230cafde7fe9411441`; commit task 0–4 riêng. Typecheck/unit/build đạt; full lint còn lỗi nền, test Tab escape còn lỗi nền. Chưa push, PR hoặc merge.
