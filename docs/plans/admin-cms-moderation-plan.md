# Plan triển khai — Phân hệ Admin CMS: Dashboard · Kiểm duyệt · Báo cáo · Nhật ký · Integration (Task 21–25)

> Người phụ trách: **Quang** (mảng "Admin dashboard/duyệt", STT plan 21–25 trong
> [`../architecture/09-roadmap-and-branching.md`](../architecture/09-roadmap-and-branching.md)).
> Bám sát kiến trúc [`../architecture/06-api-contract.md`](../architecture/06-api-contract.md) §6.3 (Kiểm duyệt & báo cáo)
> và [`../architecture/07-admin-subsystem.md`](../architecture/07-admin-subsystem.md).
> Quy ước Git: nhánh từ `dev`, **commit nhỏ & nhiều**, conventional commits, PR vào `dev` rồi merge; **không** merge thẳng `main`.

## 0. Bối cảnh & những gì đã có sẵn (tái sử dụng, KHÔNG dựng lại)

| Hạng mục | Trạng thái | Dùng cho task |
|---|---|---|
| Entity `Exhibit` (có `publishedRevisionId`, `version`, `visibility`, soft-delete) | ✅ | 21,22 |
| Entity `ExhibitRevision` (state `draft/in_review/approved/rejected`, `content` jsonb, `reviewedBy/reason`) | ✅ | 22 |
| Entity `ContentReport` (status `open/in_progress/resolved/dismissed`, `assignedTo`, `resolution`) | ✅ | 23 |
| Entity + module `AuditLog` + `AuditController` (GET `/audit`, `/audit/:id`) + `AuditInterceptor` + `@Audit()` | ✅ | 24 |
| `PERMISSIONS`: `revision:publish/reject/hide`, `report:read/resolve`, `audit:read`, `exhibit:*` | ✅ | 22,23,24 |
| Module `rooms` (admin CRUD + service + repo + **bộ test mẫu**) | ✅ mẫu chuẩn | 21,22,23 |
| FE `AuditPage.tsx` + `audit.service.ts` (đã nối API) | ✅ | 24 (mở rộng) |
| FE `DashboardPage.tsx` (StatCard khung, value "—") | ✅ khung | 21 |
| FE `http-client` (`getPage/post/patch`), `ApiException.status` (bắt 409), `shared/components` (DataTable, StatCard, PageHeader) | ✅ | tất cả |
| `ResponseInterceptor` (bọc `ApiResponse`/`Paginated`), `AllExceptionsFilter` | ✅ | tất cả |

**Khoảng trống phải lấp:**
- `exhibits` mới chỉ có controller public read → cần **admin controller + service** đọc exhibit/revision cho kiểm duyệt (task 22). Việc tạo draft/submit là của **task 7 (Thành)**; để test độc lập ta thêm **seed fixture revision `in_review`** (xem §6).
- `content-reports` mới chỉ có **entity** → dựng cả module (task 23).
- Chưa có module `stats`/`dashboard` → dựng mới (task 21).
- Chưa có endpoint moderation (`/moderation/queue`, `/moderation/revisions/:id/diff`) → dựng mới (task 22).

---

## Task 21 — Dashboard Admin CMS tổng quan (`admin.html`)

**Mục tiêu:** Trang tổng quan thống kê phòng, hiện vật, báo cáo, chờ duyệt + trạng thái hệ thống; bàn giao UI hoàn chỉnh.

### 21.1 Back-end — module `stats`
- Thư mục: `back-end/src/modules/stats/` (controller/service/dto theo convention phẳng).
- Endpoint: `GET /admin/stats/overview` — quyền: yêu cầu đăng nhập (không cần permission đặc biệt; mọi role quản trị xem được). Trả:
  ```ts
  class OverviewStatsDto {
    rooms: { total: number; active: number; archived: number };
    exhibits: { total: number; visible: number; hidden: number };
    revisions: { inReview: number; draft: number };     // "chờ duyệt"
    reports: { open: number; inProgress: number };       // "báo cáo mở"
    system: { api: 'up'; db: 'up' | 'down'; uptimeSec: number; serverTime: string };
  }
  ```
- `StatsService` dùng các repository hiện có (`rooms`, `exhibits`, revisions, reports) đếm bằng `count()` theo điều kiện; `system.db` thử `SELECT 1` qua `DataSource`; `uptimeSec` từ `process.uptime()`.
- **Dữ liệu cho biểu đồ** (bổ sung vào `OverviewStatsDto` hoặc endpoint `GET /admin/stats/charts`):
  ```ts
  class StatsChartsDto {
    reportsByStatus: { status: string; count: number }[];        // → Pie/Donut
    exhibitsByRoom: { room: string; count: number }[];           // → Bar/Column
    revisionsByState: { state: string; count: number }[];        // → Column
    activityLast14Days: { date: string; revisions: number; reports: number }[]; // → Mixed (line + column) từ audit_logs/created_at
  }
  ```
- **Không** đổi schema → không migration (chỉ GROUP BY/count trên bảng có sẵn).

### 21.2 Front-end — dùng **ApexCharts** (`react-apexcharts` + `apexcharts`)
- Cài `apexcharts` + `react-apexcharts` (thêm vào `front-end/package.json`). Tạo wrapper `shared/components/charts/` để thống nhất theme (màu Mantine `aura`, dark/light, responsive, locale vi-VN) — **không** rải option ApexCharts khắp nơi.
- `services/stats.service.ts` — `statsService.overview()` + `statsService.charts()`.
- Nối `DashboardPage.tsx`:
  - Hàng **StatCard** số thật (phòng / hiện vật / chờ duyệt / báo cáo mở) + **card trạng thái hệ thống** (API/DB badge up/down, server time, uptime).
  - **Donut/Pie** — báo cáo theo trạng thái (`reportsByStatus`).
  - **Bar (ngang)** — hiện vật theo phòng (`exhibitsByRoom`).
  - **Column** — revision theo state (`revisionsByState`).
  - **Mixed (line + column)** — hoạt động 14 ngày (revisions vs reports) từ `activityLast14Days`.
  - Loading skeleton + error alert cho từng card/chart; empty state khi count = 0.
- Giữ theo dataviz: swap palette thương hiệu `aura`, màu nhất quán light/dark, legend/axis/tooltip rõ ràng. (Khi code chart sẽ nạp skill `dataviz` trước khi viết dòng chart đầu tiên.)
- Giữ `admin.html` = SPA Vite (entry `index.html`), route `/admin` (đã có). "Bàn giao UI hoàn chỉnh" = responsive + empty/loading/error states.

### 21.3 Nhánh & commit (`feat/admin-dashboard-stats`)
1. `feat(be-stats): tạo module stats rỗng + wiring vào AppModule`
2. `feat(be-stats): OverviewStatsDto + hợp đồng response`
3. `feat(be-stats): StatsService đếm rooms/exhibits`
4. `feat(be-stats): bổ sung đếm revisions chờ duyệt + reports mở`
5. `feat(be-stats): health check DB + uptime cho system status`
6. `feat(be-stats): dữ liệu charts (GROUP BY status/room/state + hoạt động 14 ngày)`
7. `feat(be-stats): StatsController GET /admin/stats/overview + /charts + Swagger`
8. `test(be-stats): unit test StatsService (happy-path + DB down)`
9. `chore(fe): cài apexcharts + react-apexcharts`
10. `feat(fe-dashboard): wrapper chart theo theme aura (light/dark, vi-VN)`
11. `feat(fe-dashboard): stats.service.ts gọi /admin/stats/overview + /charts`
12. `feat(fe-dashboard): nối số liệu thật vào StatCard`
13. `feat(fe-dashboard): Donut báo cáo theo trạng thái`
14. `feat(fe-dashboard): Bar hiện vật theo phòng`
15. `feat(fe-dashboard): Column revision theo state`
16. `feat(fe-dashboard): Mixed line+column hoạt động 14 ngày`
17. `feat(fe-dashboard): card trạng thái hệ thống (API/DB/uptime)`
18. `feat(fe-dashboard): loading skeleton + error + empty state cho chart`
19. `docs(dashboard): cập nhật api-contract cho /admin/stats/*`
→ **PR #21 → `dev`**.

---

## Task 22 — Giao diện & API Kiểm duyệt nội dung (`moderation.html`)

**Mục tiêu:** Duyệt revision chờ (`in_review`), xem lịch sử revision, so sánh cũ/mới (diff), xuất bản (publish), từ chối (reject), tạm ẩn/hiện hiện vật kèm phiên bản.

### 22.1 Back-end — module `moderation` (+ mở rộng `exhibits`)
- Entity reuse: `Exhibit`, `ExhibitRevision`. **Không đổi schema.**
- Endpoints (khớp §6.3 contract):

| Method | Path | Quyền | Việc |
|---|---|---|---|
| GET | `/moderation/queue?page&pageSize&roomId` | `revision:publish` | List revision `in_review` (kèm exhibit, người tạo) |
| GET | `/moderation/revisions/:id` | `exhibit:read` | Chi tiết 1 revision |
| GET | `/exhibits/:id/revisions` | `exhibit:read` | Lịch sử revision của 1 hiện vật |
| GET | `/moderation/revisions/:id/diff` | `exhibit:read` | So sánh revision này với published hiện tại (field-by-field) |
| POST | `/revisions/:id/publish` | `revision:publish` | `in_review→approved`, set `exhibit.publishedRevisionId`, `version++`, `visibility=visible` |
| POST | `/revisions/:id/reject` | `revision:reject` | `in_review→rejected` + bắt buộc `reason` |
| POST | `/exhibits/:id/hide` | `revision:hide` | `visibility=hidden` + `archivedAt` |
| POST | `/exhibits/:id/unhide` | `revision:hide` | `visibility=visible` |

- **Optimistic concurrency (409):** publish/reject/hide nhận body `{ version }` (version của exhibit mà client đang thấy). Service so khớp `exhibit.version`; lệch → ném `ConflictException` (409) với message "Nội dung đã bị thay đổi, vui lòng tải lại". Dùng `UPDATE ... WHERE id=? AND version=?` (hoặc TransactionManager) để atomic, lệch → 409.
- **Diff:** service đọc `content` (jsonb) của revision đích + của `publishedRevision`, trả mảng `{ field, oldValue, newValue, changed }` cho `name/description/transcript/position/placeholder*`.
- **Audit:** gắn `@Audit('revision.publish','revision')`, `@Audit('revision.reject','revision')`, `@Audit('exhibit.hide','exhibit')`, `@Audit('exhibit.unhide','exhibit')` → task 24 tự ghi vết.
- DTO: `ListQueueQueryDto`, `PublishRevisionDto{version}`, `RejectRevisionDto{version,reason}`, `HideExhibitDto{version}`, `RevisionDiffDto`, `RevisionResponseDto` (ẩn field nội bộ).

### 22.2 Front-end — `moderation.html` (route `/admin/moderation`)
- `services/moderation.service.ts`: `queue()`, `getRevision(id)`, `diff(id)`, `history(exhibitId)`, `publish(id, version)`, `reject(id, version, reason)`, `hide(exhibitId, version)`, `unhide(...)`.
- `pages/admin/ModerationPage.tsx`: `DataTable` hàng chờ duyệt; row click → `Drawer` chi tiết với **tab Diff (cũ ▏mới, highlight thay đổi)**, **tab Lịch sử revision**, nút **Publish / Reject (modal nhập lý do) / Hide**.
- Thay `PlaceholderPage` ở router `moderation` bằng `ModerationPage` + bọc `RequirePermission anyOf={[REVISION_PUBLISH]}`.
- Thêm key `REVISION_PUBLISH/REJECT/HIDE`, `EXHIBIT_READ` vào `core/auth/permissions.ts` (FE).
- **Xử lý 409:** mutation `onError` kiểm tra `err.status === 409` → `notifications` cảnh báo + tự `refetch` queue/detail.

### 22.3 Nhánh & commit (`feat/admin-moderation`)
1. `feat(be-moderation): scaffold module moderation + wiring AppModule`
2. `feat(be-moderation): DTO queue/publish/reject/hide/diff`
3. `feat(be-exhibits): repository đọc revisions theo exhibit + state`
4. `feat(be-moderation): service queue revision in_review (phân trang)`
5. `feat(be-moderation): endpoint GET lịch sử revision của hiện vật`
6. `feat(be-moderation): service + endpoint diff cũ/mới field-by-field`
7. `feat(be-moderation): publish revision (approved + set published + version++)`
8. `feat(be-moderation): optimistic concurrency → 409 khi version lệch`
9. `feat(be-moderation): reject revision bắt buộc lý do`
10. `feat(be-moderation): hide/unhide exhibit kèm version`
11. `feat(be-moderation): gắn @Audit cho publish/reject/hide/unhide`
12. `test(be-moderation): publish happy-path + reject thiếu lý do (422) + version lệch (409)`
13. `feat(fe-moderation): moderation.service.ts + types`
14. `feat(fe-moderation): ModerationPage bảng hàng chờ duyệt`
15. `feat(fe-moderation): Drawer chi tiết + tab lịch sử revision`
16. `feat(fe-moderation): tab Diff so sánh cũ/mới highlight thay đổi`
17. `feat(fe-moderation): hành động Publish/Reject(modal lý do)/Hide`
18. `feat(fe-moderation): bắt 409 → cảnh báo reload + refetch`
19. `feat(fe-moderation): gắn route /admin/moderation + RequirePermission`
20. `docs(moderation): cập nhật api-contract endpoints kiểm duyệt`
→ **PR #22 → `dev`**.

---

## Task 23 — Màn hình & API Xử lý báo cáo vi phạm (`reports.html`)

**Mục tiêu:** Admin xem thông tin phiên bản bị báo cáo, tiếp nhận (in_progress), duyệt xử lý (resolve) & đóng (dismiss) báo cáo từ Client.

### 23.1 Back-end — module `content-reports` (dựng đầy đủ quanh entity có sẵn)

| Method | Path | Quyền | Việc |
|---|---|---|---|
| GET | `/reports?page&pageSize&status` | `report:read` | List báo cáo (kèm exhibit + reportedRevision) |
| GET | `/reports/:id` | `report:read` | Chi tiết + phiên bản bị báo cáo |
| POST | `/reports/:id/assign` | `report:resolve` | `open→in_progress`, set `assignedTo` = actor |
| POST | `/reports/:id/resolve` | `report:resolve` | `→resolved` + `resolution` + `resolvedAt` |
| POST | `/reports/:id/dismiss` | `report:resolve` | `→dismissed` + `resolution` |
| POST | `/public/reports` | public (rate-limit) | Client gửi báo cáo (`exhibitId`, `reportedRevisionId?`, `category`, `message`) |

- DTO: `ListReportsQueryDto{status?}`, `CreateReportDto` (public, validate + `@Throttle`), `ResolveReportDto{resolution}`, `DismissReportDto{resolution}`, `ReportResponseDto`.
- Service: chuyển trạng thái hợp lệ (open→in_progress→resolved/dismissed); trạng thái sai → 409/422.
- `@Audit('report.resolve','report')`, `@Audit('report.dismiss','report')`, `@Audit('report.assign','report')`.
- Public POST đánh `@Public()` + `@Throttle` (chống spam); không đổi schema.

### 23.2 Front-end — `reports.html` (route `/admin/reports`)
- `services/reports.service.ts`: `list({status})`, `get(id)`, `assign(id)`, `resolve(id, resolution)`, `dismiss(id, resolution)`.
- `pages/admin/ReportsPage.tsx`: filter theo status (Select), `DataTable`; row → `Drawer` hiện **thông tin phiên bản bị báo cáo** (đọc revision), nút Tiếp nhận / Xử lý / Đóng (modal nhập `resolution`). Badge màu theo status.
- Router: thay `PlaceholderPage` `reports` → `ReportsPage`, bọc `RequirePermission anyOf={[REPORT_READ]}`.

### 23.3 Nhánh & commit (`feat/admin-reports`)
1. `feat(be-reports): scaffold module content-reports + repository`
2. `feat(be-reports): DTO list/create/resolve/dismiss`
3. `feat(be-reports): service list + get kèm revision bị báo cáo`
4. `feat(be-reports): assign (open→in_progress)`
5. `feat(be-reports): resolve + dismiss + validate chuyển trạng thái`
6. `feat(be-reports): endpoint public POST /public/reports + throttle`
7. `feat(be-reports): gắn @Audit cho assign/resolve/dismiss`
8. `test(be-reports): luồng open→in_progress→resolved + chuyển trạng thái sai`
9. `feat(fe-reports): reports.service.ts + types`
10. `feat(fe-reports): ReportsPage bảng + filter status`
11. `feat(fe-reports): Drawer chi tiết + thông tin phiên bản bị báo cáo`
12. `feat(fe-reports): hành động tiếp nhận/xử lý/đóng (modal resolution)`
13. `feat(fe-reports): route /admin/reports + RequirePermission`
14. `docs(reports): cập nhật api-contract endpoints báo cáo`
→ **PR #23 → `dev`**.

---

## Task 24 — Nhật ký hệ thống (`audit.html`)

**Mục tiêu:** Tự động ghi vết & hiển thị lịch sử thay đổi trạng thái CMS của quản trị viên. (BE audit module + FE `AuditPage` đã có khung — task này hoàn thiện ghi vết tự động cho luồng CMS + nâng cấp UI.)

### 24.1 Back-end
- `AuditInterceptor`/`@Audit()` đã có → đảm bảo **đã gắn** vào mọi hành động CMS (từ task 22/23): publish/reject/hide/unhide/report.*. Bổ sung ghi `revisionId` khi hành động trên revision.
- Mở rộng filter list nếu cần: thêm `resourceType` cho `revision/exhibit/report` (đã có query param; chỉ cần dữ liệu).
- Kiểm tra append-only (không có endpoint sửa/xóa) — giữ nguyên.

### 24.2 Front-end — nâng cấp `AuditPage.tsx`
- Mở rộng `RESOURCE_OPTIONS`: thêm `exhibit`, `revision`, `report` (hiện chỉ `user/role`).
- Thêm filter **actor** (chọn người thực hiện) + hiển thị `revisionId` trong Drawer khi có.
- Badge màu theo nhóm action (create/update/publish/reject/hide/resolve…).

### 24.3 Nhánh & commit (`feat/admin-audit-cms`)
1. `feat(be-audit): đảm bảo @Audit phủ publish/reject/hide/unhide`
2. `feat(be-audit): ghi revisionId cho hành động trên revision`
3. `feat(be-audit): @Audit cho report.assign/resolve/dismiss`
4. `test(be-audit): interceptor ghi đúng action/resource/revisionId`
5. `feat(fe-audit): bổ sung resource exhibit/revision/report vào filter`
6. `feat(fe-audit): filter theo actor + hiển thị revisionId`
7. `feat(fe-audit): badge màu theo nhóm hành động`
8. `docs(audit): bảng ánh xạ action → resource cho CMS`
→ **PR #24 → `dev`**.

> Ghi chú phụ thuộc: nhiều commit task 24 (ghi vết publish/reject/report) thực tế **đi kèm** task 22/23. Có thể gộp phần `@Audit` vào PR 22/23 và để PR 24 tập trung **hoàn thiện UI audit + test ghi vết**. Chốt khi bắt tay làm.

---

## Task 25 — Kiểm thử tích hợp luồng CMS Admin + xung đột 409 + thông báo lỗi UI

**Mục tiêu:** Integration test luồng Admin với backend thật, xử lý sửa đồng thời (409 Conflict) và thông báo lỗi giao diện.

### 25.1 Back-end — integration (e2e) test
- `back-end/test/*.e2e-spec.ts` dùng `supertest` + DB test (hoặc sqlite/in-memory nếu cấu hình cho phép; nếu không → Postgres test schema).
- Kịch bản:
  1. Login admin → nhận token.
  2. Seed 1 exhibit + 1 revision `in_review`.
  3. **Luồng publish:** publish đúng `version` → 200, exhibit `publishedRevisionId` đổi, `version++`, audit log tạo.
  4. **409 Conflict:** 2 request publish/hide cùng `version` cũ → request sau nhận **409**.
  5. **Reject thiếu reason → 422**; thiếu quyền → 403; chưa đăng nhập → 401.
  6. **Luồng report:** public POST report → admin list → assign → resolve; trạng thái sai → lỗi.

### 25.2 Front-end — xử lý & thông báo lỗi
- Chuẩn hóa `onError` cho mọi mutation CMS: map `ApiException.status` → thông báo tiếng Việt:
  - 409 → "Nội dung đã bị thay đổi bởi người khác, đang tải lại…" + auto refetch.
  - 403 → "Bạn không đủ quyền thực hiện"; 422 → map `fieldErrors` vào form; 0 → "Mất kết nối máy chủ".
- Component/hook dùng chung: `useCmsMutation` hoặc helper `handleCmsError(err)` trong `shared/`.
- (Nếu có E2E FE) Playwright smoke: login → moderation → publish → thấy toast thành công; mô phỏng 409.

### 25.3 Nhánh & commit (`test/admin-cms-integration`)
1. `chore(test): hạ tầng e2e supertest + app test factory`
2. `test(e2e): seed fixture exhibit + revision in_review`
3. `test(e2e): publish revision happy-path + audit được ghi`
4. `test(e2e): 409 khi publish/hide với version cũ`
5. `test(e2e): reject thiếu lý do 422, thiếu quyền 403, chưa login 401`
6. `test(e2e): luồng report public→assign→resolve`
7. `feat(fe): helper handleCmsError chuẩn hóa thông báo lỗi`
8. `refactor(fe): áp handleCmsError cho mutation moderation/reports`
9. `test(fe): unit test handleCmsError map 409/403/422/0`
10. `docs(test): checklist integration + ma trận mã lỗi 401/403/409/422`
→ **PR #25 → `dev`**.

---

## 6. Phụ thuộc chéo & cách gỡ (quan trọng)

- **Task 22 cần revision `in_review`** nhưng việc tạo draft/submit thuộc **task 7 (Thành)**. Để làm/test độc lập: thêm **seed fixture** (1–2 revision `in_review`) trong `database/seeds` hoặc helper test. Không chặn tiến độ.
- **Task 24 (@Audit)** đan xen task 22/23 → ưu tiên gắn `@Audit` ngay trong PR 22/23, PR 24 lo UI + test ghi vết.
- **Thứ tự đề xuất:** 21 (độc lập, nhanh) → 22 (lõi, nặng nhất) → 23 → 24 → 25 (chốt chất lượng).

## 7. Definition of Done (mỗi PR, theo 09-roadmap §9.4)

- [ ] `typecheck` + `lint` + `build` sạch (BE & FE).
- [ ] DTO tách Entity; endpoint trả `ApiResponse`; có `@Audit` cho hành động ghi.
- [ ] Không đổi schema (các task này tái dùng entity có sẵn) → **không** cần migration.
- [ ] Test tối thiểu: happy-path + ≥1 nhánh lỗi (409/422/403).
- [ ] Commit nhỏ, conventional, **nhiều & chi tiết**; không commit secret.
- [ ] Mô tả PR: mục tiêu, phạm vi, cách chạy/test, screenshot UI.
- [ ] PR vào `dev`, chờ review, không merge thẳng `main`.
