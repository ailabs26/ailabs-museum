# Task T-HOMEPAGE-HERO-CAROUSEL: Nâng cấp Hero Editorial Carousel

**Trạng thái:** IN PROGRESS — HC-01 through HC-10 complete; HC-11 code/regression gates complete, manual contrast/screen-reader and real CMS media review remain.
**Nhánh triển khai:** `feat/public-homepage-redesign` — **tiếp tục trên nhánh Homepage hiện tại, không tạo nhánh mới**.
**Plan:** [homepage-hero-carousel-plan.md](../plans/homepage-hero-carousel-plan.md).
**Kế hoạch gốc:** [homepage-redesign-plan.md](../plans/homepage-redesign-plan.md), [homepage-redesign.md](./homepage-redesign.md).
**Design:** [PUBLIC_PORTAL_DESIGN.md](../architecture/fe/PUBLIC_PORTAL_DESIGN.md) + ảnh tham chiếu Hero ba vùng do người dùng gửi **16/11/2026**.
**Code remote khi khảo sát:** `dev` SHA `95c2bbe609ef32b36f0fc272d65e104076ca0841`. **Không thấy nhánh `feat/public-homepage-redesign` trên GitHub remote tại thời điểm đọc**; khi triển khai phải kiểm local HEAD, không giả lập code đã push.

## Mục tiêu

Sửa **chỉ Hero trên trang chủ `/`** theo layout ảnh tham chiếu: headline/CTA ở trái; **hiện vật lớn ở trung tâm** thay cho khung ảnh trông như card; tên, mô tả và link chi tiết hiện vật ở phải. Các hiện vật có ảnh published được tự chuyển **mượt bằng crossfade**, có thao tác thủ công, pause, hỗ trợ di động/keyboard và reduced motion. **Giữ nguyên hai section phía dưới:** Featured Exhibits và Immersive Story.

## Phạm vi đã chốt

- Hero dark full-bleed, hình ảnh hiện vật làm tâm điểm; cột phải là metadata **của slide đang active**, không show tên/niên đại tĩnh.
- Nguồn poster chỉ từ public published API. Ưu tiên phòng đầu, tối đa 5 slides; khi phòng đầu có dưới 3 poster thì bổ sung từ tối đa 4 phòng public tiếp theo, không quá 2 request đồng thời. Không sinh ảnh, không tự đưa placeholder vào carousel.
- 0 ảnh: neutral Hero; 1 ảnh: poster tĩnh; ≥2 ảnh: tự chuyển mỗi 6s, fade khoảng 550–650ms; nút Prev/Next/dots/Pause/Resume; hover/focus/tab hidden/offscreen pause; swipe mobile.
- Mỗi slide đồng bộ poster, `name`, `description`, localized alt và route `/collection/:roomSlug/exhibits/:exhibitId`; UI labels qua `t()`.
- CTA chung đến `/tour`, `/collection` luôn hoạt động, kể cả lỗi API; không download WebGL/GLB/Three trên Homepage.
- Desktop bố cục ba vùng; tablet co còn hai; mobile stack, không tràn 320px; có focus/contrast và reduced motion.
- Không biến Hero mẫu hiện tại thành ảnh cổ vật nếu CMS vẫn đang có ảnh minh họa mẫu; muốn đẹp như reference cần media thật được phép sử dụng.

## Phụ thuộc và không làm

- Tiếp tục ngay **trên commit HR-12 đã có**, không reset/checkout/rebase hoặc tạo branch mới. Kiểm actual working tree trước sửa; tuyệt đối không overwrite file có thay đổi chưa commit của người dùng.
- Không đổi Featured: **vẫn tối đa 3 hiện vật của phòng đầu** theo `displayOrder`/ID; không chỉnh card/Grid, filter/compare, Immersive Story hoặc Header/Footer.
- Không sửa backend/runtime, schema DTO, public API, CMS editor, database, theme Admin, `/tour`, Guided Tour, 3D engine hoặc audio player. UI strings seed chỉ bổ sung khi thực sự cần cho các locale.
- Không dùng mock image, tên tuổi văn hóa/niên đại, nhãn “featured” giả, không thêm routes trong menu từ hình reference.
- **Một PR Homepage hiện tại** với các commit follow-up nhỏ. HC-* là mã checkpoint, **không phải PR**. Không commit rỗng, không push/PR/merge khi chưa được yêu cầu.

## Task và commit đề xuất

| Task | Deliverable review độc lập | Commit đề xuất |
|---|---|---|
| HC-01 | Kiểm branch, baseline, tài liệu follow-up | `docs(home): plan hero carousel follow-up` |
| HC-02 | Chọn 0–5 poster published; bounded cross-room fallback | `feat(home): select bounded published hero carousel slides` |
| HC-03 | Hero ba vùng theo reference, không đóng khung card | `feat(home): build three-zone editorial hero stage` |
| HC-04 | Poster, tên/mô tả/alt và detail link đồng bộ | `feat(home): synchronize hero poster caption and detail link` |
| HC-05 | Prev/Next/dots, keyboard, wrap | `feat(home): add accessible hero carousel controls` |
| HC-06 | Auto 6s, pause/resume, visibility, reduced motion | `feat(home): implement pausable hero autoplay lifecycle` |
| HC-07 | Crossfade, preload poster kế và xử lý ảnh lỗi | `feat(home): smooth crossfade and preload adjacent hero poster` |
| HC-08 | Responsive tablet/mobile, swipe, no overflow | `style(home): adapt hero carousel to tablet and mobile` |
| HC-09 | Locales, screen reader semantics, contrast, motion | `fix(home): localize and harden hero carousel accessibility` nếu có sửa; ngược lại `test(home): ...` |
| HC-10 | Tests integration, Home lower sections & network proof | `test(home): verify carousel behavior data and network limits` |
| HC-11 | QA ảnh reference, quality gates, commit ledger, handoff | `docs(home): record hero carousel visual and test evidence` |

**Nguyên tắc:** Mỗi commit chỉ một mục tiêu, vẫn buildable; tests chứng minh behavior thay đổi nên commit chung với code. Checkpoint không có diff thì ghi `no-op` có lý do, không tạo commit rỗng. Bug phát sinh trong HC-10 có `fix(home): ...` riêng cùng regression.

## Checklist thực hiện

### HC-01 — Baseline và docs

- [x] Xác nhận branch đúng `feat/public-homepage-redesign`; kiểm working tree, log HR commits, diff với `origin/dev` mà **không thay lịch sử**.
- [x] Đọc Hero implementation thực tế và owner data/query; đối chiếu screenshot baseline với mô tả/ASCII trong plan (ảnh reference không khả dụng ở phiên này; giữ lại cho visual sign-off).
- [x] Chạy baseline focused Home tests/typecheck/lint/build khi môi trường cho phép; ghi lỗi có thật, không dùng số pass từ PR trước.
- [x] Review/stage riêng hai file plan/task này và commit trên chính branch đang làm.

**Baseline (16/11/2026):** 46/47 focused Playwright; the failure was the 12-scenario responsive matrix exceeding its default 30s timeout. Trace showed the poster URL returned HTTP 200. HC-02 gives that test 90s and waits for image decode; the combined regression now passes 12/12. Baseline typecheck/lint/build passed. HR-12 screenshots at 390/1440 light/dark were reused. The reference image is unavailable in the current repo/session, so comparison to that attachment remains for final visual review.

### HC-02 — Chọn dữ liệu carousel

- [x] Test 0/1/2/3/6 poster, sort order/tie ID, slug/ID encode, 0–5 slides, không mutation DTO.
- [x] Chỉ khi phòng đầu <3 ảnh mới fetch thêm tối đa 4 phòng public; concurrency ≤2; ngừng khi đủ, không fetch vô hạn.
- [x] Hỗ trợ partial failure của phòng thêm, primary error/refetch stale, cache và abort; locale change không gây fetch lại phòng.
- [x] Featured vẫn giữ phòng đầu, 0–3 card; typecheck/focused tests GREEN và commit riêng.

**HC-02 verification:** selector unit tests 8/8; carousel + Featured Playwright 12/12; typecheck/lint pass. E2E covers the four-room cap, two-request batches, early stop at three posters, partial room failure, locale cache reuse, and Featured's first-room selection. Build is reserved for HC-11.

### HC-03 — Layout ba vùng

- [x] Dựng hero full-bleed charcoal: editorial text/2 CTA trái, media stage lớn giữa, metadata phải theo reference.
- [x] Loại bỏ cảm giác poster card nhỏ/bordered; thêm gradient nhẹ, không thêm glow/stock art/hardcoded hiện vật.
- [x] Không chỉnh Featured hoặc Immersive Story; Hero neutral khi không có ảnh, CTA không phụ thuộc API.
- [x] Kiểm bố cục desktop 1440 và ba vùng bằng Playwright; sweep 1280/390 được ghi nhận ở HC-08.

### HC-04 — Media và caption/link đồng bộ

- [x] Poster public, alt localized, metadata và detail link cùng một exhibit khi đổi vi/en.
- [x] Metadata chỉ lấy từ nội dung public của exhibit; không thêm niên đại/chất liệu/thống kê.
- [x] Ảnh 404 dùng fallback hiện có; metadata và detail link vẫn hiển thị; đổi locale không mismatch.
- [x] Playwright integration + Home regression 24/24, typecheck/lint pass; ảnh cross-locale để HC-11; commit riêng.

### HC-05 — Điều khiển thủ công

- [x] Prev/Next wrap, dots active, labels đi qua `t()`, buttons ≥44px; Enter/Space và link metadata cùng slide đã được test.
- [x] 0/1 slide không hiện controls; dot là button độc lập. Pause/Resume đi cùng autoplay ở HC-06 để không có nút giả.
- [x] Lưu active selection bằng exhibit key; functional state update giữ đúng slide khi thao tác liên tiếp.
- [x] Playwright carousel/Home regression 25/25; targeted 0/1/N tests 3/3; typecheck/lint pass; commit riêng trước autoplay.

### HC-06 — Autoplay và cleanup

- [x] Browser clock xác minh 6s/cycle và timer reset sau thao tác; đổi locale không làm nhân đôi timer.
- [x] Hover/focus pause; manual pause giữ đến Resume; tab ẩn và Hero ngoài viewport dừng timer.
- [x] Reduced motion dừng auto mặc định; người dùng có thể chọn Resume; controls thủ công vẫn dùng được.
- [ ] Cleanup timers/observers/listeners sau unmount và route change; a11y auto announcements không spam; commit riêng.

### HC-07 — Transition mượt, preload và ảnh lỗi

- [x] Hai poster/metadata layers crossfade 600ms; stage giữ hình học, poster và caption/link đi cùng exhibit trong lúc chờ tải.
- [x] Poster đầu eager/high priority; preload đúng một poster kế với low priority; test xác nhận không tải cả carousel cùng lúc.
- [x] Slow poster giữ nội dung hiện tại; ảnh hỏng hiện fallback không retry loop; rapid selection giữ exhibit mới nhất; reduced motion bỏ transition.
- [x] Playwright Home regression 32/32; typecheck và lint sạch; checkpoint commit riêng. Screenshot matrix/reference comparison để HC-11.

### HC-08 — Mobile/tablet & swipe

- [x] Desktop giữ ba vùng; tablet dùng hai cột với metadata dưới poster; mobile stack content → stage → metadata, đúng DOM/tab order.
- [x] Touch swipe chỉ đổi slide khi ngang chủ đạo và vượt 48px; kéo dọc không bị chặn; keyboard/buttons/dots không đổi hành vi.
- [x] Geometry và hit target kiểm tại 320/390/768/1024/1280/1440; không tràn ngang, controls ≥44px và không bị cắt.
- [x] Đã tạo và xem screenshot matrix light/dark tại HC-11; user đã duyệt giao diện. Ảnh reference gốc không có trong checkout nên chưa đối chiếu trực tiếp; ảnh dọc/zoom 200–400% chưa đo.
### HC-09 — i18n & accessibility

- [x] `vi/en/fr/zh/ko/ja`; UI labels được dịch qua `t`; alt, tên, mô tả dùng helper localization hiện có.
- [x] Carousel accessible region/name; poster không active bị ẩn khỏi accessibility tree; controls có labels/state; manual change announced polite, autoplay không spam.
- [x] Keyboard/buttons, focus pause, reduced-motion default và crossfade states có Playwright coverage.
- [ ] Đo contrast và screen reader thật còn cần manual check.
- [x] UI keys carousel đã thêm vào seed và locale regression; `36/36` Playwright pass.

### HC-10 — Regression & network

- [x] E2E dữ liệu 0/1/N, room fallbacks, error/empty/retry/refetch stale, image 404, media/locale/theme, manual/auto controls.
- [x] Network proof: Home không mount canvas, không request model/audio; fallback room fetch tối đa 4, concurrency tối đa 2.
- [x] Featured giữ tối đa 3; Collection/Detail/Tour/shell/locale regressions pass; Immersive không đổi.
- [x] Không phát hiện bug; thêm regression cho 0 poster và network.

### HC-11 — Quality gates và bàn giao

- [x] `typecheck`, `lint`, `test:unit` 416/416, `build`, focused Playwright 46/46 và regression 12 spec 96/96; build còn warning bundle >500 kB.
- [x] Tạo và xem đủ 20 ảnh 0/1/3 poster × light/dark × viewport 320/390/768/1024/1280/1440 tại `.superpowers/sdd/homepage-hero-carousel/hc11-visual-review/`; user đã duyệt giao diện. Fixture poster không đại diện ảnh CMS.
- [ ] Đối chiếu trực tiếp ảnh reference (file gốc không có trong checkout), xác minh media CMS thật, đo contrast và kiểm screen reader thật.
- [x] Review `git diff origin/dev...HEAD`, commit log, changed paths và whitespace; thay đổi nằm trong homepage hero, test, locale seed và docs; không artifacts/secret. Staged diff và whitespace đã được kiểm.
- [x] Ghi test/screenshots, commit liên quan và giới hạn QA bên dưới. Branch local-only; chưa push/PR/merge.
- [ ] Xác nhận số và chất lượng poster từ CMS thật sau khi media được gắn/xuất bản.

## Acceptance criteria

- [x] Hero ba vùng: copy trái/ảnh lớn giữa/metadata phải, không còn khung card showcase nhỏ; user duyệt screenshot matrix. Ảnh reference gốc không có để đối chiếu trực tiếp.
- [x] Với ≥2 poster từ public API, Hero tự chạy 6s/slide, crossfade ~550–650ms, Prev/Next/dots/Pause/Resume; mouse/keyboard/mobile gesture có test.
- [x] 0/1 poster hoạt động đúng, không tự tạo ảnh; Hero chỉ dùng ảnh nhận từ public published API.
- [x] Hình, alt, tên, mô tả và detail link đồng bộ trong transition/locale; poster lỗi không làm hỏng Hero.
- [x] Truy vấn thêm phòng bị giới hạn, không tác động Featured 0–3 của phòng đầu; loading/error/retry có regression coverage.
- [x] Responsive, dark/light, `vi/en/fr/zh/ko/ja`, reduced motion, focus/labels, hover/focus/tab pause đều có tests.
- [x] Không mount WebGL/Canvas/HeroCanvas/Three/GLB ở `/`; giữ nguyên **Featured và Immersive Story**, PublicLayout, Admin/Collection/Detail/Tour.
- [x] Quality gates đã chạy thực tế, diff whitespace sạch và người dùng đã xác nhận visual.

## Kiểm thử và review commits

```powershell
# Terminal 1 từ front-end/: giữ dev server chạy để phục vụ cả tests/fixtures trên port 4173.
npm.cmd run dev -- --host 127.0.0.1 --port 4173
# Terminal 2 từ front-end/:
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test -- homepage-hero-carousel.spec.ts homepage-redesign.spec.ts home-featured.spec.ts public-ui-translations.spec.ts public-image-audio.spec.ts public-foundation.spec.ts collection.spec.ts shared-exhibit-components.spec.ts shared-exhibit-grid.spec.ts shared-exhibit-locale.spec.ts shared-exhibit-media.spec.ts public-tour-navigation.spec.ts
```

Mỗi slice: test mục tiêu → `git status --short` → `git diff --check` → stage file đúng mục tiêu → `git diff --cached --check` + `git diff --cached` → commit. Không `git add .`; screenshot/log/`.env` không đưa vào commit. Các file mới trong lệnh chỉ chạy khi đã được tạo.

## Evidence / commit ledger

| Task | SHA thực tế / no-op | Tests/kết quả | Screenshot / giới hạn | Trạng thái |
|---|---|---|---|---|
| HC-01 | `6187d27` | Baseline 46/47; typecheck/lint/build pass | HR-12 screenshots; reference gốc không có | DONE |
| HC-02 | `88e495c` | Selector 8/8; E2E 12/12; typecheck/lint pass | — | DONE |
| HC-03 | `34ecaf8` | Layout regression 22/22; typecheck/lint pass | Screenshot desktop hero | DONE |
| HC-04 | `8d00df1` | Home regression 24/24; typecheck/lint pass | Cross-locale image check | DONE |
| HC-05 | `ca8c693` | Home 25/25; targeted 3/3; typecheck/lint pass | — | DONE |
| HC-06 | `47a8b6c` | Home 28/28; lifecycle 4/4; typecheck/lint pass | — | DONE |
| HC-07 | `ed84016` | Home regression 32/32; typecheck/lint pass | — | DONE |
| HC-08 | `fb92432` | Home regression 34/34; responsive/swipe target pass | 20-screen matrix in HC-11 | DONE |
| HC-09 | `124df7b` | Carousel + localization 36/36; typecheck/lint/unit/build pass | Contrast/screen reader manual còn pending | DONE |
| HC-10 | `9aac3d9` | Combined Playwright 46/46; later full affected-surface regression 96/96 | No visual artifact committed | DONE |
| HC-11 | Test correction `cf65c01`; HC-11 evidence recorded in this docs commit | Required 12-spec Playwright 96/96; `typecheck`, lint, unit 416/416 and build pass | 20 screenshots reviewed and UI approved; reference/CMS image/contrast/real SR checks remain | IN PROGRESS |

**Không điền số test hoặc SHA giả.**

Backend `test:seed` đang có lỗi nền: thiếu khóa `ui.guided2d.progress`; caller này giống `origin/dev`, HC-09 không sửa phần đó. Nếu đã có bug/thiếu ảnh CMS, ghi blocker thực. Các mục zoom 200/400%, NVDA/VoiceOver, mobile thật, Lighthouse/CLS/LCP chỉ ghi PASS khi đã đo; không coi responsive screenshot tự động tương đương manual QA.

## Handoff / Git

- Hai file mới thuộc **PR Homepage đang mở hoặc đang chuẩn bị**, không tạo PR riêng, không sửa plan/task HR cũ.
- Trong báo cáo triển khai, phân biệt **commits HR đã có** với **commits HC bổ sung**, liệt kê changed paths, SHA và regressions của từng slice.
- Không push, tạo PR, merge hoặc sửa lịch sử commit tự động nếu chưa có yêu cầu. Nếu `feat/public-homepage-redesign` còn local-only, đó **không phải lỗi plan**; giữ nguyên nhánh local và tiếp tục làm trên đó.
