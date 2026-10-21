# CMS: cấu hình thứ tự guided tour

**Nhánh:** `feat/cms-tour-order` (từ `dev` sau preview 3D).
**SRS:** FR-76 (xem trình tự tour), FR-77 (đổi thứ tự), FR-78 (chỉ hiện vật đã xuất bản), FR-79 (lưu bền).

## Đã làm

- Nút **"Thứ tự tour"** trên trang Hiện vật (quyền `exhibit:update`) mở `components/cms/TourOrderModal.tsx`.
- Chọn phòng (mặc định phòng đang lọc), xem danh sách theo đúng quy tắc tour công khai — `displayOrder` rồi id
  (`helpers/tourOrder.ts`, khớp `mapRoomDisplays`).
- Đổi thứ tự bằng **kéo-thả** (HTML5, không thêm thư viện) hoặc **nút lên/xuống** (bàn phím, có `aria-label`);
  **Hoàn tác** về thứ tự đã lưu; nút lưu chỉ bật khi có thay đổi.
- Lưu gọi API có sẵn `PUT /admin/exhibits/rooms/:roomId/reorder` với đủ id của phòng (back-end chặn danh sách
  thiếu/thừa/trùng trong transaction có khóa), rồi làm mới danh sách hiện vật và dữ liệu phòng công khai.
- Badge **"Trong tour"** / **"Bản nháp"** và số hiện vật đã xuất bản: bản nháp giữ chỗ trong thứ tự, chỉ vào tour
  khi được xuất bản (FR-78 do API public bảo đảm).

## Kiểm chứng (21/10/2026)

| Phần | Kết quả |
|---|---|
| Front-end `typecheck`, `lint`, `test:unit`, `build` | Sạch; 120/120 |
| UI thật (Playwright, Supabase) | **8/8** — `plans/261021-2027-cms-tour-order/scripts/ui-smoke-tour-order.mjs` |

Kịch bản dùng **phòng thử riêng** (chuyển sang lưu trữ ngay, không hiện cho khách) với 3 bản nháp để không đổi
thứ tự phòng thật: thấy thứ tự hiện tại; nút lưu tắt khi chưa đổi; nút lên trên; hoàn tác; kéo-thả; lưu → server
cập nhật `displayOrder`; mở lại vẫn giữ thứ tự. Tự xóa hiện vật và phòng thử.

## Giới hạn

- Phòng hơn 100 hiện vật (giới hạn `pageSize` của API) chưa sắp xếp được trên giao diện — modal báo lỗi.
- Kéo-thả HTML5 không hỗ trợ cảm ứng; trên điện thoại dùng nút lên/xuống.
- Xóa phòng là xóa mềm: phòng thử của kịch bản còn bản ghi `is_deleted = true` với slug `e2e-tour-<timestamp>`.
