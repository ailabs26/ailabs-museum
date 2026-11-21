# MOB-E6-04 — Render phòng + nhiều hiện vật (Gallery Slots)

**Trạng thái thực tế:** xem [report.md](report.md) · **SP:** 8 · **Phase:** P3 · **Owner:** TV4 — Nguyễn Trọng Thành  
**Phụ thuộc:** `MOB-E6-02`  
**Nguồn:** [`docs/plans/261118-mobile-expo-visitor-app/task-breakdown.md`](../../../plans/261118-mobile-expo-visitor-app/task-breakdown.md)

## Yêu cầu triển khai

1. Đồng bộ hoàn toàn hệ tọa độ và quy tắc bố cục Gallery Template V1 từ web (`14×16×5 m`, `ARTIFACT_BASE_Y = 1.14 m`, 5 bục `S01..S05`, sai số khớp 5 cm, fallback `legacy` giữ nguyên tọa độ tự do/trùng bục/> 5 hiện vật).
2. Xây dựng `RoomModelManager` quản lý tải nhiều GLB cùng lúc trong một phòng: gộp checksum trùng, giới hạn đồng thời (`maxConcurrent`), cô lập lỗi từng hiện vật, hủy tải và `disposeModel` sạch khi rời phòng.
3. Render vỏ phòng 3D, ánh sáng Heritage Warm, 5 bục vật lý (`hero`/`standard`/`square`), hiện vật GLB đã chuẩn hóa hoặc placeholder hình học khi không có model/đang tải/lỗi, đi kèm chế độ danh sách 2D song song.
4. Tích hợp vào màn `/room/[slug]` để tham quan trực tiếp phòng 5 hiện vật.

## Tiêu chí nghiệm thu (AC)

- Cả phòng và 5 bục hiện vật hiển thị đúng vị trí (`S01..S05`) hoặc giữ nguyên tọa độ gốc ở chế độ `legacy`.
- `typecheck`, `lint`, `jest --coverage`, và Metro Hermes bundle iOS/Android đều pass sạch.
