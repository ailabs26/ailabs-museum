# Backend coding convention

Phạm vi: `back-end/src/`. Tên cần ngắn gọn, mô tả đúng trách nhiệm và sử dụng tiếng Anh nhất quán. Không dùng tên chung chung như `test`, `data`, `helper` hoặc `utils` nếu không thể hiện rõ mục đích.

## Thư mục

- Dùng **lowercase kebab-case**.
- Đặt tên theo domain hoặc nhóm trách nhiệm, ưu tiên số nhiều khi thư mục chứa nhiều thành phần cùng loại.
- Chỉ tạo thư mục khi có code thực tế.

Ví dụ: `exhibits/`, `access-control/`, `dto/`, `repositories/`.

## File

- Dùng **kebab-case** và hậu tố thể hiện loại file.
- Tên file phải cho biết đối tượng hoặc trách nhiệm chính.

| Loại | Mẫu | Ví dụ |
| --- | --- | --- |
| Module | `<feature>.module.ts` | `exhibits.module.ts` |
| Controller | `<feature>.controller.ts` | `exhibits.controller.ts` |
| Service | `<feature>.service.ts` | `exhibits.service.ts` |
| Entity | `<entity>.entity.ts` | `exhibit.entity.ts` |
| Repository | `<feature>.repository.ts` | `exhibits.repository.ts` |
| DTO | `<action>-<entity>.dto.ts` | `create-exhibit.dto.ts` |
| Guard | `<purpose>.guard.ts` | `admin-auth.guard.ts` |
| Decorator | `<purpose>.decorator.ts` | `current-user.decorator.ts` |
| Test | `<source>.spec.ts` | `exhibits.service.spec.ts` |

## Luồng xử lý API

- Với chức năng có truy cập dữ liệu, luôn đi theo **Controller → Service → Repository**.
- Controller nhận request, dùng DTO để kiểm tra dữ liệu đầu vào và gọi Service; không truy cập TypeORM trực tiếp.
- Service xử lý quy tắc nghiệp vụ, phân quyền và transaction; không viết truy vấn database trực tiếp.
- Repository chứa truy vấn TypeORM và ánh xạ dữ liệu; không xử lý request HTTP hoặc quyết định nghiệp vụ.
- Đăng ký các thành phần cần thiết trong Module của chức năng. Ví dụ: `ExhibitsController` → `ExhibitsService` → `ExhibitsRepository`.

## Class, type và enum

- Dùng **PascalCase**.
- Class theo vai trò có hậu tố tương ứng như `Controller`, `Service`, `Module`, `Dto`, `Guard`.
- Tên entity dùng danh từ số ít.
- Không thêm tiền tố `I` hoặc `T` cho interface và type.

Ví dụ: `ExhibitsService`, `CreateExhibitDto`, `Exhibit`, `MediaKind`.

## Biến, hàm và method

- Dùng **camelCase**.
- Hàm và method bắt đầu bằng động từ, thể hiện hành động hoặc kết quả trả về.
- Collection dùng danh từ số nhiều.
- ID dùng hậu tố `Id`, không dùng `ID`.
- Boolean bắt đầu bằng `is`, `has`, `can` hoặc `should`.
- Tránh viết tắt nếu từ đầy đủ dễ hiểu hơn.

Ví dụ: `roomId`, `exhibits`, `findByRoom`, `isPublished`, `hasAudio`.

## Hằng số và biến môi trường

- Hằng số cấp module dùng **UPPER_SNAKE_CASE**.
- Biến môi trường dùng **UPPER_SNAKE_CASE** và tên thể hiện rõ dịch vụ hoặc mục đích.
- Không viết hoa biến chỉ vì được khai báo bằng `const`.

Ví dụ: `MAX_UPLOAD_SIZE`, `DATABASE_URL`, `FRONTEND_ORIGIN`.

## Database

- Tên bảng dùng chữ thường và số nhiều.
- Property trong TypeScript dùng **camelCase**.
- Khóa ngoại dùng hậu tố `Id`.
- Tên enum và constraint cần mô tả đúng domain, tránh tên tạm như `type1` hoặc `fk_test`.
- Không đổi tên bảng hoặc cột chỉ để chỉnh style nếu chưa có yêu cầu nghiệp vụ.

Ví dụ: bảng `exhibits`, property `displayOrder`, khóa ngoại `roomId`.

## Thời gian và múi giờ

- Mọi thời điểm (`createdAt`, `expiresAt`, ...) dùng PostgreSQL `timestamptz` và TypeScript `Date`; trường tùy chọn dùng `Date | null`. Không dùng `timestamp` không có múi giờ cho một thời điểm.
- Trao đổi thời điểm qua API bằng ISO 8601 có `Z` (UTC), ví dụ `2026-10-09T09:00:00.000Z`. Không phụ thuộc múi giờ của máy chạy backend hoặc database.
- Chỉ đổi sang múi giờ người dùng khi hiển thị. Với giờ theo lịch ở Việt Nam, dùng múi giờ IANA `Asia/Ho_Chi_Minh` để diễn giải trước khi đổi thành thời điểm UTC; ngày thuần túy dùng kiểu `date` riêng.

## Import và export

- Ưu tiên named export.
- Dùng `import type` khi chỉ import type.
- Không tạo barrel `index.ts` chỉ để rút ngắn đường dẫn import.
- Tên export chính phải khớp vai trò được thể hiện trong tên file.

Nếu bổ sung một kiểu tên mới và dùng lặp lại trong dự án, cập nhật tài liệu này trước khi áp dụng rộng rãi.
