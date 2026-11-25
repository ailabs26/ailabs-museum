# 06 — Hotspot trong AR (MOB-E9-03)

Code: `mobile/src/features/ar/{arHotspots.ts,ArHotspotOverlay.tsx,ArExhibitExperienceView.tsx}`.

Mục tiêu: khi hiện vật đã đặt trên mặt phẳng, người dùng chạm vào các **điểm thuyết minh** gắn
trên mô hình (hoặc chọn trong thanh chip 2D) để đọc câu chuyện từng điểm, có Trước / Tiếp / Đóng.

Dữ liệu hotspot giữ cùng hợp đồng với web (`front-end/src/helpers/{artifactHotspots,hotspotStory}.ts`)
để phần E7 của TV5 dùng chung được.

## 1. Đổi toạ độ sang không gian AR — `resolveArHotspots`

Hotspot do CMS soạn có toạ độ **cục bộ của GLB gốc**. Trong AR mô hình đã bị dịch (normalize) và thu
nhỏ (fit 0.55 m), nên toạ độ phải đi cùng phép biến đổi đó:

```text
p_AR = (p_GLB + normalization.offset) × s        với s = computeArModelTransform(1, normalization).scale
```

Marker là con của node AR ngoài (node mang `arScale` người dùng), nên khi phóng to/thu nhỏ marker
tự đi theo mô hình — không cần tính lại.

Quy tắc an toàn:

| Trường hợp | Xử lý |
|---|---|
| Hiện vật **không có** hotspot | Tạo 1 hotspot mặc định `<exhibitId>:default` với tên + mô tả hiện vật (`isDefault: true`) |
| Có GLB + normalization | Biến đổi như trên |
| Không có GLB (placeholder) | Dùng toạ độ gốc |
| Toạ độ NaN/Infinity, \|x\| hoặc \|z\| > 3 m, y ngoài [−0.25, 3.2] | Thay bằng vị trí dự phòng: hàng ngang trên đỉnh mô hình (y = 0.69), cách nhau ≤ 0.18 m, **không trùng nhau** |
| Nhãn rỗng | Dùng tên hiện vật |

Kết quả `ArHotspotMarker { id, exhibitId, label, body, position, orderIndex, isDefault }`.

## 2. Kích thước marker — `computeArMarkerRadius`

```text
radius = base / √arScale      base = 0.032 m (0.042 m khi đang chọn), kẹp [0.02, 0.08]
```

Vì marker nằm trong node đã nhân `arScale`, kích thước thấy trên màn hình tăng theo `√arScale`
thay vì `arScale`: thu nhỏ 25 % marker vẫn đủ to để chạm, phóng to 250 % marker không che mô hình.

## 3. Trạng thái câu chuyện — `arHotspotStoryReducer`

State chỉ có `{ selectedId }`.

| Action | Tác dụng |
|---|---|
| `SELECT` | chọn một điểm (thanh chip) |
| `TOGGLE` | chạm marker 3D: chọn, chạm lại thì bỏ chọn |
| `NEXT` / `PREV` | sang điểm kế; dừng ở đầu/cuối (không vòng); chưa chọn gì → điểm đầu |
| `CLOSE` | đóng thẻ |
| `RECONCILE` | danh sách hotspot đổi (vd. GLB vừa chuẩn bị xong) mà điểm đang chọn không còn → bỏ chọn |

`resolveArHotspotStory(hotspots, selectedId)` trả `{ hotspot, index, total, hasPrev, hasNext }`
cho thẻ hiển thị "Điểm k / N".

## 4. Giao diện

**`ArHotspotSceneMarkers`** (trong scene Viro): mỗi hotspot là `ViroSphere` 12 × 12 segment; điểm
đang chọn hiện thêm `ViroText` nhãn phía trên.

**`ArHotspotHudOverlay`** (React Native, đè lên camera):

- Thanh chip "Điểm 1: …", "Điểm 2: …" — người dùng screen reader hoặc khó chạm vật 3D nhỏ vẫn duyệt
  được toàn bộ câu chuyện.
- Thẻ thuyết minh `accessibilityLiveRegion="polite"`: tiêu đề, nội dung, "Điểm k / N", nút Trước /
  Tiếp (vô hiệu ở đầu/cuối) và Đóng.

**`ArExhibitExperienceView`** nối hai phần trên vào `ArArtifactPlacementView` qua
`renderPlacedSceneChildren` / `renderPlacedOverlay`. Nó ưu tiên `normalization` vừa đo được từ
`prepareArGlbSource` (đúng file đang hiển thị) hơn giá trị truyền từ ngoài, và reset khi đổi hiện vật.

## Kiểm thử

- `arHotspots.test.ts` — biến đổi toạ độ GLB → AR qua `normalizeModel`; hotspot mặc định và vị trí
  dự phòng không trùng; bù bán kính marker; Trước / Tiếp / Đóng / Reconcile.
- `ArExhibitExperienceView.test.tsx` — hành trình: đặt mặt phẳng → 3 marker → chạm marker mở
  "Điểm 1 / 3" → zoom 150 % vẫn giữ thẻ → Tiếp sang "Điểm 2 / 3" → chọn chip 3 → Đóng.

## Cần kiểm chứng trên máy thật

- Chạm trúng marker nhỏ trên ARKit/ARCore (Jest dùng Viro mock).
- `onClick` đang gắn ở **cả** `ViroNode` bọc marker **và** `ViroSphere` bên trong, cả hai đều
  dispatch `TOGGLE`. Nếu Viro chuyển sự kiện chạm từ con lên node cha thì một lần chạm sẽ chọn rồi
  bỏ chọn ngay. Cần thử trên thiết bị; nếu đúng là vậy, chỉ giữ `onClick` ở một trong hai.
