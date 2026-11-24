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
| 5 | `feat/mob-auth-store` | Auth store secure-store + refresh interceptor | Đã merge (#214) |
| 6 | `feat/mob-file-cache` | File cache GLB/audio | Đã merge (#215) |
| 7 | `feat/mob-cache-policy` | Hạn mức + dọn cache | Đã merge (#216) |
| 8 | `feat/mob-retry-error-boundary` | Retry/backoff + error boundary | Đã merge (#217) |
| 9 | `feat/mob-api-error-log` | Log lỗi API tập trung | Đã merge (#218) |
| 10 | `feat/mob-offline-banner` | Offline catalogue + banner | PR mở |
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
- CORS chỉ cho origin front-end (không chặn riêng `X-Client`: thiếu `allowedHeaders` thì gói `cors` phản chiếu header); nhánh native không đọc cookie. Xoay vòng, reuse-detection, rate limit, audit, `RefreshCookieOriginGuard` giữ nguyên (native không gửi Origin).
- Docs: `docs/architecture/05-security-rbac.md` §5.1, `06-api-contract.md` bảng auth.
- Kiểm chứng: `back-end` typecheck, lint; `auth-controller-http.spec.ts` 12/12 (6 test mới: login/refresh/logout native, bỏ qua cookie, body sai → 400, web bỏ qua body); `npm run test:core` 401/401.

## 5. Auth store (secure-store) + JWT access/refresh interceptor

- `src/core/auth/token-store.ts`: access token chỉ trong bộ nhớ; refresh token trong bộ nhớ + `expo-secure-store` (Expo web: chỉ bộ nhớ). `sessionId` đổi khi đăng nhập/đăng xuất, giữ nguyên khi xoay vòng.
- `src/core/auth/auth-schema.ts`, `auth-api.ts`: schema zod (login/2fa trả `refreshToken`), `authApi.login/loginTwoFactor/logout/me`; header `X-Client: mobile` chỉ gắn cho request auth (request public giữ đơn giản, không cần preflight).
- `src/core/api/http-client.ts`: gắn Bearer (trừ endpoint auth); 401 → refresh single-flight (body `{ refreshToken }`) → gửi lại 1 lần; refresh 401 hoặc vẫn 401 sau khi làm mới → kết thúc phiên; 429/5xx/mất mạng giữ phiên; đăng xuất trong lúc refresh → bỏ token trả về. `http.waitForRefresh()` cho đăng xuất.
- `src/core/auth/AuthProvider.tsx` + `useAuth`: trạng thái `restoring | signedIn | signedOut | unverified` (có phiên nhưng chưa xác minh được do mất mạng — giữ phiên, `retryRestore`), `login` (trả `mfaToken` nếu bật 2FA), `completeTwoFactor`, `logout` (xóa token cục bộ trước, thu hồi trên server nếu có mạng). Gắn vào `app/_layout.tsx`.
- Quy ước query: dữ liệu riêng người dùng dùng key `['session', ...]` (`SESSION_QUERY_KEY`) — không ghi ra đĩa, bị xóa khi đăng xuất; dữ liệu public giữ lại để xem offline.
- `jest-setup.ts`: mock AsyncStorage toàn cục (mọi test import query-client cần).
- Kiểm chứng: typecheck, lint sạch; 46 test core/config pass (token store 5, http-client auth 10, AuthProvider 7). Expo web: app khởi động, chuyển 4 tab, không lỗi auth/SecureStore.
- Giới hạn: refresh không thành công giữa chừng (server đã xoay vòng nhưng phản hồi mất do rớt mạng) → token đã lưu thành token cũ, lần refresh sau bị coi là tái dùng → phải đăng nhập lại. Đăng nhập trên Expo web không chạy được (origin Expo web không được back-end cho phép), chỉ test được trên emulator/thiết bị.
- Phát hiện ngoài phạm vi: 2 test GLB của TV4 (`glbValidation.test.ts`, `ArArtifactPlacementView.test.tsx`) đọc file trong `back-end/public/media/uploads/` (gitignore) → lỗi trên mọi bản checkout không có file đó.

## 6. File cache service (expo-file-system) cho GLB/audio

- `src/core/cache/file-cache.ts`: `fileCache.getOrDownload(url, { kind: 'glb' | 'audio', key? })` → `{ uri: 'file://...', sizeBytes, fromCache }`; `get`, `remove`, `clear(kind?)`, `list`, `getUsage`.
  - Tải thẳng xuống đĩa (`downloadAsync`, không qua bộ nhớ JS) vào file `.part` rồi đổi tên → không còn file tải dở.
  - Gộp lời gọi đồng thời theo khóa (cả bước kiểm tra cache lẫn tải) → một file chỉ tải một lần.
  - Khóa: `key` ổn định do caller truyền (checksum/id media); mặc định SHA-256 của URL đã bỏ query/hash (URL presigned đổi chữ ký mỗi lần). Khóa chỉ nhận `[A-Za-z0-9_-]` (chống ghi ra ngoài thư mục cache).
  - Index JSON nằm trong thư mục cache (không dùng AsyncStorage như plan): hệ điều hành dọn cache thì index mất theo, không lệch; file bị xóa ngoài ý muốn → tải lại. Ghi index tuần tự (khóa promise).
  - Lỗi tải → `ApiException` (HTTP status, mất mạng = 0). Expo web không có file system → trả URL gốc.
- Hạn mức + dọn LRU: PR 7 (Media/image cache policy).
- Quan hệ với `features/scene3d/glbCache.ts` (TV4): cache đó nhận/trả `ArrayBuffer` qua base64 (cả file nằm trong bộ nhớ JS), thư mục riêng `aura-glb-cache/`, hạn mức riêng 150MB. Đề xuất TV4 chuyển `GlbCacheAdapter` sang dùng `fileCache` (kind `glb`, key = checksum) để có một nơi quản lý dung lượng; chưa sửa code TV4 trong PR này.
- Kiểm chứng: typecheck, lint sạch; 11 test `file-cache.test.ts` (tải một lần, presigned URL, đồng thời, khởi động lại, LRU timestamp, HTTP lỗi không để file dở, mất mạng, file bị OS xóa, remove/clear/usage, khóa độc hại, web).

## 7. Media/image cache policy + quản lý dung lượng

- `src/core/cache/cache-policy.ts`:
  - `CACHE_LIMITS`: GLB 500MB, audio 200MB (đề xuất, chỉnh khi có số liệu thiết bị).
  - `selectEvictions(entries, limit, keep)`: LRU thuần — xóa file ít dùng gần đây nhất trước, vừa đủ về dưới hạn mức; không xóa file trong `keep`.
  - `IMAGE_CACHE_POLICY = 'memory-disk'` cho `expo-image` (TV3 dùng khi hiển thị ảnh catalogue); `clearImageCache()` xóa RAM + đĩa. Không đo được dung lượng cache ảnh (expo-image không có API), hệ điều hành tự dọn khi thiếu chỗ.
- `FileCache`: hạn mức theo loại (ghi đè qua `limits`), tự `enforceLimit(kind, keep)` sau mỗi lần tải — giữ file vừa tải kể cả khi riêng nó vượt hạn mức; hạn mức từng loại độc lập.
- Thêm `expo-image` (đúng tech-stack: "Ảnh: expo-image (cache sẵn)").
- Chưa gộp: `glbCache` của TV4 có hạn mức riêng 150MB, không nằm trong `CACHE_LIMITS` (xem mục 6).
- Kiểm chứng: typecheck, lint sạch; 8 test mới (`cache-policy.test.ts`: LRU, giữ file vừa tải, hạn mức theo loại, byte giải phóng, xóa cache ảnh) + 11 test file cache cũ pass.

## 8. Retry/backoff + error boundary toàn cục

- `src/core/api/retry.ts` (chuyển `shouldRetry` từ query-client sang): thử lại lỗi tạm thời (mất mạng, 5xx, 408, 429) tối đa 3 lần (trước là 2); `retryDelay` lũy thừa 1s→2s→4s… trần 30s, jitter trong [nửa khoảng, khoảng]; ưu tiên `Retry-After` của server; server bắt chờ > 30s thì báo lỗi luôn. Gắn vào `queryClient` (`retry`, `retryDelay`); mutation vẫn không retry (không idempotent).
- `ApiException.retryAfterMs` đọc từ header `Retry-After` (số giây hoặc ngày HTTP) — `parseRetryAfter`.
- `src/components/feedback/AppErrorFallback.tsx` + `export function ErrorBoundary` ở `app/_layout.tsx`: lỗi render ở bất kỳ màn nào → màn "Đã xảy ra sự cố" có nút Thử lại (re-render route) thay vì crash. Tự dựng theme theo hệ điều hành (có thể hiện ngoài ThemeProvider). Thông điệp thân thiện (mất mạng / lỗi chung), chi tiết lỗi chỉ hiện ở bản dev. A11y: tiêu đề `header`, lý do lỗi `alert` + live region, nút 48dp.
- Lỗi query của react-query không ném lên boundary (mặc định `throwOnError: false`) → màn tự hiển thị trạng thái lỗi; boundary là lưới an toàn cuối cùng.
- Gửi lỗi về Sentry: PR Sentry (MOB-E13-01).
- Kiểm chứng: typecheck, lint sạch; 13 test mới (`retry.test.ts`: retry/backoff/Retry-After; `AppErrorFallback.test.tsx`: route ném lỗi qua `renderRouter` → hiện màn lỗi → Thử lại render lại). Expo web: app khởi động bình thường; route tạm ném lỗi → hiện màn lỗi, app không sập.

## 9. Log API lỗi tập trung

- `src/core/observability/api-error-log.ts`: `apiErrorLog` — bộ đệm vòng 50 lỗi gần nhất (`getRecent`), tổng hợp theo method + endpoint + status (`getSummary`), sink cắm thêm (`addSink`; console khi dev, Sentry ở PR Sentry). Sink lỗi không làm hỏng luồng gọi API.
- Bản ghi: thời điểm, method, endpoint đã chuẩn hóa (`/rooms/:id` — bỏ origin, query, hash; UUID/số/hex dài → `:id`), status (0 = mất mạng), mã lỗi đầu tiên của back-end, message, thời lượng, `X-Request-Id` (đối chiếu log server). Không ghi body, header, query, token.
- `http-client`: mọi lỗi đi qua `fail()` → chuẩn hóa + ghi log một lần (WeakSet, request gửi lại sau refresh không ghi trùng); request bị hủy không ghi; 401 được refresh xử lý êm thì không ghi.
- Ngoài phạm vi: `features/scene3d/publicRoomApi.ts` (TV4) gọi `fetch` trực tiếp nên lỗi của nó không vào log — nên chuyển sang `http`.
- Kiểm chứng: typecheck, lint sạch; 9 test mới (chuẩn hóa endpoint, bộ đệm vòng, tổng hợp, sink lỗi; tích hợp http-client: request id, mất mạng/hủy, refresh êm không ghi, không ghi trùng, không lộ token/body/query).

## 10. Offline catalogue (persist) + banner trạng thái

- `src/core/network/online-status.ts`: native nối `onlineManager` của react-query với NetInfo (`isInternetReachable` chưa biết → coi như online); `useIsOnline()`. Web dùng sự kiện online/offline sẵn có. Offline: query **tạm dừng** (không báo lỗi), dữ liệu cache vẫn hiện; có mạng lại tự tải.
- `src/components/feedback/OfflineBanner.tsx` (`OfflineAware`, bọc Stack ở `app/_layout.tsx`): banner trên cùng "Không có mạng — đang hiển thị nội dung đã tải trước đó.", tự chiếm vùng tai thỏ và đặt inset trên = 0 cho màn bên dưới (header không đệm hai lần); cây component giữ nguyên khi đổi trạng thái → navigation không bị dựng lại. A11y: `alert` + live region polite.
- `src/features/catalogue/room-queries.ts`: `roomKeys`, `useRoomsQuery`, `useRoomQuery` (dùng lại `publicRoomApi` của TV4) → catalogue đi qua react-query nên được lưu cache (MOB-E3-02). `isWaitingForNetwork`: offline mà chưa có cache → báo rõ thay vì quay vòng mãi.
- Chuyển màn của TV4 sang query (giữ nguyên giao diện/kiểu trả về): `app/(tabs)/rooms.tsx`, `usePublicRoom` (`room/[slug]`, `ar-exhibit` không phải sửa). Có dữ liệu thì luôn hiện, lỗi làm mới nền không che nội dung; Thử lại không hiện lỗi cùng lúc với vòng quay.
- Ghi chú cho TV3 (MOB-E4-01 roomsApi + useRooms/useRoom): xây tiếp trên `room-queries.ts`; nên chuyển `publicRoomApi` từ `fetch` sang `http` để có retry/log lỗi.
- `jest-setup.ts`: mock NetInfo toàn cục.
- Kiểm chứng: typecheck, lint sạch; 10 test mới (online-status, banner + không remount + inset, catalogue offline có/không cache, có mạng lại tự tải, lỗi API + thử lại). Expo web + Playwright (API giả bằng `page.route`, không cần back-end): tải danh sách → cache vào storage → API chết + reload → danh sách vẫn hiện, sự kiện offline → banner hiện, online → banner ẩn; không lỗi trang.

## Bổ sung sau PR 10: lưu cache query bằng file

- `src/core/query/query-storage.ts`: native ghi cache vào file trong `documentDirectory` (ghi file tạm rồi đổi tên, thao tác tuần tự); web giữ AsyncStorage. Lý do: cả cache nằm trong một key, catalogue nhiều phòng có thể vượt giới hạn AsyncStorage trên Android.
- Sửa lỗi: query đã có dữ liệu nhưng lần làm mới nền thất bại (`status: error`) trước đây bị loại khỏi cache đĩa → mất nội dung offline sau khi mở lại app.
- Kiểm chứng: typecheck, lint; 6 test mới (test lỗi trên đỏ trước khi sửa); bundle Android + web; E2E web: dữ liệu cũ + API chết + reload hai lần vẫn hiện danh sách. Chưa chạy trên thiết bị.
