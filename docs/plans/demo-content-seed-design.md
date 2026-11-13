# Thiết kế seed nội dung mẫu cho phòng lịch sử quân sự

## Bối cảnh và quyết định đã chốt

- Nhánh: `feat/demo-content-seed`, base `896f39b`.
- Người dùng đồng ý thêm dữ liệu vào phòng đang có trên Supabase.
- Phòng đích: slug `phong-lich-su-quan-su-viet-nam`; giữ nguyên tên, trạng thái và metadata.
- Kiểm tra chỉ đọc: phòng active, chưa xóa, chưa có hiện vật; tài khoản `SEED_ADMIN_EMAIL` tồn tại và active.
- Người dùng đã duyệt thiết kế và cho phép commit theo phần có thể kiểm chứng.

## Cách thực hiện

**Đề xuất: script TypeORM riêng** dùng data source backend và lệnh `npm run seed:demo`. Tái sử dụng kết nối, entity và dotenv hiện có; transaction bảo đảm chèn nguyên tử, ID cố định giúp chạy lại không trùng.

**Phương án khác: SQL trong Supabase SQL Editor.** Có thể chèn nhanh nhưng phải duy trì riêng mapping cột, khóa ngoại và kiểm tra chạy lại. Không chọn vì mục tiêu là có seed tái sử dụng trong repo.

Không sửa script seed quản trị vì script đó đồng bộ quyền vai trò mỗi lần chạy; seed nội dung không cần thay đổi quyền hoặc tài khoản.

## Nội dung mẫu đề xuất

Tên có tiền tố `[Mẫu]`; mỗi mô tả ghi rõ là dữ liệu phát triển, chưa phải hồ sơ hiện vật đã được thẩm định. Không gán niên đại, đơn vị sử dụng hoặc nguồn gốc lịch sử chưa xác minh.

| Thứ tự | Tên | Hình khối thay thế | Vị trí x/y/z |
|---|---|---|---|
| 0 | [Mẫu] Mũ bảo hộ | sphere | -4 / 0 / -4 |
| 1 | [Mẫu] Bình nước dã chiến | cylinder | 0 / 0 / -4 |
| 2 | [Mẫu] Ba lô hành quân | box | 4 / 0 / -4 |
| 3 | [Mẫu] La bàn | torus | -3 / 0 / 3 |
| 4 | [Mẫu] Máy thông tin liên lạc | box | 3 / 0 / 3 |

Vị trí nằm trong giới hạn phòng Day 2, có khoảng cách cho bệ và hình khối. Shape là placeholder phục vụ kiểm tra hiển thị, không phải hình dạng mô phỏng chính xác hiện vật.

## Dữ liệu và luồng ghi

1. Kiểm tra `DATABASE_URL`, `SEED_ADMIN_EMAIL`; không log thông tin kết nối hoặc mật khẩu.
2. Khởi tạo data source, mở một transaction và khóa phòng đích trong transaction để tuần tự hóa các lần chạy seed cùng phòng.
3. Xác nhận phòng active/chưa xóa và admin active/chưa xóa, có vai trò admin. Thiếu điều kiện thì kết thúc với lỗi, không tự tạo phòng hoặc user.
4. Kiểm tra bộ UUID cố định dành riêng cho 5 exhibit và 5 revision. Nếu ID thuộc phòng khác, revision mồ côi hoặc bộ đôi thiếu một nửa: lỗi và rollback, không tự sửa dữ liệu bất thường.
5. Với mỗi bộ đôi chưa tồn tại: tạo exhibit hidden, tạo revision số 1 approved với content có name/description/position/shape/color, `createdById`/`reviewedById` là admin và `reviewedAt` hiện tại. Sau đó liên kết `publishedRevisionId`, đặt visible và version 1.
6. Bộ đôi đã tồn tại hợp lệ: bỏ qua, không cập nhật nội dung, không hiện lại hiện vật đã bị ẩn, không đổi published revision hiện hành hoặc reset version.
7. Commit; log số bản ghi tạo mới/bỏ qua; đóng kết nối bằng finally. Lỗi trả exit code khác 0.

Script seed chủ đích khởi tạo nội dung demo đã xuất bản, không mô phỏng quy trình moderation hoặc tuyên bố đã kiểm duyệt hiện vật thật. Không tạo audit event giả cho thao tác qua HTTP.

## Giới hạn phạm vi

- Chỉ thêm exhibit/revision; không migration, đổi schema, xóa dữ liệu hoặc upload file.
- Không tạo media/hotspot; API tiếp tục trả image/model/audio null và hotspots rỗng. Đây không phải bộ asset nghiệm thu MVP đầy đủ.
- Backend seed viết PostgreSQL qua `DATABASE_URL`; frontend đọc bằng NestJS API, không kết nối Supabase trực tiếp.
- Script đặt trong `back-end/src/database/seeds/`, truy cập TypeORM theo pattern seed hiện có; không đưa truy vấn seed vào service API.

## Kiểm chứng

- Backend typecheck, lint, build đạt.
- Kiểm tra bộ dữ liệu và nhánh seed: ID riêng biệt, shape/color/position đúng contract, bỏ qua dữ liệu đã tồn tại, lỗi dữ liệu không nhất quán và cleanup khi thất bại.
- Chạy seed lần đầu trên database đã được người dùng chỉ định: có 5 exhibit demo với revision approved/public liên kết đúng.
- Chạy lần hai: không tăng số lượng, không thay đổi content/version/publishedRevisionId của các exhibit đã có.
- `GET /api/rooms/phong-lich-su-quan-su-viet-nam` trả đủ 5 ID demo, thứ tự 0–4; phản hồi hợp lệ với Zod schema Day 2.
- Giữ nguyên metadata phòng và dữ liệu quản trị. Kiểm tra công khai là qua `/api/rooms/:slug`, không nhầm với `/api/public/rooms/:slug` chỉ trả metadata phòng.

## Trạng thái

Đã khảo sát và duyệt thiết kế; chưa chạy seed hoặc ghi database tại thời điểm viết plan. Task: [demo-content-seed.md](../tasks/demo-content-seed.md). Kế hoạch triển khai: [demo-content-seed-plan.md](demo-content-seed-plan.md).
