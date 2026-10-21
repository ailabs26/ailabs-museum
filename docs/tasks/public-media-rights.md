# Công khai quyền sử dụng media (FR-97)

**Nhánh:** `feat/public-media-rights` (từ `dev` sau thứ tự tour).
**SRS:** FR-97 — nguồn, tác giả/chủ sở hữu, giấy phép của media "cần công khai phải truy cập được ở 2D/3D
từ revision public hiện hành".

## Đã làm

- **Back-end:** descriptor model GLB công khai (`toPublicModel`) mang thêm `rights` — trước chỉ ảnh/audio/phụ đề
  có. Không lộ thêm gì khác (storageKey/checksum vốn thuộc contract tour).
- **Front-end:**
  - `validations/roomSchema.ts`: `rights` của model (tùy chọn, để payload cũ vẫn hợp lệ).
  - `helpers/mediaCredits.ts`: gom ghi công theo thứ tự model → ảnh → thuyết minh/phụ đề vi → en; bỏ media không
    có thông tin, bỏ trùng id, cắt khoảng trắng.
  - `components/museum/MediaCreditList.tsx`: mỗi dòng "Loại media: Tác giả · Nguồn · Giấy phép".
  - Mục **"Nguồn & bản quyền"** ở trang 2D (`ExhibitDetailPage`) và panel chi tiết tour 3D (`ExhibitDetailPanel`,
    qua `MuseumDisplay.credits` từ `mapRoomDisplays`). Không có thông tin → không hiện mục.
  - Preview 3D bản nháp hiện ghi công từ quyền của media đang gắn (giống khách sẽ thấy sau khi xuất bản).

## Kiểm chứng (21/10/2026)

| Phần | Kết quả |
|---|---|
| Back-end `typecheck`, `lint`, `npm test` | Sạch; 1575/1575 |
| Front-end `typecheck`, `lint`, `test:unit`, `build` | Sạch; 124/124 |
| UI thật (Playwright, Supabase) | **4/4** — `plans/261021-2027-public-media-rights/scripts/ui-smoke-media-rights.mjs` |

Kịch bản không sửa metadata media thật: kiểm API public (5 model đều có `rights`), trang 2D đọc được payload mới
và chỉ hiện mục ghi công khi có dữ liệu; tạo GLB thử có quyền + bản nháp → panel preview hiện
"Mô hình 3D: Tác giả: Claude · Nguồn: E2E Rights · Giấy phép: CC0". Tự xóa nháp và media.

## Việc cần làm của nhóm

- **5 hiện vật đang công khai chưa có thông tin quyền nào** (seed thẳng, không qua cổng gửi duyệt) → khách chưa
  thấy mục ghi công. Điền nguồn/tác giả/giấy phép cho media ở trang **Media**: quyền gắn với media nên tour hiện
  ngay, không cần xuất bản lại.
