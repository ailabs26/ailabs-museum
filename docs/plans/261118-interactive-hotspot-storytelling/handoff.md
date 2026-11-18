# Bàn giao Interactive Hotspot Storytelling

## Chạy thử

Từ `front-end/`, chạy `npm run dev` với cấu hình API phát triển của dự án. Mở route `/tour`, chọn một phòng có hotspot đã xuất bản rồi chọn **Mở phòng 3D**. Chọn marker trên hiện vật hoặc dùng nút tương ứng trong **Điểm tương tác**. **Điểm trước** và **Điểm tiếp theo** duyệt thứ tự CMS. **Thông tin hiện vật** hoặc Escape thoát chương. Người đang tham quan có hướng dẫn có thể tiếp tục từ bước đã tạm dừng bằng nút Resume của tour.

Để chạy với dữ liệu mô phỏng, thực hiện `npm run build`, đặt `$env:PLAYWRIGHT_PREVIEW = '1'` rồi chạy `npx playwright test tests/museum-hotspot-storytelling.spec.ts` từ `front-end/`.

## Các điểm mở rộng

| Trách nhiệm | File chính |
| --- | --- |
| Xác thực lựa chọn và đồng bộ hiện vật với URL | `front-end/src/pages/MuseumPage.tsx`, `front-end/src/helpers/hotspotStory.ts` |
| Marker 3D, nút DOM và nội dung tương ứng | `front-end/src/components/museum/ArtifactHotspot.tsx`, `ArtifactHotspotControls.tsx`, `HotspotStory.tsx`, `ExhibitDetailPanel.tsx` |
| Tọa độ world, góc nhìn và quyền điều khiển camera | `front-end/src/helpers/artifactHotspots.ts`, `guidedCameraPath.ts`, `front-end/src/components/museum/MuseumControls.tsx` |
| Controller, gaze và panel trong kính | `front-end/src/components/museum/MuseumXr.tsx`, `XrDetailsPanel.tsx` |
| Dữ liệu mô phỏng và các luồng E2E | `front-end/tests/museum-hotspot-storytelling.spec.ts` |

Chương là trạng thái của phiên tham quan. URL vẫn hỗ trợ `room` và `exhibit`. Reload mở thông tin hiện vật, còn Back/Forward xóa chương khi thay đổi phòng hoặc hiện vật. Mô hình lỗi và góc nhìn không khả thi giữ quyền đọc nội dung. XR dùng điều khiển phân trang sẵn có cho nội dung dài.

## Git và phạm vi kiểm chứng

Nhánh cục bộ `feat/interactive-hotspot-storytelling` bắt đầu tại `cd0155d4756996ad6a0309f0577772e56dc3a5d8` từ `origin/dev`. Base đề xuất cho PR là `dev`. Trạng thái phát hành hiện tại chỉ gồm các commit cục bộ.

Xem [commit ledger](commit-plan.md), [kết quả kiểm chứng](verification.md) và [kế hoạch](plan.md). Edge dùng SwiftShader, API fixture và phiên WebXR mô phỏng. Việc kiểm chứng trên headset vật lý và API thực nằm ngoài lượt chạy này.
