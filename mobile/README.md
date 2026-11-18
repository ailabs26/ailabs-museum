# Aura Museum — Mobile (React Native + Expo)

Ứng dụng di động cho **visitor**. Plan chi tiết: [`docs/plans/261118-mobile-expo-visitor-app/`](../docs/plans/261118-mobile-expo-visitor-app/).

## Quyết định kiến trúc (MOB-E1-01)

Repo **không có root `package.json`** (back-end/front-end là project npm độc lập). Để giữ KISS và không phá CI hiện tại, `mobile/` được scaffold **độc lập** (có `package-lock.json` riêng), đúng theo pattern sẵn có — **không** ép npm workspaces ở giai đoạn này.

> Việc tách package `shared/` (helper + schema + i18n dùng chung web/mobile) để lại cho sau; trước mắt port trực tiếp helper thuần khi cần (xem `architecture.md`). Nâng lên workspaces có thể làm sau nếu nhu cầu chia sẻ code tăng.

## Yêu cầu

- Node 18+ (đã test với 18.20.x)
- Expo SDK 52, CLI qua `npx expo` / `npx eas`
- iOS: Xcode + simulator · Android: Android Studio + emulator

## Cài đặt & chạy

```bash
cd mobile
npm install
npm start          # mở Expo dev server
npm run ios        # chạy iOS simulator
npm run android    # chạy Android emulator
npm run typecheck  # kiểm tra kiểu
npm run lint       # ESLint
npm test           # Jest + RNTL
```

## Biến môi trường

Không commit `.env`. Các biến (tạo file `.env` cục bộ hoặc đặt qua EAS):

| Biến | Giá trị | Ý nghĩa |
| --- | --- | --- |
| `APP_ENV` | `development` \| `staging` \| `production` | Chọn môi trường; quyết định API mặc định |
| `EXPO_PUBLIC_API_URL` | URL | Ghi đè API base URL (tùy chọn) |

`app.config.ts` đọc các biến này và đưa vào `extra`; code đọc qua `src/config/env.ts`.

## Cấu trúc

```
mobile/
  app/                       expo-router (file-based)
    _layout.tsx              Stack gốc + providers
    (tabs)/                  Trang chủ · Phòng · Tìm kiếm · Cài đặt
    room/[slug].tsx          nested stack (deep link /room/:slug)
    +not-found.tsx
  src/
    theme/                   design tokens + ThemeProvider (dark mode)
    components/layout/        Screen (SafeArea), AppHeader
    hooks/                   useReducedMotion
    config/                  env runtime
  app.config.ts              cấu hình động theo APP_ENV
  eas.json                   build/submit profiles
```

## Build & phát hành (EAS) — runbook

> Các bước này **cần tài khoản Expo + Apple Developer + Google Play Console** nên chưa chạy trong môi trường dev hiện tại.

```bash
npx eas login
npx eas build:configure              # gắn projectId vào app.config extra.eas
npx eas build --profile development --platform all   # dev client (MOB-E1-05)
npx eas build --profile preview --platform all       # internal test
npx eas build --profile production --platform all    # store build
npx eas submit --profile production --platform ios    # TestFlight (MOB-E1-06)
npx eas submit --profile production --platform android# Play internal (MOB-E1-06)
npx eas update --channel preview                      # OTA (MOB-E1-07)
```

## Trạng thái task TV1

| Task | Mô tả | Trạng thái |
| --- | --- | --- |
| MOB-E1-01 | Scaffold Expo app + chốt monorepo | ✅ Code xong (cần `npm install` để chạy) |
| MOB-E1-02 | ESLint + Prettier | ✅ |
| MOB-E1-03 | expo-router skeleton (tabs + stack) | ✅ |
| MOB-E1-04 | app.config env + icon/splash | ✅ Config xong · ⚠️ cần asset icon/splash thật |
| MOB-E2-01 | Theme tokens | ✅ |
| MOB-E2-04 | Layout (SafeArea/Header) | ✅ |
| MOB-E2-05 | Dark mode + reduced motion tokens | ✅ |
| MOB-E11-04 | Reduced motion toàn app | ✅ (hook sẵn sàng) |
| MOB-E14-01 | Jest + RNTL + test mẫu | ✅ |
| MOB-E1-05/06/07 | EAS Build/Submit/OTA | ⚙️ Config `eas.json` xong · ⏳ cần tài khoản để chạy |
| MOB-E15-01..04 | Release & store | ⏳ cần tài khoản + build thật |
| MOB-E6-07 | 2D fallback | ⏳ chờ 3D engine (TV4, MOB-E6) |
| MOB-E9-04 | Thoát AR | ⏳ chờ AR (TV4, MOB-E9) |

## Chưa kiểm chứng (DoD gap)

Môi trường hiện tại **chưa chạy `npm install`/build/device** nên chưa xác minh được app khởi động trên iOS/Android. Người làm cần:
`npm install` → `npx expo install --fix` (đồng bộ version theo SDK) → `npm run typecheck && npm run lint && npm test` → `npm run ios/android`.
