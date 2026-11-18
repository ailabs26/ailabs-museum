# Tech Stack — Mobile Visitor App

## 1. Nền tảng & ngôn ngữ

| Hạng mục | Lựa chọn | Lý do |
| --- | --- | --- |
| Framework | **React Native + Expo (managed, SDK mới nhất ổn định)** | Đa nền tảng, OTA update, EAS build; team đã quen React/TS |
| Ngôn ngữ | TypeScript (strict) | Đồng bộ với web, chia sẻ type/schema |
| Navigation | **expo-router** | File-based, deep link, giống mental model Next |
| Data fetching | **TanStack Query 5** | Giống web, cache + offline persist |
| HTTP | **axios** + interceptor | Mirror `core/api/http-client` web |
| State cục bộ | Zustand (nhẹ) hoặc React context | Tránh over-engineering (KISS) |
| Validation | **Zod** (dùng lại từ web) | Cùng schema |
| i18n | i18next / lingui + JSON chung | 6 ngôn ngữ vi/en/fr/zh/ko/ja |

## 2. 3D & AR

| Hạng mục | Lựa chọn | Ghi chú |
| --- | --- | --- |
| 3D renderer | `@react-three/fiber/native` + `expo-gl` + `expo-three` | Port scene từ three web |
| Loader GLB | `expo-three` GLTFLoader + `expo-asset` | Cache qua `expo-file-system` |
| Gesture | `react-native-gesture-handler` + `react-native-reanimated` | Điều khiển camera touch |
| AR | `@reactvision/react-viro` (ARKit/ARCore) | **Spike bắt buộc** — rủi ro cao |

## 3. Media

| Hạng mục | Lựa chọn |
| --- | --- |
| Ảnh | `expo-image` (cache sẵn) |
| Audio guide | `expo-av` (hoặc `expo-audio` mới) |
| File cache | `expo-file-system` |
| QR (nếu dùng) | `expo-camera` / `expo-barcode-scanner` |

## 4. Lưu trữ & bảo mật

| Hạng mục | Lựa chọn |
| --- | --- |
| Token | `expo-secure-store` |
| Cache query/offline | `AsyncStorage` + `persistQueryClient` |
| Secrets build | EAS Secrets |

## 5. Chất lượng & CI/CD

| Hạng mục | Lựa chọn |
| --- | --- |
| Lint/format | ESLint + Prettier (config kế thừa web) |
| Unit/component test | Jest + React Native Testing Library |
| E2E | **Maestro** (ưu tiên, nhẹ) hoặc Detox |
| Build & release | **EAS Build + EAS Submit** |
| OTA | EAS Update |
| Crash/observability | Sentry (expo plugin) |

## 6. Cấu trúc repo (đề xuất)

**Phương án A — thư mục trong monorepo hiện tại:**
```
ailabs-museum/
  back-end/
  front-end/
  mobile/            ← app Expo mới
  shared/            ← @aura/domain: helper + schema + i18n thuần TS
```
Dùng npm/pnpm workspaces để `front-end` và `mobile` cùng import `shared`.

**Phương án B — repo mobile riêng:** đơn giản hoá CI nhưng khó chia sẻ code → **không khuyến nghị** cho MVP vì cần tái dùng domain logic.

→ **Quyết định đề xuất: Phương án A** (cần chốt với lead; ảnh hưởng task `MOB-E1-01`).

## 7. Phiên bản & tương thích

- iOS 15+ / Android 8+ (API 26+) — chốt lại theo analytics người dùng mục tiêu.
- Khóa phiên bản Expo SDK; nâng cấp có kiểm soát.

## 8. Câu hỏi mở

- Lib AR: `react-viro` vs giải pháp native module riêng — quyết sau spike `MOB-E9-01`.
- Monorepo tooling: npm workspaces (đang dùng) hay chuyển pnpm — cân nhắc chi phí migration.
