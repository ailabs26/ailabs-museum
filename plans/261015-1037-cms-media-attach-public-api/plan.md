---
title: "Task 9 — Gắn media vào revision + Public Published API + bảo vệ media"
description: "Gắn/thay/tháo model·image·audio vi/en·phụ đề vào Draft Revision có kiểm tra chặt; cổng Submit/Publish kiểm tra media + quyền sử dụng; public API trả DTO media đã lọc; phục vụ file media chỉ khi được revision public hiện hành tham chiếu."
status: completed
priority: P1
effort: "4–5 ngày công"
branch: "feat/cms-media-attach (tách từ feat/cms-media-upload cho tới khi PR Task 8 merge vào dev, sau đó rebase lên dev)"
owner: "Nguyễn Trọng Thành"
tags: [backend, cms, media, public-api, security, migration]
blockedBy: []
blocks: []
created: 2026-10-15
---

# Task 9 — Gắn media + Public Published API

Nguồn: bảng task nhóm (task 9, Thành): *"Gắn media, public published API — Task 7/8; FE chỉ nhận DTO validated, BE lọc Draft và bảo vệ media; AC-32/36"*. Phần "Ngoài phạm vi (Task 9)" của PR Task 8: *gắn media vào revision, kiểm tra media `ready`/chưa xóa khi attach, API public*.

Yêu cầu SRS áp dụng: **FR-55/56/57** (gắn/thay/tháo image/model/audio vi-en + captions trên Draft), **FR-68** (public chỉ trả revision Published hiện hành + media được nó tham chiếu), **FR-97** (metadata quyền sử dụng, thiếu thì chặn Submit/Publish), **§5.2** (luật Save Draft vs Publish), **BR-20/21/22**, **AC-32/33/35/36/51**, AC-07/08 (audio theo ngôn ngữ, không phát audio ngôn ngữ khác).

## Hiện trạng đã kiểm chứng trong code (lý do task này tồn tại)

| # | Vấn đề | Vị trí | Mức |
|---|---|---|---|
| G1 | `modelId/imageId/audioId` chỉ check `@IsUUID`; **không kiểm tra** media tồn tại, `ready`, chưa xóa, đúng `kind`. Gắn media quarantined/subtitle vào slot model vẫn lưu được (FK chỉ chặn id không tồn tại → 500 thay vì 422) | `exhibits.service.ts` create/update | Critical |
| G2 | Public API trả cứng `model: null, image: null, audio: null` | `ExhibitsService.roomWithExhibits` | Critical (thiếu chức năng) |
| G3 | `express.static('/media')` phục vụ **mọi** file đã upload ở `public/media/uploads`, kể cả file chỉ thuộc Draft/Rejected hoặc đã xóa mềm → vi phạm FR-68/AC-36/AC-51 | `main.ts:43-50` | Critical (bảo mật) |
| G4 | `validateForPublish()` là **dead code**: không được gọi ở submit-review lẫn moderation publish | `publish-validation.dto.ts`, `moderation.service.ts:96` | High |
| G5 | Schema chỉ có 1 `audio_media_id`, không có cột phụ đề; SRS yêu cầu audio **vi/en** + phụ đề cùng ngôn ngữ | `exhibit-revision.entity.ts` | High |
| G6 | Nội dung revision lưu song ngữ `{vi,en}` (CMS Task 7) nhưng seed lưu chuỗi; public trả nguyên `content.name` → FE zod (`name: z.string()`) **vỡ** khi gặp revision tạo bởi CMS | `roomWithExhibits`, `front-end/src/validations/roomSchema.ts` | High |
| G7 | Hotspot `label/body` là `varchar/text` nhưng DTO nhận object song ngữ → pg serialize thành chuỗi JSON; public trả chuỗi JSON thô | `hotspot.entity.ts`, service | Medium (cần xác minh ở Phase 0) |
| G8 | URL media là đường dẫn tương đối `/media/...` trong khi FE (5173) và BE (3001) khác origin → `<img>/<audio>`/GLTFLoader tải sai origin | `media-storage.service.ts:72` | High |
| G9 | Race publish ↔ delete media (đã ghi trong PR Task 8): publish không khóa dòng media | `moderation.service.ts` publish | Medium |
| G10 | `countUsage` (BR-21 chặn xóa) chỉ biết 3 cột media; thêm cột mới mà quên sửa → xóa được media đang public | `media.repository.ts:20` | High (regression trap) |

## Quyết định thiết kế (đề xuất — cần chốt ở Phase 0)

| ID | Quyết định | Đề xuất | Phương án khác |
|---|---|---|---|
| D1 | Lưu audio vi/en + phụ đề | **Thêm 3 cột FK** `audio_en_media_id`, `subtitle_vi_media_id`, `subtitle_en_media_id`; giữ `audio_media_id` với nghĩa **audio vi** (comment + alias `audioViId` trong DTO) | Bảng nối `exhibit_revision_media(role, locale)` — linh hoạt cho Task 39 nhưng blast radius lớn (countUsage, diff, stats, repo relations). YAGNI |
| D2 | Contract public cho text song ngữ | Giữ field cũ `name/description/transcript` = **chuỗi vi** (tương thích FE hiện tại) + thêm `i18n: { vi: {...}, en: {...} }` | Đổi hẳn sang object `{vi,en}` → phá FE Task 16 |
| D3 | Bảo vệ file media | Bỏ `express.static`; thêm route `GET /media/*` có kiểm tra "được revision public hiện hành tham chiếu"; Preview admin dùng **signed URL HMAC** (TTL 15 phút) | Admin fetch blob có Bearer (FE Task 10 phức tạp hơn); Supabase signed URL (chưa dùng Storage) |
| D4 | Cache file media | `Cache-Control: no-cache` + `ETag = checksum` (+ Range) → luôn revalidate, unpublish có hiệu lực ngay (AC-51) | `max-age` dài → vi phạm AC-51 |
| D5 | Thời điểm áp luật Publish | Save Draft: chỉ check tham chiếu (tồn tại/ready/kind). Submit Review + Publish: check đủ §5.2 (transcript, phụ đề, alt text, rights) | Check đủ ngay khi Save → trái §5.2 |
| D6 | Mã lỗi | 422 `DomainValidationException` `{field, code}`: `media_not_found`, `media_not_ready`, `media_kind_mismatch`, `media_rights_missing`, `audio_transcript_missing`, `audio_subtitle_missing`, `image_alt_text_missing`, `subtitle_without_audio` | — |
| D7 | Sửa moderation publish (module của Quang) | Gọi **hàm dùng chung** `RevisionPublishGate` export từ ExhibitsModule; diff nhỏ, báo Quang review | Nhân bản logic trong moderation (vi phạm DRY) |

## Phases

| # | Phase | Ưu tiên | Effort | Phụ thuộc | Trạng thái |
|---|---|---|---|---|---|
| 0 | [Baseline, xác minh & chốt quyết định](phase-00-baseline-and-decisions.md) | P1 | 2h | — | completed |
| 1 | [Migration schema media vi/en + index](phase-01-schema-migration.md) | P1 | 3h | 0 | completed |
| 2 | [Kiểm tra tham chiếu media khi Save Draft](phase-02-media-reference-validation.md) | P1 | 6h | 1 | completed |
| 3 | [Cổng Submit Review / Publish](phase-03-publish-gate.md) | P1 | 5h | 2 | completed |
| 4 | [Public Published API + DTO media](phase-04-public-published-api.md) | P1 | 6h | 1 | completed |
| 5 | [Phân phối file media có bảo vệ](phase-05-protected-media-delivery.md) | P1 | 6h | 4 | completed |
| 6 | [Admin detail/Preview trả media của revision](phase-06-admin-preview-media.md) | P2 | 3h | 2, 5 | completed |
| 7 | [Ma trận kiểm thử & quality gates](phase-07-test-matrix.md) | P1 | 8h | 1–6 | completed |
| 8 | [Tài liệu, FE contract, PR](phase-08-docs-fe-contract-pr.md) | P2 | 3h | 7 | completed |

Phase 2 và 4 chạy song song được sau Phase 1 (khác file). Phase 5 cần query "media công khai" của Phase 4.

## Luồng tổng thể

```
Upload (Task 8) → media.ready
   │
   ▼  PATCH /admin/exhibits/:id { modelId, imageId, audioViId, audioEnId, subtitleViId, subtitleEnId }
Phase 2: lock FOR SHARE media → tồn tại? chưa xóa? ready? đúng kind? → lưu vào Draft (published revision bất biến, fork nếu cần)
   │
   ▼  POST submit-review / POST moderation publish
Phase 3: RevisionPublishGate = validateForPublish(content) + luật media §5.2 + rights FR-97 (trong tx, FOR SHARE)
   │
   ▼  GET /api/rooms/:slug   (public)
Phase 4: chỉ exhibit visible + revision approved = publishedRevisionId + media ready & !deleted → DTO absolute URL
   │
   ▼  GET /media/uploads/<kind>/<uuid>.<ext>
Phase 5: key hợp lệ → media row → (được published revision tham chiếu) HOẶC (chữ ký HMAC hợp lệ) → sendFile (Range, ETag, nosniff, CSP sandbox) ; ngược lại 404
```

## Definition of Done

- [ ] Tất cả điều kiện nghiệm thu ở Phase 7 (§ Acceptance) đạt, có bằng chứng lệnh + output.
- [ ] `npm run typecheck && npm run lint && npm run build && npm test` (BE) xanh; `npm run test:exhibits`, `test:media`, `test:moderation` xanh.
- [ ] Integration PostgreSQL 16 (Docker) xanh; migration up → `migration:generate` không drift → down → up.
- [ ] FE `npm run typecheck && npm run lint && npm run build` + vitest schema xanh sau khi cập nhật `roomSchema.ts`.
- [ ] Không còn `express.static` cho uploads; quét `grep -rn "expressStatic" back-end/src` chỉ còn (hoặc không còn) chỗ đã duyệt.
- [ ] PR vào `dev`, commit nhỏ theo phase, báo Quang review diff ở moderation.

## Câu hỏi chưa giải quyết

1. Chốt D1 (3 cột vs bảng nối) và D3 (signed URL) với nhóm — ảnh hưởng FE Task 10/18.
2. Có cần endpoint public theo ID exhibit (`GET /api/exhibits/:id`) cho Task 17 không? Plan hiện **không** thêm (YAGNI), AC-36 vẫn đạt vì không có route nào lộ Draft.
3. Exhibit đang hiển thị mà media của revision published bị đánh `failed`/xóa bằng cách khác ngoài API (thao tác DB tay) → plan: public trả `null` cho slot đó + log warn; có cần cảnh báo trên dashboard không?
4. Có bật CDN/reverse proxy cache trước BE trên môi trường deploy không? Nếu có, cần cấu hình tôn trọng `no-cache`.
