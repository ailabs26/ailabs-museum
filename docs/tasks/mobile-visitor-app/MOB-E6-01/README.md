# MOB-E6-01 — Spike `@react-three/fiber/native` + `expo-gl` render 1 cube

**Trạng thái thực tế:** xem [report.md](report.md) · **SP:** 3 · **Phase:** P3 (Spike sớm từ P0) · **Owner:** TV4 — Nguyễn Trọng Thành  
**Phụ thuộc:** `MOB-E1-01` (đã merge vào `origin/dev` qua PR #205)  
**Nguồn:** [`docs/plans/261118-mobile-expo-visitor-app/task-breakdown.md`](../../../plans/261118-mobile-expo-visitor-app/task-breakdown.md)

## Yêu cầu triển khai

1. Pin phiên bản tương thích với Expo SDK 52 (`expo@~52.0.0`, `react@18.3.1`, `react-native@0.76.5`):
   - `expo-gl@~15.0.5`, `expo-asset@~11.0.5`
   - `three@0.166.1`, `@types/three@0.166.0` (khớp peerDependency của `expo-three@8.0.0`)
   - `@react-three/fiber@8.17.10` (tương thích React 18, đồng bộ web)
2. Cấu hình `mobile/metro.config.js` hỗ trợ `.cjs`, `.mjs`, `.glb`, `.gltf`, `.bin`.
3. Dựng khung cảnh 3D tối thiểu render 1 khối lập phương xoay mượt kèm ánh sáng, theo dõi FPS / frame time (p95, khung rớt >16.7ms), tôn trọng OS Reduce Motion, tự tạm dừng khi app vào nền (`AppState`), và bọc `Scene3DErrorBoundary` để không crash khi thiết bị không hỗ trợ GL.
4. Thêm route `/spike-3d` trong Expo Router để kiểm thử trực tiếp trên dev client.

## Tiêu chí nghiệm thu (AC)

- Cube xoay 60 FPS trên thiết bị thật (iOS & Android).
- `npm run typecheck`, `npm run lint`, `npm test` xanh; Metro đóng gói production bundle cho cả iOS và Android thành công không lỗi resolver.
- Màn hình không crash khi GL lỗi (fallback 2D + nút thử lại) và dừng xoay khi bật Giảm chuyển động.
