# Báo cáo MOB-E6-05 — Camera Controller Touch (Port `museumNavigation`)

**Trạng thái:** READY_FOR_REVIEW *(chờ kiểm chứng cảm giác xoay/vuốt trực tiếp trên thiết bị iOS/Android & reviewer độc lập)*  
**Người thực hiện:** Nguyễn Trọng Thành (TV4 — 3D & AR Engine)  
**Nhánh:** `feat/mob-e6-05-camera-touch-nav` (base stacked: `feat/mob-e6-04-room-gallery-slots` @ `01ada6e5`)  
**Ngày cập nhật:** 20/11/2026

## Nội dung đã thực hiện

- [`mobile/src/features/scene3d/museumNavigation.ts`](../../../../mobile/src/features/scene3d/museumNavigation.ts): port hoàn chỉnh toán học điều hướng từ web (`NAVIGATION`, `getJoystickVector`, `applyLook`, `NavigationGestures`, `getMuseumFov`, `computePinchStep`, `stepMovement` tích phân mũ độc lập 30–120 FPS, kẹp delta lớn khi app trở lại từ nền).
- [`mobile/src/features/scene3d/TouchCameraController.tsx`](../../../../mobile/src/features/scene3d/TouchCameraController.tsx): vòng lặp `useFrame` điều khiển `PerspectiveCamera` mượt theo `Euler('YXZ')` không roll, tự điều chỉnh FOV cho màn hình dọc mobile, hỗ trợ `reducedMotion` và xử lý lệnh nút rời `CameraAction`.
- [`mobile/src/features/scene3d/TouchNavigationHud.tsx`](../../../../mobile/src/features/scene3d/TouchNavigationHud.tsx): lớp cảm ứng `PanResponder` (1 ngón xoay, 2 ngón chụm/tách dolly, cần joystick ảo dead-zone 12% + thanh nút rời 44×44 px cho VoiceOver/TalkBack).
- Tích hợp vào [`mobile/src/features/scene3d/GalleryRoomView.tsx`](../../../../mobile/src/features/scene3d/GalleryRoomView.tsx) kèm tự dừng input qua `AppState` khi app vào nền và chặn chọn nhầm hiện vật khi đang kéo camera (`navGestures.canSelect`).

## Kiểm chứng của người thực hiện

| Điều kiện / lệnh | Môi trường | Kết quả | Bằng chứng |
|---|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Linux, Node v26.3.0 | PASS | 0 lỗi TypeScript strict |
| `npm run lint` (`eslint .`) | Linux, ESLint 9.39.5 | PASS | 0 lỗi, 0 cảnh báo |
| `npm test -- --coverage` | Jest + RNTL | PASS | 14/14 suites pass (bổ sung `museumNavigation.test.ts`, `TouchCameraController.test.tsx`) |
| `npx expo export --platform ios` & `android` | Metro + Hermes | PASS | Bundle thành công cả iOS & Android |
| Thử nghiệm cảm giác chạm 1/2 ngón & joystick trên máy thật | Chưa có máy thật trên Linux | PENDING_DEVICE | Cần kiểm thử trên Dev Client iOS + Android để tinh chỉnh độ nhạy nếu cần |

## Tự rà soát (Self-Review)

- Giữ nguyên toàn bộ công thức tích phân vận tốc hàm mũ và dead-zone joystick từ web để cảm giác di chuyển nhất quán giữa 30 Hz, 60 Hz và 120 Hz ProMotion.
- `NavigationGestures` dùng ngưỡng 5 px và hủy chọn ngay khi chạm ngón thứ 2 để thao tác pinch/drag không kích hoạt chọn hiện vật ngoài ý muốn.
- Mọi nút rời trên HUD đều đạt vùng chạm tối thiểu `44×44` và có `accessibilityLabel` tiếng Việt rõ ràng.

## Validation và review độc lập

**Reviewer:** Chưa có  
**Trạng thái review:** Chờ review PR và kiểm thử cảm ứng thực tế trên thiết bị.
