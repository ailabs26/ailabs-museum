---
phase: 1
title: "Migration schema media vi/en + index"
status: completed
priority: P1
effort: "3h"
dependencies: [0]
---

# Phase 1: Migration schema media vi/en + index

## Overview
Bổ sung slot audio tiếng Anh và phụ đề vi/en cho revision (D1), thêm index phục vụ truy vấn "media công khai" và `countUsage`. Không đổi dữ liệu hiện có.

## Requirements
- Functional: revision có 6 slot media: model, image, audio vi (`audio_media_id` giữ nguyên tên), audio en, subtitle vi, subtitle en.
- Non-functional: migration chỉ ADD COLUMN nullable + CREATE INDEX → không rewrite bảng; `down` đảo ngược an toàn; `synchronize` vẫn tắt.

## Architecture
```sql
ALTER TABLE exhibit_revisions
  ADD COLUMN audio_en_media_id    uuid NULL REFERENCES media(id) ON DELETE RESTRICT,
  ADD COLUMN subtitle_vi_media_id uuid NULL REFERENCES media(id) ON DELETE RESTRICT,
  ADD COLUMN subtitle_en_media_id uuid NULL REFERENCES media(id) ON DELETE RESTRICT;
COMMENT ON COLUMN exhibit_revisions.audio_media_id IS 'Audio guide tiếng Việt';

-- Truy vấn "media được published revision tham chiếu" + countUsage (BR-21)
CREATE INDEX "IDX_exhibit_revisions_model_media"       ON exhibit_revisions(model_media_id)       WHERE model_media_id IS NOT NULL;
CREATE INDEX "IDX_exhibit_revisions_image_media"       ON exhibit_revisions(image_media_id)       WHERE image_media_id IS NOT NULL;
CREATE INDEX "IDX_exhibit_revisions_audio_media"       ON exhibit_revisions(audio_media_id)       WHERE audio_media_id IS NOT NULL;
CREATE INDEX "IDX_exhibit_revisions_audio_en_media"    ON exhibit_revisions(audio_en_media_id)    WHERE audio_en_media_id IS NOT NULL;
CREATE INDEX "IDX_exhibit_revisions_subtitle_vi_media" ON exhibit_revisions(subtitle_vi_media_id) WHERE subtitle_vi_media_id IS NOT NULL;
CREATE INDEX "IDX_exhibit_revisions_subtitle_en_media" ON exhibit_revisions(subtitle_en_media_id) WHERE subtitle_en_media_id IS NOT NULL;
CREATE INDEX "IDX_exhibits_published_revision" ON exhibits(published_revision_id) WHERE published_revision_id IS NOT NULL;
```
Đặt tên FK theo quy ước TypeORM sinh ra (chạy `migration:generate` để lấy tên chính xác rồi viết tay migration gọn, giống migration Task 8). Kiểm tra trước `\d exhibit_revisions` xem index nào đã tồn tại để tránh trùng.

`down`: DROP INDEX (IF EXISTS) → DROP COLUMN 3 cột. **Từ chối** `down` nếu còn dòng có giá trị ở cột mới (giống cách Task 8 xử lý `subtitle`) → tránh mất dữ liệu âm thầm.

## Related Code Files
- Create: `back-end/src/database/migrations/1792xxxxxxxxx-AddRevisionLocalizedMedia.ts`
- Modify: `back-end/src/modules/exhibits/entities/exhibit-revision.entity.ts` (3 cặp `@Column` + `@ManyToOne(() => Media, { nullable: true, onDelete: 'RESTRICT' })`, `@Index` partial tương ứng)
- Modify: `back-end/src/modules/media/repositories/media.repository.ts` → `referencesMedia` thêm 3 cột (**G10, bắt buộc cùng commit**)
- Modify: `docs/Diagrams/01-erd.md`, `docs/architecture/04-data-model-erd.md` (cột mới)

## Implementation Steps
1. Sửa entity; khai báo hằng `REVISION_MEDIA_SLOTS` (single source of truth) trong `exhibits/constants/revision-media-slots.ts`:
   ```ts
   export const REVISION_MEDIA_SLOTS = [
     { column: 'modelMediaId',      dtoField: 'modelId',      kind: MediaKind.MODEL,    locale: null },
     { column: 'imageMediaId',      dtoField: 'imageId',      kind: MediaKind.IMAGE,    locale: null },
     { column: 'audioMediaId',      dtoField: 'audioViId',    kind: MediaKind.AUDIO,    locale: 'vi' },
     { column: 'audioEnMediaId',    dtoField: 'audioEnId',    kind: MediaKind.AUDIO,    locale: 'en' },
     { column: 'subtitleViMediaId', dtoField: 'subtitleViId', kind: MediaKind.SUBTITLE, locale: 'vi' },
     { column: 'subtitleEnMediaId', dtoField: 'subtitleEnId', kind: MediaKind.SUBTITLE, locale: 'en' },
   ] as const;
   ```
   `referencesMedia`, validator Phase 2, gate Phase 3, mapper Phase 4, query Phase 5 đều lặp qua hằng này → thêm slot mới không thể quên chỗ nào.
2. Viết migration; chạy `migration:run` trên DB Docker.
3. `npm run migration:generate -- src/database/migrations/Drift` → phải báo **No changes**; xóa file nếu sinh ra.
4. `migration:revert` → `migration:run` lại. Thử revert khi có dữ liệu cột mới → phải throw.
5. `EXPLAIN` truy vấn Phase 5 sau khi seed ~1k revision để xác nhận dùng index (ghi kết quả vào PR).

## Success Criteria
- [x] up/down/up sạch, không drift.
- [x] `countUsage` đếm được media ở cả 6 slot (test Phase 7: R-USG-*).
- [x] Bản ghi cũ không bị ảnh hưởng (`audio_media_id` giữ nguyên giá trị).

## Risk Assessment
- Quên `referencesMedia` → xóa được media đang public: chặn bằng test bắt buộc + dùng `REVISION_MEDIA_SLOTS`.
- Trùng tên index với migration cũ → kiểm tra `\di` trước.
