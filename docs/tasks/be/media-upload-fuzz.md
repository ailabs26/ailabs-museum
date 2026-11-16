# Task 28: Fuzz upload media (AC-33)

Người làm: Nguyễn Trọng Thành · Nhánh `test/media-upload-fuzz` (từ `dev` tại `3af8fb7`) · Ngày: 13/11/2026.

AC-33: API phải từ chối file có MIME giả, file quá cỡ và nội dung độc hại, đồng thời không làm hỏng media đang có.

## Kết luận

- **Không có đầu vào nào làm API trả 5xx, tạo media từ file bị từ chối, hay để lại file rác.**
  - Đã thử 9.280 ca qua HTTP (5 seed × 1.856 ca), cộng thêm 1,2 triệu đầu vào đưa thẳng vào validator.
  - Mọi validator chỉ ném lỗi có mã rõ ràng, không bị treo, và không có file nào bị đẩy vào cách ly do parser hỏng.
- **Đã sửa một lỗi:** các lỗi phát sinh ở tầng đọc multipart (multer/busboy) trả body tiếng Anh không có `errors[]`, ví dụ `{"message":"File too large"}` với file > 10 MB. CMS hiển thị nguyên văn câu này cho người dùng. Hiện cả hai route upload đều trả cùng envelope với các lỗi khác, kèm thông điệp tiếng Việt.
- **Không đổi, nhưng cần nhóm xác nhận:** PNG, JPEG, WebP và MP3 có dữ liệu thừa ở đuôi (ví dụ PNG kèm `<script>` sau IEND) vẫn được nhận. Đây là quyết định có chủ đích của Task 8 và vẫn an toàn nhờ header khi phục vụ file (xem phần Phát hiện).

## Bất biến được kiểm

Với **mọi** đầu vào gửi tới `POST /api/admin/media/upload` và `POST /api/admin/media/upload-jobs`:

| # | Bất biến |
|---|---|
| I1 | Không bao giờ trả 5xx. Upload đồng bộ chỉ trả 201/400/413/422; job trả 202 rồi kết thúc ở `succeeded` hoặc `failed` |
| I2 | Khi bị từ chối: `success: false`, `errors[0].field = 'file'`, mã thuộc `MediaErrorCode` |
| I3 | Khi bị từ chối: không có media READY mới. Riêng `media_quarantined` được để lại 1 bản ghi QUARANTINED, file nằm trong thư mục cách ly |
| I4 | Khi được nhận: đúng 1 media READY; MIME lấy từ nội dung chứ không theo tên hay `Content-Type` khai báo; file lưu trùng từng byte (SHA-256); nội dung qua được kiểm tra cấu trúc; file nằm trong `uploads/` |
| I5 | Tập file trên đĩa (thư mục công khai + thư mục cách ly) khớp 1–1 với các bản ghi media |
| I6 | Cùng một nội dung, upload đồng bộ và job bất đồng bộ cho cùng kết quả (cùng được nhận, hoặc cùng mã lỗi) |

## Đầu vào

1. **Đột biến từ file hợp lệ** (`media-fuzz-corpus.ts`, PRNG mulberry32 có seed):
   - Xuất phát từ 6 file hợp lệ: PNG, JPEG, WebP, GLB, MP3, VTT.
   - 8 chiến lược đột biến: lật bit; ghi đè 16 byte đầu; cắt cụt; chèn byte ngẫu nhiên; xóa một đoạn; lặp một đoạn; ghi đè trường 32-bit bằng giá trị biên (0, 2³¹−1, 2³²−1, kích thước file ±1); nối payload (`<script>`, PHP, NUL, `MZ`).
   - Mỗi biến thể áp chồng 1–3 đột biến.
2. **File độc viết tay** (21 file):
   - File thực thi hoặc tài liệu đổi đuôi: EXE, ELF, ZIP, PDF đổi thành `.png/.glb/.webp`.
   - Mã có thể chạy: SVG chứa script, HTML (có BOM), PHP.
   - Định dạng không hỗ trợ: GIF.
   - Dữ liệu suy biến: file 1 byte, toàn byte 0 hoặc 0xFF, chỉ có magic bytes.
   - VTT lỗi mã hóa: UTF-16, chứa NUL.
   - GLB nguy hiểm: trỏ tài nguyên ngoài (`https://`, `file:///etc/passwd`), JSON không phải object.
   - Thêm: polyglot PNG+HTML, GLB+script; VTT có `<script>` trong cue; khai báo sai đuôi, sai MIME hoặc sai `kind`.
3. **Dung lượng biên:**
   - File rỗng.
   - PNG đúng 2.000.000 byte và 2.000.001 byte.
   - GLB đúng 10.000.000 byte và 10.000.004 byte.
   - 15 MB, gửi qua cả upload đồng bộ lẫn job.
4. **Tên file độc** (11 tên):
   - Path traversal: `../`, `..\`, đường dẫn tuyệt đối.
   - CRLF (thử chèn header).
   - Ký tự đảo chiều RTL `‮`.
   - Tên 5.000 ký tự, tên chỉ gồm khoảng trắng, `.png`.
   - Unicode và emoji, tên chứa HTML, `CON`.
   - Tên chứa NUL được test riêng.
5. **Multipart dị dạng:**
   - Không có file; gửi body JSON thay vì multipart.
   - Sai tên field; gửi 2 file; field ngoài DTO (`storageKey=../../etc/passwd`); hơn 10 field.
   - Thiếu boundary kết thúc; thiếu boundary.
6. **Giữ nguyên media cũ:** tạo media A, rồi bắn liên tiếp file độc và file đột biến qua cả hai route. Sau đó kiểm bản ghi A không đổi và nội dung tải về qua `/admin/media/:id/content` vẫn có cùng SHA-256.
7. **Đồng thời:** gửi song song 40 request, gồm 10 PNG hợp lệ và 30 file độc hoặc đột biến.
8. **Fuzz trực tiếp validator** (`media-validator-fuzz.spec.ts`), mỗi seed:
   - 120.000 biến thể đột biến.
   - 120.000 file giữ đúng 4–16 byte đầu của định dạng, phần thân là byte ngẫu nhiên dài 0–512 byte.
   - Validator chỉ được ném `MediaFormatError`, và mỗi file phải xử lý xong trong < 250 ms.

## Kết quả

| Bài | Số ca | Kết quả | Bằng chứng |
|---|---|---|---|
| Fuzz HTTP, seed mặc định, 40 biến thể/định dạng (chạy trong `npm test`) | 296 | 296/296 | [`02-green-after-fix.log`](evidence/fuzz/02-green-after-fix.log) |
| Fuzz HTTP, seed 1, 2, 3, 42, 20261113 × 300 biến thể/định dạng | 5 × 1.856 = 9.280 | 9.280/9.280 | [`deep-seeds.log`](evidence/fuzz/deep-seeds.log) |
| Fuzz validator, 5 seed × 20.000 biến thể/định dạng | 5 × 240.000 = 1.200.000 | 0 lỗi ngoài `MediaFormatError`, 0 file quá 250 ms | [`validator-deep.log`](evidence/fuzz/validator-deep.log) |
| Toàn bộ back-end (`npm test`) | 2.486 | 2.486/2.486 | [`03-backend-full-suite.log`](evidence/fuzz/03-backend-full-suite.log) |
| API thật (`node dist/main.js` + JWT + Postgres 16 + đĩa) | 16 request | Đúng như mong đợi, DB và đĩa khớp | [`04-e2e-real-api.log`](evidence/fuzz/04-e2e-real-api.log) |

Phân bố kết quả với seed 20261113, 300 biến thể/định dạng:

| Kết quả | Số ca |
|---|---|
| `media_corrupted` (422) | 1.116 |
| `media_unsupported_type` (422) | 384 |
| Được nhận (biến thể vẫn hợp lệ) | 305 |
| `media_markup_rejected` (422) | 32 |
| `media_too_large` (413) | 3 |
| `media_empty_file` (422) | 3 |
| `media_external_resource` (422) | 2 |
| `media_kind_mismatch` (422) | 1 |
| `media_quarantined` | **0** |
| 5xx | **0** |

Với API thật, 5 media READY ứng với đúng 5 file trên đĩa. EXE, SVG, PNG hỏng CRC, file 15 MB và multipart hỏng không để lại bản ghi hay file. Job EXE kết thúc `failed / media_unsupported_type`, không có `mediaId`. Thiếu token hoặc token sai đều trả 401. Tên `../../etc/passwd.png` được lưu thành `passwd.png`, còn khóa lưu trữ là UUID nên không phụ thuộc tên file.

## Phát hiện và xử lý

### 1. Lỗi ở tầng multipart không theo envelope, thông điệp tiếng Anh (đã sửa)

**RED** ([`01-red-before-fix.log`](evidence/fuzz/01-red-before-fix.log)): chạy với controller của `dev` thì 10/296 ca thất bại.

| Đầu vào | Trước | Sau |
|---|---|---|
| File > 10 MB (vượt giới hạn multer) | 413 `{"message":"File too large"}` | 413 `media_too_large` · "File vượt giới hạn tải lên tối đa 10 MB" |
| Sai field (`upload`) | 400 "Unexpected field" | 400 `media_invalid_multipart` · "File phải được gửi trong trường "file" của form multipart/form-data" |
| 2 file | 400 "Too many files" | 400 `media_invalid_multipart` · "Mỗi lần chỉ được tải lên một file" |
| Hơn 10 field | 400 "Too many fields" | 400 `media_invalid_multipart` · "Form tải lên có quá nhiều trường hoặc trường quá dài" |
| Multipart cắt cụt, thiếu boundary, tên file chứa NUL | 400 "Unexpected end of form" / "Multipart: …" | 400 `media_invalid_multipart` · "Dữ liệu multipart/form-data không hợp lệ hoặc bị cắt cụt" |

Ảnh hưởng: `MediaPage.tsx` hiển thị `err.message`, nên người dùng CMS sẽ thấy "File too large". Trường hợp này cũng không tuân theo hợp đồng lỗi `errors[]`.

**Cách sửa:**
- Thêm `MediaFileInterceptor` (`back-end/src/modules/media/interceptors/media-file.interceptor.ts`) bọc `FileInterceptor('file')`.
- Interceptor chỉ bắt lỗi ở bước đọc multipart, trước khi handler chạy. HTTP status giữ nguyên; body được đổi về `{ message, errors: [{ field: 'file', code, message }] }`.
- Thêm mã mới `media_invalid_multipart`. Front-end không dựa vào mã lỗi nên không phải sửa.
- Áp dụng cho cả `/admin/media/upload` và `/admin/media/upload-jobs`.

### 2. Dữ liệu thừa ở đuôi file được nhận (không đổi, cần nhóm xác nhận)

PNG (sau IEND), JPEG (sau EOI), WebP (sau phần RIFF) và MP3 có dữ liệu nối đuôi, kể cả `<script>`, đều được nhận. GLB thì bị từ chối vì độ dài trong header phải khớp kích thước file.

Đây là hành vi có chủ đích. `media-structure.spec.ts` đã có test "dữ liệu thừa sau IEND được bỏ qua" và một test JPEG có `trailing`. Một số file hợp lệ thật sự có phần đuôi như vậy: ảnh "motion photo" trên điện thoại gắn video sau EOI, tag ID3v1 nằm ở cuối MP3.

Phần đuôi này **không thể thực thi** qua API, vì mọi đường phục vụ file đều đặt:
- `Content-Type` lấy từ DB theo nội dung thật;
- `X-Content-Type-Options: nosniff`;
- `Content-Security-Policy: default-src 'none'; sandbox`.

Bài fuzz kiểm đúng tính chất này cho polyglot PNG+HTML (gửi với tên `a.html` và `Content-Type: text/html`): file được lưu là `image/png` và được phục vụ với đủ ba header trên. Test của route công khai `media-delivery-http.spec.ts` cũng đã kiểm `nosniff` và `sandbox`.

### 3. VTT chứa `<script>` trong cue (an toàn, giữ nguyên)

Cue được nhận như văn bản. Front-end (`AudioPlayer.tsx`) lấy `getCueAsHTML().textContent` rồi render như text node của React, nên thẻ không bao giờ chạy.

## File thay đổi

| File | Vai trò |
|---|---|
| `back-end/src/modules/media/interceptors/media-file.interceptor.ts` | `MediaFileInterceptor`, `toMediaUploadException`, `MEDIA_UPLOAD_LIMITS` (chuyển từ controller sang) |
| `back-end/src/modules/media/inspection/media-format.error.ts` | Mã `media_invalid_multipart` |
| `back-end/src/modules/media/controllers/admin-media.controller.ts`, `admin-upload-jobs.controller.ts` | Dùng `MediaFileInterceptor()`; controller vẫn re-export `MEDIA_UPLOAD_LIMITS` |
| `back-end/src/modules/media/tests/media-fuzz-corpus.ts` | PRNG có seed, 8 chiến lược đột biến, file độc, tên file độc |
| `back-end/src/modules/media/tests/media-upload-fuzz.spec.ts` | Fuzz qua HTTP (I1–I6), dung lượng biên, multipart, giữ media cũ, đồng thời |
| `back-end/src/modules/media/tests/media-validator-fuzz.spec.ts` | Fuzz validator số lượng lớn |
| `back-end/package.json` | `npm run test:fuzz` |
| `docs/tasks/be/cms-media-upload.md` | Ghi chú mã lỗi ở tầng multipart |

## Chạy lại

```bash
cd back-end
npm run test:fuzz                                                    # seed mặc định, vài giây
FUZZ_SEED=42 FUZZ_ITERATIONS=300 FUZZ_VALIDATOR_ITERATIONS=20000 npm run test:fuzz   # chạy sâu
```

Nếu một ca thất bại, log sẽ in nhãn biến thể (ví dụ `png#17 flip-bytes+truncate`) và seed. Chạy lại với cùng `FUZZ_SEED` và `FUZZ_ITERATIONS` sẽ tái hiện đúng chuỗi byte đó.

## Giới hạn

- Fuzz HTTP dùng repository giả trong bộ nhớ để đếm chính xác bản ghi. Luồng với Postgres thật chỉ được kiểm bằng 16 request E2E, không chạy hàng nghìn ca.
- Không kiểm driver Supabase Storage, chỉ kiểm driver đĩa local. Hai driver dùng chung interface và cùng pipeline kiểm tra.
- Bộ đột biến chỉ sinh trên file nhỏ (vài trăm byte). Lỗi phụ thuộc kích thước lớn được phủ một phần bằng các ca biên 2 MB, 10 MB và 15 MB.

## Câu hỏi mở

1. Có muốn từ chối dữ liệu thừa sau IEND (PNG) hoặc sau phần RIFF (WebP) không? Hai định dạng này hiếm khi có phần đuôi hợp lệ. JPEG và MP3 nên giữ như hiện tại, vì có motion photo và ID3v1.
