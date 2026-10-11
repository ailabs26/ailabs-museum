# Màn hình, route và cách dùng demo

Đọc [khác biệt phạm vi](README.md) trước khi dùng bảng route. Route/component dưới đây là **đề xuất**, chưa triển khai trong scaffold. Tên `.html` là màn hình trong task/demo, không yêu cầu React tạo từng file HTML.

## Ánh xạ màn hình

| Nguồn demo / task | Route React đề xuất | Page / layout | Nội dung | Task |
| --- | --- | --- | --- | --- |
| `index.html` | `/` | `HomePage`, `PublicLayout` | Nhận diện, CTA 3D/2D, hiện vật Published; preview 3D tải sau DOM | 16 |
| `collection.html` | `/collection` | `CollectionPage`, `PublicLayout` | Grid, loading/empty/error, ngôn ngữ; search/filter là tùy chọn demo | 16, 19 |
| Chi tiết trong collection/tour | `/collection/:exhibitId` | `ExhibitDetailPage`, `ExhibitPanel` | Nội dung, hotspot DOM, ảnh, audio/transcript/captions, ghi công | 17–20 |
| `tour.html` | `/tour/:roomSlug` | `MuseumPage`, `MuseumLayout` | Canvas, controls, danh sách DOM, panel, chuyển 2D, tour/XR | 11–15, 18–20, 40, 42 |
| `login.html` trong task, **không có trong demo** | `/login` | `LoginPage` | Email/password và phiên API; không đăng ký Admin công khai | 2 |
| `admin.html` | `/admin` | `DashboardPage`, `AdminLayout` | Thống kê API và link tới nội dung cần xử lý | 21 |
| `admin.html#rooms` | `/admin/rooms` | `RoomsPage` | CRUD phòng, cần chốt khác biệt với SRS | 6 |
| `admin.html#exhibits` | `/admin/exhibits`, `/admin/exhibits/:exhibitId` | `ExhibitsPage`, `ExhibitEditorPage` | vi/en, transform, hotspot, media, trạng thái; revision khi chốt contract | 7, 9, 10 |
| `admin.html#media` | `/admin/media` | `MediaPage` | Upload, metadata quyền sử dụng, trạng thái xử lý/gắn media | 8–10 |
| Preview theo task/SRS | `/admin/exhibits/:exhibitId/preview` | `ExhibitPreviewPage` | Renderer public nhận Draft đã lưu qua API xác thực; badge Preview | 10, 22 |
| `moderation.html` | `/admin/moderation` | `ModerationPage` | Chờ duyệt, revision diff, publish/reject/hide theo workflow task | 22 |
| `reports.html` | `/admin/reports` | `ReportsPage` | Phiên bản bị báo cáo, tiếp nhận/đóng và ghi chú | 23 |
| `audit.html` | `/admin/audit` | `AuditPage` | Nhật ký server chỉ đọc, filter/phân trang; export nếu được yêu cầu | 24 |
| `accounts.html` | `/admin/accounts` | `AccountsPage` | Tài khoản, role, trạng thái từ API | 3 |
| `permissions.html` | `/admin/permissions` | `PermissionsPage` | Danh mục mã quyền từ BE | 4, 5 |
| `permission-matrix.html` | `/admin/permission-matrix` | `PermissionMatrixPage` | Ma trận role/action/scope; BE xác nhận quyền sửa | 4, 5 |
| Chưa có demo | `/admin/tour` | `TourSettingsPage` | Thứ tự ID và dwell time Auto theo SRS | 40, 42; cần phân công CMS tour |
| Chưa có demo | `/admin/api-keys` | `ApiKeysPage` | Tạo/thu hồi key, scope; giai đoạn mở rộng | 36, 44 |

Import/export và bản dịch mở rộng đặt trong màn hình hiện vật, chưa cần route riêng. Analytics retention là việc BE, không tự thêm dashboard analytics.

## Navigation và URL

- Public mở được khi chưa đăng nhập. Admin có layout/provider riêng, kiểm tra phiên trước khi tải dữ liệu; deep link cũng đi qua kiểm tra.
- Page validate `roomSlug`/`exhibitId` theo contract rồi giao hook tải dữ liệu. Không suy ID từ index hoặc slug cố định của năm hiện vật demo.
- Đề xuất selection tour bằng `?exhibit=<id>`; chuyển 2D giữ ID hợp lệ, nếu không về collection kèm thông báo. Ngôn ngữ giữ trong provider phiên.
- Mở chi tiết từ danh sách có thể dùng modal cùng URL; truy cập URL trực tiếp phải có trang DOM đầy đủ. Back/Forward khôi phục selection/focus, không tự phát audio.
- Route sai có trang không tìm thấy. Exhibit không còn public có thông báo/link quay lại, không thử đọc Draft bằng API admin.
- Hosting rewrite route ứng dụng về `index.html`; API/media giữ routing backend, lỗi API không trả HTML SPA. Kiểm chứng reload URL trực tiếp khi triển khai hosting.
- Public shell không import eager CMS/Three.js. Lazy load CMS/scene, có loading/error boundary; 2D vẫn truy cập được khi chunk scene lỗi.

## Thành phần dùng chung

| Đề xuất | Nơi dùng | Quyền sở hữu |
| --- | --- | --- |
| `ExhibitPanel` / `ExhibitContent` | 2D, panel 3D, Preview | Render view model hợp lệ; không tự chọn API public/admin |
| `AudioGuide`, `Transcript`, `CaptionDisplay` | 2D, 3D, Preview | Controls/văn bản; một audio owner cấp phiên ngăn phát chồng |
| `ExhibitCard`, `ExhibitList` | Home, collection, danh sách DOM | Selection ID, link/button semantic, fallback ảnh |
| `ExhibitForm`, `TransformFields`, `HotspotEditor` | CMS | Form chưa lưu/lỗi trường; không sửa state public |
| `MediaPicker` / `MediaUpload` | CMS media/editor | Chọn ID hợp lệ; upload riêng rồi gắn Draft |
| `PublicReportDialog` | Collection, tour | ID/version snapshot đang xem; task 20 |
| `AdminLayout` | Content Studio | Sidebar, phiên, navigation theo capability; không phải lớp bảo mật |

Chỉ tách component khi ownership rõ hoặc có nhu cầu dùng lại. Không tạo bộ component rỗng theo toàn bộ bảng.

## Phần học từ demo và phần phải thay

Demo tại commit ghim ở [tổng quan](README.md) có 10 HTML page, ES module và Three.js vendor. Nguồn đối chiếu: `css/style.css`, `js/scene.js`, `js/shared.js`, `js/data.js`, `js/governance.js`, `js/media-demo.js`, `js/studio-shell.js`.

| Quan sát từ demo | Hướng chuyển sang FE chính |
| --- | --- |
| Cream/paper, teal đậm, gold; heading serif/body sans; home chia giới thiệu/preview; Studio sidebar | Là hướng thiết kế. Token DOM trong CSS chung, CSS Module theo component; `theme.ts` hiện chỉ chứa màu phòng. Đo contrast/zoom trước khi nhận kích thước chữ demo |
| Tour có canvas, overlay, hướng dẫn, joystick và dải hiện vật | Tách R3F/DOM, dùng chung selection ID với danh sách bàn phím |
| Collection có grid, search/filter, chi tiết | Giữ cấu trúc thông tin; search/filter không tự trở thành điều kiện MVP |
| `data.js`/`governance.js` dùng `localStorage` cho hiện vật, role, revision, audit | Thay bằng API; storage trình duyệt không làm DB, audit trail hoặc nguồn quyền |
| `scene.js` tạo mesh mẫu, DOM và renderer trực tiếp | Học bố cục/controls, triển khai bằng R3F; không tạo scene engine thứ hai |
| `shared.js` dùng `speechSynthesis` | Dùng MP3 thật, transcript/WebVTT đúng ngôn ngữ; giọng máy không thay media nghiệm thu |
| `media-demo.js` dùng object URL; ảnh tới 10 MiB, audio tới 25 MiB, không upload GLB | Upload theo SRS, revoke URL; preview local không đồng nghĩa đã lưu |
| Role và ma trận mô phỏng | BE thực thi auth/RBAC, không cấp quyền từ localStorage |
| Template string gán `innerHTML`, kể cả nhãn hotspot | Render text bằng JSX, không gán HTML thô từ CMS |
| Nút request XR session | Tách capability/lifecycle XR khỏi 3D cơ bản, theo scope đã chốt |

Năm hiện vật/ảnh SVG demo là mô phỏng, không chứng minh đủ GLB thật, quyền sử dụng, audio song ngữ/captions. Nếu tái sử dụng source/asset phải kiểm tra quyền của đúng tệp; giấy phép Three.js vendor không mặc nhiên cấp phép mọi nội dung demo. Task này chỉ tham chiếu, không sao chép asset/source demo vào ứng dụng.
