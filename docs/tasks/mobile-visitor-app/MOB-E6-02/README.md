# MOB-E6-02 — Load GLB qua `expo-three` / `GLTFLoader` + Cache (`expo-file-system`)

**Trạng thái thực tế:** xem [report.md](report.md) · **SP:** 5 · **Phase:** P3 · **Owner:** TV4 — Nguyễn Trọng Thành  
**Phụ thuộc:** `MOB-E6-01`, `MOB-E3-05` *(đã tách `GlbCacheAdapter` interface để cắm trực tiếp `MOB-E3-05` của TV2 khi merge)*  
**Nguồn:** [`docs/plans/261118-mobile-expo-visitor-app/task-breakdown.md`](../../../plans/261118-mobile-expo-visitor-app/task-breakdown.md)

## Yêu cầu triển khai

1. Validate metadata `PublicModel` bằng Zod khớp hợp đồng web (`roomSchema.ts`), ghép URL tương đối `/rooms/:slug/exhibits/:id/model?version=<sha256>` an toàn theo API origin.
2. Xây dựng lớp cache nhị phân cục bộ (`GlbCacheAdapter` + `ExpoFileSystemGlbCache`) lưu khóa theo SHA-256, kiểm toàn vẹn SHA-256 khi đọc lại, tự xóa file cache hỏng và dọn LRU theo giới hạn dung lượng.
3. Port toàn bộ lớp an toàn GLB từ web (`validateGlb`, `sanitizeModel`, `normalizeModel`, `disposeModel`) và tải/giải mã self-contained qua `GLTFLoader` + `configureExpoGlContext` (`expo-three` / `expo-gl`).
4. Hiển thị 1 hiện vật GLB với trạng thái loading, huy hiệu nguồn (`Bộ nhớ đệm` / `Máy chủ`), xử lý lỗi 404/429/5xx/mất mạng/hủy tải và giải phóng GPU `disposeModel` khi unmount.

## Tiêu chí nghiệm thu (AC)

- 1 hiện vật hiển thị được từ bộ nhớ đệm cục bộ (lần 1 tải qua API và ghi cache, lần 2 tải lại 0 request mạng).
- Toàn bộ tệp GLB thật của backend pass `validateGlb`, kiểm thử tích hợp HTTP thật + Disk Cache + file hỏng + lỗi 404/429/500 pass 100%.
- `typecheck`, `lint`, `jest --coverage`, và Metro Hermes bundle iOS/Android đều xanh.
