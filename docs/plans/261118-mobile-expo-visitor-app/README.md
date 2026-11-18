# Aura Museum — Mobile Visitor App (React Native + Expo)

**Loại tài liệu:** Plan tổng thể + phân công công việc
**Ngày khởi tạo:** 2026-11-18
**Nhánh:** `docs/mobile-expo-visitor-app-plan`
**Nền tảng:** React Native (Expo, managed workflow) — iOS + Android
**Phạm vi MVP:** Full trải nghiệm visitor (tham quan 3D/WebXR, hotspot storytelling, guided tour, audio guide, catalogue 2D fallback)
**Quy mô team:** 5 thành viên, chia đều khối lượng

---

## 1. Mục tiêu

Xây dựng ứng dụng di động cho **khách tham quan (visitor)** của Aura Museum, tái sử dụng tối đa back-end NestJS và logic domain đã có từ web, mang trải nghiệm tương đương web lên iOS/Android với tối ưu riêng cho thiết bị di động (touch, cảm biến, offline, AR).

Ứng dụng **không** bao gồm Admin Portal — chỉ phần công khai dành cho visitor.

## 2. Danh mục tài liệu

| File | Nội dung |
| --- | --- |
| [`README.md`](./README.md) | Tổng quan, index (file này) |
| [`plan.md`](./plan.md) | Roadmap, 6 phase, milestone, timeline, Definition of Done |
| [`architecture.md`](./architecture.md) | Kiến trúc app, cách tái dùng web, luồng dữ liệu, 3D/AR trên RN |
| [`tech-stack.md`](./tech-stack.md) | Lựa chọn thư viện và lý do |
| [`feature-scope.md`](./feature-scope.md) | Ánh xạ tính năng web → mobile, in/out scope |
| [`task-breakdown.md`](./task-breakdown.md) | WBS chi tiết: toàn bộ task theo epic, estimate, phụ thuộc, acceptance |
| [`team-allocation.md`](./team-allocation.md) | Phân công 5 thành viên, cân bằng tải |
| [`test-plan.md`](./test-plan.md) | Chiến lược kiểm thử, công cụ, coverage gate |
| [`risk-assessment.md`](./risk-assessment.md) | Rủi ro, mức độ, biện pháp giảm thiểu |
| [`mobile-task-allocation.xlsx`](./mobile-task-allocation.xlsx) | Bảng Excel phân công task cho 5 người (chia đều) |

## 3. Nguyên tắc

- **Tái sử dụng back-end nguyên trạng** — không đổi API contract; nếu cần endpoint mới phải tách PR back-end riêng.
- **Domain logic thuần** (helper tính toán hotspot, guided path, i18n, validation Zod) **chia sẻ** giữa web và mobile qua package dùng chung hoặc port có kiểm thử.
- **Offline-first** cho catalogue và media đã tải.
- **Accessibility** theo WCAG 2.2 AA tương đương chuẩn web hiện tại.
- **Mỗi task có tiêu chí nghiệm thu (AC) rõ ràng** và test đi kèm.

## 4. Quy ước ID task

`MOB-<epic>-<số>` — ví dụ `MOB-E6-03`. Epic liệt kê trong [`task-breakdown.md`](./task-breakdown.md).

## 5. Trạng thái

> Tài liệu plan — chưa triển khai code. Baseline để review, ước lượng và phân công; không phải báo cáo tính năng đã hoàn thành.
