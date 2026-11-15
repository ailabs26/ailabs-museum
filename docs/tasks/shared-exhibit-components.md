# Task T-SHARED-EXHIBIT: Shared Exhibit Components

**Trạng thái:** Đang triển khai trên `feat/shared-exhibit-components`; SEC-01 baseline đã kiểm tra.\
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

- [ ] Khóa tests về `ul/li`, thứ tự, H3, encoded Detail link và action callbacks.
- [ ] Tạo `ExhibitCard.tsx`, `.module.css`; chuyển JSX và CSS cũ, giữ UI/DOM/semantics và Grid props.
- [ ] Không đổi palette/breakpoints/ảnh/logic consumer trong commit refactor.
- [ ] Chạy Home/Collection/favorite/compare, typecheck/lint; review staged diff, commit riêng.

### SEC-03 — Palette và typography

- [ ] Đổi glass/glow sang scoped `--public-*` paper/forest/bronze; không sửa global theme.
- [ ] Serif cho tên, sans cho mô tả/action; kiểm spacing, border, focus/hover và contrast light/dark.
- [ ] Không thêm badge category, niên đại, chất liệu hay claims không có trong API.
- [ ] Test/screenshot card ở Home/Collection, review diff và commit riêng.

### SEC-04 — Khung ảnh hiện vật

- [ ] Tạo khung media 4:3 có chỗ giữ trước load, ảnh dùng `contain` không crop/méo.
- [ ] Placeholder khi media thiếu vẫn có nhãn đúng, không biến art thay thế thành ảnh hiện vật thật.
- [ ] Kiểm ảnh ngang/dọc/nền trong suốt, light/dark và mobile; chỉ sửa `ExhibitImage` nếu test chứng minh lỗi.
- [ ] Chạy focused checks, review CSS/fixtures đã stage, commit riêng.

### SEC-05 — Grid theo container

- [ ] Grid hiển thị 1/2/3 cột theo bề rộng khả dụng, tối đa 3 cột; giữ `ul/li` và DOM order.
- [ ] Test container hẹp của Collection (sidebar tương lai), 320/390/768/1024/1440, không overflow/tên dài.
- [ ] Không sửa Collection sidebar hoặc logic tìm kiếm; test Home/Collection, commit riêng.

### SEC-06 — Localization và alt text

- [ ] Viết tests vi/en/locale thiếu dịch, Home vs Collection; xác minh lỗi grid đang dùng `altText.vi`.
- [ ] Ưu tiên consumer localize trước Grid: Collection giữ logic hiện tại; HomeFeatured map `localizeExhibit` sau sort/slice; Card dùng `localizedAltText`.
- [ ] Không mutate DTO/cache, không translate hai lần, không đổi số/thứ tự featured hoặc search Collection.
- [ ] Chạy tests i18n/Home/Collection và commit riêng.

### SEC-07 — Liên kết và action

- [ ] Test click/Enter cho link Detail, click/Space/Enter cho Report/Favorite/Compare, không bị điều hướng nhầm.
- [ ] Kiểm không nested interactive, tab order, focus visible, kích thước vùng thao tác.
- [ ] Không sửa visitor stores; chỉ fix bug được chứng minh hoặc commit tests nếu hành vi hiện tại đúng.

### SEC-08 — Media/error/resource regression

- [ ] Tests ảnh thật/null/404/src đổi và placeholder shape/color, nhãn đúng.
- [ ] Theo dõi requests bảo đảm Card không tự tải GLB/Canvas/scene/audio.
- [ ] Nếu có bug, commit `fix` kèm regression; nếu không, commit tests focused.
- [ ] Chạy image/audio + Home/Collection focused suites, review diff.

### SEC-09 — Integration QA

- [ ] Chạy Home featured/Collection/global search/favorite/compare/report/locale/keyboard regression.
- [ ] Chụp screenshots 320/390/768/1024/1440 light/dark, kiểm tên dài/fallback/reduced-motion/focus.
- [ ] Thử zoom 200/400%, screen reader/thiết bị thật nếu có môi trường; không tự điền PASS.
- [ ] Test isolation Admin và `/tour`; commit thêm tests nếu cần, bug fix riêng có regression.

### SEC-10 — Final verification và bàn giao

- [ ] Chạy typecheck, lint, test:unit, build, focused Playwright; ghi số lượng pass/fail và cảnh báo thật.
- [ ] Review toàn diff với `origin/dev`, từng `git show <SHA>`, `git diff --check`/staged diff; bỏ file không thuộc scope.
- [ ] Điền SHA/test/screenshot/giới hạn thực tế vào ledger; ghi các no-op checkpoint nếu không phát sinh thay đổi.
- [ ] Gửi kết quả và chờ người dùng duyệt giao diện, push/PR nếu có yêu cầu riêng.

## Acceptance criteria

- [ ] Homepage và Collection dùng `ExhibitGrid` + `ExhibitCard` thống nhất, mỗi hiện vật một `li`, heading/link đúng.
- [ ] Homepage vẫn lấy tối đa 3 mục từ phòng đầu tiên theo thứ tự đã xuất bản; Collection giữ room selection, local/global search, favorite filter, comparison, report và Guided Tour.
- [ ] Card đúng tone ivory/forest/bronze, không dùng neon-glow; ảnh `contain`, text dài không làm vỡ layout; 1/2/3 cột theo container.
- [ ] Không ảnh/lỗi ảnh có placeholder, alt đúng locale; không bịa nhãn niên đại/chất liệu hay tải GLB.
- [ ] Link chi tiết và Favorite/Compare/Report độc lập, truy cập bàn phím được; không có nested interactive.
- [ ] Light/dark, reduced-motion, responsive 320px+ và contrast được kiểm thực tế; nội dung CMS không bị thay thế bằng mock data.
- [ ] Affected Playwright suites, unit, typecheck, lint, build đạt hoặc blocker có bằng chứng.
- [ ] Chỉ sửa file trong scope, không ảnh hưởng backend/DB/Admin/3D; các commit đều có ranh giới rõ, chạy checks trước commit và có thể xem/revert riêng.
- [ ] Kết quả được người dùng xem/duyệt trước khi PR được coi hoàn thành.

## Evidence / commit ledger

| Task | SHA thực tế / no-op | Tests / kiểm chứng | Screenshot / giới hạn | Trạng thái |
|---|---|---|---|---|
| SEC-01 | Sẽ ghi SHA trong ledger SEC-10 | Typecheck/lint pass; unit 65 files / 408 tests pass; build pass (chunk >500 kB warning); Playwright 51/53. Failures: Home checks page-wide canvas though HeroCanvas owns one; homepage image is lazy below fold, test did not scroll before naturalWidth. | 8 baseline screenshots at 390/1440, light/dark under `front-end/test-results/shared-exhibit-baseline/` (ignored). | Baseline captured; two test assertions need scope/scroll correction during test work |
| SEC-02 | — | Chưa chạy | — | TODO |
| SEC-03 | — | Chưa chạy | Chưa chụp | TODO |
| SEC-04 | — | Chưa chạy | Chưa chụp | TODO |
| SEC-05 | — | Chưa chạy | Chưa chụp | TODO |
| SEC-06 | — | Chưa chạy | — | TODO |
| SEC-07 | — | Chưa chạy | — | TODO |
| SEC-08 | — | Chưa chạy | — | TODO |
| SEC-09 | — | Chưa chạy | Chưa chụp | TODO |
| SEC-10 | — | Chưa chạy | Chưa chụp | TODO |

Một task có thể ghi `no-op` nếu hoàn toàn không cần sửa code/tests, **không tạo commit rỗng**. Nếu có bug được tìm thấy trong lúc QA, thêm dòng commit `fix` thực tế với testcase đi kèm, không ép vào message của task khác.

Khi thực thi, chỉ đánh `[x]` sau khi có bằng chứng. Không ghi SHA giả, không suy ra WCAG audit đầy đủ từ tests tự động hoặc từ việc trang không tràn ngang.

## Quy trình nhánh và bàn giao

- Base chuẩn là `origin/dev` mới nhất **đã chứa Public Foundation**. Nếu chưa merge, chờ merge hoặc dùng stacked workflow như plan.
- Một nhánh `feat/shared-exhibit-components`, một PR target `dev` sau khi base phù hợp; tối đa các checkpoint SEC-01…SEC-10, commit nhỏ sau kiểm chứng, không gộp UI refactor với visual hoặc i18n.
- Sau khi hoàn thành, gửi branch, các commit SHA, diff summary, số test pass/fail, screenshot, lưu ý chưa kiểm và đề xuất title/description PR theo yêu cầu; không push/PR/merge tự động.
