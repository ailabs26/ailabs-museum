---
phase: 7
title: "Ma trận kiểm thử & quality gates"
status: completed
priority: P1
effort: "8h"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Ma trận kiểm thử & quality gates

## Overview
Test viết **trước** code ở từng phase (đỏ → xanh). Phase này gom ma trận đầy đủ, chạy các tầng còn lại (integration PG, HTTP thật, E2E bản build), và nghiệm thu.

Công cụ theo repo: `node:test` + `assert/strict` + `ts-node` (như `exhibits-service.spec.ts`), double repository trong RAM cho unit, PostgreSQL 16 Docker cho integration (biến `MEDIA_TEST_DATABASE_URL`, chỉ nhận localhost như Task 8), app Nest thật cho HTTP. Thêm file vào script `test`/`test:exhibits`/`test:media` trong `package.json`.

## Ma trận

### S-ATT — Gắn/thay/tháo khi Save Draft (Phase 2)
| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| S-ATT-01 | Create với model/image/audioVi/audioEn/subtitleVi/subtitleEn ready đúng kind | 201, 6 id đúng; GET lại giống |
| S-ATT-02 | Update thay `imageId` sang media khác | 200, revision draft đổi, media cũ còn nguyên trong bảng media |
| S-ATT-03 | Update `imageId: null` | slot null, media không bị xóa |
| S-ATT-04 | Update không gửi field media | 6 slot giữ nguyên |
| S-ATT-05 | media id không tồn tại | 422 `media_not_found`, field đúng, revision không đổi |
| S-ATT-06 | media is_deleted | 422 `media_not_found` |
| S-ATT-07 | pending / failed / quarantined (3 ca) | 422 `media_not_ready` |
| S-ATT-08 | image vào `modelId`; subtitle vào `audioViId`; audio vào `subtitleEnId`; model vào `imageId` | 422 `media_kind_mismatch` từng ca |
| S-ATT-09 | Nhiều lỗi cùng lúc (3 slot sai) | 422, `errors` có đủ 3 phần tử |
| S-ATT-10 | UUID sai định dạng / số / object | 400 class-validator |
| S-ATT-11 | `audioId` (alias) hợp lệ | lưu vào slot audio vi |
| S-ATT-12 | `audioId` ≠ `audioViId` | 400 `audio_alias_conflict` |
| S-ATT-13 | Exhibit có revision APPROVED, update thay model | fork revision mới chứa model mới; revision published giữ model cũ (AC-35) |
| S-ATT-14 | Fork copy đủ 6 slot khi không gửi media | revision mới có đủ 6 id cũ |
| S-ATT-15 | Revision IN_REVIEW + gửi media sai | 409 (không 422) |
| S-ATT-16 | Cùng media dùng cho 2 exhibit | cả hai lưu được |
| S-ATT-17 | Client gửi `url`/`storageKey`/`modelMediaId` | 400 forbidNonWhitelisted |
| S-ATT-18 | Exhibit không tồn tại / đã xóa | 404 |
| S-ATT-19 | Validator ném lỗi → tx rollback (exhibit.version không tăng) | version giữ nguyên |
| S-ATT-20 | FK violation 23503 giả lập | 422 không 500 |

### G — Cổng Submit / Publish (Phase 3)
| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| G-01 | Revision đủ nội dung + media đủ rights/transcript/subtitle/alt | submit 200 → publish 200 |
| G-02 | Thiếu `license` trên 1 media (khoảng trắng) | 422 `media_rights_missing` field slot |
| G-03 | Có audio vi, thiếu transcript vi | 422 `audio_transcript_missing` |
| G-04 | Có audio en, thiếu subtitle en | 422 `audio_subtitle_missing` |
| G-05 | Có subtitle vi không có audio vi | 422 `subtitle_without_audio` |
| G-06 | Chỉ audio vi (không en) đủ điều kiện | 200 |
| G-07 | Image thiếu altText.en | 422 `image_alt_text_missing` |
| G-08 | Transcript 20.001 ký tự | 422 `transcript_too_long`; 20.000 → OK |
| G-09 | Media bị xóa mềm sau Save, trước Submit | 422 `media_not_found` |
| G-10 | Media bị đánh failed sau Submit, trước Publish | publish 422, state vẫn in_review, publishedRevisionId không đổi, version không tăng |
| G-11 | Không có media nào, nội dung đủ | 200 (media tùy chọn §5.2) |
| G-12 | Thiếu name.en | 422 (luật cũ của validateForPublish nay thực thi) |
| G-13 | Publish sai version | 409 như cũ (gate không đổi thứ tự lỗi version) — chốt: gate chạy trước hay sau check version, test cố định hành vi |
| G-14 | Integration: publish và delete media song song (2 connection, `Promise.all`, lặp 20 lần) | không bao giờ có exhibit published trỏ media is_deleted |
| G-15 | Diff moderation hiển thị thay đổi media | diff chứa slot đổi |

### P — Public API (Phase 4)
| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| P-01 | Exhibit published đủ 6 slot | DTO đúng shape, URL tuyệt đối, có rights, không có storageKey/checksum |
| P-02 | Exhibit chỉ có Draft (chưa publish) | không xuất hiện |
| P-03 | Published v1 + Draft v2 đổi model | trả model v1 |
| P-04 | Published v1 + In Review v2 / Rejected v2 | trả v1 |
| P-05 | Publish v2 | request mới trả v2; media chỉ thuộc v1 không xuất hiện |
| P-06 | Hide / archive / xóa mềm exhibit | biến mất |
| P-07 | Room inactive / xóa / slug không tồn tại | 404 |
| P-08 | Media published bị failed/xóa bằng DB | slot null + warn, các exhibit khác bình thường |
| P-09 | `name` chuỗi (seed) / `{vi,en}` / `{vi}` thiếu en / chuỗi JSON | `name` = vi, `i18n` đúng |
| P-10 | Hotspot label lưu chuỗi JSON (G7) | label = vi, i18n đúng |
| P-11 | Hotspot tọa độ không hữu hạn | hotspot bị loại, không NaN |
| P-12 | Chỉ audio en | `audio.vi = null`, `audio.en` có |
| P-13 | Không có audio | `audio = null` |
| P-14 | Thứ tự exhibit & hotspot | theo displayOrder rồi id |
| P-15 | Header `Cache-Control: no-cache` | có |
| P-16 | Response qua `ResponseInterceptor` | `{ success, data, message }` khớp FE `roomResponseSchema` |
| P-17 | Visitor không token gọi `/api/admin/exhibits/:id/preview` | 401; token không quyền → 403 (AC-36) |

### M — Phân phối file (Phase 5)
| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| M-01 | File của published revision | 200, Content-Type từ DB, nosniff, CSP sandbox, ETag |
| M-02 | File chỉ thuộc Draft | 404 |
| M-03 | Như M-02 + URL ký hợp lệ | 200, `Cache-Control: private, no-store` |
| M-04 | Chữ ký sai / exp quá hạn / exp quá xa (> TTL) / thiếu sig / sig độ dài khác | 404, không 500 |
| M-05 | Chữ ký của file A dùng cho file B | 404 |
| M-06 | Unpublish exhibit rồi tải lại | 404 |
| M-07 | Media dùng chung exhibit A (published) và B (hidden) | 200 |
| M-08 | Media is_deleted / quarantined key / key sai regex / `..%2f` / `%00` / chữ hoa | 404 |
| M-09 | `Range: bytes=0-99` | 206, 100 byte, `Content-Range` |
| M-10 | `If-None-Match` đúng checksum | 304 |
| M-11 | `HEAD` | 200 không body |
| M-12 | Request từ origin FE | có `Access-Control-Allow-Origin` |
| M-13 | File có trong DB nhưng mất trên đĩa | 404 (log error), không lộ path |
| M-14 | VTT | `text/vtt; charset=utf-8` |

### A — Admin preview (Phase 6)
| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| A-01 | Preview Draft có media | object media với URL ký tải được |
| A-02 | Draft trỏ media đã xóa | hiện media, `url: null`, `isDeleted: true` |
| A-03 | Revision detail không lộ storageKey | assert keys |
| A-04 | 401/403 trên 3 endpoint | đúng mã |

### R — Hồi quy & BR-21
| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| R-USG-01..06 | Xóa media đang ở từng slot của published revision | 409 cho cả 6 slot |
| R-USG-07 | Xóa media chỉ ở Draft | 200 (hành vi Task 8 giữ nguyên) → Submit sau đó 422 |
| R-MIG-01 | up → generate không drift → down → up | sạch |
| R-MIG-02 | down khi cột mới có dữ liệu | throw |
| R-ALL | `npm test`, `test:exhibits`, `test:media`, `test:moderation`, `test:seed` | xanh, số test ≥ baseline Phase 0 |

### E2E — bản build production (`npm run build && npm run start:prod`) + PG + JWT thật, script `curl`
Upload 6 file (Task 8 fixture generator) → PATCH gắn → preview (URL ký 200) → public file 404 → submit thiếu rights 422 → PATCH rights → submit → publish → `GET /api/rooms/:slug` có media → tải file 200/206/304 → tạo Draft v2 đổi model → public vẫn model v1 → hide → file 404 + exhibit biến mất. Ghi số bước pass/total vào PR.

### FE
- Vitest cho `roomSchema.ts`: fixture JSON lấy **từ response thật** của E2E (không tự bịa) → parse thành công; fixture có NaN/URL tương đối → fail.

## Quality gates (chạy ở `back-end/` và `front-end/`)
```bash
npm run typecheck && npm run lint && npm run build && npm test
npm run test:exhibits && npm run test:media && npm run test:moderation && npm run test:seed
MEDIA_TEST_DATABASE_URL=postgresql://postgres:pw@127.0.0.1:55432/t npm run test:media
```
Tùy chọn mạnh: mutation thủ công — cố ý bỏ một slot khỏi `REVISION_MEDIA_SLOTS`, bỏ check `ready`, bỏ `archived_at` filter → test phải đỏ (ghi 3/3 vào PR).

## Acceptance (điều kiện nghiệm thu Task 9)
- [x] Gắn/thay/tháo 6 loại media trên Draft, tải lại giữ đúng (AC-32)
- [x] Media không ready/sai kind/đã xóa bị từ chối 422 có field (AC-33 phần attach)
- [x] Sửa khi đang published không đổi revision public (AC-35)
- [x] Submit/Publish thiếu rights/transcript/subtitle/alt → 422, không đổi trạng thái (FR-97, §5.2)
- [x] Public API chỉ trả revision published hiện hành + media của nó, URL tuyệt đối (FR-68)
- [x] File media Draft/lịch sử/unpublished → 404 khi không có chữ ký (AC-36, AC-51)
- [x] Preview dùng media Draft qua URL ký (AC-32, FR-71)
- [x] Xóa media đang dùng ở bất kỳ slot published → 409 (BR-21)
