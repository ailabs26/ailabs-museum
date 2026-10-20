# Task T-COLLECTION: Danh mục bộ sưu tập 2D

Nhánh: `feat/client-collection`; base `867c977`.
Plan/design: [client-collection-plan.md](../plans/client-collection-plan.md).
Người dùng đã duyệt phạm vi và yêu cầu triển khai; commit theo phần hợp lý sau kiểm chứng, báo nội dung trước PR.

## Phạm vi

Trang `/collection` trong PublicLayout: tiêu đề/giới thiệu, chọn phòng qua URL `?room=slug`, lưới tên/mô tả hiện vật public và vùng “Chưa có ảnh”, link tới tour cùng phòng. Tái sử dụng `useMuseumRooms`, `museumService` và Zod schema Day 2. Không Canvas/WebGL hoặc dữ liệu giả thay API lỗi.

## Task và nghiệm thu

- [x] COL-01: Viết design/plan và commit trước code (`c96dc8c`).
- [x] COL-02: Trang/route, test navigation và nội dung; commit `73c6eed` sau quality gates.
- [x] COL-03: Tests lỗi/rỗng/chuyển phòng/loading/refresh và responsive; kiểm chứng API thật, ghi bằng chứng.
- [x] API thật hiển thị 5 hiện vật seed, giữ nhãn mẫu từ dữ liệu.
- [x] Tên, mô tả và count theo dữ liệu, không giới hạn cứng 5.
- [x] Select có label, URL giữ phòng; tour link giữ slug, không tải Canvas/scene.
- [x] List/detail loading, empty, invalid slug, API/schema error và retry rõ ràng; lỗi/đổi phòng không hiển thị dữ liệu cũ sai phòng.
- [x] Responsive light/dark 320/768/1024/1440 px, navigation bàn phím và heading đúng qua DOM assertions.
- [x] Typecheck/lint/build và focused Playwright tests đạt.
- [ ] Người dùng duyệt giao diện trực quan trước bàn giao PR.

## Giới hạn

Schema hiện chỉ hỗ trợ media null: không đoán URL ảnh, dùng nhãn “Chưa có ảnh”. Không đổi backend/database/tour hay thêm tìm kiếm/phân trang/detail page. Hiện vật nổi bật trên trang chủ giữ trống. Không tuyên bố bộ dữ liệu thật đã nghiệm thu. Duyệt trực quan cần người dùng xác nhận, vì phiên không đọc được ảnh chụp.

## Trạng thái

COL-02 đã dựng page/CSS/route. Hai tests viết trước đều fail trên placeholder (thiếu h1/select), sau implementation 2/2 đạt (8.5s). Tests chứng minh 5 fixture exhibits sorted, name/description, media null labelled, chọn phòng/URL/reload và không tải scene/Canvas. Typecheck/lint/build đạt, build còn cảnh báo >500 kB.

## Bằng chứng COL-03

- Focused tests collection (10) + public tour navigation (2): 12/12 đạt (43.3s). Kiểm tra loading list/detail, empty list/exhibits, invalid slug, HTTP/schema errors, retry, list/detail refresh thất bại ẩn content cũ, chuyển phòng pending và keyboard select/link.
- Responsive DOM assertions với tên/mô tả dài ở 320/768/1024/1440, light/dark đạt. Fixture tên dài lần đầu vượt maxLength 200 nên Zod từ chối đúng; đã sửa fixture thành chuỗi hợp lệ, không nới schema production.
- API thật: `MUSEUM_LIVE_TEST=1`, `npm.cmd test -- collection-live.spec.ts`: 1/1 đạt (4.7s), không interception. API list/detail HTTP 200, schema parse đạt; web render đủ 5 mẫu trong phòng lịch sử quân sự, count khớp response, media null hiển thị “Chưa có ảnh”, không Canvas và tour link giữ slug.
- Frontend unit tests có sẵn: 6/6 đạt. Typecheck/lint đạt sau thêm tests; build đạt trên code runtime cuối (main 1,316.55 kB, scene 846.01 kB; cảnh báo >500 kB).
- Tests trạng thái thêm sau implementation để kiểm chứng/reuse hành vi hook sẵn có; không tuyên bố tất cả đều có RED/GREEN.
- Chưa chạy full tour suite hoặc visual audit/axe; một số tests tour cũ còn kỳ vọng heading trang chủ cũ. Không sửa các tests không thuộc phạm vi này. Không thay đổi backend, database, dependency hoặc hook/service/schema.
- Không ghi thêm dữ liệu Supabase. Chưa push/PR, người dùng cần duyệt UI và nội dung PR trước tạo.
