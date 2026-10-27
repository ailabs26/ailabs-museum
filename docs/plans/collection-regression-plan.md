# Collection Regression — Implementation Plan

> **Trạng thái:** Đã duyệt ngày 26/10/2026; đang triển khai trên `test/collection-regression`.
>
> **Task & acceptance:** [collection-regression.md](../tasks/collection-regression.md)

**Mục tiêu:** Khôi phục độ tin cậy của Playwright regression cho giao diện `/collection` sau Aura Design System 2.0, nơi `NativeSelect` đã được thay bằng **filter pills** (`<button aria-pressed>`), có **live search** và **loading skeleton**. Không chỉnh sửa UI production chỉ để khớp assertion cũ; phải phân biệt test lỗi thời với hồi quy UX/a11y thực tế.

**Repository:** `ailabs26/ailabs-museum` — khảo sát `dev` tại `89119dfb43702357c6028fd0ef232d72d6a97a72` ngày 26/10/2026. Khi bắt đầu triển khai phải fetch và ghi SHA `origin/dev` thực tế, không mặc định SHA khảo sát còn mới.

**Nhánh đề xuất:** `test/collection-regression` từ `origin/dev` mới nhất; PR vào `dev`, **không tạo/push/merge PR tự động**.

**Stack:** React 18, React Router 6, Mantine 7, TanStack Query, TypeScript, Playwright. Tái sử dụng fixture và project Chromium hiện tại; không thêm dependency.

## 1. Source of truth & vấn đề đã xác nhận

### UI hiện tại

- `front-end/src/pages/client/CollectionPage.tsx:51–73`: `role="group"` với `aria-label="Chọn phòng trưng bày"` bao `button` theo `room.name`, mỗi nút có `aria-pressed` khi đang chọn. Thao tác chọn cập nhật `?room=<slug>` qua `useSearchParams`, giữ query parameters khác và reset từ khóa search.
- `CollectionPage.tsx:65–68, 88–107`: ô **Tìm kiếm hiện vật** lọc client-side theo `name + description` (trim + lowercase), thông báo kết quả `<filtered>/<total>`, empty search và danh sách public. Trang không dựng Canvas 3D.
- `CollectionPage.tsx:75–86`: trạng thái loading được thể hiện bằng `ExhibitSkeleton`; `front-end/src/shared/components/feedback/ExhibitSkeleton.tsx` là `<ul aria-hidden="true">`, **không có text `role="status"`**. Đây có thể là khoảng trống thông báo loading cho công nghệ hỗ trợ, không được âm thầm xóa assertion để bỏ qua.
- `front-end/src/hooks/useMuseumRooms.ts`: danh sách phòng public và room detail dùng React Query; kiểm soát phòng hợp lệ; detail chỉ dùng khi rooms + room success, tránh nội dung của phòng trước.

### Assertions cũ không còn phản ánh UI

- `front-end/tests/collection.spec.ts`: các bài chọn phòng/invalid room/switch/keyboard vẫn dùng `getByLabel('Chọn phòng trưng bày').selectOption(...)` và `toHaveValue(...)`; filter pills là `<button>`, không phải `<select>`.
- `collection.spec.ts`: test keyboard còn giả định `ArrowDown` như native select; phải đổi sang `Tab`, `Enter` và `Space` của button, không mô phỏng listbox không tồn tại.
- `collection.spec.ts`: các test loading mong `getByRole('status').toHaveText('Đang tải ...')`, nhưng trang hiện dùng skeleton ẩn với screen reader; cần chẩn đoán thực tế, phân loại test drift **và** accessibility gap riêng.
- `front-end/tests/exhibit-detail.spec.ts` (D05): sau khi trở về `/collection?room=<slug>` vẫn assert giá trị của `<select>` cũ; đổi sang kiểm tra nút phòng `aria-pressed`.
- `front-end/tests/tour-2d-fallback.spec.ts` (F04): sau khi fallback sang **Collection** vẫn assert `<select>`; cập nhật assertion tại trang đích. **Giữ nguyên** `selectOption(...)` của `/tour`, vì `MuseumPage.tsx` vẫn dùng `NativeSelect` cho chọn phòng trong tour.
- Các suite liên quan (`public-report-modal.spec.ts`, `home-featured.spec.ts`, `public-tour-navigation.spec.ts`, `collection-live.spec.ts`) cần regression, không đổi bừa vì tên selector tương tự.

> Những vấn đề trên được rút ra từ **đọc source**; cần chạy browser tests để ghi RED/PASS thực tế. Không tuyên bố kết quả runtime khi chưa chạy.

## 2. Nguyên tắc thiết kế test

1. **Theo accessible role/name thay vì CSS class/DOM giả định:** `page.getByRole('group', { name: 'Chọn phòng trưng bày' }).getByRole('button', { name: roomB.name, exact: true })`. Khẳng định `aria-pressed="true"/"false"`; không dùng `toHaveValue` cho button.
2. **Bảo tồn hành vi đúng hiện tại:** filter pills không có ArrowDown native select; test Enter/Space và thứ tự Tab tự nhiên. Không thêm Arrow navigation giả chỉ để pass nếu không phải UX đã duyệt.
3. **Test URL/ngữ cảnh:** chọn phòng giữ các search params khác, reload khôi phục phòng, Back/Forward theo history; link `/tour?room=<slug>`, và quay về từ 2D detail/WebGL fallback.
4. **Test dữ liệu thật của UI:** card hiển thị thứ tự `displayOrder`/ID; không cần Canvas; filtered list/name/description/count/empty-state; chọn phòng reset search; state invalid room/error/retry/delayed API không render stale cards.
5. **Không làm yếu accessibility assertions:** với loading skeleton hiện tại, điều tra việc không có accessible status. Nếu xác nhận là hồi quy a11y và trong phạm vi nhỏ, đề xuất bổ sung một status ẩn trực quan (ví dụ `role="status"` với text đúng) ở page, giữ skeleton; cần test RED và phê duyệt. Nếu scope chỉ tests, ghi blocker/issue riêng, **không tự đánh PASS**.
6. **Không dựa vào text dễ đổi nếu semantic đủ:** ưu tiên role, accessible name, count, heading, URL, error role, `aria-pressed`. Với nghiệp vụ thông báo trống/lỗi vẫn kiểm tra nội dung cần thiết.
7. **Fixtures deterministic:** tái sử dụng `installMuseumApi`, `roomSummaries`, `roomA`, `roomB`, `roomC`, `fulfillMuseum`; không dựa backend/Storage hoặc `waitForTimeout` tùy ý.
8. **Tests thất bại được phân loại:** product bug / stale assertion / fixture issue / timing-flake / environment. Không xóa case để đạt số PASS.

### Gợi ý locator (minh họa, không phải code đã triển khai)

```ts
const roomGroup = page.getByRole('group', { name: 'Chọn phòng trưng bày' });
const sculpture = roomGroup.getByRole('button', { name: roomA.name, exact: true });
const ceramics = roomGroup.getByRole('button', { name: roomB.name, exact: true });
await expect(sculpture).toHaveAttribute('aria-pressed', 'true');
await ceramics.click();
await expect(ceramics).toHaveAttribute('aria-pressed', 'true');
await expect(sculpture).toHaveAttribute('aria-pressed', 'false');
```

Chỉ tách helper test nhỏ nếu thực sự lặp nhiều lần; không tạo abstraction lớn chỉ để thay một selector.

## 3. Hợp đồng nghiệm thu

| ID | Tình huống | Kết quả bắt buộc |
|---|---|---|
| C1 | Vào `/collection` mặc định | Room đầu tiên có button pressed, đúng cards đã xuất bản, không Canvas/chunk 3D |
| C2 | Click room B | URL giữ params khác, `room=ceramics`, đúng heading/cards/count, A false/B true |
| C3 | Reload + Back/Forward | Phòng pressed khớp URL, không giữ cards phòng trước |
| C4 | Keyboard | Tab đến pill; Enter và Space chọn phòng; focus visible, không dùng ArrowDown kiểu select |
| C5 | URL room không hợp lệ | Thông báo lỗi, không request room unknown; pill hợp lệ khôi phục được |
| C6 | API pending đổi phòng | Không hiện cards stale; có loading semantics có thể truy cập (nếu UX requirement) |
| C7 | API lỗi/schema lỗi/retry | Không demo substitution; alert/retry đúng, phục hồi dữ liệu public |
| C8 | Search theo tên + mô tả | Case-insensitive, trim; count filtered/total, không gọi thêm API; empty search rõ ràng |
| C9 | Chuyển room sau search | Xóa search query UI, danh sách phòng mới đầy đủ, URL vẫn đúng |
| C10 | Home/collection → detail → collection | Trở về đúng room, đúng pill pressed và history không bị sai |
| C11 | Tour WebGL fallback → collection | Trang đích có đúng pill pressed, heading focus; không sửa select của `/tour` |
| C12 | 320/375/768/1024/1440 + light/dark | Pills, search, cards, button/focus không tràn ngang hoặc bị cắt; no Canvas |
| C13 | Public report trên card | Nút mở đúng modal và không regress revision payload |

## 4. File map & giới hạn chỉnh sửa

| File | Hành động | Lý do |
|---|---|---|
| `front-end/tests/collection.spec.ts` | **Chính: sửa + bổ sung** | Pills, loading, search, URL, keyboard, responsive |
| `front-end/tests/exhibit-detail.spec.ts` | **Sửa chọn lọc** | D05 return-to-collection asserts pressed button |
| `front-end/tests/tour-2d-fallback.spec.ts` | **Sửa chọn lọc** | F04 khi về `/collection` asserts pressed button; tour vẫn dùng NativeSelect |
| `front-end/tests/public-report-modal.spec.ts` | **Chạy regression** | Report action trên ExhibitGrid |
| `front-end/tests/home-featured.spec.ts` | **Chạy regression** | Shared ExhibitGrid, link và ảnh |
| `front-end/tests/public-tour-navigation.spec.ts` | **Chạy regression** | Tour navigation/no Canvas |
| `front-end/tests/collection-live.spec.ts` | **Optional read-only** | API thật; không thuộc required fixture gate |
| `front-end/tests/fixtures/museumApi.ts`, `museumContent.ts` | **Chỉ nếu RED do fixture** | Dùng data deterministic, tránh chỉnh seed tùy tiện |
| `front-end/src/pages/client/CollectionPage.tsx` | **Không đổi mặc định** | Chỉ động đến khi repro bug UX/a11y rõ, review scope trước |
| `front-end/src/shared/components/feedback/ExhibitSkeleton.tsx` | **Không đổi mặc định** | Nếu thiếu loading announcement, quyết định fix riêng có test |
| `docs/plans/collection-regression-plan.md` | **Tạo** | Kiến trúc & verification |
| `docs/tasks/collection-regression.md` | **Tạo** | SPEC, checklist và execution evidence |

Không sửa `MuseumPage`, 3D renderer/camera/WebXR, backend, database, API contract, public report logic hay Design System ngoài phạm vi. Không thêm dependencies, không đổi đường dẫn route hoặc đổi tên files hàng loạt.

## 5. TDD & execution strategy

### Task 0 — Baseline, scope và branch

- Fetch `origin/dev`, kiểm working tree và convention, tạo `test/collection-regression`.
- Chạy riêng `collection.spec.ts` và affected `exhibit-detail` D05, `tour-2d-fallback` F04. Ghi RED/PASS/SKIP/timeout, trace/screenshot và nguyên nhân.
- Tạo commit docs sau review; không đánh dấu test pass chỉ vì source trông đúng.

### Task 1 — Restore room-pills regression

- Thay các `selectOption` / `toHaveValue` liên quan **Collection** bằng locator button qua group `Chọn phòng trưng bày` và `aria-pressed`.
- Viết case click/keyboard/reload/unknown-room/slow room switch; kiểm query params, link tour và không stale cards.
- Giữ tests xử lý tour NativeSelect không đổi; chạy focused GREEN và ghi evidence.

### Task 2 — Loading, search & responsive

- Chẩn đoán skeleton vs old loading-text assertions bằng thực chạy; không loại bỏ hoàn toàn loading/a11y checks.
- Thêm test search name/description, trim/case, count, no-result, reset on room change và không request ngoài dự kiến.
- Test light/dark và viewport: 320/375/768/1024/1440; check overflow, focus-visible, pressed state; screenshot khi phát hiện visual issue.
- Nếu phát hiện lỗi product thật, tách thành issue/đề xuất fix tối thiểu sau review, không tự nâng scope.

### Task 3 — Cross-page regressions

- Sửa D05 (`exhibit-detail.spec.ts`) và F04 destination (`tour-2d-fallback.spec.ts`) ở đoạn vào **Collection**.
- Chạy `public-report-modal`, `home-featured`, `public-tour-navigation`, `accessibility-keyboard` subset liên quan và `tour-exhibit-deep-link` để bảo vệ deep link đã merge.
- Phân loại các suite liên quan nhưng fail sẵn (scene/Tab focus/F04 timeout) không vì thay đổi test Collection.

### Task 4 — Verification và handoff

- Chạy focused → affected suite → wider browser suite nếu thời gian/môi trường cho phép; tối thiểu không để các test sửa bị fail.
- Chạy typecheck, unit, build, targeted ESLint các test sửa; `npm run lint` toàn frontend và ghi trung thực lỗi nền (không claim PASS khi FAIL).
- Review `git diff --check`, chỉ commit docs/test được duyệt; ghi execution ledger trong TASK, commit SHA, counts và unresolved failures. Dừng trước PR.

## 6. Lệnh thực thi (trong `front-end/`)

```bash
# Baseline / focused
npx playwright test tests/collection.spec.ts --reporter=line
npx playwright test tests/exhibit-detail.spec.ts -g '\[D05\]' --reporter=line
npx playwright test tests/tour-2d-fallback.spec.ts -g '\[F04\]' --reporter=line

# Affected browser regressions
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/tour-2d-fallback.spec.ts tests/public-report-modal.spec.ts tests/home-featured.spec.ts tests/public-tour-navigation.spec.ts tests/tour-exhibit-deep-link.spec.ts --reporter=line

# Quality gates
npm run typecheck
npm run test:unit
npm run build
npx eslint tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/tour-2d-fallback.spec.ts
npm run lint
```

Trên PowerShell có thể thay `npm` bằng `npm.cmd`; trong Windows, các pattern `-g` nên dùng dấu nháy kép. Playwright mặc định chạy fixture trên `127.0.0.1:4173`; không bật `MUSEUM_LIVE_TEST` cho suite fixture. Test live chỉ opt-in khi backend/dữ liệu đã sẵn sàng, read-only; không seed/migrate vào DB dùng chung.

**Baseline lint đã biết từ tài liệu trước:** full lint ghi nhận 37 lỗi nền trong tests/scripts và warning ngoài diff. Đây không phải kết quả chạy lần này; cần ghi kết quả mới.

## 7. Quy tắc evidence / Definition of Done

- Không còn assertion `selectOption` / `toHaveValue` trên room chooser **của Collection** (các `NativeSelect` thật ở Tour hoặc modal giữ nguyên).
- Các test sửa chính đều có lần chạy PASS thực sự, không skip không lý do; URL, pressed-state, focus/keyboard, search, loading, fallback và report đã được kiểm tra.
- Nếu thiếu accessible loading status hoặc có bug production khác: có repro và quyết định scope minh bạch, **không sửa test để che lỗi**.
- Typecheck/unit/build/targeted lint: có kết quả thực tế; full lint báo PASS/FAIL và số lỗi, không giấu lỗi nền.
- Không sửa backend/DB/CMS/scene, không thay UI để khớp test; không tạo PR/merge tự động.

**Commit gợi ý:** `docs(test): plan collection regression`, `test(collection): align room filters with pills`, `test(collection): cover search loading and keyboard`, `test(collection): update navigation regressions`, `docs(test): record collection verification`.
