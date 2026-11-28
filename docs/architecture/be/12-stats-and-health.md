# 12 — Thống kê Dashboard và Giám sát Sức khỏe (`modules/stats/`, `modules/health/`)

> Mã nguồn: `back-end/src/modules/stats/` và `back-end/src/modules/health/`.

## 1. Module Thống kê Quản trị (`StatsModule`)

`StatsService` chỉ thực hiện các truy vấn **chỉ đọc (read-only)** dạng `COUNT` / `SUM` / `GROUP BY` trực tiếp trên các bảng hiện có (`rooms`, `exhibits`, `exhibit_revisions`, `content_reports`, `media`, `audit_logs`), không thay đổi lược đồ và không tạo bảng riêng.

### Danh mục Endpoint (`StatsController` — `/api/admin/stats`)
Tất cả endpoint yêu cầu Bearer JWT + phiên sống (`JwtAuthGuard` + `ActiveSessionGuard`):

| Endpoint | DTO trả về | Nội dung tổng hợp |
|---|---|---|
| `GET /api/admin/stats/overview` | `OverviewStatsDto` | Các thẻ số liệu tổng quan Dashboard: số phòng (`active`/`archived`), hiện vật (`visible`/`hidden`), revision theo trạng thái (chờ duyệt `in_review`), báo cáo vi phạm (`open`/`reviewing`) và trạng thái hệ thống |
| `GET /api/admin/stats/charts` | `StatsChartsDto` | 4 tập dữ liệu biểu đồ chạy song song (`Promise.all`): `reportsByStatus`, `exhibitsByRoom`, `revisionsByState`, và chuỗi hoạt động `activityLast14Days` |
| `GET /api/admin/stats/storage` | `StorageStatsDto` | Tổng dung lượng lưu trữ (`bytes`, `count`) gom nhóm theo `media.kind` (bỏ qua các bản ghi `is_deleted = true`), kèm `totalBytes` và `totalCount` |

## 2. Module Sức khỏe Hệ thống (`HealthModule`)

`HealthController` gắn `@Public()` để load balancer, Docker/Kubernetes và công cụ giám sát gọi được không cần JWT, tách rạch ròi 2 loại probe chuẩn vận hành:

| Endpoint | Loại probe | Hành vi & Mã HTTP |
|---|---|---|
| `GET /api/health` | **Liveness** | Trả ngay `200 { status: 'ok' }` mà **không chạm DB**. Tránh việc orchestrator khởi động lại container hàng loạt khi PostgreSQL chỉ chập chờn tạm thời. |
| `GET /api/health/ready` | **Readiness** | Gọi `HealthService.pingDatabase()` chạy `SELECT 1` với giới hạn thời gian **`timeoutMs = 2000` ms** (dùng `Promise.race` và dọn `clearTimeout` trong `finally`). DB trả lời kịp → `200 { status: 'ok', db: 'up', latencyMs }`; DB lỗi hoặc quá 2 giây → ghi log cảnh báo nội bộ và trả `503 ServiceUnavailableException('Cơ sở dữ liệu không sẵn sàng')` (không lộ chuỗi kết nối hay lỗi SQL). |

### Khuyến nghị cấu hình triển khai
- Trỏ **liveness probe** về `GET /api/health` (interval 15–30s).
- Trỏ **readiness probe** / health check của reverse proxy về `GET /api/health/ready` (timeout ≥ 3s để khớp `timeoutMs = 2000ms` phía ứng dụng).
