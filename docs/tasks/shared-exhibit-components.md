# Task T-SHARED-EXHIBIT: Shared Exhibit Components

**Trạng thái:** Đã triển khai trên `feat/shared-exhibit-components`; local branch ahead 10 commits, chưa push/PR/merge.\
**Nhánh:** `feat/shared-exhibit-components`, tạo từ `origin/dev` tại `e63677f` sau khi xác nhận PR #195 đã merge Public Foundation.\
**Plan:** [shared-exhibit-components-plan.md](../plans/shared-exhibit-components-plan.md).\
**Design:** [PUBLIC_PORTAL_DESIGN.md](../architecture/fe/PUBLIC_PORTAL_DESIGN.md).\
**Convention:** [Frontend coding conventions](../architecture/fe/coding-conventions.md).

## Mục tiêu

Nâng cấp **thẻ hiện vật và lưới hiện vật dùng chung** theo thiết kế Public Portal mới, giúp Homepage và Collection có kiểu trình bày nhất quán, ảnh/media fallback chuẩn, điều hướng chi tiết rõ và giữ nguyên các thao tác yêu thích/so sánh/báo nội dung.

Đây là bước chuẩn hóa shared component trước các đợt redesign riêng Homepage, Collection và Exhibit Detail. Không thay nội dung/bố cục toàn bộ các trang ở lượt này.

## Hiện trạng và phụ thuộc

- `ExhibitGrid` đã tồn tại và được gọi bởi `HomeFeaturedExhibits` và `CollectionPage`; task là **refactor + redesign**, không phải tạo grid mới.
- `ExhibitGrid` hiện sở hữu cả markup card và CSS; `ExhibitImage` đã có ảnh hoặc placeholder `ExhibitPreview` khi thiếu/lỗi.
- Public Foundation cung cấp `--public-*` scoped tokens (ivory, forest green, bronze, typography, dark palette). Cần baseline chứa Foundation trước khi code; tránh copy token từ global.
- SDD không cho phép nhãn chất liệu/niên đại/featured/bảo vật vì public DTO chưa có; không dựng ảnh mẫu hoặc thông tin giả.
- Baseline `dev` và `feat/public-foundation` phải được kiểm tra lại khi bắt đầu; SHA trong tài liệu plan là ảnh chụp thời điểm viết, không phải cam kết base cho tương lai.

## Phạm vi đã chốt

- Extract `ExhibitCard` để tách component presentational khỏi `ExhibitGrid` và giữ nguyên props/callbacks của grid.
- Redesign card: nền ivory/paper, typography serif/sans, viền bronze tiết chế, CTA xanh forest, ảnh 4:3 contain, hover/focus có kiểm soát.
- Grid responsive 1/2/3 cột theo chiều rộng **vùng chứa** để tương thích layout Collection có sidebar ở đợt sau.
- Ảnh có alt theo locale, thiếu/lỗi ảnh dùng đúng placeholder; giữ tên/mô tả đã xuất bản.
- Link tới Detail và action phụ của Collection (Favorite/Compare/Report) không chồng sự kiện; touch/keyboard dễ sử dụng.
- Chạy kiểm thử unit/browser và hồi quy Home/Collection/visitor flow; chụp ảnh QA trên viewport/theme chính.

## Ngoài phạm vi

Không sửa backend, API, DB/CMS, model GLB, 3D room, Detail Viewer, audio, Guided Tour logic, header/footer, Hero Homepage, Collection filters/search, visitor stores hay global Mantine theme. Không thêm badges theo category/chất liệu/năm nếu chưa có dữ liệu.

## Task và commit dự kiến

| Task | Deliverable kiểm chứng độc lập | Commit đề xuất |
|---|---|---|
| SEC-01 | Baseline, xác minh Foundation/base, scope và tài liệu | `docs(public): plan shared exhibit component redesign` |
| SEC-02 | Extract `ExhibitCard`, giữ nguyên UI, props và chức năng | `refactor(public): extract presentational exhibit card` |
| SEC-03 | Palette, typography, card surface theo heritage style | `style(public): apply heritage palette and card typography` |
| SEC-04 | Media frame 4:3, ảnh contain và placeholder presentation | `style(public): standardize exhibit media frame` |
| SEC-05 | Grid 1/2/3 cột theo container có thật | `style(public): make exhibit grid container responsive` |
| SEC-06 | Đồng bộ nội dung theo locale và image alt | `fix(public): localize shared exhibit content and image alt` |
| SEC-07 | Detail link và Report/Favorite/Compare độc lập với keyboard | `fix(public): keep exhibit card actions independent` nếu cần; nếu không, `test(public): cover exhibit card actions` |
| SEC-08 | Regression media missing/error và không tải GLB/Canvas/audio | `test(public): cover exhibit media fallbacks and resource isolation` |
| SEC-09 | Regression integration Home/Collection, responsive và a11y | `test(public): verify shared cards across home and collection` |
| SEC-10 | Final quality gates, SHA ledger và bàn giao QA | `docs(public): record shared exhibit verification` |

**Không cần đúng mười commit nếu không có thay đổi thực tế.** Một commit giải quyết một lý do thay đổi; code và test chứng minh thay đổi nên cùng commit. Nếu phát hiện lỗi trong test/QA thì dùng `fix(...)` độc lập với regression. Mỗi commit phải được kiểm chứng, xem staged diff và giữ code ở trạng thái build được. Mã `SEC-*` là định danh task nội bộ, không phải số PR.

## Checklist thực hiện

### SEC-01 — Baseline và tài liệu

- [x] Fetch `origin/dev` (`e63677f`); xác nhận Foundation đã merge qua PR #195; tạo branch riêng và giữ nguyên working tree.
- [x] Kiểm callers/contracts bằng CodeGraph và đọc Public Portal design + coding conventions.
- [x] Baseline typecheck/lint/unit/build; focused Playwright 51/53 (2 assertion failures, nguyên nhân ghi dưới); chụp 8 ảnh Home/Collection tại 390/1440 light/dark.
- [x] Review plan/task và baseline; commit tài liệu SEC-01 riêng.

### SEC-02 — Extract `ExhibitCard`

- [x] Khóa tests về `ul/li`, thứ tự, H3, encoded Detail link và action callbacks.
- [x] Tạo `ExhibitCard.tsx`, `.module.css`; chuyển JSX và CSS cũ, giữ UI/DOM/semantics và Grid props.
- [x] Không đổi palette/breakpoints/ảnh/logic consumer trong commit refactor.
- [x] Chạy Home/Collection/favorite/compare, typecheck/lint; review staged diff, commit riêng.

### SEC-03 — Palette và typography

- [x] Đổi glass/glow sang scoped `--public-*` paper/forest/bronze; không sửa global theme.
- [x] Serif cho tên, sans cho mô tả/action; kiểm spacing, border, focus/hover và contrast light/dark.
- [x] Không thêm badge category, niên đại, chất liệu hay claims không có trong API.
- [x] Test/screenshot card ở Home/Collection, review diff và commit riêng.

### SEC-04 — Khung ảnh hiện vật

- [x] Tạo khung media 4:3 có chỗ giữ trước load, ảnh dùng `contain` không crop/méo.
- [x] Placeholder khi media thiếu vẫn có nhãn đúng, không biến art thay thế thành ảnh hiện vật thật.
- [ ] Chưa có fixture ảnh ngang/dọc/nền trong suốt riêng; `object-fit: contain` và media frame đã kiểm ở 390px.
- [x] Chạy focused checks, review CSS/fixtures đã stage, commit riêng.

### SEC-05 — Grid theo container

- [x] Grid hiển thị 1/2/3 cột theo bề rộng khả dụng, tối đa 3 cột; giữ `ul/li` và DOM order.
- [x] Test container hẹp 600px và responsive 320/390/768/1024/1440; suite Home/Collection kiểm tra nội dung dài.
- [x] Không sửa Collection sidebar hoặc logic tìm kiếm; test Home/Collection, commit riêng.

### SEC-06 — Localization và alt text

- [x] Chọn English trong UI và xác minh tên/alt của Collection; mặc định Vietnamese và helper fallback được bao phủ bởi suite locale/helper hiện có.
- [x] Consumer localize trước Grid: Collection giữ logic hiện tại; HomeFeatured map `localizeExhibit` sau sort/slice; Card dùng `localizedAltText`.
- [x] Không mutate DTO/cache, không translate hai lần, không đổi số/thứ tự featured hoặc search Collection.
- [x] Chạy tests i18n/Home/Collection và commit riêng.

### SEC-07 — Liên kết và action

- [x] Test Enter cho Detail, click Report không điều hướng, Favorite/Compare callback và keyboard dialog.
- [x] Kiểm không nested interactive và focus ring; touch targets không được đo trên thiết bị thật.
- [x] Không sửa visitor stores; hành vi đúng, commit tests riêng.

### SEC-08 — Media/error/resource regression

- [x] Tests ảnh thật/null/404/src đổi và placeholder nhãn; placeholder nền paper kiểm bằng computed style.
- [x] Theo dõi request: render card không tải endpoint model/audio; grid không chứa Canvas.
- [x] Screenshot phát hiện placeholder theo Aura gradient; đã sửa scoped palette kèm regression.
- [x] Chạy image/audio + Home/Collection focused suites; 60 focused integration tests pass.

### SEC-09 — Integration QA

- [x] Chạy Home featured/Collection/global search/favorite/compare/report/locale/keyboard regression: 60/60 pass.
- [x] Chụp 20 screenshots Home/Collection × 5 viewport × 2 theme; kiểm fallback và focus. Reduced-motion chỉ kiểm CSS rule, không test chuyển động thực.
- [ ] Chưa kiểm zoom 200/400%, screen reader hoặc mobile thật.
- [x] `/tour` qua public image/audio suite; Admin không chạy riêng, nhưng không sửa global CSS/theme/Admin code (chỉ CSS Modules card/grid).

### SEC-10 — Final verification và bàn giao

- [x] Typecheck/lint pass; unit 65 files / 408 tests pass; build pass (cảnh báo chunk >500 kB); focused Playwright 60/60 pass.
- [x] Review diff từ `origin/dev`, commit log, changed paths và `git diff --check`; chỉ có docs, Home/Card/Grid CSS/TS và tests trong scope.
- [x] Ghi SHA, tests, screenshot matrix và giới hạn manual QA vào evidence table.
- [x] Bàn giao trên local branch; chờ bạn xem screenshot. Không push/PR/merge theo yêu cầu.

## Acceptance criteria

- [x] Homepage và Collection dùng `ExhibitGrid` + `ExhibitCard` thống nhất, mỗi hiện vật một `li`, heading/link đúng.
- [x] Homepage vẫn lấy tối đa 3 mục từ phòng đầu tiên theo thứ tự đã xuất bản; Collection giữ room selection, local/global search, favorite filter, comparison, report và Guided Tour.
- [x] Card đúng tone ivory/forest/bronze; ảnh `contain`; text dài và 1/2/3 cột được kiểm trên responsive suites.
- [x] Không ảnh/lỗi ảnh có placeholder, alt đúng locale; không bịa nhãn niên đại/chất liệu hay tải GLB.
- [x] Link chi tiết và Favorite/Compare/Report độc lập, truy cập bàn phím được; không có nested interactive.
- [ ] Light/dark, reduced-motion, responsive 320px+ và contrast được kiểm thực tế; nội dung CMS không bị thay thế bằng mock data.
- [x] Affected Playwright suites, unit, typecheck, lint, build đạt; warning bundle đã ghi.
- [x] Chỉ sửa file trong scope; không sửa backend/DB/Admin/3D hoặc global theme; commits chia theo thay đổi.
- [ ] Kết quả được người dùng xem/duyệt trước khi PR được coi hoàn thành.

## Evidence / commit ledger

| Task | SHA thực tế / no-op | Tests / kiểm chứng | Screenshot / giới hạn | Trạng thái |
|---|---|---|---|---|
| SEC-01 | `6d5e42f5` | Baseline typecheck/lint pass; unit 65 files / 408 tests pass; build pass; Playwright 51/53. Hai baseline false-positive assertions được sửa ở SEC-08. | 8 baseline screenshots Home/Collection, 390/1440 light/dark. | Hoàn thành |
| SEC-02 | `5917564e` | Shared component contract, Home/Collection/favorites/compare; focused 20/20, typecheck/lint pass. | Markup, props và thứ tự giữ nguyên. | Hoàn thành |
| SEC-03 | `cbc0a564` | Heritage light/dark computed styles, typography và focus; focused 21/21, typecheck/lint pass. | 8 screenshots Home/Collection 390/1440 light/dark. | Hoàn thành |
| SEC-04 | `b866a597` | Media ratio `4:3`, `contain`, missing/error placeholder; 2/2 pass. | Khung 4:3 kiểm ở 390px; chưa có fixture ảnh ngang/dọc riêng. | Hoàn thành |
| SEC-05 | `df2845c6` | 1/2/3 columns at 320/390/768/1024/1440 and forced 600px container; 1/1 pass. | 20-image matrix includes all target widths/themes. | Hoàn thành |
| SEC-06 | `06dd3ef` | Locale picker English updates card name and image alt; existing Vietnamese default/fallback suites pass. | No DTO/cache mutation; Home still selects/sorts/slices first. | Hoàn thành |
| SEC-07 | `a4ac9c4` | Detail Enter, Report remains in Collection; favorite/compare suites 5/5 pass. | No nested interactive elements; focus outline checked. | Hoàn thành |
| SEC-08 | `827904d`, fix `3fc9ca2` | Media/image/audio and Home suites pass; card requests no model/audio; placeholder paper background assertion. | Fixed false-positive Home canvas assertion and lazy-image test; no global HeroCanvas change. | Hoàn thành |
| SEC-09 | no-op verification | Focused integration suite 60/60 pass, including `/tour`. | 20 screenshots in `front-end/test-results/shared-exhibit-sec09/` (ignored). Admin route, zoom, screen reader, real mobile device not tested. | Hoàn thành có giới hạn |
| SEC-10 | final docs commit | Typecheck/lint/unit/build and Playwright 60/60 pass; build retains existing >500 kB chunk warning. | Changes reviewed; no push/PR/merge. | Hoàn thành |

Một task có thể ghi `no-op` nếu hoàn toàn không cần sửa code/tests, **không tạo commit rỗng**. Nếu có bug được tìm thấy trong lúc QA, thêm dòng commit `fix` thực tế với testcase đi kèm, không ép vào message của task khác.

Khi thực thi, chỉ đánh `[x]` sau khi có bằng chứng. Không ghi SHA giả, không suy ra WCAG audit đầy đủ từ tests tự động hoặc từ việc trang không tràn ngang.

## Quy trình nhánh và bàn giao

- Base chuẩn là `origin/dev` mới nhất **đã chứa Public Foundation**. Nếu chưa merge, chờ merge hoặc dùng stacked workflow như plan.
- Một nhánh `feat/shared-exhibit-components`, một PR target `dev` sau khi base phù hợp; tối đa các checkpoint SEC-01…SEC-10, commit nhỏ sau kiểm chứng, không gộp UI refactor với visual hoặc i18n.
- Sau khi hoàn thành, gửi branch, các commit SHA, diff summary, số test pass/fail, screenshot, lưu ý chưa kiểm và đề xuất title/description PR theo yêu cầu; không push/PR/merge tự động.
