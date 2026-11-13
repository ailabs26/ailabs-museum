# Task 38: Nhập/xuất hiện vật hàng loạt (CSV/JSON)

Người làm: Nguyễn Trọng Thành · Nhánh `feat/exhibits-bulk-import-export` (từ `dev` tại `3af8fb7`) · Ngày: 13/11/2026.

Yêu cầu trong [`tasks-and-validation.md`](../architecture/fe/tasks-and-validation.md):
- API validate dữ liệu theo từng dòng.
- FE cho người dùng upload file, xem kết quả, đọc lỗi, và phân biệt được trường hợp **thành công một phần**.

## Kết quả

- **Xuất:**
  - `GET /api/admin/exhibits/export?format=csv|json`, cần quyền `exhibit:read`.
  - Dùng cùng bộ lọc với danh sách CMS: `roomId`, `status`, `visibility`, `q`. Không lấy hiện vật trong thùng rác.
  - Nội dung lấy theo revision mới nhất, tối đa 5.000 hiện vật.
  - File CSV dùng UTF-8 có BOM để Excel đọc đúng tiếng Việt.
- **Nhập:**
  - `POST /api/admin/exhibits/import?dryRun=true|false`, file gửi qua multipart field `file`, cần quyền `exhibit:create`.
  - Mỗi dòng hợp lệ tạo **một bản nháp mới** qua `ExhibitsService.createExhibitDraft`, nên đi qua đúng các bước kiểm tra như khi tạo bằng form (DTO, phòng, media gắn được, transaction).
  - Nhập không bao giờ ghi đè hiện vật cũ và không bao giờ tự xuất bản; bản nháp vẫn phải gửi duyệt.
  - Kết quả trả về theo từng dòng, gồm `valid`, `created` hoặc `error` kèm `field` và `message`.
- **CMS:** trên trang Hiện vật có thêm nút **Xuất** (menu chọn CSV hoặc JSON) và nút **Nhập** mở modal theo luồng: chọn file → **Kiểm tra** (dry run) → bảng các dòng lỗi → **Nhập N dòng hợp lệ** → xem kết quả.
- **Audit:** mỗi hiện vật được tạo ghi một bản ghi `exhibit.import`. Chạy dry run không ghi audit.

## Định dạng file

CSV và JSON dùng chung một bộ khóa phẳng. Thứ tự cột trong file xuất cũng là danh sách cột được chấp nhận khi nhập. Cách dễ nhất để có **file mẫu** là bấm Xuất.

| Nhóm | Cột |
|---|---|
| Chỉ đọc (có khi xuất, **bị bỏ qua** khi nhập) | `id`, `status`, `visibility`, `revisionState` |
| Phòng (bắt buộc có ít nhất một) | `roomSlug`, `roomId` |
| Thứ tự | `displayOrder` |
| Đa ngôn ngữ (vi, en, fr, zh, ko, ja) | `name_<lang>`, `description_<lang>`, `transcript_<lang>`, `altText_<lang>` |
| Không gian 3D | `positionX/Y/Z`, `rotationX/Y/Z`, `scaleX/Y/Z` |
| Placeholder | `placeholderShape`, `placeholderColor` |
| Media (UUID media đã có) | `modelId`, `imageId`, `audioViId`, `audioEnId`, `subtitleViId`, `subtitleEnId` |

- **Ô trống** nghĩa là không gửi trường đó; trường sẽ lấy giá trị mặc định như khi tạo bằng form.
- **CSV:** theo RFC 4180, nên ô có dấu phẩy, dấu nháy kép hoặc xuống dòng phải bọc trong nháy kép.
- **Chống CSV injection:** khi xuất, ô văn bản bắt đầu bằng `= + - @`, tab, CR hoặc `'` được thêm `'` phía trước. Khi nhập, dấu `'` đó được bỏ ra, nên xuất rồi nhập lại vẫn giữ nguyên giá trị. Cột số (ví dụ `-3.5`) không bị thêm dấu.
- **JSON:** chấp nhận mảng object phẳng, hoặc `{ "items": [...] }` đúng như file xuất. Giá trị chỉ được là chuỗi, số hoặc `null`.

## Quy tắc kiểm tra

**Lỗi cấp file.** File bị trả lỗi 4xx và không dòng nào được xử lý khi:
- thiếu file;
- file rỗng hoặc không phải UTF-8;
- CSV có dấu nháy kép không đóng (thông báo kèm số dòng);
- có cột lạ hoặc cột bị lặp;
- thiếu cả `roomSlug` lẫn `roomId`;
- hơn 500 dòng hoặc lớn hơn 2 MB;
- JSON hỏng, sai cấu trúc, hoặc có giá trị lồng nhau.

Lỗi ở tầng multipart (vượt 2 MB, sai field, gửi nhiều file) được `UploadFileInterceptor` chuẩn hóa về envelope `errors[]` tiếng Việt.

**Lỗi cấp dòng.** Dòng lỗi bị bỏ qua, các dòng khác vẫn được nhập. Một dòng lỗi khi:
- dòng có nhiều ô hơn tiêu đề (thường do dấu phẩy chưa bọc nháy, khiến dữ liệu lệch cột);
- phòng không tồn tại, đã bị xóa mềm, hoặc `roomId` và `roomSlug` trỏ hai phòng khác nhau;
- vi phạm các quy tắc của `CreateExhibitDto`: màu không phải hex, thứ tự âm, tọa độ không phải số, tên dài quá 200 ký tự, UUID media sai, …;
- khi nhập thật, bị lỗi lúc tạo (ví dụ media chưa sẵn sàng). Lỗi nội bộ không rõ nguyên nhân chỉ hiện "Lỗi không xác định…" và được ghi log ở server.

**Dry run** chỉ kiểm tra DTO và phòng. Việc media có gắn được hay không chỉ kiểm khi nhập thật, vì cần khóa dòng trong transaction. Nếu có lỗi này, nó sẽ hiện trong kết quả nhập.

## Thiết kế và lý do

| Quyết định | Lý do |
|---|---|
| Nhập luôn tạo **bản nháp mới**, bỏ qua `id` | Không có đường nào ghi đè nội dung đã duyệt mà không qua kiểm duyệt, nên giữ được workflow revision |
| Tạo từng dòng qua `createExhibitDraft`, mỗi dòng một transaction | Dùng lại 100% quy tắc nghiệp vụ. Dòng lỗi không làm hỏng các dòng khác, nên có được kết quả thành công một phần |
| Bắt buộc có bước dry run trên UI (nút Nhập chỉ bật sau khi Kiểm tra) | Người dùng thấy dòng lỗi trước khi ghi vào DB |
| Controller riêng `AdminExhibitTransferController`, đăng ký **trước** `AdminExhibitsController` | Nếu không, `GET admin/exhibits/export` sẽ khớp vào route `:id` và trả 400. Đã có test khóa thứ tự này, và mutation đảo thứ tự làm 3 test đỏ. Tách controller cũng tránh phải sửa 80 chỗ khởi tạo controller cũ trong test |
| Tiện ích CSV đặt ở `common/utils/csv.util.ts` | Dùng chung với xuất CSV của audit (`audit-csv.util` nay import từ đây) |

## Kiểm chứng

| Bài | Kết quả |
|---|---|
| `common/tests/csv-util.spec.ts`: parse RFC 4180, guard/unguard có thể đảo ngược | 26/26 |
| `exhibits/tests/exhibit-transfer.spec.ts`: xuất, round-trip CSV/JSON, thành công một phần, lỗi cấp dòng và cấp file, cache phòng, giới hạn 500 dòng và 2 MB | 33/33 |
| `exhibits/tests/exhibit-transfer-http.spec.ts`: multipart thật, thứ tự route, envelope lỗi multer, quyền 403, audit, dry run không ghi audit | 13/13 |
| Mutation: đảo thứ tự controller trong module | 3 test đỏ, nghĩa là bị bắt |
| `npm test` (toàn bộ back-end), lint, typecheck | 2260/2260, sạch |
| FE `helpers/exhibitImport.test.ts`: helper và service xuất/nhập | 9/9 |
| FE `npm run test:unit`, lint, build | 371/371, sạch, build OK |
| E2E Playwright (API giả lập) `tests/cms-exhibits-import-export.spec.ts` + `cms-e2e-exhibits.spec.ts` | 7/7 |
| **E2E live** (API thật + Postgres 16 + Vite + Chromium): đăng nhập → kiểm tra → nhập một phần → xuất → nhập lại file vừa xuất | 1/1, DB và audit khớp ([`evidence/exhibit-import-export/`](evidence/exhibit-import-export/live-e2e.log)) |

Kết quả E2E live, chạy từ DB sạch: file gồm 4 dòng, trong đó 2 dòng lỗi (sai slug phòng, sai màu).
- Sau khi nhập, DB có đúng **2 hiện vật `hidden`, revision `draft`, chưa xuất bản** và **2 bản ghi audit `exhibit.import`**.
- Các giá trị đặc biệt được giữ nguyên: dấu phẩy, dấu nháy kép, xuống dòng, tọa độ âm `-3.5`, và chuỗi `=HYPERLINK("x")` trong cột văn bản.
- File vừa xuất có `'=HYPERLINK` (đã chống injection). Nhập lại file đó thì cả 2 dòng đều hợp lệ.

Ảnh màn hình: [`01-kiem-tra.png`](evidence/exhibit-import-export/01-kiem-tra.png), [`02-ket-qua-nhap.png`](evidence/exhibit-import-export/02-ket-qua-nhap.png), [`03-nhap-lai-file-xuat.png`](evidence/exhibit-import-export/03-nhap-lai-file-xuat.png).

## File thay đổi

| File | Vai trò |
|---|---|
| `back-end/src/common/utils/csv.util.ts` (+ test) | `parseCsv`, `csvCell` có tùy chọn tắt guard cho cột số, `unguardCsvText` |
| `back-end/src/common/interceptors/upload-file.interceptor.ts` | `UploadFileInterceptor` chuẩn hóa lỗi multer |
| `back-end/src/modules/audit/audit-csv.util.ts` | Dùng `csvCell` chung |
| `back-end/src/modules/exhibits/services/exhibit-transfer.columns.ts` | Định nghĩa cột, chuyển hiện vật thành dòng và dòng thành input |
| `back-end/src/modules/exhibits/services/exhibit-transfer.service.ts` | Xuất, nhập, đọc file, kiểm tra từng dòng |
| `back-end/src/modules/exhibits/controllers/admin-exhibit-transfer.controller.ts`, `dto/exhibit-transfer-query.dto.ts`, `exhibits.module.ts` | Route, query, đăng ký controller đúng thứ tự |
| `front-end/src/services/exhibits.service.ts`, `helpers/saveBlob.ts`, `services/audit.service.ts` | `exportFile`/`importFile`; `filenameFromDisposition` chuyển vào helper tải file |
| `front-end/src/components/cms/ExhibitImportModal.tsx`, `helpers/exhibitImport.ts` (+ test) | Modal nhập và các helper |
| `front-end/src/pages/admin/ExhibitsPage.tsx` | Nút Xuất và Nhập |
| `front-end/tests/cms-exhibits-import-export.spec.ts` | E2E |
| `docs/api/openapi.json`, `docs/architecture/06-api-contract.md`, `docs/guides/cms-user-guide.md` | Tài liệu API và hướng dẫn sử dụng |

## Ngoài phạm vi và việc tiếp theo

- **Chưa xuất/nhập hotspot.** Hotspot có cấu trúc lồng nhau nên không hợp với CSV phẳng. Có thể bổ sung riêng cho JSON nếu cần.
- **Chưa có cập nhật hàng loạt** (dùng `id` để sửa hiện vật có sẵn). Muốn làm thì cần quyết định cách tương tác với workflow revision: tạo revision nháp mới hay sửa revision hiện tại.
- **Trùng lặp với Task 28:** `UploadFileInterceptor` (nhánh này) và `MediaFileInterceptor` (nhánh Task 28, PR #192) làm cùng một việc. Sau khi cả hai PR được merge, nên cho `MediaFileInterceptor` dùng lại `UploadFileInterceptor`.
- Không có migration, không đổi schema.
