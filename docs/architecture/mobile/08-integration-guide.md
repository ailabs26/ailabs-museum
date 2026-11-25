# 08 — Hướng dẫn tích hợp cho các task phụ thuộc E6/E9

Dành cho thành viên làm task dựa trên 3D/AR engine. Mỗi mục chỉ ra **cái đã có sẵn để dùng lại**
và **chỗ cần nối thêm**, tránh viết lại phần đã có.

## TV1 — MOB-E6-07: 2D fallback khi GLB/WebGL lỗi

Đã có:

- `Scene3DErrorBoundary` (`scene3d/Scene3DErrorBoundary.tsx`) bắt lỗi GL/renderer, hiện "Thử lại"
  và gọi `onFallback2D`.
- `GalleryRoomView` có sẵn chế độ `viewMode: '2d'` (danh sách hiện vật) và prop
  `initialMode?: '3d' | '2d'` để mở thẳng 2D.
- Mỗi hiện vật có state riêng trong `RoomModelManager`: `error { message, category }` → component
  đã vẽ `ExhibitPlaceholder3D` thay cho GLB lỗi.
- `GlbArtifactView` (xem một hiện vật) đã có trạng thái lỗi kèm "Thử lại" / "Chuyển 2D".

Cần làm: quyết định **khi nào tự chuyển 2D** (vd. `category` là `format`/`mesh` cho mọi hiện vật,
hoặc GL lỗi 2 lần liên tiếp) và nội dung màn 2D (mô tả, ảnh, audio — phần E5 của TV3).
`GlbLoadError.category` (xem [01](01-glb-pipeline.md#5-mã-lỗi-glbloaderror)) đủ để phân biệt lỗi mạng
(nên Thử lại) với lỗi file (nên chuyển 2D).

## TV1 — MOB-E9-04: thoát AR và khôi phục trạng thái

Hiện tại (`app/ar-exhibit.tsx`):

- Nút "Thoát chế độ AR" → `router.back()`. Phòng 3D được mở bằng `router.push`, nên màn phòng vẫn
  nằm trong stack và **giữ nguyên** hiện vật đang chọn và vị trí camera khi quay lại.
- Nút "Xem hiện vật trong phòng 3D" (khi thiết bị không hỗ trợ AR hoặc camera lỗi) dùng
  `router.replace` tới `/room/[slug]` → tạo màn phòng **mới**, mất hiện vật đang chọn và camera.

Cần làm:

1. Đổi nhánh fallback sang `router.back()` khi màn trước là đúng phòng đó (dùng
   `router.canGoBack()`), chỉ `replace` khi mở AR từ deep link.
2. Nếu cần khôi phục cả khi app bị kill: lưu `{ roomSlug, selectedId, cameraPosition }` (vd. vào
   AsyncStorage đã có từ E3-02) và truyền vào `GalleryRoomView` — hiện component chưa nhận vị trí
   camera ban đầu, sẽ cần thêm prop.
3. Huỷ phiên AR sạch: `ArArtifactPlacementView` đã `abort` việc chuẩn bị GLB khi unmount; phiên
   Viro tự giải phóng khi navigator unmount — cần xác nhận trên máy thật không còn giữ camera.

## TV3 — MOB-E6-03: port model normalization helper

`normalizeModel`, `sanitizeModel`, `disposeModel` **đã được port** trong
`scene3d/glbValidation.ts` (từ `front-end/src/helpers/modelNormalization.ts`) và có test. Task này
chỉ còn: tách thành file helper riêng nếu nhóm muốn khớp cấu trúc web, và bổ sung test so khớp số
liệu với test của web. Không cần viết lại.

## TV5 — E7 Hotspot storytelling (phòng 3D)

Dùng lại từ E9-03:

- Kiểu dữ liệu: `MuseumDisplay.hotspots: MuseumHotspotData[]` đã được `mapRoomDisplays` điền sẵn
  và sắp theo `displayOrder`.
- Logic Trước/Tiếp/Đóng/Reconcile: `arHotspotStoryReducer` + `resolveArHotspotStory`
  (`ar/arHotspots.ts`) không phụ thuộc Viro — có thể chuyển lên thư mục dùng chung và dùng cho
  E7-03.
- UI thẻ: `ArHotspotHudOverlay` (React Native thuần, có ARIA live region) dùng được cho phòng 3D.

Khác biệt với AR: trong phòng 3D toạ độ hotspot phải cộng thêm vị trí bục + `ARTIFACT_BASE_Y`
(1.14 m) và phép normalize của mô hình, thay vì phép fit 0.55 m của AR.

E7-04 (camera focus tới hotspot): dùng `planExhibitFocusRoute` / `sampleFocusRoute`
([03](03-navigation-collision.md)) để đi tới hiện vật, rồi chỉnh hướng nhìn tới hotspot.
`TouchCameraController` nhận `focusRequest` — mở rộng kiểu `FocusExhibitRequest` thêm `hotspotId`.

## TV5 — E8 Guided tour

- Đường đi an toàn giữa các hiện vật: `findNavigationPath` + `getGalleryColliders` — không cần port
  lại thuật toán tìm đường.
- Chạy theo tiến độ: `planExhibitFocusRoute` trả `lengths`/`totalLength`, `sampleFocusRoute(route,
  t)` cho toạ độ tại `t ∈ [0, 1]` — dùng để nối các bước tour.
- Tôn trọng reduced motion: theo cách `TouchCameraController` đang làm (nhảy thẳng tới đích).

## TV2 — cache dùng chung

`GlbCacheAdapter` ([01](01-glb-pipeline.md#3-cache-glbcachets)) là interface riêng để thay
`ExpoFileSystemGlbCache` bằng File Cache chung E3-05 (`core/cache/file-cache`) mà không sửa loader.

Hiện trạng: màn Settings (E12-04, `features/settings/storage-usage.ts`) **đã** cộng dung lượng GLB
qua `getStats()` và xoá qua `clear()`, nhưng phải tự tạo một `ExpoFileSystemGlbCache` riêng, kèm
`TODO(MOB-E6-02): bỏ khi TV4 chuyển GlbCacheAdapter sang fileCache`.

**Việc còn mở của TV4:** viết adapter `GlbCacheAdapter` bọc `fileCache`, dùng nó làm mặc định trong
`glbLoader` và `arModelSource`, rồi xoá cache riêng trong `storage-usage.ts`. Khi đó `maxCacheBytes`
theo tầng chất lượng ([04](04-performance-tiers.md)) cũng có chỗ để áp vào.
