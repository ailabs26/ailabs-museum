# Aura Museum API — bản nền tảng

NestJS, TypeScript, PostgreSQL và TypeORM. API hiện chỉ đọc nội dung demo; trang Admin chưa có endpoint ghi.

Quy tắc đặt tên và tổ chức code nằm tại [docs/coding-conventions.md](docs/coding-conventions.md). Thành viên và AI agent phải đọc tài liệu này trước khi thêm code mới.

## Chạy local

Yêu cầu Node.js 20+ và một project Supabase. Sao chép chuỗi kết nối PostgreSQL của Supabase vào `DATABASE_URL` trong file `.env`.

```sh
cd back-end
cp .env.example .env
npm install
npm run migration:run
npm run start
```

`npm run start` tự biên dịch và khởi động lại khi sửa code trong `src/`; `npm run dev` là lệnh tương đương. Để chạy bản đã build mà không theo dõi thay đổi, dùng `npm run build` rồi `npm run start:prod`.

API: `http://localhost:3001/rooms`, `GET /rooms/phong-kham-pha`, `GET /health`; Swagger ở `http://localhost:3001/docs`. `GET /media/placeholder-artifact.svg` là ảnh minh họa tĩnh. Có thể chạy `npm run migration:revert` để lùi migration cuối.

## Cấu trúc

- `src/config`: validation môi trường, TypeORM DataSource dùng chung cho app và CLI.
- `src/rooms`, `src/exhibits`, `src/media`: entity theo miền nội dung; exhibits có controller, service, repository và DTO dự kiến cho CMS.
- `src/migrations`: schema và 5 hiện vật demo. Không dùng `synchronize` trong runtime.
- `public/media`: asset minh họa phục vụ qua HTTP.

Thiết kế API quản trị tương lai: `/admin/rooms`, `/admin/exhibits`, `/admin/media` với POST/PATCH/DELETE, xác thực, phân quyền và upload có kiểm tra MIME/kích cỡ. **Chưa có các route này** để tránh ghi dữ liệu công khai. Media `model`/`image`/`audio` là liên kết riêng; `transcript` nằm ở hiện vật và cần có khi xuất bản audio.

## Migration

- Luôn giữ `synchronize: false`; thay đổi schema bằng TypeORM migration.
- Chỉ người phụ trách database được chạy `migration:generate`, `migration:run` và `migration:revert`; AI agent không tự chạy các lệnh này.
- Kiểm tra file được generate trước khi chạy, đặc biệt các lệnh `DROP`, thay đổi enum và constraint.
- Không sửa hoặc xóa migration đã chạy trên database dùng chung. Tạo migration mới cho thay đổi tiếp theo.
- TypeORM dùng bảng `public.migrations` để ghi lịch sử migration đã áp dụng; không chỉnh sửa bảng này thủ công.

Tạo file migration sau khi entity thay đổi:

```sh
npm run migration:generate -- src/migrations/TenMigration
```

## Kiểm tra

`npm run typecheck`, `npm run lint`, `npm run build`. Xem thêm tài liệu ở `../docs/` và README của front-end. Bản nền tảng chưa gồm tài khoản CMS, CRUD, upload, tối ưu asset hay bộ kiểm thử thiết bị thật.
