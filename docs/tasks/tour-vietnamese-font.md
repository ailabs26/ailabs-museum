# Task: Sửa font tiếng Việt trong tour 3D

**Nhánh:** `fix/tour-vietnamese-font`, từ `origin/dev` tại `806ebcf`.
**Trạng thái:** Đã sửa và kiểm chứng kỹ thuật, chờ người dùng xác nhận hiển thị trực quan.
**Plan:** [tour-vietnamese-font-plan.md](../plans/tour-vietnamese-font-plan.md).

## Lỗi và bằng chứng

Kiểm tra Edge với API thật: `[Mẫu] Bình nước dã chiến` trong thẻ danh mục và panel chi tiết đều ở dạng Unicode NFC, không có combining mark rời trong DOM. CDP `CSS.getPlatformFontsForNode` báo cả Georgia và Times New Roman dùng để render cùng tiêu đề. Tiêu đề phòng cũng trộn hai font.

CSS tour mới dùng Georgia ở title danh mục, detail panel, heading phòng và intro. Canvas texture bảng tên dùng `30px Georgia, serif`. Trang chủ đã từng sửa cùng lỗi bằng Times New Roman.

Thử style tạm trong browser (đã tháo bỏ sau kiểm tra): Times New Roman giúp ba tiêu đề DOM chỉ dùng một font, gồm glyph bold/regular phù hợp. Đây là bằng chứng font fallback trên máy kiểm tra, chưa phải visual review mọi nền tảng hoặc bằng chứng canvas texture đã sửa.

## Phạm vi đề xuất

- Đổi font serif của danh mục, tiêu đề panel, heading phòng/intro và bảng tên canvas sang `'Times New Roman', serif`.
- Giữ font-size/weight/layout, dữ liệu tiếng Việt, luồng chọn hiện vật và scene lifecycle.
- Thêm kiểm tra hồi quy title hiện vật 2 ở catalogue/panel, cùng text bảng tên canvas; không sửa dữ liệu trong Supabase.
- Test font thực tế qua CDP trên Edge Windows; hệ điều hành khác có thể dùng serif fallback khác, không tuyên bố mọi máy dùng Times New Roman.

## Điều kiện nghiệm thu

- [x] Người dùng duyệt tài liệu trước commit/triển khai.
- [x] Tiêu đề “Bình nước dã chiến” không trộn Georgia với font fallback ở catalogue/panel trên môi trường Edge đã khảo sát (CDP).
- [x] Canvas2D fillText dùng font stack đã chốt và chuỗi tiêu đề nguyên vẹn; không thay cho visual review texture.
- [x] Chọn/đóng chi tiết và render scene hoạt động; panel không tràn ngang 320/768/1024/1440 px.
- [x] Typecheck/lint/build và kiểm tra hồi quy liên quan đạt.
- [ ] Người dùng xác nhận hiển thị trực quan OK, mô tả PR được duyệt trước tạo.

## Commit dự kiến

1. `docs(tour): plan Vietnamese typography fix` — task/plan sau duyệt.
2. `fix(tour): use consistent serif font for Vietnamese titles` — thay đổi font và kiểm tra hồi quy, sau verification.

## Bằng chứng triển khai

- Commit tài liệu `f43573f`, sau khi người dùng duyệt.
- Tests font viết trước: 2/2 thất bại đúng vì catalogue trả `Georgia, serif` và canvas fillText trả `30px Georgia, serif`. Lần chạy đầu tool bị ngắt; lần chạy lại cho failure assertion đầy đủ.
- Sau sửa `npm.cmd test -- museum-font.spec.ts museum-interaction.spec.ts`: 16/16 đạt (1.0m). CDP kiểm tra font thực tế catalogue/panel/heading/intro dùng Times New Roman trên Windows Edge, NFC text nguyên vẹn. Canvas2D instrumentation xác nhận title/font string. Tests interaction chứng minh selection, đóng/focus, camera/picking/touch và responsive giữ hành vi.
- Frontend typecheck/lint/build đạt, không thay đổi dependency. Build cảnh báo bundle >500 kB vẫn tồn tại; main 1,378.74 kB và scene 851.31 kB trước gzip.
- Không sửa backend, API hoặc Supabase. Tests dùng fixture; chưa có xác nhận visual sau sửa của người dùng, không tuyên bố mọi OS hoặc GPU thật đã được kiểm tra. Chưa push/PR.
