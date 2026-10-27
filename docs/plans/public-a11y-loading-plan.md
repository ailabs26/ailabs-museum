# Public Collection Loading Accessibility — Implementation Plan

> **Trạng thái:** Đã duyệt — đang triển khai trên `fix/public-a11y-loading`.
>
> **Task / Acceptance:** [public-a11y-loading.md](../tasks/public-a11y-loading.md)

**Repository:** `ailabs26/ailabs-museum`\
**Baseline đã đọc:** nhánh `dev`, SHA `fcb2b4d247f73c59c1cde5d01046f29d80aaf075` (27/10/2026). **Khi triển khai phải fetch `origin/dev` mới nhất**, không mặc định mốc khảo sát vẫn là HEAD.\
**Nhánh:** `fix/public-a11y-loading` (tạo từ `origin/dev` mới nhất); **PR đích:** `dev` (chỉ tạo/push/merge khi được yêu cầu).\
**Stack:** React 18, Mantine 7, TanStack Query, TypeScript, Playwright; dùng dependency hiện có.

## 1. Mục tiêu và ranh giới

Bổ sung thông báo **đang tải có thể tiếp cận bằng screen reader** tại `/collection`, trong khi **giữ nguyên skeleton trực quan**, dữ liệu API, URL, filter pills, live search và mọi tương tác đã nghiệm thu. Đặt mục tiêu cụ thể cho **WCAG 2.2 — 4.1.3 Status Messages (Level AA)** ở luồng tải; không tự tuyên bố website được chứng nhận WCAG 2.2 AA toàn diện.

**Trong phạm vi:** tải danh sách phòng ban đầu; tải danh sách hiện vật/phòng đã chọn ban đầu hoặc khi đổi phòng; error/retry/empty và background refetch không gây thông báo trùng hoặc sai; Playwright regression; bổ sung bằng chứng vào tài liệu nhiệm vụ.

**Ngoài phạm vi:** cải tổ giao diện/skeleton, toàn bộ accessibility audit admin, thay API/backend/database/migrations, live report/audio/WebGL, thay logic `useMuseumRooms`, đổi thiết kế UI, tích hợp dependency/analytics hay CI. Không cần chạy lại mọi bài nghiệm thu thủ công trước đây nếu không có thay đổi ảnh hưởng.

## 2. Source of truth: vấn đề xác nhận từ `dev`

| Thành phần | Hiện trạng | Tác động |
|---|---|---|
| `front-end/src/pages/client/CollectionPage.tsx:75–86` | `rooms.isPending` và `room.isPending` chỉ render `<ExhibitSkeleton />`; không có text loading đi kèm | Người dùng công nghệ hỗ trợ không được thông báo rõ là đang chờ dữ liệu. |
| `front-end/src/shared/components/feedback/ExhibitSkeleton.tsx:4–18` | Skeleton là `<ul aria-hidden="true">` | Đúng khi coi skeleton là trang trí, nhưng không thể thay thế thông báo trạng thái. **Không bỏ `aria-hidden`.** |
| `CollectionPage.tsx:80, 103–105` | Có `role="status"` cho empty state, cập nhật hiện vật và tìm kiếm rỗng | Không được vô tình đổi/xóa; test cần định vị từng status, tránh strict-mode vì thêm status mới. |
| `CollectionPage.tsx:76–85` | Lỗi list/detail đã dùng `role="alert"` và nút `Thử lại` | Giữ thông báo lỗi; không nói “đang tải” khi request đã lỗi. |
| `front-end/src/hooks/useMuseumRooms.ts:4–27` | Hai React Query `rooms` / `room`; `room` `enabled: !!selectedRoom`; danh sách theo `room` param; có invalidation khi refresh | Khi chưa có `selectedRoom`, không được hiểu `room.isPending` (query disabled) là đang tải chi tiết. |
| `front-end/tests/collection.spec.ts:66–80, 120–149, 179–195` | Có gate API, test skeleton, empty/error/retry/room switch | Mở rộng test sẵn có; không tạo duplicate suite hoặc đổi selectors pills. |
| `front-end/src/pages/client/HomeFeaturedExhibits.tsx`, `front-end/src/components/museum/MuseumLoading.tsx` | Đã dùng `role="status"` khi tải | Chỉ tham khảo ngôn ngữ/trạng thái; không sửa các màn hình này. |

**Đã xác nhận qua đọc source; chưa chạy browser trong lần soạn tài liệu.** Các kết quả PASS lịch sử của PR #99 không thay thế kết quả test sau khi sửa.

## 3. Thiết kế được chọn

### 3.1 Một live region ổn định, ẩn trực quan

- Đặt **một node live region duy nhất** trong `CollectionPage`, luôn tồn tại trong DOM suốt vòng đời page (kể cả khi hết loading); không đặt trong skeleton đang `aria-hidden`.
- `role="status"`, `aria-live="polite"` (role status đã hàm ý polite nhưng có thể khai báo rõ), `aria-atomic="true"`; `aria-label="Trạng thái tải bộ sưu tập"` để test truy xuất đúng vùng thay vì `getByRole('status')` mơ hồ.
- Ẩn **bằng CSS visually-hidden** (hoặc primitive Mantine tương đương đã được xác minh về HTML semantics), **không** dùng `display: none`, `visibility: hidden`, `hidden` hay `aria-hidden="true"`.
- Vùng hiện diện **rỗng tại lần render đầu**, sau mount cập nhật `textContent` khi điều kiện loading thực sự xảy ra; mục đích tăng cơ hội công nghệ hỗ trợ nhận một thay đổi trong live region đã tồn tại. Có thể dùng một `useEffect` nhỏ và state của page; không cần global store/timer.
- Chỉ một owner phụ trách status. Tránh đưa cùng message sang cả `<ExhibitSkeleton>` và page, không tự focus message, không chặn Tab/mouse, không dùng `role="alert"` cho thông báo tải bình thường.

**Phác thảo logic, không phải patch đã thực thi:**

```tsx
const [loadingAnnouncement, setLoadingAnnouncement] = useState('');
useEffect(() => {
  const next = rooms.isPending
    ? 'Đang tải danh sách phòng trưng bày…'
    : selectedRoom && room.isPending
      ? `Đang tải hiện vật của phòng ${selectedRoom.name}…`
      : '';
  setLoadingAnnouncement(previous => previous === next ? previous : next);
}, [rooms.isPending, selectedRoom?.id, selectedRoom?.name, room.isPending]);

// Giữ node này tồn tại; `.srOnly` chỉ ẩn bằng kỹ thuật visually-hidden.
<p role="status" aria-live="polite" aria-atomic="true"
  aria-label="Trạng thái tải bộ sưu tập" className={classes.srOnly}>
  {loadingAnnouncement}
</p>
```

Có thể điều chỉnh đoạn code trên theo eslint/convention khi triển khai; **không thêm thông báo thành công ngay lập tức** vì kết quả/cards và các empty statuses hiện đã có, tránh lời đọc trùng. Khi request hết pending, đặt nội dung live region thành chuỗi rỗng; lỗi tiếp tục dùng `role="alert"` hiện hữu. Nếu QA screen reader cho thấy clear-only gây khó hiểu, ghi evidence rồi cân nhắc một thông báo completion **riêng và có test**; không tự mở rộng scope trước.

### 3.2 Bảng chuyển trạng thái cần bảo vệ

| Trạng thái | Live region loading | UI hiện có phải giữ |
|---|---|---|
| Mới vào `/collection`, `rooms.isPending` | `Đang tải danh sách phòng trưng bày…` | Skeleton hiển thị, `aria-hidden="true"`. |
| `rooms` thành công, `selectedRoom` hợp lệ, `room.isPending` | `Đang tải hiện vật của phòng <tên phòng>…` | Skeleton tiếp tục hiển thị, không có thẻ hiện vật chưa tải. |
| `room` tải xong | Nội dung vùng loading về rỗng | Heading/count/cards tương ứng phòng. |
| List/detail lỗi (503/schema error) | Không còn thông điệp loading cũ | Alert lỗi + `Thử lại`; không có dữ liệu giả hoặc stale. |
| `rooms` trả `[]` | Nội dung vùng loading về rỗng | Empty-state `role="status"` riêng. |
| URL `room=unknown` | Không có thông điệp tải detail vô hạn | Alert `Phòng được chọn...`; không fetch room không hợp lệ. |
| Đổi phòng A → B, B pending | Chỉ thông báo đang tải hiện vật **B** | B pill pressed, A cards không xuất hiện trong B. |
| Refetch nền khi đã có `detail` | Không bổ sung live message giống hệt `Đang cập nhật hiện vật…` | Giữ `<p role="status">Đang cập nhật hiện vật…</p>` hiện hữu. |
| Thao tác search/keyboard không fetch mới | Không phát loading announcement | Filter pills, search, report, focus giữ nguyên. |

**Quan trọng:** `room.isPending` trên query disabled không có nghĩa là đang tải; chỉ dùng khi `rooms` đã success và `selectedRoom` tồn tại. Với API rất nhanh hoặc cache-hit không cần cưỡng ép thông báo; test pending dùng fixture delay có kiểm soát.

### 3.3 DOM, CSS và test selectors

- Nếu tạo `.srOnly` tại `CollectionPage.module.css`, dùng mẫu visually hidden quen thuộc: positioned 1px, clip/clip-path, overflow hidden, white-space nowrap, border 0. Không dùng `display:none`.
- Lý tưởng live region được đặt gần đầu `<Container>`, tách khỏi `aria-hidden` của skeleton và giữ nguyên giữa các nhánh render.
- Các test hiện dùng `page.getByRole('status')` cho empty-list, no-result hoặc refetch sẽ không còn unique khi có live region cố định. **Cập nhật đúng những assertion này** bằng status cụ thể, text hoặc scope; không xóa các kiểm chứng empty/error cũ.
- Không dùng `page.getByText('Đang tải ...')` toàn cục vì vùng visually hidden vẫn có text DOM; target bằng `getByRole('status', { name: 'Trạng thái tải bộ sưu tập' })` và đối chiếu nội dung.

## 4. File map (tối thiểu)

| File | Loại | Dự kiến |
|---|---|---|
| `front-end/src/pages/client/CollectionPage.tsx` | **Sửa chính** | Giữ live region ổn định và ánh xạ loading list/detail theo React Query. |
| `front-end/src/pages/client/CollectionPage.module.css` | **Có thể sửa** | Thêm lớp visually hidden nếu không dùng utility sẵn có. |
| `front-end/tests/collection.spec.ts` | **Sửa chính** | Viết RED/GREEN loading states, cập nhật locators `role=status` cũ, hồi quy invalid/error/search/switch. |
| `front-end/tests/accessibility-keyboard.spec.ts` | **Chạy regression; chỉ sửa nếu bug thật** | Bảo vệ focus/Tab/skip link; không đổi behavior hiện có. |
| `front-end/tests/exhibit-detail.spec.ts`, `tour-2d-fallback.spec.ts`, `public-report-modal.spec.ts` | **Chạy regression** | Bảo vệ luồng public đã triển khai. |
| `docs/tasks/public-a11y-loading.md` | **Ghi evidence** | Kết quả thực thi, PASS/FAIL/SKIP, manual QA. |
| `docs/plans/accessibility-checklist.md` | **Chỉnh tối thiểu khi đã có evidence** | Cập nhật mục status messages/phạm vi Collection, không tự đổi mọi tiêu chí thành PASS. |

Không sửa backend, CMS Admin, `ExhibitSkeleton` markup, routes hay API fixtures trừ khi tái hiện và chứng minh cần thiết. Không thêm runtime dependency.

## 5. Chiến lược TDD và phân chia thực thi

### Task 0 — Baseline + phạm vi

1. Fetch `origin/dev`, ghi SHA, kiểm working tree; tạo `fix/public-a11y-loading` từ HEAD mới; đọc `docs/architecture/fe/coding-conventions.md`.
2. Chạy focused test hiện có `collection.spec.ts` (hoặc ít nhất loading/error/room-switch) để biết trạng thái trước sửa; lưu log/trace nếu fail.
3. Chụp DOM snapshot khi API đang pending: skeleton `aria-hidden`, không có status thông báo loading ban đầu; không đánh test là RED nếu chưa thực chạy.

### Task 1 — Viết bài kiểm thử RED

1. Dùng `installMuseumApi`, `fulfillMuseum`, `roomSummaries`, `roomA`, `roomB` và Promise-gated `page.route` (mẫu đã có trong `collection.spec.ts:66–80`).
2. Assert **duy nhất một live region theo accessible name** tồn tại trước, trong và sau khi tải; role/status polite/atomic, không `aria-hidden`.
3. Gate `/api/rooms` → assert message tải danh sách + skeleton; release list → gate `/api/rooms/sculpture` → assert message tải phòng + skeleton; release detail → region rỗng + 5 cards.
4. Thêm RED cho switch phòng A→B khi API chậm; focus không bị chuyển về region; không stale cards.
5. Giữ điều kiện old empty/error assertions riêng để không bị strict locator; test lỗi `role="alert"`, retry, unknown room, refetch.
6. Ghi chính xác RED trước sửa (assertion, log, screenshot nếu cần), không bypass assertion.

### Task 2 — Thực thi thay đổi nhỏ nhất

1. Tạo live region trên CollectionPage, cập nhật theo trạng thái `rooms`/`room` và `selectedRoom`.
2. Thêm visually-hidden styling nếu chưa có primitive phù hợp; giữ skeleton ẩn khỏi screen reader.
3. Không trigger thông báo cho `isFetching` khi đã có dữ liệu; không đặt auto-focus lên status; không sửa business logic.
4. Chạy lại focused test để đạt GREEN, kiểm lint và TypeScript.

### Task 3 — Regression & QA accessibility

1. Chạy toàn bộ `collection.spec.ts`, `accessibility-keyboard.spec.ts` cùng các suite public bị ảnh hưởng.
2. Xác minh loading, lỗi, empty-state, keyboard navigation, fallback, report đều không regress; test ở viewport 320px và desktop, light/dark nếu có thay đổi style đáng kể.
3. **Kiểm tra thủ công nếu có screen reader**: NVDA/Windows hoặc VoiceOver/macOS/iOS, ghi môi trường và câu được đọc. Không có thiết bị/công cụ thì ghi **NOT TESTED** cho bước thủ công; DOM assertions **không chứng minh** phát âm thực tế hay chứng nhận WCAG.
4. Nếu phát hiện message nói lặp vô lý, điều chỉnh điều kiện/cấu trúc trong phạm vi và kiểm chứng lại.

### Task 4 — Quality gates, evidence, bàn giao

1. Chạy typecheck, lint, unit, production build và focused/affected Playwright với log exit code rõ ràng.
2. Cập nhật acceptance, execution matrix trong TASK; bổ sung mục status messages ở accessibility checklist sau khi có evidence.
3. Xác minh `git diff --check`, chỉ thay file phạm vi; không commit artifacts, screenshots nhạy cảm hay DB data.
4. Chỉ push/PR theo chỉ thị; PR dự kiến `fix/public-a11y-loading` → `dev`.

## 6. Lệnh verification dự kiến

Chạy từ `front-end/` với npm, dùng `npm.cmd` trên Windows khi PowerShell chặn `npm.ps1`:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build

# Focused RED/GREEN và regression, chạy trên fixture public API
npx playwright test tests/collection.spec.ts --reporter=line
npx playwright test tests/accessibility-keyboard.spec.ts tests/exhibit-detail.spec.ts tests/tour-2d-fallback.spec.ts tests/public-report-modal.spec.ts --reporter=line
```

Muốn dùng bản preview production: chạy `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort` ở terminal khác, đặt `PLAYWRIGHT_PREVIEW=1`, để `CI` trống cho Playwright tái sử dụng server. **Không bật `MUSEUM_LIVE_TEST=1`** cho fixture gate. Repo từng ghi nhận Playwright Windows teardown treo khi tự dừng Vite; nếu tái diễn, dùng preview mở riêng và ghi rõ lệnh/evidence thực tế.

Không chạy migration, seed hoặc ghi database. `npm run lint` ở mốc PR #104 đã 0 errors nhưng còn 1 warning cũ; phân biệt exit code và warning. Không tuyên bố test PASS nếu chưa chạy.

## 7. Gate bàn giao / Definition of Done

- [ ] Initial list pending và selected room detail pending đều có thông báo lịch sự, đúng ngữ cảnh, qua **một live region ổn định**.
- [ ] Skeleton UI vẫn hiển thị và có `aria-hidden="true"`; không duplicate announcements.
- [ ] Success/empty/error/retry/invalid room/refetch/room switch không giữ thông báo tải sai hay lẫn dữ liệu phòng cũ.
- [ ] Không thay URL/search/report/keyboard focus; không tự mở 3D/Canvas.
- [ ] TDD có evidence RED → GREEN; assertions `role="status"` cũ được cập nhật theo ngữ nghĩa mới, không bị bỏ qua.
- [ ] Required quality gates PASS trên code cuối; mọi hạn chế/suite không chạy được ghi rõ.
- [ ] Manual screen-reader QA: ghi PASS/FAIL/NOT TESTED riêng, không đánh đồng với DOM semantics.
- [ ] Tài liệu nghiệm thu phản ánh đúng kết quả, chỉ sửa tối thiểu frontend public; không push/PR/merge ngoài yêu cầu.

## 8. Gợi ý commit và review

- `docs(a11y): plan accessible collection loading`
- `test(a11y): reproduce missing collection loading status`
- `fix(a11y): announce collection loading state`
- `test(a11y): cover loading transitions and regressions`
- `docs(a11y): record public loading verification`

**Review trọng tâm:** role status **luôn tồn tại**, không nằm trong skeleton `aria-hidden`, đúng message theo pending state, không duplicate status khi refetch, và không làm lỗi các tests cũ vốn dùng `getByRole('status')` không có scope.
