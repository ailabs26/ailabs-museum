# Báo cáo MOB-E6-04 — Render phòng + nhiều hiện vật (Gallery Slots)

**Trạng thái:** READY_FOR_REVIEW *(chờ kiểm chứng hiển thị trực quan phòng 5 bục trên thiết bị iOS/Android & reviewer độc lập)*  
**Người thực hiện:** Nguyễn Trọng Thành (TV4 — 3D & AR Engine)  
**Nhánh:** `feat/mob-e6-04-room-gallery-slots` (base stacked: `feat/mob-e6-02-glb-loader-cache` @ `6ffa1f98`)  
**Ngày cập nhật:** 20/11/2026

## Nội dung đã thực hiện

- [`mobile/src/features/scene3d/museumTypes.ts`](../../../../mobile/src/features/scene3d/museumTypes.ts): hằng số hình học phòng `14×16×5 m`, kích thước bục vật lý (`centerpieceRadius: 1.22`, `roundRadius: 0.76`, `squareWidth: 1.15`), mốc `ARTIFACT_BASE_Y = 1.14` và kiểu dữ liệu `MuseumDisplay` / `PublicRoomPayload` đồng bộ web.
- [`mobile/src/features/scene3d/gallerySlots.ts`](../../../../mobile/src/features/scene3d/gallerySlots.ts): port hoàn chỉnh `GALLERY_SLOTS` (`S01..S05`), `matchGallerySlot` (sai số 5 cm), `resolveGalleryLayout` (`slotted` vs `legacy`), `snapDisplaysToSlots`, `isDisplayOutsideRoom` và `mapRoomDisplays` (sắp xếp theo `displayOrder`, fallback ngôn ngữ `vi`).
- [`mobile/src/features/scene3d/roomModelManager.ts`](../../../../mobile/src/features/scene3d/roomModelManager.ts): quản lý tải đa GLB theo phòng với hàng đợi giới hạn đồng thời (`maxConcurrent = 2`), gộp trùng `checksumSha256`, cô lập lỗi từng hiện vật và giải phóng GPU `disposeModel` khi rời phòng.
- [`mobile/src/features/scene3d/GalleryRoomComponents.tsx`](../../../../mobile/src/features/scene3d/GalleryRoomComponents.tsx): `MuseumRoomShell3D` (vỏ phòng + ánh sáng Heritage Warm), `GalleryPedestal3D` (`hero`/`standard`/`square`), `ExhibitPlaceholder3D` và `GalleryRoomDisplays3D` (hỗ trợ cả `slotted` lẫn `legacy`, clone instance an toàn khi nhiều bục chung GLB).
- [`mobile/src/features/scene3d/GalleryRoomView.tsx`](../../../../mobile/src/features/scene3d/GalleryRoomView.tsx) và [`mobile/app/room/[slug].tsx`](../../../../mobile/app/room/[slug].tsx): màn phòng 3D hoàn chỉnh kèm chuyển đổi nhanh sang danh sách 2D dễ tiếp cận và thẻ hiện vật đang chọn.

## Kiểm chứng của người thực hiện

| Điều kiện / lệnh | Môi trường | Kết quả | Bằng chứng |
|---|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Linux, Node v26.3.0 | PASS | 0 lỗi TypeScript strict |
| `npm run lint` (`eslint .`) | Linux, ESLint 9.39.5 | PASS | 0 lỗi, 0 cảnh báo |
| `npm test -- --coverage` | Jest + RNTL | PASS | Toàn bộ 12 suites pass (bổ sung `gallerySlots.test.ts`, `roomModelManager.test.ts`, `GalleryRoomView.test.tsx`) |
| Kiểm thử tải đa GLB song song & dọn GPU | `roomModelManager.test.ts` | PASS | 5 hiện vật (2 trùng checksum, 1 lỗi 404) -> chỉ tải 4 lần, `peakActive <= 2`, lỗi 404 cô lập, `disposeModel` gọi đúng 3 lần khi rời phòng |
| `npx expo export --platform ios` & `android` | Metro + Hermes | PASS | Bundle thành công cả iOS & Android (`4.34 MB` `.hbc`) |
| Kiểm tra trực quan phòng 5 bục trên iOS/Android thật | Chưa có máy thật trên Linux | PENDING_DEVICE | Cần kiểm thử Dev Client vào `/room/demo-room` và phòng staging thật |

## Tự rà soát (Self-Review)

- Khớp từng tọa độ `S01..S05`, `ARTIFACT_BASE_Y = 1.14`, và quy tắc fallback `legacy` 1:1 với `front-end/src/helpers/gallerySlots.ts`.
- Đảm bảo clone phân cấp `scene.clone(true)` khi render nhiều hiện vật dùng chung checksum GLB trong cùng 1 phòng để Three.js không tự tách node khỏi bục trước đó.
- Luôn có chế độ danh sách 2D ngang hàng với 3D cho người dùng screen reader hoặc máy không hỗ trợ GL.

## Validation và review độc lập

**Reviewer:** Chưa có  
**Trạng thái review:** Chờ review PR và nghiệm thu trực quan trên máy thật.
