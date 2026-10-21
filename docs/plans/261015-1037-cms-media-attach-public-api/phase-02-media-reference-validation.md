---
phase: 2
title: "Kiểm tra tham chiếu media khi Save Draft"
status: completed
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 2: Kiểm tra tham chiếu media khi Save Draft (gắn / thay / tháo)

## Overview
Mọi lần create/update Draft có field media đều được backend kiểm tra: media tồn tại, chưa xóa mềm, `processing_state = ready`, đúng `kind` của slot. Kiểm tra chạy **trong cùng transaction** và khóa `FOR SHARE` các dòng media để không bị xóa đồng thời. Sửa G1.

## Requirements
- Functional
  - DTO create/update nhận: `modelId`, `imageId`, `audioViId` (alias cũ `audioId` vẫn nhận, deprecated), `audioEnId`, `subtitleViId`, `subtitleEnId`.
  - Ngữ nghĩa ba trạng thái: field **vắng mặt** = giữ nguyên; **`null`** = tháo; **UUID** = gắn/thay.
  - Gửi cả `audioId` và `audioViId` khác nhau → 400 `audio_alias_conflict`.
  - Tháo media **không** xóa file/bản ghi media (AC-32, FR-55).
  - Revision APPROVED (đang published) không bao giờ bị sửa: logic fork hiện có giữ nguyên, media mới chỉ vào revision fork (AC-35, BR-21).
  - IN_REVIEW → 409 như hiện tại, **trước** khi kiểm tra media (không lộ trạng thái media vô ích).
- Non-functional: một truy vấn duy nhất `WHERE id IN (...)` cho mọi media được gửi; không N+1.

## Architecture
```
ExhibitsService.createExhibitDraft / updateExhibitDraft
   └─ tx.run(manager =>
        MediaReferenceValidator.assertAttachable(refs, manager)   // refs: {slot, mediaId}[] chỉ các field là UUID
             └─ MediaRepository.lockAttachableByIds(ids, manager)  // SELECT … FOR SHARE (không lọc is_deleted để phân biệt lỗi)
        … lưu revision như cũ)
```
- `MediaReferenceValidator` đặt ở `media/services/media-reference.validator.ts`, export từ `MediaModule`; `ExhibitsModule` import `MediaModule` (kiểm tra không tạo vòng import — MediaModule hiện import entity Exhibit/ExhibitRevision qua repository, **không** import ExhibitsModule → OK; nếu có vòng thì dùng `forwardRef` là dấu hiệu sai, thay bằng đặt validator ở exhibits và inject `MediaRepository`).
- Lỗi gom đủ rồi ném **một** `DomainValidationException` (422) với `errors: [{ field: 'imageId', code, message }]` — FE hiển thị theo field.

| Điều kiện | code | HTTP |
|---|---|---|
| Không có bản ghi | `media_not_found` | 422 |
| `is_deleted = true` | `media_not_found` (không phân biệt để khỏi lộ thông tin) | 422 |
| `processing_state` ≠ ready (pending/failed/quarantined) | `media_not_ready` | 422 |
| `kind` ≠ kind của slot | `media_kind_mismatch` | 422 |
| UUID sai định dạng | class-validator | 400 |
| Cùng một media id cho 2 slot khác kind | tự rơi vào `media_kind_mismatch` | 422 |

Khóa: `FOR SHARE` xung đột với `FOR UPDATE` trong `MediaService.delete` (Task 8) → delete chờ tới khi attach commit, rồi `countUsage` thấy tham chiếu mới nếu revision là in_review/published. Với Draft: delete media đang được Draft dùng **vẫn được phép** theo Task 8 (chỉ chặn published/in_review) → Phase 3 phải bắt lại khi submit (media_not_found). Ghi rõ hành vi này trong docs.

Thứ tự khóa cố định (sort ids tăng dần) để tránh deadlock khi hai request gắn cùng nhiều media.

## Related Code Files
- Create: `back-end/src/modules/media/services/media-reference.validator.ts`
- Modify: `media.repository.ts` (`lockAttachableByIds(ids, manager)`), `media.module.ts` (export)
- Modify: `exhibits/dto/create-exhibit.dto.ts`, `update-exhibit.dto.ts`, `exhibit-content.dto.ts` (field mới, `@ValidateIf(v => v !== null) @IsUUID()`, `@ApiPropertyOptional({ nullable: true })`)
- Modify: `exhibits/services/exhibits.service.ts` (gọi validator trong tx; map 6 slot bằng `REVISION_MEDIA_SLOTS`; fork copy đủ 6 slot)
- Modify: `exhibits/dto/exhibit-response.dto.ts` (trả đủ 6 id + `audioId` alias)
- Modify: `exhibits/exhibits.module.ts`

## Implementation Steps
1. Viết test đỏ trước (Phase 7 nhóm S-ATT-*), chạy `npm run test:exhibits` thấy fail.
2. Thêm field DTO; helper `resolveMediaPatch(dto)` trả `Partial<Record<column, string|null>>` chỉ gồm field được gửi, xử lý alias `audioId`.
3. Repository `lockAttachableByIds`: `createQueryBuilder('m').setLock('pessimistic_read').where('m.id IN (:...ids)', { ids: sorted })`.
4. Validator thuần (nhận `Media[]` + refs) để unit test không cần DB; wrapper lấy dữ liệu qua repository.
5. Gọi validator **đầu** callback `tx.run` ở create và cả hai nhánh update (fork / in-place). Bỏ qua khi không có UUID nào.
6. Fork từ APPROVED: copy đủ 6 cột (hiện chỉ copy 3 → bug tiềm ẩn khi thêm cột).
7. Bắt lỗi FK (`23503`) phòng thủ → 422 `media_not_found` thay vì 500 (trường hợp media bị hard-delete ngoài luồng).

## Success Criteria
- [x] Gắn media ready đúng kind → 200/201, tải lại giữ đúng id (AC-32).
- [x] Mọi dòng trong bảng lỗi trả đúng code/field; DB không thay đổi khi lỗi (rollback).
- [x] Sửa Draft khi exhibit đang published → revision published giữ nguyên media cũ (AC-35).
- [x] `null` tháo media, bản ghi media vẫn còn.

## Risk Assessment
- Lock `FOR SHARE` kéo dài nếu tx chậm → tx hiện ngắn (vài query); chấp nhận.
- Đổi DTO ảnh hưởng FE `exhibits.service.ts` (admin): giữ `audioId` alias để không vỡ.
