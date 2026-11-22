# Báo cáo MOB-E6-08 — Chất lượng 3D theo năng lực thiết bị (Performance Tiers)

**Trạng thái:** READY_FOR_REVIEW *(chờ đo FPS thực tế trên máy Android phổ thông yếu + iPhone mục tiêu & reviewer độc lập)*  
**Người thực hiện:** Nguyễn Trọng Thành (TV4 — 3D & AR Engine)  
**Nhánh:** `feat/mob-e6-08-3d-perf-tiers` (base stacked: `feat/mob-e6-06-collision-nav-path` @ `b535f8a6`)  
**Ngày cập nhật:** 20/11/2026

## Nội dung đã thực hiện

- Cài đặt `expo-device@~7.0.3` (phiên bản chuẩn Expo SDK 52) để đọc thông số phần cứng thực (`totalMemory`, `deviceYearClass`, `isDevice`).
- [`mobile/src/features/scene3d/performanceTier.ts`](../../../../mobile/src/features/scene3d/performanceTier.ts):
  - 3 tầng `low` / `balanced` / `high` điều chỉnh DPR (`1 / 1.5 / 2`), shadows, antialias, phân đoạn hình học (`16 / 24 / 32`), số GLB tải đồng thời (`1 / 2 / 3`), cache max bytes và đèn phụ.
  - `resolveInitialQualityTier` + `readDeviceCapabilityHints` tự hạ máy RAM ≤ 4 GB, đời ≤ 2019, màn ≤ 360dp hoặc emulator về `low`.
  - `AdaptiveQualityController` theo dõi FPS thực tế với trễ chống dao động (hysteresis): tự hạ tầng khi FPS < 26 hoặc p95 > 42 ms liên tiếp 3 cửa sổ và hỗ trợ người dùng khóa chế độ thủ công.
- [`mobile/src/features/scene3d/useSceneQuality.ts`](../../../../mobile/src/features/scene3d/useSceneQuality.ts): React hook tích hợp vào [`GalleryRoomView.tsx`](../../../../mobile/src/features/scene3d/GalleryRoomView.tsx) & [`GalleryRoomComponents.tsx`](../../../../mobile/src/features/scene3d/GalleryRoomComponents.tsx) (`gl.setPixelRatio`, `shadows`, `geometrySegments`, `maxConcurrentGlbLoads`, nút pill chuyển `Auto / Thấp / Cân bằng / Cao`).

## Kiểm chứng của người thực hiện

| Điều kiện / lệnh | Môi trường | Kết quả | Bằng chứng |
|---|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Linux, Node v26.3.0 | PASS | 0 lỗi TypeScript strict |
| `npm run lint` (`eslint .`) | Linux, ESLint 9.39.5 | PASS | 0 lỗi, 0 cảnh báo |
| `npm test -- --coverage` | Jest + RNTL | PASS | 16/16 suites, 59/59 tests pass; All files 81.29% Lines (`performanceTier.ts` 95.31% Lines / 100% Funcs) |
| `npx expo export --platform ios` & `android` | Metro + Hermes | PASS | Bundle thành công cả iOS & Android (`4.39 MB` `.hbc`) |
| Đo đối chứng tầng `low` vs `high` trên Android yếu thật | Chưa có máy thật trên Linux | PENDING_DEVICE | Cần đo FPS + peak RAM trên máy Android 3–4 GB RAM với Dev Client |

## Tự rà soát (Self-Review)

- Phát hiện prop `dpr` của R3F web không tồn tại trên `<Canvas>` của `@react-three/fiber/native` -> chuyển sang điều khiển trực tiếp `gl.setPixelRatio(Math.min(PixelRatio.get(), dprCap))` qua `onCreated` và `useEffect` (chuẩn R3F native).
- Kiểm chứng đầy đủ hysteresis: 1 khung chậm đơn lẻ không gây giật tầng, hạ liên tiếp `high → balanced → low` khi nghẽn GPU thật, chỉ nâng lại sau cooldown và chuỗi 60 FPS ổn định.

## Validation và review độc lập

**Reviewer:** Chưa có  
**Trạng thái review:** Chờ review PR và đo hiệu năng thực tế trên thiết bị yếu.
