# Task: Hoàn thiện quản lý tài khoản Admin

Nhánh: `fix/admin-user-management`.

## Đã làm

- Kiểm tra thêm `role:assign` khi tạo/cập nhật User kèm Role; giữ guard, validation và audit.
- PATCH lưu thông tin + toàn bộ Role trong một transaction. PUT `/users/:id/roles` thay Role riêng, cho phép `[]`.
- POST gán thêm/DELETE bỏ một Role dùng transaction; giữ liên kết và thời điểm gán không thay đổi.
- Bảo vệ Admin active/chưa xóa cuối cùng khi khóa, xóa mềm hoặc bỏ Role; dùng khóa transaction chung.
- Email unique gồm tài khoản đã xóa; trả 409 cả khi kiểm tra trước và khi database báo trùng.
- Trim email/tên; từ chối null/trường sai kiểu. Không sửa entity, migration, seed hoặc môi trường.

## Kiểm chứng 13/10/2026

- Typecheck, lint, build: đạt.
- Bộ test backend hiện có: 471/471 đạt.
- Kiểm tra tạm ngoài repo: 11/11 đạt, gồm service, rollback, Admin cuối cùng,
  race email và Nest HTTP thật với JWT guard/ValidationPipe. Dữ liệu/transaction dùng double
  trong bộ nhớ; chưa kiểm chứng transaction/advisory lock trên PostgreSQL thật.
- Không tạo file test mới trong repo; không ghi Supabase hoặc GitHub.

## Kiểm tra bàn giao

Người phụ trách dùng database test riêng: tạo User kèm Role → GET xác nhận →
PATCH tên/trạng thái/Role → PUT [] → khóa/mở khóa → DELETE xóa mềm.
Kiểm tra 403 khi thiếu quyền gán Role, 409 khi email trùng hoặc thao tác với Admin cuối cùng,
và hai request cùng loại bỏ hai Admin. Không dùng tài khoản quản trị duy nhất để thử xóa.

Chính sách JWT và giới hạn được ghi trong README: access token cũ giữ quyền đến hết TTL;
chưa thu hồi tức thì, chưa phục hồi User xóa mềm. Cần review con người trước merge.
