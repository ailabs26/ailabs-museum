# Tài liệu task — mục lục

Mỗi file ghi lại một task đã làm: phạm vi, API/màn hình, luật nghiệp vụ, cách kiểm thử.
Kế hoạch trước khi làm nằm ở [`../plans/`](../plans/); kiến trúc chung ở
[`../architecture/`](../architecture/README.md).

- `be/` — task back-end (NestJS, module trong `back-end/src/modules/`).
- `fe/` — phần front-end của các task admin có cả BE và FE.
- Gốc `tasks/` — task front-end, tour 3D, CMS và các bản sửa lỗi liên module.

## Phân hệ quản trị hệ thống

| Task | Tài liệu |
|---|---|
| T-AUTH — đăng nhập, JWT, refresh token | [admin-be-auth.md](admin-be-auth.md) · sửa luồng: [be](be/admin-auth-flow.md) / [fe](fe/admin-auth-flow.md) · lỗi biên: [be](be/admin-auth-edge-cases.md) / [fe](fe/admin-auth-edge-cases.md) |
| T-USERS — người dùng, gán vai trò | [admin-be-users.md](admin-be-users.md) · hoàn thiện: [be](be/admin-user-management.md) / [fe](fe/admin-user-management.md) |
| T-ROLES — vai trò, ma trận quyền | [admin-be-roles-permissions.md](admin-be-roles-permissions.md) · ma trận: [be](be/admin-permission-matrix.md) / [fe](fe/admin-permission-matrix.md) |
| T-AUDIT — nhật ký thao tác | [admin-be-audit.md](admin-be-audit.md) · [be/audit-forbidden-access.md](be/audit-forbidden-access.md) |
| T-SEED — quyền, vai trò, admin đầu tiên | [admin-be-seed.md](admin-be-seed.md) |
| T-FE — khung FE Admin | [admin-fe-skeleton.md](admin-fe-skeleton.md) |
| Task 21 — Dashboard stats | [be/admin-dashboard-stats.md](be/admin-dashboard-stats.md) |

## CMS nội dung

| Task | Tài liệu |
|---|---|
| Schema ban đầu | [be/initial-database-schema.md](be/initial-database-schema.md) |
| Task 6 — phòng trưng bày | [be/rooms-crud.md](be/rooms-crud.md) |
| Task 7 — hiện vật + revision | [be/cms-exhibits-management.md](be/cms-exhibits-management.md) |
| Task 8 — upload media | [be/cms-media-upload.md](be/cms-media-upload.md) |
| Task 9 — gắn media + API public | [be/cms-media-attach.md](be/cms-media-attach.md) |
| Task 10 — media & xem trước trên CMS | [cms-preview-integration.md](cms-preview-integration.md) |
| Preview 3D bản nháp | [cms-draft-3d-preview.md](cms-draft-3d-preview.md) |
| Hotspot hiện vật | [cms-hotspot-editor.md](cms-hotspot-editor.md) |
| Thứ tự guided tour | [cms-tour-order.md](cms-tour-order.md) |
| Quyền sử dụng media (FR-97) | [public-media-rights.md](public-media-rights.md) |
| Form sửa hiện dữ liệu cũ (fix) | [exhibit-edit-stale-data.md](exhibit-edit-stale-data.md) |
| Chính sách xóa / ẩn hiện vật | [exhibit-deletion-policy.md](exhibit-deletion-policy.md) |
| Seed 5 hiện vật mẫu | [demo-content-seed.md](demo-content-seed.md) |
| Lưu trữ trên Supabase | [be/supabase-db-storage.md](be/supabase-db-storage.md) |

## Kiểm duyệt & báo cáo

| Task | Tài liệu |
|---|---|
| Task 22 — kiểm duyệt revision | [be/moderation.md](be/moderation.md) · sửa hàng đợi: [moderation-queue-fix.md](moderation-queue-fix.md) |
| Task 23 — báo cáo nội dung sai | [be/content-reports.md](be/content-reports.md) |
| Task 25 — kiểm thử tích hợp CMS | [admin-cms-testing.md](admin-cms-testing.md) |

## Trang khách tham quan (2D)

| Task | Tài liệu |
|---|---|
| T-HOME — trang chủ | [client-homepage.md](client-homepage.md) |
| T-HOME-FEATURED — hiện vật nổi bật | [home-featured-exhibits.md](home-featured-exhibits.md) |
| T-COLLECTION — bộ sưu tập | [client-collection.md](client-collection.md) |
| T-DETAIL-2D — chi tiết hiện vật | [exhibit-detail-2d.md](exhibit-detail-2d.md) |
| T-PREVIEW — minh họa 2D dùng chung | [shared-exhibit-preview.md](shared-exhibit-preview.md) |
| AUDIO-01 — trình phát thuyết minh | [audio-player-01.md](audio-player-01.md) |

## Tour 3D / WebXR

| Task | Tài liệu |
|---|---|
| Điều hướng WASD + cảm ứng | [tour-navigation.md](tour-navigation.md) |
| Khôi phục điều hướng tour | [public-tour-navigation.md](public-tour-navigation.md) |
| T-FALLBACK — 3D sang 2D | [tour-2d-fallback.md](tour-2d-fallback.md) |
| Font tiếng Việt trong tour | [tour-vietnamese-font.md](tour-vietnamese-font.md) |
| Tour WebXR | [tour-webxr.md](tour-webxr.md) |

## Accessibility

| Task | Tài liệu |
|---|---|
| A11Y-01 — điều hướng bàn phím | [accessibility-keyboard.md](accessibility-keyboard.md) |
| A11Y-02 — focus modal/drawer | [accessibility-modal.md](accessibility-modal.md) |

Khi thêm task mới: tạo file theo mẫu các file trên rồi thêm một dòng vào bảng phù hợp ở đây.
