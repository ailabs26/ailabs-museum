# Task: Mobile — Data core, Offline & Observability (TV2)

- **Phạm vi:** các task TV2 trong bảng phân công mobile (E3 Data & Core, E12 Offline, E13 Observability, E11-03 Perf).
- **Plan:** [261118-mobile-expo-visitor-app](../plans/261118-mobile-expo-visitor-app/plan.md).
- **Quy ước:** mỗi task một nhánh `feat/mob-<slug>` từ `dev`, PR vào `dev`. Kiểm chứng: `cd mobile && npm run typecheck && npm run lint && npm test`.

## Chuỗi PR

| # | Nhánh | Task | Trạng thái |
|---|---|---|---|
| 1 | `feat/mob-config-feature-flags` | Config/env + feature flags | PR mở |
| 2 | `feat/mob-http-client` | axios http-client + unwrap + chuẩn hóa lỗi | Chưa làm |
| 3 | `feat/mob-query-persist` | TanStack Query + persist AsyncStorage | Chưa làm |
| 4 | `feat/auth-native-refresh-token` (BE) | Refresh token qua body cho client native | Chưa làm |
| 5 | `feat/mob-auth-store` | Auth store secure-store + refresh interceptor | Chưa làm |
| 6 | `feat/mob-file-cache` | File cache GLB/audio | Chưa làm |
| 7 | `feat/mob-cache-policy` | Hạn mức + dọn cache | Chưa làm |
| 8 | `feat/mob-retry-error-boundary` | Retry/backoff + error boundary | Chưa làm |
| 9 | `feat/mob-api-error-log` | Log lỗi API tập trung | Chưa làm |
| 10 | `feat/mob-offline-banner` | Offline catalogue + banner | Chưa làm |
| 11 | `feat/mob-cache-settings` | Quản lý cache trong Settings | Chưa làm |
| 12 | `feat/mob-room-prefetch` | Prefetch phòng (chờ roomsApi của TV3) | Chưa làm |
| 13 | `feat/mob-sentry` | Sentry (chờ DSN/tài khoản) | Chưa làm |
| 14 | `feat/mob-analytics-adapter` | Analytics ẩn danh (adapter, chưa gửi ra ngoài) | Chưa làm |
| 15 | `feat/mob-perf-baseline` | Perf baseline (chờ 3D của TV4) | Chưa làm |

## 1. Config/env + feature flags

- `src/config/feature-flags.ts`: danh sách flag (`scene3d`, `ar`, `analytics`, `offlinePrefetch`), mặc định theo `APP_ENV`, `resolveFeatureFlags` nhận ghi đè `EXPO_PUBLIC_FLAG_<TÊN>`; chỉ chấp nhận `true/false/1/0`.
- `app.config.ts` gom biến `EXPO_PUBLIC_FLAG_*` vào `extra.featureFlagOverrides`, thêm `extra.sentryDsn`.
- `src/config/env.ts`: `appConfig.featureFlags`, `appConfig.sentryDsn` (null khi rỗng), `isFeatureEnabled(flag)`.
- Sửa nền để lint chạy: `eslint-config-expo` 8.0.1 không có `flat.js` → nâng `~9.2.0`; `react-native` 0.76.5 → 0.76.9 theo `expo install --fix`; commit `package-lock.json` lần đầu.
- Kiểm chứng: typecheck, lint, 11 test pass; `APP_ENV=staging EXPO_PUBLIC_FLAG_AR=true npx expo config` ra `featureFlagOverrides: { AR: 'true' }`.
