# Task T-FALLBACK: Chuyển từ tour 3D sang nội dung 2D

**Nhánh:** `feat/tour-2d-fallback`, base `a78a30e` từ `origin/dev`.
**Trạng thái:** Người dùng đã duyệt và yêu cầu triển khai cả năm task trên nhánh riêng.
**Plan:** [tour-2d-fallback-plan.md](../plans/tour-2d-fallback-plan.md).

## Mục tiêu và quy tắc

Người dùng tiếp tục đọc nội dung khi renderer 3D lỗi, giữ phòng và hiện vật hợp lệ đang chọn. Không tự chuyển trang: hiển thị link để người dùng quyết định, đồng thời giữ danh mục DOM trong tour.

| Ngữ cảnh | Đích đến |
|---|---|
| Panel chi tiết, có hiện vật public đang chọn | Trang `/collection/:roomSlug/exhibits/:exhibitId` |
| Fallback renderer, có hiện vật đang chọn thuộc phòng hiện tại | Trang chi tiết đúng hiện vật |
| Fallback renderer, chưa chọn hiện vật | `/collection?room=<slug>` |
| API/list/detail lỗi hoặc lựa chọn không còn hợp lệ | Giữ trạng thái lỗi API; không tạo link chi tiết từ dữ liệu cũ |

Link panel ghi **“Đọc chi tiết 2D”**; fallback ghi **“Tiếp tục đọc trong giao diện 2D”** và giữ link đọc danh mục tại chỗ. Path/query được encode bằng cơ chế sẵn có. Không thêm selection 3D vào URL tour hoặc chọn lại hiện vật khi quay lại tour trong lượt này.

## Các lỗi phải xử lý

- Thiết bị không có WebGL hoặc không khởi tạo được Canvas.
- `webglcontextlost` khi đang xem.
- Lỗi tải chunk/render scene được ErrorBoundary bắt.

**Lỗi GLB riêng lẻ không phải lỗi renderer:** giữ hình khối thay thế, trạng thái tải lỗi và thử lại hiện có; không đóng cả phòng hoặc tự chuyển 2D. Không thay lỗi API bằng nội dung giả.

## Task nhỏ và một commit mỗi task

### FALLBACK-01 — Duyệt và commit tài liệu
- [x] Người dùng duyệt hai tài liệu trước commit/code.
- [x] Review và chuẩn bị commit task/plan trên nhánh riêng; SHA tra git log.

**Kiểm tra:** status/diff/log, staged diff/check; commit `docs(fallback): plan contextual tour to 2D navigation`.

### FALLBACK-02 — Link chủ động từ panel
Phụ thuộc 01. Files: MuseumPage, ExhibitDetailPanel, test `tour-2d-fallback.spec.ts`.
- [ ] Panel có link đúng ID/slug của lựa chọn hiện tại, đổi selection/phòng không giữ link cũ.
- [ ] Click/Enter tới detail 2D đúng tên và focus h1, không tự mở Canvas.
- [ ] Đóng panel/trả focus giữ hành vi.

**Kiểm tra:** tests `[F02]`, interaction regression và frontend gates; commit `feat(fallback): link selected tour exhibits to 2D details`.

### FALLBACK-03 — Fallback có ngữ cảnh ở ba nhánh lỗi
Phụ thuộc 02. Files: MuseumPage, MuseumScene, SceneFallback, test.
- [ ] Cả lỗi WebGL/context/chunk có link đúng detail hoặc collection cùng phòng, không redirect tự động.
- [ ] Danh mục và nội dung DOM tại chỗ vẫn đọc/chọn được; fallback link cập nhật khi chọn/đóng hiện vật sau lỗi.
- [ ] Link dùng dữ liệu đã validate của phòng hiện tại; API lỗi không dùng lựa chọn cũ.

**Kiểm tra:** tests `[F03]` ba loại lỗi và no-selection/selection; gates. Commit `feat(fallback): preserve room and exhibit context on renderer errors`.

### FALLBACK-04 — Lifecycle và focus khi chuyển
Phụ thuộc 03. Files: MuseumPage, SceneFallback/MuseumScene, CollectionPage nếu cần, test.
- [ ] Renderer lỗi được tháo khỏi React tree, dừng/cancel owner GLB; catalogue/selection còn nguyên và không lặp mount lỗi.
- [ ] Fallback nhận focus khi lỗi; người dùng Enter chuyển đúng đích, h1 2D nhận focus. Refetch không giành focus hoặc tự mở scene.
- [ ] Back về tour không tự mount Canvas; GLB lỗi riêng lẻ vẫn retry/hình thay thế, không bị coi là renderer fail.

**Kiểm tra:** tests `[F04]`, lifecycle/model resource regression và reflow light/dark 320/768/1024/1440. Gates; commit `fix(fallback): release failed scene and preserve accessible transitions`.

### FALLBACK-05 — Tích hợp và API thật
Phụ thuộc 04. Files: live test, README, task/plan.
- [ ] Live read-only chuyển từ tour sang detail/collection đúng nội dung API; mô phỏng lỗi WebGL bằng browser, không mock response hoặc ghi DB.
- [ ] Regression detail/tour/fallback/GLB và unit tests/gates đạt; ghi riêng tests bỏ qua/giới hạn visual.
- [ ] Người dùng duyệt UI và mô tả PR trước push/tạo PR.

**Kiểm tra:** `tour-2d-fallback-live.spec.ts` với `MUSEUM_LIVE_TEST=1`; commit `test(fallback): verify renderer failure transitions and live content`.

## Checkpoint và phạm vi

Sau 02 đã có đường chủ động đọc 2D; sau 03 có links lỗi; sau 04 lifecycle/focus đầy đủ. Có thể dừng ở từng checkpoint theo yêu cầu, mỗi task hoàn thành có code/tests/evidence trong cùng commit. Không commit rỗng hoặc đẩy nhánh chưa đạt nghiệm thu để merge.

Không backend/database/dependency, media upload/ảnh/audio, tự retry renderer, redesign tour hoặc global ErrorBoundary API. “Mượt” nghĩa là giữ đúng ngữ cảnh, tận dụng cache và focus, không yêu cầu animation.
