# Guided Tour 2D ↔ 3D — Implementation Plan

> **Trạng thái:** IMPLEMENTED — tính năng và kiểm tra local hoàn tất trên `feat/guided-tour-mode-sync`; giới hạn QA được ghi ở execution evidence. Chưa push/PR/merge.
>
> **Tasks & Acceptance:** [`../tasks/guided-tour-mode-sync.md`](../tasks/guided-tour-mode-sync.md)

**Repository:** `ailabs26/ailabs-museum`
**Source audit:** `origin/dev` tại `dcbb814141bef3ed547f0893edb701c4d9407771` (fetch xác nhận ngày 11/11/2026, giờ Việt Nam).
**Branch:** `feat/guided-tour-mode-sync`, HEAD khởi tạo cùng SHA với `origin/dev`; merge-base xác nhận `dcbb814141bef3ed547f0893edb701c4d9407771`.
**Stack:** React 18, React Router, TypeScript, Mantine, TanStack Query, Vitest, Playwright; không thêm dependency nếu chưa chứng minh cần thiết.
**Quy ước:** `AGENTS.md`, `docs/architecture/fe/coding-conventions.md`, `docs/architecture/fe/museum-experience.md`.

## 1. Mục tiêu

Khi khách tham quan đang có một Guided Tour ở chế độ 2D hoặc 3D, họ có thể **chủ động chuyển sang chế độ còn lại** mà không mất phòng, hiện vật, bước, thứ tự CMS và trạng thái phiên. Camera/auto-dwell của 3D phải được dừng an toàn khi rời 3D; sau khi trở lại 3D, người dùng **tự chọn Resume** và đồng hồ tiếp tục từ thời gian còn lại *chỉ sau khi camera đến đúng hiện vật*. Chế độ 2D tiếp tục cho khách **đọc theo nhịp riêng**, không chạy countdown hoặc autoplay audio.

**Một nguồn trạng thái duy nhất:** `MuseumProvider` / `museumReducer` / `useGuidedTour()` sở hữu phiên, status, currentStep và progress. Không sao chép tour session hoặc viết reducer thứ hai. Metadata thời gian chờ ở mức coordinator có thể độc lập với reducer nhưng phải được ràng buộc bởi session + step ID, có owner và cleanup rõ ràng.

## 2. Source audit — thực trạng trên `dev`

| File/vị trí | Đã có | Khoảng trống cần xử lý |
| --- | --- | --- |
| `front-end/src/layouts/PublicLayout.tsx` | Một `MuseumProvider` bọc các public routes. | Đây là owner phù hợp cho trạng thái dùng chung; Admin vẫn ở ngoài. |
| `front-end/src/contexts/MuseumContext.tsx`, `reducers/museumReducer.ts`, `hooks/useGuidedTour.ts` | `start/pause/resume/next/previous/goTo/exit/reconcileRoom`, lưu bằng roomId/exhibitId. | Chưa có contract chuyển mode và metadata dwell qua unmount. |
| `front-end/src/hooks/useGuidedTour2D.ts` | Adapter React Router; chặn rapid Next; Back/Forward không auto-redirect; reconcile. | Cần nhận intent chuyển mode, không Pause/restart nhầm từ route drift. |
| `front-end/src/pages/client/CollectionPage.tsx`, `ExhibitDetailPage.tsx` | Start/Continue/Exit 2D; link từ Detail tới `/tour?room=...&exhibit=...`. | Link tour có chủ đích cần trỏ tới currentStep và pause an toàn trước route change. |
| `front-end/src/pages/MuseumPage.tsx` | `useGuidedCameraTour`; 3D controls; `ExhibitDetailPanel` chứa link đọc 2D; `SceneFallback` có link fallback; `handleSelectDisplay` kết thúc tour khi chọn thủ công. | Chuyển mode không được gọi luồng chọn thủ công dẫn tới `exit`; URL, selectedDisplay, step và scene phải khớp. |
| `front-end/src/hooks/useGuidedCameraTour.ts` | Camera request, arrival/blocked, `onManual()` pause, timer 15 giây giữ trong `useRef`. | Rời route/unmount có thể Pause; dwell ref mất khi hook unmount. Cần timer owner sống qua public route. |
| `front-end/src/components/museum/GuidedTourBar.tsx` | Start/Pause/Resume/Next/Previous/Exit 3D. | Bổ sung hành động chuyển sang chế độ đọc 2D khi có session, không làm đổi controls hiện tại. |
| `front-end/src/components/museum/ExhibitDetailPanel.tsx`, `SceneFallback.tsx` | Link `/collection/.../exhibits/...` và state `fromTourFallback`. | Nhận diện tour intent chỉ khi phù hợp; fallback giữ content, focus và paused session. |
| `front-end/tests/guided-tour-2d.spec.ts`, `guided-tour-camera.spec.ts`, `guided-tour-core.spec.ts` | E2E 2D, E2E camera, lifetime Core riêng lẻ. | Thiếu E2E thực sự chuyển qua lại **trong cùng browser session**. |
| `.github/workflows/ci.yml` | CI Typecheck/Lint/Unit/Build và một tập CMS E2E. | Guided Tour 3D/2D spec chưa nằm trong CI mặc định; không tuyên bố xanh nhờ CI chung. |

**Lưu ý:** `docs/handover/acceptance-report.md` đã nghiệm thu Guided Tour theo phạm vi hiện hành. Đây là mở rộng liên thông 2D/3D, không phủ nhận nghiệm thu trước đó.

## 3. Phạm vi và quyết định hành vi

### 3.1. Ma trận chuyển chế độ

| Nguồn / thao tác | Đích / trạng thái kỳ vọng |
| --- | --- |
| Đang đọc 2D, tour `running`, chọn **Tiếp tục trong 3D** | Trước navigate: Pause tour; đi tới `/tour?room={slug}&exhibit={currentStep.id}`; giữ index/step và locale. Không auto-start camera khi scene chưa mở. |
| 2D tour `paused`, chuyển 3D | Giữ `paused`; đúng phòng/step, chờ mở scene + Resume. |
| 3D `viewing` đang có dwell, chọn **Tiếp tục trong 2D** | Snapshot dwell còn lại, hủy timer/camera request; Pause; điều hướng Detail đúng currentStep. 2D không tick timer. |
| 3D `moving`, chuyển 2D | Hủy camera request trước navigate; Pause; không có countdown đã chạy; Detail đúng bước. |
| 3D `blocked`, chuyển 2D | Pause; cho phép đọc chi tiết; không xóa session. |
| 2D đọc xong, chuyển lại 3D | Phải mở scene qua thao tác người dùng và Resume; camera đi đến điểm nhìn an toàn. Dwell chỉ tiếp tục sau arrival. |
| Tour `completed` | Giữ completed, không tự restart ở mode mới; Restart/Exit do người dùng chọn. |
| Không có session, nhấn link `Xem trong không gian 3D` / `Đọc chi tiết 2D` | Giữ nguyên chức năng deep-link thường, không tự tạo tour. |
| Đổi phòng khác khi tour đang hoạt động | Không tự âm thầm đưa session sang phòng khác; dùng hành vi xác nhận/Exit hoặc thông báo, theo cơ chế hiện hành. |
| Reload / rời khu public sang Admin | Theo Core: session reset; không khôi phục từ storage, URL hoặc route state. |

**Ranh giới quan trọng:** mode `2D` nghĩa là các trang Collection/Exhibit Detail; mode `3D` nghĩa là MuseumPage, và việc **mở scene** là hành động riêng. Chuyển mode không tự xin fullscreen/WebXR hoặc bật audio.

### 3.2. Chính sách dwell 15 giây

- **15.000 ms cho mỗi bước:** bắt đầu khi camera đã `arrived` và phiên `running` trong 3D; **không** đếm khi đang `moving`, `blocked`, `paused`, 2D, document hidden, XR mất quyền điều khiển hoặc renderer không ready.
- Khi Pause/chuyển mode/rời scene, lưu `remainingMs` (giới hạn `[0,15000]`) vào coordinator được mount ở tầng public, không vào `useRef` cục bộ sẽ unmount.
- Trở lại 3D: **không auto-Resume**. Người dùng Resume -> camera đến đúng bước -> dwell chạy từ `remainingMs`. Chỉ sau khi hết remaining và request vẫn hợp lệ thì `next()` duy nhất.
- Khi `currentStep` đổi bằng Next/Previous/GoTo/reconcile fallback, khởi tạo 15.000 ms cho bước mới; **reorder giữ nguyên current exhibit ID** thì không reset thời gian.
- Hủy timer và vô hiệu hóa callback cũ bằng session/step identity + generation/token khi chuyển bước, `Exit`, mất phòng, unmount/StrictMode. Không cho timer cũ Next sau khi đã ở 2D.
- Nếu thời gian tới mốc 0 khi pause ở gần cuối, không tự chuyển trong 2D; xử lý Next khi 3D thực sự running + arrived. Dùng monotonic `performance.now()`/clock phù hợp và có deterministic tests.
- **Không tự phát audio**, không gắn audio `ended` vào Next trong phạm vi này; các luồng media locale thuộc feature khác.

### 3.3. Điều hướng và đồng bộ route

- **Intent-only navigation:** không thêm `useEffect` vô điều kiện kiểu `if (currentStep) navigate(...)` vì sẽ phá Back/Forward, QR/deep link và đổi locale.
- Chuyển mode qua thao tác rõ ràng; trước navigate, đồng bộ Pause/hủy timer. Đích dùng **room slug chuẩn + currentStep exhibitId** được lấy từ session và dữ liệu public, không dựa vào tên/nhãn dịch. Query 3D là `?room=...&exhibit=...` như hiện tại.
- Khi URL đích khác currentStep do người dùng Back/Forward hoặc deep link trực tiếp: không auto chọn lại, không đổi bước ngầm. Hiển thị lựa chọn Return to step/Exit; chỉ Resume khi `roomId/exhibitId` hợp lệ.
- Đảm bảo không tạo song song state điều hướng mới có cùng nghĩa với `MuseumContext`; route source intent nếu cần được đánh dấu ở React Router `location.state`/token ngắn hạn, không dùng URL làm nguồn state Core.
- Chuyển mode không được đi qua `MuseumPage.handleSelectDisplay` vì handler này hiện gọi `guided.tour.exit()` cho manual selection; giữ manual selection behavior như cũ.
- `ExhibitDetailPanel`, `SceneFallback` và Detail 2D phải dùng đúng action để pause trước navigation. `SceneFallback` không được tự xóa phiên nếu còn hiện vật hợp lệ.

## 4. Kiến trúc đề xuất

**Tầng Core:** `MuseumContext` và reducer vẫn là owner duy nhất của status, session, steps, index; chỉ mở rộng API nếu có lý do cụ thể và test bất biến. Không tạo Redux/Zustand/event bus.

**Tầng coordinator:** Tạo module/hook có tên mô tả, ví dụ `front-end/src/hooks/useGuidedModeTransition.ts` và `front-end/src/helpers/guidedDwellClock.ts`. Nếu cần sống xuyên routes, đặt coordinator trong `MuseumProvider` (hoặc context phụ nằm dưới đúng một provider), không mount lại theo từng page. Chỉ coordinator nắm `remainingMs` và token thời gian; R3F camera vẫn do owner 3D nắm.

**Tầng adapter:** Sửa có giới hạn `useGuidedCameraTour.ts` để chỉ phát dwell event khi *arrived* và hủy đúng vòng đời; `useGuidedTour2D.ts` để tách route drift với mode transition có intent. 3D không được auto-Resume sau mount.

**Tầng UI:** Bổ sung hành động chuyển mode vào control bar hoặc vùng action hiện hữu, sử dụng Mantine và i18n 6 locale theo cơ chế hiện tại (`t()` + fallback); tránh tạo UI/route mới. Không phá ordinary links nếu tour `idle`.

**Dữ liệu:** Vẫn fetch room public qua `useMuseumRooms`; reconcile theo ID; không thêm API/backend/migration/storage.

**Quy trình setup:** Trước khi edit đọc `AGENTS.md`, conventions và code của 2D/3D; review diff scope; cập nhật kế hoạch nếu `dev` tiến thêm trước khi bắt đầu.

## 5. Acceptance criteria

| ID | Scenario | Expected / Evidence |
| --- | --- | --- |
| AC-01 | 2D → 3D, tour đang chạy | Chuyển đúng phòng/ID/index; status paused, scene chưa tự chạy, chờ người dùng Resume. |
| AC-02 | 3D → 2D trong viewing | Điều hướng đúng Detail và không mất session; countdown dừng và bảo toàn remaining. |
| AC-03 | 3D → 2D trong moving/blocked | Không có callback camera/timer cũ thay đổi bước sau navigate. |
| AC-04 | 2D → 3D → 2D → 3D nhiều lượt | Không tạo session mới, không duplicate timer, chỉ một owner. |
| AC-05 | Dwell remaining chính xác | Ví dụ xem 5 giây rồi sang 2D 30 giây; quay 3D/arrive/Resume thì còn gần 10 giây, không Next trong 2D. |
| AC-06 | Next/Previous, Completed, Exit | Step change reset dwell; completed không wrap; Exit hủy timer/intent và trở idle. |
| AC-07 | Back/Forward, URL lệch, QR/deep link | Không auto redirect/auto start; có recovery an toàn, URL canonical. |
| AC-08 | CMS reorder/removal/room invalid | Giữ ID khi reorder, fallback/paused khi gỡ; rỗng/không public mới invalidate. |
| AC-09 | WebGL fail, scene close, tab hidden, XR | Pause/cancel có chủ đích, fallback 2D vẫn đọc được, không auto Resume. |
| AC-10 | 6 locale, accessibility | Label/chuyển mode dịch đúng; giữ status/step; focus, keyboard, reduced motion, mobile/zoom. |
| AC-11 | Ordinary non-tour navigation | Link 2D/3D khi idle không tạo tour; camera manual selection và audio không regress. |
| AC-12 | Full verification | Typecheck/lint/unit/build, dedicated E2E + affected suites; ghi PASS/FAIL/SKIP và giới hạn môi trường. |

## 6. Chiến lược test

1. **Unit (Vitest):** dwell clock snapshot/resume/reset, zero remaining, step identity, StrictMode cleanup, invalid callbacks, route serializer/intent, pure decision helpers (nếu tạo).
2. **Playwright browser (fixture):** `front-end/tests/guided-tour-mode-sync.spec.ts`: 2D→3D→2D (same browser tab); chuyển trong moving/viewing/paused/blocked; countdown fake clock; Back/Forward/locale; CMS reorder/deletion; real scene ready; fallbacks, mobile/keyboard/focus.
3. **Affected regression:** `guided-tour-2d.spec.ts`, `guided-tour-camera.spec.ts`, `guided-tour-core.spec.ts`, `museum-immersive-ui.spec.ts`, `museum-xr.spec.ts`, `public-locale.spec.ts`, `public-visitor-journey.spec.ts`, `exhibit-detail.spec.ts` (chia batch ổn định, không xóa assertions để xanh).
4. **Quality gates:** từ `front-end/` chạy `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, `git diff --check`. Với test browser dùng software WebGL fixture, ghi rõ không chứng minh headset/mobile vật lý hay live DB.
5. **CI:** hiện CI chưa bao phủ Guided Tour 3D; đưa một smoke cross-mode deterministic vào CI nếu có thể giữ timeout/runner ổn định. Nếu không, ghi rõ local gate bắt buộc và issue F09, không gọi CI xanh là bằng chứng cross-mode.

## 7. Rủi ro đặc biệt cần review

- **Race unmount:** `useGuidedCameraTour` cleanup đang gọi `onManual()` để Pause; nếu 2D tự Resume ngay trước khi cleanup 3D thì trạng thái có thể bị Pause lại. Chuyển mode phải Pause trước navigate, không tự Resume khi mount, và test StrictMode.
- **Scene/WebXR:** Mở scene gắn fullscreen theo user gesture; tuyệt đối không tự `requestFullscreen`/`requestSession` từ effect chuyển route.
- **Dwell ref:** `dwell` hiện lưu local trong hook 3D, unmount làm mất remaining. Di chuyển owner cần giữ tính xác định và không phát timer mỗi frame vào React state.
- **Step/URL drift:** 3D `selectGuidedDisplay` cập nhật query bằng `replace`, trong khi 2D Next tạo history; chuyển mode không tạo loop giữa hai adapter.
- **Manual 3D click:** `handleSelectDisplay` đang `exit()` tour. Không thay đổi lựa chọn này ngoài scope chuyển mode nếu không có test hồi quy.
- **Unpublished data:** dùng dữ liệu đã qua public API; không dựa vào dữ liệu draft hoặc ID không hợp lệ.
- **Audio:** mode transfer unmount player phải dừng audio cũ tự nhiên; không tự phát player mới.

## 8. Ranh giới ngoài phạm vi

- Không làm lại Guided Tour 2D UI, 3D UI, camera path/collision, CMS order, Public Locale.
- Không audio/subtitle/transcript đa ngôn ngữ, autoplay hay Media Auto Tour.
- Không persist session/remaining trên reload, localStorage hay nhiều tab; không sync qua Admin.
- Không thay backend/API/DB, không migration, không request XR session tự động.
- Không tuyên bố nghiệm thu WCAG toàn hệ thống hay real-device FPS từ Playwright giả lập.

## 9. Deliverables và quy trình commit

- `front-end/src/hooks/useGuidedModeTransition.ts` (tên ứng viên, chỉ tạo nếu hợp lý sau source audit).
- `front-end/src/helpers/guidedDwellClock.ts` + unit tests hoặc tương đương; owner timer sống ở `MuseumProvider`, hook camera tiếp nhận lifecycle.
- Các thay đổi nhỏ trong UI/adapter 2D và 3D, i18n fallback; không mở page mới.
- `front-end/tests/guided-tour-mode-sync.spec.ts` + cập nhật affected specs khi cần.
- Plan, Task Breakdown, verification evidence (actual commands, browser/OS, counts).

**Tổ chức:** 10 checkpoint (00–09), commit nhỏ theo ý nghĩa và test đi kèm mỗi behavior. Không tạo commit rỗng, không sửa production vượt scope. Trước PR phải kiểm tra HEAD `dev` mới, diff review, chạy test và có verdict trung thực. Chưa push, tạo PR hoặc merge.

## 10. Execution evidence — 11/11/2026

| Check | Kết quả | Bằng chứng / giới hạn |
| --- | --- | --- |
| Base/branch | PASS | `git fetch origin dev`; `HEAD`, `origin/dev` và merge-base đều là `dcbb814141bef3ed547f0893edb701c4d9407771`. |
| Baseline trước sửa | PARTIAL | Typecheck, lint, unit (327 tests) và build đã qua; focused Playwright baseline chưa chạy. |
| Typecheck / lint | PASS | `npm run typecheck`; `npm run lint`, exit code 0. |
| Unit | PASS | `npm run test:unit`: 56 files, 331 tests passed. |
| Build | PASS WITH WARNING | `npm run build`, exit code 0; Vite cảnh báo bundle >500 kB (main 1,109 kB, Three fiber 821 kB, ApexCharts 544 kB). |
| Cross-mode E2E | PASS | Chromium: dedicated suite 7/7, gồm moving/blocked, WebGL fallback, hidden-tab pause và dwell 5s → 30s ở 2D → còn khoảng 10s sau Resume + arrival. |
| Hồi quy E2E | PASS | Tám suite nêu trong Task 08 chạy bằng Chromium software WebGL: 68/68, 9.1 phút. |
| Browser/OS | PASS WITH LIMIT | Windows + Chromium chạy đủ suite. Lượt Edge trước đó có lỗi khởi tạo WebGL ở immersive tests; Chromium software WebGL là bằng chứng PASS. |
| Visual/a11y | PARTIAL | Automated keyboard, locale, reduced-motion và nhiều viewport đã qua. Preview local không kết nối API nên không có nội dung động để review tay; chưa kiểm tra zoom 200%, screen reader hoặc thiết bị thật. |
| Diff | PASS | `git diff --check` sạch; thay đổi chỉ ở FE guided tour/tests và hai tài liệu plan/task. |
| Remote handoff | NOT DONE | Chưa push, tạo PR hoặc merge. |

Implementation giữ `MuseumProvider` là owner session/dwell; không thêm dependency, API, backend, database hay storage.
