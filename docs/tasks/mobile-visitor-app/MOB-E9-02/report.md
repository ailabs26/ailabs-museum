# Báo cáo MOB-E9-02 — Đặt model hiện vật lên mặt phẳng AR + xoay / zoom

**Trạng thái:** READY_FOR_REVIEW *(chờ kiểm chứng nhận diện mặt phẳng & cử chỉ 2 ngón trên máy iOS/Android thật & reviewer độc lập)*  
**Người thực hiện:** Nguyễn Trọng Thành (TV4 — 3D & AR Engine)  
**Nhánh:** `feat/mob-e9-02-ar-plane-placement` (base stacked: `feat/mob-e9-01-ar-spike` @ `e504c01f`)  
**Ngày cập nhật:** 20/11/2026

## Nội dung đã thực hiện

- [`mobile/src/features/ar/arPlacementMath.ts`](../../../../mobile/src/features/ar/arPlacementMath.ts):
  - Máy trạng thái `arPlacementReducer` (`scanning → plane_detected → placed → reposition`), chặn tọa độ NaN/Infinity.
  - Chuẩn hóa cử chỉ Viro `onPinch` & `onRotate` theo 3 pha (`START/MOVE/END`) lưu `pinchBaseScale`/`rotateBaseDeg` để không bao giờ bị nhân dồn kích thước hay giật góc xoay.
  - Kẹp biên tỷ lệ `[0.25, 2.5]`, chuẩn hóa góc xoay `[0, 360)` và `computeArModelTransform` để đặt đáy GLB khít mặt phẳng AR.
- [`mobile/src/features/ar/arModelSource.ts`](../../../../mobile/src/features/ar/arModelSource.ts): `prepareArGlbSource` kết nối trực tiếp bộ cache cục bộ + `validateGlb` + SHA-256 của `MOB-E6-02` để cấp URI cục bộ cho `Viro3DObject` (`type="GLB"`).
- [`mobile/src/features/ar/ArArtifactPlacementView.tsx`](../../../../mobile/src/features/ar/ArArtifactPlacementView.tsx) & [`mobile/app/ar-exhibit.tsx`](../../../../mobile/app/ar-exhibit.tsx): quét & chạm đặt trên mặt phẳng ngang qua `ViroARPlaneSelector`, điều khiển xoay/phóng 2 ngón + thanh nút tiếp cận 1 tay (`-`, `+`, `↺`, `↻`, `Đặt lại`, `Đổi chỗ`), có sẵn slot mở rộng cho `MOB-E9-03`.

## Kiểm chứng của người thực hiện

| Điều kiện / lệnh | Môi trường | Kết quả | Bằng chứng |
|---|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Linux, Node v26.3.0 | PASS | 0 lỗi TypeScript strict |
| `npm run lint` (`eslint .`) | Linux, ESLint 9.39.5 | PASS | 0 lỗi, 0 cảnh báo |
| `npm test -- --coverage` | Jest + RNTL | PASS | 20/20 suites pass (bổ sung `arPlacementMath.test.ts` & `ArArtifactPlacementView.test.tsx`) |
| Kiểm thử tích hợp tệp GLB thật của backend từ cache `MOB-E6-02` | `ArArtifactPlacementView.test.tsx` | PASS | Đọc trực tiếp file `.glb` thật từ `back-end/public/media/uploads/models/` qua cache với 0 HTTP call, đặt lên mặt phẳng, pinch/rotate ổn định, reset & đổi chỗ sạch |
| `npx expo export --platform ios` & `android` | Metro + Hermes | PASS | Bundle thành công cả iOS & Android |
| Thử đặt trên mặt bàn/sàn thật (ARKit & ARCore) | Chưa có máy thật trên Linux | PENDING_DEVICE | Cần kiểm chứng trên 1 iPhone ARKit + 1 Android ARCore qua EAS Dev Client |

## Tự rà soát (Self-Review)

- Đã tránh lỗi phổ biến nhất của ViroReact (`scale * scaleFactor` ở mọi sự kiện MOVE gây bùng nổ tỷ lệ theo hàm mũ) bằng cách ghi nhớ `pinchBaseScale` tại pha `gestureState === 1` và kiểm chứng 10 khung MOVE liên tiếp trong `arPlacementMath.test.ts`.
- Mọi thao tác xoay/phóng đều có nút rời tương đương kích thước ≥ 44×44 px hỗ trợ người dùng một tay và VoiceOver/TalkBack.

## Validation và review độc lập

**Reviewer:** Chưa có  
**Trạng thái review:** Chờ review PR và kiểm chứng mặt phẳng thực tế trên máy thật.
