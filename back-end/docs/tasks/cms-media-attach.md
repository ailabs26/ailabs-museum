# Task 9: Gắn media vào revision + Public Published API

Nhánh: `feat/cms-media-attach` (tách từ `feat/cms-media-upload`, rebase lên `dev` sau khi Task 8 merge). SRS: FR-55–57, FR-68, FR-97, §5.1–5.2, BR-21/22, AC-32/33/35/36/51. Plan: `plans/261015-1037-cms-media-attach-public-api/`.

## Đã làm

- **Slot media theo ngôn ngữ:** revision có 6 slot — `model`, `image`, `audioVi` (cột cũ `audio_media_id`), `audioEn`, `subtitleVi`, `subtitleEn`. Nguồn sự thật duy nhất: `exhibits/constants/revision-media-slots.ts` (kiểm tra khi gắn, cổng publish, BR-21, public API, phân phối file đều lặp qua hằng này).
- **Gắn/thay/tháo khi Save Draft** (`POST/PATCH /api/admin/exhibits`): field `modelId`, `imageId`, `audioViId`, `audioEnId`, `subtitleViId`, `subtitleEnId` (`audioId` cũ = alias của `audioViId`). Vắng mặt = giữ nguyên, `null` = tháo (không xóa file), UUID = gắn. Media phải tồn tại, chưa xóa, `ready`, đúng loại — kiểm trong transaction, khóa `FOR SHARE` để không bị xóa đồng thời. Revision đang published không bao giờ bị sửa (fork copy đủ 6 slot).
- **Cổng Submit Review / Publish** (`RevisionPublishGate`, dùng chung cho `submit-review` và `POST /revisions/:id/publish`): chạy `validateForPublish` (trước đây là dead code) + kiểm lại tham chiếu media + quyền sử dụng (FR-97) + alt text ảnh vi/en + mỗi audio có transcript và phụ đề cùng ngôn ngữ. Lỗi → 422, không đổi state/version/publishedRevisionId. Đóng race publish ↔ xóa media ghi trong PR Task 8.
- **Public API** `GET /api/rooms/:slug`: chỉ revision Published hiện hành (APPROVED, đúng `publishedRevisionId`) của exhibit visible, chưa lưu trữ/xóa; trả `model`, `image` (+ `altText`), `audio: { vi, en }` (track = audio + phụ đề + transcript, không tự thay ngôn ngữ), `rights`, `rotation`, `scale`, `i18n`. Field cũ `name/description/transcript` giữ dạng chuỗi (bản vi) để FE hiện tại không vỡ. URL media tuyệt đối (`MEDIA_PUBLIC_BASE_URL`). `Cache-Control: no-cache`.
- **Phân phối file** `GET /media/uploads/<dir>/<uuid>.<ext>` (thay `express.static`): chỉ trả file được revision public hiện hành tham chiếu, hoặc URL ký HMAC còn hạn (Preview). Còn lại 404 (không phân biệt "không tồn tại" và "không được phép"). Header: Content-Type từ DB, `nosniff`, CSP `sandbox`, ETag = SHA-256, `no-cache` (URL ký: `private, no-store`), Range/HEAD/304.
- **Admin:** `GET /admin/exhibits/:id` và `/preview` trả `media` của revision đang xem với URL ký; thư viện `/admin/media` trả URL ký. `GET /admin/exhibits/:id/revisions[/:revId]` trả DTO thay entity thô — **vá lỗi lộ `passwordHash` người tạo/duyệt và `storageKey`** có từ Task 7.
- **Moderation diff:** thêm 6 dòng `media.<slot>` so sánh id media.
- **Schema:** migration `1792073130413-AddRevisionLocalizedMedia` thêm 3 cột FK + index một phần trên 6 slot và `exhibits.published_revision_id`. `down` từ chối nếu còn dữ liệu ở cột mới.
- **FE:** `roomSchema.ts` nhận DTO media (URL http(s) tuyệt đối, UUID, kích thước nguyên dương, scale > 0); kiểu admin `exhibits.service.ts` có 4 field mới.

## Mã lỗi (422, `errors[].{field, code}`)

| code | Khi nào |
|---|---|
| `media_not_found` | media không tồn tại hoặc đã xóa mềm |
| `media_not_ready` | `pending` / `failed` / `quarantined` |
| `media_kind_mismatch` | gắn sai loại vào slot |
| `media_rights_missing` | Submit/Publish: thiếu `source`/`author`/`license` |
| `image_alt_text_missing` | Submit/Publish: có ảnh, thiếu `altText.vi`/`.en` |
| `audio_transcript_missing` / `audio_subtitle_missing` | Submit/Publish: audio thiếu transcript/phụ đề cùng ngôn ngữ |
| `subtitle_without_audio` | phụ đề không có audio cùng ngôn ngữ |
| `transcript_too_long` | > 20.000 ký tự/ngôn ngữ |
| `publish_content_invalid` | luật nội dung §5.2 (tên/mô tả vi-en, transform, hotspot) |
| `audio_alias_conflict` (400) | `audioId` ≠ `audioViId` |

## Cấu hình mới (`.env`)

`MEDIA_PUBLIC_BASE_URL` (origin API, mặc định `http://localhost:3001`), `MEDIA_URL_SIGNING_SECRET` (≥ 32 ký tự, **bắt buộc đổi ở môi trường thật**), `MEDIA_SIGNED_URL_TTL_SECONDS` (60–86400, mặc định 900).

## Kiểm chứng ngày 15/10/2026

- BE `npm run typecheck`, `lint`, `build`: đạt. `npm test`: 1537/1537 (nay gồm cả test exhibits). `test:moderation` 20/20, `test:seed` 6/6.
- Integration PostgreSQL 16 (`MEDIA_TEST_DATABASE_URL=... npm run test:media`): 549/549, gồm điều kiện công khai cho từng slot/trạng thái, BR-21 cả 6 slot, khóa FOR SHARE chặn xóa, race Submit ↔ xóa media 15 vòng.
- Migration: up → `migration:generate` không drift → down → up; down bị từ chối khi còn dữ liệu.
- E2E bản build + PostgreSQL + JWT thật: 50/50 (upload → gắn → preview URL ký → submit thiếu rights/phụ đề 422 → sửa → publish → public API → file 200/206/304/HEAD/CORS → Draft v2 không đổi public → xóa media đang public 409 → hide → file 404).
- FE `typecheck`, `lint`, `build`, `test:unit` đạt; contract test với response thật từ E2E đạt.

## Cập nhật ngày 16/10/2026

- **Hoàn tất kiểm thử hồi quy & tích hợp:** 1.537/1.537 tests backend đạt 100% (gồm `media`, `exhibits`, `rooms`, `moderation`, `audit`, `auth`).
- **Bảo đảm chất lượng mã nguồn:** Toàn bộ quality gates trên cả hai phân hệ `back-end` và `front-end` (`npm run typecheck`, `npm run lint`) đều đạt, không có lỗi.
- **Sẵn sàng bàn giao Task 9:** Nhánh `feat/cms-media-attach` gồm 9 commit nguyên tử tuân thủ Conventional Commits, đáp ứng đầy đủ BR-21, BR-22, AC-32, AC-36, AC-51.
- **Lộ trình kế tiếp (Task 10):** Sau khi PR Task 8 & 9 được review và merge vào `dev`, sẽ khởi tạo nhánh `feat/cms-preview-integration` để tích hợp hoàn chỉnh luồng upload -> gắn media -> metadata quyền tác giả -> preview 2D/3D trên CMS.

## Giới hạn & việc sau

- Media của Draft xóa được (hành vi Task 8 — chỉ chặn published/in_review); Submit sau đó báo `media_not_found`.
- Bản dịch song ngữ trong DTO `transcript` (BilingualDescriptionDto) giới hạn 10.000 ký tự/ngôn ngữ, chặt hơn SRS (20.000) — thuộc DTO Task 7.
- UI gắn media + Preview 3D (Task 10), player audio/phụ đề (Task 18), GLB loader (Task 12) chưa dùng dữ liệu mới.
- Trước khi deploy: `npm run migration:run` và đặt 3 biến môi trường mới.

