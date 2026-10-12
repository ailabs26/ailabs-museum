# Aura Museum Web

Frontend của bảo tàng WebXR, dùng React, TypeScript và Vite. Three.js được tích hợp qua React Three Fiber để scene 3D có thể chia thành component React; Three.js trực tiếp chỉ dùng ở nơi cần API renderer, loader hoặc WebXR cấp thấp.

## Trạng thái hiện tại

Ứng dụng đã có router public/admin và các màn hình quản trị. Tour Day 1 chạy tại `/tour` hoặc `/tour.html`: phòng mẫu R3F, camera orbit, ánh sáng, catalogue DOM và fallback khi WebGL lỗi. API hiện vật, GLB và WebXR chưa thuộc phần tour này. Một số file museum khác vẫn là scaffold; không dùng file rỗng làm convention.

Quy tắc đặt tên nằm tại [docs/coding-conventions.md](docs/coding-conventions.md). Thành viên và AI agent phải đọc tài liệu đó trước khi thêm code mới.

## Chạy local

Yêu cầu Node.js 20+.

```sh
cd front-end
npm install
npm run dev
```

Vite mặc định chạy tại `http://localhost:5173`.

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
npm.cmd test
Remove-Item Env:PLAYWRIGHT_PREVIEW
```

Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` cho các lệnh trên. Test server dùng cổng 4173; dừng server cũ ở cổng này trước khi đổi giữa dev và preview.

## Tham quan mẫu Day 1

- Mở `/tour.html`, chọn **Mở phòng 3D**. Scene chỉ tải sau thao tác này; **Dừng 3D** tháo Canvas.
- Kéo chuột/vuốt để orbit, cuộn/chụm hai ngón để zoom. Khi Canvas có focus: mũi tên hoặc WASD xoay, +/− zoom, Home reset; Tab ra ngoài. Có nút reset/zoom bằng DOM.
- Phòng kín 14 × 16 × 5 m, năm hình khối minh họa. Camera orbit có giới hạn; chưa có đi bộ tự do hay tương tác hiện vật.
- Geometry nhẹ, không tải model/texture bên ngoài, render theo nhu cầu, DPR tối đa 1.5. Không bật shadow maps/postprocessing. Giảm chuyển động tắt quán tính camera.
- Scene lỗi hoặc mất context vẫn giữ catalogue DOM. Sau lỗi tải chunk, tải lại trang nếu muốn thử tải module lại.
- `MuseumScene` nhận display props; Day 2 cần xác minh DTO backend hiện tại rồi nối HTTP client + Zod. Không dùng dữ liệu mẫu để che lỗi API.

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
