# Shared Exhibit Preview — Implementation Plan

> **For agentic workers:** Người dùng đã duyệt tài liệu. Dùng Superpowers `executing-plans` trên nhánh riêng `feat/shared-exhibit-preview`, không subagent; kiểm chứng trước commit từng task.

**Goal:** Minh họa CSS dùng chung cho collection, featured, catalogue tour và panel chi tiết, độc lập WebGL.

**Architecture:** Di chuyển CSS shape hiện có ở MuseumCatalogue sang `ExhibitPreview` thuần presentation. Bốn consumer truyền thông số shape/color đã có, className giữ kích thước riêng. Three.js scene giữ nguyên; API và mapper không thay đổi.

**Tech Stack:** React, TypeScript, CSS Modules/Mantine và Playwright hiện có.

Task nguồn: [shared-exhibit-preview.md](../tasks/shared-exhibit-preview.md).

## Global Constraints

- Base `c814655`, nhánh đã tạo trước tài liệu; người dùng cần duyệt tài liệu cụ thể trước commit/code.
- Không thêm dependency, seed, asset file, ảnh giả, WebGL renderer hoặc URL storage.
- Media schema/API vẫn null; ảnh thật và lỗi tải ảnh là lượt sau khi có contract.
- Named export/alias/CSS Module theo `front-end/docs/coding-conventions.md`.
- Caption “Hình minh họa thay thế” + “Chưa có ảnh”; shape trang trí aria-hidden, caption không aria-hidden.
- Giữ nội dung và selection/focus; không đổi size/geometry 3D hoặc dùng screenshot Canvas làm thumbnail.
- Không viết interface/config/variant cho các nhu cầu media chưa tồn tại.

## File map và interface

| File | Công việc |
|---|---|
| `front-end/src/shared/components/data/ExhibitPreview.tsx` | Tạo component thuần DOM/CSS |
| `front-end/src/shared/components/data/ExhibitPreview.module.css` | CSS shape/caption và màu surface tương thích public/tour |
| `front-end/src/shared/components/data/ExhibitGrid.tsx` | Thay IconPhotoOff/vùng noImage bằng preview từ API |
| `front-end/src/shared/components/data/ExhibitGrid.module.css` | Bỏ style noImage trùng; giữ khung preview 160 px |
| `front-end/src/components/museum/MuseumCatalogue.tsx` | Thay span shape bằng shared preview; bỏ CSSProperties import |
| `front-end/src/components/museum/MuseumCatalogue.module.css` | Bỏ CSS shape trùng, giữ margin/kích thước vùng preview phù hợp caption |
| `front-end/src/components/museum/ExhibitDetailPanel.tsx` | Thay vùng mediaFallback bằng preview |
| `front-end/src/components/museum/ExhibitDetailPanel.module.css` | Bỏ style fallback trùng, giữ panel layout |
| `front-end/tests/exhibit-preview.spec.ts` | Tests shape/color/caption/no-WebGL và integration |
| `front-end/tests/exhibit-preview-live.spec.ts` | Opt-in API thật, không DB writes/interception |
| `front-end/README.md` và task/plan | Hướng dẫn và bằng chứng |

Component interface:

```ts
type ExhibitPreviewProps = {
  shape: 'box' | 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'icosahedron';
  color: string;
  className?: string;
};
// export function ExhibitPreview(props: ExhibitPreviewProps)
```

Type là presentation union nhỏ, không import Three.js. Trong component dùng `data-shape={shape === 'cube' ? 'box' : shape}`; màu qua React style custom property typed `CSSProperties`. Không interpolate API vào HTML/CSS string; chỉ dùng giá trị đã validate từ consumer.

## PREVIEW-01: Duyệt và commit tài liệu

- [x] Người dùng đọc task/plan và duyệt phạm vi minh họa chung/caption.
- [ ] Review status/diff/log, commit chỉ hai tài liệu:

```powershell
git add -- docs/tasks/shared-exhibit-preview.md docs/plans/shared-exhibit-preview-plan.md
git diff --cached --check
git diff --cached
git commit -m "docs(preview): plan shared 2D exhibit illustration"
```

## PREVIEW-02: Component và bốn consumer

- [ ] Viết Playwright test trước, dùng fixture API hiện có. `/collection` có 5 preview với shape/color của fixture và 5 caption; homepage chỉ 3. Assertions mới fail khi preview chưa tồn tại, không bỏ assertions tên/mô tả cũ.

```ts
await page.goto('/collection');
const list = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' });
await expect(list.getByText('Hình minh họa thay thế', { exact: true })).toHaveCount(5);
await expect(list.locator('[data-shape="torus"]')).toHaveCount(1);
await expect(list.getByText('Chưa có ảnh', { exact: true })).toHaveCount(5);
```

- [ ] Test `/tour` catalogue nhận mapper `box→cube` nhưng preview chuẩn hóa về box; chọn item thì panel có shape/color cùng item. Fixture bổ sung ico chỉ ở test component/legacy nếu cần; không nới Zod API enum.
- [ ] Chạy test RED với `npm.cmd test -- exhibit-preview.spec.ts --max-failures=1`.
- [ ] Tạo component với container, shape aria-hidden và hai caption. Reuse shape CSS hiện có: sphere tròn, box vuông, torus vòng, cone tam giác, cylinder ellipse và icosahedron đa giác. Màu dùng custom property, không phụ thuộc chỉ màu để phân biệt khối.
- [ ] Consumer grid truyền `exhibit.placeholderShape`/`placeholderColor`; tour catalogue/panel truyền `display.shape`/`color`. Dùng className để giữ kích thước/margin; không thêm state hoặc image prop.
- [ ] Xóa CSS/import shape cũ khi không còn caller. Panel vẫn hiển thị mô tả/transcript/hotspot, Close/Escape và focus giữ nguyên.
- [ ] Chặn WebGL bằng init script test: collection/home không mount Canvas; tour lỗi vẫn có preview catalogue và mở panel bằng DOM. Không thay fallback navigation trong task này.
- [ ] Kiểm tra shape/color khác nhau, box alias, 0 items, API error, responsive light/dark với panel mở. Không cần test snapshots pixel phụ thuộc GPU.
- [ ] Chạy focused regression và quality gates từ frontend:

```powershell
npm.cmd test -- exhibit-preview.spec.ts collection.spec.ts home-featured.spec.ts museum-interaction.spec.ts museum-font.spec.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

- [ ] Review diff và commit implementation/tests cùng bằng chứng `feat(preview): share CSS exhibit illustration across public views`. Không stage artifacts/.env.

## PREVIEW-03: API thật và bàn giao

- [ ] Tạo live test bật `MUSEUM_LIVE_TEST=1`: đọc list/detail schema thật, so sánh preview shape/color với phản hồi API ở collection và tour; panel item đã chọn có cùng preview. Không tạo/sửa database.
- [ ] Giữ media null và caption thiếu ảnh; không nói các hình CSS là file ảnh đã seed. Chỉ kiểm chứng populated nếu phòng có nội dung.

```powershell
$env:MUSEUM_LIVE_TEST='1'
try { npm.cmd test -- exhibit-preview-live.spec.ts } finally { Remove-Item Env:MUSEUM_LIVE_TEST }
```

- [ ] Unit tests hiện có; nếu runtime sửa thêm thì chạy lại quality gates phù hợp. Ghi rõ fixture/live, DOM assertions và visual review chưa làm.
- [ ] README cập nhật minh họa chung, ảnh thật cần contract API/schema/mapper sau này; commit độc lập tests/docs `test(preview): verify shared illustrations with public API`.
- [ ] Gửi URL local để người dùng duyệt trực quan. Sau đó gửi mô tả PR và chờ yêu cầu push/tạo PR vào `dev`.

## Self-review

Hai cách render khác nhau (DOM/CSS và Three.js) cùng thông số API, không ép dùng component DOM trong Canvas. Lượt này chưa có ảnh thật nên không xây loader speculative. Mọi consumer 2D được bao phủ, markup shape trang trí có caption rõ nghĩa; nội dung/focus không thay đổi. Quy trình gate người dùng được giữ: hiện chỉ tài liệu và dừng.
