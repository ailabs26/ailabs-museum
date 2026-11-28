# 11 — Đa ngôn ngữ (CMS i18n) và Cổng API Đối tác (`modules/translations/`, `modules/partner-api-keys/`)

> Mã nguồn: `back-end/src/modules/translations/` và `back-end/src/modules/partner-api-keys/`.

## 1. Module Bản dịch Đa ngôn ngữ (`TranslationsModule`)

Quản lý toàn bộ chuỗi giao diện đa ngôn ngữ cho trang khách và CMS, đồng bộ 6 mã ngôn ngữ với front-end (`translations/constants/locales.ts`):

- **`SUPPORTED_LOCALES`**: `vi` (ngôn ngữ gốc), `en`, `fr`, `zh`, `ko`, `ja`.
- **`OPTIONAL_CONTENT_LOCALES`**: `fr`, `zh`, `ko`, `ja` (khi xuất bản hiện vật, thiếu các ngôn ngữ này sẽ tự động fallback về `vi`).
- **`sanitizeValues()`**: lọc map JSONB từ client để chỉ giữ các khóa nằm trong `SUPPORTED_LOCALES`, ép kiểu chuỗi và `trim()` khoảng trắng thừa trước khi lưu DB.

### Entity `Translation` (`translations`) & Endpoint
- Bảng `translations` lưu khóa chuỗi (`key` duy nhất, có phân nhóm namespace) cùng cột JSONB `values` chứa bản dịch theo từng locale.
- **Public (`PublicTranslationsController`)**:
  - `GET /api/public/translations` (`@Public()`, `PublicRateLimitGuard`): trả từ điển chuỗi giao diện công khai cho Web/Mobile visitor.
- **Admin (`TranslationsController` — `/api/translations`)**:
  - `GET /api/translations` (`translation:read`): liệt kê, tìm kiếm và lọc chuỗi dịch.
  - `POST /api/translations`, `PATCH /api/translations/:id`, `DELETE /api/translations/:id` (`translation:manage`, gắn `@Audit(...)`): tạo, sửa hoặc xóa bản dịch từ giao diện CMS i18n.
