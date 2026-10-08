# Task 7 — Quản lý Hiện vật + Revision + Draft/Publish

**Deadline:** 21/10/2026  
**Nhánh:** `feat/cms-exhibits-management`  
**Bắt đầu từ:** `origin/dev`

---

## Yêu cầu chức năng (SRS)

| Mã | Nội dung |
|:---:|:---|
| FR-49 | Admin xem danh sách hiện vật (filter theo phòng, trạng thái) |
| FR-50 | Admin tạo hiện vật mới |
| FR-51 | Admin chỉnh sửa hiện vật Draft; CMS hướng dẫn Unpublish trước khi sửa Published |
| FR-52 | Admin xóa hiện vật Draft sau bước xác nhận |
| FR-53, FR-54 | Admin nhập/chỉnh nội dung tiếng Việt và tiếng Anh |
| FR-55–FR-57 | Admin quản lý hình ảnh, model 3D, audio guide |
| FR-58–FR-60 | Admin cấu hình Position, Rotation, Scale |
| FR-67 | Admin lưu hiện vật ở trạng thái Draft |
| FR-68 | Hiện vật Draft không bao giờ xuất hiện trên API public |
| FR-69–FR-71 | Admin xem Preview Draft (yêu cầu xác thực) |
| FR-72–FR-75 | Publish / Unpublish |
| BR-20 | Xóa chỉ khi Draft; xóa kéo theo hotspot; không tự xóa media chung |
| BR-21 | Không sửa trực tiếp Published; phải Unpublish trước |

---

## Vòng đời trạng thái (Publication Workflow — Mục 5.1 SRS)

```
Create → [Draft] ──Publish──→ [Published]
              ↑                     |
              └──── Unpublish ──────┘

Draft:     Edit / Save / Preview / Delete
Published: View / Unpublish   (không sửa trực tiếp)
```

**Quy tắc quan trọng:**
- `Save Draft` → backend **cho phép thiếu** trường bắt buộc của Publish, nhưng trường đã nhập **phải đúng kiểu và giới hạn**.
- `Publish` → backend kiểm tra **toàn bộ** exhibit + hotspot + media liên quan (không chỉ form).
- `Preview` → chỉ Admin xem, yêu cầu JWT, không thay đổi trạng thái (FR-68, FR-69).

---

## Danh sách API

| Method | Route | Mô tả |
|:---:|:---|:---|
| `GET` | `/admin/exhibits` | Danh sách (filter: `roomId`, `status`) |
| `GET` | `/admin/exhibits/:id` | Chi tiết 1 hiện vật |
| `POST` | `/admin/exhibits` | Tạo hiện vật mới → trạng thái Draft |
| `PATCH` | `/admin/exhibits/:id` | Cập nhật Draft (từ chối nếu Published) |
| `POST` | `/admin/exhibits/:id/publish` | Publish Draft (validate đầy đủ theo 5.2) |
| `POST` | `/admin/exhibits/:id/unpublish` | Unpublish → Draft |
| `DELETE` | `/admin/exhibits/:id` | Xóa Draft (kèm confirm step + xóa hotspot liên quan) |
| `GET` | `/admin/exhibits/:id/revisions` | Lịch sử phiên bản |
| `GET` | `/admin/exhibits/:id/preview` | Preview Draft — yêu cầu Auth |

---

## Cấu trúc file

```
back-end/src/
└── exhibits/
    ├── exhibit.entity.ts             (đã có — bổ sung cột status, revision nếu cần)
    ├── exhibits.module.ts            (đã có — cập nhật)
    ├── exhibits.controller.ts        (đã có — thêm Admin routes)
    ├── exhibits.service.ts           (đã có — thêm Admin business logic)
    ├── repositories/
    │   └── exhibits.repository.ts    (đã có — thêm Admin queries)
    └── dto/
        ├── exhibit-content.dto.ts    (đã có — mở rộng)
        ├── create-exhibit.dto.ts     (tạo mới)
        └── update-exhibit.dto.ts     (tạo mới)
```

---

## Cơ chế Revision — Cần thống nhất với Thắng trước khi code

> **Liên hệ Nguyễn Văn Thắng** để chốt phương án trước khi tạo migration.

| | Option A — Bảng riêng | Option B — Column trên exhibits |
|:---|:---|:---|
| **Cách lưu** | Bảng `exhibit_revisions` lưu snapshot JSON mỗi lần Save | Column `version_number` + `parent_id` trên bảng `exhibits` |
| **Ưu điểm** | Tách biệt rõ, dễ query | Đơn giản hơn |
| **Nhược điểm** | Thêm bảng, cần migration | Bảng lớn theo thời gian |

**Quy tắc transaction:** Chuyển trạng thái (`Draft → Pending → Published`) **phải trong 1 DB transaction** — tránh trạng thái không nhất quán.

---

## Validation khi Publish (bắt buộc — Mục 5.2 SRS)

| Trường | Yêu cầu |
|:---|:---|
| `name.vi` | 1 – 200 ký tự, không rỗng sau trim |
| `name.en` | 1 – 200 ký tự, không rỗng sau trim |
| `description.vi` | 1 – 10.000 ký tự, không rỗng |
| `description.en` | 1 – 10.000 ký tự, không rỗng |
| `positionX/Y/Z` | Số hữu hạn (finite), đơn vị mét, Y hướng lên |
| `rotationX/Y/Z` | Số hữu hạn, radian, thứ tự Euler XYZ |
| `scaleX/Y/Z` | Số hữu hạn và **> 0** |
| Nếu có `audioId` | Phải có `transcript` không rỗng + file phụ đề WebVTT cùng ngôn ngữ |
| Nếu có `imageId` | Phải có `altText.vi` và `altText.en` |
| Media metadata | Mọi media đính kèm phải có nguồn, tác giả, giấy phép (FR-97) |
| Hotspot | Tiêu đề 1–200 ký tự, nội dung 1–5.000 ký tự cho cả `vi` và `en` |

---

## Điều kiện nghiệm thu

- [ ] `PATCH /admin/exhibits/:id` → `409` khi exhibit đang `Published`.
- [ ] `POST /admin/exhibits/:id/publish` → `422` khi thiếu `name.en`.
- [ ] `POST /admin/exhibits/:id/publish` → `422` khi thiếu `description.vi`.
- [ ] `POST /admin/exhibits/:id/publish` → `200` khi đủ dữ liệu bilingual hợp lệ.
- [ ] `GET /rooms/:slug` → không trả về exhibit có `status = 'draft'`.
- [ ] `GET /admin/exhibits/:id/preview` → `401` khi không có JWT.
- [ ] `DELETE` Draft → xóa đồng thời hotspot liên quan trong cùng 1 transaction.
- [ ] `GET /admin/exhibits/:id/revisions` → trả ≥ 1 bản sau mỗi lần Save Draft.

---

## Quality Gates trước khi tạo PR

```bash
cd back-end
npm run typecheck
npm run lint
npm run build
```

