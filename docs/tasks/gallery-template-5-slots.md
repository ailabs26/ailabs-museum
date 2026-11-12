# Task: Phòng 3D theo Gallery Template V1 (5 bục cố định)

Người phụ trách: Nguyễn Văn Thắng. Nguồn yêu cầu: bản đặc tả «AURA MUSEUM — 3D Gallery Design Specification» V1 (11/11/2026) và ảnh concept
đi kèm. Phạm vi: phòng tham quan 3D và thao tác chọn bục trong CMS. Không đổi schema, không thêm API phòng, không dựng lại Admin CMS.

Nguyên tắc: *kiến trúc thuộc về scene, nội dung thuộc về CMS.*

## Chia PR (xếp chồng, merge theo thứ tự)

| # | Nhánh | Nội dung |
|---|---|---|
| 1 | `feat/gallery-slot-contract` | Contract 5 bục + resolver `slotted`/`legacy` + collider theo bục (logic thuần, chưa đổi hành vi) |
| 2 | `feat/gallery-slot-rendering` | Tách bục khỏi hiện vật, luôn dựng đủ 5 bục, nối collider/tour/XR/minimap |
| 3 | `feat/gallery-rotunda-architecture` | Kiến trúc «Aura Heritage Rotunda» + light rig nhiều tầng cho phòng theo template |
| 4 | `feat/cms-gallery-slot-picker` | Chọn bục trong form hiện vật của CMS, XYZ chuyển vào phần nâng cao |
| 5 | `feat/gallery-slot-publish-guard` | Back-end chặn trùng bục khi xuất bản/hiện lại/chuyển phòng; seed 5 model GLB lên 5 bục |

## Contract bục (`front-end/src/helpers/gallerySlots.ts`)

`GALLERY_SLOTS` là nguồn sự thật duy nhất cho scene, collider, minimap, đèn và CMS. Mét, Y hướng lên, gốc ở tâm phòng `14 × 16 × 5`.

| Bục | Vị trí | `[x, y, z]` | Loại | Bán kính vật cản |
|---|---|---|---|---|
| `S01` | Trung tâm | `[0, 0, -2]` | hero | 1,22 m |
| `S02` | Trái sau | `[-4.3, 0, -4.2]` | standard | 0,76 m |
| `S03` | Phải sau | `[4.3, 0, -4.2]` | standard | 0,76 m |
| `S04` | Trái trước | `[-4.3, 0, 2.1]` | standard | 0,76 m |
| `S05` | Phải trước | `[4.3, 0, 2.1]` | standard | 0,76 m |

- V1 không đổi database: bục được lưu bằng chính `position` XYZ của revision. Khớp tọa độ với bục theo sai số 5 cm (`matchGallerySlot`),
  không dùng `displayOrder` để suy ra bục.
- `resolveGalleryLayout(displays)`:
  - phòng rỗng, hoặc mọi hiện vật khớp duy nhất một bục → `slotted`: luôn đủ 5 bục, hiện vật chỉ ở bục được gán;
  - còn lại → `legacy` kèm lý do `unmatched-position` / `duplicate-slot` / `too-many-exhibits`: giữ nguyên vị trí, kiến trúc, đèn và collider cũ.
    Không ẩn, không cắt, không tự di dời hiện vật.
- `getGalleryColliders`: phòng `slotted` lấy vật cản từ 5 bục (bục trống vẫn chắn đường); phòng `legacy` trả đúng collider cũ.
- Mặt bục của mọi loại ở `y = 1.14` (`ARTIFACT_BASE_Y`): model, hotspot và camera focus dùng chung mốc này, không cộng chồng offset.

## Scene

```text
MuseumScene                      // một Canvas, frameloop="demand"; resolveGalleryLayout(displays)
  ├─ MuseumLighting              // variant legacy | rotunda, theo quality tier
  └─ GallerySurfaces
      ├─ MuseumRoom              // vỏ 14×16×5; GalleryArchitecture (legacy) | RotundaArchitecture
      └─ GallerySlots            // slotted: đúng 5 GallerySlotView
          └─ GallerySlotView
              ├─ GalleryPedestal // luôn có
              └─ ExhibitContent  // chỉ khi bục có hiện vật: model | placeholder, nhãn, hotspot
```

- Phòng `legacy` vẫn đi qua `ExhibitionDisplay` (bọc `GallerySlotView` với tọa độ tự do) nên hình ảnh và hành vi không đổi.
- Chọn/hover/deep link/audio/hotspot vẫn theo exhibit id. Bục trống chắn tia chọn nhưng không mở chi tiết nào, không có trong
  danh mục, minimap (chỉ là vòng mốc) hay Guided Tour.
- GLB lỗi hoặc đang tải: giữ bục và fallback hiện có.
- `RotundaArchitecture`: vòng trần + giếng trời giả lập (mặt phát sáng, 64 nan gỗ instanced), bốn hốc vòm sau bục cạnh, cửa vòm lối vào,
  vách trung tâm mang biển «AURA MUSEUM» + tên phòng từ CMS, hai trụ phù điêu hình học, hoạ tiết sàn đồng tâm quanh bục trung tâm,
  dải cove emissive. Trang trí không có collider nên chỉ bám tường (≤ 0,2 m), sát sàn hoặc cao trên 4,6 m; vỏ đi lại không đổi.
  Hoạ tiết vẽ bằng Canvas 2D (`rotundaTextures.ts`), không thêm tệp ảnh, không mô phỏng hiện vật có thật.
- Light rig (`galleryLighting.ts`, `GALLERY_LIGHTING_PRESET`): môi trường PMREM + ambient/hemisphere; một directional key là nguồn đổ bóng
  duy nhất; 5 spot trung tính ấm cho 5 bục (tier thấp: 3 spot); cove/chân bục là emissive tĩnh; hắt tường phụ jade bên trái,
  xanh lam bên phải bằng lớp phủ alpha + 2 point light không bóng (bỏ ở tier thấp). Không có animation idle.

## CMS (`ExhibitsPage` → `GallerySlotPicker`)

- Tab «Vị trí 3D & Khối tạm»: chọn một trong 5 bục theo sơ đồ mặt bằng; hiển thị Trống / Đã có hiện vật (kèm tên) theo các hiện vật
  khác của phòng. Bục của hiện vật khác bị khóa; bục của chính hiện vật đang sửa vẫn chọn được.
- Tạo mới hoặc đổi phòng: tự chuyển sang bục trống đầu tiên của phòng đó, không mang vị trí từ phòng cũ. Sửa hiện vật mà không đổi phòng:
  không bao giờ tự đổi vị trí.
- Payload vẫn là `position` XYZ; quy trình nháp → duyệt → xuất bản không đổi. Ô nhập X/Y/Z còn trong «Tọa độ nâng cao (legacy)».

## Chống trùng bục ở server

`RevisionPublishGate.assertSlotFree` chạy trong transaction, sau khi khóa `FOR UPDATE` mọi hiện vật chưa xóa của phòng:
mỗi bục của một phòng chỉ có tối đa một hiện vật đang công khai. Áp dụng ở ba chỗ đưa hiện vật ra công khai trong một phòng:
xuất bản (`ModerationService.publish`), hiện lại (`unhide`), chuyển phòng một hiện vật đang công khai (`updateExhibitDraft`).
Trùng → `422` với `code: gallery_slot_occupied`. Tọa độ tự do không bị ràng buộc.

## Giới hạn đã biết

- Chưa có cột `slotId`: bục được suy từ tọa độ. Đổi tọa độ bục trong tương lai cần migration riêng cho dữ liệu đã lưu.
- Hằng số bục có hai bản (front-end và back-end) phải giữ khớp tay; mỗi bên có test khóa giá trị.
- Phòng đang công khai với tọa độ tự do vẫn ở `legacy` cho tới khi biên tập viên chuyển từng hiện vật lên bục và xuất bản lại.
  Seed chỉ đặt 5 model GLB lên bục ở môi trường mới; seed không ghi đè dữ liệu đã có.
- Bục cạnh rộng 1,4 m, model chuẩn hóa tối đa 1,8 m: model rất rộng có thể nhô khỏi mặt bục (vật cản vẫn bao trọn). Chưa có cảnh báo trong CMS.
- Guard server chỉ xét hiện vật đang công khai. Hai bản nháp cùng chọn một bục vẫn lưu được; bản xuất bản sau sẽ bị từ chối.
- Chất lượng ánh sáng mới được duyệt bằng ảnh chụp SwiftShader; FPS trên GPU thật, điện thoại và WebXR trên headset chưa đo.

## Kiểm chứng ngày 12/11/2026

- Front-end: lint, typecheck đạt; vitest 351/351 (thêm `gallerySlots`, `galleryLighting`).
- Playwright (SwiftShader):
  - `museum-gallery-slots.spec.ts` 9/9: phòng 0/1/2/5 hiện vật đúng 5 bục; gỡ hiện vật giữ bục; bục trống chắn đường và không mở chi tiết;
    tọa độ tự do/trùng/6 hiện vật ở lại `legacy`, không mất hiện vật; đúng 1 nguồn đổ bóng, 5 spot + 2 hắt màu (3 spot ở tier thấp);
    mở/đóng phòng 3 lần không tăng geometry/texture/material; không render khi đứng yên.
  - `cms-gallery-slot-picker.spec.ts` 5/5.
  - Hồi quy `museum-*`, `guided-tour-*`, `tour-*`, `cms-*`, `exhibit-*`: 330 đạt. 9 test lỗi đều lỗi y hệt trên `dev` trước thay đổi
    (`exhibit-preview:80`, `museum-audit:77`, `museum-navigation:73/87/117`, `museum-tour:19`, `room-mapping:6`, `tour-2d-fallback:140`,
    `tour-exhibit-deep-link:46`) — chưa xử lý trong task này.
- Ngân sách render phòng template đo trên SwiftShader 1440×810: phòng trống 63 draw call / 8 nghìn tam giác; 5 hiện vật khối tạm 83 draw call /
  16 nghìn tam giác (phòng legacy 5 hiện vật: ≤ 70 / ≤ 25 nghìn). Test khóa ở ≤ 95 call, ≤ 25 nghìn tam giác, ≤ 22 texture.
- Back-end (PostgreSQL 16 tạm, cục bộ): lint, typecheck đạt; `npm test` 2313/2313, 0 skipped.
  `gallery-slot-guard.integration.spec.ts`: 2 và 6 lần xuất bản đồng thời vào cùng một bục → đúng 1 thành công.
- Chưa làm: ảnh chụp với 5 model GLB thật, benchmark GPU thật/điện thoại, WebXR trên headset, video Guided Tour qua 5 bục.
