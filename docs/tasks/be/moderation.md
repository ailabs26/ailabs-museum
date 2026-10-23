# Task 22: Kiểm duyệt nội dung (Moderation)

Nhánh gốc: `feat/admin-moderation` → PR #34 (12/10/2026). Sửa hàng đợi sau đó: PR #68
(`fix/moderation-queue`, xem [../moderation-queue-fix.md](../moderation-queue-fix.md)).

**Trạng thái:** Đã merge vào `dev`.

## Phạm vi

Module `back-end/src/modules/moderation/` xử lý vòng đời revision sau khi biên tập viên
gửi duyệt: xem hàng chờ, xem chi tiết/diff, xuất bản, từ chối, ẩn/hiện hiện vật. Module
**không có entity riêng** — dùng `Exhibit` và `ExhibitRevision` của module `exhibits`.

Tạo/sửa bản nháp và `submit-review` nằm ở `/admin/exhibits` (Task 7, xem
[cms-exhibits-management.md](cms-exhibits-management.md)).

## Vòng đời revision

```
draft ──submit-review──► in_review ──publish──► approved (thành bản published của hiện vật)
                              │
                              └────reject─────► rejected (kèm reason)
```

- Chỉ revision `in_review` mới publish/reject được; trạng thái khác → **409**.
- Publish đặt `exhibit.publishedRevisionId = revision.id`, `visibility = visible`,
  `archivedAt = null`, tăng `exhibit.version`.
- Reject chỉ đổi revision (state, reason, reviewer); **không** tăng `exhibit.version`.

## API

| Method | Route | Quyền | Audit | Body |
|---|---|---|---|---|
| `GET` | `/api/moderation/queue?page&pageSize&roomId` | `revision:publish` | — | — |
| `GET` | `/api/moderation/revisions/:id` | `exhibit:read` | — | — |
| `GET` | `/api/moderation/revisions/:id/diff` | `exhibit:read` | — | — |
| `GET` | `/api/exhibits/:id/revisions` | `exhibit:read` | — | — |
| `POST` | `/api/revisions/:id/publish` | `revision:publish` | `revision.publish` | `{ version }` |
| `POST` | `/api/revisions/:id/reject` | `revision:reject` | `revision.reject` | `{ version, reason }` |
| `POST` | `/api/exhibits/:id/hide` | `revision:hide` | `exhibit.hide` | `{ version }` |
| `POST` | `/api/exhibits/:id/unhide` | `revision:hide` | `exhibit.unhide` | `{ version }` |

Ba controller tách theo prefix route: `ModerationController` (`/moderation`),
`RevisionsController` (`/revisions`), `ExhibitRevisionsController` (`/exhibits`).

### DTO

- `PublishRevisionDto` / `HideExhibitDto`: `version` (int ≥ 0) — phiên bản hiện vật client đang xem.
- `RejectRevisionDto`: `version` + `reason` (bắt buộc, ≤ 1000 ký tự, thông báo lỗi "Phải nêu lý do từ chối").
- `ListQueueQueryDto` kế thừa `PaginationQueryDto`, thêm `roomId` (UUID v4) tùy chọn.
- `RevisionResponseDto`: `id, exhibitId, revisionNo, state, content, createdBy, reviewedBy,
  reason, createdAt, reviewedAt, exhibit?` — user chỉ gồm `id/email/displayName`, không lộ
  `passwordHash`.
- `RevisionDiffDto`: `publishedRevisionNo` (null nếu chưa từng xuất bản), `targetRevisionNo`,
  `fields[] = { field, label, oldValue, newValue, changed }`.

## Luật nghiệp vụ

### Optimistic concurrency (409)

Mọi thao tác ghi kèm `version`. Cập nhật nguyên tử theo `WHERE id = ? AND version = ?`:

- **publish / hide / unhide:** `UPDATE exhibits ... SET version = version + 1` trong
  `TransactionManager.run`; `affected = 0` → 409.
- **reject:** so `exhibit.version` với `dto.version` trước khi ghi, rồi `UPDATE` revision
  có điều kiện `state = in_review` (chặn hai người reject/publish cùng lúc).

Thông báo 409 thống nhất: *"Nội dung đã bị thay đổi bởi người khác, vui lòng tải lại trang"* —
FE dựa vào đó để hiện cảnh báo tải lại.

### Publish gate

Trước khi publish, `RevisionPublishGate.assertPublishable(revision, manager)` (module
`exhibits`) kiểm lại nội dung và media. Media được khóa `FOR SHARE` tới hết transaction nên
không thể bị xóa giữa lúc kiểm tra và lúc publish. Chi tiết:
[cms-media-attach.md](cms-media-attach.md).

### Hàng chờ

- Chỉ revision `in_review`, **cũ nhất lên trước** (FIFO): `ORDER BY createdAt ASC, id ASC`.
  Khóa phụ `id` giữ thứ tự ổn định khi nhiều revision trùng `createdAt` (sửa ở PR #68).
- `pageSize` kẹp trong 1–100, `page` ≥ 1.
- `innerJoin` hiện vật nên lọc được theo `exhibit.room_id`.

### Diff

So sánh revision đang xét với bản published hiện hành, theo hai nhóm:

1. Field nội dung (`content`): `name`, `description`, `transcript`, `position` (chuỗi
   `"x, y, z"`), `placeholderShape`, `placeholderColor`.
2. Media slot (`REVISION_MEDIA_SLOTS`): so theo **id media** của từng slot, field có dạng
   `media.<slot>`.

Hiện vật chưa từng xuất bản → mọi `oldValue = null`.

### Ẩn / hiện

- Hide đặt `visibility = hidden` + `archivedAt = now()`; unhide đặt lại `visible` + `archivedAt = null`.
- Bỏ qua hiện vật đã xóa mềm (`isDeleted = false` trong điều kiện update) → 404/409.
- Hiện vật bị ẩn không xuất hiện ở API public. Quy tắc dùng Ẩn thay cho Xóa với hiện vật
  đã public: [../exhibit-deletion-policy.md](../exhibit-deletion-policy.md).

## Front-end

- Service: `front-end/src/services/moderation.service.ts` (`queue`, `getRevision`, `diff`,
  `history`, `publish`, `reject`, `hide`, `unhide`).
- Màn hình: `front-end/src/pages/admin/ModerationPage.tsx`, route `/admin/moderation`.
- Hàng chờ tự làm mới sau khi gửi bản nháp; lỗi tải hiển thị song ngữ (PR #68).

## Kiểm thử

```bash
cd back-end && npm run test:moderation
```

- `moderation-service.spec.ts`: publish/reject/hide happy-path, 409 lệch version, 404.
- `moderation-repository.spec.ts`: thứ tự FIFO + phân trang toàn hàng chờ.
- `moderation-http.spec.ts`: metadata route, quyền và audit.
- FE: `front-end/tests/moderation-queue.spec.ts`, `moderation-keyboard.spec.ts`.
