# Task 6 — CRUD API + UI Phòng trưng bày

**Deadline:** 14/10/2026  
**Nhánh:** `feat/cms-rooms-crud`  
**Bắt đầu từ:** `origin/dev`

---

## Yêu cầu chức năng (SRS)

| Mã | Nội dung |
|:---:|:---|
| FR-48 | Bảo vệ mọi CMS endpoint — người chưa đăng nhập bị từ chối `401` |
| FR-50 | Admin tạo phòng mới |
| FR-51 | Admin chỉnh sửa thông tin phòng |
| FR-52 | Admin xóa phòng (có bước xác nhận) |
| BR-19 | Admin cập nhật qua CMS, không cần sửa/build lại frontend |
| BR-20 | Xóa phòng phải có confirm; chỉ xóa khi không còn exhibit `Published` bên trong |

---

## Danh sách API

| Method | Route | Mô tả |
|:---:|:---|:---|
| `GET` | `/admin/rooms` | Danh sách tất cả phòng (kèm số lượng exhibit) |
| `POST` | `/admin/rooms` | Tạo phòng mới |
| `PATCH` | `/admin/rooms/:id` | Cập nhật thông tin phòng |
| `DELETE` | `/admin/rooms/:id` | Xóa phòng (kiểm tra không còn exhibit Published) |

Tất cả `/admin/*` phải yêu cầu JWT hợp lệ — dùng `AuthGuard` từ **Nguyễn Văn Thắng** cung cấp.

---

## Cấu trúc file cần tạo

```
back-end/src/
└── rooms/
    ├── room.entity.ts           (đã có — không sửa nếu chưa cần)
    ├── rooms.module.ts          (tạo mới hoặc tích hợp vào AppModule)
    ├── rooms.controller.ts      (thêm Admin routes có AuthGuard)
    ├── rooms.service.ts         (business logic CRUD)
    ├── repositories/
    │   └── rooms.repository.ts  (truy vấn DB chuyên biệt)
    └── dto/
        ├── create-room.dto.ts
        └── update-room.dto.ts
```

> Đặt tên theo `back-end/docs/coding-conventions.md`. Xem tổng hợp tại [coding-rules.md](./coding-rules.md).

---

## Quy tắc Validation DTO

```typescript
// create-room.dto.ts
export class CreateRoomDto {
  @IsString() @IsNotEmpty() @MaxLength(120) @Transform(trim) slug: string;
  @IsString() @IsNotEmpty() @MaxLength(200) @Transform(trim) name: string;
  @IsString() @IsNotEmpty() description: string;
}

// update-room.dto.ts — dùng PartialType(CreateRoomDto)
```

**Ràng buộc `slug`:**
- Phải unique trong bảng `rooms`.
- Chỉ chứa ký tự `a-z`, `0-9`, `-`; không có khoảng trắng hay ký tự đặc biệt.
- Ví dụ hợp lệ: `phong-kham-pha`, `room-01`.

**Ràng buộc chung:**
- `name` và `description` không được là chuỗi rỗng sau khi trim.
- Trả về lỗi cụ thể theo trường khi validation thất bại (FR-91).

---

## Điều kiện nghiệm thu

- [ ] `POST /admin/rooms` → `201` với body hợp lệ.
- [ ] `POST /admin/rooms` → `400` và chỉ rõ trường lỗi khi `slug` hoặc `name` rỗng.
- [ ] `POST /admin/rooms` → `409` khi `slug` đã tồn tại.
- [ ] `GET /admin/rooms` → `401` khi không có JWT.
- [ ] `GET /admin/rooms` → `401` khi JWT hết hạn.
- [ ] `DELETE /admin/rooms/:id` → `409` nếu phòng còn exhibit `Published`.
- [ ] `DELETE /admin/rooms/:id` → `200` nếu phòng chỉ có Draft hoặc trống.
- [ ] Không có route `/admin/*` nào trả `200` khi không xác thực.

---

## Quality Gates trước khi tạo PR

```bash
cd back-end
npm run typecheck
npm run lint
npm run build
```

Tất cả phải pass — không có lỗi TypeScript, ESLint hoặc build fail.

