# Task: Đa ngôn ngữ cho nội dung hiện vật

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/exhibit-content-i18n-api`, `feat/exhibit-content-i18n-web`.

## Bối cảnh

Nội dung hiện vật chỉ có `vi`, `en`. Module `translations` chỉ phục vụ chuỗi giao diện và cố ý không công khai chuỗi `exhibit`, vì có thể lộ nội dung chưa duyệt. API hiện vật không nhận tham số ngôn ngữ.

## Quyết định

- 6 ngôn ngữ: `vi, en, fr, zh, ko, ja`. `fr, zh, ko, ja` không bắt buộc khi gửi duyệt; `vi`, `en` vẫn bắt buộc.
- Dịch tên, mô tả, thuyết minh, alt text ảnh, hotspot. Audio và phụ đề giữ `vi`, `en`.
- Mở rộng object sẵn có trong JSONB `content` và chuỗi JSON của hotspot: không có migration, bản dịch đi theo revision nên qua kiểm duyệt.

## Thay đổi back-end

- `translations/constants/locales.ts`: thêm `ko`, `OPTIONAL_CONTENT_LOCALES`, `LOCALE_LABELS`.
- `pickLocale` chọn `lang → vi → en`. Query `?lang=` xem `docs/architecture/06-api-contract.md`.
- Tìm kiếm công khai quét đủ 6 ngôn ngữ.
- Sửa lỗi diff kiểm duyệt: `name`, `description` dạng object hiện `[object Object]` và không bao giờ báo thay đổi. Diff giờ tách theo ngôn ngữ, thêm alt text.

## Giới hạn

- Tên và mô tả phòng chưa đa ngôn ngữ.
- Hotspot chưa có trong diff kiểm duyệt.
- PATCH thay nguyên object `name`: client phải gửi đủ ngôn ngữ, nếu không bản dịch bị mất.
