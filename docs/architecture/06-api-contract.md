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
POST   /users/:id/roles       DELETE /users/:id/roles/:roleId
GET    /roles                 POST /roles           PATCH /roles/:id     DELETE /roles/:id
GET    /roles/:id/permissions PUT  /roles/:id/permissions        # set ma trận quyền
GET    /permissions                                              # danh mục permission
GET    /audit                 GET  /audit/:id                    # nhật ký (lọc theo actor/action/thời gian)
```

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
POST   /exhibits/:id/attach-media         # gắn model/image/audio
```

### Kiểm duyệt & báo cáo
```
GET    /moderation/queue                  # revision chờ duyệt
GET    /moderation/revisions/:id/diff     # so sánh phiên bản cũ/mới
GET/POST /reports                         # Admin xem; Client gửi (public, rate-limited)
POST   /reports/:id/resolve  | /dismiss
```

### Public (client — chỉ đọc nội dung published)
```
GET    /public/rooms/:slug                # phòng + danh sách hiện vật published
GET    /public/exhibits/:id               # chi tiết 1 hiện vật published
GET    /public/rooms/:slug/tour           # thứ tự displayOrder cho guided tour
POST   /public/reports                    # gửi báo cáo nội dung sai (rate limit)
```

> Public cache TTL ≤ 60s; không bao giờ trả revision `draft/pending`.

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
