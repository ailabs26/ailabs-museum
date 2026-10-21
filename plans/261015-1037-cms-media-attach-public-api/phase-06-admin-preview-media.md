---
phase: 6
title: "Admin detail/Preview trả media của revision"
status: completed
priority: P2
effort: "3h"
dependencies: [2, 5]
---

# Phase 6: Admin detail / Preview trả media của revision đang xem

## Overview
`GET /admin/exhibits/:id`, `/:id/preview`, `/:id/revisions/:revId` trả object media của **revision đang xem** (không phải revision public) với URL đã ký, để Preview dùng media của Draft (AC-32, FR-69/71) và FE Task 10 không phải tự ghép URL.

## Requirements
- Thêm `media: { model, image, audioVi, audioEn, subtitleVi, subtitleEn }` mỗi phần tử: `{ id, kind, mimeType, sizeBytes, processingState, url (ký, null nếu quarantine/deleted), altText, source, author, license, isDeleted }`. Giữ các field id cũ.
- Media đã bị xóa mềm/không ready vẫn hiển thị (để editor thấy cần thay) nhưng `url: null`.
- `getRevisionDetail` hiện trả entity thô (lộ mọi cột) → map qua DTO, kiểm tra không lộ `storageKey`.
- Quyền: giữ `EXHIBIT_READ`; thiếu token 401, thiếu quyền 403 (AC-17/36).
- Preview không đổi trạng thái gì (chỉ GET).

## Related Code Files
- Modify: `exhibits/dto/exhibit-response.dto.ts`, `exhibits/services/exhibits.service.ts` (`getAdminDetail`, `getRevisionDetail`), `exhibits/repositories/exhibits.repository.ts` (relations 6 slot cho `findAdminDetailById`, `findRevisionById`)
- Use: `MediaUrlSigner` (Phase 5)

## Implementation Steps
1. Test đỏ nhóm A-*.
2. Mapper `toAdminRevisionMedia(revision, signer)`.
3. Chạy app: tạo draft gắn media → GET preview → mở URL ký trong trình duyệt (200) → đợi hết hạn/đổi sig (404).

## Success Criteria
- [x] Preview Draft trả media của Draft trong khi `/api/rooms/:slug` vẫn trả media revision published cũ (AC-32).
- [x] Không response admin nào chứa `storageKey`.

## Risk Assessment
- Ký URL trong list lớn tốn CPU không đáng kể (HMAC). Không ký ở endpoint list (list không cần media).
