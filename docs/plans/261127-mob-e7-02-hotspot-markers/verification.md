# Kiểm chứng MOB-E7-02

Base `23825f585c6f345fb0981b35a0a851d06ab81bac` trên `origin/dev` đã chứa PR #229. Nhánh `feat/mob-e7-02-hotspot-markers`. Commit mã được kiểm chứng là `59b0a5a0b70bb026499e83589cdfb880227db573`.

**Implementation hoàn tất. Kiểm chứng tự động PASS. NATIVE TOUCH NOT VERIFIED.** AC chạm marker trên thiết bị còn chờ xác nhận Android/iOS.

## Ma trận kiểm chứng

| Phạm vi | Kịch bản và bằng chứng | Kết quả |
| --- | --- | --- |
| E7-01 | 7 case tọa độ/fallback và 2 case resolve story bằng hai helper đã có. | 9 PASS |
| Marker 3D | Sphere bán kính 0,16 m với 12×8 segments. Tâm giữ nguyên tọa độ helper, active đổi màu và scale 1,2. Hit target dùng bề mặt sphere. | PASS |
| Tọa độ | Payload thật qua `mapRoomDisplays` trong layout slotted và legacy. Marker gắn trực tiếp dưới placement group, cùng cấp với cụm GLB. Ready dùng cùng normalization với GLB. Loading, error và checksum cũ rơi về fallback. Bục trống và exhibit ngoài phòng có 0 marker. | PASS |
| Selection | Tap hai authored hotspot trên cùng exhibit, hai exhibit dùng chung hotspot ID, marker mặc định, ID đã xóa, và nút 2D. Kiểm tra ID phòng, analytics một lần mỗi thao tác, callback hợp lệ, active state và loader chỉ chạy một lần khi đổi selection. | PASS |
| Lifecycle | Refetch giữ selection còn hợp lệ và resolve story mới. Chọn exhibit, đổi phòng, gỡ exhibit hoặc gỡ hotspot xóa active selection. Đổi 2D/3D giữ selection hợp lệ. | PASS |
| Raycast và gesture | Three.js thật kiểm bề mặt gần nhất, marker cùng tia, model tiền cảnh, bục trống và mesh ẩn. RNTL kiểm tap, drag quay lại điểm đầu, pinch về một ngón có hoặc thiếu move, terminate, background/resume, joystick và nav buttons. | PASS |
| Hồi quy | Suite camera/focus, collisions, gallery, GLB, AR và 2D. Gallery test kiểm tra AR entry nhận hiện vật đang chọn. | PASS trừ 2 case fixture GLB đã skip trên base |

Test tích hợp dùng Canvas mock để host JSX, dựng các mesh từ props marker đã render và gọi raycast Three.js thật. RNTL gửi chuỗi sự kiện responder. Việc đưa touch từ OS vào viewport Expo GL cần dev build để kiểm chứng.

## Lệnh đã chạy

Windows 11, Node `24.8.0`, npm `11.6.0`. Các lệnh npm chạy bằng `npm.cmd` trong PowerShell từ `mobile/`.

| Lệnh | Kết quả |
| --- | --- |
| `npm ci` | PASS, cài 1.419 package từ lockfile. Lần đầu bị DNS của sandbox chặn. |
| Full Jest baseline trên mã base, loại đúng file test marker mới khỏi discovery | 47 suite PASS, 1 suite SKIP. 216 PASS / 0 FAIL / 2 SKIP. Lần targeted trước đó chạy khi dependency đang cài và gặp timeout trong gallery, đã pass khi chạy lại. |
| `npm run typecheck`, `npm run lint` | PASS |
| `npm test -- --runInBand hotspot` | 4 suite, 13 PASS / 0 FAIL / 0 SKIP, gồm đủ 9 parity case E7-01 |
| `npm test -- --runInBand GalleryRoomView` | 1 suite, 8 PASS / 0 FAIL / 0 SKIP |
| `npm test -- --runInBand museumNavigation` | 1 suite, 7 PASS / 0 FAIL / 0 SKIP |
| `npm test -- --runInBand galleryPicking TouchNavigationHud GalleryRoomView museumNavigation TouchCameraController` tại commit routing | 5 suite, 22 PASS / 0 FAIL / 0 SKIP |
| `npm test -- --ci --runInBand` | 50 suite PASS, 1 suite SKIP. 231 PASS / 0 FAIL / 2 SKIP. |
| `npm run perf:bundle` | Lỗi Windows đã ghi nhận ở E7-01, `spawnSync npx ENOENT`. Script gọi `execFileSync('npx', ...)` trong khi Windows cung cấp `npx.cmd`. |
| `node node_modules/expo/bin/cli export --platform <android\|ios> --dump-sourcemap --output-dir <temp-dir> --max-workers 2` | PASS. Hermes Android 3.599.180 byte và iOS 3.600.532 byte, dưới giới hạn 4.194.304 byte mỗi nền tảng. |
| `git diff --check`, `git diff --check origin/dev...HEAD` | PASS |

Hai case GLB thật trong `glbValidation.test.ts` và `ArArtifactPlacementView.test.tsx` yêu cầu fixture `.glb` dưới `back-end/public/media/uploads/models`. Thư mục fixture vắng trong checkout. Full suite có cảnh báo React `act(...)` từ các test offline/catalogue xuất hiện trên baseline.

Expo CLI chạy offline với `EXPO_OFFLINE=1` và `EXPO_NO_TELEMETRY=1`. Kích thước dùng tổng byte các tệp `.hbc` như script gốc. Hai thư mục export tạm được dọn sau phép đo.

## Android/iOS

| OS | Thiết bị và build | SHA dự kiến | Kết quả |
| --- | --- | --- | --- |
| Android | Máy Windows thiếu Android SDK, `adb` và emulator khả dụng. | `59b0a5a` | NOT RUN |
| iOS | Máy Windows thiếu Xcode, simulator và dev build iOS khả dụng. | `59b0a5a` | NOT RUN |

Dùng dev build tương thích Viro. Ghi OS, model, loại build, SHA, kết quả thực tế và ảnh/video nếu có.

| Kịch bản trên thiết bị | Kỳ vọng |
| --- | --- |
| Mở phòng nhiều hiện vật và chạm lần lượt hai điểm trên cùng hiện vật, rồi một điểm trùng ID ở hiện vật khác | Marker active đổi đúng theo cặp exhibit/hotspot, đúng exhibit được chọn và analytics phát một lần mỗi tap. |
| Chạm marker mặc định, marker bị che hoặc bục trống | Marker mặc định chọn exhibit. Bề mặt phía trước chặn điểm bị che. Bục trống giữ lựa chọn hiện tại. |
| Drag qua marker, pinch rồi nhấc một ngón, thả tay và tap lại | Yaw/pitch và dolly phản hồi. Chỉ tap mới chọn. |
| Đưa app vào background khi đang chạm rồi quay lại | Gesture cũ hết hiệu lực và tap mới hoạt động. |
| Thử joystick, nút camera, focus và AR | Điều khiển camera, collision và AR entry hoạt động, HUD không phát selection hotspot. |
| Chọn trong 2D với VoiceOver/TalkBack rồi quay lại 3D, sau đó đổi phòng | Nút đọc đúng label và trạng thái selected. 3D khôi phục điểm hợp lệ. Phòng mới bắt đầu phiên chọn mới. |
| Dùng fixture model tải chậm, sẵn sàng rồi lỗi, ở cả slotted và legacy | Marker đặt đúng vị trí cùng asset hiện tại hoặc hiển thị ở điểm dự phòng theo E7-01. |

## Bàn giao contract

- **E7-03** đọc `activeHotspotSelection` trong `GalleryRoomView` và gọi `resolveHotspotStory(selection, selectedDisplay)`. State giữ `roomId`, `exhibitId`, `hotspotId` và `issuedAt`.
- **E7-04** dùng `exhibitId` để tra current display và model state cùng lượt render. `getHotspotWorldTarget(display, hotspotId, normalization)` trả tọa độ authored hợp lệ cho camera.
- **E7-05** dùng `onHotspotSelected(selection)` tại thời điểm chọn authored hotspot hợp lệ. Tap 3D và nút 2D đi qua cùng `SelectHotspot(exhibitId, hotspotId)`.

## Commit ledger

| SHA | Message | Mục đích | Files | Kiểm chứng | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `a153dd3` | `docs(mob): plan native hotspot selection [MOB-E7-02]` | Audit và thiết kế | `plan.md`, `commit-plan.md`, `verification.md` | Base, PR #229 và staged diff | Committed |
| `3c8c44f` | `feat(mob): add native 3D hotspot markers [MOB-E7-02]` | Marker dùng lại và active visual | `ArtifactHotspot3D.tsx`, `ArtifactHotspot3D.test.tsx` | 1 case Jest, typecheck, lint | Committed |
| `3a7eab1` | `fix(mob): route gallery taps through the navigation HUD [MOB-E7-02]` | Responder và raycast giữ hành vi chọn exhibit | `TouchNavigationHud.tsx`, `TouchNavigationHud.test.tsx`, `galleryPicking.ts`, `galleryPicking.test.ts`, `GalleryRoomComponents.tsx`, `GalleryRoomView.tsx`, `GalleryRoomView.test.tsx` | 22 case Jest, typecheck, lint | Committed |
| `59b0a5a` | `feat(mob): connect gallery hotspot selection [MOB-E7-02]` | Marker theo layout/model, lifecycle và nút 2D dùng chung selection | `room/[slug].tsx`, `ArtifactHotspot3D.tsx`, `GalleryRoomComponents.tsx`, `GalleryRoomView.tsx`, `GalleryRoomView.test.tsx` | Hotspot 13, gallery 8, navigation 7, typecheck, lint | Committed |
| Commit tài liệu này | `docs(mob): record hotspot interaction verification [MOB-E7-02]` | Kết quả, native checklist và contract bàn giao | `verification.md` | Full Jest, Hermes budget và diff check | Handoff |

Tách marker và routing để mỗi commit có test độc lập. Gộp layout, authored selection và nút 2D vì chúng chia sẻ dữ liệu và handler. Mở một draft PR về `dev` để review và ghi kết quả native khi có dev build.
