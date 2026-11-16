# Task: Giới hạn tần suất gọi API công khai

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/public-rate-limit`.

## Bối cảnh

Đăng nhập, refresh, báo cáo nội dung và cổng đối tác đã có rate limit, nhưng các API khách tham quan (phòng, tìm kiếm, bản dịch, sitemap, media, GLB) chưa có. Bot cào dữ liệu hoặc dội request có thể làm nghẽn DB và băng thông tải media.

## Thay đổi

- `PublicRateLimiter` (`back-end/src/common/rate-limit/`), đăng ký trong `CommonModule`: đếm theo IP (`req.ip`, phụ thuộc `TRUST_PROXY`) trong cửa sổ cố định 1 phút.
- `PublicRateLimitGuard` gắn vào các controller công khai, với 2 nhóm:
  - **api**: `/rooms`, `/rooms/search`, `/rooms/:slug`, `/public/rooms*`, `/public/exhibits/:id/location`, `/public/translations`, `/public/sitemap.xml`. Mặc định 600 request/phút/IP.
  - **media**: tệp media công khai và GLB `/rooms/:slug/exhibits/:id/model`. Mặc định 3000 request/phút/IP, vì một trang phòng tải nhiều ảnh, audio (mỗi lần tua là một request Range) và mô hình.
- Vượt ngưỡng → 429 kèm `Retry-After`; mọi response có `X-RateLimit-Limit`, `X-RateLimit-Remaining`.
- Không đổi: `/health`, `/auth/*` (đã có `AuthRateLimiter`), `/public/reports` (vẫn 5/phút), cổng đối tác.

## Vì sao ngưỡng rộng

Khách trong bảo tàng dùng chung Wi-Fi nên chung một IP công khai. Một đoàn 40 người mở cùng một phòng có thể tạo vài trăm request API và vài nghìn request media mỗi phút. Ngưỡng mặc định nhằm chặn bot, không chặn đoàn khách. Nếu bảo tàng có đoàn đông hơn, tăng biến môi trường thay vì sửa code.

## Cấu hình (back-end)

- `PUBLIC_API_RATE_LIMIT` (1–100000, mặc định 600)
- `PUBLIC_MEDIA_RATE_LIMIT` (1–100000, mặc định 3000)

## Checklist khi deploy production

- [ ] `TRUST_PROXY` đặt đúng theo reverse proxy. Sai thì mọi khách bị tính chung IP của proxy và chạm ngưỡng rất nhanh.
- [ ] Chạy một instance back-end, hoặc chấp nhận mỗi instance đếm riêng (ngưỡng thực tế nhân theo số instance). Cần đếm chung thì phải chuyển sang Redis.
- [ ] Theo dõi log 429 tuần đầu; nếu khách thật bị chặn thì tăng hai biến trên.

## Kiểm thử

- `src/common/tests/public-rate-limit.spec.ts`: cửa sổ và thời gian chờ, đếm riêng theo IP và nhóm, dọn bộ nhớ, HTTP 429 + header, GLB tính vào nhóm media.
- `config.spec.ts`: giá trị mặc định, đọc env, từ chối giá trị ngoài khoảng.
- Chạy thật với `PUBLIC_API_RATE_LIMIT=3`: request thứ 4 tới `/api/rooms` trả 429, `Retry-After: 60`; `/api/health` vẫn 200.
