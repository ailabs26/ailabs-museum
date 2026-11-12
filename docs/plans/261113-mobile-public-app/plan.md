---
title: "App mobile phân hệ Public — Expo / React Native"
description: "Kế hoạch xây dựng ứng dụng di động iOS + Android cho phân hệ khách tham quan (public) của AILabs Museum: duyệt phòng/hiện vật, chi tiết, tìm kiếm, yêu thích, guided tour và phòng 3D immersive. Tái dùng tối đa API, types và service layer của web."
status: draft
priority: P1
scope: "Chỉ phân hệ Public. KHÔNG làm phân hệ quản trị (CMS) — dạng bảng/table không phù hợp nhập liệu trên mobile."
stack: "Expo (React Native) + TypeScript, TanStack Query, axios, zod, react-three-fiber/native + expo-gl + expo-three"
owner: "Nhóm phát triển AILabs Museum"
created: 2026-11-13
---

# App mobile Public — Expo / React Native

> **Phạm vi:** chỉ phân hệ **public (khách tham quan)**. Phân hệ **quản trị (CMS)** vẫn
> dùng web — giao diện dạng bảng/table nhiều cột không phù hợp nhập liệu trên màn hình
> điện thoại; làm lại trên mobile là lãng phí (YAGNI).

## 1. Mục tiêu

Đưa trải nghiệm tham quan của web lên **app native iOS + Android**, để khách:

- Duyệt **phòng trưng bày** và **hiện vật**, xem **chi tiết** (ảnh, mô tả, media, phụ đề).
- **Tìm kiếm** hiện vật toàn hệ thống; mở nhanh qua **deep link / QR** (short link).
- Dùng các tiện ích khách: **yêu thích**, **xem gần đây**, **ghi chú**, **so sánh hiện vật**,
  **điều khiển đọc** (cỡ chữ…), **báo nội dung**.
- Chạy **Guided Tour** (2D ↔ 3D) đồng bộ như web (kế thừa logic PR #180).
- Vào **phòng 3D immersive** ngay trên điện thoại (render bằng GPU thiết bị).
- Trải nghiệm **đa ngôn ngữ** (vi/en/fr/zh/ko/ja) như web.

**Nguyên tắc:** dùng chung **một back-end/API** với web; app mobile là một client mới,
không tạo backend riêng. Tái dùng tối đa TypeScript types, zod schema và service layer.

## 2. Vì sao Expo / React Native

| Lý do | Giải thích |
|---|---|
| Tái dùng stack | Web đã là React 18 + TypeScript + axios + TanStack Query + zod → chuyển sang RN giữ nguyên tư duy, tái dùng được tầng API/validation/i18n. |
| Một codebase 2 nền tảng | iOS + Android từ một mã nguồn; giảm chi phí so với native kép. |
| 3D khả thi | `@react-three/fiber/native` + `expo-gl` + `expo-three` chạy được Three.js/r3f trên mobile — web đang dùng `@react-three/fiber` + `three`, khái niệm cảnh tái dùng được. |
| EAS Build/Submit/OTA | Expo Application Services lo build cloud, nộp store và cập nhật OTA (vá nhanh không chờ duyệt store). |
| Tuyển dụng/bảo trì | Cùng hệ sinh thái JS/TS với team hiện tại. |

> Đã cân nhắc Flutter (phải viết lại tầng API/validation bằng Dart) và PWA (không lên được
> App Store/CH Play, hạn chế 3D/hiệu năng) — không chọn cho mục tiêu app native có 3D.

<!-- Các mục kiến trúc, tái dùng code, phạm vi, phases được bổ sung ở dưới. -->
