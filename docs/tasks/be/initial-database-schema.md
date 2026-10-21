# Task: Initial database schema

Nhánh: `feat/initial-database-schema`.

- Tạo và cập nhật entity TypeORM cho **13 bảng MVP** trong ERD v3; khai báo cột, quan hệ, khóa, index và constraint cần thiết.
- Đăng ký entity trong DataSource, điều chỉnh API đọc công khai cho cấu trúc `ExhibitRevision` và trình bày code theo coding convention backend.
- Kiểm tra `typecheck`, `lint`, `build` và đối chiếu metadata entity với ERD.

**Ngoài phạm vi:** 3 bảng mở rộng, seed data và mọi thao tác migration. Chỉ người phụ trách database được `migration:generate` và `migration:run` sau khi review thay đổi schema.
