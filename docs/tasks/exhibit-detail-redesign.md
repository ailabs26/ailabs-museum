# Danh sách công việc — Thiết kế lại trang Chi tiết hiện vật (T-EXHIBIT-DETAIL-REDESIGN)

**Trạng thái:** **TODO / SẴN SÀNG TRIỂN KHAI**. Hiện chỉ có tài liệu Plan, Task và mock minh họa; chưa sửa mã nguồn và chưa ghi nhận commit hoặc kết quả test của tính năng mới.

- **Nhánh đề xuất:** `feat/public-exhibit-detail-redesign` → `dev` (**một PR**).
- **Mốc đã kiểm tra:** `dev@115e5df5125d2fc95941405f1b016fdd56eebcfb` ngày 21/11/2026; phải fetch và xác minh lại khi bắt đầu.
- **Plan:** [`../plans/exhibit-detail-redesign-plan.md`](../plans/exhibit-detail-redesign-plan.md).
- **Thiết kế:** `docs/architecture/fe/PUBLIC_PORTAL_DESIGN.md` §8 (D01).
- **Source hiện tại:** `front-end/src/pages/client/ExhibitDetailPage.tsx` và `ExhibitDetailPage.module.css`.
- **Roadmap:** triển khai sau Collection PR #207; Viewer GLB độc lập là **PR tiếp theo, không gộp vào đây**.

## 1. Mục tiêu và phạm vi nghiệm thu

Thiết kế lại `/collection/:roomSlug/exhibits/:exhibitId` theo phong cách *Contemporary Heritage Editorial*: ảnh hiện vật lớn, thông tin và CTA rõ ràng, audio/transcript/hotspots tùy chọn được sắp xếp hợp lý, công cụ cá nhân dễ sử dụng, các hiện vật khác **trong cùng phòng**, responsive/mobile/dark mode/accessibility đầy đủ. Tái sử dụng API và logic có sẵn.

### Những quy tắc phải giữ đúng sau **mọi commit**

- [ ] Dữ liệu chỉ lấy từ room/exhibit công khai đã validate; không bịa metadata lịch sử, URL ảnh/model hoặc ảnh phòng.
- [ ] Giữ link `/tour`, điều khiển Guided Tour 2D, tạm dừng/tiếp tục/thoát/recovery, favorite, report đúng `revisionId`, Reading Mode, ghi chú, recent views, audio locale/phụ đề và media credits.
- [ ] Không mở Viewer tại chỗ trong PR này: **không Canvas, Three, R3F, WebGL, request GLB khi truy cập trang chi tiết**; không hiển thị nút 3D chưa có chức năng.
- [ ] Không sửa backend runtime/API/schema/database, CMS, kiến trúc visitor stores, Homepage, Collection hoặc `/tour`.
- [ ] Hỗ trợ sáu locale, light/dark và viewport 320px; không giả định luôn có media hay bản dịch.
- [ ] Chia commit nhỏ trên **một nhánh**; không tạo `commit-plan.md`, không ghi SHA/test giả, không tự push/merge.

## 2. Bảng 15 checkpoint và commit đề xuất

| Mã | Trạng thái | Kết quả cần bàn giao | Commit đề xuất |
|---|---|---|---|
| ED-01 | [ ] | Kiểm tra nhánh, baseline, tài liệu và ảnh trước thay đổi | `docs(exhibit): plan editorial detail redesign` |
| ED-02 | [ ] | Tổ chức semantic DOM, giữ nguyên dữ liệu/hành vi | `refactor(exhibit): organize editorial detail sections` |
| ED-03 | [ ] | Breadcrumb, H1, phòng, tóm tắt và ngữ cảnh CTA | `feat(exhibit): add editorial breadcrumb and summary` |
| ED-04 | [ ] | Media Hero ảnh lớn nền charcoal, fallback trung tính | `feat(exhibit): introduce large media hero poster` |
| ED-05 | [ ] | Bố trí link phòng 3D, Guided Tour, yêu thích, báo nội dung | `refactor(exhibit): align tour and visitor actions` |
| ED-06 | [ ] | Thiết kế lại vị trí AudioPlayer, giữ một audio owner | `style(exhibit): present narration in editorial audio dock` |
| ED-07 | [ ] | Typography câu chuyện và transcript có điều kiện | `style(exhibit): refine exhibit story and transcript` |
| ED-08 | [ ] | Danh sách hotspot được sắp xếp, không phụ thuộc WebGL | `style(exhibit): refine accessible hotspot reading` |
| ED-09 | [ ] | Reading Mode, ghi chú riêng, credits | `style(exhibit): integrate reading notes and attribution` |
| ED-10 | [ ] | Tối đa 3 hiện vật khác trong cùng phòng bằng shared card/grid | `feat(exhibit): show other exhibits from current room` |
| ED-11 | [ ] | Trạng thái tải/lỗi/không tìm thấy/retry/chống stale content | `fix(exhibit): polish detail status and fallback views` |
| ED-12 | [ ] | Tablet/mobile, light/dark, reduced motion, nội dung dài | `style(exhibit): refine responsive editorial layout` |
| ED-13 | [ ] | Sáu locale, focus, tương phản, axe/accessibility | `fix(exhibit): localize and harden detail accessibility` |
| ED-14 | [ ] | Regression tương tác, audio, Guided Tour, visitor và không WebGL | `test(exhibit): cover editorial detail interaction regressions` |
| ED-15 | [ ] | Ảnh kiểm chứng, quality gates, bằng chứng và bàn giao | `docs(exhibit): record detail redesign verification` |

Checkpoint không tạo diff thật phải ghi `no-op` và lý do; **không tạo commit rỗng**. Tên commit là dự kiến, không phải bằng chứng đã thực hiện.

## 3. Checklist triển khai chi tiết

### ED-01 — Khảo sát mốc gốc và chuẩn bị tài liệu

- [ ] Chạy `git fetch origin`; xem `git branch --show-current`, `git status --short`, `git log -8`, `git diff origin/dev...HEAD`. Ghi SHA mốc gốc thực tế và bảo vệ thay đổi chưa commit của người dùng.
- [ ] Đọc lại `ExhibitDetailPage.tsx`, CSS, `PUBLIC_PORTAL_DESIGN.md` D01, style/token Collection và những test liên quan.
- [ ] Chạy baseline test `exhibit-detail`, `public-audio`, `guided-tour-mode-sync`, `visitor-*` nếu môi trường cho phép; ghi đúng PASS/FAIL và lý do. Chụp ảnh desktop/mobile light/dark trước khi sửa (không commit artifact).
- [ ] Kiểm tra staged diff, commit đúng hai file tài liệu hoặc ghi `no-op` nếu đã commit.

### ED-02 — Cấu trúc semantic của trang

- [ ] Tổ chức trang theo thứ tự **breadcrumb / media + summary / audio / story + transcript + hotspots / reading + notes + credits / hiện vật khác**. Giữ một H1 và data owner/hook hiện tại.
- [ ] Giữ nguyên key của AudioPlayer, ghi chú và visitor stores; không remount gây mất owner âm thanh hoặc dữ liệu cục bộ khi không cần thiết.
- [ ] Các trạng thái UUID/slug không hợp lệ và API lỗi phải được xử lý trước khi render cây nội dung thành công; tránh hiển thị response cũ. Kiểm regression direct-link, reload, guided controls.

### ED-03 — Breadcrumb và phần thông tin tóm tắt

- [ ] Tên phòng/hiện vật từ CMS đã localize; back link tới `/collection?room=<slug thực>`.
- [ ] H1 phong cách editorial khoảng 40–56px desktop, 32–40px mobile; tóm tắt lấy từ mô tả hiện có, **câu chuyện đầy đủ vẫn ở phía dưới**.
- [ ] Giữ document title, OpenGraph metadata, focus heading khi đổi route; test tên dài và description rỗng.

### ED-04 — Vùng Media Hero

- [ ] Media khoảng 58% trên desktop, nền charcoal, chiều cao mục tiêu 450–600px, dùng `contain` và placeholder khi thiếu ảnh. Không tự crop hoặc thay ảnh lịch sử.
- [ ] `ExhibitImage` tiếp tục có alt theo locale và fallback nếu tải lỗi. Ảnh vắng mặt không được suy đoán URL.
- [ ] Khi mở trang không có request GLB, không Canvas; slot dành cho Viewer tương lai **chỉ là cấu trúc layout, không phải nút chức năng**.

### ED-05 — Điều hướng tour và hành động khách tham quan

- [ ] CTA `/tour?room=...&exhibit=...` theo đúng `guidedTour3dPath`; giữ bước hiện tại và pause khi chuyển từ Guided Tour 2D sang 3D.
- [ ] Start/Pause/Resume/Next/Exit/recovery của `GuidedTour2DControls` không bị đổi logic; không tạo nút trùng gây hiểu nhầm.
- [ ] Favorite và Report giữ state/accessible name, `reportedRevisionId=exhibit.revisionId`; bổ sung kiểm thử keyboard.

### ED-06 — Trình bày thanh audio

- [ ] Tái sử dụng **một `AudioPlayer`** với key/source/subtitle/locale hiện tại. Có thể đổi kiểu trình bày, không bịa thời lượng/waveform.
- [ ] Không autoplay. Không có audio VI thì giữ trạng thái nút disable; audio EN chỉ khi có thật; hiển thị ghi chú ngôn ngữ fallback.
- [ ] Phát/tạm dừng/tua/phụ đề/xử lý lỗi hoạt động; khi điều hướng sang hiện vật khác hoặc rời trang, owner cũ dừng và được tháo nguồn.

### ED-07 — Câu chuyện và bản thuyết minh

- [ ] Description là **văn bản thuần**, giữ xuống dòng, cột đọc khoảng 60–72ch, không dùng HTML chưa được làm sạch.
- [ ] Không cắt câu chuyện; transcript chỉ hiển thị khi không rỗng, nhãn bản VI gốc chính xác nếu chưa dịch.
- [ ] Kiểm mô tả null/rỗng, đoạn dài, chuỗi giống XSS, không có transcript.

### ED-08 — Điểm chú ý (hotspots)

- [ ] Sort theo `(displayOrder, id)`, danh sách có accessible label, có thể thiết kế dạng hàng đánh số/đường phân cách.
- [ ] Đọc được toàn bộ nội dung dù không có WebGL; ẩn section khi không có hotspot; vẫn escape tên/nội dung để tránh XSS.

### ED-09 — Reading Mode, ghi chú và credits

- [ ] Reading Mode lưu cấu hình **100–150%**, có reset; audio sticky không che nội dung đọc.
- [ ] Notes lưu cục bộ, tự lưu, phân biệt từng hiện vật, giới hạn 2.000 ký tự, có cách phục hồi lỗi quota; không gửi dữ liệu lên server.
- [ ] Hiển thị quyền/nguồn từ `collectMediaCredits` và `MediaCreditList` khi có; không bịa tác giả/giấy phép. Giữ Favorite/Report/StorageStatus.

### ED-10 — Hiện vật khác trong cùng phòng

- [ ] Loại trừ hiện vật đang xem; sort `displayOrder`, ID; lấy tối đa 3; **không gọi API mới** hoặc gọi là gợi ý AI.
- [ ] Dùng `ExhibitGrid/ExhibitCard` cùng `room.slug` thật; từng link mở đúng hiện vật và reset media/notes owner theo ID mới.
- [ ] Khi không có hiện vật khác thì ẩn section. Test trường hợp 0/1/4 hiện vật khả dụng, thứ tự, locale và route.

### ED-11 — Trạng thái lỗi, rỗng và dữ liệu cũ

- [ ] Test UUID sai, phòng không công khai, không có hiện vật, loading, lỗi HTTP/schema, retry và refetch thất bại; không lộ dữ liệu từ hiện vật/phòng khác.
- [ ] Thiếu ảnh/audio/description/transcript/hotspots/credits phải có UI rõ ràng, không dùng nội dung giả để lấp chỗ.

### ED-12 — Responsive và đồng bộ thiết kế

- [ ] Kiểm viewport **320/390/768/1024/1280/1440px** cả light/dark; không overflow ngang, ảnh/đoạn dài đọc được, nút không che nhau, vùng tương tác lớn khi có thể (mục tiêu 44px).
- [ ] Chỉ dùng token `--public-*`, không đưa glow/glass cũ trở lại; kiểm reduced motion và chuỗi dài VI/EN/FR/ZH/KO/JA.
- [ ] Lưu screenshot trang đầy đủ cùng các trạng thái: thiếu ảnh, không audio, không section tùy chọn, URL sai, bật Reading Mode.

### ED-13 — Đa ngôn ngữ và accessibility

- [ ] Khóa UI mới (nếu có) bổ sung vào `back-end/src/database/seeds/public-ui-strings.ts` đủ **6 locale**; giữ `t()` fallback và CMS override. Không chạy seed làm đổi DB nếu chưa được yêu cầu.
- [ ] Một H1, H2 phù hợp, breadcrumb/region/alt có nhãn, focus sau điều hướng, keyboard-only, tương phản cả hai theme, kiểm axe WCAG 2.2 AA.
- [ ] NVDA/VoiceOver, zoom 200–400% và thiết bị thật phải đánh dấu **CHƯA KIỂM CHỨNG** khi chưa chạy; axe tự động không thay thế kiểm thử thủ công.

### ED-14 — Kiểm thử hồi quy tích hợp

- [ ] Tạo `front-end/tests/exhibit-detail-redesign.spec.ts` kiểm layout, hiện vật cùng phòng, không WebGL/GLB, media fallback, responsive/theme và chuyển route.
- [ ] Chạy lại test cũ: `exhibit-detail`, `public-audio`, `shared-exhibit-media`, `guided-tour-2d`, `guided-tour-mode-sync`, `visitor-*`, `public-ui-translations`, `public-a11y-axe`, `collection`, `collection-redesign`.
- [ ] Kiểm Home/Collection → Detail → `/tour`/Collection và trở lại đúng phòng; không tải Canvas/model trên Detail; giữ đúng audio/notes/favorite state.
- [ ] Nếu test trước đây phụ thuộc vị trí DOM cũ, chỉ sửa assertion khi semantic/hành vi vẫn được giữ và có giải thích. Không bỏ test để che lỗi.

### ED-15 — Kiểm tra cuối và bàn giao

- [ ] Chạy typecheck, lint, Vitest, build, focused Playwright, axe và kiểm `git diff --check`, staged diff. Ghi kết quả kèm Node/npm, lệnh, môi trường và số bài pass/fail.
- [ ] Rà ảnh desktop/mobile, Light/Dark, ảnh lỗi, transcript/hotspots tùy chọn, phòng/hiện vật khác nhau; rà qua chất lượng tiếng Việt và các locale.
- [ ] Ghi rõ phần kiểm thủ công còn thiếu (NVDA/VoiceOver, thiết bị thật, zoom, CMS live). Cập nhật bảng bằng chứng dưới đây bằng SHA và log **thực**.
- [ ] Người dùng duyệt giao diện; chỉ đề xuất title/description PR khi được hỏi. **Không tự push, tạo PR hoặc merge.**

## 4. Lệnh kiểm thử dự kiến (PowerShell)

```powershell
cd front-end
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test -- exhibit-detail-redesign.spec.ts exhibit-detail.spec.ts public-audio.spec.ts public-ui-translations.spec.ts public-a11y-axe.spec.ts shared-exhibit-media.spec.ts visitor-reading.spec.ts visitor-notes.spec.ts visitor-favorites.spec.ts visitor-recent.spec.ts public-visitor-journey.spec.ts guided-tour-2d.spec.ts guided-tour-mode-sync.spec.ts collection.spec.ts collection-redesign.spec.ts
```

`exhibit-detail-redesign.spec.ts` chưa được tạo nên **không chạy lệnh đầy đủ này trước ED-14**. Test live yêu cầu cấu hình API live; kiểm thử thiết bị thật phải thực sự có thiết bị/công cụ hỗ trợ.

## 5. Tiêu chí nghiệm thu PR

- [ ] Trang D01 có poster lớn + summary đúng phong cách Public Foundation/Collection; nút `/tour` hoạt động đúng.
- [ ] Chữ/ảnh/URL đều từ cùng hiện vật/phòng được xuất bản và validate; không bịa dữ liệu lịch sử.
- [ ] Câu chuyện đầy đủ; transcript/hotspots/credits tùy chọn đúng; tối đa ba hiện vật khác trong cùng phòng.
- [ ] Audio/phụ đề/fallback VI–EN; bàn giao trạng thái Guided Tour; Reading Mode, notes, favorites, report, recent view giữ nguyên hành vi.
- [ ] Loading/error/not-found/retry/empty đúng; không hiện stale exhibit hoặc ảnh/âm thanh sai phòng.
- [ ] Mở trang Detail không tải WebGL/Canvas/GLB và không có nút Viewer 3D giả.
- [ ] Sáu locale, light/dark, 320px và accessibility regression đạt; khoảng trống manual QA được ghi trung thực.
- [ ] Quality gates đạt hoặc có blocker chính xác; staged diff đã review; người dùng duyệt giao diện.

## 6. Bảng bằng chứng và commit thực tế

> Chỉ điền kết quả sau khi chạy. Không dùng tên commit đề xuất để suy ra SHA hoặc PASS.

| Task | Commit SHA thực / no-op | Lệnh và kết quả test | Bằng chứng UI / giới hạn | Trạng thái |
|---|---|---|---|---|
| ED-01 | — | Chưa chạy | Chưa chụp baseline | TODO |
| ED-02 | — | Chưa chạy | — | TODO |
| ED-03 | — | Chưa chạy | — | TODO |
| ED-04 | — | Chưa chạy | — | TODO |
| ED-05 | — | Chưa chạy | — | TODO |
| ED-06 | — | Chưa chạy | — | TODO |
| ED-07 | — | Chưa chạy | — | TODO |
| ED-08 | — | Chưa chạy | — | TODO |
| ED-09 | — | Chưa chạy | — | TODO |
| ED-10 | — | Chưa chạy | — | TODO |
| ED-11 | — | Chưa chạy | — | TODO |
| ED-12 | — | Chưa chạy | — | TODO |
| ED-13 | — | Chưa chạy | — | TODO |
| ED-14 | — | Chưa chạy | — | TODO |
| ED-15 | — | Chưa chạy | — | TODO |

## 7. Ghi chú bàn giao

- Hiện đã có: **Plan + Task tiếng Việt** và mock minh họa. Chưa thay đổi source code production chỉ bằng việc viết tài liệu.
- Title PR đề xuất khi hoàn thành: `feat(exhibit): redesign public exhibit detail with editorial layout`.
- **On-demand 3D Viewer là PR riêng sau bước này**. Hero Full-Bleed/3D tự xoay của Homepage vẫn hoãn.
- Mock là bản định hướng thị giác, **không phải cam kết** có đa ảnh, waveform, metadata lịch sử hoặc nút 3D tại chỗ. Chỉ triển khai các hành vi đã được xác minh trong Plan.
