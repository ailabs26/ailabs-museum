# MOB-E9-03 — Hotspot Overlay trong AR

**Trạng thái thực tế:** xem [report.md](report.md) · **SP:** 5 · **Phase:** P4 · **Owner:** TV4 — Nguyễn Trọng Thành  
**Phụ thuộc:** `MOB-E9-02`, `MOB-E7-01` *(đồng bộ hợp đồng dữ liệu hotspot từ `front-end/src/helpers/{artifactHotspots,hotspotStory}.ts` để khớp ngay khi TV5 merge `MOB-E7-01`)*  
**Nguồn:** [`docs/plans/261118-mobile-expo-visitor-app/task-breakdown.md`](../../../plans/261118-mobile-expo-visitor-app/task-breakdown.md)

## Yêu cầu triển khai

1. Chuyển đổi tọa độ hotspot nguồn của hiện vật sang không gian cục bộ AR (`arHotspots.ts`: `resolveArHotspots`), bù kích thước vùng chạm marker khi phóng to/thu nhỏ (`computeArMarkerRadius`), tạo hotspot mặc định khi hiện vật không có hotspot và lọc tọa độ NaN/vượt biên an toàn.
2. Render các marker hotspot 3D (`ViroSphere` + nhãn `ViroText`) gắn trên hiện vật đã đặt trong AR (`ArHotspotSceneMarkers`) với sự kiện chạm `onClick`.
3. Hiển thị lớp phủ HUD thuyết minh trên màn hình (`ArHotspotHudOverlay`): thanh chip chọn nhanh cho VoiceOver/TalkBack, thẻ nội dung (`accessibilityLiveRegion="polite"`), chỉ báo tiến độ `Điểm k / N` và điều hướng `Trước / Tiếp / Đóng`.
4. Tích hợp vào `ArExhibitExperienceView` và màn `/ar-exhibit`.

## Tiêu chí nghiệm thu (AC)

- Chạm hotspot trực tiếp trong không gian AR hoặc qua thanh chip tiếp cận đều mở đúng thuyết minh và giữ nguyên trạng thái khi người dùng phóng to/xoay mô hình.
- `typecheck`, `lint`, `jest --coverage` và Metro Hermes iOS/Android đều xanh.
