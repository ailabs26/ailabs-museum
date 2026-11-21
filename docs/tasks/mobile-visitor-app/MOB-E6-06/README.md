# MOB-E6-06 — Va chạm + Navigation Path trong phòng 3D

**Trạng thái thực tế:** xem [report.md](report.md) · **SP:** 5 · **Phase:** P3 · **Owner:** TV4 — Nguyễn Trọng Thành  
**Phụ thuộc:** `MOB-E6-05`  
**Nguồn:** [`docs/plans/261118-mobile-expo-visitor-app/task-breakdown.md`](../../../plans/261118-mobile-expo-visitor-app/task-breakdown.md)

## Yêu cầu triển khai

1. Xây dựng hệ thống va chạm chính xác cho cả phòng chuẩn `slotted` (5 bục `S01..S05`, bục trống vẫn chắn đường) và phòng `legacy` (`getDisplayColliders`, `getGallerySlotColliders`, `getGalleryColliders` có hỗ trợ `exceptId`).
2. Chống xuyên tường/bục (tunneling) bằng `moveWithCollisions` chia bước nhỏ 8 cm và trượt mượt dọc cạnh trên từng trục X/Z độc lập.
3. Xây dựng bộ tìm đường không va chạm `findNavigationPath` bằng visibility graph + Dijkstra quanh các góc bục mở rộng kết hợp kiểm tra đoạn thẳng quét chính xác (`isNavigationSegmentSafe`), tự giải thoát camera kẹt (`findSafeNavigationPoint`), và lập lộ trình ngắm hiện vật (`planExhibitFocusRoute`, `sampleFocusRoute`).
4. Tích hợp vào `TouchCameraController` và `GalleryRoomView` (nút "Đến gần" dẫn camera vòng quanh bục tới trước hiện vật, tự hủy ngay khi người dùng chạm tay).

## Tiêu chí nghiệm thu (AC)

- Camera không bao giờ xuyên tường hay hiện vật (kể cả bước nhảy lớn, trượt chéo và lộ trình tự động).
- Kiểm chứng đi được quanh cả 4 mặt của 5 bục từ lối vào mà mọi điểm lấy mẫu đều an toàn.
- `typecheck`, `lint`, `jest --coverage` và Metro Hermes iOS/Android đều xanh.
