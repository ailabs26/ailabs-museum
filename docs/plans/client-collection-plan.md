# Collection 2D — Implementation Plan

> **For agentic workers:** Dùng Superpowers `executing-plans` trong phiên hiện tại, test trước code và commit từng task đã kiểm chứng; không subagent.

**Goal:** Trang `/collection` hiển thị hiện vật từ API public, độc lập 3D và dùng được trên mobile/bàn phím.

**Architecture:** `CollectionPage()` sử dụng `useMuseumRooms(searchParams.get('room'))` để chia sẻ data/cache/abort với tour. Page render trực tiếp `RoomDetail.exhibits`, không map qua model 3D; CSS Module cùng page dùng palette PublicLayout. React Router thay route placeholder. API response tiếp tục được validate trong service hiện có.

**Tech Stack:** React 18, Mantine 7, TanStack Query, React Router, Zod, Playwright/Edge.

## Global Constraints

- Nhánh `feat/client-collection`, base `867c977`.
- Named export, CSS Module và alias `@/` theo convention frontend.
- Không backend/database, dependency mới, Canvas/scene, fallback dữ liệu giả hoặc media URL tự suy đoán.
- Phạm vi đã duyệt: title, chọn phòng URL, lưới tên/mô tả/ảnh chưa có, link tour, loading/empty/error/retry, responsive/a11y.
- Không search/filter/pagination/detail page/hiện vật nổi bật trong lượt này.
- Commit theo phần sau verification; push/PR cần yêu cầu riêng.

## Thiết kế đã duyệt

Giữ public palette kem–teal và serif Times New Roman của trang chủ để tránh vấn đề glyph tiếng Việt. Header page gồm eyebrow, h1 “Bộ sưu tập”, mô tả cách đọc nội dung không cần 3D. Select có label và nút Làm mới. Khi có detail: h2 tên phòng, mô tả/count và link “Tham quan phòng này trong 3D”; danh sách semantic ul/li 1/2/3 cột, mỗi thẻ h3 tên, mô tả đầy đủ và vùng trung tính “Chưa có ảnh” (icon trang trí). Không loading animation giả cho media null.

Loading list/detail là status; lỗi có Alert + Thử lại; empty list và empty exhibits tách riêng. Invalid slug được giữ trên URL và người dùng chọn phòng khác, không mặc định âm thầm. Detail chỉ render nếu rooms/selectedRoom/room đều success. Khi refresh fail ẩn content stale; đang refresh success vẫn có status. Tour link dùng `new URLSearchParams({room: detail.slug})`.

## Files và interfaces

| File | Vai trò |
|---|---|
| `front-end/src/pages/client/CollectionPage.tsx` | Named export `CollectionPage(): JSX.Element`, hook/URL/status và list |
| `front-end/src/pages/client/CollectionPage.module.css` | Page layout, thẻ và placeholder không ảnh |
| `front-end/src/app/router.tsx` | Import CollectionPage và thay route; bỏ ClientComingSoon khi hết caller |
| `front-end/tests/collection.spec.ts` | Fixture tests chức năng/status/responsive |
| `front-end/tests/collection-live.spec.ts` | Opt-in API thật, không interception/DB writes |
| `front-end/README.md` | Hướng dẫn route và giới hạn media |
| `docs/tasks/client-collection.md` | Progress/evidence/commit ledger |

Không sửa `useMuseumRooms` hoặc query keys vì đã giải quyết cancellation/cache cho dữ liệu phòng; không thay `MuseumCatalogue` vì nội dung đó gắn cảnh báo bounds 3D.

## COL-01: Tài liệu trước triển khai

- [x] Khảo sát route/hook/schema, fixtures và live test pattern.
- [x] Ghi design đã duyệt vào plan và task.
- [x] Review/stage hai tài liệu, commit `c96dc8c`.

## COL-02: Slice danh mục hoạt động

- [x] Test trước với fixture: 5 listitem, tên/mô tả và 5 “Chưa có ảnh”, link tour đúng slug; scene/canvas không tải. Đảo order fixture chứng minh sort; chọn ceramics và reload giữ lựa chọn.

```ts
await page.goto('/collection');
await expect(page.getByRole('heading', { name: 'Bộ sưu tập', exact: true })).toBeVisible();
await expect(page.getByRole('list', { name: 'Hiện vật trong bộ sưu tập' }).getByRole('listitem')).toHaveCount(5);
await expect(page.getByRole('link', { name: 'Tham quan phòng này trong 3D' })).toHaveAttribute('href', '/tour?room=sculpture');
await expect(page.locator('canvas')).toHaveCount(0);
```

- [x] Chạy `npm.cmd test -- collection.spec.ts`: hai tests fail vì thiếu page h1/select.
- [x] Implement page dưới 200 dòng, dùng `NativeSelect`, `Alert`, `Button` và semantic sections/list. URL select giữ các query khác; dùng validated detail, sort copy array `(a,b)=>a.displayOrder-b.displayOrder||a.id.localeCompare(b.id)`.
- [x] CSS dùng `--public-*`, 1 cột mobile, 2 cột sm và 3 lg, wrap tên dài; native focus/labels. Placeholder text thật thay vì ảnh giả.
- [x] Thay route và bỏ hàm placeholder không còn caller; giữ Container/Text/Title/Stack dùng bởi NoAccess.
- [x] Test GREEN (2/2) và `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` đạt.
- [x] Review/stage page/CSS/route/tests, task update; commit `73c6eed`.

## COL-03: Edge cases và chứng minh API thật

- [x] Thêm tests list/detail loading, rỗng, malformed response, invalid room, retry và refresh error. Dùng fixtures/route override; không mock service. Các tests này kiểm chứng hành vi có sẵn sau COL-02, không có RED trước code mới.
- [x] Tests chuyển phòng pending response: content cũ không hiện trong phòng mới; hook đã có abort/correct key, page không lộ stale.
- [x] Keyboard select ArrowDown/Enter và tour link Enter; active nav collection. Light/dark 320/768/1024/1440 không tràn ngang.
- [x] Live test `MUSEUM_LIVE_TEST=1`: 1/1 đạt, API thật schema parse và 5 tên seed hiển thị, không Supabase write/interception/Canvas.

```powershell
npm.cmd test -- collection.spec.ts public-tour-navigation.spec.ts
# Chạy riêng khi backend đang hoạt động; frontend cùng CORS localhost:5173.
$env:MUSEUM_LIVE_TEST='1'
npm.cmd test -- collection-live.spec.ts
Remove-Item Env:MUSEUM_LIVE_TEST
```

- [x] Focused Playwright 12/12, unit tests 6/6, typecheck/lint/build đạt; README/task ghi giới hạn review và warnings.
- [ ] Review/commit `test(collection): verify states and live API content` gồm edge tests/docs, không artifacts/.env.

## Self-review và bàn giao

Mọi phạm vi đã duyệt ánh xạ tới page/style/route và focused tests. Media null không được biến thành URL; chọn phòng/lỗi theo hook đã có. Bằng chứng fixtures và API thật phân biệt rõ, không báo visual review chỉ từ DOM. Người dùng duyệt UI trước đề xuất PR; báo mô tả PR rồi chờ yêu cầu tạo PR.
