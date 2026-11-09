# Task: Sitemap cho công cụ tìm kiếm và tắt server an toàn

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/sitemap-shutdown`.

## Sitemap

- `GET /api/public/sitemap.xml` (`@Public()`): trả XML theo chuẩn sitemap 0.9, không bọc `ApiResponse`, header `Cache-Control: public, max-age=3600`.
- Gồm: `/`, `/collection`, `/tour`, `/collection?room=<slug>` cho mỗi phòng active, `/collection/<slug>/exhibits/<id>` cho mỗi hiện vật công khai (đã xuất bản, đang hiển thị, chưa xóa, phòng active — cùng điều kiện với tìm kiếm công khai).
- `lastmod`: phòng dùng thời điểm cập nhật; hiện vật dùng thời điểm duyệt bản đang xuất bản.
- Tối đa 50.000 URL (giới hạn của chuẩn). Vượt mức này thì cần tách sitemap index.
- URL tuyệt đối lấy từ `FRONTEND_ORIGIN` (back-end).
- `robots.txt` của front-end: khi `vite build` với `VITE_API_BASE_URL` là URL tuyệt đối (`https://...`), bản build tự thêm dòng `Sitemap: <VITE_API_BASE_URL>/public/sitemap.xml`. Dùng đường dẫn tương đối (`/api`) thì không thêm, vì `Sitemap:` bắt buộc URL tuyệt đối.

## Tắt server an toàn

- `main.ts` gọi `app.enableShutdownHooks()`: khi nhận SIGTERM/SIGINT (deploy lại, dừng container), Nest chạy hook tắt của các module và đóng pool kết nối Postgres trước khi thoát.
- Đã kiểm: bật hook thì DataSource được đóng trước khi tiến trình thoát; không bật thì tiến trình thoát khi kết nối DB vẫn mở.

## Checklist khi deploy production

- [ ] `FRONTEND_ORIGIN` là domain trang khách (đã có trong checklist mã QR).
- [ ] Build front-end với `VITE_API_BASE_URL` tuyệt đối, hoặc tự thêm dòng `Sitemap:` vào `robots.txt` nếu API dùng đường dẫn tương đối qua reverse proxy.
- [ ] Mở `<api>/public/sitemap.xml` trên production, kiểm URL đúng domain, rồi khai báo trong Google Search Console.

## Kiểm thử

- Unit: `sitemap-xml.spec.ts` (URL tuyệt đối, escape XML, giới hạn 50.000).
- Tích hợp DB: `exhibit-translations.integration.spec.ts` — sitemap chỉ chứa hiện vật công khai.
