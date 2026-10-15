# Exhibit Detail 2D — Implementation Plan (7 task nhỏ)

> **For agentic workers:** Người dùng đã duyệt bản chia nhỏ. Dùng Superpowers `executing-plans` trên `feat/exhibit-detail-2d`, không subagent; lượt hiện tại chỉ DETAIL-01/02 và dừng ở checkpoint A. Mỗi task một commit sau kiểm chứng.

**Goal:** Đọc chi tiết hiện vật public bằng DOM độc lập WebGL, có link từ collection/featured và quay lại đúng phòng.

**Architecture:** `ExhibitDetailPage()` đọc path params, dùng `useMuseumRooms(roomSlug)` và tìm ID trong DTO đã validate. Shared preview tái sử dụng; ExhibitGrid nhận roomSlug từ hai consumer để dựng link. Giữ service/schema/cache hiện tại, không import mapper/scene hoặc tạo API mới.

**Tech Stack:** React 18, TypeScript, React Router, Mantine, TanStack Query, Zod và Playwright hiện có.

Task: [exhibit-detail-2d.md](../tasks/exhibit-detail-2d.md).

## Global Constraints

- Base `41c846e`, nhánh riêng trước tài liệu; người dùng đã duyệt bản chia nhỏ trước commit/implementation.
- Route `/collection/:roomSlug/exhibits/:exhibitId`; không admin API/endpoint mới.
- Named exports, alias `@/`, CSS Module cùng page; public palette, Times New Roman cho title tiếng Việt.
- Hook gọi vô điều kiện theo quy tắc React; không gọi `useMuseumRooms(null)` để xử lý URL không hợp lệ.
- DTO/Zod hiện có; không nới media null, thêm URL ảnh giả hoặc sample fallback.
- Trang an toàn từ task 02: loading/error/not-found có guard tối thiểu, không crash/hiện nhầm dữ liệu. Task 04 hoàn thiện retry/diễn giải/bảo toàn route và tests.
- Không backend/database/dependency, tour panel/fallback, audio/player/subtitles/i18n hoặc selection 3D.
- Code/tests/status của một task chung một commit; không commit rỗng hoặc failing checks. Không stage artifacts/.env.
- Push/PR sau duyệt mô tả và yêu cầu riêng; commit không đồng nghĩa nghiệm thu toàn bộ nhánh.

## Files và interface chung

| File | Task sở hữu |
|---|---|
| `front-end/src/pages/client/ExhibitDetailPage.tsx` | 02 tạo, 03 nội dung, 04 trạng thái, 05 back link, 06 focus |
| `front-end/src/pages/client/ExhibitDetailPage.module.css` | 02 layout cơ bản, 03 text, 06 reflow/focus |
| `front-end/src/app/router.tsx` | 02 route |
| `front-end/src/shared/components/data/ExhibitGrid.tsx` | 05 explicit link/roomSlug |
| `front-end/src/shared/components/data/ExhibitGrid.module.css` | 05 spacing link nếu cần |
| `front-end/src/pages/client/CollectionPage.tsx` | 05 truyền slug |
| `front-end/src/pages/client/HomeFeaturedExhibits.tsx` | 05 truyền slug |
| `front-end/tests/exhibit-detail.spec.ts` | 02–06 thêm nhóm tests `[D02]` đến `[D06]` |
| `front-end/tests/exhibit-detail-live.spec.ts` | 07 live opt-in |
| `front-end/README.md`, task/plan | 07 hướng dẫn; trạng thái cập nhật theo từng task |

Export `ExhibitDetailPage(): JSX.Element`. Grid props sau task 05: `{ exhibits: readonly RoomDetail['exhibits'][number][]; roomSlug: string }`.
Không tạo helper URL/config/mode mới: encodeURIComponent cho path, URLSearchParams cho query back; preview nhận shape/color trực tiếp.

## Chu trình kiểm tra/commit cho từng task

Test mới viết trước; chạy focused test để quan sát failure đúng trước logic mới. Khi guard/hook hiện có đã làm test pass, ghi rõ là regression evidence, không ép RED giả. Refactor không thay hành vi dùng baseline tests.

Sau task runtime, chạy từ `front-end/`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Review `git status`, `git diff`, `git log --oneline -10`; stage đúng files của task, review staged diff/secrets/`git diff --cached --check` rồi commit theo tên dưới đây. Mỗi task hoàn thành cập nhật checklist và kết quả vào tài liệu ngay trong commit; SHA ghi ở task kế tiếp hoặc tra git log, không commit chỉ để thêm SHA.

## DETAIL-01 — Duyệt và commit task/plan

**Phụ thuộc:** Người dùng duyệt bản chia nhỏ. **Files:** hai tài liệu. **Deliverable:** phạm vi/task/commit rõ ràng trước code.

- [x] Người dùng duyệt hai file; lượt đầu chỉ DETAIL-01/02.
- [x] Review branch/status và chuẩn bị commit tài liệu:

```powershell
git add -- docs/tasks/exhibit-detail-2d.md docs/plans/exhibit-detail-2d-plan.md
git diff --cached --check
git diff --cached
git commit -m "docs(detail): plan standalone public exhibit page"
```

## DETAIL-02 — Direct URL và nội dung cơ bản

**Phụ thuộc:** 01. **Files:** page/CSS/router + tests D02. **Produces:** route mở/reload được, tên/phòng/preview/mô tả từ API.

- [x] Test D02 direct URL/reload và preview/text; network không admin API/scene.

```ts
await installMuseumApi(page);
await page.goto(`/collection/sculpture/exhibits/${roomA.exhibits[0].id}`);
await expect(page.getByRole('heading', { level: 1 })).toHaveText(roomA.exhibits[0].name);
await expect(page.getByText(roomA.exhibits[0].description, { exact: true })).toBeVisible();
await expect(page.getByText('Hình minh họa thay thế', { exact: true })).toBeVisible();
await expect(page.locator('canvas')).toHaveCount(0);
```

- [x] D02 test đầu RED đúng do route trả 404; sau implementation 3/3 GREEN.
- [x] Page params/hook/UUID guard và selection:

```ts
const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
const exhibit = detail && isValidId ? detail.exhibits.find((item) => item.id === exhibitId) : undefined;
```

- [x] Guard tối thiểu loading/error/not-found; không render sai identity. Retry refinements chờ 04.
- [x] Success h1/room/preview/h2/mô tả; empty description có text, CSS cơ bản, chưa focus effect.
- [x] Route/D02/gates đạt; review và chuẩn bị commit task 02.

### Checkpoint A — Có thể xem trang cơ bản

- [x] D02/gates đạt, ghi bằng chứng để commit 02; optional content/navigation/fallback còn pending.
- [x] API probe tìm direct URL mẫu trong task để gửi người dùng; dừng ở A, không triển khai 03–07.

## DETAIL-03 — Transcript/hotspot và văn bản an toàn

**Phụ thuộc:** 02. **Files:** page, CSS nếu cần, tests D03. **Produces:** nội dung bổ sung theo DTO, không section rỗng/HTML injection.

- [x] D03 fixture transcript/hotspots và empty optional sections được kiểm chứng.

```ts
await expect(page.getByRole('heading', { name: 'Bản thuyết minh', level: 2 })).toBeVisible();
await expect(page.getByText('<b>Thuyết minh</b>', { exact: true })).toBeVisible();
await expect(page.locator('main b')).toHaveCount(0);
```

- [x] D03 test đầu RED thiếu heading; 5/5 D02/D03 GREEN sau sửa.
- [x] Sections h2/text, sort bản sao; không HTML injection hoặc mapper 3D.
- [x] Gates đạt, commit D03 theo kế hoạch. Người dùng đã cho phép toàn bộ 03–07.

## DETAIL-04 — Lỗi/thử lại và danh tính route

**Phụ thuộc:** 02, 03. **Files:** page và tests D04. **Produces:** state/retry hoàn chỉnh, dữ liệu cũ không lộ sau lỗi/đổi URL.

- [x] D04 loading/error/schema/retry và cross-room tests đạt cùng guards D02.
- [x] Đổi URL/obsolete request và cache refresh lỗi giữ danh tính, 9/9 tests đạt.
- [x] Thứ tự guard ID/list/detail/not-found đúng.
- [x] Retry query lỗi và link collection chung, không demo fallback.

```tsx
<Alert role="alert" title="Không tải được nội dung">
  <Text>{room.error.message}</Text>
  <Button onClick={() => void room.refetch()}>Thử lại</Button>
</Alert>
```

- [x] D02–04 và gates đạt, commit task 04 theo kế hoạch.

### Checkpoint B — Nội dung và trạng thái hoàn thiện

- [ ] D02–D04/gates đạt; đúng identity/không HTML injection; chưa có card navigation/focus đầy đủ.
- [ ] Có thể dừng để người dùng duyệt trước lượt C, theo phạm vi đã yêu cầu.

## DETAIL-05 — Link thẻ và quay lại phòng

**Phụ thuộc:** 04. **Files:** grid/CSS nếu cần, collection, featured, page và tests D05. **Produces:** route vào từ hai consumer/back cùng slug.

- [ ] D05 test trước: link `Xem chi tiết <tên>` trên collection và featured, href đúng, click/Enter mở đúng h1; back link không phụ thuộc history; reload/Browser Back giữ URL và room.
- [ ] Grid thêm roomSlug bắt buộc; update hai consumer `roomSlug={detail.slug}`. Thêm explicit Link:

```tsx
<Link to={`/collection/${encodeURIComponent(roomSlug)}/exhibits/${encodeURIComponent(exhibit.id)}`}
  aria-label={`Xem chi tiết ${exhibit.name}`}>Xem chi tiết</Link>
```

- [ ] Page link back ở success dùng `/collection?${new URLSearchParams({ room: detail.slug })}`, tên “Quay lại bộ sưu tập của phòng này”. Missing room dùng link `/collection`, không lấy slug sai làm phòng thành công.
- [ ] Không bọc cả card/preview, không tạo nested links hoặc cắt mô tả. Use palette/focus native của PublicLayout.
- [ ] D05 + tests detail/collection/home GREEN, gates. Commit **`feat(detail): link public exhibit cards to detail pages`**.

## DETAIL-06 — Focus/reflow/không WebGL

**Phụ thuộc:** 05. **Files:** page/CSS và tests D06. **Produces:** focus xác định không giành khi refetch, DOM độc lập renderer.

- [ ] D06 tests: link Enter focus h1 khi data sẵn sàng; đổi URL focus đúng title; not-found/error có title nhận focus; refetch cùng trạng thái success giữ focus ở back link. Viết tests trước effect.
- [ ] Thêm ref title `tabIndex={-1}` + effect dựa trên route identity và trạng thái sẵn sàng, không toàn DTO. Dùng ref nhớ lần focus của route/state để không gọi focus lại khi payload mới nhưng cùng trang/state. Không trap focus.
- [ ] Chặn WebGL ở init script; direct URL và link flow vẫn text/preview/transcript/hotspots, không scene/Canvas hoặc storage. Heading h1=1, sections h2; không full WCAG claim.
- [ ] Test tiếng Việt dài và reflow light/dark tại bốn widths. Basic CSS task 02 đã có, chỉ sửa gap/overflow/focus khi test chứng minh cần; nếu style đã đạt thì tests/evidence vẫn là deliverable, không đổi CSS cho đủ commit.
- [ ] D06 + toàn bộ regressions liên quan/gates đạt; commit **`fix(detail): preserve accessible navigation without WebGL`**.

```powershell
npm.cmd test -- exhibit-detail.spec.ts collection.spec.ts home-featured.spec.ts exhibit-preview.spec.ts museum-interaction.spec.ts
```

### Checkpoint C — Luồng frontend hoàn chỉnh

- [ ] Link vào/back/focus/status/text và no-WebGL regression đạt; người dùng có thể xem giao diện.
- [ ] Chưa coi live content/visual review hoàn thành trước task 07.

## DETAIL-07 — Live API và tài liệu bàn giao

**Phụ thuộc:** 06. **Files:** live test, README, task/plan. **Produces:** evidence read-only và hướng dẫn route/limits.

- [ ] Live opt-in theo pattern hiện có: list/detail API thật được parse schema; chọn ID từ response, không hardcode. Không có content thì annotation “populated acceptance chưa chứng minh”, không seed.
- [ ] Direct URL/reload và card link đọc đúng name/description; transcript/hotspots so sánh nếu response có. Dữ liệu seed hiện optional content thiếu nên fixture D03 chứng minh các trường đó, không bịa live content.
- [ ] Live back link đúng room, không interception/Canvas/database write:

```powershell
$env:MUSEUM_LIVE_TEST='1'
try { npm.cmd test -- exhibit-detail-live.spec.ts } finally { Remove-Item Env:MUSEUM_LIVE_TEST }
npm.cmd run test:unit
```

- [ ] README/task ghi kết quả thật/giới hạn/SHA tasks trước. Tests/docs không đòi lặp build nếu runtime không đổi; runtime sửa thêm chạy lại gates.
- [ ] Review diff/secrets; commit **`test(detail): verify live exhibit content and navigation`**. SHA chính commit tra git log, không thêm commit chỉ để ghi SHA.
- [ ] Chờ người dùng duyệt trực quan, gửi mô tả PR trước push/tạo PR vào dev. Không tự chuyển 3D→2D khi lỗi trong nhánh này.

## Rà soát phạm vi và dependencies

01→02→03→04→05→06→07; trang luôn có safe guard từ 02, task 04 không trì hoãn bảo toàn dữ liệu. Các task có tối đa ba nghiệm thu trong task nguồn; mỗi task có test focused/gates và một commit. Tách test nội dung rich khỏi test state, link và focus giúp review/revert riêng. Checkpoint A/B/C cho phép dừng sau phần được chỉ định; không tạo thêm nhánh/PR cho mỗi task trong cùng nhiệm vụ.

Đã được duyệt để bắt đầu DETAIL-01/02. Lượt 2 sau này dùng route này để chuyển từ panel/SceneFallback với room/exhibit đang chọn, quản lý focus và tháo renderer; không thực hiện trong lượt hiện tại.
