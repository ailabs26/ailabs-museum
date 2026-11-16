# Task T-HOMEPAGE-REDESIGN: Public Homepage Editorial Redesign

**Trạng thái:** Đang triển khai trên `feat/public-homepage-redesign`; HR-01–HR-07 hoàn tất, HR-08 tiếp theo.
**Nguồn code khảo sát:** `origin/dev` SHA `95c2bbe609ef32b36f0fc272d65e104076ca0841` tại 15/11/2026; xác minh lại khi thực thi.
**Nhánh hiện tại:** `feat/public-homepage-redesign` từ `origin/dev` SHA `95c2bbe609ef32b36f0fc272d65e104076ca0841`; PR base `dev`.
**Plan:** [homepage-redesign-plan.md](../plans/homepage-redesign-plan.md).
**Design:** [PUBLIC_PORTAL_DESIGN.md](../architecture/fe/PUBLIC_PORTAL_DESIGN.md), H01 và acceptance.
**Convention:** [frontend coding conventions](../architecture/fe/coding-conventions.md).

## Mục tiêu

Thiết kế lại **Homepage `/`** theo phong cách *Contemporary Heritage Editorial* trên nền Public Foundation & Shared Exhibit Components đã được merge. Kết quả có **Hero dark với ảnh hiện vật xuất bản/neutral fallback**, khu vực **Featured 0–3 hiện vật** theo logic CMS hiện có, phần **Immersive Story về 3D/audio** và responsive/locale/accessibility nhất quán. Không tự tải WebGL/GLB tại Homepage.

## Phạm vi và quy tắc dữ liệu

- Hero full-bleed charcoal, headline serif, copy vừa đủ, CTA `/tour` và `/collection` không phụ thuộc API.
- Chọn dữ liệu từ **phòng public đầu tiên** do `useMuseumRooms(null)` cung cấp; sort bản sao exhibits theo `displayOrder` rồi ID.
- Featured **tối đa ba** exhibit đầu đã sort; dùng lại `ExhibitGrid`/`ExhibitCard` có sẵn và link `/collection?room=<slug>` chỉ khi room hợp lệ.
- Hero chọn **exhibit đầu tiên có `image` hợp lệ** trong danh sách đã sort của chính phòng ấy. Tên, ảnh, alt và link `/collection/:roomSlug/exhibits/:exhibitId` luôn từ cùng exhibit; chọn locale theo `localizeExhibit`/`localizedAltText`.
- Không có phòng / không có exhibit / không có ảnh → neutral art thật sự là decoration; **không** nhãn hiện vật giả, số liệu không kiểm chứng, stock photo đại diện sai hoặc link detail chết.
- Lỗi API / refetch stale → hero branding tĩnh, featured alert/retry rõ; CTA chung vẫn hoạt động. Ảnh lỗi -> poster fallback có nhãn nhưng exhibit thật vẫn có link nếu hợp lệ.
- Bỏ Home `HeroCanvas` và các stat `5+`, `100%`, `0s`/hardcoded “Trống đồng Đông Sơn · ~2.500 năm”, bento/glow/soundwave; tuyệt đối không chạm scene của `/tour`.
- Giới thiệu 3D/audio bằng editorial 2-column, với minh họa trung tính khi không có ảnh phòng chính thức; không tuyên bố có chứng nhận WCAG hoặc video/audio cho mọi thiết bị/ngôn ngữ.
- 320/390/768/1024/1440 px, light/dark, `vi/en/fr/zh/ko/ja`, keyboard/focus và reduced motion.

## Phụ thuộc, phạm vi không làm

- Đã xác nhận PR #195 (Foundation) và PR #196 (Shared Exhibit Components) có trong `dev` tại thời điểm viết. Trước code vẫn bắt buộc `git fetch origin` và so SHA.
- Không sửa backend runtime, API/schema, DB migration, CMS UI, Collection/Detail/3D Tour, room management, visitor stores, guided tour reducer, shared design tokens/theme global. UI translations seed **chỉ được cập nhật khi key mới cần đủ sáu locale**, không đổi API và cần xác minh publish CMS nếu có.
- Không dùng font không rõ license, ảnh không có quyền, category/năm/chất liệu/featured flag chưa được CMS cung cấp.
- Chỉ một PR cho Homepage; chia **commit theo lý do thay đổi** (data refactor, hero, poster, featured, immersive, responsive, locale, test, docs). Mỗi commit phải có focused tests; code/tests giải thích một hành vi nên nằm trong cùng commit.
- Không tự push/PR/merge; hình reference được mô tả trong SDD, kiểm trực quan chỉ được tuyên bố đạt nếu ảnh thực sự có thể xem và được người dùng sign-off.

## Task và commit dự kiến

| Task | Deliverable có thể review độc lập | Commit message đề xuất |
|---|---|---|
| HR-01 | Baseline `dev`, scope, plan/task và tài liệu | `docs(home): plan public homepage editorial redesign` |
| HR-02 | Một chủ sở hữu state/query Hero + Featured, visual chưa đổi | `refactor(home): share published room state across homepage` |
| HR-03 | Hero charcoal, 2 CTA, bỏ auto WebGL/stock stats | `feat(home): replace webgl showcase with editorial hero` |
| HR-04 | Hero image/caption/detail link theo exhibit thật, fallback | `feat(home): display published exhibit poster in hero` |
| HR-05 | Poster hero eager, cards vẫn lazy, fallback image | `perf(home): prioritize hero poster without changing card loading` |
| HR-06 | Featured editorial section và Shared Grid 0–3 items | `feat(home): present featured exhibits in editorial section` |
| HR-07 | Immersive Story thay bento, CTA 3D/2D | `feat(home): replace feature bento with immersive story` |
| HR-08 | Dọn legacy CSS/glow/soundwave và chuẩn hóa `--public-*` | `style(home): simplify editorial surfaces and remove legacy effects` |
| HR-09 | Layout responsive 320–1440 và văn bản dài | `style(home): refine responsive hero and section layouts` |
| HR-10 | Locale/keyboard/reduced motion/semantics | `fix(home): align editorial content with locale and accessibility` hoặc `test(home): ...` nếu không sửa code |
| HR-11 | E2E states + network proof không WebGL/GLB | `test(home): verify editorial page and no eager 3d` |
| HR-12 | Quality gates, screenshots, review, handoff evidence | `docs(home): record homepage redesign verification` |

**Checkpoint ≠ bắt buộc số commit.** Không tạo commit rỗng cho đủ bảng. Nếu lỗi phát sinh trong QA, tạo commit `fix(home): ...` kèm regression tương ứng. Không gộp chỉnh data và visual hoặc test-only và docs khi có thể review riêng.

## Checklist triển khai

### HR-01 — Baseline và tài liệu

- [x] Fetch, check working tree/base SHA `95c2bbe609ef32b36f0fc272d65e104076ca0841`, tạo branch từ `origin/dev` đã chứa PR #196.
- [x] Khảo sát source `HomePage`, `HomeFeaturedExhibits`, media/shared card, translation seeds, fixtures và Home tests.
- [x] Baseline: typecheck/lint pass; test:unit 65 files / 408 tests pass; build pass (existing chunk warnings: main 1,126.14 KB, R3F 820.71 KB); focused Playwright 61/61 pass; screenshots 390/1440 light/dark saved under ignored `.superpowers/sdd/homepage-redesign-plan/`.
- [x] Rà soát plan/task, staged diff sạch; bắt đầu triển khai đã được người dùng yêu cầu.

### HR-02 — Lift homepage data owner

- [x] Khóa expected data contract: first room, sort copy, 0–3 featured, pending/empty/error/retry/cached refetch failure.
- [x] Sử dụng một `useMuseumRooms(null)` owner cho hero và featured; giữ query key, guards, localization và UI hiện tại.
- [x] Không fetch room thứ hai, không mutate API/cache hoặc trigger thêm request; focused tests pass, commit riêng.

### HR-03 — Hero tĩnh, không auto WebGL

- [x] Test RED: hai CTA tới `/tour`, `/collection`; 1 H1; không Canvas/HeroCanvas/Three/R3F/GLB request kể cả WebGL enabled.
- [x] Thay HeroCanvas/showcase 3D bằng hero charcoal/neutral art và gỡ các stats/label/era giả, soundwave/particles.
- [x] CTA dùng `Link`, focus thấy rõ; CSS scoped theo Foundation; giữ page hoạt động khi API down.
- [x] Test GREEN + typecheck/lint/build; commit riêng.

### HR-04 — Poster từ CMS

- [x] Test room đầu 0/1/n exhibit, thứ tự đảo và tie ID; chọn first valid `image` trong room đầu, không quét phòng khác.
- [x] Hero hiển thị đúng ảnh, localized name/alt và encoded detail route **cùng exhibit**; khi không có ảnh dùng neutral art, không fake caption.
- [x] Image 404/corrupt giữ fallback; error/refetch stale không lộ poster cũ; CTA chung vẫn dùng được.
- [x] Focused tests và screenshot hero poster/neutral, commit riêng.

### HR-05 — Hero image priority

- [x] Viết test poster above-the-fold `loading=eager` (hoặc tương đương); card dưới fold vẫn lazy.
- [x] Nếu cần thêm prop optional cho `ExhibitImage` với mặc định lazy; giữ fallback, media API URL/referrerPolicy.
- [x] Kiểm ảnh ngang/dọc/trong suốt, no audio/GLB, load fail/source đổi; commit `perf` kèm test.

### HR-06 — Featured editorial

- [x] Dùng `ExhibitGrid`/`ExhibitCard` có sẵn, không clone card; section có heading, intro và room link.
- [x] Giữ featured 0–3, order, room link, loading/empty/error/retry, query-refetch guard như baseline.
- [x] Test heading và responsive grid; không bỏ assertion dữ liệu. Screenshot light/dark ở 390/1024/1440; code commit riêng.

### HR-07 — Immersive Story

- [x] Thay Bento bằng 2-column editorial: hai điểm 3D/audio, CTA 3D/2D, artwork hình học trung tính.
- [x] Bỏ claims VR/device/WCAG/số liệu không xác minh; copy audio chỉ nói có ở một số hiện vật.
- [x] Kiểm heading hierarchy, icon decorative, keyboard/CTA, 390/768/1440 responsive; screenshot light/dark và commit riêng.

### HR-08 — Visual CSS cleanup

- [ ] Xóa selector Home không còn dùng: bento/showcase/glow/soundwave/stats/aura-reveal/delay; không ảnh hưởng style shared.
- [ ] Chuẩn hóa `--public-*` cho Hero/Featured/Immersive; hero charcoal light/dark có contrast tốt.
- [ ] Kiểm tiếng Việt, hover/focus/long text, screenshot before-after; commit style riêng.

### HR-09 — Responsive

- [ ] Kiểm 320/390/768/1024/1440 px, light/dark: 40/60 desktop, mobile stack, cards 1/2/3 theo container.
- [ ] Không overflow ngang, CTA không che, ảnh không crop, DOM/tab order đúng, landscape và tên dài.
- [ ] Browser assertion + screenshots full-page; commit riêng.

### HR-10 — i18n và accessibility

- [ ] Reuse translation keys; thêm key mới vào seed chỉ khi cần, kiểm sáu locale & fallback API lỗi, không báo CMS đã cập nhật nếu chưa publish.
- [ ] Kiểm một H1, H2 hợp lý, alt caption/landmark, CTA keyboard/focus, contrast, screen-reader labels.
- [ ] `prefers-reduced-motion`: tắt animation bắt buộc, không còn hiệu ứng vô hạn; test code/browser.
- [ ] Commit fix riêng nếu behavior thay đổi, hoặc test-only riêng nếu chỉ bổ sung bằng chứng.

### HR-11 — Integration / no-WebGL

- [ ] Homepage không Canvas, không GLB, không import HeroCanvas/Three chunk trước click `/tour` trên cả WebGL enabled/disabled.
- [ ] E2E room empty/pending/error/retry/stale, image valid/404/corrupt, locale/theme, key links; cập nhật existing tests đúng contract mới.
- [ ] Re-run Home featured, public i18n, shared cards/grid/media, public navigation, Collection, image/audio.
- [ ] Fix bug phát hiện bằng commit `fix(home)` cùng regression; test-only commit cho hạng mục QA mới nếu có.

### HR-12 — Bàn giao

- [ ] Typecheck, lint, unit, build, focused Playwright: ghi lệnh và pass/fail thực tế; không gắn kết quả cũ.
- [ ] Ảnh Home desktop/tablet/mobile light/dark và neutral/real poster; đối chiếu SDD. Zoom 200/400%, NVDA/VoiceOver, mobile thật chỉ tick khi test thật.
- [ ] Review `git diff origin/dev...HEAD`, từng commit, staged/whitespace, file scope, không artifacts/secret.
- [ ] Ghi SHA, kết quả, warnings, ảnh và giới hạn manual QA; chờ user visual sign-off, push/PR theo yêu cầu sau.

## Acceptance criteria

- [ ] Homepage có Hero dark theo SDD, CTA `/tour` + `/collection`, 1 H1, visual neutral khi không có poster.
- [ ] Có poster thật: ảnh, alt, tên, link detail cùng exhibit; không có poster: không hiện tên/link ảnh giả.
- [ ] Không có hardcoded “Trống đồng Đông Sơn”, niên đại `~2.500 năm`, stats `5+`/`100%`/`0s` hoặc claims WCAG certification.
- [ ] Featured 0–3 giữ first-room/order logic, không quét room khác, shared Card/Grid không fork.
- [ ] Không tự mount Canvas, HeroCanvas/Three/R3F chunk hoặc request GLB ở route `/` khi chưa vào `/tour`.
- [ ] Loading/empty/HTTP/schema error/retry/stale refetch không render thông tin sai; CTA hero độc lập network.
- [ ] Immersive Story có hai điểm 3D/audio và CTA có thật; không dùng ảnh không có quyền đại diện cho phòng.
- [ ] Light/dark, vi/en/fr/zh/ko/ja, keyboard/focus, reduced motion và 320–1440px có kiểm chứng.
- [ ] Typecheck, lint, unit/build và affected Playwright pass; nếu live API skip phải ghi rõ chưa kiểm real integration.
- [ ] Không sửa API/backend runtime/DB, Admin/CMS UI, Collection/Detail/Tour logic, global theme hoặc visitor stores.
- [ ] Commit độc lập, review diff, có test và evidence thật; đã nhận sign-off giao diện trước khi kết luận hoàn thành.

## Validation commands

```powershell
cd front-end
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test -- homepage-redesign.spec.ts home-featured.spec.ts public-ui-translations.spec.ts public-image-audio.spec.ts public-foundation.spec.ts public-tour-navigation.spec.ts collection.spec.ts shared-exhibit-components.spec.ts shared-exhibit-grid.spec.ts shared-exhibit-locale.spec.ts shared-exhibit-media.spec.ts
```

Sử dụng các tập test tồn tại thực tế; `homepage-redesign.spec.ts` sẽ được tạo khi implement. Live backend chỉ chạy opt-in `MUSEUM_LIVE_TEST=1`, không ghi dữ liệu production. Khi mỗi slice hoàn thành, chạy test focused liên quan và kiểm staged diff trước commit.

## Evidence / commit ledger

| Task | Commit SHA / no-op | Test/lệnh/kết quả | Screenshot / lưu ý | Trạng thái |
|---|---|---|---|---|
| HR-01 | base 95c2bbe; branch feat/public-homepage-redesign | typecheck/lint/build; unit 408/408; Playwright 61/61 | baseline screenshots 390/1440 light/dark in ignored .superpowers/sdd/homepage-redesign-plan/ | Complete |
| HR-02 | 0e1fa8e | home-featured Playwright 7/7; typecheck/lint pass | one list + one room detail request; no other-room fetch | Complete |
| HR-03 | 06a44b9, b2225e0 | homepage-redesign 3/3; public-ui-translations 13/13; typecheck/lint/build pass | light/dark hero screenshots inspected; visual sign-off deferred to HR-12. Existing seed test failure: missing `ui.guided2d.progress` on origin/dev. | Complete |
| HR-04 | 4abcba5 | focused Playwright 22/22; typecheck/lint/build pass | poster/neutral screenshots inspected; fixture illustration only, CMS poster sign-off deferred to HR-12 | Complete |
| HR-05 | a7d3489, 2706a52 | focused Playwright 22/22; typecheck/lint/build pass | hero eager, featured/card lazy; portrait transparent SVG remains contained; no model/audio requests | Complete |
| HR-06 | 8140348 | `home-featured.spec.ts` 8/8; typecheck/lint pass | 390/1024/1440 light/dark screenshots; UI sign-off deferred to HR-12 | Complete |
| HR-07 | dc6eac1 | homepage + public translations 20/20; typecheck/lint pass; seed spec 4/5 (baseline `ui.guided2d.progress` missing) | 390/1440 light/dark screenshots; translation seed added 8, rerun added 0; UI sign-off deferred to HR-12 | Complete |
| HR-08 | — | Chưa chạy | — | TODO |
| HR-09 | — | Chưa chạy | — | TODO |
| HR-10 | — | Chưa chạy | — | TODO |
| HR-11 | — | Chưa chạy | — | TODO |
| HR-12 | — | Chưa chạy | Chưa chụp | TODO |

**Bằng chứng phải là sự kiện thực:** không tự điền SHAs, test count hoặc browser audit kết quả. Nếu task không có diff, ghi `no-op` có giải thích và không commit rỗng. Bug trong QA được thêm dòng `fix` và regression cùng SHA tương ứng.

## Handoff / quy trình Git

- Một nhánh `feat/public-homepage-redesign` và một PR base `dev`; `HR-*` là mã task nội bộ, không phải số PR.
- Không push trực tiếp `dev`; không merge nếu không được yêu cầu. Không stage `.env`, cache, test screenshots hoặc build outputs.
- Bàn giao gồm branch/base SHA thực, log commits, code/test diff summary, kết quả gate, ảnh, manual checks còn thiếu, và điểm người dùng cần duyệt. Title/mô tả PR được soạn dựa trên code đã push khi được yêu cầu.
