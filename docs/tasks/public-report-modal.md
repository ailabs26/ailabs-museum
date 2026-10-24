# Public Report Modal

**Trạng thái:** Đề xuất để review; chưa triển khai.
**Plan:** [public-report-modal-plan.md](../plans/public-report-modal-plan.md).
**Base/branch:** `origin/dev` tại `02dc42a` / `feat/public-report-modal`.

## 1. Mục tiêu

Khách có thể báo cáo nội dung chưa chính xác hoặc không phù hợp ngay tại collection, trang chi tiết 2D và tour. Form gửi qua API hiện có, tự gắn đúng revision được hiển thị và cung cấp phản hồi rõ ràng khi gửi thành công/thất bại.

## 2. Phạm vi và hành vi đề xuất

### Form

- `category`: select bắt buộc với bốn lựa chọn cố định; không cho nhập tự do.
- `message`: textarea bắt buộc, nội dung tự do; trim hai đầu, giới hạn 2000 ký tự.
- Bốn nhãn tạm đề xuất:
  1. **Sai thông tin** (`wrong_info`)
  2. **Lỗi chính tả** (`typo`)
  3. **Ảnh/nội dung không phù hợp** (`inappropriate_content`)
  4. **Khác** (`other`)
- Các nhãn/mã trên cần được duyệt trước khi triển khai; không tạo CMS hoặc hệ thống category động.

### Gửi và phản hồi

- Gửi `exhibitId`, `reportedRevisionId`, `category`, `message` đến `POST /public/reports`.
- Nút gửi bị khóa khi thiếu/không hợp lệ hoặc đang gửi; không gửi hai lần do click lặp.
- Khi thành công: thông báo xác nhận, đóng form và xóa state form.
- Khi thất bại: hiển thị lỗi phù hợp; giữ category/message để khách thử lại. Không báo thành công nếu API thất bại.
- Tôn trọng rate limit hiện tại của endpoint và thông báo lỗi do API trả về.

### Revision

- Public API exhibit cần cung cấp ID của published revision đang được render.
- Collection/detail/tour phải truyền ID này cùng exhibit ID; không lấy revision mới nhất tại thời điểm submit.
- Backend xác thực revision tồn tại và thuộc exhibit. Nếu visitor còn mở revision cũ đã xem, cho phép báo cáo gắn revision cũ đó.

## 3. Ngoài phạm vi

- Category do admin/CMS tạo, sửa, sắp xếp hoặc bật/tắt.
- Ô nhập category tự do.
- Bảng mới, migration, quyền quản trị mới, đăng nhập bắt buộc, attachment hoặc upload ảnh.
- Thay đổi quy trình moderation/admin ngoài cách hiển thị category nếu mã cố định cần nhãn dễ đọc.

## 4. Acceptance criteria

- [ ] Modal được mở từ collection, chi tiết 2D và tour, luôn gắn đúng exhibit.
- [ ] Chỉ gửi một trong bốn category cố định; request tự do từ client khác bị backend từ chối.
- [ ] Message rỗng sau trim hoặc dài quá giới hạn không được gửi; message hợp lệ được giữ nguyên nội dung bên trong.
- [ ] Payload chứa đúng published revision ID đang hiển thị; API từ chối revision thuộc exhibit khác.
- [ ] Trạng thái pending ngăn gửi lặp và thể hiện rõ đang xử lý.
- [ ] Thành công đóng/reset form; lỗi giữ dữ liệu và cho phép thử lại.
- [ ] CMS draft preview không vô tình hiện nút báo cáo public.
- [ ] Không thay đổi database schema; không thay đổi `@Public()`/rate limit ngoài yêu cầu.

## 5. Task breakdown

| Task | Deliverable |
|---|---|
| 0 — Review | Duyệt labels, contract revision và hành vi form |
| 1 — API contract | Category allowlist, ownership check, public `revisionId` |
| 2 — Frontend | API method, modal dùng chung, ba điểm vào |
| 3 — Verification | Acceptance, app checks, diff review và ledger |

## 6. Execution ledger

- [x] Đọc source hiện hữu qua CodeGraph: endpoint, DTO/service, public exhibit mapping/schema và ba consumer UI.
- [x] Xác nhận workspace sạch và nhánh `feat/public-report-modal` bắt đầu từ `origin/dev` tại `02dc42a`.
- [ ] Người dùng review PLAN/TASK và chốt bốn nhãn category.
- [ ] Chưa sửa code hoặc chạy kiểm thử trong giai đoạn review tài liệu.
- [ ] Ghi evidence thực tế, kết quả kiểm chứng và thay đổi phạm vi sau khi được duyệt.
