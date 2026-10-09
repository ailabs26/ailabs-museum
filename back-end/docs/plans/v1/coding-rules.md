# Quy tắc Coding & Bảo mật — Xuyên suốt V1

> Áp dụng cho **toàn bộ** Task 6–10, 28–29.  
> Nguồn: `back-end/docs/coding-conventions.md`, `AGENTS.md`, `docs/requirements.md` NFR-14 → NFR-21.

---

## 1. Đặt tên file (kebab-case + hậu tố rõ ràng)

| Loại | Pattern | Ví dụ |
|:---|:---|:---|
| Module | `<feature>.module.ts` | `media.module.ts` |
| Controller | `<feature>.controller.ts` | `media.controller.ts` |
| Service | `<feature>.service.ts` | `media.service.ts` |
| Entity | `<entity>.entity.ts` | `exhibit.entity.ts` |
| Repository | `<feature>.repository.ts` | `media.repository.ts` |
| DTO | `<action>-<entity>.dto.ts` | `upload-media.dto.ts` |
| Guard | `<purpose>.guard.ts` | `admin-auth.guard.ts` |
| Spec/Test | `<source>.spec.ts` | `exhibits.service.spec.ts` |

**Không dùng:** `helper.ts`, `utils.ts`, `data.ts`, `test.ts` nếu không thể hiện rõ mục đích.

---

## 2. Đặt tên trong code

| Loại | Convention | Ví dụ |
|:---|:---|:---|
| Class | PascalCase + hậu tố vai trò | `MediaService`, `UploadMediaDto` |
| Entity | PascalCase, danh từ số ít | `Media`, `Exhibit`, `Room` |
| Enum | PascalCase tên, value lowercase | `MediaKind`, `MediaKind.MODEL = 'model'` |
| Biến / hàm | camelCase, bắt đầu động từ | `findByRoom`, `uploadFile`, `buildPublicUrl` |
| Collection | camelCase số nhiều | `exhibits`, `rooms`, `mediaFiles` |
| Boolean | prefix `is/has/can/should` | `isPublished`, `hasAudio`, `canDelete` |
| ID field | hậu tố `Id` | `roomId`, `modelId`, `audioId` |
| Hằng module | UPPER_SNAKE_CASE | `MAX_UPLOAD_SIZE = 10_000_000` |
| Biến môi trường | UPPER_SNAKE_CASE | `DATABASE_URL`, `JWT_SECRET` |
| Tên bảng DB | lowercase, plural | `rooms`, `exhibits`, `media` |
| Khóa ngoại DB | hậu tố `Id` | `roomId`, `modelId` |

**Không viết hoa** biến `const` thông thường — chỉ UPPER_SNAKE_CASE cho hằng cấp module.  
**Không dùng prefix** `I` hoặc `T` cho interface và type.

---

## 3. Import / Export

- Ưu tiên **named export**.
- Dùng `import type` khi chỉ import type/interface.
- **Không tạo** barrel `index.ts` chỉ để rút ngắn đường dẫn import.
- Tên export khớp vai trò thể hiện trong tên file.

---

## 4. Database — Quy tắc nghiêm ngặt

| Quy tắc | Lý do |
|:---|:---|
| `synchronize: false` — **luôn tắt, không bao giờ bật** | Tránh mất dữ liệu trong runtime |
| Thay đổi schema → dùng migration | Truy vết thay đổi qua Git |
| **Không tự chạy** `migration:generate/run/revert` | Người phụ trách DB: **Nguyễn Văn Thắng** |
| Kiểm tra file migration trước khi chạy | Đặc biệt lệnh `DROP`, enum, constraint |
| Không sửa/xóa migration đã chạy trên DB chung | Tạo migration mới cho thay đổi tiếp theo |

---

## 5. Quy tắc bảo mật bắt buộc (NFR-14 → NFR-21)

| Mã NFR | Quy tắc |
|:---:|:---|
| NFR-14 | Toàn bộ traffic production qua **HTTPS** |
| NFR-15 | Mật khẩu Admin lưu bằng **bcrypt** hoặc Argon2; không bao giờ lưu plaintext |
| NFR-16 | Mọi `/admin/*` endpoint phải bảo vệ bằng JWT; phiên hết hạn bị từ chối |
| NFR-17 | Session JWT có thời hạn; logout làm token hết hiệu lực ngay |
| NFR-18 | Validate **toàn bộ input** tại backend trước khi xử lý hoặc lưu |
| NFR-19 | Upload: kiểm tra MIME thực tế bằng magic bytes + parse nội dung — không chỉ tin header |
| NFR-20 | Các route Admin từ chối request không xác thực (`401`) hoặc phiên hết hạn |
| NFR-21 | Response **không lộ** thông tin nhạy cảm: stack trace, JWT secret, DATABASE_URL, internal path |

---

## 6. Xử lý lỗi — Quy tắc phản hồi (FR-91, FR-93)

| Tình huống | Hành vi bắt buộc |
|:---|:---|
| Validation thất bại | `400/422` + chỉ rõ **từng trường** lỗi cụ thể |
| Truy cập không xác thực | `401` |
| Không có quyền | `403` |
| Resource không tồn tại | `404` |
| Conflict (slug trùng, xóa Published...) | `409` |
| File quá dung lượng | `413` |
| Operation thất bại | Giữ dữ liệu form, hiển thị lỗi rõ, **không báo thành công giả** |
| Response lỗi | **Không lộ** stack trace, DB error message, internal path trong production |

---

## 7. Quality Gates — Chạy trước mỗi PR

```bash
cd back-end
npm run typecheck   # Không có lỗi TypeScript
npm run lint        # Không có lỗi ESLint
npm run build       # Build thành công
```

Tất cả **phải pass** trước khi tạo Pull Request. Không merge khi bất kỳ bước nào fail.

---

## 8. Quy trình PR bắt buộc (AGENTS.md)

```
1. git fetch origin
2. git checkout -b feat/<short-name> origin/dev
3. [Code + test]
4. npm run typecheck && npm run lint && npm run build
5. git add / git commit (commit message ngắn gọn, mô tả thay đổi)
6. git push origin feat/<short-name>
7. Mở Pull Request vào dev (base: dev — KHÔNG phải main)
8. Review diff đầy đủ trước khi submit PR
9. Chờ review từ thành viên nhóm trước khi merge
```

**Tuyệt đối không:**
- Push commit trực tiếp vào `dev` hoặc `main`.
- Merge PR của chính mình khi chưa có review.
- Merge khi có lỗi TypeScript / ESLint / build.
- Merge khi acceptance conditions chưa pass.

**Dừng tại PR và chờ human review** với các thay đổi liên quan đến:
- Database migration
- Authentication / Authorization
- Bảo mật, upload validation
- Xóa dữ liệu có thể phá hủy

