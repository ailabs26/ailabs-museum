# Báo cáo MOB-E9-01 — Spike thư viện AR (`@reactvision/react-viro`) iOS + Android

**Trạng thái:** READY_FOR_REVIEW *(chờ EAS Development Build và kiểm chứng thực tế trên iPhone ARKit + Android ARCore & reviewer độc lập)*  
**Người thực hiện:** Nguyễn Trọng Thành (TV4 — 3D & AR Engine)  
**Nhánh:** `feat/mob-e9-01-ar-spike` (base stacked: `feat/mob-e6-08-3d-perf-tiers` @ `c62c70bf`)  
**Ngày cập nhật:** 20/11/2026

## Quyết định kỹ thuật Spike (Rủi ro R1 & R12)

- **Thư viện chọn:** `@reactvision/react-viro@2.43.3` (tương thích chính thức Expo SDK 52 `~52.0.43`, `react-native@0.76.9` và New Architecture `newArchEnabled: true` qua Fabric Interop).
- **Phát hiện thực tế khi chạy Metro export:** Bản `2.43.1` thiếu file `./ViroEventsManager` trong `fabric-interop/dist/` gây lỗi Metro bundler; đã phát hiện qua `npx expo export` và nâng khóa sang bản hotfix `2.43.3` chuyên biệt cho Expo SDK 52 + RN `0.76.9`.
- **Cấu hình Expo Plugin:** Đã tích hợp `withViro` tại [`mobile/app.config.ts`](../../../../mobile/app.config.ts) với `android.xRMode: ['AR']` (chỉ ARCore, loại bỏ GVR để giảm kích thước APK) và `ios.cameraUsagePermission` tiếng Việt phục vụ store review.
- **Lưu ý triển khai:** AR native **không chạy trong Expo Go** — yêu cầu `npx eas build --profile development` (hoặc `npx expo prebuild` + Xcode/Android Studio). App đã có kiểm tra năng lực tự động để không crash trên Expo Go / Simulator / thiết bị không hỗ trợ ARCore.

## Nội dung đã thực hiện

- [`mobile/src/features/ar/arCapability.ts`](../../../../mobile/src/features/ar/arCapability.ts): kiểm tra nền tảng (iOS 15+ ARKit, Android API 26+ ARCore), thiết bị thật vs máy ảo, và tồn tại native Viro view manager / JSI.
- [`mobile/src/features/ar/arBridge.ts`](../../../../mobile/src/features/ar/arBridge.ts): cầu nối tải lười `@reactvision/react-viro` và ánh xạ `ViroTrackingStateConstants` sang thông báo tiếng Việt.
- [`mobile/src/features/ar/ArSpikeView.tsx`](../../../../mobile/src/features/ar/ArSpikeView.tsx) & [`mobile/app/spike-ar.tsx`](../../../../mobile/app/spike-ar.tsx): dựng phiên `ViroARSceneNavigator` đặt 1 mô hình AR thử nghiệm kèm HUD tracking và màn hình fallback rõ ràng sang phòng 3D khi thiếu AR.

## Kiểm chứng của người thực hiện

| Điều kiện / lệnh | Môi trường | Kết quả | Bằng chứng |
|---|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Linux, Node v26.3.0 | PASS | 0 lỗi TypeScript strict |
| `npm run lint` (`eslint .`) | Linux, ESLint 9.39.5 | PASS | 0 lỗi, 0 cảnh báo |
| `npm test -- --coverage` | Jest + RNTL | PASS | 18/18 suites, 64/64 tests pass (`ArSpikeView.tsx` 100% Lines/Funcs) |
| `npx expo config --type introspect` | Expo Config Plugin `withViro` | PASS | Plugin chạy sạch, sinh `NSCameraUsageDescription` tiếng Việt cho iOS và cấu hình ARCore cho Android |
| `npx expo export --platform ios` & `android` | Metro + Hermes | PASS | Bundle thành công cả iOS & Android kèm `@reactvision/react-viro` |
| Đặt 1 model AR trên iOS + Android thật | Chưa có tài khoản EAS / máy thật trên Linux | PENDING_DEVICE | Cần EAS Dev Build (`MOB-E1-05`) cài trên 1 iPhone (ARKit) + 1 Android hỗ trợ ARCore để mở `/spike-ar` |

## Tự rà soát (Self-Review)

- Khóa đúng bản `2.43.1` (tránh bản `3.x` yêu cầu Expo 58 + React 19 sẽ gãy build SDK 52).
- Tải lười `@reactvision/react-viro` trong `try/catch` giúp toàn bộ app 2D/3D vẫn mở bình thường kể cả trong Expo Go hoặc máy Android không cài Google Play Services for AR.

## Validation và review độc lập

**Reviewer:** Chưa có  
**Trạng thái review:** Chờ review PR và kiểm chứng Dev Client trên 2 thiết bị iOS + Android thật.
