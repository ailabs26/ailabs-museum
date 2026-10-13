# Aura Museum Web

Frontend của bảo tàng WebXR, dùng React, TypeScript và Vite. Three.js được tích hợp qua React Three Fiber để scene 3D có thể chia thành component React; Three.js trực tiếp chỉ dùng ở nơi cần API renderer, loader hoặc WebXR cấp thấp.

## Trạng thái hiện tại

Ứng dụng đã có router public/admin và các màn hình quản trị. Tour Day 2 chạy tại `/tour` hoặc `/tour.html`: tải phòng và hiện vật đã xuất bản từ NestJS API, chọn phòng, catalogue DOM và scene R3F với camera orbit/ánh sáng/fallback Day 1. Backend hiện trả media null nên scene dùng hình khối thay thế có nhãn. GLB, audio, tương tác và WebXR chưa được triển khai. Một số file museum khác vẫn là scaffold; không dùng file rỗng làm convention.

Quy tắc đặt tên nằm tại [docs/coding-conventions.md](docs/coding-conventions.md). Thành viên và AI agent phải đọc tài liệu đó trước khi thêm code mới.

## Chạy local

Yêu cầu Node.js 20+.

```sh
cd front-end
npm install
npm run dev
```

Vite mặc định chạy tại `http://localhost:5173`.

Sao chép `.env.example` thành `.env.local` nếu cần chỉnh API URL. Mặc định frontend gọi `http://localhost:3001/api`; backend phải chạy với `.env` hợp lệ và `FRONTEND_ORIGIN=http://localhost:5173`. Frontend không kết nối database/storage trực tiếp. Không commit `.env`; không tự chạy migration/seed để cung cấp nội dung test.

## Quality gates hiện có

```sh
npm run typecheck
npm run lint
npm run build
```

Browser smoke tests dùng Playwright:

```sh
npm test
```

Windows mặc định dùng Edge đã cài. Trên hệ điều hành khác, cài Chromium bằng `npx playwright install chromium`; có thể chọn browser channel qua `PLAYWRIGHT_CHANNEL`. Tests dùng software WebGL (SwiftShader), không thay thế kiểm thử GPU/điện thoại thật. Ảnh desktop/mobile nằm trong `test-results/` sau bài `gallery resizes`.

Kiểm tra bản build bằng PowerShell:

```powershell
npm.cmd run build
$env:PLAYWRIGHT_PREVIEW = '1'
$env:CI = '1'
npm.cmd test
Remove-Item Env:PLAYWRIGHT_PREVIEW
Remove-Item Env:CI
```

Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` cho các lệnh trên. Test server dùng cổng 4173; dừng server cũ ở cổng này trước khi đổi giữa dev và preview.

Các test mặc định dùng fixture công khai khớp `ExhibitsService`, không chứng minh database thật có phòng/hiện vật. Test live được bỏ qua mặc định. Để kiểm tra backend thật đang chạy (không mock, không migration/seed), dừng Vite cũ ở cổng 5173 rồi chạy:

```powershell
$env:MUSEUM_LIVE_TEST = '1'
$env:CI = '1'
npm.cmd test -- museum-live.spec.ts
Remove-Item Env:MUSEUM_LIVE_TEST
Remove-Item Env:CI
```

Live test chạy frontend trên `http://localhost:5173` để khớp CORS local hiện có. Nếu API trả `[]`, test chỉ chứng minh trạng thái rỗng; cần nội dung đã xuất bản để kiểm chứng phòng/hiện vật live.

## Hiện vật nổi bật trên trang chủ

- Trang `/` lấy phòng đầu tiên theo danh sách API, sắp xếp hiện vật theo `displayOrder` rồi ID và hiển thị tối đa 3 mục. Đây là quy tắc giới thiệu tạm thời, chưa phải cờ nổi bật trong CMS.
- Phòng đầu rỗng thì báo rỗng; không tải các phòng khác để điền đủ 3 thẻ. Có 1–2 mục thì hiển thị đúng số lượng; giữ nguyên nhãn mẫu và nội dung từ API.
- Thẻ dùng chung `ExhibitGrid` với collection; media null hiển thị **Chưa có ảnh**. Link **Xem bộ sưu tập của phòng này** giữ slug qua URL. Hero/giới thiệu vẫn đọc được khi API lỗi; có trạng thái tải/lỗi/rỗng và thử lại, không thay bằng demo fallback.
- Tests: `npm.cmd test -- home-featured.spec.ts collection.spec.ts public-tour-navigation.spec.ts`. Live API: bật `MUSEUM_LIVE_TEST=1`, chạy `npm.cmd test -- home-featured-live.spec.ts`, rồi bỏ biến. Test live không interception/seed/database writes; khi API rỗng chỉ chứng minh trạng thái rỗng.
- Task/plan: [home-featured-exhibits.md](../docs/tasks/home-featured-exhibits.md), [home-featured-exhibits-plan.md](../docs/plans/home-featured-exhibits-plan.md).

## Bộ sưu tập 2D

- Mở `/collection` hoặc `/collection?room=<slug>`. Chọn phòng để đọc tên/mô tả hiện vật đã xuất bản qua cùng API public của tour.
- Lựa chọn được giữ trong URL; liên kết **Tham quan phòng này trong 3D** mở tour đúng phòng. Trang collection không tải scene hoặc Canvas.
- API chưa trả ảnh: thẻ hiển thị **Chưa có ảnh**, không đoán URL storage hoặc tạo ảnh giả. Danh sách, số lượng và thứ tự lấy từ API, không giới hạn cứng 5.
- Đang tải, không có phòng/hiện vật, lỗi/schema không hợp lệ và retry có trạng thái riêng; **Làm mới** cập nhật nội dung. API lỗi không được thay bằng mẫu.
- Focused tests: `npm.cmd test -- collection.spec.ts public-tour-navigation.spec.ts`. API thật (cần backend đang chạy và dữ liệu seed): đặt `MUSEUM_LIVE_TEST=1`, chạy `npm.cmd test -- collection-live.spec.ts`, rồi bỏ biến môi trường. Live collection test không mock hoặc ghi database, yêu cầu phòng lịch sử quân sự và 5 hiện vật mẫu đã seed.
- Task/plan: [client-collection.md](../docs/tasks/client-collection.md), [client-collection-plan.md](../docs/plans/client-collection-plan.md).

## Tham quan Day 2

- Mở `/tour.html`, chọn phòng rồi **Mở phòng 3D**. Scene chỉ tải sau thao tác này; **Dừng 3D** tháo Canvas. `?room=<slug>` hỗ trợ mở trực tiếp một phòng; **Làm mới** cập nhật danh sách/chi tiết, **Thử lại** xử lý lỗi.
- Kéo chuột/vuốt để orbit, cuộn/chụm hai ngón để zoom. Khi Canvas có focus: mũi tên hoặc WASD xoay, +/− zoom, Home reset; Tab ra ngoài. Có nút reset/zoom bằng DOM.
- Shell kín 14 × 16 × 5 m chưa có kích thước riêng từ backend. Số hiện vật, tên, mô tả, hình khối, màu và vị trí đến từ phòng đang chọn. Camera orbit có giới hạn; chưa có đi bộ tự do hay tương tác hiện vật.
- Geometry nhẹ, không tải model/texture bên ngoài, render theo nhu cầu, DPR tối đa 1.5. Không bật shadow maps/postprocessing. Giảm chuyển động tắt quán tính camera.
- Scene lỗi hoặc mất context vẫn giữ catalogue DOM. Sau lỗi tải chunk, tải lại trang nếu muốn thử tải module lại.
- `GET /api/rooms` là array không phân trang; `GET /api/rooms/:slug` trả chi tiết kèm `exhibits`. `museum.service.ts` dùng Axios client chung và Zod kiểm tra envelope/payload/identity; `useMuseumRooms` dùng React Query + AbortSignal. Chỉ tải phòng đang chọn, cache theo ID/slug; không preload phòng/asset khác hoặc thay lỗi API bằng mẫu.
- Vị trí backend giữ nguyên; thiếu toàn bộ tọa độ dùng layout xác định theo displayOrder + ID. Hiện vật nằm ngoài shell giữ thông tin trong DOM, có thông báo riêng và không dựng geometry ngoài phòng. Tọa độ sai/thiếu một phần bị từ chối.
- Media public hiện luôn `model/image/audio: null`. Không tự dựng URL từ storageKey hoặc coi hình khối thay thế là model thật. Phòng/danh sách rỗng, lỗi, phòng không hợp lệ và chuyển phòng đều có trạng thái riêng; nội dung phòng cũ không xuất hiện sau lỗi/chuyển chọn.

Tiến độ, lịch sử commit và giới hạn: [museum-tour-progress.md](../docs/museum-tour-progress.md).

## Cấu trúc

- `src/`: application source theo layered hybrid architecture.
- `public/`: static file cần URL cố định.
- `docs/`: tài liệu frontend, bao gồm coding convention.
- `tests/`: dành cho test ngoài source khi test strategy được chốt; không tạo placeholder.
- `tools/`: script/tooling nội bộ khi có nhu cầu thật; không tạo placeholder.

Xem [coding-conventions.md](docs/coding-conventions.md) để biết quy tắc đặt tên.

## Phạm vi kiến trúc đã chốt

- Frontend chỉ gọi NestJS API; không kết nối Supabase/PostgreSQL/Storage trực tiếp.
- API response phải được Zod kiểm tra trước khi dùng.
- Nội dung hiện vật đến từ CMS qua API.
- DOM accessible/fallback là phần bắt buộc song song với scene 3D và WebXR.
- Không tuyên bố tính năng hoặc kết quả kiểm thử đã hoàn thành nếu code/bằng chứng chưa tồn tại.
