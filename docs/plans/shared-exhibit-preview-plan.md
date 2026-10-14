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
- [x] Review và commit tài liệu `79785bf`:

```powershell
git add -- docs/tasks/shared-exhibit-preview.md docs/plans/shared-exhibit-preview-plan.md
git diff --cached --check
git diff --cached
git commit -m "docs(preview): plan shared 2D exhibit illustration"
```

## PREVIEW-02: Component và bốn consumer

- [x] Test trước; collection chưa có data-shape nên fail đúng. Home/collection assertions tên/mô tả giữ nguyên.

```ts
await page.goto('/collection');
const list = page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' });
await expect(list.getByText('Hình minh họa thay thế', { exact: true })).toHaveCount(5);
await expect(list.locator('[data-shape="torus"]')).toHaveCount(1);
await expect(list.getByText('Chưa có ảnh', { exact: true })).toHaveCount(5);
```

- [x] Test tour cube alias→box và panel cùng shape/color đạt; không nới Zod enum.
- [x] RED test đầu thiếu data-shape trước code.
- [x] Component CSS shape/aria-hidden/caption tạo từ kỹ thuật sẵn có.
- [x] Cả bốn consumer truyền shape/color/className; không state/image prop.
- [x] Bỏ CSS/import trùng; panel text/focus giữ hành vi.
- [x] WebGL blocked test giữ preview catalogue/panel, collection/home không Canvas.
- [x] Tests shape/color/alias/empty/error và responsive đạt; chưa có direct legacy ico test.
- [x] Focused 37/37 và typecheck/lint/build đạt:

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
