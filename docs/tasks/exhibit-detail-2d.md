# Task T-DETAIL-2D: Trang chi tiết hiện vật 2D — lượt 1

**Nhánh:** `feat/exhibit-detail-2d`, từ `origin/dev` tại `41c846e`.
**Trạng thái:** Người dùng cho phép triển khai toàn bộ DETAIL-03–07; đang thực hiện từng task/commit trên nhánh hiện tại.
**Plan:** [exhibit-detail-2d-plan.md](../plans/exhibit-detail-2d-plan.md).

## Mục tiêu

Đọc chi tiết một hiện vật public trong trang DOM riêng, không cần WebGL, có đường vào từ collection và hiện vật nổi bật. Tạo nền cho lượt sau: chuyển từ tour/lỗi renderer sang đúng nội dung 2D.

## Phạm vi lượt này

- URL `/collection/:roomSlug/exhibits/:exhibitId` trong PublicLayout, truy cập trực tiếp/reload được.
- Đọc room qua `useMuseumRooms(roomSlug)` và service/schema hiện có, tìm ID trong exhibits đã được validate. Không gọi endpoint admin hoặc tạo public endpoint mới.
- Tên hiện vật là h1; tên phòng và link quay lại collection đúng slug. Minh họa dùng `ExhibitPreview`.
- Mô tả đầy đủ; transcript và hotspot label/body theo thứ tự nếu có. Chuỗi render text, không HTML; thiếu nội dung tùy chọn không hiện section rỗng.
- Loading, API/schema error/retry và phân biệt phòng không công khai, UUID không hợp lệ, hiện vật không có trong phòng với lỗi tải API.
- Không dùng hiện vật từ phòng đầu tiên khi URL chỉ định sai phòng; không dùng sample fallback hoặc cache lỗi thời.
- Thêm link “Xem chi tiết” ở thẻ chung ExhibitGrid, do collection/home truyền roomSlug; link có tên tiếp cận chứa tên hiện vật.
- Đổi URL/hiện vật: nội dung cũ không được hiển thị sai danh tính. Focus h1 hoặc thông báo lỗi thích hợp khi chuyển route; không giành focus người dùng khi background refetch.
- Responsive light/dark, text dài/reflow, bàn phím và không tải scene/Canvas.

## Quyết định đề xuất

Chọn dùng chi tiết phòng API đã có vì đủ dữ liệu public và dùng chung cache/cancellation. Đổi lại, mỗi direct URL tải list phòng và chi tiết phòng; không có endpoint chi tiết một hiện vật public riêng trong lượt này. Trang danh mục/home thêm explicit link, không bọc cả thẻ thành link gây nested controls.

Không gộp panel tour vào trang chi tiết bằng component cấu hình đa chế độ: panel dùng view model 3D/h3, page dùng DTO public/h2. Tái sử dụng preview/data flow; text sections page đơn giản, chưa tạo abstraction mới.

## Task nhỏ và commit riêng

Mỗi task có một commit sau khi kiểm chứng đạt. Code, tests và cập nhật trạng thái của cùng task nằm chung commit. Không tạo commit rỗng hoặc commit test đang fail để đánh dấu hoàn thành.

| Task | Phụ thuộc | Kết quả | Commit dự kiến |
|---|---|---|---|
| DETAIL-01 | Người dùng duyệt | Tài liệu đã chốt, trước code | `docs(detail): plan standalone public exhibit page` |
| DETAIL-02 | 01 | Direct URL đọc tên/minh họa/mô tả | `feat(detail): add basic public exhibit detail page` |
| DETAIL-03 | 02 | Đọc transcript và hotspot nếu có | `feat(detail): show published transcript and hotspots` |
| DETAIL-04 | 02, 03 | Lỗi/thử lại/không tìm thấy và bảo toàn danh tính | `fix(detail): handle unavailable content and request failures` |
| DETAIL-05 | 04 | Link thẻ và quay lại đúng phòng | `feat(detail): link public exhibit cards to detail pages` |
| DETAIL-06 | 05 | Focus/bàn phím/reflow, độc lập WebGL | `fix(detail): preserve accessible navigation without WebGL` |
| DETAIL-07 | 06 | Kiểm chứng live và tài liệu bàn giao | `test(detail): verify live exhibit content and navigation` |

### DETAIL-01 — Duyệt tài liệu

**Nghiệm thu:**
- [x] Người dùng duyệt bản task/plan chia nhỏ này trước commit/code.
- [x] Rà soát và chuẩn bị commit chỉ hai tài liệu trên nhánh `feat/exhibit-detail-2d`; SHA tra git log.

**Kiểm tra:** git status/diff/log, staged diff và `git diff --cached --check`. Không cần build cho tài liệu.

### DETAIL-02 — Trang cơ bản qua URL trực tiếp

**Nghiệm thu:**
- [x] Direct URL/reload hiển thị đúng tên h1, preview, mô tả và phòng từ API public qua tests fixture.
- [x] Tái dùng hook/schema; có guard tải/lỗi/không tìm thấy tối thiểu để không crash hoặc hiện sai hiện vật.
- [x] Tests xác nhận không Canvas/scene/admin API/phòng khác; không hardcode ID hoặc dữ liệu production.

**Kiểm tra:** Playwright nhóm D02 + frontend typecheck/lint/build. Phạm vi: page/CSS, router, test và trạng thái tài liệu.

### DETAIL-03 — Nội dung bổ sung

**Nghiệm thu:**
- [x] Transcript/hotspot xuất hiện nếu có, sort displayOrder/ID.
- [x] Sections tùy chọn không rỗng, mô tả thiếu có thông báo.
- [x] HTML-like text render nguyên văn, không chèn HTML.

**Kiểm tra:** Playwright D02/D03 + frontend typecheck/lint/build; không sửa dữ liệu thật để thử nội dung.

### DETAIL-04 — Trạng thái và danh tính

**Nghiệm thu:**
- [x] Tải/lỗi API/schema và retry rõ ràng, không nhầm not-found.
- [x] UUID/room/cross-room ID guards đúng, không chọn phòng đầu tiên.
- [x] Chuyển URL/refresh lỗi và response cũ không lộ sai nội dung.

**Kiểm tra:** Playwright D02–D04 + frontend typecheck/lint/build. Hoàn thiện guard có từ 02, không để trang thiếu an toàn chỉ để có task mới.

### DETAIL-05 — Đường vào và quay lại

**Nghiệm thu:**
- [ ] Thẻ collection/featured có explicit link với tên tiếp cận chứa tên hiện vật, encode path params.
- [ ] Back link từ detail tới collection đúng slug, độc lập history; không bọc cả thẻ/nested link.
- [ ] Click, Enter, reload và Browser Back giữ đúng room/exhibit trong URL.

**Kiểm tra:** Playwright D05, collection và home-featured + frontend typecheck/lint/build.

### DETAIL-06 — Khả năng tiếp cận và không WebGL

**Nghiệm thu:**
- [ ] Khi route/nội dung đích sẵn sàng, focus title phù hợp; background refetch không giành focus người dùng.
- [ ] WebGL bị chặn vẫn đọc tên/mô tả/transcript/hotspots/preview; không tải scene hoặc Canvas.
- [ ] Heading/bàn phím/reflow 320/768/1024/1440 light/dark và tiếng Việt không mất nội dung.

**Kiểm tra:** Playwright D06 + tất cả tests detail và regression liên quan + frontend typecheck/lint/build. Không tuyên bố audit WCAG đầy đủ chỉ từ các assertions này.

### DETAIL-07 — API thật và bàn giao

**Nghiệm thu:**
- [ ] Live read-only test so sánh DOM với API/schema thật và link/reload đúng; dữ liệu rỗng được báo rõ thay vì coi là populated pass.
- [ ] README/task ghi kết quả, giới hạn, SHA các task trước; unit tests hiện có đạt.
- [ ] Gửi giao diện để người dùng duyệt và mô tả PR trước push/tạo PR; không tự triển khai fallback lượt 2.

**Kiểm tra:** `MUSEUM_LIVE_TEST=1` + `exhibit-detail-live.spec.ts`, unit tests và review diff. Nếu chỉ thêm tests/docs thì không lặp build runtime đã đạt; nếu sửa runtime phải chạy lại gates. SHA commit 07 tra bằng git log, không tạo commit chỉ để ghi SHA của chính nó.

## Chia lượt và checkpoint

- **Lượt A:** DETAIL-01/02; đã mở được trang cơ bản bằng direct URL. Có thể dừng để người dùng xem.
- **Lượt B:** DETAIL-03/04; nội dung tùy chọn và lỗi hoàn thiện. Checkpoint: tests detail hiện có và quality gates đạt.
- **Lượt C:** DETAIL-05/06; đường vào/bàn phím/reflow hoàn thiện. Checkpoint: regressions collection/home/preview giữ hành vi.
- **Bàn giao:** DETAIL-07 và review người dùng. Một nhánh/một PR cho cả nhiệm vụ lượt 1; không merge nhánh chưa đủ nghiệm thu tổng thể.

Các checkpoint là nơi có thể dừng theo yêu cầu người dùng, không mặc định triển khai tất cả trong một lượt. Trước khi bắt đầu sẽ xác nhận phạm vi được phép thực hiện.

## Điều kiện nghiệm thu

- [x] Người dùng duyệt task/plan trước commit/implementation.
- [ ] Direct URL/reload hiển thị đúng hiện vật thuộc đúng phòng public, không hardcode data/ID.
- [ ] Tên, mô tả, transcript/hotspot nếu có; shared preview; không giả vờ có ảnh/model/audio thật.
- [ ] ID/slug sai, room không public, ID không thuộc room, lỗi HTTP/schema và retry có trạng thái đúng.
- [ ] Không leak nội dung cũ khi chuyển URL/refresh lỗi; không request admin hoặc detail phòng khác.
- [ ] Explicit links từ collection/featured và quay lại collection giữ đúng slug; bàn phím/focus đúng.
- [ ] WebGL bị chặn vẫn đọc đủ nội dung trả bởi API; không load scene/Canvas.
- [ ] DOM reflow 320/768/1024/1440 light/dark và font tiếng Việt phù hợp.
- [ ] Typecheck/lint/build, regression tests và live read-only evidence đạt.
- [ ] Người dùng duyệt trực quan, nhận mô tả PR trước khi yêu cầu tạo.

## Ngoài phạm vi

Chưa đổi SceneFallback/panel tour, chưa tự chuyển route khi WebGL lỗi hoặc chọn hiện vật trong 3D theo URL. Không thêm media contract/upload/audio/subtitles/i18n, backend/database/dependency. Ảnh minh họa CSS không thay bộ asset thật. Lượt 2 sẽ xử lý chuyển 3D→2D giữ room/exhibit và focus dựa trên page lượt 1.

## Ledger và checkpoint A

- DETAIL-01 commit `2f943a3`: task/plan bản chia nhỏ đã được duyệt trước code.
- DETAIL-02 tests viết trước. Lần chạy đầu harness bị ngắt; chạy lại ghi RED đúng: h1 là `404` thay vì `Hiện vật 2` do route chưa có. Chỉ test đầu chạy RED vì max-failures; không tuyên bố cả ba tests đều đã fail trước.
- Sau implementation D02 3/3 đạt (11.3s): direct URL/reload đúng dữ liệu, mô tả rỗng có text, unknown room/invalid UUID/missing ID không render preview hoặc hiện vật khác.
- Frontend typecheck/lint/build đạt. Build vẫn cảnh báo >500 kB; main 828.75 kB, scene 851.97 kB, lazy chart 543.94 kB trước gzip.
- Probe API thật chỉ đọc tìm được URL mẫu dưới đây; chưa chạy browser live test hoặc review trực quan trong DETAIL-02. Full live evidence thuộc DETAIL-07.
- URL để người dùng xem: `http://localhost:5173/collection/phong-lich-su-quan-su-viet-nam/exhibits/c8a43701-5f82-4cb1-9d60-a82170000001`.
- Chưa transcript/hotspots, retry hoàn chỉnh, card/back links, focus management hoặc luồng tour fallback. Không sửa backend/database/hook/schema. Chưa push/PR; dừng checkpoint A.

## Ledger các task tiếp theo

- DETAIL-02 commit `dcfb99d`.
- DETAIL-03: tests viết trước, test rich content fail vì thiếu heading Bản thuyết minh; sau sửa 5/5 D02/D03 đạt (13.1s), typecheck/lint/build đạt. Sort hotspot đồng displayOrder theo ID; text HTML-like không tạo thẻ HTML. Người dùng đã yêu cầu tiếp tục tất cả 03–07; không mở rộng sang fallback tour.
- DETAIL-03 commit `58a4f8b`.
- DETAIL-04: test đầu RED thiếu nút Thử lại; sau bổ sung retry/back-to-collection ở trạng thái lỗi/not-found, 9/9 D02–04 đạt (16.2s), typecheck/lint/build đạt. Guards nền đã có từ D02; tests mới chứng minh loading/cross-room/stale refresh/obsolete request, không tuyên bố mỗi test đều RED.
