# Task 25 — Kiểm thử tích hợp CMS Admin & xử lý lỗi UI

## 1. Ma trận mã lỗi (BE → UI)

| Mã | Khi nào | BE ném | UI (`cmsErrorMessage`) |
|---|---|---|---|
| 400 | Body sai/thiếu field (ValidationPipe) | `BadRequestException` | "Dữ liệu không hợp lệ, vui lòng kiểm tra lại" |
| 401 | Chưa/đã hết hạn đăng nhập | `JwtAuthGuard` | http-client tự refresh; thất bại → về login |
| 403 | Thiếu quyền RBAC | `PermissionsGuard` | "Bạn không đủ quyền thực hiện thao tác này" |
| 404 | Không tìm thấy | `NotFoundException` | message từ server |
| 409 | Sửa đồng thời / trạng thái sai | `ConflictException` | "Nội dung đã bị thay đổi… tải lại" + refetch + đóng panel |
| 422 | Validation ngữ nghĩa | (map như 400) | "Dữ liệu không hợp lệ…" |
| 0 | Mất kết nối | — | "Mất kết nối máy chủ, vui lòng thử lại" |

## 2. Integration test đã có (chạy không cần DB)

**Back-end** (`@nestjs/testing` + `supertest`, mock service, global pipe/interceptor/filter như `main.ts`):
- `moderation-http.spec.ts`: publish 201/409/404/400; reject 400 (thiếu lý do); hide 409.
- `content-reports-http.spec.ts`: public create 400/201; assign 409; resolve 400.
- Xác nhận envelope `ApiResponse` (`success`, `data`/`message`) và mã HTTP đúng hợp đồng.

**Back-end unit** (`node:test`): stats, moderation (409 version lệch), content-reports (chuyển trạng thái), audit interceptor (revisionId).

**Front-end unit** (`vitest`, `npm run test:unit`): `cmsErrorMessage` map 409/403/400/422/0 + fallback.

## 3. Checklist luồng tích hợp thủ công (cần DB + seed)

- [ ] Login admin → vào Dashboard thấy số liệu + biểu đồ.
- [ ] Seed revision `in_review` → Moderation queue hiển thị → Diff cũ/mới đúng.
- [ ] Publish đúng version → exhibit đổi `publishedRevisionId`, `version++`, có audit log.
- [ ] 2 tab cùng publish/hide với version cũ → tab sau nhận **409**, UI cảnh báo tải lại.
- [ ] Reject thiếu lý do → 400; thiếu quyền → 403.
- [ ] Client gửi `/public/reports` → Admin thấy → tiếp nhận → xử lý; gửi quá 5 lần/phút → 429.
- [ ] Mọi hành động xuất hiện trong Nhật ký (`/admin/audit`) với action/resource/revisionId đúng.
