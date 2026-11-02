# Task: Giao báo cáo vi phạm cho người khác + thông báo

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/report-assign-others`. Tiếp nối task "Thông báo trong CMS".

## Bối cảnh

`POST /reports/:id/assign` trước đây chỉ cho người xử lý **tự nhận** báo cáo. Vì vậy không có cách giao việc cho người
khác, và thông báo "Báo cáo được giao cho tôi" không có chỗ nào để gửi.

## Thay đổi

Back-end:
- `POST /reports/:id/assign` nhận body tùy chọn `{ assigneeId }`. Bỏ trống thì tự tiếp nhận như cũ, nên tương thích ngược.
  Người được giao phải là user active có `report:resolve`, nếu không thì 400 `invalid_assignee`.
- Cho phép giao khi báo cáo đang mở **hoặc** đang xử lý (giao lại khi người cũ vắng). Giao trùng người đang giữ → 409.
- `GET /reports/assignees`: danh sách người có thể được giao (đặt trước `:id`).
- Người được giao (khác người giao) nhận thông báo `report.assigned`, ví dụ "Administrator giao cho bạn báo cáo về La bàn cổ",
  `body` là nội dung báo cáo.
- Sửa lỗi có từ trước: response của assign trả quan hệ `assignedTo` cũ (null hoặc người trước), nay trả đúng người mới.
- Gom truy vấn "user active có quyền X" về `UsersRepository.findActiveWithPermission`, dùng chung cho người nhận thông báo
  và danh sách người được giao.

Front-end (`ReportsPage`):
- Drawer chi tiết có ô chọn "Giao cho người khác" (đang xử lý thì là "Giao lại cho"), tìm kiếm được, kèm nút "Giao". Người
  đang giữ báo cáo bị loại khỏi danh sách. Nút "Tiếp nhận" giữ nguyên.
- Chuông thông báo có icon cho `report.assigned`.

## Kiểm chứng ngày 02/11/2026

- Back-end: lint, typecheck đạt; `npm test` 2130/2130 với PostgreSQL 16 tạm (0 skip); coverage lõi 95,12%. Test mới: service
  (tự nhận, giao người khác, người không có quyền → 400 không lưu không báo, giao lại, giao trùng → 409, đã đóng → 409,
  response đúng người mới), HTTP (body rỗng / `assigneeId` / sai định dạng / thừa field, `assignees` không bị bắt nhầm
  thành `:id`), thông báo `reportAssigned` (tự nhận thì không báo).
- Front-end: lint, typecheck, build đạt; vitest 215/215; Playwright `tests/cms-report-assign.spec.ts` 2/2.
- Smoke trên app thật (PostgreSQL tạm): danh sách người được giao chỉ gồm admin và moderator (editor không có quyền);
  giao cho editor → 400; giao cho moderator → in_progress, moderator nhận thông báo; giao trùng → 409; moderator giao
  lại cho admin → admin nhận thông báo; audit ghi 2 lần `report.assign`.

Ghi chú: `tests/cms-e2e-reports.spec.ts` đã hỏng từ trước (fixture thiếu `/auth/refresh`, tên nút theo UI cũ như "Tiếp nhận
xử lý"); spec đó không đổi ở task này.
