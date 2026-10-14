# Tour Vietnamese Font — Implementation Plan

> **For agentic workers:** Dùng Superpowers `executing-plans` sau khi người dùng duyệt. Làm trên nhánh `fix/tour-vietnamese-font`, không sửa trên `dev`. Viết xong tài liệu phải dừng; không commit/implementation trước duyệt.

**Goal:** Sửa fallback font gây dấu tiếng Việt không đồng nhất trong tiêu đề tour, gồm DOM và bảng tên canvas.

**Architecture:** Thay trực tiếp font stack tại các selector/canvas font hiện có bằng Times New Roman tương tự fix trang chủ. Không thêm font download, global override hoặc lớp trừu tượng. Dữ liệu/API không đổi.

**Tech Stack:** React/Mantine, CSS Modules, Canvas2D/Three.js, Playwright Edge và CDP.

Task/bằng chứng: [tour-vietnamese-font.md](../tasks/tour-vietnamese-font.md).

## Global Constraints

- Base khảo sát `806ebcf`, nhánh riêng đã có; task/plan phải được người dùng duyệt trước commit/code.
- Chỉ đổi font-family/font string, không đổi font-size/weight, hình học, dữ liệu hoặc API.
- Không thêm dependency hoặc font ngoài; tái sử dụng font hệ thống.
- Kiểm tra có giới hạn môi trường: CDP font Windows Edge, không suy ra glyph mọi OS.
- Không viết trang chi tiết/fallback trong lượt này.

## Files và interfaces

| File | Sửa |
|---|---|
| `front-end/src/components/museum/MuseumCatalogue.module.css` | `.card h3` đổi stack |
| `front-end/src/components/museum/ExhibitDetailPanel.module.css` | `.title` đổi stack |
| `front-end/src/pages/MuseumPage.module.css` | `.heading`, `.introTitle` đổi stack |
| `front-end/src/components/museum/ExhibitLabel.tsx` | Canvas2D `context.font` của title đổi stack |
| `front-end/tests/museum-font.spec.ts` | Kiểm tra hồi quy với fixture tên tiếng Việt cho item 2 |
| `docs/tasks/tour-vietnamese-font.md` | Ghi trạng thái và bằng chứng |

Giữ interfaces `MuseumCatalogue`, `ExhibitDetailPanel`, `ExhibitLabel` hiện có. Fixture dùng `installMuseumApi` và override roomA.exhibits[1].name để có Unicode mẫu; chỉ test input, không ghi DB.

## FONT-01: Duyệt và commit tài liệu

- [x] Người dùng duyệt task/plan.
- [ ] Rà soát git status/diff/log; stage chỉ hai tài liệu; commit `docs(tour): plan Vietnamese typography fix`.

## FONT-02: Kiểm tra trước, sửa và kiểm chứng

- [ ] Test trước: override item 2.name thành `[Mẫu] Bình nước dã chiến`, vào tour, chọn từ DOM catalogue; kiểm tra text NFC và stack/font thực tế của catalogue/panel.
- [ ] Dùng CDP lấy fonts của node; Windows Edge assert chỉ có Times New Roman (regular/bold cùng family), trước sửa dự kiến fail vì Georgia. Platform khác kiểm tra CSS font stack thay vì kỳ vọng font Windows.

```ts
const cdp = await page.context().newCDPSession(page);
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
const { root } = await cdp.send('DOM.getDocument');
const { nodeId } = await cdp.send('DOM.querySelector', {
  nodeId: root.nodeId, selector: '#museum-catalogue li:nth-child(2) h3',
});
const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
expect(fonts.map(font => font.familyName)).toEqual(['Times New Roman']);
```

- [ ] Capture Canvas2D `fillText`/font bằng init script test, mở scene, xác nhận bảng tên item 2 dùng `30px "Times New Roman", serif`; kiểm tra text còn nguyên nếu không vượt chiều rộng. Không coi đo font string là kiểm chứng trực quan canvas.
- [ ] Chạy `npm.cmd test -- museum-font.spec.ts`, ghi failure nguyên nhân font trước sửa.
- [ ] Đổi các CSS stack thành `font-family: 'Times New Roman', serif;`, canvas thành `context.font = '30px "Times New Roman", serif';`. Không chạm input text hoặc spacing.
- [ ] Chạy test GREEN, test interaction phù hợp và quality gates:

```powershell
npm.cmd test -- museum-font.spec.ts museum-interaction.spec.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

- [ ] Kiểm tra DOM không tràn ngang khi panel mở ở 320/768/1024/1440; đóng panel và focus trigger giữ hành vi.
- [ ] Ghi bằng chứng, review/stage đúng file và commit `fix(tour): use consistent serif font for Vietnamese titles`.
- [ ] Người dùng kiểm tra lại trực quan; gửi mô tả PR trước push/tạo PR.

## Self-review

Title item 2, panel, room/intro và canvas cùng lỗi stack Georgia được bao phủ. Không giải quyết symptom bằng đổi ký tự/NFC vì nguồn text đã đúng. Test font DOM và canvas instrumentation phân biệt rõ; không thêm font global gây thay đổi admin hoặc data. Hiện chỉ tài liệu, chưa thực hiện FONT-01/02.
