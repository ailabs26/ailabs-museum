# 09 — Kiểm duyệt Nội dung và Báo cáo Vi phạm (`modules/moderation/`, `modules/content-reports/`)

> Mã nguồn: `back-end/src/modules/moderation/` và `back-end/src/modules/content-reports/`.

Hai module này đảm nhận khâu **kiểm soát chất lượng trước và sau khi xuất bản**: kiểm duyệt revision trước khi ra công khai, ẩn khẩn cấp hiện vật đã xuất bản và tiếp nhận/xử lý phản ánh từ khách tham quan.

## 1. Module Kiểm duyệt (`ModerationModule`)

### Danh mục Endpoint (3 Controller)
| Controller | Method & Route | Quyền | `@Audit` | Mô tả |
|---|---|---|---|---|
| `ModerationController` | `GET /api/moderation/queue` | `revision:publish` | — | Danh sách revision trạng thái `in_review` có phân trang |
| `ModerationController` | `GET /api/moderation/revisions/:id` | `exhibit:read` | — | Chi tiết 1 revision kèm media & người tạo |
| `ModerationController` | `GET /api/moderation/revisions/:id/diff` | `exhibit:read` | — | So sánh từng trường giữa revision đang xét và bản đang xuất bản |
| `RevisionsController` | `POST /api/revisions/:id/publish` | `revision:publish` | `revision.publish` | Duyệt và xuất bản revision (cập nhật `published_revision_id`) |
| `RevisionsController` | `POST /api/revisions/:id/reject` | `revision:reject` | `revision.reject` | Từ chối revision kèm lý do bắt buộc |
| `ExhibitRevisionsController` | `GET /api/exhibits/:id/revisions` | `exhibit:read` | — | Lịch sử tất cả revision của một hiện vật |
| `ExhibitRevisionsController` | `POST /api/exhibits/:id/hide` | `revision:hide` | `exhibit.hide` | Ẩn khẩn cấp hiện vật đang công khai (`visibility = hidden`) |
| `ExhibitRevisionsController` | `POST /api/exhibits/:id/unhide` | `revision:hide` | `exhibit.unhide` | Hiện lại hiện vật (kiểm tra trống bục `assertSlotFree`) |

### Đặc điểm kỹ thuật quan trọng
- **Diff đa ngôn ngữ từng trường (`LOCALIZED_DIFF_FIELDS` + `DIFF_FIELDS`)**: tách riêng từng ngôn ngữ trong `SUPPORTED_LOCALES` cho `name`, `description`, `transcript`, `altText`, cùng các trường 3D (`position`, `placeholderShape`, `placeholderColor`) và 6 slot media.
- **Chống xung đột đồng thời (`409 ConflictException`)**: nếu 2 moderator cùng thao tác hoặc hiện vật đã bị thay đổi trước đó, trả thông báo `"Nội dung đã bị thay đổi bởi người khác, vui lòng tải lại trang"`.
- **Dùng chung `RevisionPublishGate`**: khi `publish` chạy trong `TransactionManager`, gọi cả `assertPublishable()` (khóa media `FOR SHARE` + kiểm nội dung/quyền sử dụng) và `assertSlotFree()` (chống trùng bục `S01..S05`); khi `unhide` gọi `assertSlotFree()`.
- **Thông báo tự động**: sau khi duyệt hoặc từ chối, gọi `NotificationsService` gửi thông báo (`revision.approved` / `revision.rejected`) tới biên tập viên tạo revision.

## 2. Module Báo cáo Vi phạm (`ContentReportsModule`)

### Entity `ContentReport` (`content_reports`)
- `exhibit_id` (UUID), `reported_revision_id` (UUID, nullable — snapshot revision đang công khai tại thời điểm khách báo cáo).
- `reason_code` (`varchar(40)`), `description` (`text`).
- `status`: `open` → `reviewing` → `resolved` | `dismissed` (index `IDX_content_reports_status_created (status, created_at)`).
- `assigned_to` (UUID user xử lý), `resolution_note` (`text`), `resolved_at` (`timestamptz`).

### Endpoint Công khai & Quản trị
| Controller | Method & Route | Guard / Quyền | `@Audit` | Mô tả |
|---|---|---|---|---|
| `PublicReportsController` | `POST /api/public/reports` | `@Public()`, `ThrottlerGuard` | — | Khách tham quan gửi báo cáo sai sót/vi phạm cho hiện vật đang công khai |
| `ReportsController` | `GET /api/reports` | `report:read` | — | Danh sách báo cáo lọc theo trạng thái/người phụ trách |
| `ReportsController` | `GET /api/reports/assignees` | `report:resolve` | — | Danh sách tài khoản quản trị đủ quyền để phân công |
| `ReportsController` | `GET /api/reports/:id` | `report:read` | — | Chi tiết 1 báo cáo |
| `ReportsController` | `POST /api/reports/:id/assign` | `report:resolve` | `report.assign` | Phân công moderator xử lý (chuyển trạng thái sang `reviewing`, bắn thông báo `report.assigned`) |
| `ReportsController` | `POST /api/reports/:id/resolve` | `report:resolve` | `report.resolve` | Đóng báo cáo đã xử lý kèm ghi chú (`resolved_at`) |
| `ReportsController` | `POST /api/reports/:id/dismiss` | `report:resolve` | `report.dismiss` | Đóng báo cáo không hợp lệ/bỏ qua |

### Chính sách giới hạn tần suất cấu hình động (VT-081)
`ContentReportsModule` đăng ký `ThrottlerModule.forRootAsync()` đọc ngưỡng `reports.publicRateLimit` (`PUBLIC_REPORT_RATE_LIMIT`, mặc định **5 request / 60 giây**). Khi có báo cáo mới được tạo thành công, `NotificationsService` thông báo `report.created` cho nhóm quản trị có quyền `report:resolve`.
