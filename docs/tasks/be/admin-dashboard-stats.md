# Task 21: Số liệu Dashboard Admin (Stats)

Nhánh gốc: `feat/admin-dashboard-stats` → PR #33 (12/10/2026).

**Trạng thái:** Đã merge vào `dev`.

## Phạm vi

Module `back-end/src/modules/stats/` cung cấp số liệu **chỉ đọc** (COUNT / GROUP BY) cho
trang Dashboard: thẻ tổng quan, biểu đồ ApexCharts và trạng thái hệ thống. Không có bảng
hay migration riêng.

## API

| Method | Route | Quyền | Trả về |
|---|---|---|---|
| `GET` | `/api/admin/stats/overview` | Đăng nhập (không gắn `@Permissions`) | `OverviewStatsDto` |
| `GET` | `/api/admin/stats/charts` | Đăng nhập (không gắn `@Permissions`) | `StatsChartsDto` |

Mọi tài khoản quản trị đã đăng nhập đều xem được Dashboard; guard JWT toàn cục vẫn chặn
khách chưa đăng nhập (401).

### `OverviewStatsDto`

| Nhóm | Field | Cách tính |
|---|---|---|
| `rooms` | `total`, `active`, `archived` | đếm phòng `isDeleted = false`, theo `status` |
| `exhibits` | `total`, `visible`, `hidden` | đếm hiện vật `isDeleted = false`, theo `visibility` |
| `revisions` | `inReview`, `draft` | đếm revision theo `state` |
| `reports` | `open`, `inProgress` | đếm báo cáo chưa đóng |
| `system` | `api`, `db`, `uptimeSec`, `serverTime` | `api` luôn `up`; `db` chạy `SELECT 1`, lỗi → `down` |

`db = down` không làm endpoint lỗi 500 ở bước kiểm tra hệ thống — Dashboard vẫn hiện được
trạng thái. (Các phép đếm khác vẫn cần DB.)

### `StatsChartsDto`

| Field | Biểu đồ | Nguồn |
|---|---|---|
| `reportsByStatus` | Pie/Donut | `content_reports` GROUP BY `status` |
| `exhibitsByRoom` | Bar | `exhibits` JOIN `rooms`, bỏ xóa mềm, GROUP BY `room.name`, giảm dần |
| `revisionsByState` | Column | `exhibit_revisions` GROUP BY `state` |
| `activityLast14Days` | Mixed | số revision tạo mới và báo cáo gửi mỗi ngày |

`activityLast14Days`:

- Luôn trả đủ **14 phần tử** liên tục (ngày không có dữ liệu = 0), tính từ 00:00 UTC
  13 ngày trước tới hôm nay.
- Gộp theo ngày **UTC** (`TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`). Hoạt động
  từ 00:00 tới 07:00 giờ Việt Nam rơi vào ngày UTC hôm trước.

Các truy vấn trong mỗi endpoint chạy song song bằng `Promise.all`.

## Ghi chú kiến trúc

`StatsService` inject thẳng `Repository<Room|Exhibit|ExhibitRevision|ContentReport>` và
`DataSource`, không qua repository riêng. Đây là ngoại lệ so với quy ước
Controller → Service → Repository: module chỉ đọc số liệu tổng hợp từ nhiều bảng của module
khác. Nếu thêm truy vấn phức tạp, cân nhắc tách `StatsRepository`.

## Front-end

- Service: `front-end/src/services/stats.service.ts` (`overview`, `charts`).
- Màn hình: `front-end/src/pages/admin/DashboardPage.tsx` (trang đầu `/admin`).

## Kiểm thử

```bash
cd back-end && npm run test:stats
```

`stats-service.spec.ts`: happy-path overview/charts và trường hợp DB down (`system.db = 'down'`).
