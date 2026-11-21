# Báo cáo MOB-E6-01 — Spike `@react-three/fiber/native` + `expo-gl` render 1 cube

**Trạng thái:** READY_FOR_REVIEW *(chờ kiểm chứng FPS thực tế trên thiết bị iOS/Android & reviewer độc lập)*  
**Người thực hiện:** Nguyễn Trọng Thành (TV4 — 3D & AR Engine)  
**Nhánh:** `feat/mob-e6-01-3d-spike` (base: `origin/dev` @ `2de067bd`)  
**Ngày cập nhật:** 20/11/2026

## Nội dung đã thực hiện

- Pin dependency 3D tương thích Expo SDK 52 (`expo@~52.0.0`, `react@18.3.1`, `react-native@0.76.9`):
  - `expo-gl@~15.0.5`, `expo-asset@~11.0.5`, `expo-file-system@~18.0.12` (peerDependency runtime bắt buộc của `@react-three/fiber/native`), `three@^0.166.1`, `@types/three@^0.166.0`, `@react-three/fiber@^8.17.10`.
  - Bổ sung `query-string@^7.1.3` (khắc phục lỗi Metro không resolve được trong `expo-router@4.0.22`) và nâng `eslint-config-expo` lên `~9.2.0` để chạy được flat config ESLint 9.
- Cấu hình [`mobile/metro.config.js`](../../../../mobile/metro.config.js) thêm `cjs`/`mjs` vào `sourceExts` và `glb`/`gltf`/`bin` vào `assetExts`.
- Xây dựng module Spike 3D:
  - [`mobile/src/features/scene3d/fpsMeter.ts`](../../../../mobile/src/features/scene3d/fpsMeter.ts): bộ đo FPS / frame time / p95 / khung rớt >16.7ms & >33.3ms, tự lọc gap khi app tạm ẩn nền.
  - [`mobile/src/features/scene3d/Scene3DErrorBoundary.tsx`](../../../../mobile/src/features/scene3d/Scene3DErrorBoundary.tsx): ErrorBoundary bọc Canvas, cung cấp fallback 2D an toàn + nút thử lại.
  - [`mobile/src/features/scene3d/SpinningCubeScene.tsx`](../../../../mobile/src/features/scene3d/SpinningCubeScene.tsx): R3F Native + Expo GL render khối lập phương PBR xoay mượt, tôn trọng OS Reduce Motion, chặn cảnh báo `UNPACK_FLIP_Y_WEBGL` trên driver Expo GL.
  - [`mobile/src/features/scene3d/ThreeSpikeView.tsx`](../../../../mobile/src/features/scene3d/ThreeSpikeView.tsx): HUD FPS thời gian thực (`accessibilityLiveRegion="polite"`), điều khiển Tạm dừng/Tiếp tục/Đổi màu/Đặt lại, tự tạm dừng qua `AppState` khi app vào nền.
  - [`mobile/app/spike-3d.tsx`](../../../../mobile/app/spike-3d.tsx) + liên kết tại `mobile/app/_layout.tsx` và `mobile/app/(tabs)/rooms.tsx`.

## Kiểm chứng của người thực hiện

| Điều kiện / lệnh | Môi trường | Kết quả | Bằng chứng |
|---|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Linux, Node v26.3.0 | PASS | 0 lỗi TypeScript (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`) |
| `npm run lint` (`eslint .`) | Linux, ESLint 9.39.5 | PASS | 0 lỗi, 0 cảnh báo |
| `npm test -- --coverage` | Jest + RNTL (`jest-expo@52`) | PASS | 5/5 suites, 16/16 tests pass, 0 console warnings; `features/scene3d`: 95.16% Stmts, 95.61% Lines, 87.5% Branch |
| `npx expo export --platform ios` | Metro + Hermes | PASS | Export thành công bundle Hermes iOS (`3.99 MB`, 932 modules) |
| `npx expo export --platform android` | Metro + Hermes | PASS | Export thành công bundle Hermes Android (`3.99 MB`, 941 modules) |
| Đo 60 FPS trên thiết bị iOS + Android thật | Chưa có máy thật / emulator trên máy Linux hiện tại | PENDING_DEVICE | Chưa đánh dấu `DONE`; cần cài Dev Client và mở `/spike-3d` trên 1 iPhone + 1 Android tầm trung để ghi số đo FPS thật |

## Tự rà soát (Self-Review)

- Đã phát hiện và khắc phục 3 vấn đề thực tế trước khi commit:
  1. `eslint-config-expo@8.0.1` trên nền `dev` không có `flat.js` khiến `npm run lint` gãy ngay từ đầu -> nâng `~9.2.0` + cấu hình rule R3F JSX.
  2. `npx expo export` phát hiện thiếu `query-string` trong `expo-router@4.0.22` và thiếu `expo-file-system` bị `@react-three/fiber/native` require tĩnh ở runtime -> đã bổ sung và verify lại bundle cả iOS & Android.
  3. Loại bỏ cảnh báo `act(...)` do `useReducedMotion` resolve async trong `ThreeSpikeView.test.tsx`.
- Không có dữ liệu nhạy cảm, không sửa `back-end/` hay `front-end/`.

## Validation và review độc lập

**Reviewer:** Chưa có  
**Trạng thái review:** Chờ review PR vào `dev` và kiểm thử FPS thực tế trên thiết bị iOS/Android.
