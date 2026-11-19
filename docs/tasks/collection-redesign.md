# Task T-COLLECTION-REDESIGN: Public Collection Editorial Redesign

- **Trạng thái:** Đã triển khai và kiểm chứng kỹ thuật; chờ duyệt visual.
- **Nhánh:** `feat/public-collection-redesign` → PR base `dev`.
- **Base xác minh sau fetch (19/11/2026):** `origin/dev` tại `2de067bd2a2fa688aa35b65649dadedaac085e4f`.
- **Plan:** [collection-redesign-plan.md](../plans/collection-redesign-plan.md).
- **Design:** [PUBLIC_PORTAL_DESIGN.md](../architecture/fe/PUBLIC_PORTAL_DESIGN.md) §7.
**Coding convention:** [frontend coding conventions](../architecture/fe/coding-conventions.md).

## Mục tiêu

Redesign `/collection` theo phong cách **Contemporary Heritage Editorial** đã dùng trong Public Foundation/Homepage: Banner charcoal, room chips và search toolbar rõ ràng, room feature panel bên trái, ExhibitGrid phía phải. **Giữ trọn** API public, tìm kiếm trong phòng/vượt phòng, Favorite/Compare/Report, Recently Viewed, Guided Tour 2D↔3D, responsive/a11y và đa ngôn ngữ.

Đây là **phần tiếp theo của roadmap đang dở**, không phải làm Homepage Hero 3D. Homepage/Full-Bleed Hero và Viewer 3D chi tiết tách roadmap sau.

## Phạm vi và giới hạn

- Chỉ `CollectionPage` + CSS scoped và focused tests; không sửa `useMuseumRooms`, query keys, public search API, DTO, database, `PublicLayout`, shared cards, global theme, Admin, `/tour`, Visitor storage hoặc Guided Tour reducer.
- Banner dùng motif trung tính, **không giả ảnh phòng** (room DTO chưa có trường ảnh đại diện); các nhãn/metadata theo dữ liệu CMS. Không mock item public, không fake featured/sort.
- Room chips tương ứng phòng thật và URL `?room=...`, giữ query khác/Back-Forward; số phòng nhiều phải scroll/focus được.
- Search cục bộ case-insensitive như cũ; cross-room `GlobalExhibitSearch` có debounce 300ms và ngưỡng 2 ký tự; **khi noLocalMatch phải xuất hiện trước room panel/gallery**.
- Favorite-only, compare tray/modal, report gắn revisionId, recently viewed, visitor storage, invalid slug, pending/error/retry/stale refetch được giữ; shared card không fork.
- Design responsive 320/390/768/1024/1280/1440; 6 locale, light/dark, focus, reduced motion. No Canvas/WebGL/GLB trên `/collection`.
- **Chỉ 2 tài liệu** trong `docs/plans/` và `docs/tasks/`; không tạo commit-plan riêng. Một PR, nhiều commit; không commit rỗng, không tự push/merge.

## Task và commit dự kiến

| Task | Deliverable | Commit dự kiến | Trạng thái |
|---|---|---|---|
| CR-01 | Baseline, docs và invariant contract | `docs(collection): plan editorial collection redesign` | DONE |
| CR-02 | Reorganize layout/DOM không đổi behavior | `refactor(collection): organize page sections for editorial layout` | DONE |
| CR-03 | Banner editorial charcoal | `feat(collection): introduce editorial collection banner` | DONE |
| CR-04 | Room chips horizontal / URL + keyboard | `feat(collection): refine accessible room chip navigation` | DONE |
| CR-05 | Search + clear / refresh toolbar | `feat(collection): improve search and refresh toolbar` | DONE |
| CR-06 | Room feature panel / motif neutral | `feat(collection): add room feature panel` | DONE |
| CR-07 | Guided Tour 2D/3D actions đặt lại | `refactor(collection): place guided tour actions in room panel` | DONE |
| CR-08 | Gallery layout + Shared Grid responsive | `style(collection): compose responsive room gallery` | DONE |
| CR-09 | Favorite / compare / report integration | `style(collection): integrate visitor actions with gallery` | DONE |
| CR-10 | Global search / recently viewed presentation | `style(collection): clarify cross-room and recent results` | DONE |
| CR-11 | Pending / error / empty / stale states | `style(collection): polish collection loading and empty states` | DONE |
| CR-12 | Localization / responsive / a11y | `fix(collection): align editorial layout with locale and accessibility` | DONE |
| CR-13 | Affected-surface E2E + regression | `test(collection): cover editorial integration regressions` | DONE |
| CR-14 | Quality gates / visual sign-off / handoff | `docs(collection): record collection redesign verification` | Chờ visual |

**Quy tắc:** Đây là checkpoint nhỏ để review. Nếu một checkpoint không cần sửa code/tests, ghi **no-op** và lý do thay vì tạo commit rỗng. Bug mới từ QA có `fix(collection): ...` riêng với regression test.

## Checklist triển khai

- [x] **CR-01:** Baseline, docs và invariant contract. Xem evidence bên dưới.
- [x] **CR-02:** Reorganize layout/DOM không đổi behavior. Xem evidence bên dưới.
- [x] **CR-03:** Banner editorial charcoal. Xem evidence bên dưới.
- [x] **CR-04:** Room chips horizontal / URL + keyboard. Xem evidence bên dưới.
- [x] **CR-05:** Search + clear / refresh toolbar. Xem evidence bên dưới.
- [x] **CR-06:** Room feature panel / motif neutral. Xem evidence bên dưới.
- [x] **CR-07:** Guided Tour 2D/3D actions đặt lại. Xem evidence bên dưới.
- [x] **CR-08:** Gallery layout + Shared Grid responsive. Xem evidence bên dưới.
- [x] **CR-09:** Favorite / compare / report integration. Xem evidence bên dưới.
- [x] **CR-10:** Global search / recently viewed presentation. Xem evidence bên dưới.
- [x] **CR-11:** Pending / error / empty / stale states. Xem evidence bên dưới.
- [x] **CR-12:** Localization / responsive / a11y. Xem evidence bên dưới.
- [x] **CR-13:** Affected-surface E2E + regression. Xem evidence bên dưới.
- [ ] **CR-14:** Quality gates và tài liệu bàn giao đã xong. Chờ người dùng duyệt ảnh.

### Gate chi tiết trước khi đánh dấu một task `[x]`

- [ ] Có bằng chứng test/screenshot hoặc code review phù hợp với task; **không chỉ dựa vào số pass từ PR cũ**.
- [ ] `git status --short`, `git diff --check`, `git diff --cached --check`, staged diff chỉ chứa file thuộc lý do thay đổi.
- [ ] Các chuỗi UI mới (nếu có) phải có VI/EN/FR/ZH/KO/JA và test fallback; không thêm translation key không cần thiết.
- [ ] Source vẫn build/typecheck/lint được; nếu fail ghi rõ lỗi và phân biệt lỗi nền so với lỗi do PR.
- [ ] UI không mất một chức năng đang có trong Collection; không thay cả backend/hook/API/3D để chữa CSS.

## Acceptance Criteria

- [x] Banner charcoal có H1, mô tả ngắn, responsive; không có dữ liệu/ảnh phòng giả.
- [x] Room chip dùng phòng public có thật, active rõ, thao tác bàn phím/URL/Back-Forward đúng; query không bị mất ngoài ý muốn.
- [x] Toolbar tìm theo tên/mô tả và nút clear, Refresh, đếm kết quả; `GlobalExhibitSearch` đúng min2/debounce và lên trước khi local search 0.
- [x] Room feature hiển thị tên/mô tả/đếm và action Guided Tour/3D chính xác, kể cả room rỗng.
- [x] ExhibitGrid/Card giữ H3, placeholder/ảnh 4:3, link detail, favorites, compare, report; grid số cột theo bề rộng thực của gallery.
- [x] Loading/empty/error/invalid room/retry/refetch stale không lộ dữ liệu sai; recently viewed và visitor states còn nguyên.
- [x] Không overflow ngang 320/390/768/1024/1280/1440; 6 locale, light/dark, keyboard/focus/reduced motion; axe affected routes pass hoặc ghi blocker.
- [x] `/collection` không tạo canvas, gọi GLB hay import eager 3D scene; không sửa backend runtime, DB, global theme hoặc Homepage.
- [x] Typecheck, lint, unit, build, affected Playwright tests có log thật; ảnh desktop/mobile được người dùng duyệt hoặc trạng thái pending rõ.

## Các test chính cần chạy

```powershell
cd front-end
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test -- collection-redesign.spec.ts collection.spec.ts collection-global-search.spec.ts collection-memo.spec.ts shared-exhibit-components.spec.ts shared-exhibit-grid.spec.ts public-a11y-axe.spec.ts public-ui-translations.spec.ts public-foundation.spec.ts public-tour-navigation.spec.ts public-image-audio.spec.ts
```

`collection-redesign.spec.ts` chỉ chạy sau khi agent tạo file theo plan. Kiểm tra lại tên visitor/Guided Tour suites trước khi bổ sung vào lệnh. Không chạy live E2E rồi claim thành công nếu không bật `MUSEUM_LIVE_TEST=1` và không có backend thật.

## Evidence / commit ledger

| Task | SHA thực / no-op | Test / lệnh / kết quả | Visual / giới hạn | Status |
|---|---|---|---|---|
| CR-01 | `259c774` | Baseline typecheck đạt. Playwright 43/49, gồm 3 test redesign RED và 3 timeout test hiện hữu; cả 3 timeout qua khi chạy lại. | 4 ảnh baseline ở 390/1440, hai theme | DONE |
| CR-02 | `b512bba` | Giữ URL, thứ tự CMS, status, lỗi và hành vi 2D/3D trong các test Collection/Guided Tour. | Gộp với bố cục panel/gallery để tránh commit chỉ đổi wrapper | DONE |
| CR-03 | `eb287c3`, `b512bba` | Banner RED trên `dev`; qua kiểm H1, nền charcoal, kích thước và luồng Home → Collection. | Ảnh desktop/mobile hai theme | DONE |
| CR-04 | `eb287c3` | 12 phòng ở 320px vẫn một hàng; Tab, Space, URL và Back/Forward đã kiểm. | Cuộn ngang bằng cơ chế native | DONE |
| CR-05 | `eb287c3`, `75f8837` | Nút xóa trả focus về input; giữ lọc Unicode, đếm, Refresh, min2 và debounce 300 ms. | Nhãn nút xóa có 6 locale | DONE |
| CR-06 | `b512bba` | Tên, mô tả, tổng số hiện vật từ API fixture; phòng 0 hiện vật vẫn có panel. | Motif trung tính, không giả ảnh phòng | DONE |
| CR-07 | `b512bba` | Guided Tour 2D/mode-sync qua bộ regression; 2D disable và link 3D còn khả dụng khi phòng rỗng. | Action nằm trong room panel | DONE |
| CR-08 | `b512bba`, `caed377` | Geometry 6 viewport × 2 theme; Shared Grid 2/2, có kiểm chính xác ngưỡng 524/800 px. | Số cột theo chiều rộng gallery | DONE |
| CR-09 | `b512bba`, `caed377` | Favorites, comparison, report revision và storage qua regression; modal 320px không tràn và Escape trả focus. | Đặt filter/tray cạnh gallery, giữ cấu hình shared card | DONE |
| CR-10 | `b512bba`, `75f8837` | Kết quả liên phòng ưu tiên trước cả khi phòng rỗng; test 299/300 ms RED → GREEN. Recently Viewed qua regression. | Giữ component search mounted khi đổi vị trí | DONE |
| CR-11 | `b512bba`, `0a06d0b` | Pending/error/retry/refetch stale qua test Collection; axe lỗi RED ở 2,57:1 → GREEN ở cả hai theme. | Có ảnh pending/error/empty riêng | DONE |
| CR-12 | `75f8837`, `0a06d0b` | Nút xóa qua VI/EN/FR/ZH/KO/JA, fallback và CMS override. Axe 8/8 và contrast khi lỗi ở cả hai theme. | Chưa kiểm NVDA/VoiceOver, zoom browser và thiết bị thật | DONE |
| CR-13 | `75f8837`, `caed377` | Preview 109/112. Hai test HTML fixture qua Vite dev; test grid qua khi đo container thật. Luồng Home → Collection → Detail → quay lại và kiểm no Canvas/GLB qua. | Chạy bằng API fixture, không phải API live | DONE |
| CR-14 | Commit bàn giao này | Node v22.23.2, npm 10.9.8. Typecheck, lint, Vitest 438/438, build đạt. Build báo chunk >500 kB. Production preview cuối đạt 19/19 (Collection Redesign, Shared Grid, axe). | Ảnh đã gửi người dùng, đang chờ duyệt | QA kỹ thuật xong, chờ visual |

### Lần chạy kiểm chứng

- Production preview dùng `PLAYWRIGHT_PREVIEW=1`, 2 workers và timeout 120 giây. Lần chạy gồm 19 spec, có 3 bài chụp ảnh tạm. Hai test Public Foundation truy cập `/tests/fixtures/public-locale.html`, đường dẫn chỉ có trên Vite dev nên preview trả về 404. Chạy lại đúng hai test trên dev đạt 2/2.
- Test Grid cũ giả định 3 cột ở viewport 1024px. Bố cục có sidebar để lại dưới 800px cho gallery. Đã giữ assertion số cột theo đúng breakpoint của shared component; lần chạy lại Shared Grid đạt 2/2.
- Đợt tập trung sau sửa contrast đạt 17/17 gồm 9 test Collection Redesign và 8 phép kiểm axe cho 4 route ở hai theme. Review độc lập đến `75f8837` không phát hiện lỗi; bản vá contrast sau đó có test RED → GREEN. Impeccable detector không báo lỗi.
- Seed unit test đạt 4/5. Test rà toàn bộ khóa vẫn thiếu `ui.guided2d.progress` từ `origin/dev`. Kiểm tra khóa duy nhất và đủ 6 locale đạt. Bộ dữ liệu seed mới chỉ được cập nhật trong mã, chưa thực thi seed DB.

### Ảnh bàn giao

- Bộ ảnh dựa trên API fixture trong `.superpowers/sdd/collection-redesign-plan/visual/review/`: 12 ảnh toàn trang ở 320/390/768/1024/1280/1440px cho hai theme, cùng ảnh viewport để xem nhanh.
- Ảnh pending/error/empty chụp lại ở 390px trong `.superpowers/sdd/collection-redesign-plan/visual/review-states/`. JSON axe nằm trong `.superpowers/sdd/collection-redesign-plan/axe/`. Ảnh và log đều là artifact local, không đưa vào Git.
- Đã đối chiếu bố cục với đặc tả §7. Bitmap tham chiếu gốc không có trong checkout. Chưa xác minh bằng API live, screen reader, zoom browser 200% hoặc thiết bị thật. Visual sign-off của người dùng đang chờ.

## Rủi ro và điều kiện bàn giao

- `ExhibitGrid` có container query breakpoint 524px và 800px; **gallery có sidebar không luôn đạt 3 cột ở viewport desktop**. Review theo chiều rộng gallery thật.
- Các test hiện có kiểm role/label/heading và vị trí `GlobalExhibitSearch` trước room khi no-local-match. Nếu đổi DOM hợp lệ phải giữ semantic/behavior và cập nhật test có lý do; **không xóa assertion để pass**.
- Artwork phòng là motif trung tính; có ảnh phòng thực trong tương lai cần một media contract được phê duyệt, không phải scope PR này.
- Audit tự động WCAG không thay cho NVDA/VoiceOver trên thiết bị thật; manual QA chưa chạy phải ghi rõ còn thiếu.
- Nhánh triển khai `feat/public-collection-redesign` được tạo trực tiếp trong project từ `origin/dev` tại `2de067bd2a2fa688aa35b65649dadedaac085e4f`. Ảnh baseline ở 390px và 1440px, light/dark, dùng API fixture và lưu ngoài Git trong `.superpowers/sdd/collection-redesign-plan/visual/baseline/`.

## Handoff

Nhánh và các commit ở trong checkout project. Xem ảnh desktop/mobile trước khi chốt visual. Chỉ push hoặc tạo PR sau khi có yêu cầu riêng.
