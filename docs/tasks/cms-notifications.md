# Task: Thông báo trong CMS (chuông): đọc, xóa, "Xem thêm"

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/notifications`.

## Bối cảnh

Chuông thông báo trước đây chỉ hiện 2 con số tổng (bản chờ duyệt, báo cáo mở) lấy từ `/admin/stats/overview`, không có
thông báo thật nên không thể đánh dấu đã đọc hay xóa. Task này làm thông báo thật, lưu theo từng người dùng.

## Thay đổi

Back-end, module `notifications`:
- Bảng `notifications` (migration `1793600000000-AddNotifications`): `user_id` (FK users, CASCADE), `type`, `title` (200),
  `body` (text), `link`, `read_at`, `created_at`. Hai index: (user, created_at) cho danh sách, và partial unread cho đếm chưa đọc.
- API của tôi: danh sách phân trang, số chưa đọc, đọc, đọc hết, xóa. Thông báo của người khác trả 404 (xem
  `docs/architecture/06-api-contract.md`).
- Phát thông báo sau khi thao tác chính thành công, lỗi chỉ ghi log:
  - gửi duyệt → người có `revision:publish` (trừ người gửi);
  - được duyệt / bị từ chối (kèm lý do) → tác giả (trừ khi tự duyệt);
  - báo cáo mới → người có `report:resolve`.
- Người nhận theo quyền: user active, chưa xóa, có quyền qua một vai trò chưa xóa (SQL `DISTINCT`, không trùng khi có nhiều vai trò).
- Tên hiện vật lấy qua `resolveBilingual` + `primaryText`, vì `content.name` thật là object `{vi, en}` dù kiểu khai báo là `string`.
- `ExhibitsService.submitDraftForReview(id, actorId)`: thêm người gửi để loại khỏi danh sách nhận.

Front-end (`NotificationCenter`):
- Badge số chưa đọc, cập nhật mỗi 60 giây.
- Danh sách 10 mục mỗi trang, nút **"Xem thêm"** tải trang tiếp, hết thì ẩn nút.
- Nội dung dài (quá 100 ký tự hoặc quá 2 dòng) bị cắt còn 2 dòng, có **"Xem thêm" / "Thu gọn"** (`aria-expanded`).
- Mỗi mục có nút đánh dấu đã đọc (chỉ hiện khi chưa đọc) và nút xóa. Đầu popover có "Đánh dấu tất cả đã đọc". Bấm tiêu đề thì
  đánh dấu đã đọc và mở trang liên kết.
- Mục chưa đọc có nền nhấn và chấm xanh. Thời gian hiển thị dạng tương đối ("5 phút trước"; quá 7 ngày thì hiện ngày).

Thông báo "Báo cáo được giao cho tôi" (`report.assigned`) được làm sau, cùng chức năng giao báo cáo cho người khác
(xem `docs/tasks/report-assign-others.md`).

## Kiểm chứng ngày 02/11/2026

- Back-end: lint, typecheck đạt; `npm test` 2124/2124 với PostgreSQL 16 tạm (0 skip); coverage lõi 95,62%. Migration được sinh
  bằng `migration:generate` và đã kiểm lại: không còn lệch giữa entity và schema.
- Test mới: service (người nhận, loại trừ người gửi/tự duyệt, lý do từ chối, tên song ngữ, cắt tiêu đề, nuốt lỗi), HTTP
  (route, 404, 400 UUID), tích hợp DB (lọc user khóa/xóa/vai trò xóa, không trùng; đọc/xóa chỉ của mình; giữ thời điểm đọc
  đầu), và cập nhật test moderation/báo cáo/hiện vật để kiểm lời gọi phát thông báo.
- Front-end: lint, typecheck, build đạt; vitest 215/215; Playwright `tests/cms-notifications.spec.ts` 4/4 (badge, "Xem thêm"
  danh sách, "Xem thêm"/"Thu gọn" nội dung, đọc / xóa / đọc hết, bấm mở liên kết).
- Smoke trên app thật (PostgreSQL tạm, dữ liệu tạo qua API): admin gửi duyệt → chỉ kiểm duyệt viên nhận; kiểm duyệt viên từ
  chối (lý do 216 ký tự) / duyệt → admin nhận; khách báo cáo → cả hai nhận. Không đọc / xóa hộ được (404), chưa đăng nhập 401.
  Lượt smoke này phát hiện tiêu đề hiện `[object Object]` (do tên song ngữ); đã sửa và thêm test.
