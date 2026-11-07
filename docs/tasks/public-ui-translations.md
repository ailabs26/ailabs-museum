# Task: Dịch toàn bộ trang Client

Người phụ trách: Nguyễn Văn Thắng.

## Bối cảnh

Nội dung hiện vật đã có 6 ngôn ngữ, nhưng chữ giao diện trang Client và tên phòng vẫn chỉ có tiếng Việt.

## Bản dịch phòng (`feat/room-translations`)

- Migration `AddRoomTranslations` thêm `rooms.translations` (jsonb). `name`, `description` vẫn là tiếng Việt, dữ liệu cũ không đổi.
- Form phòng ở CMS có phần "Bản dịch". Phòng không có revision nên lưu là có hiệu lực ngay, có `@Audit` như trước.
- API công khai và đối tác nhận `?lang=`, xem `docs/architecture/06-api-contract.md`.
- Front-end dịch trong `useMuseumRooms` bằng `select`, nên đổi ngôn ngữ không tải lại dữ liệu.
