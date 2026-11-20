# MOB-E6-05 — Camera Controller Touch (Port `museumNavigation`)

**Trạng thái thực tế:** xem [report.md](report.md) · **SP:** 8 · **Phase:** P3 · **Owner:** TV4 — Nguyễn Trọng Thành  
**Phụ thuộc:** `MOB-E6-04`  
**Nguồn:** [`docs/plans/261118-mobile-expo-visitor-app/task-breakdown.md`](../../../plans/261118-mobile-expo-visitor-app/task-breakdown.md)

## Yêu cầu triển khai

1. Port thuần TypeScript toán học điều hướng từ web (`museumNavigation.ts`, `navigationGestures.ts`, `museumCamera.ts`): hằng số `NAVIGATION`, `getJoystickVector` (dead-zone 12%, đảo Y), `applyLook` (kẹp pitch ±1.35 rad, không roll), `stepMovement` (tích phân mũ độc lập 30–120 FPS), `NavigationGestures` (ngưỡng 5 px phân biệt tap với drag/pinch), `getMuseumFov` cho màn dọc mobile và `computePinchStep`.
2. Xây dựng `TouchCameraController` trong vòng lặp R3F `useFrame`: quán tính xoay cảm ứng, bước đi mượt, chụm/tách 2 ngón tiến lùi, lệnh điều khiển rời cho VoiceOver/TalkBack, và khớp ngay không quán tính khi OS bật Reduce Motion.
3. Xây dựng `TouchNavigationHud` với vùng vuốt 1/2 ngón, cần joystick ảo góc dưới trái và thanh nút rời ≥ 44×44 px, tích hợp trực tiếp vào `GalleryRoomView` và tự dừng khi app vào nền (`AppState`).

## Tiêu chí nghiệm thu (AC)

- Xoay nhìn và di chuyển mượt bằng cử chỉ chạm (1 ngón xoay, 2 ngón tiến/lùi, joystick ảo + nút rời tiếp cận).
- Toàn bộ bài test toán học điều hướng (FPS independence, dead-zone, pitch clamp, gesture gate) và component test xanh; Metro bundle iOS/Android xanh.
