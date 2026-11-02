# Task: Dọn refresh_sessions hết hạn / bị thu hồi

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/refresh-session-cleanup`.

## Bối cảnh

Mỗi lần refresh tạo thêm một row `refresh_sessions` (xoay vòng token), row cũ giữ lại để phát hiện tái dùng token. Trước
task này không có gì xóa các row đó, nên bảng phình mãi theo số lần refresh.

## Thay đổi

- Thêm `@nestjs/schedule`; `ScheduleModule.forRoot()` ở `AppModule`. Các job định kỳ sau này cũng dùng chung bộ lập lịch này.
- `RefreshSessionsRepository.deleteDeadFamilies(cutoff, limit, manager)`: xóa theo **cả family** khi **mọi** row đều
  `expires_at < cutoff` hoặc `revoked_at < cutoff`. Family còn token "đã dùng" chưa hết hạn được giữ, để replay vẫn bị phát
  hiện và thu hồi. FK `replaced_by_id` là `RESTRICT` nên trong cùng transaction phải set NULL trước rồi mới DELETE.
  Cần `COALESCE(..., false)`: nếu `revoked_at` là NULL thì biểu thức ra NULL, mà `bool_and` bỏ qua NULL, nên family còn
  sống sẽ bị xóa nhầm (lỗi này do test tích hợp bắt được).
- `SessionsCleanupService`: chạy cron `EVERY_DAY_AT_3AM`, giữ lại thêm 7 ngày (`DEAD_SESSION_RETENTION_MS`), xóa mỗi lô 500
  family trong một transaction cho tới khi hết. Lỗi chỉ được ghi log, không làm sập tiến trình.

Ngoài phạm vi: chạy nhiều instance thì mỗi instance đều chạy cron. Việc này vô hại (DELETE idempotent) nhưng làm việc thừa;
khi scale thì cần khóa phân tán.

## Kiểm chứng ngày 02/11/2026

- Back-end: lint, typecheck đạt; `npm test` 1997/1997.
- Unit (`sessions-cleanup.spec.ts`): cutoff = now − 7 ngày, lặp theo lô tới khi 0, chạy trong transaction, cron nuốt lỗi.
- Tích hợp trên PostgreSQL 16 tạm (docker, đã migrate), 5 family:

  | Family | Trạng thái | Kết quả |
  |---|---|---|
  | 1 | Mọi row hết hạn > 7 ngày | Xóa |
  | 2 | Token cũ hết hạn, token đã dùng còn hạn, đầu chuỗi còn sống | Giữ |
  | 3 | Thu hồi 2 ngày trước | Giữ |
  | 4 | Thu hồi 10 ngày trước (expires còn trong tương lai) | Xóa |
  | 5 | Token cũ hết hạn, đầu chuỗi còn sống | Giữ |

  Với `limit=1`: lô 1 xóa 2 row, lô 2 xóa 2 row, lô 3 xóa 0. Không lỗi FK.
