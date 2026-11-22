# MOB-E9-01 — Spike thư viện AR (`@reactvision/react-viro`) trên iOS + Android

**Trạng thái thực tế:** xem [report.md](report.md) · **SP:** 8 · **Phase:** P4 (Spike sớm sau `E1-05`) · **Owner:** TV4 — Nguyễn Trọng Thành  
**Phụ thuộc:** `MOB-E1-05` *(EAS Development Build config có sẵn ở `eas.json`; cần tài khoản EAS + máy thật để build native)*  
**Nguồn:** [`docs/plans/261118-mobile-expo-visitor-app/task-breakdown.md`](../../../plans/261118-mobile-expo-visitor-app/task-breakdown.md)

## Yêu cầu triển khai

1. Đánh giá và khóa phiên bản `@reactvision/react-viro@2.43.3` tương thích Expo SDK 52 (`expo@~52.0.0`), React Native `0.76.9` và New Architecture (`newArchEnabled: true` — Fabric Interop).
2. Cấu hình Expo Config Plugin `@reactvision/react-viro` trong `mobile/app.config.ts` với `android.xRMode: ['AR']` (ARCore only, không kéo theo GVR) và `ios.cameraUsagePermission` tiếng Việt phục vụ store review.
3. Xây dựng lớp kiểm tra năng lực phần cứng `arCapability.ts` (iOS 15+ ARKit, Android API 26+ ARCore, thiết bị thật, native Viro runtime) và cầu nối tải lười `arBridge.ts` để app không crash trên Expo Go / Simulator / thiết bị không hỗ trợ AR.
4. Xây dựng màn hình Spike AR (`ArSpikeView` + route `/spike-ar`) đặt 1 mô hình AR thử nghiệm kèm HUD tracking và đường lùi về phòng 3D.

## Tiêu chí nghiệm thu (AC)

- Đặt được 1 model AR trên cả iOS (ARKit) và Android (ARCore) qua Dev Client.
- Expo config plugin `withViro` chạy sạch qua `npx expo config --type introspect`.
- `typecheck`, `lint`, `jest --coverage`, và Metro Hermes iOS/Android đều xanh; thiết bị không hỗ trợ AR hiển thị fallback rõ ràng.
