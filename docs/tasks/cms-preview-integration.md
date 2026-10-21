# Task 10: Tích hợp media & xem trước trên CMS

**Nhánh:** `feat/cms-preview-integration` (từ `dev` sau khi Task 9 + Supabase vào `dev`).
**Phụ thuộc:** Task 8 (pipeline upload), Task 9 (slot media, cổng Submit, URL ký), Supabase storage.
**SRS:** FR-55–57, FR-97, §5.1–5.2, AC-32/33/35/36.

## Mục tiêu

Editor làm trọn luồng trên giao diện CMS, không cần gọi API tay:
upload media → bổ sung quyền sử dụng → gắn vào hiện vật → nhập alt text/lời thuyết minh song ngữ →
xem trước 2D/3D → gửi duyệt; nếu chưa đủ điều kiện thì thấy đúng ô cần sửa.

## Đã làm

### Trang thư viện Media (`/admin/media`, quyền `media:upload`)
`front-end/src/pages/admin/MediaPage.tsx` thay trang placeholder.
- **Upload theo loại** (model/ảnh/audio/phụ đề): kiểm dung lượng sớm ở client theo giới hạn của back-end
  (GLB/MP3 10 MB, ảnh 2 MB, VTT 1 MB), thanh tiến độ, hiện nguyên thông điệp 413/422/cách ly của back-end.
  Back-end vẫn là nơi kiểm thật (magic bytes, cấu trúc).
- Upload xong **mở ngay form thông tin** để điền nguồn/tác giả/giấy phép (bắt buộc khi Submit — FR-97).
- Tìm kiếm (tên tệp, mô tả, nguồn, tác giả), lọc loại/trạng thái, phân trang.
- Cột **Quyền sử dụng: Đủ/Thiếu**; xem trước trong modal; xóa có xác nhận, hiện thông điệp 409 BR-21.

### Gắn media vào hiện vật (`ExhibitsPage`)
Tab mới **"Media & thuyết minh"** trong form tạo/sửa:
- 6 ô chọn media theo slot: Model 3D, Ảnh, Audio vi/en, Phụ đề vi/en (`MediaSlotSelect`) — chỉ liệt kê media
  `ready` đúng loại, cảnh báo + link sang thư viện khi media thiếu quyền sử dụng; media đang gắn mà không còn
  sẵn sàng vẫn hiện để gỡ.
- Alt text ảnh vi/en, lời thuyết minh (transcript) vi/en.
- Lưu gửi `modelId…subtitleEnId` (`null` = tháo, không xóa tệp), `altText`, `transcript` (`null` khi trống).
- Sửa hiện vật điền lại đủ slot, alt text, transcript.

### Báo lỗi đúng chỗ
- `helpers/exhibitFormErrors.ts`: ánh xạ `errors[].field` của API (`imageId`, `altText.vi`, `transcript.en`,
  `name.vi`, `scale`, alias `audioId`…) sang ô của form; lỗi không gắn được (vd hotspot) báo chung.
- **Gửi duyệt bị 422** (cổng §5.2/FR-97): mở form của hiện vật đó, đánh dấu đúng các ô, chuyển sang tab có lỗi.
- Lỗi validate phía client ở tab khác (vd chưa chọn phòng khi đang ở tab Media) → tự chuyển tab.

### Xem trước 2D/3D
- `shared/components/media/MediaPreview.tsx`: ảnh (alt text), audio kèm `<track>` phụ đề cùng ngôn ngữ, nội dung
  phụ đề, GLB.
- `ModelPreview.tsx`: **lazy-load** (three.js chỉ tải khi xem GLB), dùng lại các bước an toàn của tour
  (kiểm header glTF, chặn tài nguyên ngoài tệp, `sanitizeModel`, `normalizeModel`), tự xoay, giải phóng GPU khi
  đóng; lỗi hiện thông điệp tiếng Việt.
- Drawer chi tiết hiện vật: tab **"Media & xem trước"** (mặc định) xem media của bản đang hiển thị — kể cả bản
  nháp — qua URL ký, kèm trạng thái quyền sử dụng từng media.

### Back-end
- `fix(exhibits)`: response admin trả `content.altText` để form điền lại (trước chỉ có `transcript`).
- `fix(media)` — **API sập khi client hủy request**: trình duyệt hủy tải (đóng preview, StrictMode chạy lại
  effect) đúng lúc API đang chờ Supabase → `pipeline()` ném `ERR_STREAM_UNABLE_TO_PIPE` trước khi gắn listener
  → body Supabase mồ côi phát lỗi HTTP/2 muộn → **process Node thoát**. Controller giờ hủy stream nguồn và dừng
  khi response đã đóng.
- `fix(media)` — **upload lên Supabase bị hủy**: timeout 15 s của driver tính cả thời gian gửi thân request →
  GLB 3,5 MB trên mạng chậm lỗi 500 "This operation was aborted". Upload có timeout riêng `uploadTimeoutMs`
  (mặc định 120 s, khớp timeout client); đọc/xóa giữ 15 s.
- `fix(exhibits)` — **hiện vật nháp mất tên, không tìm được**: danh sách & tìm kiếm admin chỉ đọc revision đã
  publish → hiện vật chưa publish hiện "Chưa đặt tên", tìm theo tên không ra. Tìm kiếm khớp thêm revision mới
  nhất; danh sách lấy revision mới nhất của cả trang trong 1 truy vấn `DISTINCT ON` (giống chi tiết admin).

## File chính

| File | Vai trò |
|---|---|
| `front-end/src/services/media.service.ts` | API `/admin/media` (list/get/upload có tiến độ/update/delete) |
| `front-end/src/helpers/mediaLibrary.ts` (+test) | Giới hạn dung lượng, accept, kiểm quyền sử dụng |
| `front-end/src/helpers/exhibitFormErrors.ts` (+test) | Ánh xạ lỗi API → ô form, tìm tab có lỗi |
| `front-end/src/shared/components/media/MediaPreview.tsx`, `ModelPreview.tsx`, `MediaSlotSelect.tsx` | Xem trước & chọn media |
| `front-end/src/pages/admin/MediaPage.tsx` | Thư viện media |
| `front-end/src/pages/admin/ExhibitsPage.tsx` | Tab media, báo lỗi Submit, tab xem trước |
| `back-end/src/modules/exhibits/dto/exhibit-response.dto.ts` | Trả `altText` |
| `back-end/src/modules/media/controllers/media-delivery.controller.ts` | Không pipe vào response đã đóng |
| `back-end/src/modules/media/storage/supabase-storage.driver.ts` | Timeout upload riêng |
| `back-end/src/modules/exhibits/repositories/exhibits.repository.ts`, `services/exhibits.service.ts` | Danh sách/tìm kiếm theo revision mới nhất |

## Kiểm chứng

**Tự động** (21/10/2026):

| Phần | Kết quả |
|---|---|
| Back-end `typecheck`, `lint` | Sạch |
| Back-end `npm test` | 1570/1570 đạt |
| Front-end `typecheck`, `lint` | Sạch |
| Front-end `test:unit` | 77/77 đạt |
| Front-end `build` | Đạt; `ModelPreview` (three.js) tách chunk riêng |

**UI thật** — kịch bản Playwright trên build production (API + Vite riêng), DB/bucket Supabase thật, GLB thật
`coc_go_bach_dang.glb` 3,56 MB; kịch bản tự xóa hiện vật nháp + media tạo ra. Kết quả **19/19 đạt**:

| # | Bước | Kết quả |
|---|---|---|
| 1 | Đăng nhập CMS | ✅ |
| 2 | Trang Media; upload ảnh/MP3/VTT/GLB, điền quyền sử dụng ngay sau upload; cột quyền = "Đủ" | ✅ |
| 3 | Xem trước ảnh (URL ký) và GLB dựng thành canvas 3D | ✅ |
| 4 | Mở/đóng preview GLB 5 lần liên tục → API vẫn sống (`/health` 200) | ✅ |
| 5 | Tạo bản nháp gắn 4 media + transcript; server lưu đúng slot | ✅ |
| 6 | Gửi duyệt khi thiếu alt text → 422 → form mở lại ở tab Media, ô alt text vi/en `aria-invalid` | ✅ |
| 7 | Điền alt text → lưu → mở lại form thấy alt text từ server | ✅ |
| 8 | Drawer chi tiết: ảnh tải được, audio kèm `<track>` phụ đề, GLB thành canvas | ✅ |

Kiểm thử thật tìm ra 3 lỗi back-end (đã sửa, xem mục Back-end): API sập khi client hủy request, upload Supabase
bị hủy do timeout, hiện vật nháp mất tên/không tìm được trong danh sách. Lỗi 401 `/auth/me` trong console là
luồng khởi động auth bình thường (chưa có access token → refresh), không thuộc Task 10.

## Giới hạn & việc sau

- Chưa có UI kéo-thả sắp xếp hiện vật (API reorder đã chặt — phải gửi đủ id của phòng).
- Ô chọn media lấy tối đa 100 media `ready` mỗi loại (giới hạn `pageSize` của API); thư viện lớn hơn cần ô chọn
  có tìm kiếm phía server.
- Preview GLB không kiểm checksum như tour (chỉ xem trước trong CMS).
- Preview dùng URL ký 15 phút: để drawer mở lâu thì đóng/mở lại để làm mới.
- Chưa có test component React (dự án chưa cài Testing Library); hành vi UI được kiểm bằng kịch bản Playwright
  chạy tay trên Supabase thật.
