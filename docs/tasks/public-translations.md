# Task: Nối bản dịch CMS cho khách

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/public-translations`.

## Cập nhật — 06/11/2026

Follow-up `feat/public-ui-internationalization` mở rộng catalog public từ 13 lên 347 khóa `ui.*` có cặp `vi/en`: 331 khóa tham chiếu tĩnh, 7 khóa report tạo động và 9 khóa ghi công media. Khóa cũ được giữ nguyên và seed dùng `.orIgnore()` để tránh ghi đè bản dịch CMS. Nhãn AudioPlayer, report modal, Collection, Detail và Tour đã được nối với locale hiện có. Audio asset, transcript và track phụ đề vẫn theo dữ liệu hiện có.

Kiểm chứng follow-up: `test:translations` 11/11; `test:seed` 11/11; backend typecheck/lint/build PASS. Các browser regression sau review dùng API mock và PASS. Seed hai lần trên DB cô lập chưa chạy vì không có DB cô lập được cấu hình/phê duyệt; không chạy migration hoặc seed trong follow-up này.

## Bối cảnh

Admin nhập được bản dịch trong CMS (vi/en/fr/ja/zh), nhưng API `/translations` cần quyền nên khách không thấy gì. Trang công
khai cũng chưa có chỗ chọn ngôn ngữ.

## Thay đổi

- Back-end:
  - `GET /public/translations?locale=` trả `{ namespace: text }`, **chỉ loại `ui`**. Chuỗi `exhibit`/`room` có thể thuộc nội
    dung chưa duyệt, mở ra sẽ bỏ qua kiểm duyệt;
  - bản đầu thêm 13 chuỗi giao diện `vi/en`; follow-up 06/11/2026 mở rộng tổng số lên 347 khóa `ui.*` (331 tham chiếu tĩnh, 7 khóa report tạo động, 9 khóa ghi công media).
- Front-end:
  - `core/i18n/public-locale.tsx`: `PublicLocaleProvider` + `usePublicLocale()`. Lựa chọn lưu trên trình duyệt, đồng bộ
    `<html lang>`. `t(key, tiếng Việt)` luôn có dự phòng, nên chuỗi chưa dịch hay API lỗi vẫn hiện tiếng Việt;
  - ô chọn ngôn ngữ: ở header từ màn hình `sm`, trong menu Drawer ở điện thoại (tránh tràn ngang 320px);
  - tên/mô tả hiện vật lấy từ `i18n` của revision đã xuất bản (`localizeExhibit`); hiện chỉ có vi/en.

Giới hạn còn lại:
- Tên và mô tả phòng chưa dịch (bảng `rooms` chưa có trường đa ngôn ngữ).
- Nội dung thuyết minh/audio, transcript và WebVTT chưa đổi theo locale; chỉ nhãn điều khiển AudioPlayer được dịch.
- Guided Tour tự động chưa triển khai.

## Vận hành

Cần seed catalog để CMS/API có 347 khóa; chưa seed thì giao diện vẫn dùng fallback trong front-end. `npm run seed` còn tạo dữ liệu RBAC/admin/API key mẫu, nên chỉ chạy trong môi trường đã xác định và được phép. Muốn thêm bản dịch, Admin cập nhật các chuỗi `ui.*` trong CMS.

## Kiểm chứng lịch sử — 04/11/2026

- Back-end: lint, typecheck đạt; `npm test` 2183/2183 với PostgreSQL 16 tạm (0 skip, 0 cancelled). `public-translations.spec.ts`:
  chỉ loại `ui`, bỏ chuỗi trống, `exhibit`/`room` không lộ, locale sai 400, route `@Public`.
- Front-end: lint, build đạt; vitest 219/219. Playwright `public-language.spec.ts` 4/4: mặc định không gọi API; đổi English đổi
  giao diện, hiện vật, `html lang`; chuỗi chưa dịch giữ tiếng Việt, không hiện khóa; lựa chọn còn sau khi tải lại; API lỗi vẫn
  dùng được; trang chi tiết; 320px không tràn. Các spec collection/visitor/report: 46 pass.
- Chạy thật (PostgreSQL tạm): seed 2 lần không trùng; API không có `exhibit.*`; `locale=xx` → 400; giao diện đổi sang tiếng Anh
  với hiện vật song ngữ thật.
