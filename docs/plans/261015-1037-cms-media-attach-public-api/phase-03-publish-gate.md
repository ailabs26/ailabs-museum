---
phase: 3
title: "Cổng Submit Review / Publish"
status: completed
priority: P1
effort: "5h"
dependencies: [2]
---

# Phase 3: Cổng Submit Review / Publish (`RevisionPublishGate`)

## Overview
Đưa `validateForPublish` (đang là dead code — G4) vào luồng thật, bổ sung luật media §5.2 + rights FR-97, và kiểm tra lại media ngay trong transaction publish có khóa `FOR SHARE` (đóng race G9).

## Requirements
- Submit Review và Publish đều chạy cùng một gate. Lỗi → 422, **không** đổi state, không đổi `publishedRevisionId`, không tăng `version` (§5.1).
- Luật media khi Submit/Publish:
  | Luật | code | field |
  |---|---|---|
  | Mọi media được gắn: tồn tại, chưa xóa, ready, đúng kind (kiểm lại — có thể đã đổi từ lúc Save) | `media_not_found` / `media_not_ready` / `media_kind_mismatch` | slot |
  | Mọi media được gắn có đủ `source`, `author`, `license` (trim không rỗng) | `media_rights_missing` | slot |
  | Có image → `altText.vi` và `altText.en` không rỗng (đã có trong `validateForPublish`) | `image_alt_text_missing` | `altText.vi/en` |
  | Có audio locale L → transcript L không rỗng **và** subtitle L có mặt | `audio_transcript_missing`, `audio_subtitle_missing` | `transcript.L`, `subtitleLId` |
  | Có subtitle L mà không có audio L | `subtitle_without_audio` | `subtitleLId` |
  | Transcript ≤ 20.000 ký tự/ngôn ngữ | `transcript_too_long` | `transcript.L` |
- Không yêu cầu audio en khi có audio vi (audio là tùy chọn từng ngôn ngữ — AC-08: thiếu thì FE báo không khả dụng, không phát ngôn ngữ khác).
- Các luật nội dung sẵn có trong `validateForPublish` (name/description/hotspot…) được chuyển sang trả `ApiError{field, code}` thay vì chuỗi.

## Architecture
```
exhibits/services/revision-publish.gate.ts  (@Injectable, export từ ExhibitsModule)
  assertPublishable(revision: ExhibitRevision, manager: EntityManager): Promise<void>
     1. contentErrors = validateForPublish(toPublishInput(revision))           // thuần
     2. media = MediaRepository.lockAttachableByIds(ids của 6 slot, manager)   // FOR SHARE
     3. mediaErrors = checkMediaForPublish(revision, media)                    // thuần
     4. errors.length → throw DomainValidationException(errors)
```
- `ExhibitsService.submitDraftForReview`: gọi gate **trong** `tx.run` trước khi đổi state.
- `ModerationService.publish` (module Quang — D7): gọi gate trong `tx.run` **trước** `m.update(Exhibit…)`. Thứ tự lock: media (FOR SHARE) → exhibit (UPDATE). `MediaService.delete` lock media FOR UPDATE rồi đọc revision → không có thứ tự ngược ⇒ không deadlock. Sau khi publish commit, delete đang chờ sẽ thấy `publishedExhibits > 0` → 409 đúng BR-21.
- `moderation.module.ts` import `ExhibitsModule` (đã export) — kiểm tra vòng import.

## Related Code Files
- Create: `back-end/src/modules/exhibits/services/revision-publish.gate.ts`
- Modify: `exhibits/dto/publish-validation.dto.ts` (trả `ApiError[]`, thêm luật audio en/subtitle/transcript length; giữ export cũ cho test hiện có hoặc cập nhật test)
- Modify: `exhibits/services/exhibits.service.ts` (submit), `exhibits/exhibits.module.ts`
- Modify: `moderation/services/moderation.service.ts` (publish), `moderation/moderation.module.ts`
- Modify: `moderation/dto/revision-diff.dto.ts` + service diff — thêm 6 slot media vào diff để moderator thấy media đổi

## Implementation Steps
1. Test đỏ (nhóm G-*): unit gate thuần + service submit + moderation publish.
2. Refactor `validateForPublish` → `ApiError[]`; cập nhật test `exhibits-dto.spec.ts` liên quan (không xóa ca nào, chỉ đổi assertion).
3. `checkMediaForPublish` thuần theo `REVISION_MEDIA_SLOTS`.
4. Gắn gate vào submit & publish; đảm bảo throw trước mọi `update`.
5. Rà fixture seed/test đang tạo revision `in_review` thiếu bản dịch en (seed demo lưu name chuỗi) → nếu publish fixture demo bị chặn, cập nhật fixture cho đủ vi/en **thay vì** nới luật. Chạy `npm run test:seed`.
6. Báo Quang review diff moderation (≤ ~20 dòng).

## Success Criteria
- [x] Submit/Publish thiếu rights/transcript/subtitle/alt → 422 đúng code, DB không đổi (kiểm bằng integration).
- [x] Media bị xóa mềm sau khi Save Draft → Submit 422 `media_not_found`.
- [x] Publish đồng thời với delete media: một trong hai thắng, trạng thái cuối nhất quán (không có published revision trỏ media đã xóa) — test integration 2 connection.
- [x] Toàn bộ test moderation cũ vẫn xanh.

## Risk Assessment
- Bật validate làm hỏng dữ liệu demo/fixture đang có → chạy `test:seed`, `test:moderation` sớm; nếu nhóm cần chuyển tiếp, KHÔNG thêm cờ tắt validate ở production.
- Đụng module người khác → PR ghi rõ, commit riêng `feat(moderation): enforce publish gate`.
