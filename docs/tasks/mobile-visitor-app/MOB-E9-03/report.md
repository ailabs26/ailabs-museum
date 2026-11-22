# Báo cáo MOB-E9-03 — Hotspot Overlay trong AR

**Trạng thái:** READY_FOR_REVIEW *(chờ kiểm chứng chạm marker 3D trong ARKit/ARCore thật & reviewer độc lập)*  
**Người thực hiện:** Nguyễn Trọng Thành (TV4 — 3D & AR Engine)  
**Nhánh:** `feat/mob-e9-03-ar-hotspot-overlay` (base stacked: `feat/mob-e9-02-ar-plane-placement` @ `7433d7d6`)  
**Ngày cập nhật:** 20/11/2026

## Nội dung đã thực hiện

- [`mobile/src/features/ar/arHotspots.ts`](../../../../mobile/src/features/ar/arHotspots.ts):
  - `resolveArHotspots`: chuyển đổi tọa độ hotspot nguồn GLB qua `normalizeModel` và tỷ lệ fit AR sang không gian cục bộ AR, từ chối tọa độ NaN/vượt biên bằng vị trí dự phòng không trùng và sinh hotspot mặc định nếu hiện vật chưa có hotspot tác giả.
  - `computeArMarkerRadius`: bù bán kính điểm chạm theo $1/\sqrt{\text{arScale}}$ để marker luôn dễ bấm khi phóng to hoặc thu nhỏ hiện vật.
  - `arHotspotStoryReducer` & `resolveArHotspotStory`: quản lý chọn/đóng/chuyển điểm `Trước / Tiếp` và tự động đối chiếu (`RECONCILE`) khi danh sách hotspot thay đổi.
- [`mobile/src/features/ar/ArHotspotOverlay.tsx`](../../../../mobile/src/features/ar/ArHotspotOverlay.tsx):
  - `ArHotspotSceneMarkers`: render marker `ViroSphere` + nhãn `ViroText` gắn trên hiện vật AR kèm `onClick`.
  - `ArHotspotHudOverlay`: thanh chip chọn nhanh hotspot (hỗ trợ VoiceOver/TalkBack) + thẻ thuyết minh `accessibilityLiveRegion="polite"` hiển thị `Điểm k / N` và nút `Trước / Tiếp / Đóng`.
- [`mobile/src/features/ar/ArExhibitExperienceView.tsx`](../../../../mobile/src/features/ar/ArExhibitExperienceView.tsx) & [`mobile/app/ar-exhibit.tsx`](../../../../mobile/app/ar-exhibit.tsx): kết nối trọn vẹn luồng đặt mặt phẳng + xoay/zoom (`MOB-E9-02`) với lớp phủ hotspot (`MOB-E9-03`).

## Kiểm chứng của người thực hiện

| Điều kiện / lệnh | Môi trường | Kết quả | Bằng chứng |
|---|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Linux, Node v26.3.0 | PASS | 0 lỗi TypeScript strict |
| `npm run lint` (`eslint .`) | Linux, ESLint 9.39.5 | PASS | 0 lỗi, 0 cảnh báo |
| `npm test -- --coverage` | Jest + RNTL | PASS | 22/22 suites pass (bổ sung `arHotspots.test.ts` & `ArExhibitExperienceView.test.tsx`) |
| Kiểm thử hành trình AR đầu-cuối | `ArExhibitExperienceView.test.tsx` | PASS | Đặt mặt phẳng → hiện 3 marker 3D → chạm marker 3D mở `Điểm 1 / 3` → zoom 150% vẫn giữ thẻ story → nhấn `Tiếp` sang `Điểm 2 / 3` → chọn chip 3 → nhấn `Đóng` |
| `npx expo export --platform ios` & `android` | Metro + Hermes | PASS | Bundle thành công cả iOS & Android |
| Chạm marker AR thật trên iPhone & Android | Chưa có máy thật trên Linux | PENDING_DEVICE | Cần kiểm chứng trên Dev Client iOS ARKit + Android ARCore (vào `/ar-exhibit`) |

## Tự rà soát (Self-Review)

- Đồng bộ hoàn toàn cấu trúc hotspot với `front-end/src/helpers/{artifactHotspots,hotspotStory}.ts` để khi TV5 merge `MOB-E7-01` có thể dùng chung dữ liệu ngay.
- Thanh chip hotspot 2D trên HUD đảm bảo người dùng screen reader hoặc người gặp khó khăn khi chạm vật thể 3D nhỏ vẫn duyệt được toàn bộ câu chuyện hiện vật trong AR.

## Validation và review độc lập

**Reviewer:** Chưa có  
**Trạng thái review:** Chờ review PR và kiểm chứng chạm AR trên thiết bị thật.
