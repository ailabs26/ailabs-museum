# Public Report Modal

**Trạng thái:** Task 0, Task 1 và Task 2 đã hoàn tất, commit riêng; Task 3 đang chạy final checks.
**Plan:** [public-report-modal-plan.md](../plans/public-report-modal-plan.md).
**Base/branch:** `origin/dev` tại `02dc42a` / `feat/public-report-modal`.

## 1. Mục tiêu

Khách có thể báo cáo nội dung chưa chính xác hoặc không phù hợp ngay tại collection, trang chi tiết 2D và tour. Form gửi qua API hiện có, tự gắn đúng revision được hiển thị và cung cấp phản hồi rõ ràng khi gửi thành công/thất bại.

## 2. Phạm vi và hành vi đề xuất

### Form

- `category`: select bắt buộc với bốn lựa chọn cố định; không cho nhập tự do.
- `message`: textarea bắt buộc, nội dung tự do; trim hai đầu, giới hạn 2000 ký tự.
- Bốn category cố định đã duyệt:
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

- [x] Modal được mở từ collection, chi tiết 2D và tour, luôn gắn đúng exhibit.
- [x] Chỉ gửi một trong bốn category cố định; request tự do từ client khác bị backend từ chối.
- [x] Message rỗng sau trim hoặc dài quá giới hạn không được gửi; message hợp lệ được giữ nguyên nội dung bên trong.
- [x] Payload chứa đúng published revision ID đang hiển thị; API từ chối revision thuộc exhibit khác.
- [x] Trạng thái pending ngăn gửi lặp và thể hiện rõ đang xử lý.
- [x] Thành công đóng/reset form; lỗi giữ dữ liệu và cho phép thử lại.
- [x] CMS draft preview không vô tình hiện nút báo cáo public.
- [x] Không thay đổi database schema; không thay đổi `@Public()`/rate limit ngoài yêu cầu.

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
- [x] Người dùng review/duyệt PLAN/TASK và bốn nhãn category.
- [x] Task 1: API allowlist, revision ownership/approved-state check, public revision ID; backend reports 15/15, mapper 14/14, FE typecheck và room contract 8/8.
- [x] Task 2: modal dùng chung và ba điểm vào; browser spec **3/3**, frontend unit **147/147**, typecheck/build và ESLint các file đổi đều pass.
- [x] Task 3: backend full tests **1,612/1,612**, lint, typecheck, build đạt; frontend typecheck, unit **147/147**, room contract **8/8**, browser **3/3**, build và targeted lint đạt.
- Frontend full lint còn **37 lỗi nền** tại `scripts/e2e-cms-workflow.mjs`, `tests/fixtures/cmsExhibitsApi.ts`, `tests/fixtures/cmsReportsWorkflowApi.ts`; các file này không thuộc diff. Backend integration test cần PostgreSQL thật bị skip do thiếu `MEDIA_TEST_DATABASE_URL`.
- `git diff --check` sạch. Không tạo migration hoặc sửa schema. Chưa push/PR.
