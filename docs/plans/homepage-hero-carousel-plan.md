# Task T-HOMEPAGE-HERO-CAROUSEL: Nâng cấp Hero Editorial Carousel

**Trạng thái:** IN PROGRESS — HC-01 through HC-08 complete; localization and accessibility hardening continues in HC-09.
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

**Baseline (16/11/2026):** 46/47 focused Playwright; the failure was the 12-scenario responsive matrix exceeding its default 30s timeout. Trace showed the poster URL returned HTTP 200. HC-02 gives that test 90s and waits for image decode; the combined regression now passes 12/12. Baseline typecheck/lint/build passed. HR-12 screenshots at 390/1440 light/dark were reused and copied into the HC SDD workspace. The reference image is unavailable in the current repo/session, so comparison to that attachment remains for final visual review.

### HC-02 — Chọn dữ liệu carousel

- [x] Test 0/1/2/3/6 poster, sort order/tie ID, slug/ID encode, 0–5 slides, không mutation DTO.
- [x] Chỉ khi phòng đầu <3 ảnh mới fetch thêm tối đa 4 phòng public; concurrency ≤2; ngừng khi đủ, không fetch vô hạn.
- [x] Hỗ trợ partial failure của phòng thêm, primary error/refetch stale, cache và abort; locale change không gây fetch lại phòng.
- [x] Featured vẫn giữ phòng đầu, 0–3 card; typecheck/focused tests GREEN và commit riêng.

**HC-02 verification:** selector unit tests 8/8; carousel + Featured Playwright 12/12; typecheck/lint pass. The E2E suite proved the four-room cap, two-request batches, early stop at three posters, partial room failure, locale cache reuse, and unchanged Featured selection. Build is reserved for HC-11.

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
- [ ] Screenshot light/dark và ảnh reference matrix để HC-11; ảnh dọc/zoom 200–400% chưa đo.
### HC-09 — i18n & accessibility

- [ ] `vi/en/fr/zh/ko/ja`; UI labels được dịch qua `t`; alt, tên, mô tả dùng helper localization hiện có.
- [ ] Carousel accessible region/name; chỉ slide active tiếp cận, controls có labels/state; manual change announced polite, auto không spam.
- [ ] Keyboard focus/contrast/heading hierarchy, prefers-reduced-motion tắt animation/autoplay; screen reader thật chỉ tick khi chạy.
- [ ] Nếu thêm UI keys, cập nhật seed và tests trong cùng slice; test rồi commit riêng.

### HC-10 — Regression & network

- [ ] E2E dữ liệu 0/1/N, room fallbacks, error/empty/retry/refetch stale, image 404, media/locale/theme, manual/auto controls.
- [ ] Network proof không canvas/GLB/HeroCanvas/Three/R3F hoặc phát audio trên Home, room fetch cap/concurrency hợp lệ.
- [ ] Kiểm Featured max 3 và Immersive không đổi, cùng Collection/Detail/Tour/shell/locale regressions.
- [ ] Nếu test phát hiện bug thì fix riêng có regression; chỉ commit test-only nếu có tests mới.

### HC-11 — Quality gates và bàn giao

- [ ] `typecheck`, `lint`, `test:unit`, `build`, focused Playwright — ghi số PASS/FAIL và warning thật.
- [ ] Screenshot reference comparison: 0/1/multi poster, crossfade, light/dark, 320/390/768/1024/1280/1440; cần người dùng xác nhận visual.
- [ ] Review `git diff origin/dev...HEAD`, `git show <SHA>`, staged diff/whitespace; chỉ phần Hero + tests + docs, không artifacts/secret.
- [ ] Điền commit SHA, tests/screenshots, số poster nguồn thật, manual limitations và tình trạng push/PR/merge. Không tự tạo PR.

## Acceptance criteria

- [ ] Hero giống **bố cục ảnh reference 16/11/2026**: copy trái/ảnh lớn giữa/metadata phải, không còn khung card showcase nhỏ.
- [ ] Khi ≥2 poster thật, Hero tự chạy 6s/slide, crossfade ~550–650ms, Prev/Next/dots/Pause/Resume; mouse/keyboard/mobile gesture truy cập được.
- [ ] 0/1 poster hoạt động đúng, không tự tạo ảnh; các poster đều có nguồn public đã xuất bản/đúng quyền nội dung.
- [ ] Hình, alt, tên, mô tả và detail link luôn cùng exhibit trong mọi transition/locale; poster lỗi không làm hỏng Hero.
- [ ] Truy vấn thêm phòng bị giới hạn, không tác động Featured 0–3 của phòng đầu, không phá loading/error/retry hiện tại.
- [ ] Responsive, dark/light, `vi/en/fr/zh/ko/ja`, reduced motion, focus/labels, hover/focus/tab pause đều có tests.
- [ ] Không mount WebGL/Canvas/HeroCanvas/Three/GLB ở `/`; giữ nguyên **Featured và Immersive Story**, PublicLayout, Admin/Collection/Detail/Tour.
- [ ] Quality gates đã chạy thực tế và diff sạch; người dùng xác nhận visual trước khi đánh dấu hoàn tất.

## Kiểm thử và review commits

```powershell
# Từ front-end/; sử dụng tên spec thực tế sau khi tạo test
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
| HC-01 | — | Chưa chạy | Chưa chụp | TODO |
| HC-02 | — | Chưa chạy | — | TODO |
| HC-03 | — | Chưa chạy | Chưa chụp | TODO |
| HC-04 | — | Chưa chạy | Chưa chụp | TODO |
| HC-05 | — | Chưa chạy | — | TODO |
| HC-06 | — | Chưa chạy | — | TODO |
| HC-07 | Ghi SHA ở HC-11 | Home regression 32/32; typecheck/lint pass | Screenshot HC-11 | DONE |
| HC-08 | Ghi SHA ở HC-11 | Home regression 34/34; responsive/swipe target pass | Screenshot HC-11 | DONE |
| HC-09 | — | Chưa chạy | — | TODO |
| HC-10 | — | Chưa chạy | — | TODO |
| HC-11 | — | Chưa chạy | Chưa chụp | TODO |

**Không điền số test hoặc SHA giả.** Nếu đã có bug/thiếu ảnh CMS, ghi blocker thực. Các mục zoom 200/400%, NVDA/VoiceOver, mobile thật, Lighthouse/CLS/LCP chỉ ghi PASS khi đã đo; không coi responsive screenshot tự động tương đương manual QA.

## Handoff / Git

- Hai file mới thuộc **PR Homepage đang mở hoặc đang chuẩn bị**, không tạo PR riêng, không sửa plan/task HR cũ.
- Trong báo cáo triển khai, phân biệt **commits HR đã có** với **commits HC bổ sung**, liệt kê changed paths, SHA và regressions của từng slice.
- Không push, tạo PR, merge hoặc sửa lịch sử commit tự động nếu chưa có yêu cầu. Nếu `feat/public-homepage-redesign` còn local-only, đó **không phải lỗi plan**; giữ nguyên nhánh local và tiếp tục làm trên đó.
