# Task 7: Quản lý hiện vật + quy trình revision trên CMS

Nhánh: `feat/cms-exhibits-controller` (từ `dev`). PR [#44](https://github.com/ailabs26/ailabs-museum/pull/44), merge 13/10/2026. SRS: §5.1–5.2, FR-69, BR-20, BR-21, BR-26.

**Trạng thái:** Đã merge vào `dev`. Task 9 mở rộng tiếp (slot media, cổng publish, sửa lỗi lộ dữ liệu); xem [cms-media-attach.md](cms-media-attach.md).

## Đã làm

### API Admin `/api/admin/exhibits` (RBAC + audit)

| Method | Route | Quyền | Audit |
|---|---|---|---|
| `GET` | `/` — tìm kiếm, lọc, phân trang | `exhibit:read` | — |
| `GET` | `/:id` — chi tiết kèm phòng, revision hiện tại, hotspots | `exhibit:read` | — |
| `GET` | `/:id/preview` — xem trước bản nháp kèm transform 3D + hotspots (FR-69) | `exhibit:read` | — |
| `GET` | `/:id/revisions`, `/:id/revisions/:revId` — lịch sử phiên bản | `exhibit:read` | — |
| `POST` | `/` — tạo hiện vật Draft + revision #1 | `exhibit:create` | `exhibit.create` |
| `PATCH` | `/:id` — sửa bản nháp | `exhibit:update` | `exhibit.update` |
| `POST` | `/:id/submit-review` — DRAFT/REJECTED → IN_REVIEW | `revision:submit` | `revision.submit` |
| `DELETE` | `/:id` — xóa hiện vật chỉ có bản nháp | `exhibit:update` | `exhibit.delete` |
| `DELETE` | `/:id/revisions/:revId` — xóa một revision nháp | `exhibit:update` | `revision.delete` |
| `PUT` | `/rooms/:roomId/reorder` — sắp xếp thứ tự hiện vật trong phòng | `exhibit:update` | `exhibit.reorder` |

### DTO (`dto/`)

- **Song ngữ** `BilingualNameDto` / `BilingualDescriptionDto` (`{ vi, en }`) cho tên, mô tả, transcript, nhãn/nội dung hotspot.
- **Transform 3D:** `Vector3Dto` cho `position` / `rotation` (radian) / `scale` (mỗi trục > 0); vẫn nhận dạng phẳng `positionX..` để tương thích.
- **Hotspot** (`hotspot.dto.ts`): `id` UUID v4 tùy chọn (cập nhật hotspot có sẵn), nhãn + nội dung song ngữ, vị trí 3D.
- `CreateExhibitDto`, `UpdateExhibitDto`, `ListExhibitsQueryDto`, `ReorderExhibitsDto` (mảng UUID không rỗng), DTO response tách entity.
- `validateForPublish()` (`publish-validation.dto.ts`) — luật §5.2: tên vi/en 1–200 ký tự, mô tả vi/en 1–10.000, transform là số hữu hạn và scale > 0, audio phải có transcript, ảnh phải có alt text vi/en, hotspot tiêu đề 1–200 / nội dung 1–5.000.

### Luật nghiệp vụ (`services/exhibits.service.ts`)

- **Tạo:** hiện vật + revision #1 ở trạng thái DRAFT trong **một transaction**; phòng không tồn tại → 404.
- **Sửa bản nháp:**
  - revision đang **IN_REVIEW** → 409, không sửa trực tiếp (BR-26);
  - revision đang **APPROVED** (published) → **fork** revision mới, bản đã xuất bản không bị đụng (BR-21);
  - revision **DRAFT/REJECTED** → sửa tại chỗ, REJECTED quay về DRAFT.
- **Gửi duyệt:** chỉ từ DRAFT/REJECTED; không có bản nháp → 409.
- **Xóa (BR-20):** hiện vật đã xuất bản → 409. Hiện vật chỉ có bản nháp → xóa cascade hotspots → revisions → exhibit trong transaction. Xóa riêng một revision: chặn revision đang published, approved hoặc in_review.
- **Reorder:** cập nhật `displayOrder` theo thứ tự mảng trong một transaction.

### Repository + Front-end

- `ExhibitsRepository`: truy vấn admin (tìm kiếm/lọc/phân trang), lấy revision/hotspots, xóa cascade, cập nhật `displayOrder`.
- `pages/admin/ExhibitsPage.tsx` + `services/exhibits.service.ts`: bảng hiện vật, form tạo/sửa song ngữ (tên, mô tả), chọn phòng, vị trí/xoay/scale X-Y-Z, hình khối + màu placeholder khi chưa có model 3D, thứ tự hiển thị; xem chi tiết + lịch sử phiên bản; gửi duyệt; nút theo quyền.

## Kiểm chứng

- Lúc merge: 485 test cho exhibits — DTO + luật publish 130, repository 105, service 120, controller (RBAC, audit, edge case) 130.
- Hiện tại `npm run test:exhibits`: **568/568** (chạy lại ngày 20/10/2026, gồm test Task 9 bổ sung).

## Giới hạn & việc sau

Đã xử lý ở Task 9:
- ~~`validateForPublish()` là dead code, không được gọi khi submit/publish~~ → `RevisionPublishGate`.
- ~~`GET /:id/revisions[/:revId]` trả entity thô, lộ `passwordHash` của người tạo/duyệt và `storageKey`~~ → trả DTO.
- ~~`modelId/imageId/audioId` chỉ kiểm tra định dạng UUID~~ → kiểm tra media tồn tại, `ready`, đúng loại.

Còn tồn tại:
- **Reorder không kiểm tra hiện vật thuộc phòng:** `PUT /rooms/:roomId/reorder` cập nhật `displayOrder` theo id mà không lọc `roomId`, nên id của hiện vật phòng khác cũng bị đổi thứ tự; id không tồn tại bị bỏ qua im lặng. Nên kiểm tra tập id khớp đúng hiện vật của phòng (400/422 nếu lệch).
- `/:id/preview` hiện dùng chung logic với `/:id` (Task 9 bổ sung media URL ký).
- Xóa hiện vật dùng quyền `exhibit:update` vì bộ quyền chưa có `exhibit:delete`.
