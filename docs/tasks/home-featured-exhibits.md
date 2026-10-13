# Task T-HOME-FEATURED: Hiện vật nổi bật trên trang chủ

**Trạng thái:** Người dùng đã duyệt task/plan và yêu cầu triển khai trên nhánh riêng.
**Bản code khảo sát:** `dev` tại `8f320c8`.
**Nhánh:** `feat/home-featured-exhibits`, đã tạo từ `origin/dev` tại `8f320c8`.
**Plan:** [home-featured-exhibits-plan.md](../plans/home-featured-exhibits-plan.md).

## Mục tiêu

Thay khoảng trống dưới “Hiện vật nổi bật” bằng tối đa 3 hiện vật public lấy qua NestJS API; dùng cùng cách trình bày thẻ với collection và sửa câu giới thiệu gây nhầm vị trí danh mục.

## Quy tắc dữ liệu đề xuất

- Lấy phòng đầu tiên trong danh sách công khai theo thứ tự API. Không hardcode slug phòng lịch sử quân sự.
- Sắp xếp bản sao danh sách hiện vật theo `displayOrder`, sau đó ID; lấy tối đa 3 mục đầu.
- Đây là quy tắc giới thiệu tạm thời, không phải cờ “nổi bật” trong CMS. Hiển thị tên phòng và ghi “Một số hiện vật theo thứ tự trưng bày” để làm rõ.
- Phòng đầu tiên không có hiện vật: hiện trạng thái rỗng; không tự tải toàn bộ các phòng để tìm đủ 3.
- Nếu chỉ có 1–2 hiện vật, hiển thị đúng số lượng; giữ nhãn `[Mẫu]` do API cung cấp.
- Media hiện null: dùng “Chưa có ảnh”, không đoán URL hoặc thêm ảnh giả.
- Link “Xem bộ sưu tập của phòng này” tới `/collection?room=<slug>`.

## Phạm vi giao diện

- Giữ hero, tiêu đề và các liên kết Trang chủ/Bộ sưu tập/3D đang hoạt động.
- Mục nổi bật có loading, empty, error và nút thử lại. API/schema lỗi không được che bằng dữ liệu mẫu hoặc dữ liệu cache lỗi thời.
- Tách phần lưới thẻ collection hiện có thành `ExhibitGrid` dùng chung; không đổi nội dung/hành vi collection.
- Sửa đoạn Về Aura thành: “Khám phá phòng trưng bày trong không gian 3D hoặc đọc câu chuyện của từng hiện vật tại trang Bộ sưu tập. Với hiện vật chưa có mô hình, phòng sử dụng hình khối thay thế.”
- Responsive 1/2/3 cột, light/dark, heading và điều hướng bàn phím phù hợp.

## Task dự kiến và commit

| Task | Deliverable | Commit dự kiến |
|---|---|---|
| HF-01 | Tài liệu được duyệt, nhánh chuẩn bị | `docs(home): plan API-backed featured exhibits` |
| HF-02 | Lưới hiện vật dùng chung, collection giữ nguyên hành vi | `refactor(collection): share public exhibit grid` |
| HF-03 | Trang chủ gọi API, tối đa 3 thẻ, trạng thái và copy cập nhật | `feat(home): display featured exhibits from public API` |
| HF-04 | Kiểm chứng API thật và bằng chứng bàn giao | `test(home): verify live featured content and navigation` |

Commit theo phần thực sự có thay đổi và đã kiểm chứng; không tạo commit rỗng để đủ bảng.

## Điều kiện nghiệm thu

- [x] Người dùng duyệt task/plan trước mọi commit hoặc sửa code.
- [x] Collection dùng lưới chung mà vẫn hiển thị đủ hiện vật, ảnh chưa có và nội dung như trước (10/10 regression tests).
- [x] Trang chủ hiển thị đúng tối đa 3 mục theo thứ tự của phòng đầu tiên, sort bản sao mảng API/cache.
- [x] Tests xác nhận không tải detail phòng khác hoặc scene/Canvas; không có storage client.
- [x] Link collection giữ đúng slug, bàn phím Enter hoạt động.
- [x] Có trạng thái list/detail loading, empty, lỗi/schema lỗi và retry; lỗi refetch ẩn nội dung lỗi thời.
- [x] Hero/giới thiệu vẫn xuất hiện khi API lỗi.
- [x] DOM assertions 320/768/1024/1440 px light/dark không tràn ngang; h1/h2/h3 đúng.
- [x] Typecheck/lint/build, tests collection/navigation và tests nổi bật đạt.
- [ ] Live test đọc API thật, tên và số thẻ khớp response; không ghi database.
- [ ] Người dùng duyệt giao diện; gửi mô tả PR và chờ yêu cầu trước push/tạo PR.

## Ngoài phạm vi

Không chỉnh backend, database, seed, schema media hoặc dependency. Chưa thêm quản trị lựa chọn nổi bật, trang chi tiết, tìm kiếm, phân trang hoặc model/ảnh thật. Không yêu cầu nội dung mẫu trở thành hồ sơ hiện vật thật.

## Điểm cần duyệt

Người dùng đã duyệt quy tắc **phòng đầu tiên của API + 3 hiện vật đầu theo thứ tự trưng bày**, gồm cách xử lý phòng đó rỗng.

## Ledger và bằng chứng

- HF-01 commit `e9ecc46`: task/plan đã duyệt, trước code.
- HF-02 baseline collection 10/10 đạt (37.5s); sau tách ExhibitGrid 10/10 đạt (42.4s). Frontend typecheck/lint/build đạt; vẫn cảnh báo bundle >500 kB. Chỉ di chuyển markup/style thẻ, không đổi hook/service/schema hoặc dữ liệu.
- HF-02 commit `78d3cbb`.
- HF-03 test viết trước: test featured đầu fail đúng vì listitem 0 thay vì 3 (6 tests còn lại chưa chạy do max-failures). Sau implementation bộ focused home/collection/navigation 19/19 đạt (1.6m). Kiểm tra 0/1/2/5 items, sorting/tie ID, loading/error/schema/retry, cached error, keyboard link, no-scene và responsive. Typecheck/lint/build riêng từng lệnh đạt sau tool chained command bị ngắt; main 1,318.18 kB, scene 846.01 kB, cảnh báo >500 kB còn tồn tại.
