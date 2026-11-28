# 09 — Xử lý sự cố 3D & AR

## Môi trường dev

### Jest: `Cannot find module '@react-native-async-storage/async-storage' from 'jest-setup.ts'`

Mọi suite đều FAIL, kể cả test toán thuần. Nguyên nhân: thư viện cài trên máy cũ hơn
`mobile/package-lock.json` (nhánh `dev` đã thêm package mới). Chạy lại trong `mobile/`:

```bash
npm ci
```

Nếu thư mục dependency của `mobile/` là symlink tới nơi khác (vd. thư mục scratch của công cụ AI),
`npm ci` sẽ ghi vào nơi đó — kiểm tra bằng `ls -la mobile` trước.

### Test GLB thật bị `skipped`

Bình thường khi `back-end/public/media/uploads/models` không có file `.glb` (luôn đúng trên CI).
Muốn chạy: upload ít nhất một GLB qua CMS ở máy local, hoặc chép một file `.glb` vào thư mục đó.

## 3D

### Log bị spam cảnh báo `pixelStorei` của `expo-gl` khi tải texture

Driver `expo-gl` không hỗ trợ một số tham số (vd. `UNPACK_FLIP_Y_WEBGL`) mà Three.js gọi khi tải
texture. `configureExpoGlContext` (`scene3d/glbLoader.ts`) bọc `pixelStorei` để bỏ qua các tham số
đó; `GalleryRoomView` và `GlbArtifactCanvas` gọi nó trong `onCreated` của `<Canvas>`. Canvas mới
cũng phải gọi hàm này.

### Hiện vật hiện hình khối thay vì mô hình

Đây là `ExhibitPlaceholder3D` — GLB của hiện vật đang tải hoặc lỗi. Xem `category` trong state
`RoomModelManager`:

| `category` | Cách xử lý |
|---|---|
| `network`, `timeout` | Kiểm tra mạng / `EXPO_PUBLIC_API_URL`. Trên màn xem một hiện vật (`GlbArtifactView`), bấm **Thử lại** để tải lại GLB. Trên màn phòng (`GalleryRoomView`), hiện vật giữ placeholder và chưa có nút thử tải lại riêng cho từng GLB (nút **Thử lại 3D** của `Scene3DErrorBoundary` chỉ dùng khi lỗi renderer/WebGL); cần vào lại phòng hoặc đổi tầng chất lượng để `RoomModelManager` tải lại |
| `rate_limit` | Đợi `retryAfterSeconds` (giới hạn rate của API công khai) |
| `missing`, `permission` | Hiện vật đã gỡ xuất bản hoặc media bị khoá trên CMS |
| `checksum` | File trên storage khác checksum đã lưu — upload lại media trên CMS |
| `format`, `mesh` | File GLB không đạt kiểm tra — xem mục dưới |

### GLB bị từ chối (`format`) dù mở được trong Blender

`validateGlb` từ chối các trường hợp mà loader trên mobile không xử lý được. Khi export:

- Chọn **glTF Binary (.glb)**, không phải `.gltf` + file rời (texture/bin ngoài có `uri` → bị chặn).
- **Không** dùng nén Meshopt (`EXT_meshopt_compression`) hay texture KTX2/Basis
  (`KHR_texture_basisu`). Draco được chấp nhận.
- Dung lượng ≤ 128 MB, JSON chunk ≤ 16 MB.

### Camera kẹt trong bục sau khi CMS đổi bố cục

`findSafeNavigationPoint` tự đẩy camera ra điểm an toàn gần nhất khi bắt đầu một lộ trình. Nếu đứng
yên vẫn kẹt, bấm "Đặt lại góc nhìn" trên HUD.

### Phòng hiện "Bố cục tự do" thay vì "5 bục"

Phòng rơi vào chế độ `legacy` khi có > 5 hiện vật, hiện vật đặt lệch tâm bục > 5 cm, hoặc hai hiện
vật cùng một bục. Sửa vị trí trên CMS (dùng các bục chuẩn S01–S05) để về chế độ `slotted`.

## AR

### "Bản chạy hiện tại chưa tích hợp module AR native"

Đang chạy trên **Expo Go** hoặc bản build chưa prebuild Viro. AR chỉ chạy trên EAS Development
Build cài trên máy thật:

```bash
npx eas build --profile development --platform ios     # hoặc android
```

### "Chế độ AR cần camera thực trên thiết bị thật"

Simulator/emulator không có ARKit/ARCore. Dùng máy thật.

### Không phát hiện được mặt phẳng

Thông báo tracking cho biết lý do (xem bảng ở [05](05-ar-engine.md#2-nạp-viro-an-toàn--arbridgets)).
Mặt bàn trơn một màu, ánh sáng yếu hoặc di chuyển máy quá nhanh đều làm ARKit/ARCore không nhận được
mặt phẳng ngang. Chỉ mặt phẳng **ngang** được chấp nhận.

### Mô hình AR quá to/nhỏ hoặc lơ lửng

Kích thước mặc định là cạnh lớn nhất 0.55 m, đáy chạm mặt phẳng — tính từ `normalization` của chính
file GLB. Nếu mô hình lơ lửng: kiểm tra `prepareArGlbSource` đã trả `normalization` (state
`ready`); khi đang tải hoặc lỗi, app hiện hộp 0.32 m thay thế.

### Scene AR không cập nhật khi xoay/zoom

`ViroARSceneNavigator` giữ `initialScene` từ lần render đầu. Mọi state phải đi qua `viroAppProps`
— xem lưu ý cuối [05](05-ar-engine.md#5-màn-hình-arartifactplacementview).
