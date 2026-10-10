# Diagrams chuẩn — Aura Museum

Bộ sơ đồ **chuẩn hóa cho cả team**, viết bằng Mermaid (versionable, review được trong PR).
Đồng bộ với bản vẽ gốc `Tài liệu dự án/Diagrams/Aura-Museum-ERD-Quy-tac-du-lieu-v3.drawio`
và phản ánh **đúng schema đã hiện thực** trong `back-end/src/**/*.entity.ts` + migration.

| Sơ đồ | Nội dung |
|---|---|
| [01-erd.md](01-erd.md) | ERD 13 bảng MVP (thực thể, cột khóa, quan hệ) |
| [02-rbac.md](02-rbac.md) | Mô hình RBAC và cách gộp quyền vào access token |
| [03-auth-flow.md](03-auth-flow.md) | Luồng đăng nhập / refresh (rotation + reuse-detection) |
| `Aura-Museum-ERD-Quy-tac-du-lieu-v3.drawio` | Bản vẽ gốc (draw.io): ERD MVP + Quy tắc dữ liệu + 3 bảng mở rộng |
| `Explain Attribute In Diagram.docx` | Giải thích ý nghĩa từng bảng/thuộc tính |

## Nguồn chân lý (source of truth)

- **Schema:** entity TypeORM + migration trong `back-end/` là chân lý thực thi. Sơ đồ ở đây
  mô tả lại cho dễ đọc; khi schema đổi, cập nhật cả entity/migration lẫn các file này.
- **Bản vẽ gốc drawio** (đã đưa vào thư mục này) giữ thêm *Quy tắc dữ liệu* và *3 bảng mở rộng
  post-MVP* (`exhibit_translations`, `api_keys`, `analytics_events`) — chưa hiện thực, nên không đưa vào ERD thực thi.
- Chi tiết thuộc tính: xem `Explain Attribute In Diagram.docx` (cùng thư mục) và
  [../architecture/04-data-model-erd.md](../architecture/04-data-model-erd.md).
- Đã đồng bộ với code hiện tại: mã quyền dùng định dạng `resource:action` (vd `exhibit:publish`),
  khớp `common/constants/permissions.constant.ts`.

> Xem Mermaid trực tiếp trên GitHub hoặc trình xem Markdown hỗ trợ Mermaid.
