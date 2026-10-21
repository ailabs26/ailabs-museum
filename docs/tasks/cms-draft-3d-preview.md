# CMS: preview 3D bản nháp

**Nhánh:** `feat/cms-draft-3d-preview` (từ `dev` sau hotspot editor).
**SRS:** FR-69 (preview Draft trong 3D), FR-70 (transform), FR-71 (hotspot, nội dung song ngữ, media), §2.5.

## Mục tiêu

Biên tập viên/người duyệt xem bản nháp **như khách sẽ thấy**: trong phòng trưng bày 3D, giữa các hiện vật đã
xuất bản, với model, nhãn, hotspot và nội dung từng ngôn ngữ — trước khi gửi duyệt/xuất bản.

## Đã làm

- Trang `/admin/exhibits/:id/preview` (quyền `exhibit:read`), mở từ nút **"Xem trước 3D trong phòng trưng bày"**
  trong drawer chi tiết hiện vật (`pages/admin/ExhibitPreviewPage.tsx`).
- Dùng **chính `MuseumScene` của tour** (lazy): phòng, bệ, nhãn, hotspot, điều hướng WASD/kéo, nút góc nhìn,
  panel chi tiết. Không viết scene thứ hai.
- Dữ liệu: chi tiết admin (revision mới nhất) + phòng công khai (`/rooms/:slug`) — bản nháp thay bản đã xuất
  bản cùng id hoặc được thêm vào (`helpers/draftPreviewDisplay.ts`). Phòng lưu trữ/không công khai → chỉ hiện
  bản nháp kèm cảnh báo.
- Model bản nháp đi qua `loadMuseumModel` của tour với `url = /admin/media/:id/content` (axios gắn token): vẫn
  kiểm header glTF, **checksum SHA-256 và kích thước** như khách. Model trùng checksum với hiện vật đã xuất bản
  dùng chung một lần tải (cùng nội dung). Bản nháp đứng đầu hàng đợi tải (2 luồng) để không phải chờ 5 model
  seed 16–29 MB.
- Chuyển **Tiếng Việt / English**: tên, mô tả, thuyết minh, alt text, hotspot theo đúng ngôn ngữ; thiếu bản dịch
  hiện "(Chưa có tiếng Việt)" / "(No English text yet)" thay vì lấy ngôn ngữ kia.
- Hiện giá trị position/rotation/scale của revision; panel chi tiết bỏ link "Đọc chi tiết 2D" (bản nháp không có
  trang công khai).

## Kiểm chứng (21/10/2026)

| Phần | Kết quả |
|---|---|
| Front-end `typecheck`, `lint`, `test:unit`, `build` | Sạch; 116/116 |
| UI thật (Playwright, Supabase, phòng `bo-suu-tap-glb`) | **9/9** — `plans/261021-2027-cms-draft-3d-preview/scripts/ui-smoke-preview.mjs` |

Kịch bản: upload GLB sinh riêng (checksum mới) + tạo nháp có hotspot qua API; nút trong drawer mở preview; model
tải qua endpoint admin và qua kiểm checksum; panel hiện nội dung + hotspot tiếng Việt, đổi sang English đúng chữ;
không có link 2D; hiện vật đã xuất bản khác của phòng có mặt. Tự xóa nháp và media.

## Giới hạn

- **Tour chưa áp rotation/scale** (`MuseumDisplay` chỉ có `position`) nên preview cũng không áp — FR-61/70 cần
  mảng 3D bổ sung ở `ExhibitionDisplay`; preview sẽ tự đúng theo khi tour áp dụng.
- Ảnh/audio của model seed (key ngoài `uploads/`) vẫn không có URL ký → panel hiện ảnh thay thế.
- Preview dùng URL ký 15 phút cho ảnh; để lâu cần tải lại trang.
