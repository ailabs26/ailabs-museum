# Kế hoạch triển khai — Thiết kế lại trang Chi tiết hiện vật

> **Hướng dẫn cho agent triển khai:** Đây là kế hoạch dành riêng cho **PR tiếp theo của Public Portal**. Trước khi bắt đầu, đọc code thực tế và kiểm tra lại `origin/dev`. Chia thay đổi thành những phần nhỏ, có thể review độc lập; chạy kiểm thử liên quan trước và sau mỗi thay đổi; xem lại phần mã đã stage và ghi bằng chứng thực tế vào file Task đi kèm. **Không tự ghi commit, ảnh chụp hay kết quả kiểm thử chưa xảy ra.**

## 0. Thông tin tài liệu

| Mục | Thông tin |
|---|---|
| Tính năng | Thiết kế lại trang Chi tiết hiện vật công khai — D01 |
| Trạng thái | **SẴN SÀNG TRIỂN KHAI — CHƯA BẮT ĐẦU** |
| Đường dẫn trang | `/collection/:roomSlug/exhibits/:exhibitId` |
| Nhánh đề xuất | `feat/public-exhibit-detail-redesign` |
| Nhánh đích của PR | `dev` |
| Mốc `dev` đã xác minh ngày 21/11/2026 | `115e5df5125d2fc95941405f1b016fdd56eebcfb` — merge PR #207, Collection Redesign |
| Thiết kế chuẩn | `docs/architecture/fe/PUBLIC_PORTAL_DESIGN.md` §8 (D01), kết hợp design tokens và quy tắc tích hợp của Public Portal |
| Tài liệu liên quan | `docs/plans/collection-redesign-plan.md`, `docs/plans/homepage-redesign-plan.md`, `docs/architecture/fe/coding-conventions.md` |
| Theo dõi công việc | [`../tasks/exhibit-detail-redesign.md`](../tasks/exhibit-detail-redesign.md) |

**Mục tiêu:** Thiết kế lại **giao diện 2D của trang chi tiết hiện vật** theo phong cách *Contemporary Heritage Editorial* đã triển khai cho Header/Footer, Homepage và Collection. Trang phải giống một trang triển lãm được biên tập chỉn chu: ảnh hiện vật lớn, câu chuyện dễ đọc, thuyết minh âm thanh và bản thuyết minh (nếu có), điểm chú ý, nguồn/bản quyền, công cụ dành cho khách tham quan. **Giữ nguyên dữ liệu và hành vi đang hoạt động. Không xây dựng WebGL Viewer tại chỗ trong PR này.**

### Hiện trạng đã đối chiếu với mã nguồn

Đã kiểm tra các thành phần trên `dev` tại SHA nêu trên:

- `front-end/src/pages/client/ExhibitDetailPage.tsx` đã hoạt động và lấy dữ liệu qua `useMuseumRooms(roomSlug)`; kiểm tra UUID bằng `z.string().uuid()`; sử dụng `localizeExhibit`, `ExhibitImage`, `AudioPlayer`, `GuidedTour2DControls`, `ReadingControls`, `VisitorNotes`, `FavoriteButton`, `PublicReportModal`, `MediaCreditList` và `useSocialMeta`.
- `front-end/src/pages/client/ExhibitDetailPage.module.css` vẫn sử dụng nhiều token `--aura-*`, hiệu ứng glow/glass và bố cục hai cột nhỏ, chưa cùng ngôn ngữ thị giác với Collection mới.
- `front-end/src/pages/client/CollectionPage.module.css` đã dùng token `--public-*`, nền charcoal, khoảng nội dung 1360px, responsive và focus states. Đây là **mẫu tham chiếu phong cách**, không phải file CSS để import trực tiếp.
- `ExhibitImage.tsx` hiển thị ảnh được xuất bản bằng `object-fit: contain` và dùng placeholder trung tính nếu thiếu ảnh hoặc tải thất bại. Không được nhầm URL model với URL ảnh.
- Nút “Xem trong không gian 3D” hiện **đi tới `/tour` thông qua `guidedTour3dPath`**, không mở model 3D trên trang chi tiết. Phải duy trì đúng hành vi và mô tả này.
- Audio dùng `resolveAudioLocale`: ưu tiên EN khi có và ngôn ngữ UI là EN; trường hợp khác fallback sang tiếng Việt với thông báo thích hợp. `AudioPlayer` đang sở hữu phát/tạm dừng/tua/phụ đề/trạng thái và dọn tài nguyên khi unmount.
- Trang đã hiển thị description, transcript tùy chọn, hotspots được sắp xếp, media credits, yêu thích, báo nội dung, tùy chọn đọc, ghi chú cục bộ theo hiện vật và ghi nhận lịch sử xem gần đây. Không cần bổ sung API, lưu trữ hay hệ thống gợi ý.
- Các bộ test hồi quy liên quan hiện có: `exhibit-detail.spec.ts`, `exhibit-detail-live.spec.ts`, `public-audio.spec.ts`, `public-ui-translations.spec.ts`, `public-a11y-axe.spec.ts`, `guided-tour-2d.spec.ts`, `guided-tour-mode-sync.spec.ts`, `visitor-reading.spec.ts`, `visitor-notes.spec.ts`, `visitor-favorites.spec.ts`, `visitor-recent.spec.ts`, `visitor-regression.spec.ts`, `public-visitor-journey.spec.ts`, `shared-exhibit-media.spec.ts`.

**Bắt buộc kiểm tra lại** tên file, props, DTO, đường dẫn và test khi bắt đầu triển khai vì `dev` có thể đã thay đổi. Việc viết plan không đồng nghĩa đã chạy kiểm thử phiên bản giao diện mới.

## 1. Phạm vi triển khai

### 1.1. Bao gồm

1. Bố trí lại **trang chi tiết 2D**: breadcrumb, khu trưng bày ảnh lớn + tóm tắt, thuyết minh âm thanh, câu chuyện, transcript, hotspots, Reading Mode, nguồn/bản quyền, ghi chú và hiện vật khác trong cùng phòng.
2. Đồng bộ màu sắc, kiểu chữ, khoảng cách, nút, giao diện sáng/tối và responsive với Public Design System đang có.
3. Tái sử dụng DTO công khai đã validate, bản dịch, trạng thái khách tham quan, chức năng Guided Tour và thành phần media; không gây hồi quy hành vi.
4. Chỉ bổ sung những khóa dịch UI thực sự cần thiết, đảm bảo đủ sáu ngôn ngữ **vi/en/fr/zh/ko/ja**, tôn trọng override từ CMS và cơ chế fallback hiện tại.
5. Bổ sung kiểm thử Playwright có trọng tâm, ảnh xác minh giao diện và bằng chứng kiểm thử cho trạng thái lỗi, điều hướng, media, accessibility.

### 1.2. Không nằm trong PR này

- **On-demand 3D Viewer:** không import Three/R3F, không tạo Canvas, không tải GLB và **không hiển thị nút “Xem mô hình 3D” tại chỗ chưa hoạt động**. Đây là PR riêng tiếp theo; chỉ chuẩn bị vùng media phù hợp để tích hợp sau.
- Hero Full-Bleed hoặc 3D tự xoay trên Homepage; sửa Collection, Admin, CMS, `/tour`, engine/camera 3D, storage, database, API, schema hoặc service gọi mạng.
- Viết lại engine audio, schema track đa ngôn ngữ, đồng bộ phụ đề, quy trình dịch transcript hoặc kiểm duyệt nội dung backend.
- Bịa metadata lịch sử (niên đại, xuất xứ, chất liệu, tác giả, kích thước), đánh giá người dùng, thông tin gợi ý AI, âm thanh/biểu đồ sóng giả, ảnh không có quyền sử dụng hoặc model giả.
- Thêm thư viện phụ thuộc mới hoặc sửa toàn bộ global theme chỉ để làm đẹp trang này.

### 1.3. Quy định nhánh và commit

- Trước khi tạo nhánh: `git fetch origin`, kiểm tra worktree sạch, SHA `origin/dev`, các PR mới merge và thay đổi của người dùng. Nếu `dev` khác SHA trong tài liệu thì cập nhật mốc thực tế và rà soát lại phạm vi; không tự reset hoặc ghi đè code.
- **Một nhánh `feat/public-exhibit-detail-redesign`, một PR vào `dev`.** Mã `ED-*` là checkpoint/commit nhỏ, **không phải PR**. Chỉ sử dụng hai file Plan/Task, **không thêm `commit-plan.md`**.
- Không tạo commit rỗng. Công việc không cần thay đổi file thì ghi `no-op` kèm lý do trong Task.
- Không tự push, tạo PR hoặc merge khi chưa được người dùng yêu cầu.
- Không stage `.env`, log, ảnh chụp kiểm thử, traces hoặc asset tạm. Trước mỗi commit phải chạy `git diff --check`, kiểm tra `git diff --cached` và chỉ stage các file thuộc checkpoint.

## 2. Định hướng thiết kế và trải nghiệm

**Phong cách:** *Contemporary Heritage Editorial* — nền kem/ngà `--public-bg`, bề mặt `--public-paper`, nền xanh than `--public-charcoal`, xanh rừng `--public-forest`, nhấn đồng `--public-bronze`, heading serif `--public-font-display`. Không dùng gradient neon, glow mạnh, glassmorphism hay animation trang trí rườm rà.

**Ưu tiên thứ bậc thị giác:** hiện vật là trọng tâm; nội dung dễ đọc; nút đi vào phòng 3D phải rõ; audio và công cụ cá nhân luôn sử dụng được nhưng không lấn át ảnh và câu chuyện.

### 2.1. Bố cục desktop từ khoảng 1200px

```text
HEADER PUBLIC (đã có)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ BỘ SƯU TẬP / <Tên phòng có thật> / <Tên hiện vật có thật>                         │
├──────────────────────────────────────────────┬─────────────────────────────────────────┤
│ MEDIA HERO khoảng 58%                        │ TÓM TẮT khoảng 42%                     │
│ ┌──────────────────────────────────────────┐ │ Nhãn: TÊN PHÒNG                       │
│ │ Ảnh hiện vật lớn / placeholder           │ │ H1: TÊN HIỆN VẬT                     │
│ │ Nền charcoal, ảnh contain                │ │ Đoạn giới thiệu lấy từ CMS            │
│ │ Không crop mất phần hiện vật             │ │ [Khám phá trong phòng 3D → /tour]     │
│ └──────────────────────────────────────────┘ │ [Yêu thích] [Báo nội dung]            │
│                                              │ [Bắt đầu/Tiếp tục tour 2D]            │
├──────────────────────────────────────────────┴─────────────────────────────────────────┤
│ THUYẾT MINH ÂM THANH — dùng AudioPlayer hiện có; trạng thái thiếu audio trung thực      │
├───────────────────────────────────────────────┬────────────────────────────────────────┤
│ CÂU CHUYỆN HIỆN VẬT (60–72ch)                  │ TÙY CHỌN ĐỌC                         │
│ Mô tả đầy đủ từ CMS                           │ Các công cụ hỗ trợ nếu có             │
│ BẢN THUYẾT MINH (nếu có)                       │                                        │
│ ĐIỂM CHÚ Ý (nếu có)                            │                                        │
├───────────────────────────────────────────────┼────────────────────────────────────────┤
│ NGUỒN & BẢN QUYỀN (nếu có)                     │ GHI CHÚ RIÊNG (lưu trên trình duyệt)  │
├───────────────────────────────────────────────┴────────────────────────────────────────┤
│ HIỆN VẬT KHÁC TRONG CÙNG PHÒNG — tối đa 3 thẻ dùng shared ExhibitGrid/Card             │
└────────────────────────────────────────────────────────────────────────────────────────┘
FOOTER PUBLIC (đã có)
```

### 2.2. Tablet và mobile

- **Tablet 768–1199px:** giữ hai cột nếu chiều rộng thực sự đủ (media khoảng ≥400px; summary khoảng ≥320px); nếu không đủ phải xếp dọc để tránh nút và chữ bị ép.
- **Mobile ≤767px:** thứ tự ưu tiên: breadcrumb → tiêu đề/ngữ cảnh → ảnh → CTA/visitor actions → audio → story → transcript → hotspots → notes/credits → hiện vật khác. Media rộng toàn khung, không có scroll ngang trang; nút tự xuống hàng.
- **320px và zoom 200–400%:** chữ dài ở cả sáu ngôn ngữ không đẩy layout ra ngoài; trạng thái thông báo/focus còn sử dụng được. Không ghim player che nội dung trên màn hình hẹp.
- **Dark mode:** dùng `--public-*` có biến thể màu của layout; đảm bảo màu chữ, nền, đường viền đủ tương phản ở cả hai mode.

## 3. Đặc tả từng khu vực

### D01-1 — Breadcrumb và tóm tắt

- Breadcrumb có tên phòng, tên hiện vật đúng dữ liệu công khai; đường dẫn về phòng dùng `/collection?room=<slug>` với `URLSearchParams`, không tự suy diễn route khác.
- Dùng **một H1** cho tên hiện vật. Cỡ chữ mục tiêu 40–56px desktop, 32–40px mobile; không cắt chữ dài một cách gây mất nghĩa. Tên phòng là ngữ cảnh/nhãn editorial.
- Tóm tắt tối đa khoảng 2–4 dòng từ `exhibit.description` đã localize. **Đây chỉ là đoạn trích để giới thiệu**, nội dung đầy đủ phải có ở mục “Câu chuyện hiện vật”, không sửa dữ liệu gốc.
- Nếu description trống, dùng cách diễn đạt hiện có (ví dụ `ui.common.no-description`) hoặc bỏ đoạn ngắn; không tự viết sự kiện lịch sử.
- Giữ `usePageTitle`, `useSocialMeta` và cơ chế đưa focus về heading khi đổi route.

### D01-2 — Media Hero dạng poster

- Media nằm bên trái khoảng **55–60%**, cao mục tiêu **450–600px desktop**, khoảng **380–480px tablet**, **300–400px mobile**. Có nền charcoal nhưng hình hiện vật phải đầy đủ, dùng `object-fit: contain`, tránh crop bắt buộc.
- Tái sử dụng `ExhibitImage`, `localizedAltText`, placeholder shape/color và `MediaCreditList` khi có thông tin quyền. Nếu ảnh thiếu/hỏng phải hiển thị trạng thái trung tính đúng sự thật.
- Không thêm overlay quảng cáo tính năng chưa có; giữ nút **đi sang `/tour`** như hiện tại. Không tạo nút giả mở viewer tại chỗ.
- Dựng ranh giới thành phần media ổn định (có thể tách component trình bày nếu cần), để PR Viewer sau chỉ thay poster bằng viewer mà không viết lại phần story.
- Khi mở trực tiếp trang Detail: **không import Three, không khởi tạo Canvas, không fetch GLB, không tự kiểm tra WebGL vì mục đích trang trí**. Viết test theo dõi network để xác nhận.

### D01-3 — Nút hành động và Guided Tour

- CTA chính sử dụng `guidedTour3dPath(detail.slug, exhibit.id)` hoặc bước tour đang hoạt động tùy trạng thái `tour2d`, đồng thời giữ `tour2d.pause` khi chuyển sang 3D.
- Giữ nguyên `GuidedTour2DControls`, “Bắt đầu từ hiện vật này”, tạm dừng/tiếp tục/thoát và thông báo recovery. Không nhân bản state machine vào component mới chỉ để đổi UI.
- Giữ `FavoriteButton`, `PublicReportModal` gắn `reportedRevisionId=exhibit.revisionId`, `VisitorStorageStatus` và khả năng kích hoạt bằng bàn phím.
- Tránh hiện nhiều CTA cùng tên nhưng hành vi khác nhau khi đang trong Guided Tour.

### D01-4 — Thuyết minh âm thanh

- Dùng **một AudioPlayer** với props/key hiện tại theo phòng, hiện vật và audio locale; không tạo hai audio owners cùng lúc.
- Trình bày dạng thanh/card nền ngà dưới Hero; giữ các điều khiển phát/tạm dừng/tua/phụ đề/trạng thái **đã có**. Tuyệt đối không autoplay.
- Giữ `resolveAudioLocale`, ghi rõ khi ngôn ngữ audio khác giao diện; chỉ chọn EN khi thật sự có track EN. Giữ thông báo transcript tiếng Việt gốc nếu chưa có bản dịch.
- Nếu không có audio: giữ trạng thái rỗng/nút bị vô hiệu hóa có nhãn tiếp cận như code hiện tại. Không bịa thời lượng, waveform, hoặc nút download chưa có.
- Khi rời trang, đổi hiện vật hoặc audio locale, owner cũ phải pause/unmount và giải phóng nguồn; không phát âm thanh nền ngoài ý muốn.

### D01-5 — Câu chuyện, transcript và hotspots

- Vùng đọc chính rộng khoảng **60–72ch**, chữ 16–18px, line-height khoảng 1.7–1.85. Giữ xuống dòng bằng `white-space: pre-wrap` hoặc đoạn văn thuần an toàn; **không render HTML** từ CMS.
- `description` rỗng phải dùng fallback có thật `ui.common.no-description`. Phần “Câu chuyện” phải hiển thị **đầy đủ** (không áp dụng line clamp của tóm tắt).
- Chỉ render `localizedTranscript` khi có nội dung; hiển thị đúng cảnh báo khi đang dùng bản VI gốc. Không tuyên bố phụ đề/audio trùng ngôn ngữ khi thực tế không đúng.
- Hotspots đọc được hoàn toàn dưới dạng văn bản, không yêu cầu WebGL; sort tăng dần theo `(displayOrder, id)`, không chèn HTML không an toàn. Có thể thiết kế thành các hàng editorial có đánh số.
- Không có transcript, hotspot hoặc credits thì ẩn section tương ứng; không tạo card rỗng chỉ để lấp chỗ.

### D01-6 — Reading Mode, ghi chú và nguồn

- Giữ `ReadingControls`: tùy chọn đọc được lưu, tăng/giảm cỡ chữ **100–150%**, reset hoạt động. Reading Mode cần cột văn bản vừa phải, audio sticky không che câu chuyện.
- Giữ `VisitorNotes`: lưu cục bộ trên trình duyệt, tự lưu, tối đa **2.000 ký tự**, cách ly theo `(roomId, exhibitId)`, xử lý lỗi quota và khôi phục focus. **Không gửi ghi chú lên backend** hoặc vào thẻ chia sẻ mạng xã hội.
- Chỉ hiển thị `MediaCreditList` lấy từ `collectMediaCredits` khi dữ liệu có thật; không bịa tác giả/giấy phép/nguồn. Bố trí dễ tìm nhưng không lấn át nội dung.
- Sau khi đổi layout, chức năng favorite, report và trạng thái lưu trữ vẫn phải truy cập được.

### D01-7 — Hiện vật khác trong cùng phòng

- Lấy từ **`detail.exhibits` đã validate của phòng hiện tại**; loại `exhibit.id` đang xem, sort theo `displayOrder`, dùng ID phân định nếu trùng; tối đa **3 hiện vật khác**.
- Nhãn phải chính xác **“Hiện vật khác trong cùng phòng”** (dịch đủ locale), không gọi là đề xuất AI hoặc cùng niên đại nếu không có dữ liệu.
- Tái sử dụng `ExhibitGrid/ExhibitCard` với `room.slug` có thật; không gọi thêm API hoặc tạo trùng hiện vật.
- Nếu không có hiện vật khác thì ẩn cả section. Khi click sang hiện vật khác phải cập nhật route, recent view, audio owner, ghi chú theo ID mới.

### D01-8 — Trạng thái, giao diện và khả năng tiếp cận

- Giữ nguyên kiểm tra UUID, phòng không tồn tại/chưa công khai, hiện vật không tìm thấy, dữ liệu đang tải, response sai schema, lỗi HTTP, retry và guard chống dữ liệu cũ. Refetch lỗi không được hiển thị nhầm nội dung cũ.
- Sử dụng token `--public-*` trong CSS Module thay vì `--aura-gradient-accent`, `--aura-glow-emerald`, `--aura-glass-*`. Dùng display/body fonts chuẩn, content tối đa 1360px và gutter của Public Layout; không sửa global CSS chỉ cho trang này.
- Semantic HTML: một H1; H2 cho story/transcript/hotspots/credits/hiện vật khác; breadcrumb `nav` có nhãn, đường dẫn có accessible name, audio region rõ ràng, focus ring và `aria-live` khi thông báo lỗi.
- Sáu locale **vi/en/fr/zh/ko/ja**, light/dark; đối chiếu tương phản **WCAG 2.2 AA**, hỗ trợ `prefers-reduced-motion`. Không bắt buộc entrance animation.
- Axe/Playwright là kiểm thử tự động; **không được coi thay thế** NVDA/VoiceOver trên thiết bị thật, mobile thật, zoom 200–400% hoặc kiểm tra nội dung media từ CMS live.

## 4. Danh sách file dự kiến thay đổi

| File | Thao tác | Trách nhiệm |
|---|---|---|
| `front-end/src/pages/client/ExhibitDetailPage.tsx` | **Sửa** | Sắp xếp breadcrumb, Hero, tóm tắt, audio, story, visitor và hiện vật khác; giữ data owner và hooks |
| `front-end/src/pages/client/ExhibitDetailPage.module.css` | **Sửa** | Style editorial riêng trang, responsive, dark, focus, reduced motion |
| `front-end/src/shared/components/media/ExhibitImage.tsx` | **Tái sử dụng**; chỉ sửa khi có bằng chứng cần thiết | Poster và fallback, không import 3D |
| `front-end/src/shared/components/data/ExhibitGrid.tsx` | **Tái sử dụng** | Hiện vật cùng phòng, không thay contract card |
| `front-end/src/shared/components/media/AudioPlayer.tsx` | **Tái sử dụng** | Không thay hành vi phát, phụ đề, cleanup |
| `front-end/src/pages/client/visitor/{ReadingControls,VisitorNotes,FavoriteButton}.tsx` | **Tái sử dụng** | Giữ quy tắc state và lưu cục bộ |
| `back-end/src/database/seeds/public-ui-strings.ts` | **Chỉ bổ sung khóa nếu cần** | Nhãn UI cho cả 6 locale; chỉ seed, không đổi backend runtime/schema |
| `front-end/tests/exhibit-detail-redesign.spec.ts` | **Tạo mới** | Layout, hiện vật cùng phòng, media tùy chọn, không WebGL, theme, responsive |
| `front-end/tests/exhibit-detail.spec.ts` | Chỉ mở rộng nếu cần | Kiểm thử route/data/error hiện có |
| `front-end/tests/public-ui-translations.spec.ts` | Mở rộng nếu thêm key | Sáu locale và fallback |
| `front-end/tests/public-a11y-axe.spec.ts` | Tái sử dụng | WCAG của trang Detail với cả hai theme |
| `docs/plans/exhibit-detail-redesign-plan.md` | **Tạo mới** | Kế hoạch này |
| `docs/tasks/exhibit-detail-redesign.md` | **Tạo mới** | Checklist, bằng chứng, commit thực tế |

Chỉ tách component nếu giúp giảm độ phức tạp và có props rõ ràng; có thể dùng `ExhibitDetailHero.tsx` cùng thư mục trang cho phần trình bày thuần túy. **Không tạo kiến trúc app/store mới và không nhân bản hooks/services hiện có.**

## 5. Kế hoạch triển khai và commit nhỏ

Các commit message dưới đây là **đề xuất**, được điều chỉnh theo diff thực tế. Mỗi checkpoint có test liên quan và cập nhật Task; **chỉ một PR**, không tạo `commit-plan.md`.

| Mã | Công việc | Commit đề xuất |
|---|---|---|
| ED-01 | Xác minh `origin/dev`, chụp baseline, viết Plan/Task | `docs(exhibit): plan editorial detail redesign` |
| ED-02 | Tổ chức lại DOM/semantic sections, giữ hook và data owner | `refactor(exhibit): organize editorial detail sections` |
| ED-03 | Breadcrumb, ngữ cảnh phòng, tiêu đề và tóm tắt | `feat(exhibit): add editorial breadcrumb and summary` |
| ED-04 | Media Hero poster lớn nền charcoal, fallback ảnh | `feat(exhibit): introduce large media hero poster` |
| ED-05 | Bố trí CTA `/tour`, Guided Tour, Favorite và Report | `refactor(exhibit): align tour and visitor actions` |
| ED-06 | Thiết kế thanh thuyết minh, giữ nguyên AudioPlayer | `style(exhibit): present narration in editorial audio dock` |
| ED-07 | Typography câu chuyện và transcript tùy chọn | `style(exhibit): refine exhibit story and transcript` |
| ED-08 | Hotspot thành danh sách dễ đọc/tiếp cận | `style(exhibit): refine accessible hotspot reading` |
| ED-09 | Reading Mode, ghi chú và thông tin nguồn | `style(exhibit): integrate reading notes and attribution` |
| ED-10 | Tối đa 3 hiện vật khác trong cùng phòng | `feat(exhibit): show other exhibits from current room` |
| ED-11 | Loading/error/not-found/fallback và chống stale data | `fix(exhibit): polish detail status and fallback views` |
| ED-12 | Responsive 320–1440, light/dark, reduced motion | `style(exhibit): refine responsive editorial layout` |
| ED-13 | Dịch sáu ngôn ngữ, focus, contrast và a11y | `fix(exhibit): localize and harden detail accessibility` |
| ED-14 | Regression về audio, tour, visitor và không WebGL | `test(exhibit): cover editorial detail interaction regressions` |
| ED-15 | Visual QA, quality gates, bằng chứng, bàn giao | `docs(exhibit): record detail redesign verification` |

### Quy trình bắt buộc cho từng checkpoint

1. Kiểm tra source, test, `git status` trước thay đổi; không ghi đè các công việc khác.
2. Viết/chỉnh test chỉ khi hành vi/DOM contract thay đổi; chạy test trước để có baseline, nếu test đã pass thì ghi trung thực là regression evidence.
3. Triển khai phạm vi nhỏ, chạy focused test và lint/typecheck phù hợp.
4. Chạy `git diff --check`, xem từng file, staged diff và tài liệu Task.
5. Commit chỉ khi thay đổi đã được kiểm chứng; không dùng `git add .`, không commit test lỗi. Nếu checkpoint không cần diff, ghi `no-op` và lý do.

## 6. Ma trận kiểm chứng

| Nhóm | Bằng chứng cần có |
|---|---|
| Giao diện | 1440px desktop, 1024px tablet, 390/320px mobile; light/dark; có/thiếu ảnh; không có nội dung tùy chọn; tiêu đề/mô tả dài |
| Chức năng | Mở trực tiếp URL và reload; Collection → Detail → Collection đúng phòng; đi `/tour`; bắt đầu/tiếp tục/dừng Guided Tour; Favorite/Report đúng revision; ghi chú lưu; Reading Mode lưu cài đặt |
| Âm thanh | Play/pause/seek/subtitles của player có sẵn; fallback VI/EN; không autoplay; dừng và giải phóng owner khi chuyển trang; không có audio, lỗi media, retry |
| Nội dung | Tên, phòng, mô tả, ảnh/alt và link cùng một hiện vật công khai; hotspots đúng thứ tự; credits đúng; hiện vật khác 0/1/3; escape text và link đúng |
| Lỗi | UUID/slug sai, hiện vật không có, API sai schema, lỗi HTTP, retry, refetch lỗi, response cũ; không hiện sai dữ liệu phòng/hiện vật |
| Accessibility | Một H1; heading hợp lý; breadcrumb có nhãn; keyboard/focus; axe WCAG 2.2 AA cả light/dark; reduced motion; nêu rõ NVDA/VoiceOver chưa kiểm nếu chưa thực hiện |
| Hiệu năng | Không Canvas/Three/WebGL/GLB khi vừa mở Detail; poster hiển thị nhanh; audio không tự phát; ảnh lỗi/chậm không làm layout nhảy đáng kể |

### Lệnh kiểm thử frontend (PowerShell)

```powershell
cd front-end
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test -- exhibit-detail-redesign.spec.ts exhibit-detail.spec.ts public-audio.spec.ts public-ui-translations.spec.ts public-a11y-axe.spec.ts shared-exhibit-media.spec.ts visitor-reading.spec.ts visitor-notes.spec.ts visitor-favorites.spec.ts visitor-recent.spec.ts public-visitor-journey.spec.ts guided-tour-2d.spec.ts guided-tour-mode-sync.spec.ts collection.spec.ts collection-redesign.spec.ts
```

- `exhibit-detail-redesign.spec.ts` **chưa tồn tại**; chỉ đưa vào lệnh sau khi tạo test đó.
- Test Playwright trên Vite dev và production preview có thể khác nhau ở fixture URL; nếu lỗi phải ghi đúng môi trường, **không xóa test cũ chỉ để được pass**.
- `exhibit-detail-live.spec.ts` cần API live và cấu hình opt-in thích hợp. Test fixture **không thay thế** kiểm tra ảnh và quyền sử dụng media CMS thực tế.
- Chỉ ghi PASS cho NVDA/VoiceOver, mobile thật, zoom trình duyệt, LCP/CLS khi có bằng chứng; nếu không có, ghi **CHƯA KIỂM CHỨNG**.

## 7. Quy ước mock giao diện

Mock đi kèm là **hình minh họa ý tưởng**, không phải ảnh chụp UI đã code hoặc bằng chứng về tài sản CMS thật:

- Giao diện desktop phong cách editorial, nền ngà, xanh than/xanh rừng/đồng, header Aura và heading serif; có thể là ảnh trang dài.
- Breadcrumb dẫn về Collection/phòng; media khoảng 58% và **một ảnh minh họa hiện vật**; summary bên cạnh gồm tên phòng, H1, đoạn trích và CTA **“Khám phá trong phòng 3D” dẫn tới `/tour`**, kèm favorite/report.
- Dưới Hero: một thanh AudioPlayer đối với fixture thật sự có audio; câu chuyện, transcript/hotspots tùy chọn, ghi chú, credits, tối đa ba hiện vật khác cùng phòng.
- **Không có điều khiển orbit/zoom của viewer 3D tại chỗ, không có nút “Xem mô hình 3D” chưa hoạt động.** Không đưa chi tiết lịch sử chưa xác thực như niên đại/chất liệu/kích thước thành dữ liệu CMS thật. Hình mock có thể dùng ảnh đại diện minh họa nhưng phải chú thích khi bàn giao.
- Nếu mock hình ảnh thể hiện gallery nhiều ảnh, tab, chọn phụ đề ngôn ngữ tùy ý, trường metadata hay nút lưu ghi chú riêng biệt, **không coi đó là yêu cầu triển khai** nếu những chức năng ấy chưa có trong code/plan; bám theo contract của tài liệu này.

## 8. Rủi ro, phụ thuộc và bàn giao

1. **Chất lượng nội dung:** trang đẹp cần ảnh đúng và quyền sử dụng hợp lệ. Mock minh họa không chứng minh CMS đã có ảnh.
2. **Ranh giới với Viewer:** PR này chỉ có poster; PR Viewer sau sẽ lazy-load vào vùng media, không biến Detail thành trang Three.js tải ngay.
3. **Test bám semantic:** Playwright hiện có kiểm accessible name/heading/role. Khi đổi DOM, giữ hành vi và semantic; chỉ cập nhật test với lý do rõ ràng, không xóa assertion để che regression.
4. **Guided Tour:** đường dẫn tới đúng hiện vật và đúng bước đang xem; không sửa tùy tiện `guidedTour3dPath`.
5. **Audio và ghi chú:** di chuyển component có thể remount làm mất trạng thái/owner; phải kiểm navigation, key và autosave cẩn thận.
6. **Bản dịch và responsive:** sáu locale cùng zoom 200–400% có thể gây tràn ngay cả khi desktop tiếng Việt đẹp; phải test thực tế.
7. **Mốc nhánh:** thông tin code trong plan dựa trên `dev@115e5df` ngày 21/11/2026; nếu repo thay đổi, kiểm tra lại và điều chỉnh trước khi code.

**Tiêu chí kết thúc:** Các acceptance criteria thuộc phạm vi D01 đạt hoặc có blocker được ghi rõ; source, test, CSS và hai tài liệu đã được review. Người dùng duyệt giao diện trước khi yêu cầu mở PR; **không tự coi là đã triển khai/merge khi chưa có code, commit và CI thực tế**.
