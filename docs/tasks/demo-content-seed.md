# Task T-SEED-DEMO: Seed 5 hiện vật mẫu cho phòng hiện có

Nhánh: `feat/demo-content-seed`.
Base: `896f39b`.
Thiết kế: [demo-content-seed-design.md](../plans/demo-content-seed-design.md).
Plan: [demo-content-seed-plan.md](../plans/demo-content-seed-plan.md).
Trạng thái: đã triển khai và seed trên Supabase, kiểm chứng lần chạy lại và API đạt.

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
| SEED-01 | Duyệt thiết kế, bộ 5 nội dung và viết kế hoạch triển khai | Commit `ce47621` |
| SEED-02 | Script seed, lệnh npm, hướng dẫn chạy và kiểm tra hành vi | Commit `e4a5091`; 6 tests và quality gates đạt |
| SEED-03 | Chạy trên Supabase đã chỉ định, kiểm tra lần hai và API | Đạt; bằng chứng ở mục bên dưới |

## Điều kiện nghiệm thu

- [x] Có 5 exhibit demo đúng phòng, revision approved và publishedRevisionId hợp lệ.
- [x] API `/api/rooms/:slug` trả 5 ID demo theo thứ tự, đúng schema frontend.
- [x] Chạy lại không tạo trùng; snapshot thật không đổi, fake test chứng minh giữ trạng thái/nội dung đã sửa.
- [x] Room/admin không hợp lệ, ID xung đột hoặc bộ đôi không nhất quán bị từ chối qua tests; atomicity sử dụng transaction TypeORM, chưa fault-injection DB thật.
- [x] Kết nối đóng sau thành công/thất bại của transaction qua tests; CLI hai lần chạy thật kết thúc bình thường.
- [x] Metadata phòng và dữ liệu quản trị không bị thay đổi.
- [x] Typecheck/lint/build backend và kiểm tra hành vi seed đạt.
- [x] Ghi bằng chứng chạy và giới hạn nội dung mẫu trong tài liệu.

## Giới hạn

Danh mục `/collection`, media thật và hiện vật nổi bật trên trang chủ là công việc tiếp theo. Không có thao tác migration trong task này. Với thay đổi dữ liệu, PR cần human review trước merge. Người dùng đã cho phép commit theo phần hợp lý sau kiểm chứng; push/PR vẫn cần yêu cầu riêng.

## Bằng chứng SEED-02

Test được viết trước. Lần đầu test command thất bại do thiếu `demo-content.ts` và `seed-demo-content.ts` (TS2307, kèm implicit-any do mất type import); đây là lỗi module chưa tồn tại, chưa phải assertion RED runtime. Sau implementation: 6/6 tests đạt, backend typecheck/lint/build đạt. Tests dùng fake transaction/manager để kiểm tra tạo mới, giữ bản đã chỉnh sửa/ẩn/xóa mềm, xung đột/bộ đôi thiếu, điều kiện phòng/admin và đóng kết nối. Không coi fake rollback là bằng chứng PostgreSQL rollback thật; SEED-03 chứng minh tích hợp với database/API.

## Bằng chứng SEED-03

Script kiểm chứng tạm `verify-demo-seed.cjs` chạy từ backend, sử dụng `pg` và `ts-node` có sẵn; credential không in ra và không lưu trong repo. User đã đồng ý ghi vào phòng hiện có trên Supabase.

- Trước: 1 phòng đích, 0 exhibit và 0 revision.
- Lần 1 `npm.cmd run seed:demo`: tạo 5, bỏ qua 0; exit 0.
- Kiểm tra trực tiếp PostgreSQL: 5 exhibit đúng room, visible và publishedRevisionId trỏ tới approved revision đúng exhibit.
- Lần 2: tạo 0, bỏ qua 5; exit 0. Toàn bộ snapshot exhibit/revision (bao gồm content, version, liên kết và timestamp) không thay đổi so với sau lần 1.
- Metadata phòng giữ nguyên; users/roles/permissions/user_roles/role_permissions/media/hotspots/migrations giữ nguyên. Không có exhibit/revision ngoài bộ demo bị sửa.
- API list/detail HTTP 200; đủ 5 ID demo theo displayOrder 0–4. Parse bằng `roomResponseSchema(roomListSchema)` và `roomResponseSchema(roomDetailSchema)` thật của frontend đạt. Import schema ESM vào kiểm chứng CommonJS cần `ts-node moduleTypes` với absolute path; không sửa source/config frontend.
- Slug không tồn tại trả HTTP 404.
- Không fault-injection, ẩn/xóa hoặc chỉnh sửa thử dữ liệu trên DB dùng chung. Test bảo toàn bản chỉnh sửa dùng fake DB riêng.

Đây là nội dung demo: image/model/audio null, hotspots rỗng; chưa là dataset nghiệm thu hiện vật thật. Không sửa UI `/collection` trong nhánh này. Chưa push hoặc tạo PR; cần human review trước merge vì có thay đổi dữ liệu.
