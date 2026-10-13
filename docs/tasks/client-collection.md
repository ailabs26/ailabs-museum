# Task T-COLLECTION: Danh mục bộ sưu tập 2D

Nhánh: `feat/client-collection`; base `867c977`.
Plan/design: [client-collection-plan.md](../plans/client-collection-plan.md).
Người dùng đã duyệt phạm vi và yêu cầu triển khai; commit theo phần hợp lý sau kiểm chứng, báo nội dung trước PR.

## Phạm vi

Trang `/collection` trong PublicLayout: tiêu đề/giới thiệu, chọn phòng qua URL `?room=slug`, lưới tên/mô tả hiện vật public và vùng “Chưa có ảnh”, link tới tour cùng phòng. Tái sử dụng `useMuseumRooms`, `museumService` và Zod schema Day 2. Không Canvas/WebGL hoặc dữ liệu giả thay API lỗi.

## Task và nghiệm thu

- [x] COL-01: Viết design/plan và commit trước code (`c96dc8c`).
- [ ] COL-02: Trang/route, test navigation và nội dung; commit sau quality gates.
- [ ] COL-03: Tests lỗi/rỗng/chuyển phòng/loading/refresh và responsive; kiểm chứng API thật, commit bằng chứng.
- [ ] API thật hiển thị 5 hiện vật seed, giữ nhãn mẫu từ dữ liệu.
- [ ] Tên, mô tả và count theo dữ liệu, không giới hạn cứng 5.
- [ ] Select có label, URL giữ phòng; tour link giữ slug, không tải Canvas/scene.
- [ ] List/detail loading, empty, invalid slug, API/schema error và retry rõ ràng; lỗi/đổi phòng không hiển thị dữ liệu cũ sai phòng.
- [ ] Responsive light/dark 320/768/1024/1440 px, navigation bàn phím và heading đúng.
- [ ] Typecheck/lint/build và focused Playwright tests đạt.

## Giới hạn

Schema hiện chỉ hỗ trợ media null: không đoán URL ảnh, dùng nhãn “Chưa có ảnh”. Không đổi backend/database/tour hay thêm tìm kiếm/phân trang/detail page. Hiện vật nổi bật trên trang chủ giữ trống. Không tuyên bố bộ dữ liệu thật đã nghiệm thu. Duyệt trực quan cần người dùng xác nhận, vì phiên không đọc được ảnh chụp.

## Trạng thái

COL-02 đã dựng page/CSS/route. Hai tests viết trước đều fail trên placeholder (thiếu h1/select), sau implementation 2/2 đạt (8.5s). Tests chứng minh 5 fixture exhibits sorted, name/description, media null labelled, chọn phòng/URL/reload và không tải scene/Canvas. Typecheck/lint/build đạt, build còn cảnh báo >500 kB. Tiếp tục COL-03; chưa kiểm chứng API thật/visual review trong lượt này.
