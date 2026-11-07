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

## Tour 3D (`feat/public-ui-i18n-tour`)

- Dịch `MuseumPage`, `MuseumScene` và các panel tour, gồm cả chữ vẽ trên canvas trong cảnh 3D (bảng tên hiện vật, bảng VR). react-three-fiber 8 tự truyền context vào `<Canvas>` nên `usePublicT()` dùng được bên trong.
- Thông báo VR sinh ở `xrSession` (không có React): giữ nguyên, tra bảng `key`/`label` lúc hiển thị.
- Dịch thêm khung ảnh thay thế (`ExhibitPreview`) và màn hình lỗi chung (`ErrorBoundary`).
- Không dịch: `MuseumAuditPanel` (công cụ đo cho dev), nút "Enter VR"/"Exit VR" (vốn là tiếng Anh ở mọi ngôn ngữ).
- Đổi ngôn ngữ khi đã chọn hiện vật: hiện vật đang chọn và mô hình giữ nguyên (theo id và checksum); nếu người dùng chưa di chuyển, camera có thể lấy nét lại đúng hiện vật đó. Khi tour mở toàn màn hình thì không đổi được ngôn ngữ.

## Bổ sung chỗ còn sót (`fix/public-i18n-gaps`)

- Tiêu đề tab theo trang và ngôn ngữ (`usePageTitle`), mô tả trang theo ngôn ngữ (`usePageDescription`). `index.html` vẫn giữ tiếng Việt cho lần tải đầu.
- Lỗi tải mô hình 3D từ `roomModelAssets` dịch lúc hiển thị bằng bảng `key`/`label`.
- Ảnh kỷ niệm trong tour: chữ in trên ảnh và định dạng ngày theo ngôn ngữ.
- Nhãn khung 3D cho trình đọc màn hình theo ngôn ngữ.
- Xóa `sampleDisplays.ts` (không còn dùng).
- Thêm chuỗi mới: sửa trực tiếp `back-end/src/database/seeds/public-ui-strings.ts`.

