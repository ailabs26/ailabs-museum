# Task T-COLLECTION-REDESIGN: Public Collection Editorial Redesign

- **Trạng thái:** IN PROGRESS.
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
| CR-01 | Baseline, docs và invariant contract | `docs(collection): plan editorial collection redesign` | TODO |
| CR-02 | Reorganize layout/DOM không đổi behavior | `refactor(collection): organize page sections for editorial layout` | TODO |
| CR-03 | Banner editorial charcoal | `feat(collection): introduce editorial collection banner` | TODO |
| CR-04 | Room chips horizontal / URL + keyboard | `feat(collection): refine accessible room chip navigation` | TODO |
| CR-05 | Search + clear / refresh toolbar | `feat(collection): improve search and refresh toolbar` | TODO |
| CR-06 | Room feature panel / motif neutral | `feat(collection): add room feature panel` | TODO |
| CR-07 | Guided Tour 2D/3D actions đặt lại | `refactor(collection): place guided tour actions in room panel` | TODO |
| CR-08 | Gallery layout + Shared Grid responsive | `style(collection): compose responsive room gallery` | TODO |
| CR-09 | Favorite / compare / report integration | `style(collection): integrate visitor actions with gallery` | TODO |
| CR-10 | Global search / recently viewed presentation | `style(collection): clarify cross-room and recent results` | TODO |
| CR-11 | Pending / error / empty / stale states | `style(collection): polish collection loading and empty states` | TODO |
| CR-12 | Localization / responsive / a11y | `fix(collection): align editorial layout with locale and accessibility` | TODO |
| CR-13 | Affected-surface E2E + regression | `test(collection): cover editorial integration regressions` | TODO |
| CR-14 | Quality gates / visual sign-off / handoff | `docs(collection): record collection redesign verification` | TODO |

**Quy tắc:** Đây là checkpoint nhỏ để review. Nếu một checkpoint không cần sửa code/tests, ghi **no-op** và lý do thay vì tạo commit rỗng. Bug mới từ QA có `fix(collection): ...` riêng với regression test.

## Checklist triển khai

- [ ] **CR-01:** Baseline, docs và invariant contract. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-02:** Reorganize layout/DOM không đổi behavior. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-03:** Banner editorial charcoal. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-04:** Room chips horizontal / URL + keyboard. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-05:** Search + clear / refresh toolbar. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-06:** Room feature panel / motif neutral. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-07:** Guided Tour 2D/3D actions đặt lại. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-08:** Gallery layout + Shared Grid responsive. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-09:** Favorite / compare / report integration. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-10:** Global search / recently viewed presentation. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-11:** Pending / error / empty / stale states. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-12:** Localization / responsive / a11y. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-13:** Affected-surface E2E + regression. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.
- [ ] **CR-14:** Quality gates / visual sign-off / handoff. Đọc hướng dẫn từng bước trong Plan, kiểm trước/sau, kiểm staged diff và ghi bằng chứng thật trước commit.

### Gate chi tiết trước khi đánh dấu một task `[x]`

- [ ] Có bằng chứng test/screenshot hoặc code review phù hợp với task; **không chỉ dựa vào số pass từ PR cũ**.
- [ ] `git status --short`, `git diff --check`, `git diff --cached --check`, staged diff chỉ chứa file thuộc lý do thay đổi.
- [ ] Các chuỗi UI mới (nếu có) phải có VI/EN/FR/ZH/KO/JA và test fallback; không thêm translation key không cần thiết.
- [ ] Source vẫn build/typecheck/lint được; nếu fail ghi rõ lỗi và phân biệt lỗi nền so với lỗi do PR.
- [ ] UI không mất một chức năng đang có trong Collection; không thay cả backend/hook/API/3D để chữa CSS.

## Acceptance Criteria

- [ ] Banner charcoal có H1, mô tả ngắn, responsive; không có dữ liệu/ảnh phòng giả.
- [ ] Room chip dùng phòng public có thật, active rõ, thao tác bàn phím/URL/Back-Forward đúng; query không bị mất ngoài ý muốn.
- [ ] Toolbar tìm theo tên/mô tả và nút clear, Refresh, đếm kết quả; `GlobalExhibitSearch` đúng min2/debounce và lên trước khi local search 0.
- [ ] Room feature hiển thị tên/mô tả/đếm và action Guided Tour/3D chính xác, kể cả room rỗng.
- [ ] ExhibitGrid/Card giữ H3, placeholder/ảnh 4:3, link detail, favorites, compare, report; grid số cột theo bề rộng thực của gallery.
- [ ] Loading/empty/error/invalid room/retry/refetch stale không lộ dữ liệu sai; recently viewed và visitor states còn nguyên.
- [ ] Không overflow ngang 320/390/768/1024/1280/1440; 6 locale, light/dark, keyboard/focus/reduced motion; axe affected routes pass hoặc ghi blocker.
- [ ] `/collection` không tạo canvas, gọi GLB hay import eager 3D scene; không sửa backend/DB/global theme và Homepage.
- [ ] Typecheck, lint, unit, build, affected Playwright tests có log thật; ảnh desktop/mobile được người dùng duyệt hoặc trạng thái pending rõ.

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
| CR-01 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-02 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-03 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-04 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-05 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-06 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-07 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-08 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-09 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-10 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-11 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-12 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-13 | — | Chưa chạy | Chưa duyệt | TODO |
| CR-14 | — | Chưa chạy | Chưa duyệt | TODO |

## Rủi ro và điều kiện bàn giao

- `ExhibitGrid` có container query breakpoint 524px và 800px; **gallery có sidebar không luôn đạt 3 cột ở viewport desktop**. Review theo chiều rộng gallery thật.
- Các test hiện có kiểm role/label/heading và vị trí `GlobalExhibitSearch` trước room khi no-local-match. Nếu đổi DOM hợp lệ phải giữ semantic/behavior và cập nhật test có lý do; **không xóa assertion để pass**.
- Artwork phòng là motif trung tính; có ảnh phòng thực trong tương lai cần một media contract được phê duyệt, không phải scope PR này.
- Audit tự động WCAG không thay cho NVDA/VoiceOver trên thiết bị thật; manual QA chưa chạy phải ghi rõ còn thiếu.
- Nhánh triển khai `feat/public-collection-redesign` được tạo trực tiếp trong project từ `origin/dev` tại `2de067bd2a2fa688aa35b65649dadedaac085e4f`. Ảnh baseline ở 390px và 1440px, light/dark, dùng API fixture và lưu ngoài Git trong `.superpowers/sdd/collection-redesign-plan/visual/baseline/`.

## Handoff

Khi xong: ghi `origin/dev` base SHA thực, toàn bộ SHA commit và evidence vào ledger; screenshots so sánh banner/room panel/gallery 320/390/768/1024/1280/1440 trong light/dark; quality-gate log và cảnh báo; user visual sign-off. Chỉ push/PR sau khi có yêu cầu riêng.
