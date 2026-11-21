# MOB-E9-02 — Đặt model hiện vật lên mặt phẳng AR + xoay / zoom

**Trạng thái thực tế:** xem [report.md](report.md) · **SP:** 8 · **Phase:** P4 · **Owner:** TV4 — Nguyễn Trọng Thành  
**Phụ thuộc:** `MOB-E9-01`, `MOB-E6-02`  
**Nguồn:** [`docs/plans/261118-mobile-expo-visitor-app/task-breakdown.md`](../../../plans/261118-mobile-expo-visitor-app/task-breakdown.md)

## Yêu cầu triển khai

1. Xây dựng máy trạng thái thuần TypeScript `arPlacementMath.ts` điều khiển luồng `scanning → plane_detected → placed → reposition` cùng thuật toán xử lý cử chỉ Viro `onPinch` / `onRotate` chuẩn 3 pha (`START/MOVE/END`), không nhân dồn sai số, kẹp biên scale `[0.25, 2.5]` và xoay tròn `[0, 360)`.
2. Tích hợp với bộ cache GLB của `MOB-E6-02` qua `arModelSource.ts` (`prepareArGlbSource`): đọc trực tiếp URI cục bộ từ `GlbCacheAdapter` sau khi thẩm định SHA-256 & `validateGlb`, fallback về hình khối nếu thiếu model hoặc lỗi tải.
3. Xây dựng `ArArtifactPlacementView` & route `/ar-exhibit`: nhận diện mặt phẳng ngang qua `ViroARPlaneSelector`, render `Viro3DObject` (`type="GLB"`), hỗ trợ thao tác 2 ngón và thanh nút 1 tay / VoiceOver/TalkBack (`-`, `+`, `↺`, `↻`, `Đặt lại`, `Đổi chỗ`).

## Tiêu chí nghiệm thu (AC)

- Đặt hiện vật GLB lên mặt phẳng ngang, xoay 360° và phóng to/thu nhỏ ổn định (không nhảy/nổ scale).
- Tái dùng cache cục bộ `MOB-E6-02` (0 request mạng khi đã có trong cache).
- `typecheck`, `lint`, `jest --coverage` và Metro Hermes iOS/Android đều xanh.
