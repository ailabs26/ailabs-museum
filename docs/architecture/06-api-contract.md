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
| 409 | xung đột (sửa đồng thời, slug trùng) — FE hiện cảnh báo reload; xóa bị chặn (kể cả xóa hàng loạt) |
| 422 | validation thất bại (chi tiết trong `errors`) |
| 429 | vượt rate limit |

**Phân trang:** `?page=1&pageSize=20&sort=createdAt:desc&q=keyword`.
**Optimistic concurrency:** sửa revision gửi kèm `version`; lệch → 409.

## 6.3 Danh mục endpoint (MVP)

### Auth & quản trị hệ thống (phân hệ dựng trước)
```
POST   /auth/login            POST /auth/refresh    POST /auth/logout    GET /auth/me
POST   /auth/change-password                                     # tự đổi mật khẩu
GET    /auth/sessions         DELETE /auth/sessions/:id          # thiết bị đang đăng nhập của chính mình
POST   /auth/sessions/revoke-others   POST /auth/logout-all
GET    /users                 POST /users           GET /users/:id       PATCH /users/:id     DELETE /users/:id
POST   /users/bulk-delete                                        # xóa mềm nhiều tài khoản
POST   /users/:id/roles       DELETE /users/:id/roles/:roleId
GET    /roles                 POST /roles           PATCH /roles/:id     DELETE /roles/:id
POST   /roles/bulk-delete                                        # xóa mềm nhiều vai trò
GET    /roles/:id/permissions PUT  /roles/:id/permissions        # set ma trận quyền
GET    /permissions                                              # danh mục permission
GET    /audit                 GET  /audit/:id                    # nhật ký (lọc theo actor/action/thời gian)
GET    /admin/stats/overview                                     # số liệu tổng quan Dashboard
GET    /admin/stats/charts                                       # dữ liệu biểu đồ Dashboard
```

#### Xác thực, phiên đăng nhập và đổi mật khẩu

Mọi route dưới đây (trừ login/refresh/logout là `@Public`) chỉ thao tác trên **chính tài khoản đang đăng nhập**, không cần permission.
Cơ chế phiên, thu hồi và rate limit: [05 — Bảo mật](05-security-rbac.md#511-thu-hồi-phiên-có-hiệu-lực-ngay--activesessionguard).

| Route | Body / kết quả | Ghi chú | Audit |
|---|---|---|---|
| `POST /auth/login` | `{ email, password }` → `{ accessToken, user }` + cookie refresh | 401 sai/khóa; 429 khi vượt ngưỡng | — |
| `POST /auth/refresh` | cookie → `{ accessToken }` + cookie mới | xoay vòng; 401 thì xóa cookie; chặn Origin lạ (403) | — |
| `POST /auth/logout` | cookie → `null` | thu hồi family hiện tại, xóa cookie; gọi lại vẫn 200 | — |
| `POST /auth/change-password` | `{ currentPassword, newPassword }` → `{ id }` | mới 8–128 ký tự, khác cũ; sai mật khẩu hiện tại → **400** gắn field `currentPassword` (không dùng 401 để FE không đăng xuất); 409 nếu Admin vừa đặt lại; đăng xuất mọi thiết bị khác | `auth.password_change` |
| `GET /auth/sessions` | → `[{ id, userAgent, ip, signedInAt, lastActiveAt, expiresAt, current }]` | `id` = family; mỗi dòng một thiết bị còn đăng nhập | — |
| `DELETE /auth/sessions/:id` | → `null` | 404 nếu không phải phiên của mình; là phiên hiện tại thì xóa cookie | `auth.session_revoke` |
| `POST /auth/sessions/revoke-others` | → `{ id }` (userId) | giữ phiên hiện tại | `auth.session_revoke_others` |
| `POST /auth/logout-all` | → `{ id }` (userId) | thu hồi tất cả, xóa cookie | `auth.logout_all` |

#### Xóa mềm và xóa hàng loạt

Mọi tài nguyên quản trị **xóa mềm** (`is_deleted`/`deleted_at`; truy vấn luôn lọc bản ghi chưa xóa). Chưa có API khôi phục.

| Tài nguyên | Xóa lẻ | Xóa hàng loạt | Permission | Bị chặn khi |
|---|---|---|---|---|
| Tài khoản | `DELETE /users/:id` | `POST /users/bulk-delete` | `user:delete` | có vai trò Admin; xóa xong đăng xuất mọi thiết bị |
| Vai trò | `DELETE /roles/:id` | `POST /roles/bulk-delete` | `role:delete` | là `admin`; đang gán cho tài khoản chưa xóa |
| Phòng | `DELETE /admin/rooms/:id` | `POST /admin/rooms/bulk-delete` | `room:delete` | còn hiện vật chưa xóa (BR-20) |
| Media | `DELETE /admin/media/:id` | `POST /admin/media/bulk-delete` | `media:upload` | hiện vật đã xuất bản/bản chờ duyệt đang dùng (BR-21); **file trên storage được giữ** |
| Hiện vật | `DELETE /admin/exhibits/:id` | `POST /admin/exhibits/bulk-delete` | `exhibit:update` | đã xuất bản/đang hiển thị/đã duyệt, đang chờ duyệt, có báo cáo (BR-20); revisions/hotspots được giữ |

- Body hàng loạt `{ "ids": [uuid, …] }` (1–100, không trùng). Thành công → `{ ids }`.
- **Tất cả hoặc không**: có mục bị chặn hoặc không tồn tại → **409**, không mục nào bị xóa:
  ```json
  { "success": false, "message": "Không xóa được 2 mục đã chọn. Không mục nào bị xóa.",
    "errors": [ { "code": "delete_blocked", "field": "<id>", "message": "<lý do>" } ] }
  ```
- Xóa lẻ giữ 404 (không tồn tại) / 409 (bị chặn) như cũ. Kiểm tra chạy trong transaction có khóa dòng.

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

### CMS nội dung
```
GET/POST/PATCH/DELETE   /rooms
GET/POST/PATCH/DELETE   /exhibits
GET    /exhibits/:id/revisions            POST /exhibits/:id/revisions         # tạo draft
POST   /revisions/:id/submit              # draft -> pending
POST   /revisions/:id/publish             # pending -> published (moderator)
POST   /revisions/:id/reject              # kèm lý do
POST   /exhibits/:id/hide  |  /unhide
POST   /media   (multipart)               GET /media/:id       DELETE /media/:id
POST   /exhibits/:id/attach-media         # (thực tế Task 9: gắn qua PATCH /admin/exhibits/:id — modelId, imageId, audioViId, audioEnId, subtitleViId, subtitleEnId)
```

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

#### Reports (Task 23)

- `GET /reports?page&pageSize&status` (`report:read`) → danh sách; `GET /reports/:id` (`report:read`) → chi tiết kèm phiên bản bị báo cáo.
- `POST /reports/:id/assign` (`report:resolve`): open → in_progress, gán người tiếp nhận.
- `POST /reports/:id/resolve` body `{ resolution }` (`report:resolve`): → resolved.
- `POST /reports/:id/dismiss` body `{ resolution }` (`report:resolve`): → dismissed.
- `POST /public/reports` **@Public** body `{ exhibitId, reportedRevisionId?, category, message }`, rate-limit 5 lần/phút.
- Chuyển trạng thái chỉ hợp lệ khi báo cáo còn mở (open/in_progress) → sai → **409**. Ghi vết `@Audit` report.assign/resolve/dismiss.

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
| user.delete, role.delete, media.delete, exhibit.delete | user / role / media / exhibit | — | xóa lẻ và `bulk-delete` |
| auth.password_change, auth.session_revoke_others, auth.logout_all | user | — | AuthController |
| auth.session_revoke | session | — | AuthController (`resourceId` = family) |

> Với `resourceType='revision'`, interceptor lưu thêm FK `revisionId` để join `audit_logs → exhibit_revisions`.
> Response có mảng `ids` (xóa hàng loạt) hoặc `roleIds` → interceptor ghi **1 bản ghi cho mỗi ID**.

### Public (client — chỉ đọc nội dung published)
```
GET    /public/rooms/:slug                # phòng + danh sách hiện vật published
GET    /public/exhibits/:id               # chi tiết 1 hiện vật published
GET    /public/rooms/:slug/tour           # thứ tự displayOrder cho guided tour
POST   /public/reports                    # gửi báo cáo nội dung sai (rate limit)
```

> Public cache TTL ≤ 60s; không bao giờ trả revision `draft/pending`.

**Đã triển khai (Task 9):** `GET /api/rooms` và `GET /api/rooms/:slug` (`ExhibitsController`) là nguồn public chuẩn cho hiện vật; `Cache-Control: no-cache` (BR-22, AC-51) thay cho TTL. File media: `GET /media/uploads/<dir>/<uuid>.<ext>` (ngoài prefix `/api`) — chỉ phục vụ file được revision public hiện hành tham chiếu hoặc URL ký (Preview CMS); còn lại 404. Chi tiết: `docs/tasks/be/cms-media-attach.md`.

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
