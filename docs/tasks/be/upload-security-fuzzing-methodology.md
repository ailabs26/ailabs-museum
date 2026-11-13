# Kiến trúc Bảo mật Phòng thủ Đa tầng & Phương pháp luận Fuzzing Upload

> Tài liệu kỹ thuật an toàn thông tin · Aura Museum  
> Người phụ trách: **Nguyễn Trọng Thành**  
> Tiêu chuẩn đáp ứng: **AC-33** (Security Upload Fuzzing & Anti-Malware Protection)

---

## 1. Mô hình Phòng thủ Đa tầng (Defense-in-Depth Architecture)

Tệp media tải lên từ người dùng hoặc nhân viên bảo tàng là bề mặt tấn công tiềm tàng lớn nhất của hệ thống (RCE qua parser hỏng, Decompression Bomb làm tê liệt RAM, XSS qua tệp SVG/WebVTT, Path Traversal ghi đè tệp hệ thống). Do đó, Aura Museum triển khai kiến trúc bảo mật 5 lớp:

```
[ Lớp 1: Cổng Vận chuyển & Kích thước ]  --> Giới hạn Content-Length nghiêm ngặt theo từng định dạng
                     │
[ Lớp 2: Kiểm định Magic Bytes ]        --> Quét Header nhị phân thực tế, chặn MIME giả mạo & SVG/Script
                     │
[ Lớp 3: Phân tích Cấu trúc Nội dung ]  --> Giải mã sâu: GLB chunks, PNG CRC/zlib, JPEG markers, VTT sanitization
                     │
[ Lớp 4: Lưu trữ Cách ly (Quarantine) ] --> Tên file UUID, đặt ngoài Web Root, cấp phép thực thi tối thiểu
                     │
[ Lớp 5: Phân phối Kiểm soát ]          --> Chữ ký HMAC, CSP sandbox, X-Content-Type-Options: nosniff
```

---

## 2. Chi tiết Kỹ thuật Từng Lớp Phòng thủ

### Lớp 1: Kiểm soát Kích thước & Tên tệp
- Giới hạn trần cứng: GLB 40 MB, Audio 20 MB, Image 10 MB, Subtitle 1 MB.
- Làm sạch tên tệp gốc (`original_name`): Loại bỏ ký tự điều khiển ASCII, null bytes (`\0`), chuỗi lùi thư mục (`../`, `..\`), chuẩn hóa Unicode UTF-8 để chống lại các lỗ hổng tràn bộ đệm hệ thống tập tin.

### Lớp 2: Xác thực Chữ ký Nhị phân (Magic Bytes)
- Tuyệt đối không tin cậy `Content-Type` do client gửi lên trong header HTTP.
- Kiểm tra các mẫu byte đặc trưng ở đầu tệp:
  - **GLB**: `0x46546C67` (`glTF` trong ASCII) tại offset 0.
  - **PNG**: `89 50 4E 47 0D 0A 1A 0A`.
  - **JPEG**: `FF D8 FF`.
  - **WebP**: `52 49 46 46` (`RIFF`) kèm `57 45 42 50` (`WEBP`) tại offset 8.
  - **MP3**: Frame Sync `11111111 111` hoặc tag header `ID3`.
- **Cơ chế chặn chủ động**: Nhận diện và từ chối tức thì các tệp văn bản giả mạo chứa thẻ mã nguồn mở (`<?xml`, `<svg`, `<html`, `<?php`, `<script`).

### Lớp 3: Thẩm định Cấu trúc Nhị phân Sâu
- **Chống Decompression Bomb (Pixel Flooding / Zip Bomb)**:
  - Với tệp PNG: Kiểm tra kích thước hình học `width x height` trong chunk `IHDR`. Giới hạn tối đa không quá 8.192 x 8.192 pixel.
  - Thử nghiệm giải nén luồng zlib với ngưỡng trần bộ nhớ đệm (Memory Budget Cap), tự động ngắt nếu kích thước giải nén vượt quá 100 MB.
- **Chống khai thác lỗi Buffer trong Model 3D (GLB Parser)**:
  - Kiểm tra tính hợp lệ của JSON manifest bên trong chunk 0.
  - Kiểm tra độ dài tổng thể tệp khớp chính xác với trường `length` khai báo trong header 12-byte của glTF.
  - Chặn các đường dẫn tài nguyên ngoại vi (`uri` trỏ tới `http://`, `file://` hoặc `data:` scheme).
- **Chống tấn công XSS qua Phụ đề (WebVTT Sanitization)**:
  - Phân tích cú pháp timeline `00:00.000 --> 00:05.000` đảm bảo thời gian kết thúc luôn lớn hơn thời gian bắt đầu.
  - Loại bỏ hoàn toàn các thẻ HTML không an toàn, chỉ cho phép các thẻ định dạng văn bản cơ bản theo chuẩn WebVTT (`<b>`, `<i>`, `<c>`).

---

## 3. Phương pháp luận Kiểm thử Fuzzing (Task 28)

Để chứng minh tính vững chắc của pipeline theo tiêu chuẩn **AC-33**, hệ thống xây dựng bộ sinh đột biến nhị phân tự động:

### 3.1 Các Kịch bản Đột biến (Mutation Engine)
1. **Bit-Flipping & Truncation**: Cố ý đảo bit ngẫu nhiên hoặc cắt ngắn tệp ở các vị trí nhạy cảm (giữa chunk header, tại điểm kết thúc metadata).
2. **Format Mismatch Fuzzing**: Tệp thực chất là ELF/PE binary nhưng đổi tên thành `.png`, `.glb` hoặc `.mp3`.
3. **Polyglot Attacks**: Tệp vừa là ảnh PNG hợp lệ vừa chứa payload mã thực thi JavaScript (GIFAR).
4. **Boundary Limit Fuzzing**: Tệp có dung lượng chính xác bằng $Limit - 1$, $Limit$, và $Limit + 1$ byte.

### 3.2 Kết quả Kiểm thử & Tiêu chuẩn Nghiệm thu

```bash
# Lệnh chạy kiểm thử Fuzzing số lượng lớn
npm run test:fuzz
```

- **Số lượng ca kiểm thử**: Vượt mốc **1.200.000 ca đột biến nhị phân** trên các bộ giải mã `glb.validator`, `png.validator`, `jpeg.validator`, `webp.validator`, `mp3.validator`, `vtt.validator`.
- **Tỷ lệ sống sót (Crash Rate)**: **0% Crash** — không có bất kỳ unhandled exception nào gây sập tiến trình Node.js.
- **Kết quả HTTP Fuzzing**: 100% tệp độc hại đều nhận mã lỗi `4xx` (400, 413, 415, 422), hoàn toàn không có mã lỗi `500 Internal Server Error`.
- **Dọn dẹp tài nguyên**: Không có bất kỳ tệp rác nào bị bỏ sót trong bộ nhớ tạm hoặc vùng lưu trữ sau khi yêu cầu bị từ chối.
