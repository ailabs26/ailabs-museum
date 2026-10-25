# Tour Exhibit Deep Link — Implementation Plan

> **For implementation workers:** Đây là tài liệu thiết kế/kế hoạch **chưa triển khai**. Review cùng [task breakdown](../tasks/tour-exhibit-deep-link.md) trước khi code. Thực hiện tuần tự trên **một nhánh `fix/tour-exhibit-deep-link` từ `origin/dev` mới nhất**, TDD theo từng task, kiểm tra rồi commit. Không tự push/tạo PR/merge khi chưa được yêu cầu.

**Goal:** Khi khách nhấn **“Xem trong không gian 3D”** tại trang chi tiết 2D, URL `/tour?room=<slug>&exhibit=<uuid>` mở đúng phòng và **chọn đúng hiện vật** trong tour, ngay cả khi truy cập trực tiếp, reload hoặc dùng Back/Forward. Giữ cách chọn/đóng hiện vật thủ công và fallback WebGL hiện tại.

**Architecture:** `MuseumPage` là chủ sở hữu duy nhất của ngữ cảnh public tour. Dùng `room` và `exhibit` trong URL làm nguồn xác định **selection công khai**; chỉ ánh xạ `exhibit` vào `selectedDisplay` sau khi `useMuseumRooms` xác nhận phòng và dữ liệu public đã tải thành công. Hành động chọn/đóng bằng DOM/scene cập nhật query URL, không duy trì một `selection` state thứ hai có thể lệch URL. Mọi tiêu điểm, fallback link, AudioPlayer/report target vẫn dựa trên `selectedDisplay` đã validate. **Không tự mở WebGL** chỉ vì URL chứa `exhibit`.

**Tech stack:** React 18, React Router 6 (`useSearchParams`), TypeScript, Mantine 7, TanStack Query, React Three Fiber/Three.js và Playwright hiện có. Không thêm package hoặc endpoint mới.

**Task/spec:** [tour-exhibit-deep-link.md](../tasks/tour-exhibit-deep-link.md).

## 1. Source baseline và vấn đề đã xác minh

- Khảo sát `dev` tại **`7f14ccd3f0a0306b3d947e230cafde7fe9411441`**; fetch xác nhận lại ngày 25/10/2026, SHA vẫn là `7f14ccd`.
- `front-end/src/pages/client/ExhibitDetailPage.tsx` (headerActions) tạo `to={\`/tour?${new URLSearchParams({ room: detail.slug, exhibit: exhibit.id })}\`}`; đây là link deep-link đầu vào đã có, **không cần xây lại**.
- `front-end/src/pages/MuseumPage.tsx` đọc `searchParams.get('room')`, nhưng selection đang ở `useState<{ roomId, id } | null>(null)`; **không đọc `exhibit`**. Vì vậy URL chứa exhibit vẫn mở tour chưa chọn hiện vật.
- `useMuseumRooms` chỉ hiển thị `room.data` khi phòng đã được xác nhận từ API public. `mapRoomDisplays(room)` có danh sách `MuseumDisplay` với `roomId`, `id`, `revisionId`, `isOutsideRoom`.
- `MuseumCatalogue`, `MuseumScene`, `SpatialMinimap`, `ArtifactDock` và panel nhận `selectedId`/`onSelect` từ `MuseumPage`. `ExhibitDetailPanel` đã focus heading khi mount/đổi hiện vật; `SceneFallback` đã có link 2D theo lựa chọn. `MuseumScene` lazy, Canvas chỉ mount sau nút **Mở phòng 3D**.
- Existing tests: `museum-interaction.spec.ts`, `tour-2d-fallback.spec.ts`, `tour-2d-fallback-live.spec.ts`, `exhibit-detail.spec.ts`, `museum-tour.spec.ts`, `accessibility-keyboard.spec.ts`; fixtures tại `tests/fixtures/museumContent.ts` và `museumApi.ts`.
- Một số assertion cũ trong `tour-2d-fallback.spec.ts` mong URL chỉ có `?room=sculpture` sau khi **đã click chọn hiện vật**. Phải cập nhật đúng hành vi URL mới, không xóa test để né regression.

## 2. Phạm vi / không làm

**Trong phạm vi:** Deep link 2D → tour; direct navigation/reload; chọn hiện vật đúng phòng; đồng bộ URL sau chọn/đóng; Back/Forward; xử lý UUID không hợp lệ, ID không có/không được xuất bản, đổi phòng, responses đến muộn, lỗi API/refetch; focus panel; behavior khi Canvas chưa mở/đang mở/WebGL lỗi; regression tests.

**Ngoài phạm vi:** Backend, database/schema/migrations, quyền CMS, draft preview, API revision, GLB/renderer/XR logic, tự khởi chạy Canvas/XR, tự chuyển 3D→2D, camera tour cinematic mới, redesign UI, thay đổi AudioPlayer/transcript/report form, analytics, URL cho 3D pose/camera. Không thêm dependencies; không sửa test collection có selector cũ trừ khi ảnh hưởng trực tiếp tới task này (ghi nhận riêng).

## 3. Hợp đồng URL và UX đã chốt cho nhiệm vụ

| URL/trạng thái | Kết quả mong đợi |
|---|---|
| `/tour` | Chọn phòng public đầu tiên theo logic hiện có; **chưa chọn hiện vật**; Canvas vẫn đóng. |
| `/tour?room=sculpture` | Đúng phòng `sculpture`, không panel chi tiết. |
| `/tour?room=sculpture&exhibit=<id-hợp-lệ-thuộc-phòng>` | Khi API xác nhận: `selectedDisplay` đúng ID, một catalogue button `aria-pressed=true`, panel đúng tên và heading nhận focus; **không auto-start 3D/VR**. |
| `/tour?room=sculpture&exhibit=<uuid-không-thuộc-phòng>` | Không chọn nhầm phòng/hiện vật, không panel/report/audio; hiển thị thông báo nhẹ ở khu nội dung nếu room đã tải xong. |
| `/tour?room=sculpture&exhibit=invalid` | Không gửi request exhibit riêng, không crash/redirect; không panel; thông báo URL hiện vật không hợp lệ. |
| `/tour?room=unknown&exhibit=<uuid>` | Giữ cơ chế lỗi/phòng không khả dụng hiện có; không render hiện vật từ cache của phòng khác. |
| Chọn item bằng catalogue/hotspot/mini-map/dock/scene | URL cập nhật `exhibit` tới ID vừa chọn; panel/`aria-pressed`/fallback theo cùng ID. |
| Đóng bằng nút Đóng, Escape, hoặc click vùng trống của Canvas | Xóa **riêng** `exhibit` khỏi query; panel đóng và focus trở về trigger hợp lệ, hoặc nút Mở phòng 3D/heading nếu không có trigger (deep link). |
| Đổi phòng bằng select tour | Thay `room`, **xóa `exhibit`** cùng một navigation để không giữ lựa chọn phòng cũ; các query parameter khác được bảo toàn. |
| Back/Forward, điều hướng trực tiếp tới URL khác | Chọn theo URL mới, không kẹt lựa chọn cũ; chỉ dữ liệu public của phòng đang active được dùng. |
| WebGL lỗi với exhibit hợp lệ | Fallback giữ link đến đúng trang chi tiết 2D và catalogue tiếp tục dùng được; URL không tự redirect. |

**Chính sách history:** thao tác **chọn/đóng hiện vật tại cùng tour** dùng `setSearchParams(..., { replace: true })` để tránh tạo nhiều entry khi click/hotspot liên tục. **Đổi phòng** là navigation bình thường (push). Back/Forward của các navigation khác phải tái áp dụng selection từ URL. Giá trị `room` và các query param khác không được mất khi sửa `exhibit`.

**Dữ liệu hợp lệ:** URL `exhibit` phải là UUID hợp lệ và có trong `displays` của `detail` hiện tại (chỉ các exhibit published từ public API). Không lấy bản nháp, không fetch ID trực tiếp, không dùng thông tin của phòng cũ. `isOutsideRoom=true` vẫn cho phép **đọc panel/danh mục**, nhưng các lệnh focus camera giữ guard hiện có và không bắt buộc render mô hình 3D.

**Focus:** panel là `<aside>` non-modal; không trap Tab. Khi detail từ URL trở nên hợp lệ, heading của panel nhận focus theo behavior hiện tại. Khi đóng deep link không có invoker, focus đưa tới **Mở phòng 3D** nếu đang có hoặc heading tour nếu không; không focus node detached. Không steal focus bởi background refetch cùng item. Giữ click/Tab/Escape và pressed state hiện tại.

## 4. Phương án triển khai

### 4.1 Chọn cách đồng bộ selection

**Chọn: URL là single source of truth, không giữ `selection` state riêng.**

- `requestedExhibitId = searchParams.get('exhibit')`.
- Validate bằng schema UUID đang có (`z.string().uuid()` hoặc helper nhỏ được unit-test nếu cần). Khi `detail` chưa sẵn sàng thì không báo "không tìm thấy" sớm; khi `detail` đã sẵn sàng, tìm trong `displays` của phòng hiện tại.
- `selectedDisplay = ...find(display => display.id === requestedExhibitId)`; mọi `selectedId` downstream nhận `selectedDisplay?.id ?? null`. Không set selection từ effect sau fetch; vì vậy response đến muộn không thể ghi đè selection của URL mới.
- `selectExhibit(id)`: bảo vệ `detail` hiện tại và ID thuộc `displays`, ghi `exhibit=id` vào URL với `replace:true`, giữ mọi params khác. Cập nhật `selectionTriggerRef` với phần tử đang focus (như cũ) **trước** thao tác chọn thủ công.
- `closeDetail()`: xóa `exhibit` với `replace:true`; focus về trigger nếu còn kết nối, fallback về start/heading. Phải tránh closure stale khi room/query thay đổi; test thao tác nhanh và Back/Forward.
- `handleSelectRoom(slug)`: set room mới và `delete('exhibit')` trong cùng update, không tạo lần render tạm chọn exhibit của phòng cũ.
- Nếu API phòng đổi dưới một URL hợp lệ nhưng exhibit không còn nằm trong public response: `selectedDisplay` tự thành `undefined`, tất cả consumer ẩn chi tiết, hiện thông báo thay vì dữ liệu cũ.

**Không bắt buộc** thay API schema hoặc tạo hook global để làm việc này. Chỉ tách helper nhỏ nếu unit tests chứng minh cần; prefer code gọn ở `MuseumPage`.

### 4.2 Canvas, camera, fallback

- Khi có deep link, DOM panel/catalogue phải hiện mà **không tải chunk `MuseumScene`** hoặc Canvas; nút **Mở phòng 3D** vẫn là hành động của người dùng.
- Khi người dùng chủ động mở Canvas, `MuseumScene` nhận selectedId đã resolve; scene highlight/điểm tương tác dùng behavior hiện có. Kiểm tra khả năng tương tác với `CinematicIntro`/`MuseumControls` khi initial selectedId đã có; **không viết lại camera pipeline** trong nhiệm vụ này. Nếu focus camera conflict với intro, ghi repro và sửa tối thiểu ở tầng scene chỉ sau khi có test RED.
- `SceneFallback` và `ExhibitDetailPanel` tiếp tục tạo link 2D theo `selectedDisplay`; `PublicReportModal` chỉ nhận exhibit/revision sau validation, không bao giờ gắn ID phòng cũ.
- Khi đổi room hoặc API lỗi, không để scene/GLB hay panel giữ thông tin exhibit cũ; giữ cleanup cơ chế sẵn có.

## 5. File map

| File | Mức thay đổi | Trách nhiệm |
|---|---|---|
| `front-end/src/pages/MuseumPage.tsx` | **Sửa chính** | Derive selection từ URL, validation/guard, chọn/đóng/đổi phòng cập nhật query, focus fallback và thông báo target không hợp lệ |
| `front-end/tests/tour-exhibit-deep-link.spec.ts` | **Tạo** | Deep link, direct/reload, selection, invalid room/ID, Back/Forward, room/API race, accessibility/fallback |
| `front-end/tests/museum-interaction.spec.ts` | **Cập nhật nếu cần** | Bảo đảm interaction, pressed state, Escape, camera, focus và đổi phòng không regression |
| `front-end/tests/tour-2d-fallback.spec.ts` | **Cập nhật assertion bắt buộc nếu ảnh hưởng** | URL sau manual selection giờ có `exhibit`; link fallback vẫn chính xác |
| `front-end/tests/exhibit-detail.spec.ts` | **Cập nhật/bổ sung nếu cần** | Nút “Xem trong không gian 3D” tạo đúng room/exhibit; enter bằng keyboard |
| `front-end/src/components/MuseumScene.tsx` | **Chỉ khi test đỏ** | Tránh conflict focus camera/intro nếu có bằng chứng; không tự động thay logic scene |
| `front-end/README.md`, hai tài liệu PLAN/TASK | **Khi bàn giao** | Hướng dẫn URL, bằng chứng thực thi và giới hạn |

`ExhibitDetailPage`, `MuseumCatalogue`, `ExhibitDetailPanel`, `SceneFallback`, `mapRoomDisplays`, API/backend: **reuse**, không sửa nếu không cần. Không thay UI mới của collection để "làm test xanh".

## 6. Trình tự TDD / implementation

### Task 0 — Baseline, review và branch

1. Review hai tài liệu; kiểm tra `AGENTS.md`, conventions, `origin/dev` mới nhất, working tree, các regression đã biết.
2. Tạo **một** nhánh `fix/tour-exhibit-deep-link` từ `origin/dev`; commit docs trước runtime **sau khi được duyệt**.
3. Chạy test baseline liên quan (nhất là `museum-interaction`/`tour-2d-fallback`), ghi PASS/FAIL/NOT TESTED. Không nhận lỗi selector cũ ở collection là do code deep link.
4. Commit gợi ý: `docs(tour): plan exhibit deep links`.

### Task 1 — RED: deep-link selection và validation

1. Thêm `front-end/tests/tour-exhibit-deep-link.spec.ts` fixture tests: 2D link → đúng tour/exhibit, direct URL, reload, no auto Canvas, invalid UUID, unknown ID, cross-room ID, API pending/error/retry.
2. Chạy focused test và ghi ít nhất một RED đúng vì `MuseumPage` bỏ qua `exhibit`, không vì fixture sai.
3. Implement selection derive từ query + validated public displays; hiển thị status hợp lý khi target không hợp lệ, không expose item không có trong room.
4. GREEN tests; typecheck/lint/build; review focused diff; commit `fix(tour): resolve exhibit deep links`.

### Task 2 — Đồng bộ tương tác và lịch sử

1. RED tests: catalogue/hotspot/scene chọn khác; `aria-pressed` và panel đúng; URL update; Escape/Đóng/click scene trống xóa param; đổi room xóa exhibit; preserve unrelated query; Back/Forward/refresh; không reselect khi background API refresh.
2. Dùng một đường ghi query (`URLSearchParams` copy từ params hiện tại), explicit `replace:true` cho chọn/đóng, push cho đổi room. Không sử dụng `setState` selection song song.
3. GREEN + `museum-interaction.spec.ts`, `tour-2d-fallback.spec.ts`, `accessibility-keyboard.spec.ts`; sửa assertion dựa đúng behavior mới. Commit `fix(tour): sync selection with tour URL`.

### Task 3 — 3D/fallback/focus regression

1. Test start Canvas sau deep link: scene nhận đúng `selectedId`, item được highlight và các lệnh focus camera giữ hành vi an toàn; không auto WebGL trước click. Test `isOutsideRoom` không ép focus 3D.
2. Test WebGL unavailable/context-lost/scene error: selected panel, link 2D và catalogue không stale; chuyển phòng và lỗi/retry giữ đúng ID. Test Escape/close focus return và mobile.
3. Chỉ sửa `MuseumScene` hoặc component phụ nếu test RED chỉ rõ bug mới do initial selection; tránh thay XR/hệ thống camera để sửa một deep-link.
4. Chạy affected regressions + gates; commit `test(tour): cover deep-link lifecycle and fallback` (hoặc `fix(tour): stabilize deep-link focus` nếu có code fix).

### Task 4 — Final verification & handoff

1. Chạy full **affected** browser suites và frontend quality gates; ghi số passed/failed/skipped thật. Nếu có failure timing-sensitive, tái hiện riêng và phân loại minh bạch.
2. Opt-in live API test read-only nếu môi trường có sẵn: chọn public room/exhibit từ API thật rồi direct URL + reload; nếu không chạy ghi **NOT TESTED**. Không gửi request ghi DB hay mutate CMS thật.
3. `git diff --check`, `git status`, rà secrets/artifacts, kiểm tra thay đổi đúng scope; cập nhật `docs/tasks/...` bằng ledger/evidence thật; README nếu cần.
4. Commit `test(tour): verify exhibit deep-link flows` khi có changes; dừng bàn giao review, **không tự PR/merge**.

## 7. Lệnh kiểm tra đề xuất

Chạy từ `front-end/` (macOS/Linux: `npm`; Windows có thể dùng `npm.cmd`):

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx playwright test tests/tour-exhibit-deep-link.spec.ts tests/museum-interaction.spec.ts tests/tour-2d-fallback.spec.ts tests/exhibit-detail.spec.ts tests/accessibility-keyboard.spec.ts --reporter=line
```

Mở rộng sang `museum-tour`, `museum-navigation`, `museum-lifecycle`, `museum-glb` và live tests nếu tầng scene/camera/fallback bị sửa. Chạy riêng `MUSEUM_LIVE_TEST=1` khi backend test sẵn sàng; kiểm tra `playwright.config.ts` trước khi dùng. **Không ghi test PASS ở giai đoạn PLAN.** Nếu full lint có các lỗi nền trong `tests/scripts` ngoài diff, báo đúng kết quả, chạy lint các file đổi bổ sung, không gắn nhãn full lint PASS.

## 8. Review/acceptance gate

- URL hợp lệ chỉ mở đúng exhibit đã xuất bản trong room hiện tại, direct/reload/back/forward nhất quán; không auto 3D.
- URL không hợp lệ/chưa tải/lỗi API không làm lộ nội dung phòng khác, không tạo stale fallback/report/audio hoặc lỗi JS.
- Manual selection/close/room switch đồng bộ query, keyboard focus và fallback link; không regress 3D navigation/WebGL recovery.
- Tests/gates có log thật, không thay đổi backend/DB/dependency/draft preview và không tác động phần việc regression collection riêng.
- Người dùng duyệt trước khi triển khai; chỉ tạo PR vào `dev` theo yêu cầu riêng.
