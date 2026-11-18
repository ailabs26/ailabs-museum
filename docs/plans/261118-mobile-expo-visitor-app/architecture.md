# Kiến trúc — Mobile Visitor App (Expo)

## 1. Nguyên tắc tổng thể

- **Back-end dùng lại nguyên trạng** (NestJS + REST, response `ApiResponse<T>` / `Paginated<T>`). Mobile là một client mới ngang hàng với web.
- **Tách lớp rõ ràng:** UI (screens/components) → hooks (react-query) → service (gọi API theo domain) → http-client (axios + interceptor auth). Mirror cấu trúc `front-end/src/core` + `services/` của web.
- **Domain logic thuần tách khỏi React** để test và chia sẻ: hotspot resolve, guided camera path, normalize model, i18n format, Zod schema.

## 2. Sơ đồ lớp

```
┌──────────────────────────────────────────────┐
│  Screens (expo-router)                        │
│   Home · Rooms · Catalogue · ExhibitDetail    │
│   Scene3D · GuidedTour · AR · Settings        │
├──────────────────────────────────────────────┤
│  UI components (design system RN)             │
├──────────────────────────────────────────────┤
│  Hooks (TanStack Query) — useRooms, useRoom,  │
│   useExhibit, useGuidedTour, useAudioGuide    │
├──────────────────────────────────────────────┤
│  Services (domain API) — roomsApi, mediaApi,  │
│   reportsApi, authApi                         │
├──────────────────────────────────────────────┤
│  Core — http-client (axios), auth-store,      │
│   i18n, config, offline-cache                 │
├──────────────────────────────────────────────┤
│  Domain helpers thuần (shared w/ web)         │
└──────────────────────────────────────────────┘
          │ REST /api
          ▼
   NestJS back-end (không đổi)
```

## 3. Chiến lược tái sử dụng code từ web

| Loại | Cách dùng lại | Ghi chú |
| --- | --- | --- |
| Zod schema / validations | Port trực tiếp (thuần TS) | Không phụ thuộc DOM |
| Helper hotspot/guided camera/model-normalization | Port trực tiếp + giữ nguyên test | Toán học thuần, không DOM/three-web-specific |
| i18n messages (6 ngôn ngữ) | Trích chuỗi ra JSON dùng chung | Tách khỏi Mantine |
| API service layer | Viết lại axios client (không dùng được fetch-wrapper web nếu bám DOM) | Cùng contract |
| UI components (Mantine) | **Không** dùng lại — Mantine là web | Thay bằng design system RN |
| three.js scene | Port logic sang react-three-fiber/native | three core dùng được; renderer khác |

**Khuyến nghị:** tạo thư mục `shared/` (hoặc workspace package `@aura/domain`) chứa helper + schema + i18n thuần TS, cả `front-end` và `mobile` cùng import. Quyết định monorepo (pnpm/npm workspaces) nêu trong `tech-stack.md`.

## 4. Điều hướng (navigation)

- **expo-router** (file-based, giống Next). Stack + Tabs:
  - Tab: Trang chủ · Phòng · Tìm kiếm · Cài đặt.
  - Stack lồng: Room → ExhibitDetail → Scene3D (modal/full) → AR.

## 5. 3D trên React Native

- **Renderer:** `expo-gl` + `expo-three` + `@react-three/fiber/native`.
- **Model:** GLB qua `expo-asset` + `GLTFLoader` (expo-three resolver). Cache file bằng `expo-file-system`.
- **Điều khiển camera:** gesture (`react-native-gesture-handler` + `react-native-reanimated`) map sang controller — port logic `museumNavigation`/`guidedCameraPath` (thuần toán) từ web.
- **Fallback:** nếu GLB lỗi hoặc thiết bị yếu → màn 2D detail (giữ nội dung đọc được, giống web).

## 6. AR

- **WebXR không khả dụng native** → dùng:
  - iOS: ARKit qua `expo-ar`/`react-viro`/`@reactvision/react-viro`.
  - Android: ARCore qua cùng lib.
- MVP: đặt model hiện vật lên mặt phẳng, xoay/zoom; hotspot overlay. Đây là hạng mục rủi ro cao → spike trước.

## 7. Dữ liệu & offline

- **TanStack Query** + `persistQueryClient` lưu `AsyncStorage`/`expo-file-system`.
- **Media cache:** ảnh (`expo-image` built-in cache), audio + GLB tải và lưu `expo-file-system`, có quản lý dung lượng.
- **Offline-first:** catalogue + hiện vật đã mở xem lại được khi mất mạng; AR/3D cần asset đã cache.

## 8. Auth

- Visitor phần lớn **public** (`@Public()` trên web). Các thao tác cần đăng nhập (ví dụ gửi content-report) → JWT access/refresh lưu `expo-secure-store`, interceptor tự refresh. Mirror `core/auth` của web.

## 9. Observability

- Crash: Sentry (expo plugin). Analytics: sự kiện xem phòng/hiện vật/tour (tùy chọn, ẩn danh).
- Log API lỗi tập trung qua interceptor.

## 10. Bảo mật & riêng tư

- Secrets qua EAS secrets, không hardcode.
- Không gửi dữ liệu người dùng ra ngoài trừ khi cần (tuân CLAUDE.md: coi thông tin người dùng là riêng tư).
- Tôn trọng media rights/licensing như web (public media rights đã có plan ở `docs/plans/261021-2027-public-media-rights`).

## 11. Điểm cần chốt với back-end (mở)

- Có cần endpoint bundle offline (trả nhiều phòng/asset manifest trong 1 call) không?
- CORS/headers cho client mobile (User-Agent chung, không lộ thông tin cá nhân).
- Rate limit cho prefetch asset.
