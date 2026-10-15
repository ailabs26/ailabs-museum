---
phase: 4
title: "Public Published API + DTO media"
status: completed
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 4: Public Published API + DTO media

## Overview
`GET /api/rooms` và `GET /api/rooms/:slug` (controller `ExhibitsController`, đang được FE `museum.service.ts` dùng) trả DTO public đã lọc, có media thật thay vì `null` (G2), chuẩn hóa text song ngữ (G6/G7), URL tuyệt đối (G8). Chỉ revision Published hiện hành của exhibit còn public (FR-68, AC-36).

## Requirements
- Lọc (giữ + bổ sung, tất cả ở **query**, không lọc ở FE):
  - room `status = active`, `is_deleted = false` (đã có).
  - exhibit `visibility = visible`, `is_deleted = false`, `archived_at IS NULL` (**bổ sung archived**), `published_revision_id IS NOT NULL`.
  - revision = `exhibit.publishedRevision` và `state = approved` (đã có, giữ).
  - media trả ra chỉ khi `is_deleted = false AND processing_state = 'ready'`; ngược lại slot = `null` + `Logger.warn` (không làm hỏng cả phòng).
- Không lộ: `storageKey`, `checksumSha256`, `createdById`, `originalName`, revisionId/revisionNo, reviewer, reason, state.
- DTO (D2 — tương thích ngược):
```ts
interface PublicMediaDto {
  id: string; url: string;            // URL tuyệt đối: `${MEDIA_PUBLIC_BASE_URL}/media/<key>`
  mimeType: string; sizeBytes: number;
  rights: { source: string | null; author: string | null; license: string | null }; // FR-97 công khai
}
interface PublicImageDto extends PublicMediaDto { altText: { vi: string | null; en: string | null } }
interface PublicAudioTrackDto { audio: PublicMediaDto; subtitle: PublicMediaDto | null; transcript: string | null }
interface PublicExhibitDto {
  id; roomId; displayOrder;
  name: string; description: string; transcript: string | null;          // = bản vi (giữ contract cũ)
  i18n: { vi: LocalizedText; en: LocalizedText };                         // LocalizedText = {name, description, transcript}
  positionX; positionY; positionZ;
  rotation: {x,y,z}; scale: {x,y,z};                                      // FR-61, mặc định (0,0,0)/(1,1,1)
  placeholderShape; placeholderColor;
  hotspots: { id; label: string; body: string; i18n: {vi:{label,body}, en:{label,body}}; positionX; positionY; positionZ; displayOrder }[];
  model: PublicMediaDto | null;
  image: PublicImageDto | null;
  audio: { vi: PublicAudioTrackDto | null; en: PublicAudioTrackDto | null } | null;  // null khi cả hai null
}
```
  Lưu ý: `audio` đổi từ `null` sang object → FE zod phải cập nhật cùng PR (Phase 8).
- `resolveBilingual(value)`: nhận chuỗi thường | `{vi,en}` | chuỗi JSON `{"vi":..}` (G7) → `{vi, en}`; chuỗi thường coi là `vi`, `en = null`. Field cũ `name` = `vi ?? en ?? ''`.
- Số thực: `Number()` + `Number.isFinite` cho hotspot/transform; giá trị không hữu hạn → loại hotspot đó + warn (không trả NaN làm FE zod vỡ cả phòng).

## Architecture
- Tách mapper thuần `exhibits/mappers/public-exhibit.mapper.ts` (`toPublicExhibit(exhibit, mediaUrl: (key) => string)`) → unit test không cần Nest.
- `MediaStorageService.toAbsolutePublicUrl(key)` dùng `media.publicBaseUrl` (config namespaced, Phase 0). Không dùng cho quarantine (null).
- Repository `findByRoom`: thêm `archivedAt: IsNull()`, `publishedRevisionId: Not(IsNull())`, relations thêm 3 slot mới. Sắp xếp `displayOrder, id` giữ nguyên (ổn định).
- Header response API public: `Cache-Control: no-cache` (BR-22/AC-51) qua `@Header()` trên controller — không thêm cache tầng ứng dụng (YAGNI); nếu sau này có cache phải invalidate khi publish/hide/delete.
- `@ApiOkResponse` với class DTO cho Swagger.
- Hai controller trùng chức năng (`/rooms` ở exhibits, `/public/rooms` ở rooms module chỉ trả room): **không** gộp trong task này; ghi vào docs `/api/rooms/:slug` là nguồn public exhibits chuẩn.

## Related Code Files
- Create: `exhibits/mappers/public-exhibit.mapper.ts`, `exhibits/dto/public-exhibit-response.dto.ts`, `exhibits/utils/resolve-bilingual.ts`
- Modify: `exhibits/services/exhibits.service.ts` (`roomWithExhibits` gọi mapper), `exhibits/repositories/exhibits.repository.ts` (`findByRoom`), `exhibits/controllers/exhibits.controller.ts` (header, swagger), `media/services/media-storage.service.ts`, `config/*.config.ts`, `config/env.validation.ts`

## Implementation Steps
1. Test đỏ nhóm P-* (mapper thuần + service với repo double).
2. `resolveBilingual` + test bảng (chuỗi, object thiếu en, chuỗi JSON hỏng → coi là chuỗi thường, null/undefined).
3. Mapper; service dùng mapper; repository lọc archived/published.
4. URL tuyệt đối; nếu `MEDIA_PUBLIC_BASE_URL` thiếu → app không khởi động (env validation).
5. Chạy app, gọi `curl /api/rooms/<slug>` với dữ liệu thật đủ 6 slot, đối chiếu JSON.

## Success Criteria
- [ ] Revision Draft/In Review/Rejected/Published lịch sử không bao giờ xuất hiện (AC-36) — test có id cụ thể.
- [ ] Hide/Archive/xóa mềm exhibit → biến mất khỏi request kế tiếp (AC-51).
- [ ] Publish revision mới đổi media → request kế tiếp trả media mới, không trả media cũ.
- [ ] Revision CMS song ngữ trả `name` chuỗi + `i18n`; seed chuỗi vẫn chạy.
- [ ] Media trong DTO là URL tuyệt đối, không có `storageKey`.

## Risk Assessment
- Đổi `audio/model/image` từ `null` → object làm FE hiện tại fail validate → bắt buộc merge cùng cập nhật `roomSchema.ts` (Phase 8); thông báo Tiến/Thi.
