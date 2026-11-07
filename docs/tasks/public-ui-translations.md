# Task: Dịch toàn bộ trang Client

Người phụ trách: Nguyễn Văn Thắng.

## Bối cảnh

Nội dung hiện vật đã có 6 ngôn ngữ, nhưng chữ giao diện trang Client và tên phòng vẫn chỉ có tiếng Việt.

## Bản dịch phòng (`feat/room-translations`)

- Migration `AddRoomTranslations` thêm `rooms.translations` (jsonb). `name`, `description` vẫn là tiếng Việt, dữ liệu cũ không đổi.
- Form phòng ở CMS có phần "Bản dịch". Phòng không có revision nên lưu là có hiệu lực ngay, có `@Audit` như trước.
- API công khai và đối tác nhận `?lang=`, xem `docs/architecture/06-api-contract.md`.
- Front-end dịch trong `useMuseumRooms` bằng `select`, nên đổi ngôn ngữ không tải lại dữ liệu.

## Nền tảng dịch giao diện (`feat/public-ui-i18n-core`)

- `t(key, chữ dự phòng, params?)` thay `{name}` trong chuỗi. Mọi ngôn ngữ, kể cả tiếng Việt, đọc từ `/public/translations`; chưa tải xong hoặc lỗi thì dùng chữ dự phòng.
- Chuỗi nằm ở `back-end/src/database/seeds/public-ui-strings.ts`. `npm run seed:translations` chỉ đụng bảng `translations`: thêm key thiếu, điền ngôn ngữ còn thiếu, không ghi đè bản Admin đã sửa.
- `public-ui-strings.spec.ts` chặn lệch: mọi `t('ui.x', 'chữ')` phải có trong seed với `vi` trùng chữ dự phòng, đủ 6 ngôn ngữ, tham số giống nhau.
- Thêm chuỗi mới: gọi `t()` trong code, thêm dòng vào seed, chạy `seed:translations`.

## Các trang khách (`feat/public-ui-i18n-pages`)

- Dịch bộ sưu tập, chi tiết hiện vật, công cụ khách (so sánh, ghi chú, đã xem, cỡ chữ, yêu thích), báo nội dung, `AudioPlayer`, ghi công media và nút sáng tối.
- Component dùng chung với admin dùng `usePublicT()`: không cần provider, ở admin hiện chữ dự phòng.
- Lỗi từ service viết bằng tiếng Việt: `usePublicErrorText()` giữ câu chi tiết khi xem tiếng Việt, ngôn ngữ khác hiện câu chung đã dịch.
- `MediaPreview` chỉ dùng ở admin nên không dịch.

