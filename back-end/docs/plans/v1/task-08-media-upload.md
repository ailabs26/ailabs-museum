# Task 8 — CMS Media + Upload Pipeline

**Deadline:** 28/10/2026  
**Nhánh:** `feat/cms-media-upload`  
**Bắt đầu từ:** `origin/dev`

---

## Yêu cầu chức năng (SRS)

| Mã | Nội dung |
|:---:|:---|
| FR-55–FR-57 | Admin upload và quản lý hình ảnh, model 3D, audio guide |
| FR-90, FR-91 | Backend validate dữ liệu theo Mục 5.2; báo rõ trường lỗi |
| FR-97 | Lưu metadata quyền sử dụng: nguồn, tác giả, giấy phép |
| NFR-19 | Kiểm tra MIME thực tế + dung lượng thực tế (không chỉ tin header client) |
| BR-21 | Media đang được Published exhibit tham chiếu → không xóa, không ghi đè |

---

## Giới hạn file Upload (Mục 5.2 SRS — Engineering Target v0.1)

| Loại | MIME thực tế | Magic bytes | Giới hạn | Kiểm tra thêm |
|:---:|:---|:---|:---:|:---|
| Model 3D | `model/gltf-binary` | `0x676C5446` (`glTF`) | ≤ 10 MB | Parse được, tài nguyên nhúng đầy đủ |
| Hình ảnh JPEG | `image/jpeg` | `0xFFD8FF` | ≤ 2 MB | Decode được |
| Hình ảnh PNG | `image/png` | `0x89504E47` | ≤ 2 MB | Decode được |
| Hình ảnh WebP | `image/webp` | `RIFF....WEBP` | ≤ 2 MB | Decode được |
| Âm thanh MP3 | `audio/mpeg` | `0xFFEB` / `ID3` | ≤ 10 MB | Decode được |
| Phụ đề | `text/vtt` (WebVTT UTF-8) | Bắt đầu bằng `WEBVTT` | ≤ 1 MB | Timestamp hợp lệ, cue đúng thứ tự |

> **`MB` = 1.000.000 byte** (định nghĩa trong SRS).

---

## Quy tắc bảo mật bắt buộc

> ⚠️ **KHÔNG tin vào `Content-Type` header hoặc file extension từ client.**
> Backend phải đọc magic bytes / parse nội dung file thực tế.

1. **Kiểm tra magic bytes** trước khi parse — từ chối file không khớp.
2. **Parse/decode file** — từ chối nếu file lỗi cấu trúc dù magic bytes đúng.
3. **Từ chối SVG tuyệt đối** — SVG có thể nhúng `<script>` và trigger XSS.
4. **Từ chối HTML, JS, PHP** và mọi định dạng không trong danh sách trên.
5. **File bị từ chối** → không gắn vào nội dung, không thay thế media hợp lệ đang dùng.
6. **File nghi ngờ** (parse thất bại không rõ nguyên nhân) → trạng thái `quarantine`.
7. **API Admin không nhận `url` tùy ý** từ client để bypass upload pipeline.

---

## Danh sách API

| Method | Route | Mô tả |
|:---:|:---|:---|
| `GET` | `/admin/media` | Danh sách media (filter: `kind`) |
| `GET` | `/admin/media/:id` | Chi tiết 1 media |
| `POST` | `/admin/media/upload` | Upload file mới (`multipart/form-data`) |
| `PATCH` | `/admin/media/:id` | Cập nhật metadata (nguồn, tác giả, giấy phép) |
| `DELETE` | `/admin/media/:id` | Xóa media (từ chối nếu Published exhibit đang dùng) |

---

## Cấu trúc file cần tạo

```
back-end/src/
└── media/
    ├── media.entity.ts             (đã có — bổ sung: source, author, license, status)
    ├── media.module.ts             (tạo mới)
    ├── media.controller.ts         (tạo mới — Admin routes)
    ├── media.service.ts            (tạo mới — upload logic, validation)
    ├── repositories/
    │   └── media.repository.ts     (tạo mới)
    └── dto/
        ├── upload-media.dto.ts     (tạo mới)
        └── update-media.dto.ts     (tạo mới)
```

---

## Luồng xử lý Upload

```
[1] Nhận file (multipart/form-data)
        ↓
[2] Kiểm tra kích thước thực tế (bytes) → 413 nếu vượt giới hạn
        ↓
[3] Đọc magic bytes → xác định loại file thực tế
        ↓
[4] Parse / decode file → 422 nếu file lỗi cấu trúc
        ↓
[5] Kiểm tra metadata quyền sử dụng (source, author, license)
        ↓
[6] Lưu file vào Storage (Supabase Storage hoặc local public/)
        ↓
[7] Tạo bản ghi Media trong DB
        ↓
[8] Trả về { id, kind, url, mimeType, ... }
```

---

## Cột bổ sung trên `Media` entity

```typescript
// Cần thêm vào media.entity.ts (phối hợp với Thắng để tạo migration)
@Column({ type: 'varchar', length: 500, nullable: true }) source!: string | null;
@Column({ type: 'varchar', length: 200, nullable: true }) author!: string | null;
@Column({ type: 'text', nullable: true }) license!: string | null;
@Column({ type: 'varchar', length: 20, default: 'active' }) status!: string; // 'active' | 'quarantine'
```

---

## Điều kiện nghiệm thu

- [ ] Upload `.glb` hợp lệ ≤ 10 MB → `201` và trả về `mediaId`.
- [ ] Upload `.png` hợp lệ ≤ 2 MB → `201`.
- [ ] Upload `.mp3` hợp lệ ≤ 10 MB → `201`.
- [ ] Upload file `.exe` đổi tên thành `.glb` → `422`.
- [ ] Upload file SVG → `422` (kể cả khi khai báo `image/png`).
- [ ] Upload `.glb` > 10 MB → `413`.
- [ ] Upload `.png` > 2 MB → `413`.
- [ ] Upload `.glb` corrupt (magic bytes đúng, nội dung lỗi) → `422`.
- [ ] `DELETE /admin/media/:id` khi media đang dùng bởi Published exhibit → `409`.
- [ ] `DELETE /admin/media/:id` khi media không được dùng → `200`.

---

## Quality Gates trước khi tạo PR

```bash
cd back-end
npm run typecheck
npm run lint
npm run build
```

