# Task: Refresh lỗi tạm thời không đăng xuất người dùng

Người phụ trách: Nguyễn Văn Thắng. Issue #128 (sau #126/#127). Nhánh `fix/fe-refresh-transient-errors`.

## Bối cảnh

`refreshAccessToken` (`front-end/src/core/api/http-client.ts`) và bước khôi phục phiên khi tải trang
(`core/auth/auth.context.tsx`) gọi `tokenStore.clear()` với **mọi** lỗi của `/auth/refresh` → người dùng bị đưa về trang
đăng nhập kể cả khi phiên còn hợp lệ (429 do giới hạn, 5xx, mất mạng).

## Thay đổi

- `endsSession(error)` (`core/api/api-error.ts`): chỉ 401 là hết phiên.
- `http-client`: refresh lỗi khác 401 → giữ access token và refresh cookie; request đang chờ báo lỗi; lần sau người dùng
  thao tác thì refresh lại. 429 báo "Làm mới phiên quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau N giây."
  theo `Retry-After`.
- Khôi phục phiên khi tải trang: 401 → đăng xuất như cũ; lỗi tạm thời → `restoreError` trong AuthContext,
  `RequireAuth` hiện "Chưa khôi phục được phiên đăng nhập" + nút **Thử lại** (`retryRestore`) và **Đăng nhập lại**,
  không đá về trang đăng nhập.
- Back-end `main.ts`: CORS `exposedHeaders: ['Retry-After']` — trước đó front-end khác origin không đọc được header này
  (E2E phát hiện: thông báo chỉ ghi "sau ít phút").

## Kiểm chứng ngày 29/10/2026

- Front-end: typecheck, build đạt; lint 0 lỗi (1 cảnh báo có sẵn); vitest 179/179. Test mới `core/api/http-client.test.ts`
  (adapter axios giả): refresh 401 → hết phiên; 429 (có/không Retry-After), 500, mất mạng → giữ phiên; sau 429 refresh
  được thì dùng tiếp. Chạy cùng test với `http-client.ts` cũ: 4/6 fail (đúng lỗi cần sửa).
- E2E Playwright (back-end thật, `REFRESH_RATE_LIMIT_PER_SESSION=2` để chủ động gây 429), 6/6: 2 lần tải lại đầu vào
  được; lần 3 refresh 429 nhưng vẫn ở `/admin/users`, hiện thông báo "thử lại sau 60 giây" + nút Thử lại / Đăng nhập lại;
  sau 1 phút bấm Thử lại vào lại trang không cần đăng nhập.
