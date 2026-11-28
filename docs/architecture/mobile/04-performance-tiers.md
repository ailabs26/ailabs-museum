# 04 — Đo FPS và tầng chất lượng 3D (MOB-E6-01, MOB-E6-08)

Code: `mobile/src/features/scene3d/{fpsMeter,performanceTier,useSceneQuality}.ts`,
`SpinningCubeScene.tsx`, `GalleryRoomView.tsx`.

## Đo FPS — `FpsMeter` (E6-01)

Lớp TypeScript thuần, không phụ thuộc React/Three để test chính xác. Nhận từng `deltaMs` từ
`useFrame`, giữ **cửa sổ trượt** (mặc định 120 mẫu ≈ 2 s ở 60 FPS; phòng 3D dùng 60) và trả:

| Trường | Ý nghĩa |
|---|---|
| `fps`, `frameTimeMs` | trung bình trong cửa sổ |
| `p95FrameTimeMs` | phân vị 95 (nearest-rank) — đo độ giật thực tế, cùng cách tính với web `museumAuditMetrics` |
| `droppedFrames16ms` / `droppedFrames33ms` | số khung vượt ngân sách 60 / 30 FPS |
| `sampleCount` | số mẫu hợp lệ |
| `meets60FpsTarget` | ≥ 30 mẫu, FPS ≥ 55 và p95 ≤ 20 ms |

Khoảng nghỉ > 500 ms (app vào nền rồi quay lại) và timestamp không hợp lệ bị bỏ qua để không kéo
tụt số liệu.

Spike `SpinningCubeScene` (`/spike-3d`) hiển thị các số này để chứng minh r3f/native + `expo-gl`
chạy được; `Scene3DErrorBoundary` bắt lỗi GL và đưa ra giao diện 2D kèm nút "Thử lại".

## Ba tầng chất lượng (E6-08)

`QUALITY_PROFILES`:

| Thuộc tính | `low` | `balanced` | `high` | Áp dụng ở |
|---|---|---|---|---|
| `dprCap` (giới hạn pixel ratio) | 1 | 1.5 | 2 | `gl.setPixelRatio` |
| `antialias` | tắt | bật | bật | `<Canvas gl>` |
| `enableShadows` | tắt | bật | bật | `<Canvas shadows>` và `MuseumRoomShell3D` (`castShadow` / `receiveShadow`) |
| `shadowMapSize` | 0 | 1024 | 2048 | **chưa áp dụng** — `MuseumRoomShell3D` chưa truyền vào đèn |
| `enableSecondaryLights` | tắt | bật | bật | `MuseumRoomShell3D` |
| `geometrySegments` | 16 | 24 | 32 | `GalleryPedestal3D` (`ExhibitPlaceholder3D` vẫn dùng số segment cố định) |
| `maxConcurrentGlbLoads` | 1 | 2 | 3 | `RoomModelManager` |
| `anisotropy` | 2 | 4 | 8 | **chưa áp dụng** |
| `maxCacheBytes` | 64 MB | 150 MB | 256 MB | **chưa áp dụng** — cache GLB vẫn dùng mặc định 150 MB |

### Chọn tầng ban đầu — `resolveInitialQualityTier`

Thông số đọc từ `expo-device`, `Dimensions`, `PixelRatio` (`readDeviceCapabilityHints`):

1. **`low`** nếu RAM ≤ 4 GB, hoặc đời máy ≤ 2019, hoặc màn rộng ≤ 360 dp, hoặc là emulator.
2. **`high`** nếu RAM ≥ 8 GB **và** đời ≥ 2023 **và** không bật reduced motion.
3. Còn lại **`balanced`**. Thiếu thông tin thì không tự hạ.

### Tự điều chỉnh khi chạy — `AdaptiveQualityController`

`GalleryRoomView` gửi một snapshot FPS mỗi giây. Bộ điều khiển dùng **hysteresis** để không nhảy
qua lại:

| Điều kiện | Định nghĩa | Hành động |
|---|---|---|
| Đang chật vật | FPS < 26 **hoặc** p95 > 42 ms | 3 mẫu liên tiếp → hạ một tầng (không cần chờ) |
| Rất mượt | FPS ≥ 55 **và** p95 ≤ 19 ms | 6 mẫu liên tiếp **và** đã qua 15 s kể từ lần đổi trước → nâng một tầng |
| Ở giữa | — | reset chuỗi "mượt", giữ nguyên |

Bỏ qua mẫu có < 20 khung. Hạ tầng nhanh, nâng tầng chậm: máy nóng phản ứng ngay nhưng không dao
động khi FPS dao động quanh ngưỡng.

### Người dùng chọn tay

`useSceneQuality` cung cấp `mode`, `profile`, `setMode`, `cycleMode` (Tự động → Thấp → Cân bằng →
Cao → …) và `wasAutoDowngraded`. Nút chất lượng trên header gọi `cycleMode`. Khi chọn tay, bộ tự
điều chỉnh tạm dừng; chọn lại "Tự động" thì nó tiếp tục từ tầng trước đó.

## Kiểm thử

- `fpsMeter.test.ts` — snapshot rỗng; 60 khung đều 16.6 ms đạt mục tiêu; máy 30 FPS và đếm khung
  rớt; bỏ khoảng nghỉ nền và timestamp lỗi; cửa sổ trượt và reset.
- `performanceTier.test.ts` — chọn `low` / `balanced` / `high` theo phần cứng; đọc `expo-device` an
  toàn; tự hạ high → balanced → low, chống dao động, tôn trọng cooldown và chế độ chọn tay.

## Việc còn mở

- Nối `shadowMapSize` vào đèn đổ bóng trong `MuseumRoomShell3D`, `maxCacheBytes` vào
  `ExpoFileSystemGlbCache` (hiện cố định 150 MB) và `anisotropy` vào texture của GLB đã tải.
- Đo FPS trên máy thật theo từng tầng (hiện mới có số liệu từ test và spike).
