# Kiến trúc hệ thống — Aura Museum (3D-WEB-03)

> Bảo tàng WebXR tương tác chạy trên trình duyệt: 5+ hiện vật, thuyết minh, điều hướng,
> CMS quản trị, progressive fallback 3D → 2D, accessibility WCAG 2.2 AA.
>
> **Stack:** React 18 + Vite + Three.js/R3F + **Mantine v7** (FE) · **NestJS 10 + TypeORM** (BE) ·
> **PostgreSQL** (Supabase) · JWT + RBAC · kiến trúc **Clean-inspired modular**.

Tài liệu này là **bản thiết kế chung của nhóm** — đọc trước khi code để thống nhất cấu trúc,
quy ước và ranh giới module. Mỗi người code theo đúng khung ở đây để merge không xung đột.

## Mục lục

| # | Tài liệu | Nội dung |
|---|---|---|
| 01 | [01-system-overview.md](01-system-overview.md) | Bối cảnh, mục tiêu, yêu cầu phi chức năng (NFR), stack, sơ đồ C4 context + container |
| 02 | [02-backend-architecture.md](02-backend-architecture.md) | Kiến trúc NestJS clean-inspired modular, tầng `core` (BaseRepository, filter, interceptor, guard, UnitOfWork, ApiResponse), vòng đời request |
| 03 | [03-frontend-architecture.md](03-frontend-architecture.md) | Kiến trúc React + Mantine, `services/common/shared/components`, 3 tầng render 2D/3D/XR, progressive fallback, state |
| 04 | [04-data-model-erd.md](04-data-model-erd.md) | Mô hình dữ liệu + ERD đầy đủ (Room, Exhibit, Revision, Media, User/Role/Permission, Report, AuditLog) |
| 05 | [05-security-rbac.md](05-security-rbac.md) | Mô hình RBAC, ma trận phân quyền, JWT access/refresh, luồng auth |
| 06 | [06-api-contract.md](06-api-contract.md) | Envelope `ApiResponse`, error model, danh mục endpoint, phân trang |
| 07 | [07-admin-subsystem.md](07-admin-subsystem.md) | **Phân hệ quản trị hệ thống** (dựng trước): auth, users, roles, permissions, audit — màn hình, use-case, sequence |
| 08 | [08-usecase-and-diagrams.md](08-usecase-and-diagrams.md) | Sơ đồ use-case tổng thể + các sequence diagram chính (login, publish CMS, client đọc nội dung, fallback) |
| 09 | [09-roadmap-and-branching.md](09-roadmap-and-branching.md) | Ánh xạ 45 task/3 phase của nhóm vào component kiến trúc + chiến lược nhánh/PR |
| — | [../supabase/README.md](../supabase/README.md) | **Supabase**: kết nối DB (pooler, TLS, migration DB dùng chung), lưu & phân phối media (driver, URL ký, Range/304), script, kiểm thử E2E, vận hành |

## Nguyên tắc thiết kế (tóm tắt)

1. **Tách DTO ↔ Entity tuyệt đối** — API không bao giờ trả thẳng entity (bảo mật, ổn định contract).
2. **Draft/Published tách biệt** — nội dung nháp không lọt ra API public (TTL cache ≤ 60s).
3. **Repository pattern** — service không gọi thẳng TypeORM; đi qua `BaseRepository<T>` (mượn từ `IAsyncRepository` của bản .NET tham khảo).
4. **Response & error đồng nhất** — mọi endpoint trả `ApiResponse<T>`; lỗi đi qua global exception filter.
5. **RBAC theo permission `resource:action`** — guard kiểm quyền từng endpoint ở backend (không phân quyền theo phòng).
6. **Progressive enhancement** — 2D luôn hoạt động không cần WebGL/XR; 3D và XR là lớp nâng cao.
7. **Append-only audit** — mọi thao tác admin ghi vết, không ghi đè.

## Nguồn tham khảo kiến trúc

- **Clean Architecture .NET** (`Cdg.Core`, `Cdg.Application`, `Cdg.Repository`): mượn `IAsyncRepository`,
  `RepositoryBase`, `UnitOfWork`, `ApiResponse`, `Exceptions`, `Behaviours`, middleware exception/auth.
- **Angular (Metronic)** (`core/material/*-custom`, `services/common`): mượn ý tưởng bộ component dùng chung
  (input/select/date/table…) và lớp `services/common`, chuẩn hóa lại sang **Mantine v7 + React**.
- **Template demo** (`demo-3d-museum`): tham chiếu danh sách màn hình quản trị (admin, permissions,
  permission-matrix, moderation, reports, audit, governance, accounts).
