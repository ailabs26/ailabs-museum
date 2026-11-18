# Phạm vi tính năng — Mobile Visitor App

Ánh xạ tính năng visitor của web hiện tại sang mobile MVP.

## 1. Trong phạm vi (In scope)

| # | Tính năng web | Mobile MVP | Ghi chú |
| --- | --- | --- | --- |
| 1 | Danh sách phòng trưng bày | ✅ | Tab Phòng, chọn phòng |
| 2 | Catalogue hiện vật trong phòng | ✅ | List + ảnh thumbnail |
| 3 | Chi tiết hiện vật (2D) | ✅ | Title, mô tả, ảnh, audio |
| 4 | Audio guide đa ngôn ngữ | ✅ | `expo-av`, điều khiển play/seek |
| 5 | Tìm kiếm hiện vật công khai | ✅ | Port từ `feat/VT-077-public-exhibit-search` |
| 6 | i18n 6 ngôn ngữ | ✅ | vi/en/fr/zh/ko/ja |
| 7 | Tham quan phòng 3D | ✅ | react-three-fiber/native |
| 8 | Hotspot storytelling | ✅ | Port helper `hotspotStory`, UI touch |
| 9 | Guided tour (camera dẫn đường) | ✅ | Port `guidedCameraPath`, bar điều khiển |
| 10 | 2D fallback khi 3D/GLB lỗi | ✅ | Giữ nội dung đọc được |
| 11 | Reduced motion / a11y | ✅ | Theo cài đặt hệ điều hành |
| 12 | Báo cáo nội dung (content report) | ✅ | Cần auth; form báo cáo |
| 13 | AR đặt hiện vật ngoài đời | ✅ (MVP cơ bản) | Rủi ro cao, spike trước |
| 14 | Offline xem catalogue đã tải | ✅ | TanStack persist + file cache |
| 15 | SEO/metadata | ➖ không áp dụng | Thay bằng deep link + share sheet |

## 2. Ngoài phạm vi (Out of scope — MVP)

| Hạng mục | Lý do |
| --- | --- |
| Admin Portal / CMS | App chỉ cho visitor |
| WebXR headset VR | Mobile dùng AR thay thế; VR headset không phải mục tiêu MVP |
| Đăng nhập mạng xã hội | Visitor chủ yếu public; cân nhắc sau |
| Push notification | Sau MVP (trừ khi cần cho guided tour onsite) |
| Thanh toán / vé | Không thuộc phạm vi hệ thống hiện tại |
| Chỉnh sửa nội dung offline đồng bộ ngược | Visitor chỉ đọc |

## 3. Tính năng mobile-native bổ sung (giá trị riêng)

| # | Tính năng | Ưu tiên |
| --- | --- | --- |
| N1 | Quét QR tại hiện vật để mở chi tiết onsite | Trung bình |
| N2 | Haptic feedback khi chọn hotspot | Thấp |
| N3 | Tải trước phòng để dùng offline tại bảo tàng | Cao |
| N4 | Chia sẻ hiện vật qua share sheet + deep link | Trung bình |
| N5 | Chế độ tiết kiệm pin / chất lượng 3D theo thiết bị | Cao |

## 4. Tiêu chí nghiệm thu MVP (tổng)

- Visitor có thể: mở app → chọn phòng → duyệt catalogue → xem chi tiết + nghe audio → vào 3D → tương tác hotspot → chạy guided tour — trên **cả iOS và Android**, với i18n và a11y cơ bản.
- Có ít nhất 1 luồng AR hoạt động trên thiết bị hỗ trợ.
- Offline: catalogue đã tải xem lại được khi mất mạng.
- Build release nộp được TestFlight (iOS) và Internal testing (Android).
