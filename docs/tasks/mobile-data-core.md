# Task: Mobile — Data core, Offline & Observability (TV2)

- **Phạm vi:** các task TV2 trong bảng phân công mobile (E3 Data & Core, E12 Offline, E13 Observability, E11-03 Perf).
- **Plan:** [261118-mobile-expo-visitor-app](../plans/261118-mobile-expo-visitor-app/plan.md).
- **Quy ước:** mỗi task một nhánh `feat/mob-<slug>` từ `dev`, PR vào `dev`. Kiểm chứng: `cd mobile && npm run typecheck && npm run lint && npm test`.

## Chuỗi PR

| # | Nhánh | Task | Trạng thái |
|---|---|---|---|
| 1 | `feat/mob-config-feature-flags` | Config/env + feature flags | Đã merge (#210) |
| 2 | `feat/mob-http-client` | axios http-client + unwrap + chuẩn hóa lỗi | Đã merge (#211) |
| 3 | `feat/mob-query-persist` | TanStack Query + persist AsyncStorage | Đã merge (#212) |
| 4 | `feat/auth-native-refresh-token` (BE) | Refresh token qua body cho client native | Đã merge (#213) |
| 5 | `feat/mob-auth-store` | Auth store secure-store + refresh interceptor | PR mở |
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

## 2. axios http-client + unwrap + chuẩn hóa lỗi

- `src/core/api/api-response.ts`: `ApiResponse`, `ApiMeta`, `Page` khớp envelope back-end (giống web).
- `src/core/api/api-error.ts`: `ApiException` (`status`, `errors`, `fieldErrors`, `isNetworkError`), `toApiException` (envelope lỗi → message BE; mất mạng/timeout → status 0 với thông điệp riêng; lỗi không envelope giữ status), `endsSession` (chỉ 401).
- `src/core/api/http-client.ts`: axios instance `baseURL = appConfig.apiUrl`, timeout 15s; interceptor chuẩn hóa mọi lỗi thành `ApiException`; `http.get/getPage/post/patch/put/delete` bóc envelope; `http.raw` để gắn interceptor auth/log ở PR sau.
- Chưa thêm `zod` (chỉ cần khi parse auth ở PR auth store).
- Tự review: body rỗng (204) không còn crash ở `unwrap`; request bị hủy (AbortSignal) thành `isCanceled` thay vì bị coi là mất mạng.
- Kiểm chứng: typecheck, lint, 23 test pass (adapter giả: unwrap, Paginated có/thiếu meta, 204, body, lỗi envelope, 502, mất mạng, timeout, hủy).
- Phát hiện ngoài phạm vi: `npx expo export` lỗi `expo-asset cannot be found` (có sẵn từ nền) — đã sửa ở PR 3.

## 3. TanStack Query + persist offline (AsyncStorage)

- `src/core/query/query-client.ts`: `queryClient` dùng chung (staleTime 5 phút, `gcTime` = `PERSIST_MAX_AGE_MS` 7 ngày); `shouldRetry` chỉ thử lại lỗi tạm thời (mất mạng, 5xx, 408, 429; tối đa 2 lần; không retry 4xx/hủy); `createPersistOptions` dùng `createAsyncStoragePersister` (key `aura.query-cache`), `buster` = version app, chỉ lưu query thành công và không có `meta: { persist: false }` (dùng cho dữ liệu nhạy cảm như hồ sơ người dùng).
- `src/core/query/QueryProvider.tsx`: `PersistQueryClientProvider`; trên native nối `focusManager` với `AppState` để refetch khi app quay lại foreground. Gắn vào `app/_layout.tsx`.
- Sửa nền để app bundle được (trước đó `expo start`/`expo export` lỗi trên mọi nền tảng):
  - `expo-router` 4.0.22 dùng `query-string` nhưng không khai báo; `@react-navigation/native` 7.1+ không còn kéo theo → thêm `query-string@^7.1.3`.
  - Thêm `expo-asset` (cần cho `expo export`), `react-native-web`, `react-dom`, `@expo/metro-runtime` (chạy được script `npm run web` có sẵn).
- Kiểm chứng:
  - Tự review: `shouldRetry` chỉ retry `ApiException`; lỗi khác (parse dữ liệu, bug) trước đó bị coi là mất mạng và retry vô ích.
  - typecheck, lint, 29 test pass (retry; persist lưu/khôi phục qua AsyncStorage giả; đổi version bỏ cache; `persist: false` không lưu).
  - Trình duyệt (Expo web + Playwright, harness tạm không commit trên màn Home): query chạy 1 lần, cache có trong `localStorage`; reload trang → giá trị giữ nguyên, query không chạy lại; không có lỗi console.

## 4. Back-end: refresh token qua body cho client native

- Lý do: back-end chỉ phát refresh token qua cookie HttpOnly; app native cần tự lưu token bằng `expo-secure-store` (task Auth store).
- `auth.controller.ts`: header `X-Client: mobile` → `login`, `login/2fa`, `refresh` trả `refreshToken` trong body, không set cookie; `refresh`/`logout` đọc token từ body (`RefreshTokenDto`, tùy chọn, chuỗi ≤128) và bỏ qua cookie; lỗi 401 không xóa cookie. Không có header → hành vi web giữ nguyên, body bị bỏ qua.
- `X-Client` không mở trong CORS → trang web khác không dùng được nhánh body. Xoay vòng, reuse-detection, rate limit, audit, `RefreshCookieOriginGuard` giữ nguyên (native không gửi Origin).
- Docs: `docs/architecture/05-security-rbac.md` §5.1, `06-api-contract.md` bảng auth.
- Kiểm chứng: `back-end` typecheck, lint; `auth-controller-http.spec.ts` 12/12 (6 test mới: login/refresh/logout native, bỏ qua cookie, body sai → 400, web bỏ qua body); `npm run test:core` 401/401.

## 5. Auth store (secure-store) + JWT access/refresh interceptor

- `src/core/auth/token-store.ts`: access token chỉ trong bộ nhớ; refresh token trong bộ nhớ + `expo-secure-store` (Expo web: chỉ bộ nhớ). `sessionId` đổi khi đăng nhập/đăng xuất, giữ nguyên khi xoay vòng.
- `src/core/auth/auth-schema.ts`, `auth-api.ts`: schema zod (login/2fa trả `refreshToken`), `authApi.login/loginTwoFactor/logout/me`; header `X-Client: mobile` chỉ gắn cho request auth (gắn toàn cục thì Expo web bị CORS chặn ở endpoint public).
- `src/core/api/http-client.ts`: gắn Bearer (trừ endpoint auth); 401 → refresh single-flight (body `{ refreshToken }`) → gửi lại 1 lần; refresh 401 hoặc vẫn 401 sau khi làm mới → kết thúc phiên; 429/5xx/mất mạng giữ phiên; đăng xuất trong lúc refresh → bỏ token trả về. `http.waitForRefresh()` cho đăng xuất.
- `src/core/auth/AuthProvider.tsx` + `useAuth`: trạng thái `restoring | signedIn | signedOut | unverified` (có phiên nhưng chưa xác minh được do mất mạng — giữ phiên, `retryRestore`), `login` (trả `mfaToken` nếu bật 2FA), `completeTwoFactor`, `logout` (xóa token cục bộ trước, thu hồi trên server nếu có mạng). Gắn vào `app/_layout.tsx`.
- Quy ước query: dữ liệu riêng người dùng dùng key `['session', ...]` (`SESSION_QUERY_KEY`) — không ghi ra đĩa, bị xóa khi đăng xuất; dữ liệu public giữ lại để xem offline.
- `jest-setup.ts`: mock AsyncStorage toàn cục (mọi test import query-client cần).
- Kiểm chứng: typecheck, lint sạch; 46 test core/config pass (token store 5, http-client auth 10, AuthProvider 7). Expo web: app khởi động, chuyển 4 tab, không lỗi auth/SecureStore.
- Giới hạn: refresh không thành công giữa chừng (server đã xoay vòng nhưng phản hồi mất do rớt mạng) → token đã lưu thành token cũ, lần refresh sau bị coi là tái dùng → phải đăng nhập lại. Đăng nhập trên Expo web không chạy được (CORS chặn `X-Client`), chỉ test được trên emulator/thiết bị.
- Phát hiện ngoài phạm vi: 2 test tích hợp GLB của TV4 (`glbLoader.integration.test.ts`, test AR placement) đọc file trong `back-end/public/media/uploads/` (gitignore) → lỗi trên mọi bản checkout không có file đó.
