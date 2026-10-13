# Task T-SEED-DEMO: Seed 5 hiện vật mẫu cho phòng hiện có

Nhánh: `feat/demo-content-seed`.
Base: `896f39b`.
Thiết kế: [demo-content-seed-design.md](../plans/demo-content-seed-design.md).
Plan: [demo-content-seed-plan.md](../plans/demo-content-seed-plan.md).
Trạng thái: thiết kế đã được duyệt, bắt đầu triển khai theo task.

## Mục tiêu

Thêm 5 hiện vật demo vào phòng `phong-lich-su-quan-su-viet-nam` trên PostgreSQL Supabase để API cung cấp dữ liệu cho tour và danh mục 2D.

## Phạm vi

- Lệnh `npm run seed:demo` riêng với script TypeORM trong `back-end/src/database/seeds/`.
- 5 exhibit và 5 approved revision với UUID cố định, chạy trong transaction.
- Dùng phòng và admin có sẵn; giữ dữ liệu phòng/tài khoản/quyền.
- Tên và mô tả ghi rõ dữ liệu mẫu; ảnh/model/audio chưa có.
- Chạy lại không tạo trùng và không ghi đè dữ liệu đã chỉnh sửa.

## Các task dự kiến

| Task | Deliverable | Trạng thái |
|---|---|---|
| SEED-01 | Duyệt thiết kế, bộ 5 nội dung và viết kế hoạch triển khai | Đã duyệt và viết plan |
| SEED-02 | Script seed, lệnh npm, hướng dẫn chạy và kiểm tra hành vi | Chưa triển khai |
| SEED-03 | Chạy trên Supabase đã chỉ định, kiểm tra lần hai và API | Chưa chạy |

## Điều kiện nghiệm thu

- [ ] Có 5 exhibit demo đúng phòng, revision approved và publishedRevisionId hợp lệ.
- [ ] API `/api/rooms/:slug` trả 5 ID demo theo thứ tự, đúng schema frontend.
- [ ] Chạy lại không tạo trùng, không reset nội dung/version/trạng thái đã sửa.
- [ ] Room/admin thiếu, ID xung đột hoặc bộ đôi không nhất quán thì lỗi rõ ràng; không lưu dở dang.
- [ ] Kết nối luôn đóng sau khi thành công hoặc thất bại.
- [ ] Metadata phòng và dữ liệu quản trị không bị thay đổi.
- [ ] Typecheck/lint/build backend và kiểm tra hành vi seed đạt.
- [ ] Ghi bằng chứng chạy và giới hạn nội dung mẫu trong tài liệu.

## Giới hạn

Danh mục `/collection`, media thật và hiện vật nổi bật trên trang chủ là công việc tiếp theo. Không có thao tác migration trong task này. Với thay đổi dữ liệu, PR cần human review trước merge. Người dùng đã cho phép commit theo phần hợp lý sau kiểm chứng; push/PR vẫn cần yêu cầu riêng.
