# 07 — Kiểm thử và kiểm chứng (E6 + E9)

## Số liệu

Phần 3D & AR có **22 file test, 71 test case** (15 file `scene3d/`, 7 file `ar/`).

Kết quả CI gần nhất trên `dev` (run `45550171517`, job **Mobile**, 25/11/2026) cho toàn bộ app
mobile: 46 suite (45 pass, 1 skip), 209 test (207 pass, 2 skip). Cả 2 test bị bỏ qua đều thuộc phần
này — xem mục "Lỗ hổng kiểm thử".

| File | Test | Nội dung chính |
|---|---|---|
| `scene3d/fpsMeter.test.ts` | 5 | snapshot, 60/30 FPS, khoảng nghỉ nền, cửa sổ trượt |
| `scene3d/SpinningCubeScene.test.tsx` | 2 | bỏ qua `pixelStorei` không hỗ trợ của Expo GL; báo mẫu FPS qua `useFrame` |
| `scene3d/ThreeSpikeView.test.tsx` | 4 | HUD FPS + Tạm dừng/Đổi màu/Đặt lại; reduced motion; dừng khi vào nền; GL lỗi → Thử lại/2D |
| `scene3d/glbValidation.test.ts` | 5 | schema, `validateGlb`, sanitize, normalize, dispose |
| `scene3d/glbCache.test.ts` | 3 | Base64, LRU, chống path traversal |
| `scene3d/glbLoader.integration.test.ts` | 4 | HTTP thật + cache đĩa, mã lỗi, LRU |
| `scene3d/GlbArtifactView.test.tsx` | 2 | hiện vật từ cache + dispose khi unmount; lỗi 429/mất mạng → Thử lại/2D |
| `scene3d/gallerySlots.test.ts` | 6 | 5 bục, slotted/legacy, snap, `mapRoomDisplays` |
| `scene3d/roomModelManager.test.ts` | 1 | gộp checksum, song song, cô lập lỗi, dispose |
| `scene3d/GalleryRoomView.test.tsx` | 2 | phòng 3D ↔ 2D, legacy |
| `scene3d/publicRoomApi.test.ts` | 2 | từ chối phản hồi sai phòng và hiện vật có `roomId` khác |
| `scene3d/museumNavigation.test.ts` | 7 | hướng đi, độc lập FPS, joystick, pitch, tap vs kéo |
| `scene3d/museumCollision.test.ts` | 5 | tunneling, trượt, tìm đường, giải thoát, lộ trình |
| `scene3d/TouchCameraController.test.tsx` | 4 | FOV, nút, reduced motion, lộ trình focus |
| `scene3d/performanceTier.test.ts` | 4 | chọn tầng, đọc thiết bị, tự hạ/nâng |
| `ar/arCapability.test.ts` | 3 | ARKit/ARCore, các lý do từ chối, mã tracking |
| `ar/ArSpikeView.test.tsx` | 2 | fallback Expo Go, đặt 1 model |
| `ar/arPlacementMath.test.ts` | 4 | trạng thái, pinch/rotate 3 pha, transform |
| `ar/arModelSource.test.ts` | 1 | đo GLB thật trước khi cấp URI |
| `ar/ArArtifactPlacementView.test.tsx` | 1 | GLB thật từ cache → đặt → xoay/zoom |
| `ar/arHotspots.test.ts` | 3 | đổi toạ độ, mặc định, marker, story |
| `ar/ArExhibitExperienceView.test.tsx` | 1 | hành trình AR + hotspot đầu-cuối |

## Cách chạy

```bash
cd mobile
npm ci                                   # cài đúng theo package-lock của dev
npm test -- src/features/scene3d src/features/ar
npm run typecheck && npm run lint
```

CI (`.github/workflows/ci.yml`, job **Mobile**) chạy typecheck, lint, toàn bộ Jest và bundle budget cho mọi PR.

Nếu Jest báo `Cannot find module '@react-native-async-storage/async-storage'` thì thư viện cài
trên máy đang cũ hơn `package-lock.json` của `dev` — chạy lại `npm ci`.

## Lỗ hổng kiểm thử

1. **Test cần GLB thật bị bỏ qua trên CI.** `glbValidation.test.ts` (một test) và
   `ArArtifactPlacementView.test.tsx` (cả suite) đọc file từ `back-end/public/media/uploads/models`,
   nhưng thư mục này **không được commit** → `it.skip`. Hai test này chỉ chạy trên máy có dữ liệu
   upload. Hướng sửa: commit một GLB nhỏ (vài KB) vào `mobile/src/__fixtures__/` và trỏ test vào đó.
2. **Viro luôn bị mock.** Không có test nào chạy ARKit/ARCore thật; chạm marker, nhận mặt phẳng và
   pinch thật chỉ kiểm chứng được trên máy.
3. **`expo-gl` không chạy trong Jest.** Render thật của r3f/native (FPS thực, bóng, texture) chưa có
   số liệu ngoài spike.
4. Chưa có test riêng cho timeout 25 s của loader, GLB dùng Draco, nút "Xem trong AR" và
   `isOutsideRoom`.

## Kiểm chứng trên thiết bị — còn chờ

| Hạng mục | Cần | Trạng thái |
|---|---|---|
| FPS spike cube 60 FPS | iPhone + Android thật | chờ |
| Phòng 5 bục, đi lại, va chạm | máy thật, 3 tầng chất lượng | chờ |
| Tự hạ tầng khi máy nóng | máy tầm thấp | chờ |
| Đặt hiện vật trên mặt phẳng, pinch/xoay | EAS dev build, ARKit + ARCore | chờ |
| Chạm marker hotspot trong AR | EAS dev build | chờ |

Lý do: máy phát triển là Linux, không có thiết bị iOS và chưa có EAS dev build cài trên máy thật.
Hướng dẫn build: [`mobile/README.md`](../../../mobile/README.md) mục "Build & phát hành (EAS)".
