# Guided Tour Core — Implementation Plan

> **Trạng thái:** IMPLEMENTED — 18 task commit trên `feat/guided-tour-core`; đã kiểm chứng, chưa push/mở PR.
>
> **Task / Acceptance:** [guided-tour-core.md](../tasks/guided-tour-core.md)

**Repository:** `ailabs26/ailabs-museum`<br>
**Source audit:** Đã fetch `origin`; `origin/dev` không đổi và vẫn ở `6e40d356bdb8411d2acfd3f431fb3ce2e9f22add` (08/11/2026).<br>
**Branch:** `feat/guided-tour-core`, tạo từ `origin/dev`; chưa push/mở PR theo phạm vi yêu cầu hiện tại.<br>
**Stack:** React 18 + TypeScript + React Router 6 + Zod + TanStack Query + Vitest (Node) + Playwright. Không thêm state-management dependency.
**Nguồn quy ước:** `AGENTS.md`, `docs/architecture/fe/coding-conventions.md`, `docs/architecture/fe/museum-experience.md`.

## 1. Mục tiêu và giá trị sau khi hoàn thành

Xây **bộ điều khiển hành trình tham quan có hướng dẫn** dùng chung giữa các trang Public Client. Bộ điều khiển đọc danh sách **hiện vật đã xuất bản trong một phòng**, sắp xếp theo thứ tự CMS, duy trì **bước hiện tại bằng ID ổn định** và xử lý các thao tác Start / Pause / Resume / Next / Previous / Go To / Exit bằng state machine có test.

**Sau feature:** lập trình viên của các bước tiếp theo có thể gọi một API React duy nhất để điều khiển tour và đọc `status`, `currentStep`, `steps`, `progress`; điều hướng giữa các route public không làm mất phiên tour khi `PublicLayout` còn mounted. **Chưa có control bar dành cho người dùng**; test chủ đạo là unit và browser regression.

**Phân chia roadmap:** Guided Tour 2D UI, Guided Tour 3D UI và đồng bộ selection/navigation giữa hai chế độ thuộc các feature sau. Media tự phát, dwell timer, camera teleport hoặc Auto Tour không thuộc feature này.

## 2. Source audit trên `dev`

| Đường dẫn | Trạng thái xác minh | Quyết định |
|---|---|---|
| `front-end/src/contexts/MuseumContext.tsx` | File placeholder `//`. | Tạo Context/Provider đúng vị trí có sẵn. |
| `front-end/src/reducers/museumReducer.ts` | File placeholder `//`. | Tạo reducer thuần và state transition; không đẩy side-effect vào reducer. |
| `front-end/src/helpers/tourOrder.ts` | `sortForTour` dùng `displayOrder` rồi `id`. | **Tái sử dụng** quy tắc, không tạo thuật toán thứ tự mới. |
| `front-end/src/helpers/mapRoomDisplays.ts` | Sắp xếp theo `displayOrder` rồi `id`, dùng dữ liệu hiện vật đã public. | Tour step phải cùng thứ tự và ID; không dựa vào title bản dịch, index của grid. |
| `front-end/src/validations/roomSchema.ts` | `roomDetailSchema` kiểm ID phòng/hiện vật, uniqueness; `RoomDetail.exhibits` gồm `id`, `roomId`, `revisionId`, `displayOrder`. | Bắt đầu từ `RoomDetail` đã validate, không tự tải data khác. |
| `front-end/src/services/museum.service.ts` | `/rooms` và `/rooms/:slug` trả content đã validate. | Không thêm endpoint/backend/DB. |
| `front-end/src/hooks/useMuseumRooms.ts` | React Query fetch dữ liệu public; `select` để bản địa hóa. | Chỉ page có dữ liệu sẽ truyền snapshot vào controller; provider **không fetch**. |
| `front-end/src/pages/MuseumPage.tsx` | Chọn hiện vật qua `?room=` và `?exhibit=`, scene chỉ mở theo yêu cầu. | Không viết lại URL, selection, scene hoặc fullscreen trong feature core. |
| `front-end/src/pages/client/CollectionPage.tsx`, `ExhibitDetailPage.tsx` | Đã có dữ liệu phòng, route 2D và deep link tới Tour. | F06 mới kết nối sự kiện/UI 2D với controller. |
| `front-end/src/hooks/useImmersiveTour.ts` | Chỉ quản lý overlay/fullscreen/XR, focus và cleanup. | Không tái sử dụng làm controller Guided Tour; tránh lẫn `isSceneOpen` với `status`. |
| `front-end/src/layouts/PublicLayout.tsx` | Một layout bao Home, Collection, Detail, Tour; trong đó có `PublicLocaleProvider`. | Mount **một** MuseumProvider ở PublicLayout, không bao Admin/CMS. |
| `front-end/src/helpers/visitorPersistence.ts` | Có store localStorage cho preferences. | **Không lưu tour progress** trong F05; state session memory, reload → idle. |
| `docs/tasks/cms-tour-order.md` | Admin reorder qua API, badge Published/Draft; thứ tự persisted server-side. | Dùng thứ tự published public; không thay CMS, không lấy draft. |
| `docs/architecture/fe/museum-experience.md` | Mô tả reducer/context và Manual/Auto là mục tiêu kiến trúc, chưa phải code. | Triển khai **manual state core**, chừa điểm mở rộng Auto nhưng không tạo timer. |

## 3. Phạm vi

### Trong phạm vi

1. **Room-scoped tour session** cho một phòng mỗi lần; chỉ lấy hiện vật từ `RoomDetail` public đã được xác thực.
2. **Danh sách bước** ổn định: `{ roomId, exhibitId }`, `roomSlug` cấp session; sắp xếp `displayOrder`, sau đó `id`.
3. **Trạng thái:** `idle | running | paused | completed`; current index và current step; không lưu tên, mô tả, URL media hay dữ liệu revision đầy đủ trong state.
4. **Commands:** `start(room, initialExhibitId?)`, `pause()`, `resume()`, `next()`, `previous()`, `goTo(exhibitId)`, `exit()`, `reconcileRoom(room)`, `invalidateRoom(roomId)`.
5. **Guard/transition:** command không hợp lệ là no-op; không vượt chỉ số; bước cuối hoàn tất; không tự wrap; dữ liệu rỗng không thể bắt đầu.
6. **Consistency:** đổi ngôn ngữ không reset tour; public room refetch và thứ tự được sửa có chính sách reconciliation; không lộ bản nháp.
7. **React API:** `MuseumProvider` + `useGuidedTour()` cho F06/F07/F08; một owner dưới `PublicLayout`, không thêm global state framework.
8. Unit tests state/edge cases viết cùng commit tương ứng; browser integration/regression và tài liệu evidence + commit ledger.

### Ngoài phạm vi

- Không tạo Start/Pause/Next bar hay nút cho production (F06/F07).
- Không tự động navigate `/collection`, cập nhật `?exhibit=`, đổi URL, highlight selection; **đó là adapter của F06/F07/F08**.
- Không tự phát/tạm dừng/đổi audio, phụ đề, WebVTT, timer, TTS, Auto Tour hoặc tự chuyển bước khi audio kết thúc.
- Không thao tác camera/teleport, WebXR session, fullscreen, WebGL, hotkey.
- Không đổi CMS Tour Order, database/API schema, quyền nội dung, trạng thái xuất bản, locale UI.
- Không tự lưu localStorage/sessionStorage hay cross-tab đồng bộ tiến độ (không được yêu cầu).
- Không tạo UI debug/test harness trên trang thật.

## 4. Thiết kế state machine

### 4.1 Kiểu dữ liệu và định danh

Đề xuất `front-end/src/interfaces/guidedTour.ts`:

```ts
export type GuidedTourStatus = 'idle' | 'running' | 'paused' | 'completed';
export type GuidedTourStep = Readonly<{ roomId: string; exhibitId: string }>;
export type GuidedTourSession = Readonly<{
  roomId: string;
  roomSlug: string;
  steps: readonly GuidedTourStep[];
  currentIndex: number;
}>;
export type GuidedTourState = Readonly<{
  status: GuidedTourStatus;
  session: GuidedTourSession | null;
}>;
```

**Bất biến:** `idle` ⇔ `session === null`; trạng thái còn lại bắt buộc có ít nhất 1 step; `0 <= currentIndex < steps.length`; mọi step có cùng `roomId` và `exhibitId` duy nhất. Dùng `roomId` và `exhibitId` thay cho title hay chỉ số của 2D/3D. **`currentStep` và `progress` là selector dẫn xuất**, không lưu trùng lặp trong state.

**V1 một phòng:** Dữ liệu CMS hiện reorder theo phòng; không tự dựng một tuyến đi xuyên nhiều phòng hoặc một thứ tự phòng chưa được đặc tả. Kiểu `GuidedTourStep` có thể được mở rộng sau nhưng không làm vậy ở F05.

### 4.2 Bảng chuyển trạng thái

| Command | Điều kiện | State mới / hiệu ứng thuần |
|---|---|---|
| `start(room, id?)` | Room valid, có ≥1 exhibit public, id chọn (nếu có) thuộc room | `running`; session mới, index tương ứng (mặc định 0). Session đang chạy sẽ được thay thế có chủ đích. |
| `start` | Room rỗng / initial ID không thuộc room | No-op; không tạo phantom tour. |
| `pause()` | `running` | `paused`, giữ current step. |
| `resume()` | `paused` | `running`, giữ current step. |
| `next()` | `running`/`paused`, còn bước sau | Tăng index 1, giữ running/paused. |
| `next()` | Đang ở bước cuối, `running`/`paused` | `completed`, giữ step cuối để hiển thị kết quả. |
| `previous()` | `running`/`paused`, index >0 | Giảm index 1, giữ status. |
| `previous()` | `completed`, index >0 | `paused` tại bước trước, không tự resume. |
| `goTo(id)` | Session còn hiệu lực, ID thuộc steps | Đến step đó; từ `completed` quay về `paused`; không gọi URL/scene. |
| `next()/goTo()/resume()` | `idle` hoặc trạng thái/ID không phù hợp | No-op. |
| `exit()` | Bất kỳ | Trở về `idle`, xóa session/steps/index; idempotent. |

**Lưu ý về `completed`:** không tự thoát, không tự bắt đầu lại; `start()` có thể tạo phiên mới từ đầu. `previous()` khi index 0 và mọi command vô hiệu đều trả đúng object state cũ để hạn chế render thừa.

**Contract cho selectors:** `currentStep=null`, `currentIndex=-1`, `total=0`, `progress=0` khi `idle`. Khi session hoạt động, `currentStep=steps[currentIndex]`, `total=steps.length`, `progress=(currentIndex+1)/total` (tỷ lệ số bước đã đến, không phải phần trăm thời lượng; `completed=1`). `canPrevious` đúng khi index > 0 và status còn phiên; `canNext` đúng khi `running/paused`, **kể cả tại step cuối** vì lần NEXT tiếp theo sẽ đặt `completed`; `completed` hoặc `idle` thì `canNext=false`. F06/F07 có thể dùng `status` để đổi nhãn Next thành Finish ở bước cuối.

### 4.3 Tạo bước và hòa giải dữ liệu

- `buildGuidedTourSteps(room: RoomDetail)` chỉ lấy `room.exhibits` của **API public**, dùng `sortForTour` và trả ID; không bao gồm draft, không tải admin endpoint; không giữ object media trong session.
- `reconcileRoom(room)`: chỉ áp dụng nếu `room.id === session.roomId`. Nếu hiện vật hiện tại vẫn tồn tại, giữ `exhibitId` dù CMS reorder; cập nhật thứ tự theo published data mới. Nếu bước hiện tại mất: chọn **bước tiếp theo còn hợp lệ theo thứ tự phiên cũ**, nếu không có thì bước trước còn hợp lệ; đặt `paused` để người dùng chủ động tiếp tục. Nếu không còn bước nào → `idle`.
- Nếu room/selection bị xóa hoặc không còn public và consumer nhận được trạng thái *đã xác nhận* đó, gọi `invalidateRoom(roomId)` → `idle`. **Không tự invalidation chỉ vì `loading`/`isFetching`/network error** (tránh hủy phiên do request tạm thời).
- Response cũ đến muộn chỉ được `reconcile` cho đúng room ID; consumer phải cung cấp snapshot đáng tin cậy từ query mới nhất. React Query `select` đổi locale không làm đổi danh sách ID/`displayOrder` → reducer trả state cũ nếu không có khác biệt.
- Trường hợp dữ liệu bị cập nhật nhưng chưa có consumer mount/quan sát, session tạm giữ bước cũ **đến lần reconcile tiếp theo**. F06–F08 phải gọi reconciliation khi nhận dữ liệu phòng và không render nội dung đã bị rút xuống từ session.

## 5. React ownership và tích hợp

Luồng:

```text
PublicLayout
  └─ PublicLocaleProvider (đang có)
      └─ MuseumProvider (mới; một owner duy nhất)
          └─ PublicLayoutContent → Outlet
              ├─ Home / Collection / Exhibit Detail
              └─ MuseumPage (/tour và /tour.html)
```

`MuseumContext.tsx` chứa `MuseumProvider` dùng `useReducer(museumReducer, INITIAL_MUSEUM_STATE)` và memo hóa commands khi hợp lý. `hooks/useGuidedTour.ts` trả `status`, `steps`, `currentStep`, `currentIndex`, `total`, `canNext`, `canPrevious`, `progress` và các command. Hook chỉ được dùng bên trong provider; thiếu provider phải lỗi rõ. Không tạo listener global, browser storage, hoặc effect từng animation frame.

**Ranh giới side effect:** reducer và helper thuần, không chạm `window`, `document`, Router, React Query, audio hoặc Three.js. Context dispatch đồng bộ; việc dẫn URL/hiển thị/camera sẽ do adapter của F06/F07/F08 lắng nghe current step. Khi F05 hoàn tất, không sửa `MuseumPage` hay `ExhibitDetailPage` để auto-select ngay.

## 6. Chiến lược chia nhỏ task và commit

**Phiên bản cập nhật:** **18 task = 18 commit dự kiến**, từ Task 00 đến Task 17. Đây là các thay đổi có ý nghĩa kỹ thuật, không phải chia commit máy móc. Mỗi commit có một hành vi/contract riêng và có thể review độc lập; những bước chỉ thêm type/provider vẫn phải vượt qua typecheck trước khi commit. Không tạo empty commit để đủ số lượng.

| Nhóm | Task | Số commit | Ranh giới |
|---|---|---:|---|
| Chuẩn bị | 00 | 1 | Baseline và tài liệu |
| Data contract | 01–02 | 2 | Type và builder, không đụng React |
| State machine | 03–09 | 7 | Mỗi nhóm transition + selectors có test riêng |
| Content lifecycle | 10–12 | 3 | Reorder, removal và invalidation tách bạch |
| React integration | 13–15 | 3 | Context, hook, mount ở PublicLayout |
| Nghiệm thu | 16–17 | 2 | Browser regression và review/handoff |
| **Tổng** | **00–17** | **18** | **Một branch, một PR** |

**Thứ tự bắt buộc:** `contract → builder → START → PAUSE/RESUME → EXIT → NEXT → PREVIOUS → GOTO → selectors → reconcile → Provider → hook → layout → browser evidence → handoff`. Chỉ commit khi unit/typecheck của phần vừa sửa PASS; chạy lint khi thay TypeScript và affected tests sau các bước integration. Ghi lại lỗi baseline và không sửa lan sang tính năng khác.

**Nguyên tắc:** test tạo cùng commit với hành vi được thêm (RED → GREEN → REFACTOR); Task 16 là phần tích hợp giữa các module, **không dồn toàn bộ test tới cuối**. Các commit không cần push riêng lẻ; sau khi hoàn thiện và review, push một branch để mở một PR vào `dev`.

**Liên kết chi tiết:** [Guided Tour Core — Task Breakdown & Acceptance](../tasks/guided-tour-core.md#4-task-execution-checklist-18-task--18-commit).

## 7. File map dự kiến

| File | Hành động |
|---|---|
| `front-end/src/interfaces/guidedTour.ts` | **NEW** typed contract/state (actions bổ sung theo từng reducer transition). |
| `front-end/src/helpers/buildGuidedTourSteps.ts` | **NEW** build steps từ public `RoomDetail`, dùng `sortForTour`. |
| `front-end/src/helpers/buildGuidedTourSteps.test.ts` | **NEW** thứ tự, ID, empty, stable locale, immutable input. |
| `front-end/src/reducers/museumReducer.ts` | **REPLACE placeholder** reducer state-machine thuần. |
| `front-end/src/reducers/museumReducer.test.ts` | **NEW** table-driven transition và reconcile cases. |
| `front-end/src/contexts/MuseumContext.tsx` | **REPLACE placeholder** provider/action dispatch. |
| `front-end/src/hooks/useGuidedTour.ts` | **NEW** typed consumer hook; selectors là helper thuần để test độc lập. |
| `front-end/src/layouts/PublicLayout.tsx` | **MODIFY** bọc duy nhất `MuseumProvider` trong public locale scope. |
| `docs/plans/guided-tour-core-plan.md`, `docs/tasks/guided-tour-core.md` | **NEW** plan, acceptance, verification ledger. |

Không thay `front-end/src/app/router.tsx` nếu `PublicLayout` đã là boundary phù hợp. Không thêm component/nút production. Nếu cần browser contract test, chỉ dùng test-only fixture tách biệt theo conventions, **không đưa debug UI vào production**; mặc định ưu tiên unit + regression đã có.

## 8. Test design và acceptance gates

- **Unit:** `sortForTour` parity, 0/1/N steps, duplicate guard qua validated DTO, immutability, ID thay vì text; mọi transition valid/invalid; completion, no-wrap, `exit` idempotent; reorder/delete/current removed; late refresh khác room, locale-only update giữ state.
- **Lifecycle:** không state xuyên Admin, dùng chung trong public layout, không làm thay đổi QueryClient/LocaleProvider; StrictMode không có side effect khởi tạo tour.
- **Playwright affected:** `public-locale.spec.ts`, `public-language.spec.ts`, `collection.spec.ts`, `exhibit-detail.spec.ts`, `museum-tour.spec.ts` và relevant route tests để đảm bảo không regress điều hướng, 3D/focus/audio hiện tại. F05 không bắt buộc E2E Guided Tour buttons vì F06/F07 chưa có UI.
- **Gates:** `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`; focused Playwright; `git diff --check`.
- **Chứng cứ:** ghi chính xác lệnh, pass/fail/skip, OS/browser, source SHA và thông tin fixture/API mock; không báo PASS từ kiểm tra source đơn thuần.
- **Không** tạo DB/migration/dependency, không gọi backend admin, không ghi dữ liệu thật.

## 9. Các rủi ro và quyết định

1. **Sai khái niệm:** `isSceneOpen` (overlay 3D) **khác** `guided.status`. Không gọi `useImmersiveTour()` để thay reducer.
2. **Sai quyền:** chỉ dùng `RoomDetail` từ API public, không lấy draft để xếp bước; reducer không giữ payload content nhạy cảm.
3. **Mất bước vì locale/refetch:** giữ ID, hòa giải theo identity, không reset index theo object tham chiếu.
4. **Đổi phòng:** tour V1 chỉ gắn một phòng; adapter UI phải xác nhận start phiên khác chứ không tự trộn step của hai phòng.
5. **Auto/audio:** không dùng timer hoặc audio events trong F05, tránh xung đột với F04 và các feature Guided Tour sau.
6. **Kiểm thử UI:** logic F05 là headless; chưa có control bar nên chưa quảng cáo chức năng Start/Pause cho người dùng cuối.
7. **Existing placeholder:** `MuseumContext` và `museumReducer` chỉ có `//`, không cần giữ code placeholder.
8. **Branch drift:** khi code `dev` đổi sau source audit, fetch/rebase trước khi làm, giữ một feature một PR.

## 10. Definition of Done

- [x] Reducer + builder typed và unit-tested; không side effect.
- [x] Provider/hook có API ổn định cho F06–F08; mount đúng PublicLayout; Admin ngoài scope.
- [x] Mọi status/action/no-op và reconciliation đã được kiểm thử.
- [x] `next` tại biên hoàn tất, `previous` không wrap, room rỗng không tạo tour.
- [x] Order theo `displayOrder, id`, không giữ nội dung chưa public.
- [x] Không đổi URL/selection, audio, WebGL, backend/DB, giao diện production.
- [x] Frontend typecheck, lint, unit, build, affected regression được chạy; kết quả ghi trong task ledger.
- [x] 18 task/18 commit có ý nghĩa, mỗi task chứa test/checkpoint phù hợp; một branch local sẵn sàng mở PR vào `dev` khi được yêu cầu.

**Không đánh dấu checklist DONE trước khi có implementation và verification thực.**
