# Báo cáo MOB-E6-06 — Va chạm + Navigation Path trong phòng 3D

**Trạng thái:** READY_FOR_REVIEW *(chờ kiểm chứng di chuyển va chạm trên thiết bị iOS/Android & reviewer độc lập)*  
**Người thực hiện:** Nguyễn Trọng Thành (TV4 — 3D & AR Engine)  
**Nhánh:** `feat/mob-e6-06-collision-nav-path` (base stacked: `feat/mob-e6-05-camera-touch-nav` @ `f53c04d7`)  
**Ngày cập nhật:** 20/11/2026

## Nội dung đã thực hiện

- [`mobile/src/features/scene3d/museumCollision.ts`](../../../../mobile/src/features/scene3d/museumCollision.ts):
  - `getDisplayColliders`, `getGallerySlotColliders`, `getGalleryColliders` (hỗ trợ cả `slotted` 5 bục S01..S05 lẫn `legacy`, hỗ trợ `exceptId`).
  - `isNavigationPositionSafe`, `findSafeNavigationPoint` (tự đẩy camera ra biên gần nhất nếu vị trí bị chiếm bởi hiện vật mới).
  - `isNavigationSegmentSafe` (slab intersection chính xác), `findNavigationPath` (visibility graph + Dijkstra quanh góc bục mở rộng).
  - `moveWithCollisions` (sub-stepping 8 cm chống tunneling + trượt cạnh độc lập theo trục X/Z).
  - `planExhibitFocusRoute` & `sampleFocusRoute` (chọn điểm ngắm an toàn qua 3 vòng × 24 góc và tính lộ trình đa giác không va chạm).
- Cập nhật [`mobile/src/features/scene3d/TouchCameraController.tsx`](../../../../mobile/src/features/scene3d/TouchCameraController.tsx) dùng `moveWithCollisions` mặc định, tự giải thoát camera kẹt khi collider đổi, chạy chuyển động theo lộ trình focus và tự hủy ngay khi người dùng chạm tay.
- Cập nhật [`mobile/src/features/scene3d/GalleryRoomView.tsx`](../../../../mobile/src/features/scene3d/GalleryRoomView.tsx) cấp `getGalleryColliders(displays)` và bổ sung nút **Đến gần** dẫn camera vòng quanh bục tới trước hiện vật đang chọn.

## Kiểm chứng của người thực hiện

| Điều kiện / lệnh | Môi trường | Kết quả | Bằng chứng |
|---|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Linux, Node v26.3.0 | PASS | 0 lỗi TypeScript strict |
| `npm run lint` (`eslint .`) | Linux, ESLint 9.39.5 | PASS | 0 lỗi, 0 cảnh báo |
| `npm test -- --coverage` | Jest + RNTL | PASS | 15/15 suites pass (bổ sung `museumCollision.test.ts` & kịch bản focus/rescue trong `TouchCameraController.test.tsx`) |
| Kiểm tra không xuyên bục & đường đi 4 mặt 5 bục | `museumCollision.test.ts` | PASS | Chống tunneling bước 10 m, trượt tường, 4 mặt của 5 bục S01..S05 đi tới được từ lối vào `(0, 5.8)` với 100 điểm lấy mẫu/đoạn đều an toàn |
| `npx expo export --platform ios` & `android` | Metro + Hermes | PASS | Bundle thành công cả iOS & Android (`4.37 MB` `.hbc`) |
| Kiểm chứng thực tế trên máy iOS/Android | Chưa có máy thật trên Linux | PENDING_DEVICE | Cần kiểm tra bằng thao tác kéo joystick trực diện vào tường & bục S01 trên Dev Client |

## Tự rà soát (Self-Review)

- Các biên collider của bục S01 `[-1.47, 1.47, -3.47, -0.53]` khớp từng chữ số thập phân với `front-end/src/helpers/gallerySlots.test.ts`.
- Khi người dùng chạm màn hình hoặc đẩy joystick giữa lúc camera đang tự động đi đến hiện vật, lộ trình tự động lập tức hủy và đồng bộ góc nhìn (`Euler YXZ`) để không giật camera.

## Validation và review độc lập

**Reviewer:** Chưa có  
**Trạng thái review:** Chờ review PR và kiểm chứng cảm giác va chạm thực tế trên máy thật.
