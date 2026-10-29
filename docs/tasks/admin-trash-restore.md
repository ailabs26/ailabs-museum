# Task: Thùng rác và khôi phục ở trang quản trị

Người phụ trách: Nguyễn Văn Thắng. PR: back-end `feat/trash-restore-api`, giao diện (PR sau).
Phòng/Media/Hiện vật là module của Nguyễn Trọng Thành — thay đổi nằm trong phạm vi task, quy tắc nghiệp vụ cũ giữ nguyên.

## Bối cảnh

Sau task "Xóa mềm và xóa hàng loạt", mọi trang quản trị chỉ xóa mềm nhưng chưa có cách xem hay khôi phục bản ghi đã xóa.
Task này thêm thùng rác (danh sách đã xóa) và khôi phục cho Tài khoản, Vai trò, Phòng, Media, Hiện vật; kiểm xung đột
email/mã/slug khi khôi phục.

## API

- Danh sách: thêm `deleted=true` vào `GET /users`, `/roles`, `/admin/rooms`, `/admin/media`, `/admin/exhibits` → chỉ bản ghi
  đã xóa, kèm `deletedAt`, mới xóa trước (`DeletedFilter` trong `common/dto/deleted-filter.dto.ts`; giá trị khác `true`/`false` → 400).
- Khôi phục: `POST …/bulk-restore` body `{ ids }` (`BulkIdsDto`), tất cả hoặc không, quyền như xóa
  (`user:delete`, `role:delete`, `room:delete`, `media:upload`, `exhibit:update`), audit `<resource>.restore` một bản ghi/ID.
- 409: `errors[].code = "restore_blocked"` (`assertNothingBlocked(…, 'restore')`).

| Tài nguyên | Chặn khôi phục khi | Xung đột unique |
|---|---|---|
| Tài khoản | không nằm trong thùng rác | email unique toàn bảng → không thể trùng |
| Vai trò | mã đang thuộc vai trò chưa xóa khác; hai vai trò cùng mã trong cùng lô | mã chỉ unique giữa vai trò chưa xóa → kiểm trước, bắt thêm lỗi `UQ_roles_code_active` khi tạo song song |
| Phòng | không nằm trong thùng rác | slug unique toàn bảng → không thể trùng |
| Media | không nằm trong thùng rác | — |
| Hiện vật | phòng chứa hiện vật đã bị xóa | — |

## Quy tắc khi khôi phục

- **Tài khoản:** bỏ liên kết tới vai trò đã xóa (để khôi phục vai trò sau này không âm thầm cấp lại quyền); phiên cũ đã thu
  hồi lúc xóa nên phải đăng nhập lại.
- **Vai trò đã xóa không cấp quyền:** `toAuthUser` và `toUserResponse` bỏ qua vai trò `is_deleted` (trước đây liên kết cũ của
  tài khoản đã xóa sẽ trả lại quyền nếu tài khoản được khôi phục).
- **Hiện vật:** khóa FOR SHARE phòng chứa nó để lệnh xóa phòng song song phải chờ rồi đếm cả hiện vật vừa khôi phục (BR-20);
  đặt về cuối thứ tự hiển thị của phòng; vẫn là bản nháp (chỉ bản nháp mới xóa được).
- **Phòng:** hiện vật đã xóa trong phòng vẫn ở thùng rác.

## Sửa lỗi kèm theo

- Tạo phòng với slug của phòng đã xóa trước đây lọt qua kiểm tra (chỉ tìm phòng chưa xóa) rồi vi phạm unique của DB → lỗi 500.
  Nay trả 409: "Slug … thuộc phòng đã xóa …. Khôi phục phòng đó trong mục Đã xóa hoặc dùng slug khác."

## Ngoài phạm vi

Xóa vĩnh viễn, tự dọn thùng rác theo thời gian, khôi phục revision nháp lẻ bên trong hiện vật.

## Kiểm chứng ngày 29/10/2026

- Back-end: typecheck, lint, build đạt; `npm test` 2028/2028 với PostgreSQL 16 tạm; coverage lõi 95,74% line · 97,28% branch ·
  98,19% function.
- Test mới `src/common/tests/trash-restore.integration.spec.ts` (PostgreSQL thật, 5 tài nguyên): danh sách thùng rác chỉ có
  bản ghi đã xóa kèm `deletedAt`; tất cả hoặc không; vai trò trùng mã (với vai trò sống và trong cùng lô); tài khoản khôi phục
  mất liên kết vai trò đã xóa, vai trò đã xóa không cấp quyền; tạo phòng trùng slug phòng đã xóa → 409; hiện vật trong phòng
  đã xóa bị chặn, khôi phục phòng rồi hiện vật về cuối thứ tự. `src/common/tests/deleted-filter.spec.ts`: `deleted=yes/1/''` → 400.
- Không có migration.
