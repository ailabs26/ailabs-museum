# App mobile Public — Expo / React Native (2026-11-13)

Kế hoạch xây dựng ứng dụng di động iOS + Android cho **phân hệ public** của AILabs Museum.
Phân hệ **quản trị (CMS) không làm trên mobile** (dạng bảng, không hợp nhập liệu di động).

| File | Nội dung |
|---|---|
| [`plan.md`](plan.md) | Mục tiêu, chọn Expo/RN, kiến trúc & tái dùng code, ma trận phạm vi, phases, rủi ro, tiêu chí thành công. |
| [`tasks.md`](tasks.md) | Chi tiết công việc 10 phase (00–09) kèm acceptance + câu hỏi mở. |
| [`3d-on-mobile.md`](3d-on-mobile.md) | Ghi chú kỹ thuật & spike cho phòng 3D (phần rủi ro cao nhất). |

**Định hướng đã chốt:** Expo/React Native · public gồm **3D ngay** · dùng chung API/CDN với
web · tái dùng tối đa types/zod/service/i18n/guided-tour logic (gồm PR #180).

**Câu hỏi cần quyết định sớm:** monorepo vs repo riêng · auth khách (cục bộ vs đồng bộ tài
khoản) · tài khoản Apple/Google · thiết bị tối thiểu · push notification bản đầu.
