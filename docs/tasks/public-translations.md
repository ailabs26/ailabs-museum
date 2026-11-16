# Task: Nối bản dịch CMS cho khách

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/public-translations`.

## Bối cảnh

Admin nhập được bản dịch trong CMS (vi/en/fr/ja/zh), nhưng API `/translations` cần quyền nên khách không thấy gì. Trang công
khai cũng chưa có chỗ chọn ngôn ngữ.

## Thay đổi

- Back-end:
  - `GET /public/translations?locale=` trả `{ namespace: text }`, **chỉ loại `ui`**. Chuỗi `exhibit`/`room` có thể thuộc nội
    dung chưa duyệt, mở ra sẽ bỏ qua kiểm duyệt;
  - seed thêm 13 chuỗi giao diện (vi + en), chạy lại an toàn và không ghi đè bản dịch Admin đã sửa.
- Front-end:
  - `core/i18n/public-locale.tsx`: `PublicLocaleProvider` + `usePublicLocale()`. Lựa chọn lưu trên trình duyệt, đồng bộ
    `<html lang>`. `t(key, tiếng Việt)` luôn có dự phòng, nên chuỗi chưa dịch hay API lỗi vẫn hiện tiếng Việt;
  - ô chọn ngôn ngữ: ở header từ màn hình `sm`, trong menu Drawer ở điện thoại (tránh tràn ngang 320px);
  - tên/mô tả hiện vật lấy từ `i18n` của revision đã xuất bản (`localizeExhibit`); hiện chỉ có vi/en.

Chưa làm:
- Mới nối 14 chuỗi chính (menu, header, chân trang, đầu trang Bộ sưu tập). Còn lại vẫn tiếng Việt: trang chủ, trang chi tiết,
  khối so sánh, yêu thích, thông báo trạng thái, trang tham quan 3D.
- Tên và mô tả phòng chưa dịch (bảng `rooms` chưa có trường đa ngôn ngữ).
- Audio và phụ đề vẫn theo tiếng Việt.

## Vận hành

Cần chạy `npm run seed` để có 13 chuỗi mới; chưa seed thì trang vẫn chạy bằng tiếng Việt. Muốn thêm ngôn ngữ, Admin dịch các
chuỗi `ui.*` trong CMS.

## Kiểm chứng ngày 04/11/2026

- Back-end: lint, typecheck đạt; `npm test` 2183/2183 với PostgreSQL 16 tạm (0 skip, 0 cancelled). `public-translations.spec.ts`:
  chỉ loại `ui`, bỏ chuỗi trống, `exhibit`/`room` không lộ, locale sai 400, route `@Public`.
- Front-end: lint, build đạt; vitest 219/219. Playwright `public-language.spec.ts` 4/4: mặc định không gọi API; đổi English đổi
  giao diện, hiện vật, `html lang`; chuỗi chưa dịch giữ tiếng Việt, không hiện khóa; lựa chọn còn sau khi tải lại; API lỗi vẫn
  dùng được; trang chi tiết; 320px không tràn. Các spec collection/visitor/report: 46 pass.
- Chạy thật (PostgreSQL tạm): seed 2 lần không trùng; API không có `exhibit.*`; `locale=xx` → 400; giao diện đổi sang tiếng Anh
  với hiện vật song ngữ thật.
