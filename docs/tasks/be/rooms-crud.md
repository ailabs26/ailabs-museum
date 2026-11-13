# Task 6: CRUD phòng trưng bày (Rooms) + màn hình CMS

Nhánh: `feat/be-rooms-crud` (từ `dev`). PR [#31](https://github.com/ailabs26/ailabs-museum/pull/31), merge 12/10/2026. PR #27 trước đó đã bị revert (#29) và làm lại thành #31. Commit chính: `b3bfa9c`.

**Trạng thái:** Đã merge vào `dev`.

## Đã làm

### Back-end (`src/modules/rooms/`)

- **API Admin** `/api/admin/rooms` (RBAC + audit):

  | Method | Route | Quyền | Audit |
  |---|---|---|---|
  | `GET` | `/` — phân trang, lọc `status`, tìm `q` (ILIKE theo `name`/`slug`) | `room:read` | — |
  | `GET` | `/:id` | `room:read` | — |
  | `POST` | `/` | `room:create` | `room.create` |
  | `PATCH` | `/:id` — sửa `name`, `description`, `status`; **slug bất biến** | `room:update` | `room.update` |
  | `DELETE` | `/:id` — xóa mềm | `room:delete` | `room.delete` |

- **API công khai** `/api/public/rooms` (`@Public()`): danh sách phòng `active` chưa xóa, chi tiết theo slug.
- **DTO** (`dto/`): `CreateRoomDto` (slug kebab-case ≤ 120 ký tự, tự trim + lowercase; name 1–200 ký tự; description tùy chọn), `UpdateRoomDto` (không có `slug`), `ListRoomsQueryDto` (kế thừa `PaginationQueryDto`, lọc `status`), `RoomResponse` (`exhibitsCount` thay cho mảng exhibits — không trả entity thô). `pageSize` bị kẹp trong 1–100.
- **Luật nghiệp vụ** (`services/rooms.service.ts`):
  - Slug trùng với phòng chưa xóa → 409.
  - **BR-20:** không xóa được phòng còn hiện vật → 409 kèm hướng dẫn chuyển/gỡ hiện vật.
  - Xóa mềm đặt `isDeleted` + `deletedAt` cùng lúc (khớp CHECK `CHK_rooms_deleted`); phòng đã xóa → 404 ở mọi route.
- **Repository** `RoomsRepository extends BaseRepository` — chỉ repository chạm TypeORM, theo luồng Controller → Service → Repository.

### Front-end

- `pages/admin/RoomsPage.tsx`: bảng `DataTable` có tìm kiếm/lọc/phân trang; modal tạo và sửa (slug khóa khi sửa); xác nhận xóa; nút theo quyền `room:create|update|delete`; mọi gọi API qua react-query.
- `services/rooms.service.ts`, route `/admin/rooms` trong `app/router.tsx`, hằng quyền trong `core/auth/permissions.ts`; `DataTable` thêm prop cần cho trang này.
- `start.sh` ở gốc repo: khởi động BE + FE local cùng lúc.

## Kiểm chứng

- `npm run test:rooms`: **440/440** (chạy lại ngày 20/10/2026) — DTO, repository, service, service mở rộng (edge case), controller (guard RBAC + audit).
- Typecheck/lint/build BE + FE đạt lúc merge.

## Giới hạn & việc sau

- **Dùng lại slug của phòng đã xóa mềm:** service chỉ kiểm tra trùng với phòng *chưa xóa*, nhưng cột `slug` có `UNIQUE` toàn bảng → DB ném lỗi unique và `AllExceptionsFilter` chưa map lỗi này (dự kiến trả 500 thay vì 409). Suy ra từ code, chưa chạy trên DB thật.
- **`exhibitsCount` và kiểm tra BR-20 đếm mọi hiện vật** trong quan hệ, kể cả hiện vật hidden. API công khai vì vậy lộ số lượng hiện vật chưa công khai.
- **Hai endpoint phòng công khai trùng chức năng:** `/api/public/rooms` (task này) và `/api/rooms` (module exhibits, trả nội dung Published + media — FE tour đang dùng route này). Nên gộp về một.
- Chưa có reorder phòng; thứ tự theo `createdAt`.
