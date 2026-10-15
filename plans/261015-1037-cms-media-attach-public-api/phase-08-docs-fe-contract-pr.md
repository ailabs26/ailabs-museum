---
phase: 8
title: "Tài liệu, FE contract, PR"
status: completed
priority: P2
effort: "3h"
dependencies: [7]
---

# Phase 8: Tài liệu, FE contract, PR

## Overview
Cập nhật contract FE tối thiểu để public site không vỡ khi BE trả media thật, cập nhật tài liệu, mở PR vào `dev`.

## Implementation Steps
1. **FE (bắt buộc cùng PR, báo Tiến/Thi)** `front-end/src/validations/roomSchema.ts`:
   - Thay `model: z.null(), image: z.null(), audio: z.null()` bằng schema `publicMediaSchema` (`url: z.string().url()`, `mimeType`, `sizeBytes: z.number().int().positive()`, `rights`), `image` thêm `altText`, `audio: z.object({ vi: track.nullable(), en: track.nullable() }).nullable()`; tất cả `.nullable()`.
   - Thêm `i18n`, `rotation`, `scale` dưới dạng `.optional()` để tương thích ngược.
   - Không đổi component render (Task 16–18 của Tiến/Thi tiêu thụ sau). Chạy `npm run typecheck && npm run lint && npm run build` + vitest.
   - `services/exhibits.service.ts` (admin): thêm field `audioViId/audioEnId/subtitleViId/subtitleEnId` vào type (không đổi UI).
2. **Docs**
   - `back-end/docs/tasks/cms-media-attach.md` (cùng format `cms-media-upload.md`): API, mã lỗi, luật publish, quy tắc truy cập file, cấu hình env.
   - `docs/architecture/06-api-contract.md`: DTO public mới + ví dụ JSON thật.
   - `docs/architecture/04-data-model-erd.md`, `docs/Diagrams/01-erd.md`: 3 cột mới.
   - `front-end/docs/architecture/data-api-and-cms.md`: luồng Preview dùng URL ký.
   - `.env.example`: `MEDIA_PUBLIC_BASE_URL`, `MEDIA_URL_SIGNING_SECRET`, `MEDIA_SIGNED_URL_TTL_SECONDS`.
3. **Commit nhỏ** (gợi ý thứ tự):
   1. `feat(db): add localized audio and subtitle slots to revisions`
   2. `fix(media): count usage across all revision media slots`
   3. `feat(exhibits): validate media references when saving drafts`
   4. `feat(exhibits): enforce publish gate on submit review`
   5. `feat(moderation): enforce publish gate with media locks`
   6. `feat(exhibits): expose published media in public room API`
   7. `feat(media): serve uploads only when publicly referenced or signed`
   8. `feat(exhibits): include signed revision media in admin preview`
   9. `feat(fe): accept public media DTO in room schema`
   10. `docs(tasks): document CMS media attach and public API`
4. **PR** vào `dev` (report tại `plans/reports/pr-<date>-cms-media-attach-report.md` theo mẫu PR Task 8): tóm tắt, bảng API, mã lỗi, migration + hướng dẫn deploy (`migration:run`, env mới — **thiếu env app không khởi động**), kết quả kiểm thử với số liệu, lưu ý reviewer (diff moderation, đổi contract public), ngoài phạm vi.

## Success Criteria
- [ ] FE build/typecheck/lint xanh với response thật.
- [ ] Reviewer có lệnh tái hiện đầy đủ.
- [ ] Không merge thẳng `main`.

## Ngoài phạm vi (ghi trong PR)
- UI chọn/gắn media trong form CMS & Preview 3D (Task 10).
- Player audio/captions phía public (Task 18), GLB loader (Task 12).
- Supabase Storage / CDN; endpoint public theo ID exhibit; tách quyền `media:read`.
