# Đặc tả Kỹ thuật & Hướng dẫn Vận hành: Nhập / Xuất Hiện vật Hàng loạt (Bulk Import & Export)

> Tài liệu kỹ thuật phân hệ CMS · Aura Museum  
> Người phụ trách: **Nguyễn Trọng Thành**  
> Phạm vi: Task 38 — Công cụ xuất nhập dữ liệu hiện vật định dạng JSON / CSV, cơ chế chống CSV Injection, quy tắc kiểm tra từng dòng và ghi nhận kiểm toán.

---

## 1. Mục tiêu & Bối cảnh

Nhằm tối ưu hóa công tác chuyển đổi dữ liệu và nhập kho số lượng lớn hiện vật cho bảo tàng, hệ thống cung cấp giao diện và bộ API cho phép người quản trị:
1. **Xuất kho dữ liệu (Export)**: Tải toàn bộ hiện vật theo phòng hoặc toàn viện bảo tàng dưới dạng tệp `JSON` hoặc `CSV`.
2. **Nhập kho dữ liệu (Import)**: Tải lên danh sách hiện vật cần khởi tạo, hỗ trợ kiểm tra tính hợp lệ sơ bộ (Dry-run preview) và nhập từng phần (Partial Import).

---

## 2. Đặc tả API

### 2.1 Xuất dữ liệu (`GET /api/admin/exhibits/export`)
- **Quyền hạn yêu cầu**: `@Permissions('exhibit:read')`
- **Query Parameters**:
  - `format`: `json` (mặc định) hoặc `csv`.
  - `roomId` *(tùy chọn)*: Lọc theo định danh phòng trưng bày cụ thể.
- **Headers trả về**:
  - `Content-Type`: `application/json; charset=utf-8` hoặc `text/csv; charset=utf-8`.
  - `Content-Disposition`: `attachment; filename="aura-exhibits-YYYY-MM-DD.csv"`.

### 2.2 Nhập dữ liệu (`POST /api/admin/exhibits/import`)
- **Quyền hạn yêu cầu**: `@Permissions('exhibit:create')`
- **Ghi nhận kiểm toán**: `@Audit({ action: 'import', resourceType: 'exhibits' })`
- **Body**: `multipart/form-data` chứa trường `file` (giới hạn dung lượng tối đa 5 MB).
- **Cơ chế Nhập từng phần (Partial Success)**:
  - Hệ thống kiểm tra từng dòng dữ liệu.
  - Các dòng hợp lệ được nạp vào DB và khởi tạo ở trạng thái bản nháp (`DRAFT`).
  - Các dòng không hợp lệ được tổng hợp vào danh sách lỗi chi tiết theo chỉ số dòng (row index).

---

## 3. Quy chuẩn Định dạng Tệp Dữ liệu

### 3.1 Cấu trúc Cột chuẩn RFC 4180 (CSV Format)

| Tên Cột | Bắt buộc | Định dạng / Ràng buộc | Ví dụ |
|---|---|---|---|
| `roomId` | Có | UUID hợp lệ của phòng đã tồn tại | `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d` |
| `nameVi` | Có | Chuỗi từ 1 đến 255 ký tự | `Trống đồng Ngọc Lũ` |
| `nameEn` | Có | Chuỗi từ 1 đến 255 ký tự | `Ngoc Lu Bronze Drum` |
| `descriptionVi` | Không | Văn bản mô tả tiếng Việt | `Hiện vật tiêu biểu của nền văn hóa Đông Sơn...` |
| `descriptionEn` | Không | Văn bản mô tả tiếng Anh | `A representative masterpiece of Dong Son culture...` |
| `positionX` | Có | Số thực, tọa độ x trong không gian phòng | `1.5` |
| `positionY` | Có | Số thực, tọa độ y trong không gian phòng | `0.0` |
| `positionZ` | Có | Số thực, tọa độ z trong không gian phòng | `-3.2` |
| `placeholderShape` | Không | Thuộc tập enum: `box`, `cylinder`, `sphere` | `cylinder` |
| `placeholderColor` | Không | Mã màu HEX 7 ký tự (`#RRGGBB`) | `#C0A080` |

---

## 4. Cơ chế Bảo mật: Chống Tấn công CSV Formula Injection

Khi xuất dữ liệu ra file CSV mở bằng các phần mềm bảng tính (Microsoft Excel, Google Sheets, LibreOffice Calc), kẻ tấn công có thể chèn các công thức độc hại (bắt đầu bằng `=`, `+`, `-`, `@`, `\t`, `\r`) nhằm thực thi mã từ xa (DDE command execution) trên máy của nhân viên quản trị.

### Giải pháp kỹ thuật triển khai (`csvCell` Helper):
```typescript
/**
 * Làm sạch ô dữ liệu CSV chống CSV/Formula Injection.
 * Nếu ô bắt đầu bằng ký tự nguy hiểm, tự động thêm dấu nháy đơn (') phía trước.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Thoát ký tự nháy kép kép theo chuẩn RFC 4180
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

---

## 5. Cấu trúc Phản hồi Kết quả Nhập liệu

```json
{
  "success": true,
  "data": {
    "totalRows": 25,
    "importedCount": 23,
    "failedCount": 2,
    "errors": [
      {
        "row": 4,
        "field": "roomId",
        "message": "Phòng trưng bày không tồn tại hoặc đã bị xóa"
      },
      {
        "row": 12,
        "field": "positionX",
        "message": "Tọa độ positionX vượt ra ngoài phạm vi biên của phòng (giới hạn: -10m đến 10m)"
      }
    ]
  },
  "message": "Đã nhập thành công 23/25 hiện vật. Có 2 dòng phát hiện lỗi."
}
```
