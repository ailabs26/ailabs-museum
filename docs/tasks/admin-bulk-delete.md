# Task: Xóa mềm và xóa hàng loạt ở trang quản trị

Người phụ trách: Nguyễn Văn Thắng. PR: #100 (lõi, Tài khoản, Vai trò), #101 (Phòng, Media, Hiện vật), PR giao diện.
Phòng/Media/Hiện vật là module của Nguyễn Trọng Thành; module audit của Nguyễn Đức Quang — thay đổi đã được người phụ trách task đồng ý, quy tắc nghiệp vụ giữ nguyên.

## Bối cảnh

Các trang quản trị chỉ xóa được từng dòng, và kiểu xóa không thống nhất (Vai trò và Hiện vật xóa cứng, Media xóa luôn file).
Yêu cầu: **mọi trang đều xóa mềm**; mỗi trang có xóa từng dòng, ô chọn từng dòng, ô chọn tất cả dòng của trang hiện tại
và nút "Xóa đã chọn". Xóa hàng loạt gửi **một request kèm mảng ID**, xử lý **tất cả hoặc không**.

## Trước / sau

| Trang | Trước | Sau |
|---|---|---|
| Tài khoản | Xóa mềm; chặn Admin hoạt động cuối | Xóa mềm; **không xóa được tài khoản có vai trò Admin** (bỏ vai trò trước); đăng xuất mọi thiết bị của tài khoản bị xóa |
| Vai trò | **Xóa cứng**; chặn admin/editor/moderator và vai trò đang gán | **Xóa mềm**; chỉ chặn vai trò **Admin** và vai trò đang gán cho tài khoản chưa xóa; tạo lại cùng mã được |
| Phòng | Xóa mềm; chặn khi còn hiện vật | Như cũ, nhưng **chỉ tính hiện vật chưa xóa** (số hiện vật, BR-20) |
| Media | Xóa mềm trong DB nhưng **xóa file** | Xóa mềm, **giữ file** để khôi phục; vẫn chặn theo BR-21 |
| Hiện vật | **Xóa cứng** bản nháp (cascade revisions/hotspots) | **Xóa mềm**, giữ revisions/hotspots; vẫn chặn theo BR-20 (đã xuất bản/đang hiển thị/đã duyệt, chờ duyệt, có báo cáo) |

Ngoài phạm vi: xóa một revision nháp bên trong hiện vật (`DELETE /admin/exhibits/:id/revisions/:revId`) giữ nguyên.

## API

| Route | Quyền (như xóa lẻ) | Audit |
|---|---|---|
| `POST /users/bulk-delete` | `user:delete` | `user.delete` |
| `POST /roles/bulk-delete` | `role:delete` | `role.delete` |
| `POST /admin/rooms/bulk-delete` | `room:delete` | `room.delete` |
| `POST /admin/media/bulk-delete` | `media:upload` | `media.delete` |
| `POST /admin/exhibits/bulk-delete` | `exhibit:update` | `exhibit.delete` |

- Body `{ "ids": [uuid, ...] }` (1–100, không trùng — `BulkIdsDto`). Thành công trả `{ ids }`; `AuditInterceptor` ghi **1 bản ghi/ID**.
- Có mục bị chặn hoặc không tồn tại → **409**, không mục nào bị xóa;
  `errors: [{ code: "delete_blocked", field: <id>, message: <lý do> }]` (`assertNothingBlocked` trong `common/exceptions/deletion-blocked.ts`).
- Xóa lẻ và xóa hàng loạt dùng chung một hàm kiểm chặn trong từng service; xóa lẻ giữ 404/409 và thông điệp như cũ.
- Khóa dòng trong transaction; media/hiện vật khóa theo thứ tự ID cố định để hai lệnh hàng loạt chồng nhau không deadlock.

## Migration

`SoftDeleteRoles1793033761577`: `roles` thêm `is_deleted`, `deleted_at`, CHECK `CHK_roles_deleted`; bỏ unique `code` toàn bảng,
thay bằng unique index `UQ_roles_code_active` chỉ cho vai trò chưa xóa. `down()` từ chối nếu đã có mã trùng.
**Đã chạy trên DB dùng chung ngày 27/10/2026 lúc 00:27**, sau khi backup `~/aura-backups/aura-2026-10-27-0027.dump`
bằng `back-end/tools/db/backup.sh` (đã kiểm đọc lại được). Trước khi chạy chỉ có đúng migration này đang chờ; sau khi chạy
`migration:show` báo `[X] 7 SoftDeleteRoles1793033761577`, bảng `roles` có đủ 2 cột mới và index `UQ_roles_code_active`,
dữ liệu không đổi (3 vai trò, chưa vai trò nào bị xóa, 47 dòng `role_permissions`).
Hoàn tác: `npm run migration:revert` hoặc khôi phục từ bản backup. Môi trường dùng DB riêng phải chạy migration này trước khi deploy.

## Giao diện

- `DataTable` có prop `selection` (cột ô chọn; ô ở header chọn/bỏ mọi dòng chọn được của trang hiện tại; dòng bị chặn
  khóa ô chọn kèm tooltip lý do). Không truyền prop → bảng như cũ.
- `BulkActionBar` ("Đã chọn n · Bỏ chọn · Xóa đã chọn (n)") và `BulkDeleteFailures` (danh sách "tên — lý do" khi 409).
- Hook `useRowSelection` (tự bỏ chọn khi đổi trang/lọc/tìm) và `useBulkDelete` (xác nhận → gửi mảng ID → thông báo).
- Dòng bị khóa trước ở giao diện: tài khoản Admin, vai trò Admin, phòng còn hiện vật, hiện vật bị chặn theo BR-20.
  Media đang được dùng chỉ back-end biết → hiện trong danh sách bị chặn.
- Phòng (danh sách thẻ trên mobile) và Hiện vật (chế độ thẻ) cũng có ô chọn.
- Vai trò có sẵn (admin/editor/moderator) gắn nhãn "mặc định" thay cho "hệ thống".

## Kiểm chứng ngày 27/10/2026

- Back-end: typecheck, lint, build đạt; `npm test` 1949/1949 với PostgreSQL 16 tạm (`CORE_TEST_DATABASE_URL`, `MEDIA_TEST_DATABASE_URL`);
  coverage lõi 96,40% line · 97,82% branch · 97,96% function; migration up → down (từ chối khi trùng mã) → up; boot `AppModule`.
- Front-end: typecheck, build đạt; vitest 162/162 (mới `helpers/bulkDelete.test.ts`); ESLint các file thay đổi sạch.
- E2E Playwright (back-end + PostgreSQL tạm, dữ liệu tạo qua API): trên 5 trang, ô chọn tất cả chỉ chọn dòng hợp lệ
  (tài khoản Admin, vai trò Admin, phòng còn hiện vật, hiện vật đang hiển thị bị khóa); lô media có 1 media đang chờ duyệt
  → 409, Alert nêu đúng media + lý do, không media nào bị xóa; xóa thành công thì dòng biến mất; phòng chỉ còn đếm 1 hiện vật
  sau khi 2 bản nháp bị xóa mềm. DB: các dòng chỉ được đánh dấu `is_deleted`, revisions của hiện vật đã xóa còn nguyên,
  audit có đúng 1 bản ghi cho mỗi ID.
