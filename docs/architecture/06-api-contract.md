# 06 — Hợp đồng API (API Contract)

Tiền tố: tất cả endpoint dưới `/api`. Tài liệu sống: **Swagger** tại `/api/docs`.

## 6.1 Envelope chuẩn `ApiResponse<T>`

Thành công:
```json
{ "success": true, "data": { ... }, "message": null }
```
Danh sách (có phân trang):
```json
{ "success": true, "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 137 } }
```
Lỗi:
```json
{ "success": false, "message": "Dữ liệu không hợp lệ",
  "errors": [ { "field": "name", "code": "isNotEmpty", "message": "Tên không được rỗng" } ] }
```

## 6.2 Quy ước HTTP

| Mã | Khi nào |
|---|---|
| 200/201 | OK / tạo mới |
| 400 | sai cú pháp request |
| 401 | chưa/đã hết hạn đăng nhập |
| 403 | thiếu quyền (RBAC) |
| 404 | không tìm thấy |
| 409 | xung đột (sửa đồng thời, slug trùng) — FE hiện cảnh báo reload |
| 422 | validation thất bại (chi tiết trong `errors`) |
| 429 | vượt rate limit |

**Phân trang:** `?page=1&pageSize=20&sort=createdAt:desc&q=keyword`.
**Optimistic concurrency:** sửa revision gửi kèm `version`; lệch → 409.

## 6.3 Danh mục endpoint (MVP)

### Auth & quản trị hệ thống (phân hệ dựng trước)
```
POST   /auth/login            POST /auth/refresh    POST /auth/logout    GET /auth/me
GET    /users                 POST /users           GET /users/:id       PATCH /users/:id     DELETE /users/:id
POST   /users/:id/roles       PUT  /users/:id/roles              # thêm / thay toàn bộ ([] = bỏ hết, bảo vệ Admin cuối)
DELETE /users/:id/roles/:roleId
GET    /roles                 POST /roles           PATCH /roles/:id     DELETE /roles/:id
GET    /roles/:id/permissions PUT  /roles/:id/permissions        # set quyền của 1 vai trò
PUT    /roles/permission-matrix                                  # cập nhật nhiều vai trò trong 1 transaction
GET    /permissions                                              # danh mục permission
GET    /health                                                   # @Public, trả { status: 'ok' }
GET    /audit                 GET  /audit/:id                    # nhật ký (lọc theo actor/action/thời gian)
GET    /admin/stats/overview                                     # số liệu tổng quan Dashboard
GET    /admin/stats/charts                                       # dữ liệu biểu đồ Dashboard
```

#### Stats (Dashboard Admin) — Task 21

`GET /admin/stats/overview` → `OverviewStatsDto`:
```json
{
  "rooms":     { "total": 12, "active": 9, "archived": 3 },
  "exhibits":  { "total": 48, "visible": 40, "hidden": 8 },
  "revisions": { "inReview": 5, "draft": 11 },
  "reports":   { "open": 4, "inProgress": 2 },
  "system":    { "api": "up", "db": "up", "uptimeSec": 38124, "serverTime": "2026-10-12T08:30:00.000Z" }
}
```

`GET /admin/stats/charts` → `StatsChartsDto` (dữ liệu đã GROUP BY để FE vẽ ApexCharts):
```json
{
  "reportsByStatus":    [ { "label": "open", "count": 4 } ],
  "exhibitsByRoom":     [ { "label": "Phòng A", "count": 12 } ],
  "revisionsByState":   [ { "label": "in_review", "count": 5 } ],
  "activityLast14Days": [ { "date": "2026-10-12", "revisions": 3, "reports": 1 } ]
}
```
> Chỉ đọc (count/GROUP BY), không đổi schema. Yêu cầu đăng nhập; mọi role quản trị xem được.
> Chi tiết: [`docs/tasks/be/admin-dashboard-stats.md`](../tasks/be/admin-dashboard-stats.md).

### CMS nội dung

Route CMS thực tế dùng prefix `/admin/*` (bản thiết kế ban đầu `/rooms`, `/exhibits`,
`/media` không còn dùng cho thao tác ghi).

```
# Phòng — room:read|create|update|delete, audit room.*
GET    /admin/rooms               GET /admin/rooms/:id
POST   /admin/rooms               PATCH /admin/rooms/:id (slug bất biến)    DELETE /admin/rooms/:id (xóa mềm, BR-20)

# Hiện vật & revision — exhibit:read|create|update, revision:submit
GET    /admin/exhibits            GET /admin/exhibits/:id                   # lọc phòng/trạng thái/tìm kiếm
GET    /admin/exhibits/:id/preview                                          # preview bản nháp (3D transform + hotspot)
GET    /admin/exhibits/:id/revisions             GET /admin/exhibits/:id/revisions/:revId
POST   /admin/exhibits                           # tạo hiện vật + Revision #1 (draft)
PATCH  /admin/exhibits/:id                       # sửa nháp; đã xuất bản → fork revision mới (BR-21); gắn media qua modelId, imageId, audioViId...
POST   /admin/exhibits/:id/submit-review         # draft -> in_review
DELETE /admin/exhibits/:id                       # xóa cả hiện vật — chặn nếu đã public/được bảo vệ (BR-20)
DELETE /admin/exhibits/:id/revisions/:revId      # xóa 1 revision nháp
PUT    /admin/exhibits/rooms/:roomId/reorder     # thứ tự guided tour (displayOrder)

# Media — media:upload, audit media.*
GET    /admin/media               GET /admin/media/:id     GET /admin/media/:id/content
POST   /admin/media/upload  (multipart)          # kiểm định dạng thật, dung lượng, cấu trúc file
PATCH  /admin/media/:id                          # metadata: nguồn, tác giả, giấy phép, alt text
DELETE /admin/media/:id                          # xóa mềm; 409 nếu hiện vật đã xuất bản đang dùng (BR-21)
```

Chi tiết: [`docs/tasks/be/rooms-crud.md`](../tasks/be/rooms-crud.md),
[`cms-exhibits-management.md`](../tasks/be/cms-exhibits-management.md),
[`cms-media-upload.md`](../tasks/be/cms-media-upload.md),
[`../tasks/exhibit-deletion-policy.md`](../tasks/exhibit-deletion-policy.md).

### Kiểm duyệt & báo cáo
```
GET    /moderation/queue                  # revision chờ duyệt
GET    /moderation/revisions/:id          # chi tiết 1 revision
GET    /moderation/revisions/:id/diff     # so sánh phiên bản cũ/mới
GET    /exhibits/:id/revisions            # lịch sử revision của hiện vật
POST   /revisions/:id/publish             # in_review -> approved (moderator)
POST   /revisions/:id/reject              # kèm lý do (bắt buộc)
POST   /exhibits/:id/hide  |  /unhide     # tạm ẩn/hiện hiện vật
GET/POST /reports                         # Admin xem; Client gửi (public, rate-limited)
POST   /reports/:id/resolve  | /dismiss
```

#### Moderation (Task 22) — optimistic concurrency

- `POST /revisions/:id/publish` body `{ version }`, `/reject` body `{ version, reason }`,
  `/exhibits/:id/hide|unhide` body `{ version }`. `version` là phiên bản hiện vật phía client đang xem.
- Cập nhật nguyên tử `UPDATE ... WHERE id=? AND version=?`; lệch version → **409 Conflict**
  (message "Nội dung đã bị thay đổi... tải lại"). Publish tăng `version`, đặt `publishedRevisionId`, `visibility=visible`.
- Quyền: queue `revision:publish`; đọc chi tiết/diff/lịch sử `exhibit:read`; publish/reject/hide theo `revision:publish|reject|hide`.
- Mọi hành động ghi vết qua `@Audit` (revision.publish/reject, exhibit.hide/unhide).
- Chi tiết module: [`docs/tasks/be/moderation.md`](../tasks/be/moderation.md).

#### Reports (Task 23)

- `GET /reports?page&pageSize&status` (`report:read`) → danh sách; `GET /reports/:id` (`report:read`) → chi tiết kèm phiên bản bị báo cáo.
- `POST /reports/:id/assign` (`report:resolve`): open → in_progress, gán người tiếp nhận.
- `POST /reports/:id/resolve` body `{ resolution }` (`report:resolve`): → resolved.
- `POST /reports/:id/dismiss` body `{ resolution }` (`report:resolve`): → dismissed.
- `POST /public/reports` **@Public** body `{ exhibitId, reportedRevisionId?, category, message }`, rate-limit 5 lần/phút.
- Chuyển trạng thái chỉ hợp lệ khi báo cáo còn mở (open/in_progress) → sai → **409**. Ghi vết `@Audit` report.assign/resolve/dismiss.
- Chi tiết module: [`docs/tasks/be/content-reports.md`](../tasks/be/content-reports.md).

#### Audit (Task 24)

`GET /audit?page&pageSize&actorId&action&resourceType&from&to` + `GET /audit/:id` (`audit:read`). Append-only, không có endpoint sửa/xóa.
Ghi vết tự động qua `AuditInterceptor` + `@Audit(action, resourceType)`. Ánh xạ hành động CMS:

| action | resourceType | revisionId | Nguồn |
|---|---|---|---|
| room.create/update/delete | room | — | AdminRoomsController |
| revision.publish | revision | = resourceId | RevisionsController |
| revision.reject | revision | = resourceId | RevisionsController |
| exhibit.hide / exhibit.unhide | exhibit | — | ExhibitRevisionsController |
| report.assign/resolve/dismiss | report | — | ReportsController |

> Với `resourceType='revision'`, interceptor lưu thêm FK `revisionId` để join `audit_logs → exhibit_revisions`.

### Public (client — chỉ đọc nội dung published)
```
GET    /public/rooms/:slug                # phòng + danh sách hiện vật published
GET    /public/exhibits/:id               # chi tiết 1 hiện vật published
GET    /public/rooms/:slug/tour           # thứ tự displayOrder cho guided tour
POST   /public/reports                    # gửi báo cáo nội dung sai (rate limit)
```

> Public cache TTL ≤ 60s; không bao giờ trả revision `draft/pending`.

**Đã triển khai thực tế** (khác bản thiết kế ở khối trên):

```
GET    /public/rooms                      # danh sách phòng active (RoomsModule, Task 6)
GET    /public/rooms/:slug                # chi tiết phòng cho tour 3D
GET    /rooms                             # danh sách phòng công khai (ExhibitsController)
GET    /rooms/:slug                       # phòng + hiện vật published + media
GET    /rooms/:slug/exhibits/:exhibitId/model   # GLB qua máy chủ, Cache-Control: private, no-store
POST   /public/reports                    # 5 lần/phút
GET    /media/uploads/:directory/:fileName      # ngoài prefix /api
```

**Task 9:** `GET /api/rooms` và `GET /api/rooms/:slug` (`ExhibitsController`) là nguồn public chuẩn cho hiện vật; `Cache-Control: no-cache` (BR-22, AC-51) thay cho TTL. File media: `GET /media/uploads/<dir>/<uuid>.<ext>` (ngoài prefix `/api`) — chỉ phục vụ file được revision public hiện hành tham chiếu hoặc URL ký (Preview CMS); còn lại 404. Chi tiết: `docs/tasks/be/cms-media-attach.md`.

```jsonc
// GET /api/rooms/:slug → data.exhibits[i] (rút gọn)
{
  "id": "uuid", "roomId": "uuid", "displayOrder": 1,
  "name": "Bình gốm", "description": "…", "transcript": "…",          // bản vi (tương thích cũ)
  "i18n": { "vi": { "name": "…", "description": "…", "transcript": "…" }, "en": { … } },
  "positionX": 0, "positionY": 0, "positionZ": 0,
  "rotation": { "x": 0, "y": 0, "z": 0 }, "scale": { "x": 1, "y": 1, "z": 1 },
  "placeholderShape": "box", "placeholderColor": "#8b7355",
  "hotspots": [{ "id": "uuid", "label": "…", "body": "…", "i18n": { "vi": { … }, "en": { … } }, "positionX": 0, "positionY": 0, "positionZ": 0, "displayOrder": 1 }],
  "model": { "id": "uuid", "url": "https://api…/media/uploads/models/<uuid>.glb", "mimeType": "model/gltf-binary", "sizeBytes": 123, "rights": { "source": "…", "author": "…", "license": "…" } },
  "image": { …MediaDto, "altText": { "vi": "…", "en": "…" } },
  "audio": { "vi": { "audio": MediaDto, "subtitle": MediaDto | null, "transcript": "…" } | null, "en": … | null } // null khi không có audio
}
```

## 6.4 DTO ví dụ (exhibit)

```ts
// input
class CreateExhibitRevisionDto {
  @IsString() @MaxLength(200) name: string;
  @IsString() description: string;
  @IsOptional() @IsString() transcript?: string;
  @IsOptional() @IsUUID() modelId?: string;
  @IsOptional() @IsUUID() imageId?: string;
  @IsOptional() @IsUUID() audioId?: string;
}
// output (KHÔNG lộ field nội bộ)
class ExhibitResponseDto {
  id: string; roomId: string; name: string; description: string;
  transcript: string | null; position: { x:number; y:number; z:number };
  media: { model?: MediaDto; image?: MediaDto; audio?: MediaDto };
  displayOrder: number;
}
```

## 6.5 Versioning

- Prefix `/api` ổn định cho MVP. Khi cần breaking change → `/api/v2`.
- Mọi thay đổi contract ghi vào changelog + cập nhật Swagger.
