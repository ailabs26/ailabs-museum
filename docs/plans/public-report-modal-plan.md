# Public Report Modal — Implementation Plan

> **For agentic workers:** Sau khi PLAN/TASK được duyệt, dùng `superpowers:executing-plans` hoặc `superpowers:subagent-driven-development`; triển khai theo task và kiểm chứng từng phần. Checklist là kế hoạch, không phải bằng chứng đã chạy.

**Goal:** Cho khách gửi báo cáo nội dung từ collection, trang chi tiết 2D và tour; báo cáo gắn đúng hiện vật và revision khách đang xem.

**Architecture:** Tái sử dụng `POST /public/reports` hiện có. Thêm hàm tạo báo cáo public vào reports service, một modal dùng chung ở ba điểm vào, và đưa `revisionId` của published revision vào public exhibit DTO hiện có. Backend xác thực exhibit/revision trước khi lưu. Không thêm bảng hay migration.

**Tech stack:** NestJS, TypeORM hiện có, React, Mantine, Zod, service/http-client và thông báo hiện có.

**Spec:** [public-report-modal.md — Đề xuất để review](../tasks/public-report-modal.md#phạm-vi-và-hành-vi-đề-xuất).
**Base/branch:** `origin/dev` tại `02dc42a` → `feat/public-report-modal`.
**Status:** Chỉ tạo PLAN/TASK để người dùng review; chưa sửa runtime, chưa chạy kiểm thử, chưa commit/push/PR.

## Phạm vi đã chốt

- Modal dùng chung tại collection, chi tiết 2D và tour.
- `category` chỉ chọn từ bốn mục cố định, không có nhập tự do. Tạm đề xuất: **Sai thông tin**, **Lỗi chính tả**, **Ảnh/nội dung không phù hợp**, **Khác**; chờ người dùng duyệt nhãn chính xác.
- `message` là nội dung tự do, bắt buộc, trim trước khi gửi, tối đa 2000 ký tự.
- Tự gửi `exhibitId` và `reportedRevisionId` của revision đang được hiển thị.
- Có trạng thái đang gửi, gửi thành công và lỗi; lỗi giữ lại nội dung để khách sửa/thử lại.
- Không thêm category động, màn CMS quản lý category, migration, dependency, hay luồng xác thực mới.

## Source map

| File/khu vực | Vai trò dự kiến |
|---|---|
| `back-end/src/modules/content-reports/controllers/public-reports.controller.ts` | Endpoint public `POST /public/reports` đã có; giữ throttling và `@Public()` |
| DTO/service/repository trong `back-end/src/modules/content-reports/` | Ràng buộc category cố định, validate exhibit/revision cùng chủ thể, lưu báo cáo |
| Public exhibit mapper/DTO quanh `back-end/src/modules/rooms/` | Trả `revisionId` của published revision đang được dùng |
| `front-end/src/services/reports.service.ts` | Thêm API call tạo report theo pattern `http.post` |
| `front-end/src/validations/roomSchema.ts` và mapper room/display | Validate và truyền revision ID tới các UI public |
| `front-end/src/pages/client/CollectionPage.tsx`, `shared/components/data/ExhibitGrid.tsx` | Điểm mở modal từ collection; callback chỉ bật ở collection |
| `front-end/src/pages/client/ExhibitDetailPage.tsx` | Điểm mở modal từ trang chi tiết 2D |
| `front-end/src/pages/client/MuseumPage.tsx`, `components/museum/ExhibitDetailPanel.tsx` | Điểm mở modal cho hiện vật đang chọn trong tour; không bật ở CMS preview |
| `front-end/src/shared/components/` | Modal dùng chung, validation và trạng thái gửi |

Các đường dẫn controller/DTO chính xác và mọi caller liên quan sẽ được xác minh lại trên branch trước khi code. Không tạo abstraction ngoài một modal và một API method nếu cấu trúc hiện tại cho phép.

## Ràng buộc và rủi ro

- Dùng revision ID thực từ public API; không suy ra revision từ thời gian hoặc gắn revision mới nhất lúc gửi.
- Backend phải từ chối revision không thuộc exhibit được gửi. Revision có thể cũ hơn revision hiện hành nếu khách vẫn mở trang từ trước khi nội dung được publish lại.
- Không trả entity thô; tuân theo `ApiResponse`, `@Public()` và rate limit hiện có.
- Không migration/database schema changes. Nếu source thực tế cho thấy cần thay đổi schema, dừng và xin duyệt riêng.
- Giữ các điểm vào công khai độc lập với CMS draft preview.

## Task execution plan

### Task 0 — Review tài liệu

- [ ] Người dùng duyệt PLAN/TASK, gồm bốn nhãn category đề xuất và cách xử lý revision cũ.
- [ ] Chỉ sau khi duyệt mới tiếp tục thực thi trên `feat/public-report-modal`.

### Task 1 — API contract và revision ID

- [ ] Rà toàn bộ callers của DTO public exhibit và endpoint report.
- [ ] Thêm bốn giá trị category cố định tại DTO boundary; backend từ chối category ngoài danh sách.
- [ ] Bảo đảm revision thuộc exhibit; giữ rate limit và lỗi API theo chuẩn hiện tại.
- [ ] Thêm `revisionId` vào public exhibit contract và Zod schema; không đổi dữ liệu CMS draft.
- [ ] Kiểm chứng contract/service và các kiểm tra backend/frontend liên quan.

### Task 2 — Modal và ba điểm vào

- [ ] Thêm API method cho `POST /public/reports`.
- [ ] Tạo modal dùng chung với category select tĩnh và message tự do; validation client khớp giới hạn API.
- [ ] Kết nối collection, chi tiết 2D và tour; gửi chính xác exhibit/revision đang hiển thị.
- [ ] Chặn gửi trùng khi pending; success chỉ đóng/reset sau response thành công; lỗi giữ input và hiện thông báo.
- [ ] Kiểm tra bàn phím/label cơ bản và layout modal theo UI pattern sẵn có.

### Task 3 — Hoàn tất và bàn giao

- [ ] Kiểm chứng các acceptance criteria trong TASK và chạy gates của hai app bị ảnh hưởng theo AGENTS.md.
- [ ] Review toàn diff, cập nhật ledger; chưa push/PR/merge nếu chưa có yêu cầu tiếp theo.
