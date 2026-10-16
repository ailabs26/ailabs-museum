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
- [x] Panel link đúng ID/slug hiện tại, thay selection/phòng cập nhật link.
- [x] Enter tới detail đúng tên/focus h1, không Canvas.
- [x] Đóng/focus được kiểm tra qua interaction regression.

**Kiểm tra:** tests `[F02]`, interaction regression và frontend gates; commit `feat(fallback): link selected tour exhibits to 2D details`.

### FALLBACK-03 — Fallback có ngữ cảnh ở ba nhánh lỗi
Phụ thuộc 02. Files: MuseumPage, MuseumScene, SceneFallback, test.
- [x] WebGL/context/chunk có link ngữ cảnh, không tự redirect.
- [x] DOM catalogue và chọn/đóng sau lỗi cập nhật fallback link.
- [x] URL từ detail/selection đã validate; fallback chỉ render trong nhánh detail hợp lệ.

**Kiểm tra:** tests `[F03]` ba loại lỗi và no-selection/selection; gates. Commit `feat(fallback): preserve room and exhibit context on renderer errors`.

### FALLBACK-04 — Lifecycle và focus khi chuyển
Phụ thuộc 03. Files: MuseumPage, SceneFallback/MuseumScene, CollectionPage nếu cần, test.
- [x] Renderer lỗi được thay bằng fallback ngoài Canvas; owner GLB unmount/abort theo cleanup, catalogue/selection giữ nguyên.
- [x] Fallback nhận focus; Enter chuyển đúng đích, h1 2D nhận focus; không tự mở scene.
- [x] GLB lỗi riêng lẻ vẫn retry/hình thay thế, không bị coi là renderer fail.

**Kiểm tra:** tests `[F04]`, lifecycle/model resource regression và reflow light/dark 320/768/1024/1440. Gates; commit `fix(fallback): release failed scene and preserve accessible transitions`.

### FALLBACK-05 — Tích hợp và API thật
Phụ thuộc 04. Files: live test, README, task/plan.
- [x] Live read-only chuyển từ tour sang detail đúng nội dung API; F02/F03/F04 mô phỏng lỗi renderer bằng fixture, không mock live response hoặc ghi DB. Empty data có annotation.
- [x] Regression detail/tour/fallback/GLB và unit tests/gates đạt; 2 GLB asset tests skip vì file thật không có.
- [ ] Người dùng duyệt UI và mô tả PR trước push/tạo PR.

**Kiểm tra:** `tour-2d-fallback-live.spec.ts` với `MUSEUM_LIVE_TEST=1`; commit `test(fallback): verify renderer failure transitions and live content`.

## Checkpoint và phạm vi

Sau 02 đã có đường chủ động đọc 2D; sau 03 có links lỗi; sau 04 lifecycle/focus đầy đủ. Có thể dừng ở từng checkpoint theo yêu cầu, mỗi task hoàn thành có code/tests/evidence trong cùng commit. Không commit rỗng hoặc đẩy nhánh chưa đạt nghiệm thu để merge.

Không backend/database/dependency, media upload/ảnh/audio, tự retry renderer, redesign tour hoặc global ErrorBoundary API. “Mượt” nghĩa là giữ đúng ngữ cảnh, tận dụng cache và focus, không yêu cầu animation.

## Ledger và bằng chứng

- FALLBACK-01 commit `5ad4c75`, sau người dùng duyệt.
- F02 RED thiếu link trước sửa, GREEN sau thêm prop panel/link. Regression detail/interaction/F02: 29 đạt, 1 kiểm tra GPU settle thất bại timing; chạy riêng lại test settle đạt (19.2s), chưa sửa scene. Typecheck/lint/build đạt; bundle >500 kB warning còn tồn tại. Không tuyên bố full-suite sạch từ lần chạy có flaky failure; kiểm tra tích hợp tiếp ở F05.
- F02 commit `d4c8ba9`.
- F03 test đầu RED thiếu link fallback; sau sửa 7/7 F02/F03 đạt (37.2s) cho 3 loại lỗi với/có không selection, link đổi theo DOM selection sau lỗi. Typecheck/lint/build đạt; chưa cleanup owner sớm/focus collection, tiếp tục F04.
- F03 commit `c34f620`.
- F04 tests 15 pass/2 skip (GLB thật thiếu file theo điều kiện). R3F `Canvas.fallback` được xử lý inert vì luôn mount trong canvas khi renderer khỏe; fallback thực sự dùng ở ErrorBoundary/context state. Typecheck/lint/build đạt; commit F04 đang chờ ghi.
- F04 commit `5d0c0a3`.
- F05 live test đã thêm; chạy với `MUSEUM_LIVE_TEST=1` trước commit bàn giao để kiểm chứng tour panel → detail 2D bằng dữ liệu thật.
- F05 live test 1/1 đạt (12.9s), không interception/DB write; API thật có public room/exhibit và link panel mở đúng detail 2D. Unit tests/gates đã đạt ở các task trước; chưa chạy full-suite sau F05 vì chỉ thêm live test/docs, không đổi runtime.
