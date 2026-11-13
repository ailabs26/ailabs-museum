# F06 — Guided Tour 2D UI — Implementation Plan

> **Trạng thái:** IMPLEMENTED — F06 acceptance đã được kiểm chứng; affected regression đạt 63/63 trên `origin/feat/guided-tour-2d-ui`. PR chưa mở; người dùng sẽ tự tạo.
>
> **Tasks & Acceptance:** [`../tasks/guided-tour-2d-ui.md`](../tasks/guided-tour-2d-ui.md)

**Repository:** `ailabs26/ailabs-museum`
**Source audit:** `origin/dev` tại `7cd44365b0b3801f31d2517edc5fbd4a734731b8`, fetch ngày 10/11/2026.
**Branch:** `feat/guided-tour-2d-ui` từ `origin/dev`; PR target `dev` khi được yêu cầu.
**Stack:** React 18, TypeScript, React Router 6, Mantine, TanStack Query, Vitest, Playwright.
**Quy ước:** `AGENTS.md`, `docs/architecture/fe/coding-conventions.md`, `docs/architecture/fe/museum-experience.md`.

## 1. Mục tiêu

Cho phép khách tham quan theo **hành trình có hướng dẫn ở chế độ 2D**, trên các trang Collection và Exhibit Detail đang có: bắt đầu ở phòng chọn, đọc hiện vật theo thứ tự CMS đã xuất bản, Next/Previous, Pause/Resume, theo dõi tiến độ và Exit.

**Bất biến:** `MuseumProvider`/`useGuidedTour()` hiện có là **nguồn trạng thái tour duy nhất**. Không tạo state machine, bộ đếm bước hoặc session thứ hai; chỉ triển khai adapter điều hướng React Router và UI trên các trang 2D. Không cần thay backend/API/DB/CMS.

**Quyết định cho F06:** hành trình 2D **do người đọc chủ động chuyển bước**, không tự Next sau 15 giây và không autoplay audio. `running` là phiên đang hoạt động; `paused` giữ phiên/bước; Core vẫn cho phép Next/Previous khi paused theo reducer hiện tại. Chế độ camera 3D vẫn có dwell 15 giây như PR #175. Đồng bộ liền mạch thời gian/trạng thái giữa 2D và 3D thuộc **F08**.

**Kết quả nghiệm thu:** Start từ Collection → trang Detail đúng hiện vật đầu tiên → chuyển các bước theo CMS → hoàn thành không lặp → có thể Restart/Exit; không mất session khi đi qua các public route và không làm hỏng việc đọc nội dung, nghe audio hoặc thao tác khác của khách.

## 2. Kết quả audit source trên `dev`

| Vị trí | Hiện trạng đã kiểm tra | Quyết định F06 |
| --- | --- | --- |
| `front-end/src/layouts/PublicLayout.tsx` | `PublicLocaleProvider` bọc đúng một `MuseumProvider` phía trên `Outlet`, riêng Admin ở ngoài. | Tái sử dụng; không bọc provider lại trong các trang 2D. |
| `front-end/src/contexts/MuseumContext.tsx`, `hooks/useGuidedTour.ts` | Có `start(room, initialExhibitId?)`, `pause`, `resume`, `next`, `previous`, `goTo`, `exit`, `reconcileRoom`, `invalidateRoom` và selectors. | Tạo adapter UI dùng đúng API này. |
| `helpers/buildGuidedTourSteps.ts`, `helpers/tourOrder.ts` | Sinh step `{roomId, exhibitId}` từ các hiện vật public, sắp xếp `displayOrder` rồi ID. | Không dùng thứ tự card đã search/filter. |
| `reducers/museumReducer.ts` | Next cuối → completed; Previous từ completed → paused; Next/Previous hợp lệ khi paused; reconcile dựa trên ID. | Giữ semantics Core, không viết reducer mới. |
| `pages/client/CollectionPage.tsx` | Phòng chọn qua `?room=`, dữ liệu public qua `useMuseumRooms`; danh sách grid có search/favorites. | Đặt CTA Start/Continue ở header phòng, độc lập filter. |
| `pages/client/ExhibitDetailPage.tsx` | Route `/collection/:roomSlug/exhibits/:exhibitId` đã có ảnh, audio, transcript, báo cáo, yêu thích và focus heading. | Thêm thanh điều khiển gần đầu bài viết, không thay nội dung hay media. |
| `app/router.tsx` | Collection và Detail cùng PublicLayout; Admin ở ngoài. | Session còn khi đổi route public; reload vẫn reset theo F05. |
| `pages/MuseumPage.tsx`, `hooks/useGuidedCameraTour.ts` | 3D đã sở hữu camera, arrival và dwell 15 giây. | Không sửa bộ điều khiển camera hay timer trong F06. |
| `helpers/guidedTourMessages.ts`, `GuidedTourBar.tsx` | F07 dùng bộ chữ dự phòng 6 ngôn ngữ và có thể ưu tiên chuỗi CMS. | Tái sử dụng nhãn chung; bổ sung nhãn 2D riêng theo cùng cách, không cần migration/seed DB. |
| `.github/workflows/ci.yml` | CI chạy frontend gates nhưng nhóm E2E tour/audio chưa nằm trong danh sách CI. | Chạy F06 browser suite trực tiếp; cân nhắc smoke 2D gọn trong CI, còn mở rộng tổng thể thuộc F09. |

## 3. UX và luồng người dùng

**Nguyên tắc:** giao diện 2D ưu tiên *đọc* nội dung; thanh điều khiển chỉ hỗ trợ tác vụ, không phủ lên ảnh/âm thanh/chi tiết. Giữ Aura Design System, Mantine, bố cục và theme hiện tại; tránh tạo một màn hình Tour 2D hoàn toàn mới.

### 3.1. Collection — điểm bắt đầu

- Tại phần header phòng đã chọn, thêm **“Bắt đầu tham quan 2D”** khi phòng có ít nhất một hiện vật public. Phòng rỗng thì nút không khả dụng, hiển thị nguyên nhân rõ ràng.
- Nhấn Start: `tour.start(detail)`, sau đó navigate tới URL Detail chuẩn của bước đầu tiên. Giữ cùng `MuseumProvider` trong public layout.
- Nếu có session của **cùng phòng**, hiện **“Tiếp tục tham quan”** (đi tới `currentStep`, Resume nếu paused) và **“Thoát hướng dẫn”**. Nếu session thuộc phòng khác, người dùng phải chủ động nhấn Start mới được thay phiên.
- Search, chỉ hiện vật yêu thích, so sánh, báo cáo, điều hướng 3D hiện có không thay đổi. Tour luôn theo danh sách public gốc, **không** theo kết quả filter.

### 3.2. Exhibit Detail — điều khiển và đọc bước

- Với deep link hiện vật public hợp lệ mà chưa có tour cùng phòng: hiển thị **“Bắt đầu từ hiện vật này”**; gọi `start(room, exhibitId)` chỉ khi người dùng nhấn.
- Khi URL Detail khớp step hiện tại: hiển thị `GuidedTour2DControls` sau heading và trước phần công cụ đọc, gồm tên phòng/hiện vật, số bước `n/N`, progress, Pause/Resume, Previous, Next, Exit; completed có hành động Restart/Exit.
- **Next/Previous** lấy step từ Core và điều hướng URL Detail chuẩn; không giữ index riêng trong component. Next tại bước cuối chuyển Core thành `completed`, giữ trang Detail cuối, không vòng lại bước đầu.
- **Pause** giữ nội dung và bước hiện tại; **Resume** kích hoạt lại; nếu hiện đang ở URL khác, Resume quay về `currentStep` theo hành động rõ ràng. Không tự chạy audio và không tự nhảy sau 15 giây.
- Khi khách đi Back/Forward, QR link hoặc bấm sang hiện vật ngoài tour: **không ép chuyển hướng về step cũ**. Nếu cần, pause session và hiển thị lựa chọn **“Quay lại bước đang tham quan”** / Exit; điều hướng phát sinh từ nút Guided Tour phải được phân biệt với điều hướng thủ công.
- Link sang 3D vẫn là link hiện có; không tự chuyển/tái sử dụng 2D session theo một cơ chế chưa được thiết kế. F08 sẽ giải quyết hành trình xuyên chế độ.

### 3.3. Ma trận trạng thái/biên

| Trường hợp | Hành vi kỳ vọng |
| --- | --- |
| Phòng 0/1/N hiện vật | 0: không Start; 1: Next → completed; N: đúng thứ tự CMS. |
| Bước đầu/cuối/đã hoàn thành | Previous vô hiệu ở đầu; Next cuối hoàn thành; Restart/Exit rõ ràng. |
| URL ID sai, phòng lỗi/tải chậm | Giữ UI lỗi/retry hiện hữu, không auto-start hay auto-redirect. |
| Refresh/reorder cùng phòng | `reconcileRoom` khi có dữ liệu hợp lệ; giữ exhibit ID nếu còn public. |
| Bước hiện tại bị gỡ xuất bản | Dùng fallback step của Core và paused; chỉ navigate khi Resume có chủ đích. |
| Phòng bị gỡ hoàn toàn | Chỉ `invalidateRoom` khi đã xác nhận phòng vắng ở danh sách public; không invalidate do lỗi mạng. |
| Đổi ngôn ngữ | Không reset ID, session hoặc URL; chỉ cập nhật text và label. |
| Browser Back/Forward | Không bị effect guided tour ghi đè; xử lý lệch step bằng Pause/Continue. |
| Reload/Admin | Theo F05: reload reset tour; Admin không được mount MuseumProvider. |
| Màn hình nhỏ/zoom/keyboard | Không tràn ngang, không che sticky audio dock, focus và nhãn cho screen reader. |

## 4. Kiến trúc triển khai đề xuất

### 4.1. Ranh giới ownership

- **State:** `MuseumContext` và `museumReducer` độc quyền quản lý `status`, `steps`, `currentStep`, `currentIndex` và `progress`.
- **Data:** `useMuseumRooms()` dùng dữ liệu public đã validate. Không fetch nội dung từ control component hoặc từ reducer.
- **Adapter:** `front-end/src/hooks/useGuidedTour2D.ts` ánh xạ sự kiện UI sang Core và React Router. Nếu cần helper thuần cho URL/step thì đặt `front-end/src/helpers/guidedTour2dNavigation.ts` kèm unit tests.
- **Component:** `front-end/src/components/museum/GuidedTour2DControls.tsx` + `.module.css` chỉ nhận trạng thái/handlers, không fetch API hay tự điều hướng.
- **Page integration:** sửa có giới hạn `CollectionPage.tsx` và `ExhibitDetailPage.tsx`, không tạo route mới.
- **i18n:** tái sử dụng `GUIDED_TOUR_MESSAGES` cho nhãn chung, thêm fallback 6 locale cho những nhãn 2D mới; ưu tiên CMS qua hàm `t()` khi key có sẵn. Không cần sửa backend hoặc database trong F06.

### 4.2. Hợp đồng Core ↔ URL (đặc biệt quan trọng)

**Chỉ hành động điều khiển do người dùng chủ động mới tạo navigation của tour.** Không triển khai effect vô điều kiện kiểu `if (tour.currentStep) navigate(detailUrl)`: effect đó có thể khiến Back/Forward, đổi locale, refetch hoặc URL deep link bị ghi đè.

Quy ước adapter:

1. `startFromRoom(room)`: lấy ID đầu từ Core order, dispatch START, navigate sang Detail.
2. `startFromExhibit(room, exhibitId)`: dispatch START có `initialExhibitId` hợp lệ; giữ Detail đang mở.
3. `next()/previous()`: xác định ID đích từ snapshot mới nhất, dispatch command và navigate **đúng một lần** nếu thực sự chuyển bước. Next cuối chỉ completed.
4. `pause()`: chỉ dispatch, không navigate. `resume()`: dispatch, và nếu URL không khớp thì navigate có chủ đích tới step hiện tại.
5. `exit()`: reset Core, giữ trang Detail và nội dung cho người đọc.
6. `reconcileRoom()` khi fetch mới: chỉ cập nhật Core; nếu phải chọn fallback thì hiển thị phục hồi/Continue, không tự redirect.

Đánh dấu nguồn navigation do tour điều khiển (ví dụ location state hoặc intent trong adapter) để tránh vòng lặp. Xử lý dispatch bất đồng bộ, double click, StrictMode effect và stale request. Dựa vào `roomId/exhibitId` ổn định thay vì title/slug bản dịch.

### 4.3. Accessibility, responsive và data safety

- Một session một phòng; chỉ hiển thị controls phù hợp khi `currentStep.roomId === detail.id`; không dùng slug đơn lẻ để quyết định identity.
- Giữ focus heading mà Detail đang triển khai khi ID đổi; tránh focus/aria-live bị thông báo lặp. Region có tên, `role=status`/`aria-live=polite` cho cập nhật có ý nghĩa, progress có nhãn và giá trị truy cập được.
- Nút Mantine có accessible name, trạng thái `disabled` đúng; không thêm hotkey toàn cục xung đột form/audio/screen reader.
- Controls ở **normal flow** (không fixed/sticky) để không chồng lên audio dock; responsive tại 320×568, 390×844, desktop/zoom 200%, theme sáng/tối và reduced motion.
- Không đổi AudioPlayer, không autoplay; nội dung/transcript/ảnh/báo cáo vẫn đọc và thao tác bình thường khi chưa kích hoạt tour.
- Không dùng dữ liệu unpublished/draft hoặc gọi API Admin; không ghi trạng thái tour vào storage.

## 5. Ngoài phạm vi

- **F08:** chuyển chế độ 2D↔3D liền mạch, đồng bộ trạng thái/selection/URL theo mode, lưu đồng hồ dwell xuyên mode, điều khiển camera khi trở lại 3D.
- **F04:** audio/subtitle/WebVTT đa ngôn ngữ, tự phát media hoặc đồng bộ transcript với audio.
- Không tạo API/backend, migration, CMS field, trạng thái server-side, localStorage/cross-tab tour persistence.
- Không sửa 3D camera, WebGL, WebXR, fullscreen, chuyển động và dwell timer.
- Không tự động Next sau 15 giây trong 2D; để người đọc tự quyết định thời gian đọc.
- Không redesign toàn bộ Collection, Detail, Search, Favorites, Compare hoặc Report.

## 6. Acceptance & Test Plan

| AC | Kịch bản | Bằng chứng cần có |
| --- | --- | --- |
| AC-01 | Start từ Collection theo phòng | Browser: mở Detail của step 1 theo CMS, Core running 1/N. |
| AC-02 | Deep link vào Detail rồi Start | Browser: không auto-start, Start từ ID hiện tại hợp lệ. |
| AC-03 | Next/Previous/Pause/Resume | Browser/unit: step, URL và Core nhất quán; không double dispatch. |
| AC-04 | Bước cuối và Restart | Browser: completed không wrap; giữ Detail cuối; Restart có chủ đích. |
| AC-05 | Search/Favorites/filter | Browser: không làm thay thứ tự hoặc tập step. |
| AC-06 | Browser history, deep link/QR, URL khác bước | Browser: không ép redirect; có Pause/Continue/Exit. |
| AC-07 | CMS reorder/removal và invalidation | Browser: giữ ID, fallback đúng Core và không mất session vì lỗi mạng. |
| AC-08 | Đổi 6 locale | Browser: nhãn/content đổi, ID/session/URL không reset. |
| AC-09 | Room 0/1, loading/error/retry | Browser: không có phiên giả, nội dung fallback vẫn đọc được. |
| AC-10 | Keyboard, focus, mobile | Screenshot 320/390/desktop, keyboard/ARIA/progress/focus, không overflow. |
| AC-11 | 3D boundary, Admin isolation | Regression: 3D Core/Camera không đổi, Admin không có provider. |
| AC-12 | Verification & PR | Typecheck/lint/unit/build, browser suites, diff, exit status, evidence thật. |

**Lệnh dự kiến từ `front-end/` (cần xác nhận khi code):**

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx playwright test tests/guided-tour-2d.spec.ts --reporter=line
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/guided-tour-core.spec.ts --reporter=line
npx playwright test tests/public-locale.spec.ts tests/public-visitor-journey.spec.ts --reporter=line
npx playwright test tests/guided-tour-camera.spec.ts --reporter=line
```

Các browser test mặc định dùng fixture/API mock. Chỉ bật `PLAYWRIGHT_PREVIEW=1` với suite có route tồn tại trong bản build (một số fixture dev-only). Không tuyên bố test live DB, NVDA/VoiceOver hay điện thoại thật PASS chỉ từ browser automation.

## 7. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
| --- | --- |
| Vòng lặp giữa Core step và URL | Điều hướng khi có explicit command, không có unconditional redirect. |
| Click Next nhanh khiến ID/URL lệch | Dùng snapshot/intent đáng tin cậy, kiểm thử rapid click. |
| Reconcile phòng sau request cũ | Kiểm tra roomId, trạng thái request; không invalidate từ transient error. |
| Tour 2D làm thay đổi behavior 3D | Không sửa 3D, chạy full affected 3D regression. |
| Focus mất khi sang Detail | Giữ heading focus hiện có, test Tab/ARIA/live region. |
| Controls che audio khi cuộn | Đặt trong normal flow, không sticky/fixed. |
| Chuyển locale làm đổi bước | Stable ID, test đủ 6 locale; không tạo request điều hướng mới. |
| `dev` được cập nhật trước khi triển khai | `git fetch origin`, tạo branch từ HEAD mới nhất và cập nhật SHA. |

## 8. Kế hoạch thực thi và bàn giao

Task chia thành **9 checkpoint (00–08)**, mỗi task lý tưởng một commit có nghĩa; test hành vi nằm cùng commit khi phù hợp. Không tạo commit rỗng cho đủ số lượng. Xem chi tiết [`guided-tour-2d-ui.md`](../tasks/guided-tour-2d-ui.md).

Sau khi code xong, điền evidence, review diff rồi mới push/tạo PR theo yêu cầu; không tự merge. Các trường hợp chuyển 2D↔3D chưa đồng bộ được ghi thành đầu việc **F08**, không kéo vào scope F06.

## 9. Execution record — 10/11/2026

- Branch `feat/guided-tour-2d-ui` được tạo từ `origin/dev` tại `7cd44365b0b3801f31d2517edc5fbd4a734731b8`; không có commit mới hơn khi fetch.
- F06 2D hoàn tất trên Collection/Detail, vẫn dùng Museum Core và chỉ public data; không có sửa backend, DB, camera 3D hay WebXR.
- `npm run typecheck`, `npm run lint`, `npm run test:unit` (55 files / 327 tests) và `npm run build` đều exit 0. Build giữ cảnh báo hiện hữu về bundle chunk >500 kB.
- `npx playwright test tests/guided-tour-2d.spec.ts --reporter=line`: 11/11 passed. Có kiểm chứng CMS order/filter, deep link, rapid click, completed/restart, route drift, refresh/removal, 6 locale, keyboard, 320/390/desktop và zoom 200%.
- Affected browser command `npx playwright test tests/guided-tour-2d.spec.ts tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/guided-tour-core.spec.ts tests/public-locale.spec.ts tests/public-visitor-journey.spec.ts tests/guided-tour-camera.spec.ts --reporter=line` ban đầu chạy 63 test: 62 passed, 1 failed tại setup WASD trước reset. Xem follow-up bên dưới để biết cách xử lý và kết quả mới nhất.
- Screenshot 320×568, 390×844 và 1440×900 được xem trực tiếp; bố cục controls trong normal flow, không tràn hoặc chồng audio. Zoom 200% được assert trong browser test. Không kiểm thử screen reader/thiết bị thật.
- Tại thời điểm ghi record này, nhánh chưa push, mở PR hay merge; trạng thái mới nhất ở follow-up bên dưới.

### Post-push regression follow-up — 10/11/2026

- Trace cho thấy camera reset test hỏng ở bước WASD tạo tư thế trước reset; keydown được nhận nhưng Chromium/SwiftShader đôi lúc chỉ chạy vài frame trong 5 giây. Thay setup đó bằng nút “Lùi xa” đồng bộ; giữ nguyên kiểm tra reset hoàn tất trong DOM click và kiểm tra WASD sau reset.
- Lần chạy affected 63 test đầu sau sửa reset còn 62/63 do test clock camera đầu tiên vẫn ở trạng thái `moving`; test đó pass 3/3 khi chạy riêng. Thêm `waitForRendererIdle(page)` trước khi cài fake clock để chờ frame khởi tạo kết thúc.
- Verification cuối: affected command 63/63; camera file 13/13; reset test 5/5 lần lặp; test clock 3/3 lần lặp. `npm run typecheck`, `npm run lint`, `npm run build` đều exit 0; build vẫn báo bundle chunk >500 kB.
- Toàn bộ mặc định 492 test chưa chạy; lệnh đó đã dừng sau 4 test.
- Commits `0d67937` và `312d2b5` đã push lên `origin/feat/guided-tour-2d-ui`. PR chưa mở; người dùng sẽ tự tạo. Chưa merge.
