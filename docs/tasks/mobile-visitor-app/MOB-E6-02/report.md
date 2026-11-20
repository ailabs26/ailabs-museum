# Báo cáo MOB-E6-02 — Load GLB qua `expo-three` / `GLTFLoader` + Cache

**Trạng thái:** READY_FOR_REVIEW *(chờ xác nhận hiển thị GLB trên máy thật & cắm cache chung `MOB-E3-05` của TV2)*  
**Người thực hiện:** Nguyễn Trọng Thành (TV4 — 3D & AR Engine)  
**Nhánh:** `feat/mob-e6-02-glb-loader-cache` (base stacked: `feat/mob-e6-01-3d-spike` @ `5399db40`)  
**Ngày cập nhật:** 20/11/2026

## Nội dung đã thực hiện

- Cài đặt và khóa phiên bản tương thích SDK 52: `expo-crypto@~14.0.2`, `expo-three@8.0.0`, `zod@^3.24.1`.
- [`mobile/src/features/scene3d/glbSchema.ts`](../../../../mobile/src/features/scene3d/glbSchema.ts): Zod schema `publicModelSchema` khớp `front-end/src/validations/roomSchema.ts` và hàm `resolvePublicModelUrl` chống SSRF / path traversal / origin override.
- [`mobile/src/features/scene3d/glbValidation.ts`](../../../../mobile/src/features/scene3d/glbValidation.ts): port toàn bộ lớp bảo vệ & chuẩn hóa GLB từ web (`validateGlb`, `sanitizeModel`, `normalizeModel`, `disposeModel`).
- [`mobile/src/features/scene3d/glbCache.ts`](../../../../mobile/src/features/scene3d/glbCache.ts): interface `GlbCacheAdapter` (sẵn sàng cắm `MOB-E3-05` của TV2) + triển khai thực tế `ExpoFileSystemGlbCache` (khóa theo SHA-256, index versioned v1, dọn LRU theo giới hạn 150 MB) và `InMemoryGlbCache`.
- [`mobile/src/features/scene3d/glbLoader.ts`](../../../../mobile/src/features/scene3d/glbLoader.ts): pipeline `loadGlbModel` đọc cache → xác thực SHA-256 & `validateGlb` → tự xóa & tải lại nếu cache hỏng → tải HTTP (timeout, AbortSignal, phân loại 404/401/429 kèm `Retry-After`/5xx/mất mạng) → giải mã self-contained qua `GLTFLoader` → `sanitizeModel` → `normalizeModel` → đảm bảo `disposeModel` khi hủy/lỗi.
- [`mobile/src/features/scene3d/GlbArtifactCanvas.tsx`](../../../../mobile/src/features/scene3d/GlbArtifactCanvas.tsx), [`mobile/src/features/scene3d/GlbArtifactView.tsx`](../../../../mobile/src/features/scene3d/GlbArtifactView.tsx) và route kiểm thử [`mobile/app/glb-preview.tsx`](../../../../mobile/app/glb-preview.tsx).

## Kiểm chứng của người thực hiện

| Điều kiện / lệnh | Môi trường | Kết quả | Bằng chứng |
|---|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Linux, Node v26.3.0 | PASS | 0 lỗi TypeScript strict |
| `npm run lint` (`eslint .`) | Linux, ESLint 9.39.5 | PASS | 0 lỗi, 0 cảnh báo |
| `npm test -- --coverage` | Jest + RNTL | PASS | 9/9 suites, 30/30 tests pass; tổng coverage 80.85% Lines / 80.34% Funcs (`glbCache.ts` 92.18%, `glbSchema.ts` 94.11%) |
| Validate tệp GLB thật của backend | `back-end/public/media/uploads/models/*.glb` | PASS | Toàn bộ 6/6 file `.glb` thật pass `validateGlb` |
| Tích hợp HTTP thật + Disk Cache + Self-Heal | `glbLoader.integration.test.ts` (Node HTTP + OS temp dir) | PASS | Lần 1 tải mạng (1 request) → ghi ổ đĩa → giả lập restart app → lần 2 đọc cache (0 request); tự hồi phục khi file cache hỏng; bắt đúng 404/429/500/hash giả/HTML/AbortSignal và LRU eviction |
| `npx expo export --platform ios` & `android` | Metro + Hermes | PASS | Bundle thành công cả `GLTFLoader.js`, `expo-crypto`, `expo-file-system`, `zod` cho iOS & Android |
| Hiển thị GLB texture thật trên thiết bị iOS/Android | Chưa có máy thật trên Linux | PENDING_DEVICE | Cần test trên Dev Client với API staging để đo VRAM & tốc độ giải mã |

## Tự rà soát (Self-Review)

- Đã thêm route `app/glb-preview.tsx` để buộc Metro đóng gói thực sự `GLTFLoader.js`, `expo-crypto`, `zod` thay vì bị tree-shake.
- Đảm bảo không rò rỉ GPU: mọi đường lỗi sau `parseAsync` và cleanup `useEffect` của `GlbArtifactView` đều gọi `disposeModel`.
- Chặn mọi tài nguyên ngoài tệp GLB (`buffers[].uri`, `images[].uri`, `LoadingManager.setURLModifier`).

## Validation và review độc lập

**Reviewer:** Chưa có  
**Trạng thái review:** Chờ review PR và kiểm chứng hiển thị GLB trên máy thật.
