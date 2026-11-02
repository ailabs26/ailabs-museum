# Task: Xuất nhật ký hệ thống ra CSV

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/audit-csv-export`.

## Bối cảnh

Trang Nhật ký hệ thống chỉ xem được từng trang 20 dòng. Admin cần tải nhật ký về để lưu trữ hoặc điều tra bằng Excel.

## Thay đổi

Back-end:
- `GET /audit/export` (`audit:read`), đặt trước `:id`. Dùng cùng bộ lọc với danh sách: `ExportAuditQueryDto` =
  `OmitType(ListAuditQueryDto, page/pageSize/sort/q/skip)`, nên truyền `page` sẽ bị 400.
- `AuditRepository`: tách `filtered()` dùng chung cho `listPaginated` và `listForExport(filter, limit)`.
- `AuditService.exportCsv`: lấy tối đa 10.001 dòng; nếu hơn 10.000 thì trả **400** yêu cầu thu hẹp bộ lọc. Không cắt bớt
  âm thầm, vì nhật ký thiếu dòng mà không báo sẽ gây hiểu sai. Mỗi lần xuất ghi `audit.export` (bộ lọc + số dòng + IP/UA).
- `audit-csv.util.ts`: RFC 4180 (luôn bọc nháy, nhân đôi nháy), BOM UTF-8 cho Excel tiếng Việt, CRLF, thời điểm ISO UTC.
  Ô bắt đầu bằng `= + - @`, tab hoặc CR được thêm `'` để chặn CSV injection (User-Agent, lý do... do người ngoài gửi lên).
- Trả về `StreamableFile`, nên `ResponseInterceptor` không bọc. `Cache-Control: no-store`. CORS mở thêm `Content-Disposition`.

Front-end:
- Nút "Xuất CSV" ở trang Nhật ký. Bộ lọc gom thành một biến dùng chung cho danh sách và cho export, nên file luôn khớp với
  những gì đang hiển thị.
- `http-client`: body lỗi dạng Blob JSON (do request `responseType: 'blob'`) được đọc lại, nên thông báo 400 của back-end
  hiện đúng thay vì "Request failed".
- `helpers/saveBlob.ts` dùng chung cho xuất CSV và ảnh chụp cảnh 3D (trước đây viết riêng trong `scenePhoto.ts`).

## Kiểm chứng ngày 02/11/2026

- Back-end: lint, typecheck đạt; `npm test` 2001/2001. `audit-export.spec.ts`: escape/injection, BOM/CRLF/tiêu đề; service
  chuyển bộ lọc, đúng 10.000 thì xuất được, 10.001 thì 400 và không ghi audit; HTTP đúng header, không bọc envelope, từ chối
  `page` / `from` sai / `actorId` sai.
- Front-end: lint, build đạt; vitest 210/210 (thêm test lỗi Blob JSON / Blob HTML / JSON hỏng, `exportCsv`, tên file).
- Trên PostgreSQL 16 tạm: query thật cho ra thứ tự mới nhất trước, lọc action + from, limit, phân trang, join actor đều đúng.
- Smoke trên app thật (build + seed, DB tạm): đăng nhập admin → `/audit/export` 200, BOM `EF BB BF`, tiếng Việt đúng,
  `Access-Control-Expose-Headers: Retry-After,Content-Disposition`; bản ghi `audit.export` có bộ lọc và số dòng; 10.001 dòng
  → 400 kèm thông điệp, lọc hẹp hơn → 200.
