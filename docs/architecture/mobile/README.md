# Mobile 3D & AR Engine — tài liệu kỹ thuật (TV4)

> Phạm vi: phần **3D Engine (E6)** và **AR (E9)** của app visitor `mobile/` (Expo + React Native).
> Người thực hiện: Nguyễn Trọng Thành (TV4 — 3D & AR Engine).
> Kế hoạch gốc: [`docs/plans/261118-mobile-expo-visitor-app/task-breakdown.md`](../../plans/261118-mobile-expo-visitor-app/task-breakdown.md).

Tài liệu này mô tả **code đang chạy trên `dev`** — kiến trúc, luồng dữ liệu, hằng số quan trọng và
cách kiểm thử — để người khác (TV5 hotspot/tour, TV1 fallback/AR exit, reviewer) đọc là dùng được
mà không phải dò từng file.

## Task đã làm

| ID | Task | Code chính | Báo cáo |
|---|---|---|---|
| MOB-E6-01 | Spike r3f/native + expo-gl, đo FPS | `scene3d/SpinningCubeScene.tsx`, `fpsMeter.ts`, `Scene3DErrorBoundary.tsx` | [report](../../tasks/mobile-visitor-app/MOB-E6-01/report.md) |
| MOB-E6-02 | Tải GLB + kiểm tra nhị phân + cache | `glbSchema.ts`, `glbValidation.ts`, `glbCache.ts`, `glbLoader.ts` | [report](../../tasks/mobile-visitor-app/MOB-E6-02/report.md) |
| MOB-E6-04 | Render phòng + nhiều hiện vật (gallery slots) | `gallerySlots.ts`, `roomModelManager.ts`, `GalleryRoom*.tsx` | [report](../../tasks/mobile-visitor-app/MOB-E6-04/report.md) |
| MOB-E6-05 | Camera cảm ứng (port `museumNavigation`) | `museumNavigation.ts`, `TouchCameraController.tsx`, `TouchNavigationHud.tsx` | [report](../../tasks/mobile-visitor-app/MOB-E6-05/report.md) |
| MOB-E6-06 | Va chạm + tìm đường trong phòng | `museumCollision.ts` | [report](../../tasks/mobile-visitor-app/MOB-E6-06/report.md) |
| MOB-E6-08 | Chất lượng 3D theo thiết bị | `performanceTier.ts`, `useSceneQuality.ts` | [report](../../tasks/mobile-visitor-app/MOB-E6-08/report.md) |
| MOB-E9-01 | Spike AR (`@reactvision/react-viro`) | `ar/arCapability.ts`, `arBridge.ts`, `ArSpikeView.tsx` | [report](../../tasks/mobile-visitor-app/MOB-E9-01/report.md) |
| MOB-E9-02 | Đặt hiện vật lên mặt phẳng + xoay/zoom | `arPlacementMath.ts`, `arModelSource.ts`, `ArArtifactPlacementView.tsx` | [report](../../tasks/mobile-visitor-app/MOB-E9-02/report.md) |
| MOB-E9-03 | Hotspot overlay trong AR | `arHotspots.ts`, `ArHotspotOverlay.tsx`, `ArExhibitExperienceView.tsx` | [report](../../tasks/mobile-visitor-app/MOB-E9-03/report.md) |

Đường dẫn code tính từ `mobile/src/features/`.

## Sơ đồ module

```text
app/(tabs)/rooms.tsx ──► app/room/[slug].tsx ──► GalleryRoomView ──(nút "Xem trong AR")──► app/ar-exhibit.tsx
                               │                       │                                        │
                        usePublicRoom            RoomModelManager                     ArExhibitExperienceView
                        publicRoomApi            ├─ loadGlbModel (E6-02)                ├─ ArArtifactPlacementView (E9-02)
                        mapRoomDisplays          │   ├─ glbSchema / glbValidation       │   ├─ arCapability / arBridge (E9-01)
                        (gallerySlots)           │   └─ glbCache (LRU, SHA-256)  ◄──────┤   └─ prepareArGlbSource
                                                 ├─ TouchCameraController (E6-05)       └─ ArHotspotOverlay (E9-03)
                                                 │   └─ museumCollision (E6-06)              └─ arHotspots
                                                 └─ useSceneQuality (E6-08) ◄─ FpsMeter (E6-01)
```

Hai nhánh 3D và AR **dùng chung một lớp cache GLB và một bộ kiểm tra nhị phân** — một hiện vật đã
xem trong phòng 3D mở AR không phải tải lại.

## Mục lục

| # | Tài liệu | Nội dung |
|---|---|---|
| 01 | [01-glb-pipeline.md](01-glb-pipeline.md) | Hợp đồng model công khai, kiểm tra nhị phân GLB, cache LRU, pipeline tải và mã lỗi |
| 02 | [02-room-rendering.md](02-room-rendering.md) | Gallery Template 5 bục, ánh xạ payload `/rooms/:slug`, tải nhiều hiện vật song song |
| 03 | [03-navigation-collision.md](03-navigation-collision.md) | Điều khiển cảm ứng, va chạm, tìm đường visibility graph, lộ trình tới hiện vật |
| 04 | [04-performance-tiers.md](04-performance-tiers.md) | Đo FPS, 3 tầng chất lượng, tự hạ/nâng tầng có hysteresis |
| 05 | [05-ar-engine.md](05-ar-engine.md) | Kiểm tra thiết bị AR, nạp Viro an toàn, máy trạng thái đặt mô hình và cử chỉ |
| 06 | [06-ar-hotspots.md](06-ar-hotspots.md) | Đổi toạ độ hotspot sang không gian AR, marker, thẻ thuyết minh |
| 07 | [07-testing-and-verification.md](07-testing-and-verification.md) | 22 file / 71 test, kết quả CI, test bị bỏ qua, việc kiểm chứng trên máy thật còn chờ |
| 08 | [08-integration-guide.md](08-integration-guide.md) | Dùng lại engine cho E6-07, E9-04 (TV1), E6-03 (TV3), E7/E8 (TV5), cache chung (TV2) |

## Nguyên tắc chung

1. **Logic thuần tách khỏi React/Three/Viro** — toán, reducer, validator là hàm thuần có unit test;
   component chỉ nối dây. Vì vậy phần lớn hành vi test được trên Linux/Jest, không cần máy thật.
2. **Đồng bộ 1:1 với web** — hằng số phòng, gallery slots, navigation, normalization được port từ
   `front-end/src/helpers/*` và giữ cùng giá trị để cảm giác Web và Mobile giống nhau.
3. **Không tin dữ liệu từ mạng** — metadata qua Zod, URL model bị khoá về origin API, nhị phân GLB
   được kiểm tra cấu trúc + SHA-256 trước khi vào `GLTFLoader`.
4. **Luôn có đường lui** — GL lỗi → 2D; AR không hỗ trợ → phòng 3D; GLB lỗi → hình placeholder.
