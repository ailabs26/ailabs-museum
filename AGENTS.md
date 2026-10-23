# Hướng dẫn kho mã nguồn

Các hướng dẫn này áp dụng cho toàn bộ kho mã nguồn. Nếu một thư mục con có `AGENTS.md` riêng thì hướng dẫn trong file gần nhất được ưu tiên cho cây thư mục đó.

## Cấu trúc dự án

- Monorepo 2 app: **`back-end/`** (NestJS + TypeORM + PostgreSQL) và **`front-end/`** (React + Vite + Mantine). Tài liệu ở **`docs/`** (`architecture/`, `plans/`, `tasks/`, `Diagrams/`).
- Back-end theo cấu trúc enterprise: `common/` (hạ tầng global), `config/` (config namespaced + env.validation + data-source), `database/` (migrations, seeds, database.module), `modules/<domain>/` (controllers/services/repositories/entities/dto; entity theo DDD). Phân hệ quản trị đã có: auth, users, roles + permissions, audit (RBAC bằng JwtAuthGuard + PermissionsGuard + @Audit).
- Front-end: `core/` (api, auth, config), `shared/components/`, `services/`, `app/` (router, theme), `pages/` (admin, client).

## Quy trình nhánh

- Luôn bắt đầu mỗi nhiệm vụ từ bản `origin/dev` mới nhất.
- Mỗi nhiệm vụ chỉ dùng một nhánh và một pull request.
- Dùng `feat/<ten-ngan>` cho tính năng mới, `fix/<ten-ngan>` cho sửa lỗi, `docs/<ten-ngan>` cho tài liệu, `chore/<ten-ngan>` cho bảo trì và `refactor/<ten-ngan>` cho thay đổi cấu trúc không làm đổi hành vi.
- Mở pull request của nhiệm vụ vào `dev`.
- Không push commit của nhiệm vụ trực tiếp vào `dev`.
- Không bao giờ merge nhánh nhiệm vụ trực tiếp vào `main`.
- `main` chỉ nhận pull request phát hành từ `dev`.

## Trước khi chỉnh sửa

- Đọc phần triển khai, README, kế hoạch và quy ước lập trình liên quan trước khi sửa code.
- Truy vết hành vi hiện tại và xác định đúng lớp chịu trách nhiệm cho thay đổi được yêu cầu.
- Giữ thay đổi trong phạm vi nhiệm vụ và bảo toàn các thay đổi không liên quan của nhóm hoặc người dùng.
- Không thêm tính năng suy đoán, dọn dẹp không liên quan, đổi tên diện rộng hoặc tạo lớp trừu tượng quá sớm.
- Không tuyên bố hành vi hay kết quả kiểm thử khi chưa có bằng chứng hiện tại.

## Frontend

- Tuân theo `docs/architecture/fe/coding-conventions.md`.
- Frontend giao tiếp với NestJS API, không kết nối trực tiếp tới PostgreSQL, Supabase hoặc dịch vụ lưu trữ.
- Kiểm tra tính hợp lệ của phản hồi từ API bên ngoài trước khi code ứng dụng sử dụng.
- Duy trì DOM có khả năng tiếp cận và hành vi dự phòng song song với trải nghiệm 3D và WebXR.
- Với thay đổi frontend, chạy các bước kiểm tra liên quan từ `front-end/`:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

## Backend

- Tuân theo `docs/architecture/be/coding-conventions.md`. Giữ luồng Controller → Service → Repository; chỉ Repository chạm TypeORM.
- Giữ các endpoint nội dung công khai (`/rooms`, `/health`) ở chế độ chỉ đọc + `@Public()`. Route quản trị bảo vệ bằng guard toàn cục + `@Permissions('resource:action')`; thao tác ghi/sửa đánh `@Audit(...)`.
- Endpoint trả `ApiResponse` (qua ResponseInterceptor); không trả Entity thô / `passwordHash`.
- Luôn tắt TypeORM `synchronize`.
- Không tạo, chạy, hoàn tác, chỉnh sửa hoặc xóa database migration nếu chưa có phê duyệt rõ ràng từ người phụ trách database.
- Với thay đổi backend, chạy các bước kiểm tra liên quan từ `back-end/`:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

## Kiểm chứng và pull request

- Kiểm chứng các điều kiện nghiệm thu của nhiệm vụ bằng bằng chứng tối thiểu nhưng đầy đủ.
- Chạy kiểm tra cho mọi ứng dụng bị ảnh hưởng. Chỉ chạy kiểm tra toàn kho mã nguồn khi thay đổi đi qua ranh giới ứng dụng hoặc tác động đến hành vi dùng chung.
- Review toàn bộ diff trước khi commit và một lần nữa trước khi merge.
- Dùng commit message ngắn gọn, mô tả thay đổi đã hoàn thành.
- Xác nhận base của pull request là `dev`.
- Không merge khi bước kiểm tra bắt buộc hoặc điều kiện nghiệm thu đang thất bại.
- Chỉ merge vào `dev` sau khi pull request đã được review và nhiệm vụ đã hoàn thành.
- Với thay đổi liên quan đến database, xác thực, phân quyền, bảo mật, quyền riêng tư hoặc có khả năng phá hủy dữ liệu, dừng tại pull request và yêu cầu con người review trước khi merge.

## Báo cáo hoàn thành

Báo cáo nhánh, commit, URL pull request, các thay đổi quan trọng, kết quả kiểm chứng, kết quả merge và mọi rủi ro hoặc phần còn thiếu.
