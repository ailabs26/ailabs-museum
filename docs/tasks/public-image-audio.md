# MEDIA-01 — Tích hợp ảnh và audio thật qua API

**Trạng thái:** Frontend đã triển khai và kiểm chứng; API ảnh/audio/VTT thật trả HTTP 200, live test 1/1 passed; người dùng đã kiểm thử và xác nhận OK. Không còn blocker 404 ở lần xác nhận mới nhất.
**Ngày:** 23/10/2026 (Asia/Bangkok).
**Nhánh:** `fix/public-image-audio`, từ `origin/dev` tại `bb0127c321e38c855bb210f4a865e5d79f3b473e`.
**Plan:** [public-image-audio-plan.md](../plans/public-image-audio-plan.md).
**Execution gate:** Người dùng đã duyệt và yêu cầu triển khai, sau đó cho phép push. Code đã push lên `origin/fix/public-image-audio`; chưa tạo PR hoặc merge.

## Mục tiêu và hiện trạng trước triển khai

Khách xem ảnh và nghe thuyết minh của revision đã xuất bản qua URL do NestJS cung cấp, ở giao diện 2D và panel tour. Không dùng ảnh/audio demo làm nội dung thay thế cho dữ liệu API.

Source đã kiểm tra bằng CodeGraph trên base ở trên:

| Điểm trong luồng | Hiện tại | Thay đổi cần thiết |
|---|---|---|
| `services/museum.service.ts`, `validations/roomSchema.ts` | GET `/api/rooms`, `/api/rooms/:slug`; Zod đã nhận image/audio/rights/locale | Giữ luồng và validation, thêm regression contract |
| BE `public-exhibit.mapper.ts`, `media-delivery.controller.ts` | Có image/audio vi/en/subtitle/transcript; file qua `/media/uploads/:directory/:fileName` | Dùng contract hiện có; chưa có bằng chứng cần sửa BE |
| `ExhibitGrid` (home/collection), `ExhibitDetailPage` | Luôn dùng minh họa CSS kể cả khi DTO có ảnh | Hiển thị ảnh thật, giữ fallback |
| `ExhibitImage`, `MuseumCatalogue`, `ExhibitDetailPanel` | Tour đã dùng ảnh API, lỗi ảnh có fallback | Dùng chung renderer với 2D |
| `mapRoomDisplays`, `MuseumDisplay` | Chưa truyền audio vào panel | Mang track đúng ngôn ngữ sang panel |
| `AudioPlayer` | Standalone, Phát/Tạm dừng/Tiếp tục, cleanup; consumer chỉ ở fixture | Nối trang/panel, hoàn thiện controls và captions theo SRS |
| `toDraftDisplay`, `ExhibitPreviewPage` | Preview CMS chọn vi/en, có ảnh signed URL, chưa map audio | Bảo toàn preview dùng chung panel và đúng locale |

README có đoạn cũ nói mọi media luôn null; source mới đã có contract. Chưa probe API/database live trong lượt lập kế hoạch, không kết luận dữ liệu đang có hay file đang truy cập được.

## Thiết kế đề xuất để review

### Phạm vi

- Ảnh thật ở featured trang chủ, collection, chi tiết 2D, catalogue/panel tour; fallback có nhãn khi thiếu hoặc lỗi tải. Giữ alt text, nguồn/bản quyền và navigation hiện có.
- Audio ở chi tiết 2D và panel tour DOM, kể cả khi chưa mở WebGL hoặc renderer lỗi. Không đặt player trên từng card.
- Tái sử dụng `AudioPlayer`: Phát/Tạm dừng/Tiếp tục/Phát lại, thêm Dừng về đầu và âm lượng theo FR-19. Không autoplay; tải audio theo thao tác người dùng.
- Khi có WebVTT, có nút bật/tắt phụ đề và vùng chữ đồng bộ với cue hiện hành trong DOM (FR-94). Transcript đầy đủ luôn đọc được; không dựa vào trình duyệt tự vẽ subtitle của thẻ audio.
- Public hiện chưa có bộ chọn ngôn ngữ: dùng `vi`; chỉ lấy `audio.vi`, không tự lấy `audio.en` khi thiếu vi. Preview CMS dùng locale đang chọn, đổi locale dừng nguồn cũ. Phạm vi đã được người dùng duyệt cùng plan.
- Chuyển hiện vật/phòng/route, đóng panel, thay nguồn hoặc mất dữ liệu sau refresh phải dừng và giải phóng audio cũ. Dừng 3D chỉ tháo Canvas: nếu panel DOM vẫn mở thì audio tiếp tục, vì không thuộc vòng đời renderer.
- Tối đa một player guide phát trong cùng document; khi player khác bắt đầu, pause player cũ bằng native media event/listener có cleanup. Không đồng bộ nhiều tab hoặc dựng global store/playlist.
- Preview CMS dùng signed URL đã có cho audio/subtitle đúng slot; lỗi/hết hạn báo lỗi, giữ transcript; người dùng tải lại preview để nhận URL mới. Không chuyển sang public URL của revision khác.

### Các hướng cân nhắc

1. **Đề xuất:** Hoàn thiện frontend trên contract hiện có, đưa renderer ảnh hiện tại về shared và mở rộng player sẵn có. Sửa đúng các consumer còn thiếu; không thêm dependency/endpoint.
2. Chỉ vá trang chi tiết 2D: diff nhỏ hơn nhưng home/collection vẫn bỏ qua ảnh và tour vẫn không nghe được audio, không đủ mục tiêu.
3. Viết lại pipeline media hoặc thêm endpoint riêng: chưa có bằng chứng cần thiết, làm tăng phạm vi backend/quyền truy cập.

Người dùng đã phê duyệt hướng 1 và yêu cầu triển khai.

### Ràng buộc

- Chỉ frontend và docs trong kế hoạch này. Không sửa DB/migration/seed/auth/quyền truy cập hoặc tự upload/publish dữ liệu để test.
- Metadata qua service/http-client và schema hiện có; browser tải binary ảnh/audio/VTT bằng URL NestJS trả. Không đoán URL từ storage key, không Storage SDK/credential.
- Không giảm validation hoặc bỏ guard danh tính phòng/hiện vật để render được media. Payload URL sai phải bị từ chối trước consumer.
- Không thêm thư viện, API route, public language switcher, seek/playlist/auto tour/spatial audio hay UI audio trong headset XR. DOM 2D/3D vẫn accessible.
- Không đổi hình học/GLB/camera/transform hoặc viết lại CMS MediaPreview. CMS preview 3D là consumer cần cập nhật do dùng chung panel.
- Giữ props `src`/`label` cũ của AudioPlayer hoạt động; tests standalone cũ vẫn là regression.
- Quy ước frontend thực tế ở `docs/architecture/fe/coding-conventions.md`; đường dẫn `front-end/docs/coding-conventions.md` được AGENTS/README nhắc đến hiện không tồn tại. Không tạo bản sao convention trong task này.

## Task và nghiệm thu

Mỗi task runtime gồm code, tests và evidence trong cùng commit sau kiểm chứng. Không commit test fail hoặc commit rỗng. Chi tiết bước, interfaces và lệnh ở plan.

| Task | Phụ thuộc | Deliverable | Commit dự kiến |
|---|---|---|---|
| MEDIA-01.0 | Người dùng review | Chốt plan/task trước code | `docs(media): plan public image and audio integration` |
| MEDIA-01.1 | 0 | Ảnh thật dùng chung ở public 2D/tour | `fix(media): render API images across public views` |
| MEDIA-01.2 | 1 | Player controls/captions/lifecycle | `feat(audio): complete guide controls and captions` |
| MEDIA-01.3 | 2 | Map audio và nối detail/panel/preview CMS | `fix(audio): connect API tracks to exhibit views` |
| MEDIA-01.4 | 3 | Live evidence, regression và docs | `test(media): verify public media integration` |

### MEDIA-01.0 — Duyệt tài liệu

- [x] Fetch `origin/dev`, xác nhận working tree sạch và tạo nhánh nhiệm vụ.
- [x] Đọc source, SRS và mẫu plan/task AUDIO-01, chi tiết 2D, CMS preview, public rights.
- [x] Viết thiết kế, plan và task; tự rà coverage, consumer chung và failure paths.
- [x] Người dùng duyệt phạm vi, nhất là Stop/âm lượng/captions, locale vi và preview CMS.
- [x] Review diff và commit đúng hai tài liệu (`b75309f`); chưa push/PR.

### MEDIA-01.1 — Ảnh thật và fallback

- [x] Home/collection/detail/tour render đúng URL image từ API, ảnh decode thật trong browser, alt đúng; không tải scene trên trang 2D.
- [x] Media null, 404/byte hỏng và URL ảnh đổi sau lỗi giữ fallback/khôi phục đúng; không lặp tải vô hạn, không còn ảnh hiện vật cũ sau chuyển trang.
- [x] Layout desktop/mobile, light/dark, nguồn/bản quyền và links giữ nguyên hành vi qua các regression liên quan.
- [x] Focused browser tests + typecheck/lint/build đạt, review diff và commit (`e7f76e5`).

### MEDIA-01.2 — Player guide

- [x] Native playback thật tăng `currentTime`; pause/resume giữ mốc, Stop về 0, volume đổi native value, ended cho phát lại.
- [ ] Không autoplay; play reject, byte hỏng, 404, click lặp khi pending và retry có trạng thái đúng, không unhandled rejection.
- [x] WebVTT cue đổi đúng thời gian, bật/tắt được; thiếu/lỗi subtitle không chặn audio/transcript. Cleanup source/track/listener và promise muộn được kiểm trong StrictMode.
- [x] Player thứ hai bắt đầu thì player cũ pause; keyboard và trạng thái accessible; focused tests + gates đạt trước commit.

### MEDIA-01.3 — Tích hợp API vào consumer

- [x] Public vi và mapper preview CMS vi/en lấy đúng track/transcript/subtitle; thiếu locale không phát ngôn ngữ còn lại. CMS locale được kiểm ở mức unit mapper, chưa browser admin end-to-end.
- [x] Chi tiết 2D/panel tour có player dùng URL API; null/thiếu audio báo rõ, transcript vẫn đọc được. Không tải tất cả audio trong catalogue.
- [x] Đổi item/route, đóng panel, thay nguồn hoặc refresh lỗi dừng audio cũ; test promise muộn với hai item cùng URL đạt. Đổi locale CMS được bảo vệ bằng key theo locale; kiểm ở mức mapper/code review.
- [x] DOM khi chưa mở Canvas dùng được; preview CMS mapper giữ signed URL và nguồn/bản quyền. Regression GLB, focus, loading/error/refresh đạt; không chứng nhận headset hoặc CMS browser end-to-end.
- [x] Unit/focused browser tests + gates đạt, review diff để commit integration.

### MEDIA-01.4 — Chứng minh tích hợp và bàn giao

- [x] Regression production liên quan chạy đạt; phân biệt fixture intercept với live không intercept.
- [x] API thật read-only: ảnh decode, audio play/pause/resume/Stop và captions đạt qua live browser test 1/1 passed; người dùng đã kiểm thử và xác nhận OK.
- [x] Tái kiểm các URL ảnh/MP3/VTT hiện hành: đều HTTP 200; blocker 404 của lần kiểm ban đầu đã hết. Không tự tạo hoặc sửa dữ liệu để kiểm chứng.
- [x] README bỏ các mô tả cũ về media-null/audio standalone đã được task này thay đổi; cập nhật evidence/giới hạn trong hai tài liệu.
- [x] Review toàn diff và push nhánh theo yêu cầu người dùng; chưa tạo PR/merge. PR nếu có chỉ dẫn tiếp theo sẽ base `dev`; live acceptance hiện đã đạt.

## Xác nhận mới nhất — 23/10/2026

Phần này thay thế kết luận blocker/live pending trong các mốc lịch sử bên dưới.

- Người dùng đã kiểm thử bản fix và xác nhận OK.
- Tái chạy `MUSEUM_LIVE_TEST=1 PLAYWRIGHT_PREVIEW=1 npm.cmd test -- public-image-audio-live.spec.ts --reporter=list --output=tmp/media-live-confirmation`: **1 passed (16.3 giây), 0 failed, 0 skipped**, exit 0. Không intercept API/media hoặc mock playback.
- HEAD ba URL media hiện hành: ảnh PNG **200**, MP3 **200**, WebVTT **200**. Test browser xác nhận ảnh decode, audio phát/tạm dừng/tiếp tục/Dừng và captions hiển thị.
- URL media hiện hành khác các URL ở lần kiểm 404 ban đầu; không suy ra nguyên nhân thay đổi hoặc lỗi storage hiện tại từ kết quả cũ.
- Giữ kết quả regression đã chạy: **127 unit**, **89 production + 2 corrupt-media**, **12 player StrictMode** đều pass; lần cập nhật này chỉ sửa tài liệu và chạy lại live test, không chạy lại toàn bộ suite.
- Code đã push trên `fix/public-image-audio` (implementation tới `e9e67ad`); chưa tạo PR/merge. Giới hạn kiểm thử thiết bị/headset và CMS browser end-to-end vẫn giữ nguyên.

## Evidence ở mốc lập kế hoạch

- `git fetch origin dev` thành công; HEAD/base khi tạo nhánh: `bb0127c321e38c855bb210f4a865e5d79f3b473e`.
- Chỉ thêm hai file Markdown. Chưa commit, push, PR hoặc merge.
- Chưa chạy frontend gates hoặc kiểm thử live; chưa sửa runtime. Kiểm tra tài liệu/whitespace được báo trong handoff, không suy ra tính năng đã hoạt động.

## Execution ledger — lịch sử triển khai

Các kết quả dưới đây được ghi tại từng thời điểm, không phải trạng thái hiện tại. Trạng thái live mới nhất là **1/1 passed, URL media 200** ở phần xác nhận bên trên.

- Setup: fetch lại origin/dev vẫn tại bb0127c; chỉ hai tài liệu draft là thay đổi có sẵn.
- Ruling: dùng checkout/nhánh nhiệm vụ đã được yêu cầu, không tạo worktree thứ hai; ledger đặt ngay trong task để theo mẫu repo. Script bookkeeping của skill dùng shell Unix, thay bằng checklist/evidence và git commands trong PowerShell.
- Pre-flight: 01.1 shared image props được grid/detail/catalogue/panel dùng; 01.2 props audio tương thích fixture cũ; 01.3 track nullable suy từ RoomDetail, CMS chuyển slot sang cùng interface. Không có xung đột contract.
- 01.2 RED: Stop/volume test thiếu slider/control, captions test thiếu vùng cue; sau sửa 2/2 focused GREEN, toàn audio-player 12 ca đã in kết quả pass. Typecheck/lint/build/fixture typecheck đạt; build vẫn cảnh báo chunk >500 kB có sẵn.
- Ruling: commit player độc lập trước commit consumer ảnh (01.2 không thực sự phụ thuộc 01.1); giữ tách biệt code player với mapping/consumer. 01.1/01.3 đang kiểm integration, chưa coi hoàn tất.
- 01.3 mapper RED: 2 test thiếu audio trước sửa; GREEN 10/10 mapper, toàn unit suite 126/126 đạt.
- 01.1: renderer ảnh dùng chung, home/collection/detail/catalogue/panel decode ảnh; 404 fallback và đổi URL sau lỗi được kiểm bằng browser. Typecheck/lint/build đạt; consumer audio được tách vào commit 01.3.
- Ruling: tách integration audio thành `tests/public-audio.spec.ts` và shared fixture `tests/fixtures/publicMediaApi.ts` để ảnh/audio không lặp setup; giữ `public-image-audio.spec.ts` cho ảnh và live spec cho full luồng.
- Production regression lần đầu: 84 pass/1 fail trong 85 ca; assertion exact của room-mapping thiếu roomId/credits từ trước và audio/audioLocale mới. Cập nhật đủ expected fields, không đổi sang assertion yếu hơn.
- Captions replay: thêm test Stop→Phát trong cùng cue, RED thật vì caption trống; sửa đồng bộ activeCues khi `playing`, chờ GREEN bản build mới.
- API live lần đầu (đã được thay thế bởi tái kiểm thành công): các URL JPEG/MP3/VTT khi đó trả HTTP 404; browser live positive fail ở image decode. Giữ nguyên backend/storage và dữ liệu. Đây là evidence lịch sử, không còn là blocker hiện tại.
- Final review độc lập (Gibbs): không Critical; phát hiện React 18 không nhận native track error qua JSX. Xếp thành Important để đạt acceptance lỗi VTT đã duyệt: test native VTT404 RED (audio phát nhưng thiếu warning), sửa listener trực tiếp có cleanup, chờ GREEN.
- Reviewer declined tại thời điểm review: live delivery (404), kết quả suite đang chạy hoặc thiết bị/CMS browser chưa test. Ruling khi đó: giữ live acceptance pending tới khi có evidence mới; tái kiểm phía trên đã xác nhận live pass. Không tuyên bố thiết bị/headset/CMS end-to-end đã được kiểm.
- Final production: **89/89 passed (3.9 phút)** qua 10 spec liên quan trên build mới; thêm **2/2** test corrupt bytes đạt. Output: `front-end/tmp/media-production-final`, `tmp/media-corrupt` (ignored, chỉ local).
- Captions Stop/replay và VTT404 đều RED→GREEN trong suite final. Final unit **127/127**, typecheck/lint/build và fixture typecheck exit 0; cảnh báo bundle >500 kB vẫn còn.
- Standalone player trên Vite dev, React StrictMode: **12/12 passed (36 giây)** ở `tmp/audio-strict-final`; pause/resume/replay, error/retry, source/unmount/promise cũ, keyboard, reflow, nhiều player, Stop/volume và captions đều đạt.
- Không có deferred minor runtime sau fix track error. Chưa kiểm điện thoại/headset/GPU thật hoặc browser CMS locale switching; toàn bộ test sản phẩm liên quan chạy Edge/SwiftShader và fixture.
- Commits: `b75309f` docs; `da3a87c` player; `e7f76e5` ảnh; `71a9a6b` nối audio và final fixes/tests. Commit bàn giao cuối chứa README, plan status, live opt-in test và evidence.
- Live spec có readiness HEAD: nếu URL file public trả 404 thì annotate `blocker` và skip (không tính pass). Đây là nhánh kiểm tra lỗi môi trường, không phải kết quả mới nhất. Lần browser đầu tiên đã FAIL do ảnh không decode; tái kiểm hiện tại đã pass đầy đủ.
- Mốc live trước tái kiểm: **1 skipped** vì readiness HTTP404, output `front-end/tmp/media-live-final`; tại mốc này chưa push/PR/merge. Evidence đó đã được thay thế bởi **1 passed, 0 skipped** ở `tmp/media-live-confirmation`. Backend, dependencies và env không có diff trong nhiệm vụ.
