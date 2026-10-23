# Task 23: Báo cáo nội dung sai (Content Reports)

Nhánh gốc: `feat/admin-moderation` (cùng đợt PR #34, 12/10/2026). Bảng `content_reports` có
từ migration schema ban đầu ([initial-database-schema.md](initial-database-schema.md)).

**Trạng thái:** Đã merge vào `dev`.

## Phạm vi

Module `back-end/src/modules/content-reports/`:

- Khách tham quan gửi báo cáo khi thấy thông tin hiện vật sai (public, có rate limit).
- Admin xem danh sách, tiếp nhận, kết luận xử lý hoặc bác báo cáo.

Báo cáo **không tự sửa nội dung**. Người xử lý sửa hiện vật qua CMS (tạo revision mới →
kiểm duyệt, xem [moderation.md](moderation.md)) rồi đóng báo cáo kèm kết luận.

## Trạng thái

```
open ──assign──► in_progress ──resolve──► resolved
  │                   │
  └──resolve/dismiss──┴──dismiss──► dismissed
```

- `assign` chỉ từ `open`.
- `resolve` / `dismiss` hợp lệ khi báo cáo còn mở (`open` hoặc `in_progress`); đã đóng → **409**
  "Báo cáo đã được đóng trước đó".
- Đóng báo cáo chưa ai tiếp nhận → tự gán `assignedTo` = người đóng.
- CHECK `CHK_content_reports_status` ở DB giới hạn 4 giá trị trên.

## API

| Method | Route | Quyền | Audit | Body |
|---|---|---|---|---|
| `POST` | `/api/public/reports` | `@Public()`, 5 lần/phút | — | `{ exhibitId, reportedRevisionId?, category, message }` |
| `GET` | `/api/reports?page&pageSize&status` | `report:read` | — | — |
| `GET` | `/api/reports/:id` | `report:read` | — | — |
| `POST` | `/api/reports/:id/assign` | `report:resolve` | `report.assign` | — |
| `POST` | `/api/reports/:id/resolve` | `report:resolve` | `report.resolve` | `{ resolution }` |
| `POST` | `/api/reports/:id/dismiss` | `report:resolve` | `report.dismiss` | `{ resolution }` |

Rate limit dùng `ThrottlerGuard` + `@Throttle({ default: { limit: 5, ttl: 60_000 } })` gắn
riêng trên route public; vượt ngưỡng → **429**.

### DTO

- `CreateReportDto`: `exhibitId` (UUID v4), `reportedRevisionId?` (UUID v4 — bản khách đang
  xem), `category` (≤ 40 ký tự, ví dụ `wrong_info`), `message` (bắt buộc, ≤ 2000 ký tự).
- `ResolveReportDto`: `resolution` bắt buộc, ≤ 1000 ký tự.
- `ListReportsQueryDto` kế thừa `PaginationQueryDto`, lọc `status` theo enum.
- `ReportResponseDto`: `id, exhibitId, category, message, status, assignedTo, resolution,
  reportedRevision { id, revisionNo, state, content } | null, createdAt, resolvedAt`.

## Dữ liệu (`content_reports`)

| Cột | Ghi chú |
|---|---|
| `exhibit_id` | FK → `exhibits`, `ON DELETE RESTRICT` |
| `reported_revision_id` | FK → `exhibit_revisions`, nullable, `RESTRICT` |
| `assigned_to` | FK → `users`, nullable, `RESTRICT` |
| `status` | `varchar(16)`, mặc định `open` |
| `resolution`, `resolved_at` | điền khi resolve/dismiss |

Index `IDX_content_reports_status_created (status, created_at)` phục vụ lọc theo trạng thái
và sắp xếp mới nhất. FK `RESTRICT` là một lý do hiện vật có báo cáo không xóa cứng được
(xem [../exhibit-deletion-policy.md](../exhibit-deletion-policy.md)).

## Luật nghiệp vụ khác

- Gửi báo cáo cho hiện vật không tồn tại hoặc đã xóa mềm → **404**.
- Danh sách: mới nhất lên trước (`createdAt DESC`), `pageSize` kẹp 1–100.
- Không kiểm `reportedRevisionId` thuộc đúng `exhibitId`; FK chỉ bảo đảm revision tồn tại.

## Front-end

- Service: `front-end/src/services/reports.service.ts` (`list`, `get`, `assign`, `resolve`, `dismiss`).
- Màn hình: `front-end/src/pages/admin/ReportsPage.tsx`, route `/admin/reports`.

## Kiểm thử

```bash
cd back-end && npm run test:reports
```

- `content-reports-service.spec.ts`: tạo báo cáo, 404 hiện vật, chuyển trạng thái hợp lệ/409.
- `content-reports-http.spec.ts`: metadata route, `@Public`, throttle, quyền và audit.
