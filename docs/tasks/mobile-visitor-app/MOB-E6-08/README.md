# MOB-E6-08 — Chất lượng 3D theo năng lực thiết bị (Performance Tiers)

**Trạng thái thực tế:** xem [report.md](report.md) · **SP:** 5 · **Phase:** P3 · **Owner:** TV4 — Nguyễn Trọng Thành  
**Phụ thuộc:** `MOB-E6-04`  
**Nguồn:** [`docs/plans/261118-mobile-expo-visitor-app/task-breakdown.md`](../../../plans/261118-mobile-expo-visitor-app/task-breakdown.md)

## Yêu cầu triển khai

1. Xây dựng 3 tầng cấu hình chất lượng 3D (`low` / `balanced` / `high`) điều chỉnh DPR (`1.0 / 1.5 / 2.0`), đổ bóng (`off / 1024 / 2048`), antialias, số phân đoạn hình học (`16 / 24 / 32`), số GLB tải đồng thời (`1 / 2 / 3`), giới hạn cache (`64 / 150 / 256 MB`) và đèn phụ.
2. Phân loại phần cứng tự động qua `expo-device` (`totalMemory`, `deviceYearClass`, `isDevice`) + kích thước màn hình: máy yếu (RAM ≤ 4 GB, đời ≤ 2019, màn ≤ 360dp, emulator) tự khởi chạy ở `low`.
3. Bộ điều khiển thích ứng thời gian thực `AdaptiveQualityController` có trễ chống dao động (hysteresis): tự hạ tầng khi FPS < 26 hoặc p95 > 42 ms liên tiếp 3 cửa sổ và hỗ trợ người dùng chọn tay `Auto / Thấp / Cân bằng / Cao`.
4. Tích hợp vào `GalleryRoomView`, `MuseumRoomShell3D`, `GalleryPedestal3D` và `RoomModelManager`.

## Tiêu chí nghiệm thu (AC)

- Máy yếu tự động giảm chất lượng đồ họa & số luồng tải đồng thời, vẫn chạy mượt không crash.
- `typecheck`, `lint`, `jest --coverage`, và Metro Hermes iOS/Android đều xanh.
