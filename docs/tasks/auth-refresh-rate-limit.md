# Task: Rate limit /auth/refresh theo phiên, tách khỏi login

Người phụ trách: Nguyễn Văn Thắng. Issue #126. Nhánh `feat/refresh-rate-limit-per-session`.

## Bối cảnh

`AuthRateLimiter.consumeIp` dùng **chung 20 request/phút/IP** cho login và refresh. Front-end giữ access token trong bộ nhớ
nên mỗi lần tải lại trang (F5, mở tab, mở link) gọi `/auth/me` → 401 → `/auth/refresh`. Nhân viên ngồi chung IP văn phòng
dùng chung 20 lần/phút → có người bị 429 ở refresh → front-end coi như hết phiên → văng về trang đăng nhập. Phát hiện khi
chạy E2E cho task "Thùng rác và khôi phục" (#124).

## Thay đổi

| Request | Giới hạn mặc định (mỗi phút) | Env |
|---|---|---|
| Login | 20/IP + 5 lần sai/15 phút/email (giữ nguyên) | — |
| Mọi refresh | 300/IP — trần chống flood, kiểm trước khi chạm DB | `REFRESH_RATE_LIMIT_PER_IP` |
| Refresh có cookie khớp phiên | 30/phiên (family refresh token) | `REFRESH_RATE_LIMIT_PER_SESSION` |
| Refresh không có / sai cookie | 20/IP — chống dò token | `REFRESH_RATE_LIMIT_INVALID_PER_IP` |

- `AuthRateLimiter`: thêm `consumeRefreshIp`, `consumeRefreshSession`, `consumeRefreshInvalid` (bộ đếm riêng, tách khỏi login);
  ngưỡng đọc từ `jwt.refreshRateLimit`, thiếu cấu hình thì dùng mặc định. Gom logic cửa sổ trượt vào `consume()`.
- `TokenService.findSessionOwner(raw)`: tra phiên theo hash token (index unique `token_hash`) để đếm theo phiên trước khi
  xoay vòng; không kiểm hạn/thu hồi (việc của `rotate`).
- `AuthController.refresh`: trần IP → tra phiên → đếm theo phiên hoặc theo IP (cookie sai). Bị chặn ghi
  `auth.refresh_blocked` một lần mỗi phút cho mỗi khóa (`reason.limit` = `ip` | `session` | `invalid`; `resourceId` = chủ phiên).
  `limitLogin` gộp thành `limitWithAudit` dùng chung.
- Env mới có trong `.env.example` (và `.env` local, cùng vị trí dòng); validate 1–10000.

Ngoài phạm vi: bộ đếm vẫn trong bộ nhớ (1 instance) — nhiều instance cần Redis; front-end vẫn coi 429 ở refresh là hết phiên
(giờ chỉ xảy ra khi một phiên tự refresh quá 30 lần/phút).

## Kiểm chứng ngày 29/10/2026

- Back-end: lint, build đạt; `npm test` 2040/2040 với PostgreSQL 16 tạm; coverage lõi 95,79% line · 97,35% branch · 97,97% function.
- Test mới (`auth-rate-limit.spec.ts`): bộ đếm refresh độc lập với login; 30/phút/phiên, phiên khác không ảnh hưởng, hết cửa
  sổ mở lại; trần 300/IP; cookie sai 20/IP; đọc ngưỡng từ cấu hình; HTTP: 25 phiên chung IP refresh 50 lần không ai 429 và
  login của IP vẫn được; phiên dồn dập lần 31 → 429 + `Retry-After`, audit đúng 1 lần, phiên khác vẫn được; login vẫn 20/IP.
  `config.spec.ts`: mặc định, đọc env, giá trị sai bị từ chối.
- E2E Playwright (back-end + PostgreSQL tạm), 2 nhân viên ở 2 trình duyệt cùng IP tải lại trang 30 lần trong 22 giây:

  | | `dev` trước #126 | Sau #126 |
  |---|---|---|
  | `/auth/refresh` bị 429 | 14/30 | 0/30 |
  | Bị đưa về trang đăng nhập | có | không |
  | Login sai từ cùng IP bị 429 sau | 1 lần (refresh đã ăn hết hạn mức) | 19 lần (= 20 trừ 2 lần đăng nhập + 1) |
  | Đang dùng vẫn tải lại được khi login của IP bị chặn | không | có |
