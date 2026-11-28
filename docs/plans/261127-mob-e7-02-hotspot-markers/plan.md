# Kế hoạch MOB-E7-02

- Base `origin/dev`: `23825f585c6f345fb0981b35a0a851d06ab81bac`. PR #229 đã merge và mang theo hai helper E7-01, 9 case parity cùng contract `SelectHotspot(exhibitId, hotspotId)`.
- Nhánh `feat/mob-e7-02-hotspot-markers`. Worktree sạch trước khi chuyển nhánh.
- AC là một tap chọn đúng exhibit và authored hotspot, đồng thời giữ điều hướng phòng, 2D và lối vào AR.

## Luồng hiện tại

`/room/[slug]` nhận room ID công khai, gọi `mapRoomDisplays` và gửi analytics qua `onSelectExhibit`. Mapper gắn room ID, revision, hotspot đã sắp xếp và tọa độ display đã snap. `GalleryRoomView` quản lý selected exhibit, quality và phiên tải GLB. AR có hệ tọa độ và selection riêng. Web có case hồi quy drag quay lại điểm đầu, trùng hotspot ID giữa các hiện vật và refetch.

HUD đặt `lookArea` phía trên Canvas theo thứ tự sibling. Với native hit testing, một touch nhắm vào view này đi theo responder tree của HUD. Nó không bubble ngang sang Canvas. R3F Native trên lockfile tự nối PanResponder và chuyển touch thành click trên mỗi responder-end với ngưỡng riêng. Việc giữ hai nguồn dispatch sẽ làm tap và pinch khó đồng bộ. Audit này dựa vào source React Native và R3F Native.

## Tích hợp

- Dùng một look surface phủ viewport để xử lý tap, drag và pinch. Joystick và các nút giữ responder riêng phía trên. Tap được xác nhận lúc release bằng `NavigationGestures`, kể cả khi ngón tay thay đổi vị trí giữa các sự kiện move. Mất responder và app inactive hủy gesture.
- Từ tọa độ local của look surface, raycast bằng camera và scene R3F. Chỉ dispatch target của hit hiển thị gần nhất. Thân bục trống và geometry phòng chắn ray. Vòng trang trí bỏ qua raycast. Kích thước hit target lấy từ hình cầu hiển thị.
- Marker dùng trực tiếp `getArtifactHotspots(display, normalization)`. Marker nằm dưới placement group theo layout slotted hoặc legacy, cùng cấp với cụm GLB đã dịch theo cao độ mặt bục và normalize. Cùng một ready asset cung cấp GLB và normalization. Snapshot GLB phải khớp bộ displays đang render.
- `GalleryRoomView` dùng ID thật từ route, validate authored identity bằng `resolveHotspotStory` và giữ `HotspotStorySelection` trong local state. Chọn exhibit thông thường hoặc marker mặc định xóa active story. Refetch giữ selection còn hợp lệ. Nút hotspot trong danh sách 2D dùng chung handler để truy cập điểm bị che hoặc khi Canvas lỗi.

## Kiểm chứng

Chạy full Jest baseline trước khi chỉnh mã. Kiểm chứng riêng hình học marker bằng renderer test, thứ tự occlusion bằng Three.js, responder lifecycle bằng RNTL và flow payload thật qua mapper đến selection/story. Chạy lại parity, gallery, navigation, full Jest, typecheck, lint, bundle và diff check.

Khi có dev build tương thích Viro, chạy các kịch bản trong `verification.md` trên Android/iOS. Geometry part có thể che marker theo góc camera. Chế độ 2D cung cấp cách chọn mọi authored hotspot. Nếu thiếu dev build hoặc thiết bị, ghi `NATIVE TOUCH NOT VERIFIED`.
