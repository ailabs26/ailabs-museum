# Task 9 — Gắn Media vào Hiện vật + API Public Content

**Deadline:** 04/11/2026  
**Nhánh:** `feat/cms-media-attach-public-api`  
**Bắt đầu từ:** `origin/dev`

---

## Yêu cầu chức năng (SRS)

| Mã | Nội dung |
|:---:|:---|
| FR-55–FR-57 | Gắn / tháo media (GLB, ảnh, audio) vào/khỏi hiện vật Draft |
| FR-68 | Draft tuyệt đối không xuất hiện trên API public |
| FR-73 | Sau Publish, hiện vật xuất hiện ngay trong request public mới — không cần build lại |
| FR-75 | Sau Unpublish, hiện vật biến mất khỏi request public mới (BR-22) |
| NFR-20 | `/rooms` và `/rooms/:slug` chỉ trả `Published` content |
| BR-22 | Publish/Unpublish có hiệu lực với request bắt đầu **sau** khi thao tác thành công |

---

## Danh sách API

| Method | Route | Mô tả |
|:---:|:---|:---|
| `PATCH` | `/admin/exhibits/:id/media` | Gắn / tháo `modelId`, `imageId`, `audioId` vào Draft |
| `GET` | `/rooms` | *(Đã có)* Chỉ trả phòng có ≥ 1 Published exhibit |
| `GET` | `/rooms/:slug` | *(Đã có)* Trả phòng + exhibit `Published`, sắp theo `displayOrder` |

---

## Quy tắc gắn Media

| Điều kiện | Hành vi |
|:---|:---|
| Hiện vật đang `Published` | Từ chối — `409` |
| `modelId` trỏ vào Media `kind ≠ 'model'` | Từ chối — `422` |
| `imageId` trỏ vào Media `kind ≠ 'image'` | Từ chối — `422` |
| `audioId` trỏ vào Media `kind ≠ 'audio'` | Từ chối — `422` |
| Gắn `audioId` vào Draft | Cho phép — nhưng chặn Publish nếu thiếu `transcript` và phụ đề |
| Thay thế media trên Draft | Tạo tham chiếu mới — không xóa/ghi đè bản cũ đang Published dùng |
| Media ID không tồn tại | Từ chối — `404` |

---

## Quy tắc Public API

- `GET /rooms/:slug` **không bao giờ** trả exhibit có `status = 'draft'`.
- Sau `Publish` thành công → exhibit xuất hiện trong **request mới ngay lập tức**.
- Sau `Unpublish` thành công → exhibit biến mất khỏi **request mới ngay lập tức**.
- Nếu có cache layer: TTL ≤ 60 giây — không để nội dung cũ tồn tại quá 60 giây sau thao tác.
- Phiên Visitor đã tải snapshot không bắt buộc cập nhật realtime (BR-22).

---

## Request body mẫu cho PATCH /admin/exhibits/:id/media

```json
{
  "modelId": "uuid-of-glb-media-or-null",
  "imageId": "uuid-of-image-media-or-null",
  "audioId": "uuid-of-audio-media-or-null"
}
```

Chỉ gửi trường cần thay đổi. Truyền `null` để tháo media ra khỏi hiện vật.

---

## Điều kiện nghiệm thu

- [ ] `GET /rooms/:slug` → không có exhibit `status = 'draft'` trong response.
- [ ] Sau `POST /admin/exhibits/:id/publish` → exhibit xuất hiện trong `GET /rooms/:slug` ngay lập tức.
- [ ] Sau `POST /admin/exhibits/:id/unpublish` → exhibit biến mất khỏi `GET /rooms/:slug` ngay lập tức.
- [ ] `PATCH /admin/exhibits/:id/media` với `modelId` trỏ media `kind='image'` → `422`.
- [ ] `PATCH /admin/exhibits/:id/media` khi exhibit đang `Published` → `409`.
- [ ] `PATCH /admin/exhibits/:id/media` với ID không tồn tại → `404`.
- [ ] Truyền `null` cho `audioId` → tháo audio thành công.

---

## Quality Gates trước khi tạo PR

```bash
cd back-end
npm run typecheck
npm run lint
npm run build
```

