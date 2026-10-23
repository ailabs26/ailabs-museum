# Public Image and Audio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this approved plan task-by-task, inline; final review độc lập. Steps use checkbox (`- [ ]`) syntax for tracking. Evidence thực tế và các điều chỉnh ghi tại task ledger.

**Goal:** Hiển thị ảnh và phát audio thật từ API trong public 2D/panel tour, giữ fallback, transcript và phụ đề đúng ngôn ngữ.

**Architecture:** Giữ GET `/api/rooms/:slug` và Zod contract; browser dùng URL media NestJS trả để tải file. Tái sử dụng renderer ảnh tour và AudioPlayer, nối vào các consumer; map track theo locale và giữ cleanup theo danh tính hiện vật. Preview CMS tiếp tục dùng signed URL qua panel chung.

**Tech Stack:** React 18, TypeScript, Mantine 7, TanStack Query, Zod, native HTMLMediaElement/TextTrack, Vitest, Playwright hiện có.

**Spec:** [public-image-audio.md — Thiết kế đề xuất để review](../tasks/public-image-audio.md#thiết-kế-đề-xuất-để-review).
**Base/branch:** `bb0127c` (`origin/dev`) → `fix/public-image-audio`.
**Status:** Frontend đã thực thi inline và kiểm chứng ngày 23/10/2026; live acceptance pending do URL file HTTP 404. Evidence, commit và coverage thực tế ở task. Checklist bước dưới đây giữ nguyên để đối chiếu kế hoạch; không dùng checkbox kế hoạch làm bằng chứng test đã chạy.

## Global Constraints

- Chỉ frontend và docs; không DB/migration/seed/auth/quyền truy cập hoặc tự upload/publish dữ liệu để test.
- Metadata qua service/http-client và schema hiện có; file ảnh/audio/VTT dùng đúng URL NestJS trả, không đoán storage URL hoặc thêm dependency.
- Giữ guard danh tính và validation API; không dùng demo fallback để che lỗi dữ liệu/network.
- Public dùng `vi`; preview CMS theo locale vi/en đang chọn. Không fallback audio sang ngôn ngữ khác; chưa thêm public language switcher.
- Không autoplay. Phát/Tạm dừng/Tiếp tục/Phát lại, Dừng về đầu, âm lượng; captions DOM có bật/tắt, transcript vẫn đọc được khi lỗi.
- Không thêm seek/playlist/auto tour/spatial audio/headset UI; không đổi GLB/camera/transform.
- Mỗi task runtime hoàn thành và kiểm chứng có một commit gồm code/tests/evidence; không commit test fail hoặc commit rỗng.
- Người dùng đã duyệt implementation; chưa push/PR/merge trong lượt này.

## Review Focus

1. Ảnh A lỗi rồi đổi sang ảnh B hoặc hiện vật B: không giữ lỗi/ảnh cũ hoặc loop request — tests 01.1.
2. Hai hiện vật dùng cùng URL audio, đóng/đổi panel khi play pending: nguồn cũ phải dừng, kết quả muộn không ghi UI mới — tests 01.2/01.3.
3. Chỉ có audio en trong public vi hoặc đổi locale CMS: không phát nhầm; transcript và subtitle cùng locale — tests 01.3.
4. Subtitle lỗi/hết hạn/cue chứa markup và cross-origin: audio/transcript vẫn dùng được, captions hiển thị text an toàn — tests 01.2/01.4.
5. Refresh lỗi/loại item, WebGL lỗi hoặc tháo Canvas khi panel còn mở: dừng đúng theo owner nội dung, không gắn audio vào vòng đời renderer — tests 01.3.

## File map và interfaces

Đường dẫn dưới đây tính từ repo root. Không tạo file/config ngoài danh sách trừ khi có bằng chứng cần cho acceptance và cập nhật plan trước.

| File | Trách nhiệm/task |
|---|---|
| `front-end/src/components/museum/ExhibitImage.tsx` → `front-end/src/shared/components/media/ExhibitImage.tsx` | 01.1: chuyển renderer có sẵn về shared, props dữ liệu đơn giản |
| `front-end/src/shared/components/data/ExhibitGrid.tsx`, `front-end/src/pages/client/ExhibitDetailPage.tsx` | 01.1 ảnh public; 01.3 player ở detail |
| `front-end/src/components/museum/MuseumCatalogue.tsx`, `ExhibitDetailPanel.tsx` (cùng thư mục) | 01.1 cập nhật import/props; 01.3 player panel |
| `front-end/src/shared/components/media/AudioPlayer.tsx` | 01.2 controls/captions và cleanup |
| `front-end/src/interfaces/museumScene.ts`, `front-end/src/helpers/mapRoomDisplays.ts`, `draftPreviewDisplay.ts` (hai helper cùng thư mục) | 01.3 track đúng locale và identity |
| `front-end/src/pages/admin/ExhibitPreviewPage.tsx` | 01.3 chỉ sửa nếu cần truyền identity/locale vào panel chung |
| `front-end/tests/public-image-audio.spec.ts`, `public-image-audio-live.spec.ts` | 01.1/01.3 và 01.4: test integration mới |
| `front-end/tests/audio-player.spec.ts`, `fixtures/audio-player.tsx`, `fixtures/audioFixture.ts` | 01.2 mở rộng harness có sẵn |
| `front-end/tests/room-contract.spec.ts`, `room-mapping.spec.ts`; `front-end/src/helpers/draftPreviewDisplay.test.ts` | 01.3 schema/mapper regression |
| `front-end/README.md`, hai tài liệu task/plan này | 01.4 hướng dẫn/evidence |

CSS chỉ sửa file `.module.css` cùng consumer khi layout ảnh/controls cần; không tạo theme/abstraction mới.

**Ảnh:** shared named export `ExhibitImage({ image, shape, color, className })`, `image?: { url: string; alt: string } | null`, `shape`/`color` giữ type props của ExhibitPreview; `className?: string`. Dùng renderer này cho mọi consumer, không kéo `MuseumDisplay` hoặc module Three.js vào trang 2D. Ảnh hỏng/null dùng ExhibitPreview; đổi URL cho phép nguồn mới tải lại. Dùng CSS của consumer cho kích thước, không ép tất cả ảnh cao 200px.

**Audio:** `AudioPlayer({ src, label, subtitleUrl, locale })`; giữ props cũ, bổ sung `subtitleUrl?: string | null`, `locale?: 'vi' | 'en'` mặc định vi. `MuseumDisplay.audio?` là track locale đã chọn hoặc null, type suy ra từ `NonNullable<RoomDetail['exhibits'][number]['audio']>['vi']`; `audioLocale?: 'vi' | 'en'`. Không copy public DTO thành một bộ types mới.

**Identity:** consumer key player bằng roomId/exhibitId/locale (nguồn audio/subtitle đổi cũng reset owner nội bộ). `mapRoomDisplays(room: RoomDetail): MuseumDisplay[]` giữ signature/public vi. `toDraftDisplay(detail, model, locale)` giữ signature, map các slot `audioVi/audioEn/subtitleVi/subtitleEn` do API admin trả. Transcript public dùng track locale, rồi `i18n[locale].transcript`; legacy `transcript` chỉ khi payload không có i18n, không lấy transcript locale khác.

## MEDIA-01.0 — Review và chốt tài liệu

**Files:** task/plan này. **Consumes:** yêu cầu người dùng + source base. **Produces:** phạm vi được duyệt.

- [x] Người dùng review hai file và chốt đề xuất/ngưỡng nghiệm thu trước code.
- [ ] Xác nhận origin/dev chưa thay đổi; nếu có upstream mới, đọc diff liên quan và cập nhật plan/base trên cùng nhánh trước runtime.
- [ ] Review/stage đúng hai file, `git diff --cached --check`, commit `docs(media): plan public image and audio integration` sau duyệt.

## MEDIA-01.1 — Ảnh API ở toàn bộ public views

**Files:** renderer ảnh và 4 consumer ở file map; `front-end/tests/public-image-audio.spec.ts`.
**Consumes:** DTO `image.url/altText` đã validate, MuseumDisplay.image hiện có. **Produces:** shared ExhibitImage theo interface trên.

- [ ] Viết tests ảnh decode ở home/collection/detail/catalogue/panel, thiếu/404/bytes hỏng có fallback, đổi sang ảnh B sau lỗi A khôi phục; kiểm alt, links và không Canvas ở 2D. Reuse `fixtures/publicRoomWithMedia.ts` bằng clone, thay URL bằng route fixture có byte ảnh decode được; không sửa fixture lịch sử thành production data.
- [ ] Chạy `npm.cmd test -- public-image-audio.spec.ts` từ frontend, ghi RED vì view còn placeholder khi API có ảnh (không dùng lỗi setup/server làm RED).
- [ ] Chuyển renderer ảnh về shared, bỏ phụ thuộc MuseumDisplay, cập nhật mọi import/caller; home dùng ExhibitGrid nên không viết riêng loader ở HomeFeaturedExhibits. Fallback giữ nhãn minh họa, ảnh thật không gắn nhãn thiếu ảnh.
- [ ] Chạy focused tests và gates chung bên dưới; review diff rồi commit dự kiến trong task. Tests đã pass từ behavior cũ ghi là regression, không ép fail giả.

## MEDIA-01.2 — Player controls và captions dùng lại

**Files:** AudioPlayer, fixture/audio tests trong file map; CSS Module trùng component nếu cần.
**Consumes:** URL audio/subtitle và locale qua props, không tự gọi API metadata. **Produces:** mở rộng props tương thích ngược, controls/captions/cleanup.

- [ ] Mở rộng tests native WAV decode hiện có: play/pause/resume, Stop `currentTime === 0`, volume native đổi, ended/replay; pending/reject/retry không kẹt; hai player chỉ một đang phát; thay/unmount khi pending và StrictMode không cập nhật nguồn cũ.
- [ ] Thêm fixture VTT 2 cue tại 0–2s và 2–4s. Test ở 1s/3s hiện cue tương ứng, toggle tắt ẩn cue, bật lại hiện cue đúng hiện tại; lỗi VTT vẫn play audio, cue markup render text và không chèn HTML. Kiểm cả cross-origin headers fixture.
- [ ] Chạy `npm.cmd test -- audio-player.spec.ts` để quan sát RED đúng hành vi mới.
- [ ] Mở rộng AudioPlayer hiện có; native element vẫn là nguồn state playback, range volume 0–1 có label/keyboard, Stop pause rồi về đầu. Giữ rejection/pending token, cleanup và retry; nguồn rỗng không request trang hiện tại.
- [ ] Dùng native `<track>` + TextTrack `mode='hidden'`/`cuechange`, render cue text trong vùng DOM và nút bật/tắt; không tự viết VTT parser. `crossOrigin='anonymous'` cho audio/track, subtitle error riêng; transcript ở consumer độc lập playback/captions. Không giả định thẻ audio có nút CC tự hiển thị chữ.
- [ ] Pause guide player cũ khi player guide khác phát bằng listener native trong document có cleanup; không ảnh hưởng video/CMS MediaPreview khác hoặc tạo store. Chạy focused suite, fixture typecheck và gates; review rồi commit.

## MEDIA-01.3 — Nối track API vào detail, tour và preview CMS

**Files:** MuseumDisplay, hai mapper, detail page/panel, preview page nếu cần, tests contract/mapping/draft/integration trong file map.
**Consumes:** shared image/player từ 01.1/01.2; public/admin media slots hiện có. **Produces:** audio trên consumer đúng identity/locale, không thêm endpoint/config.

- [ ] Viết tests contract/mapper cho vi/en/null/subtitle null, public vi chỉ có en, preview locale đổi; malformed URL bị schema từ chối, không tới DOM. Unit mapper draft giữ đúng signed URL và không sửa object đầu vào.
- [ ] Integration fixtures gồm 2 hiện vật cùng URL audio: chuyển A→B, đổi phòng/route, close panel, refresh bỏ item và play promise settle muộn phải dừng owner cũ; item mới chưa click thì paused. Transcript khác nhau không bị lẫn dù URL trùng.
- [ ] Test detail/tour có request tới đúng URL media API sau click và native currentTime tăng; trước click không tải audio. Không tải track của card khác. Thiếu audio vẫn có text/status rõ ràng; audio/subtitle lỗi giữ transcript.
- [ ] Test DOM không WebGL vẫn nghe/đọc được; tháo Canvas khi panel giữ mở không cắt audio. CMS preview chuyển vi→en đổi đúng track, nguồn cũ dừng; signed URL lỗi hiện retry/thông báo, không rơi sang public revision.
- [ ] Chạy tests liên quan trước code, ghi RED phù hợp; map track và locale, key consumer theo identity, render player trong detail/panel. Không thêm provider/audio queue. Chỉ truyền locale vào preview neighbours nếu đang render chúng bằng locale khác; giữ public vi như spec.
- [ ] Chạy unit/contract/mapping/audio/integration và gates. Kiểm keyboard, focus, target ≥44px, 320/768/1440px light/dark; không làm mất navigation/rights/fallback. Review và commit.

## MEDIA-01.4 — Regression, API thật và handoff

**Files:** `front-end/tests/public-image-audio-live.spec.ts`, README và hai tài liệu này.
**Consumes:** feature đã qua 01.3. **Produces:** evidence phân biệt fixture/live và rủi ro còn lại.

- [ ] Viết live test opt-in `MUSEUM_LIVE_TEST=1`, không intercept metadata/media hoặc mock play. Đọc list/detail public, chọn hiện vật có image/audio vi, assert request media HTTP thành công (200/206 phù hợp), image naturalWidth > 0, audio currentTime tăng và pause/resume giữ mốc. Captions chỉ chứng minh live khi có VTT, không dùng fixture để thay dữ liệu live thiếu.
- [ ] Nếu API offline hoặc không có media: report blocker cụ thể; test thiếu nội dung có annotation, không đánh đồng skip với pass nghiệm thu đầy đủ. Không seed/upload/publish/migration. Kiểm MEDIA_PUBLIC_BASE_URL/HTTPS/CORS chỉ bằng response/public config, không in secrets.
- [ ] Chạy các lệnh dưới đây tuần tự sau build; ghi exit code, số pass/fail/skip và giới hạn. Không sửa backend CORS/security để vượt test; nếu lỗi backend thật được xác định, ghi evidence và đề xuất bổ sung phạm vi cho review.
- [ ] Cập nhật README các đoạn media-null/audio standalone liên quan; phân biệt tính năng mới với giới hạn XR và public locale. Cập nhật evidence vào task, rà toàn diff và commit. Chưa tự push/PR/merge.

## Lệnh kiểm chứng khi triển khai

Từ `front-end/`, với task runtime bị ảnh hưởng:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Focused tests chọn đúng task từ danh sách (01.2 thêm typecheck fixture):

```powershell
npx.cmd tsc -p tsconfig.audio-fixture.json --pretty false
npm.cmd run test:unit -- src/helpers/draftPreviewDisplay.test.ts
npm.cmd test -- public-image-audio.spec.ts audio-player.spec.ts room-contract.spec.ts room-mapping.spec.ts
```

Production regression 01.4; standalone audio fixture chạy ở dev theo README, không tính là production browser test:

```powershell
$env:CI = '1'
$env:PLAYWRIGHT_PREVIEW = '1'
npm.cmd test -- public-image-audio.spec.ts exhibit-preview.spec.ts exhibit-detail.spec.ts collection.spec.ts home-featured.spec.ts museum-interaction.spec.ts tour-2d-fallback.spec.ts
# Backend đã chạy, nội dung có sẵn; preview live dùng localhost:5173 theo cấu hình hiện có.
$env:MUSEUM_LIVE_TEST = '1'
npm.cmd test -- public-image-audio-live.spec.ts
Remove-Item Env:MUSEUM_LIVE_TEST
Remove-Item Env:PLAYWRIGHT_PREVIEW
Remove-Item Env:CI
```

Không cần full-repo/backend gates nếu chỉ frontend/docs như dự kiến. Không đánh dấu kết quả lệnh dự kiến là đã pass. Trước mỗi commit xem status/diff/log, chỉ stage file task, review staged diff và `git diff --cached --check`.

## Tự review bản draft

- [x] Coverage: ảnh → 01.1; FR-18/19/22/94 controls/captions → 01.2; locale/transcript/identity/DOM fallback → 01.3; evidence live → 01.4.
- [x] Caller map có cả home/collection qua ExhibitGrid và preview CMS qua panel chung.
- [x] Props/type/locale thống nhất; không thêm parser/store/service suy đoán.
- [x] Năm Review Focus đều có tests được giao cho task sở hữu.
- [x] Không cấp quyền sửa dữ liệu/backend chỉ để có live evidence; test fixture không chứng minh media production tồn tại.
- [x] Người dùng review và phê duyệt trước triển khai.
