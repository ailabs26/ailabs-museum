# Home Featured Exhibits — Implementation Plan

> **For agentic workers:** Tài liệu đã được người dùng duyệt. Dùng Superpowers `executing-plans` trong phiên hiện tại, không subagent; kiểm chứng và commit từng task.

**Goal:** Nối API cho mục hiện vật nổi bật trên trang chủ, tối đa 3 thẻ; cập nhật giới thiệu để dẫn đúng tới trang collection.

**Architecture:** Tách lưới thẻ đang chạy ở `CollectionPage` thành component `ExhibitGrid` và CSS Module trong `shared/components/data/`. `HomeFeaturedExhibits` sử dụng `useMuseumRooms(null)`, giữ guard success như collection/tour, sắp xếp bản sao rồi lấy 3 mục. `HomePage` chỉ gắn component vào mục nổi bật và cập nhật copy. Không thay hook/service/schema/query keys.

**Tech Stack:** React 18, TypeScript, Mantine 7, React Router, TanStack Query, Zod và Playwright hiện có.

## Trạng thái và gate người dùng

Task nguồn: [home-featured-exhibits.md](../tasks/home-featured-exhibits.md).
Khảo sát trên bản `8f320c8`; đang ở nhánh riêng `feat/home-featured-exhibits`, tạo từ `origin/dev`. Các bước triển khai bên dưới chưa thực hiện.

**DỪNG sau khi viết/rà soát tài liệu trên nhánh riêng.** Chỉ khi người dùng xác nhận OK mới commit tài liệu và triển khai; không làm nhiệm vụ trên `dev`.

## Global Constraints

- Frontend convention: named exports, CSS Module cùng tên component, alias `@/`; tái sử dụng dependency hiện có.
- Phòng đầu tiên của API, tối đa 3 mục theo `displayOrder` rồi ID; không hardcode slug/ID/nội dung production.
- Nếu phòng đầu rỗng: báo rỗng; không tìm phòng khác hoặc lấy nhiều phòng để đủ 3.
- Media null hiển thị “Chưa có ảnh”; không dựng URL storage, Canvas/scene hoặc kết nối Supabase từ frontend.
- Không đổi backend, database, auth, hook/service/schema hoặc global theme.
- Giữ hero/các link hoạt động khi API lỗi; không thay bằng dữ liệu giả, không render cache khi query error.
- Giữ nhãn `[Mẫu]` và mô tả API nguyên trạng.
- Commit theo task đã kiểm chứng; push/PR chỉ sau khi người dùng duyệt mô tả và yêu cầu.

## File map và interfaces

| File | Thao tác và trách nhiệm |
|---|---|
| `front-end/src/shared/components/data/ExhibitGrid.tsx` | Tạo: `ExhibitGrid({ exhibits }: { exhibits: readonly RoomDetail['exhibits'][number][] }): JSX.Element`; render ul/li, placeholder ảnh, h3 và mô tả; không fetch/sort/slice |
| `front-end/src/shared/components/data/ExhibitGrid.module.css` | Tạo: di chuyển style grid/card/media/body/number/title/description từ collection |
| `front-end/src/pages/client/CollectionPage.tsx` | Sửa: dùng ExhibitGrid với toàn bộ danh sách đã sort; giữ select/status/link/empty |
| `front-end/src/pages/client/CollectionPage.module.css` | Sửa: chỉ bỏ các selector đã chuyển sang grid chung |
| `front-end/src/pages/client/HomeFeaturedExhibits.tsx` | Tạo: hook, trạng thái, tên phòng, 3 thẻ và link collection; không thêm heading section trùng HomePage |
| `front-end/src/pages/client/HomePage.tsx` | Sửa: thay featuredSpace bằng HomeFeaturedExhibits và đổi đoạn Về Aura |
| `front-end/src/pages/client/HomePage.module.css` | Sửa: bỏ featuredSpace; khoảng cách tên phòng/lưới/link dùng selector cụ thể trong module này |
| `front-end/tests/home-featured.spec.ts` | Tạo: fixture tests success/order/limit/state/retry/keyboard/responsive/no-scene |
| `front-end/tests/home-featured-live.spec.ts` | Tạo: opt-in live, so sánh response thật với thẻ trang chủ, không interception hoặc DB write |
| `front-end/README.md` | Sửa: quy tắc featured và lệnh kiểm tra |
| `docs/tasks/home-featured-exhibits.md` | Cập nhật status/commit/evidence theo thực tế |

Type `RoomDetail` nhập từ `@/validations/roomSchema`. Không tạo barrel export hoặc helper sorting mới: collection giữ sort hiện tại, featured dùng sort/slice ngay tại consumer.

## HF-01: Duyệt và commit tài liệu

- [x] Người dùng đọc và duyệt task/plan, đặc biệt quy tắc chọn phòng và trường hợp phòng rỗng.
- [x] Kiểm tra git status, fetch origin; base `origin/dev` tại `8f320c8`. Hai file tài liệu chưa commit được giữ nguyên.
- [x] Tạo và chuyển sang nhánh `feat/home-featured-exhibits` trước bước duyệt/commit; không triển khai trên `dev`.
- [x] Sau khi người dùng duyệt: rà soát/stage hai tài liệu, commit `e9ecc46`.

```powershell
git add -- docs/tasks/home-featured-exhibits.md docs/plans/home-featured-exhibits-plan.md
git diff --cached --check
git diff --cached
git commit -m "docs(home): plan API-backed featured exhibits"
```

## HF-02: Tái sử dụng lưới collection

**Consumes:** danh sách validated/sorted trong CollectionPage. **Produces:** ExhibitGrid nhận danh sách readonly và giữ nhãn `Hiện vật trong bộ sưu tập`, các thẻ h3/mô tả/ảnh chưa có; dùng được dưới h2 ở cả hai page.

- [x] Baseline collection 10/10 đạt.
- [x] Di chuyển nguyên khối ul/li sang ExhibitGrid, giữ key/icon/text/number; lưới không sort/fetch hoặc xử lý empty.
- [x] Chuyển CSS và breakpoints 48em/62em; CollectionPage dùng ExhibitGrid.
- [x] Sau refactor collection 10/10, typecheck/lint/build đạt; review và commit theo task.

## HF-03: Trang chủ lấy API và cập nhật copy

**Consumes:** `useMuseumRooms(null)` chọn phòng đầu tiên; ExhibitGrid. **Produces:** phần dữ liệu bên trong section `aria-labelledby="featured-title"` có sẵn và link `/collection?room=<slug>`.

- [ ] Viết fixture test trước: route roomA có dữ liệu đảo thứ tự, mong đợi 3 mục đầu theo displayOrder/id, 3 placeholder ảnh và link collection đúng phòng; ghi nhận RED trên mục còn trống.

```ts
await installMuseumApi(page);
await page.route('**/api/rooms/sculpture', (route) => fulfillMuseum(route,
  envelope({ ...roomA, exhibits: [...roomA.exhibits].reverse() })));
await page.goto('/');
const featured = page.getByRole('region', { name: 'Hiện vật nổi bật' });
await expect(featured.getByRole('listitem')).toHaveCount(3);
await expect(featured.getByRole('heading', { level: 3 })).toHaveText(
  roomA.exhibits.slice(0, 3).map((item) => item.name));
await expect(featured.getByRole('link', { name: 'Xem bộ sưu tập của phòng này' }))
  .toHaveAttribute('href', '/collection?room=sculpture');
```

- [ ] Thêm fixture tests phòng có 0/1/2/5 hiện vật, list rỗng, list/detail loading, HTTP/schema error, retry và refetch thất bại. Đặt test assertions trước implementation; không yêu cầu test mới fail nếu hook sẵn có đã xử lý đúng.
- [x] Implement HomeFeaturedExhibits dùng hook đã có; render detail khi `rooms.isSuccess && selectedRoom && room.isSuccess`. Sort/slice:

```ts
const featured = detail ? [...detail.exhibits]
  .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id))
  .slice(0, 3) : [];
```

- [x] Success có tên phòng/dòng giới thiệu/grid/link đúng slug; empty room có link, list rỗng không link slug.
- [x] Loading/Alert/retry, lỗi list/refetch không render cache; không thêm timer/state/effect hoặc fetch thủ công.
- [x] HomePage gắn component, đổi copy “tại trang Bộ sưu tập”.
- [x] Keyboard Enter, static hero khi lỗi, no unrelated-room/scene; responsive light/dark đạt.
- [x] Focused 19/19 và typecheck/lint/build đạt; review/commit theo task.

```powershell
npm.cmd test -- home-featured.spec.ts collection.spec.ts public-tour-navigation.spec.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

## HF-04: Live API và bàn giao

- [ ] Tạo opt-in live test theo pattern `collection-live.spec.ts`, chỉ bật khi `MUSEUM_LIVE_TEST=1`. Chờ list/detail response thật và parse schema, xác nhận số thẻ `min(3, exhibits.length)` và tên khớp danh sách đã sort. Nếu không có phòng/content thì kiểm tra trạng thái thật và báo không đủ bằng chứng populated; không tự seed.
- [ ] Khi seed hiện tại còn public, so sánh 3 thẻ trang chủ với 3 hiện vật đầu response; không hardcode tên seed làm dữ liệu production.
- [ ] Test link collection bằng Enter và đúng slug; dùng locator scoped trong region tránh trùng link/heading ở hero/nav. Không mount Canvas hoặc sửa database.

```powershell
$env:MUSEUM_LIVE_TEST='1'
try { npm.cmd test -- home-featured-live.spec.ts } finally { Remove-Item Env:MUSEUM_LIVE_TEST }
```

- [ ] Chạy unit tests hiện có; quality gates chỉ chạy lại nếu thêm thay đổi code/failure. Ghi bằng chứng fixture/live riêng và warnings thực tế vào README/task.
- [ ] Review diff/test artifacts/secrets, commit `test(home): verify live featured content and navigation` nếu có thay đổi độc lập.
- [ ] Gửi URL local và chờ người dùng duyệt hình ảnh/bố cục. Không suy ra visual review từ DOM assertions.
- [ ] Soạn mô tả PR gửi trước, chờ người dùng cho phép push/tạo PR vào `dev`.

## Rà soát kế hoạch

- Task yêu cầu data/API, tái dùng UI, copy, status và responsive đều ánh xạ HF-02/03; live evidence HF-04.
- Chọn phòng đầu tiên rõ ràng; không có cờ featured/API mới hoặc quét nhiều phòng.
- API/DB hiện có đã đủ cho nội dung demo; ảnh null chỉ dùng placeholder text.
- Chỉ chuẩn bị nhánh và tài liệu trước gate người dùng; không commit/triển khai trước duyệt. Sau khi viết xong tài liệu này phải dừng.
