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

## 3. Kiến trúc & chiến lược tái dùng code

### 3.1. Tổ chức mã nguồn

Hai lựa chọn, chọn **A** cho giai đoạn đầu (đơn giản, ít rủi ro):

| Phương án | Mô tả | Đánh giá |
|---|---|---|
| **A. App riêng, chia sẻ bằng copy có kiểm soát** | Tạo app Expo mới (ví dụ `mobile/` trong monorepo hoặc repo riêng); port các module thuần logic (types, zod, service API) sang, giữ đồng bộ thủ công/review. | **Chọn.** Nhanh ra mắt, không phải refactor web. |
| B. Tách package dùng chung (`packages/shared`) | Đưa types/zod/service vào package dùng chung cho cả web và mobile (pnpm/npm workspaces). | Sạch hơn lâu dài nhưng cần refactor web + dựng monorepo tooling → để roadmap sau. |

> Khuyến nghị: bắt đầu bằng A, nhưng **viết code chia sẻ ở dạng thuần (không phụ thuộc
> DOM/Mantine)** để sau này tách sang B dễ dàng.

### 3.2. Lớp tái dùng được (không phụ thuộc trình duyệt)

| Lớp web hiện có | Tái dùng trên mobile | Ghi chú |
|---|---|---|
| `src/validations/*` (zod: room, exhibit…) | **Dùng gần như nguyên** | Thuần zod, không DOM |
| `src/core/api/api-response.ts`, `api-error.ts`, `cms-error*` | **Dùng lại logic** | Chuẩn hóa response/lỗi |
| `src/services/*` (museum, rooms, exhibits, media, reports, translations) | **Port, đổi HTTP client** | Giữ chữ ký hàm, thay axios instance |
| `src/core/api/http-client.ts` | **Viết lại cho RN** | Base URL qua env; token/cookie xử lý khác web |
| `src/core/i18n/public-locale` | **Port** | Giữ 6 locale + cơ chế `t()` + fallback |
| Logic guided tour (reducer, dwell clock, selectors) | **Port** | Thuần TS, tái dùng được — gồm cả PR #180 |
| Mantine components, CSS modules, react-router-dom | **KHÔNG** | Thay bằng RN UI + Expo Router |
| `@react-three/fiber` + `three` | Khái niệm tái dùng | Đổi sang `@react-three/fiber/native` + `expo-gl` + `expo-three` |

### 3.3. Khác biệt kỹ thuật cần xử lý

- **Điều hướng:** `react-router-dom` → **Expo Router** (file-based) hoặc React Navigation.
- **HTTP/Auth:** web dùng cookie httpOnly cho refresh token; public phần lớn **ẩn danh**
  nên nhu cầu auth thấp. Nếu cần token, dùng `expo-secure-store`, không dùng cookie.
- **Lưu trữ cục bộ:** web dùng `localStorage` (favorites, notes, recently viewed) →
  mobile dùng `AsyncStorage`/`expo-secure-store`/SQLite. Cần lớp storage trừu tượng.
- **Deep link / QR:** cấu hình `scheme://` + Universal Links/App Links để mở short link
  hiện vật trực tiếp vào app.
- **Media/CDN:** app tải GLB/ảnh/audio qua cùng domain/CDN với web; cân nhắc cache đĩa.
- **3D:** render qua GL context của thiết bị (xem [`3d-on-mobile.md`](3d-on-mobile.md)).

## 4. Ma trận phạm vi (tính năng public → mobile)

| Tính năng public (web) | Nguồn | Mobile | Ưu tiên |
|---|---|---|---|
| Trang chủ + hiện vật nổi bật | `HomePage`, `HomeFeaturedExhibits` | ✅ | P1 |
| Danh sách phòng / bộ sưu tập | `CollectionPage` | ✅ | P1 |
| Chi tiết hiện vật (ảnh/mô tả/media/phụ đề) | `ExhibitDetailPage` | ✅ | P1 |
| Short link / QR hiện vật (deep link) | `ExhibitShortLinkPage` | ✅ (deep link) | P1 |
| Tìm kiếm hiện vật toàn hệ thống | `GlobalExhibitSearch` | ✅ | P1 |
| Đa ngôn ngữ 6 locale | `core/i18n/public-locale` | ✅ | P1 |
| Yêu thích | `FavoriteButton` | ✅ (AsyncStorage) | P2 |
| Xem gần đây | `RecentlyViewed` | ✅ (AsyncStorage) | P2 |
| Ghi chú khách | `VisitorNotes` | ✅ (AsyncStorage) | P2 |
| Điều khiển đọc (cỡ chữ…) | `ReadingControls` | ✅ | P2 |
| So sánh hiện vật | `ExhibitComparison` | ✅ | P3 |
| Trạng thái lưu trữ cục bộ | `VisitorStorageStatus` | ✅ (điều chỉnh) | P3 |
| Báo nội dung | `reports.service` + modal | ✅ | P2 |
| **Phòng 3D immersive** | `MuseumPage` + `MuseumScene` (r3f) | ✅ (r3f/native) | P1 (rủi ro cao) |
| **Guided Tour 2D ↔ 3D** | hooks + reducer + PR #180 | ✅ | P1 |
| Phân hệ quản trị (CMS) | admin pages | ❌ ngoài phạm vi | — |

**Tính năng mobile-native bổ sung (cân nhắc):** quét **QR bằng camera** (`expo-camera`),
chia sẻ hiện vật (share sheet), thông báo đẩy (push) cho sự kiện/triển lãm — đưa vào
roadmap, không bắt buộc cho bản đầu.
