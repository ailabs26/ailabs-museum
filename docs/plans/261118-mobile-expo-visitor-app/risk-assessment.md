# Đánh giá rủi ro — Mobile Visitor App

Thang: Khả năng (Thấp/TB/Cao) × Tác động (Thấp/TB/Cao).

| # | Rủi ro | KN | TĐ | Mức | Biện pháp giảm thiểu |
| --- | --- | --- | --- | --- | --- |
| R1 | AR trên RN (react-viro) không ổn định / khó tích hợp managed workflow | Cao | Cao | 🔴 | Spike `MOB-E9-01` ngay P0; chuẩn bị dev-client/prebuild; AR là tính năng có thể cắt khỏi MVP nếu trượt |
| R2 | 3D (expo-gl/three) hiệu năng kém trên máy yếu | Cao | Cao | 🔴 | Perf tiers `MOB-E6-08`; 2D fallback `MOB-E6-07`; đo sớm trên thiết bị thật |
| R3 | Tái dùng helper three từ web khó vì khác renderer | TB | TB | 🟠 | Chỉ port phần toán thuần; tách renderer; giữ test gốc |
| R4 | Chậm do phụ thuộc E3 (data core) xong muộn chặn mọi người | TB | Cao | 🟠 | Ưu tiên E3 ở P1; mock API sớm để các luồng chạy song song |
| R5 | Cần endpoint mobile-specific (bundle offline) → phụ thuộc back-end | TB | TB | 🟠 | Chốt sớm với lead BE; fallback gọi nhiều call + cache |
| R6 | Store review từ chối (privacy, quyền camera AR) | TB | TB | 🟠 | Chuẩn bị privacy manifest sớm `MOB-E15-01`; mô tả rõ quyền |
| R7 | Đội chưa quen RN/Expo/3D → năng suất thấp giai đoạn đầu | TB | TB | 🟠 | Buffer học tập cho TV4; pairing; tài liệu onboarding |
| R8 | Kích thước app lớn do GLB/asset | TB | TB | 🟡 | Tải asset theo yêu cầu (không bundle); nén GLB (draco) |
| R9 | i18n lệch giữa web và mobile khi chuỗi đổi | Thấp | TB | 🟡 | Nguồn chung `shared/i18n`; CI kiểm key thiếu |
| R10 | Offline cache gây dữ liệu cũ (stale) | Thấp | TB | 🟡 | TTL/invalidation react-query; nút làm mới; quản lý cache |
| R11 | Secrets lộ trong build | Thấp | Cao | 🟠 | EAS Secrets; không hardcode; review CI |
| R12 | Fragmentation thiết bị Android (ARCore/WebGL) | Cao | TB | 🟠 | Ma trận thiết bị; feature-detect; tắt AR nếu không hỗ trợ |

## Rủi ro cần hành động sớm (P0)

- **R1, R2** → spike kỹ thuật trong P0/P3 trước khi cam kết scope AR/3D.
- **R4** → chốt lịch E3 và cung cấp mock API.
- **R5** → họp với team back-end xác định nhu cầu endpoint.

## Giả định

- Back-end không đổi contract trong thời gian làm mobile.
- Có tài khoản Apple Developer + Google Play Console.
- Có ít nhất 2 thiết bị thật mỗi nền tảng để test AR/3D.

## Câu hỏi mở (tổng hợp)

1. Tên thật & kinh nghiệm RN/3D/AR của 5 thành viên?
2. Timeline mục tiêu cụ thể (deadline ra mắt)?
3. Có cần endpoint mobile-specific không?
4. Thiết bị tối thiểu hỗ trợ (iOS/Android version)?
5. Monorepo: dùng npm workspaces hiện tại hay chuyển pnpm?
6. AR có nằm trong MVP bắt buộc hay có thể là fast-follow?
