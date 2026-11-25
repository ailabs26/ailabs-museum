# 03 — Điều hướng cảm ứng và va chạm (MOB-E6-05, MOB-E6-06)

Code: `mobile/src/features/scene3d/{museumNavigation,museumCollision}.ts`,
`TouchCameraController.tsx`, `TouchNavigationHud.tsx`.

Toán điều hướng port 1:1 từ web (`front-end/src/helpers/museumNavigation.ts`,
`navigationGestures.ts`, `museumCamera.ts`) để cảm giác đi lại trên Web và Mobile giống nhau.

## Hằng số `NAVIGATION`

| Khoá | Giá trị | Ý nghĩa |
|---|---|---|
| `walkSpeed` / `sprintSpeed` | 2 / 3.6 m/s | tốc độ đi / chạy |
| `damping` | 12 | độ "ì" khi tăng/giảm tốc |
| `maxDelta` | 0.05 s | kẹp delta frame (tránh nhảy sau khi app resume) |
| `eyeHeight` | 1.7 m | cao độ mắt |
| `bodyRadius` | 0.25 m | bán kính thân, cộng vào mọi collider |
| `wallMargin` | 0.45 m | khoảng cách tối thiểu tới tường |
| `touchSensitivity` | 0.005 rad/px | vuốt xoay góc nhìn |
| `pinchSensitivity` | 0.012 | chụm/tách 2 ngón để tiến/lùi |
| `pitchLimit` | 1.35 rad | kẹp ngước/cúi, không có roll |

Camera bắt đầu ở `(0, 2.6, 5.8)` nhìn về `(0, 1.35, 0)`.

## Cử chỉ (`TouchNavigationHud`)

- **Vuốt 1 ngón** trên vùng nhìn → `applyLook` (yaw/pitch).
- **Chụm/tách 2 ngón** → `computePinchStep`, kẹp ±0.8 m mỗi lần để không nhảy.
- **Joystick ảo** góc dưới trái → `getJoystickVector`: dead-zone 12 %, kẹp bán kính, đảo trục Y màn
  hình.
- **Nút rời** Trái / Tiến / Lùi / Phải / Đặt lại, có `accessibilityLabel` cho VoiceOver/TalkBack.

`NavigationGestures` phân biệt **chạm chọn hiện vật** với **kéo**: ngón di chuyển > 5 px hoặc có
ngón thứ hai → không còn là tap (cùng ngưỡng với web).

`getMuseumFov(aspect)`: màn dọc mở rộng FOV dọc để giữ góc nhìn kiến trúc như màn ngang, tối đa 82°;
màn ngang dùng 60°.

## Di chuyển — `stepMovement`

Tích phân vận tốc theo hàm mũ chính xác thay vì Euler, nên quãng đường đi được **không phụ thuộc
FPS** (30, 60 hay 120 Hz cho cùng kết quả):

```text
decay    = e^(−damping·Δt)
Δpos     = target·Δt + (v − target)·(1 − decay)/damping
v_next   = target + (v − target)·decay
```

Đầu vào đường chéo được chuẩn hoá, hướng tính theo yaw. Khi không còn input và vận tốc ≈ 0 thì về
trạng thái nghỉ (ngừng render liên tục).

## Va chạm — `museumCollision.ts`

Mọi vật cản là hộp chữ nhật XZ đã cộng `bodyRadius`:

- Phòng `slotted`: `getGallerySlotColliders` — **đủ 5 bục, kể cả bục trống** vẫn chắn đường.
- Phòng `legacy`: `getDisplayColliders` — theo từng hiện vật (bục trung tâm 1.22, tròn 0.76, vuông
  ≥ 0.575 m), bỏ qua hiện vật `isOutsideRoom`.
- `getGalleryColliders(displays, exceptId)` chọn đúng loại; `exceptId` bỏ bục của hiện vật đích khi
  tính điểm đứng ngắm.

| Hàm | Việc |
|---|---|
| `isNavigationPositionSafe(x, z)` | Trong tường (trừ `wallMargin`) và ngoài mọi collider |
| `moveWithCollisions` | Chia bước 8 cm chống xuyên bục (tunneling); thử trục X và Z **riêng** → trượt dọc tường/bục thay vì dừng cứng |
| `isNavigationSegmentSafe(a, b)` | Kiểm tra đoạn thẳng cắt hộp bằng slab intersection |
| `findSafeNavigationPoint(p)` | Camera bị kẹt trong bục (vd. CMS vừa xuất bản bục mới) → điểm an toàn gần nhất |
| `findNavigationPath(start, end)` | Đường ngắn nhất không va chạm |

### Tìm đường

`findNavigationPath` dùng **visibility graph + Dijkstra**:

1. Nếu đầu hoặc đích không an toàn → `null`.
2. Nếu đoạn thẳng start→end an toàn → trả ngay 2 điểm.
3. Đỉnh đồ thị = start, end và 4 góc (nới 1 cm) của mỗi collider còn an toàn.
4. Cạnh nối 2 đỉnh khi đoạn thẳng giữa chúng an toàn; trọng số = khoảng cách Euclid.
5. Dijkstra từ start tới end; không tới được → `null`.

Phòng tối đa vài chục đỉnh nên chạy O(n²) mỗi lần vẫn rất nhanh.

### Lộ trình tới hiện vật — `planExhibitFocusRoute`

Dùng khi bấm "Đi tới" trên thẻ hiện vật:

1. Tính điểm nhìn trên hiện vật (cao hơn với torus), kẹp trong ±4.1 × ±5.1 m.
2. Bán kính quỹ đạo 1.8–3.4 m, giới hạn bởi tường và trần; đặt điểm đứng ở phía hướng về tâm phòng.
3. Điểm đứng không an toàn → thử 3 vòng × 24 góc (mỗi vòng xa thêm 0.6 m).
4. Giải thoát điểm xuất phát nếu đang kẹt, rồi `findNavigationPath`.
5. Trả `path`, độ dài tích luỹ từng đoạn, `totalLength`, cao độ đích; `sampleFocusRoute(route,
   progress)` lấy toạ độ theo tỷ lệ 0…1 để animate.

`TouchCameraController` chạy lộ trình này trong `useFrame`. Bật **reduced motion** → camera nhảy
thẳng tới đích và khớp góc nhìn ngay, không có quán tính.

## Kiểm thử

- `museumNavigation.test.ts` — hướng đi theo yaw; đường chéo + tích phân giống nhau ở 30/60/120 FPS;
  kẹp delta sau khi resume; joystick dead-zone; kẹp pitch; tap < 5 px vs kéo vs pinch; FOV dọc.
- `museumCollision.test.ts` — chống tunneling, trượt dọc bục, giới hạn tường; 5 bục kể cả trống và
  đi vòng được; tìm đường vòng + `null` khi đích trong vật cản; giải thoát + `exceptId`; lộ trình
  lối vào → vòng S01 → S02 mà mọi điểm mẫu đều an toàn.
- `TouchCameraController.test.tsx` — FOV dọc, xoay qua `useFrame`, nút rời/reset, reduced motion,
  lộ trình focus và tự giải thoát khi khởi tạo trong bục.
