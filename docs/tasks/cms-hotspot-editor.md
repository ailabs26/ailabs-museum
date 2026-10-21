# CMS: quản lý hotspot hiện vật

**Nhánh:** `feat/cms-hotspot-editor` (từ `dev` sau Task 10).
**SRS:** FR-62–66 (hotspot), §2.5 (CMS quản lý hotspot; bộ nghiệm thu: mỗi hiện vật ≥ 1 hotspot), §5.2.

## Mục tiêu

Biên tập viên thêm/sửa/xóa/sắp xếp hotspot song ngữ của bản nháp ngay trên CMS và đặt vị trí bằng cách
bấm lên mô hình 3D — không phải gọi API tay.

## Đã làm

### Tab "Hotspots" trong form hiện vật
`front-end/src/components/cms/HotspotEditor.tsx`
- Mỗi hotspot: tiêu đề vi/en (≤ 200), nội dung vi/en (≤ 5.000), vị trí X/Y/Z; nút lên/xuống/xóa.
- Validate phía client cùng luật cổng gửi duyệt (`helpers/exhibitHotspots.ts`); lỗi `hotspots[i].label.vi`
  của API được gắn đúng ô và chuyển sang tab Hotspots (`helpers/exhibitFormErrors.ts`).
- Form sửa nạp hotspot từ chi tiết hiện vật (danh sách không có). Chỉ gửi `hotspots` khi đã nạp xong —
  nạp lỗi thì bỏ trường, back-end giữ nguyên hotspot. Back-end thay **toàn bộ** hotspot của bản nháp bằng
  danh sách gửi lên; sửa bản đã publish thì revision nháp mới mang danh sách này (BR-21).

### Chọn vị trí trên mô hình (FR-65)
`shared/components/media/ModelHotspotPicker.tsx` (lazy, cùng chunk three.js)
- Bấm "Chọn trên mô hình" ở một hotspot rồi bấm lên bề mặt GLB; thanh trượt xoay mô hình để chọn mặt khác.
- Tọa độ trả về nằm trong **hệ local của GLB gốc** — đúng hệ tour dùng:
  vị trí hiển thị = (điểm + offset) × scale (`helpers/artifactHotspots.ts`). Hiện vật chưa có model: nhập tay,
  đơn vị mét quanh tâm bệ.
- Tải GLB qua `GET /admin/media/:id/content` (blob URL) vì 5 model seed nằm ở key `models/…`, không có URL ký.

### Back-end
- `GET /admin/media/:id/content` (quyền `media:upload`): stream file media `ready`; media cách ly/lỗi → 404;
  `Cache-Control: private, no-store`, `nosniff`, CSP sandbox; không pipe vào response đã đóng.
- Migration `WidenHotspotLabel1792150000000`: `hotspots.label` varchar(200) → text. Cột lưu chuỗi JSON
  `{"vi":…,"en":…}` trong khi mỗi ngôn ngữ được phép 200 ký tự → tiêu đề dài gây lỗi 500.

### Sửa kèm
- Form hiện vật `noValidate`: `required` gốc của trình duyệt chặn submit âm thầm khi ô lỗi ở tab ẩn.
- Sau khi lưu làm mới mọi chi tiết hiện vật đã cache (trước chỉ làm mới hiện vật đang mở ở drawer).
- Drawer chi tiết hiện tiêu đề/nội dung hotspot đã giải mã và theo `displayOrder` (trước hiện chuỗi JSON thô).

## Kiểm chứng (21/10/2026)

| Phần | Kết quả |
|---|---|
| Back-end `typecheck`, `lint`, `npm test` | Sạch; 1575/1575 |
| Front-end `typecheck`, `lint`, `test:unit`, `build` | Sạch; 85/85; picker tách chunk 10 KB |
| UI thật (Playwright, Supabase, model seed cọc gỗ Bạch Đằng) | **8/8** — `plans/261021-2027-cms-hotspot-editor/scripts/ui-smoke-hotspots.mjs` |

Kịch bản UI: thiếu tiêu đề tiếng Anh → không lưu, chuyển tab, đánh dấu ô; bấm mô hình điền tọa độ; tạo nháp 2
hotspot (server lưu đúng chữ, thứ tự, tọa độ); mở sửa nạp lại; đổi thứ tự được lưu; sửa phần khác giữ nguyên
hotspot; drawer chi tiết hiện đúng chữ. Kịch bản tự xóa hiện vật nháp.

## Giới hạn

- Migration chưa chạy trên DB dùng chung — cần `npm run migration:run` (trước đó tiêu đề vi+en > ~180 ký tự lỗi 500).
- Picker xoay quanh trục Y bằng thanh trượt, chưa có orbit/zoom; điểm khuất phía dưới đáy khó chọn — nhập tay.
- Xem trước media seed ở trang Media/drawer chi tiết vẫn không có URL ký (ngoài phạm vi; picker đã dùng endpoint mới).
