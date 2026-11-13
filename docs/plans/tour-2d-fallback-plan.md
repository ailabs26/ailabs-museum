# Tour to 2D Fallback — Implementation Plan

> **For agentic workers:** Người dùng đã duyệt. Dùng Superpowers `executing-plans` trên `feat/tour-2d-fallback`, không subagent; mỗi task một commit sau verification. Chưa push/PR trước yêu cầu riêng.

**Goal:** Đường đọc 2D chủ động và sau lỗi renderer giữ đúng phòng/hiện vật, tháo scene và quản lý focus.

**Architecture:** MuseumPage sở hữu room/selection đã validate và tạo URL 2D. Truyền URL xuống panel và cùng fallback element vào ErrorBoundary/scene; renderer báo lỗi về page bằng callback để page tháo scene/owner model. SceneFallback giữ thông báo, link đọc tại chỗ và link 2D. Trang detail tái sử dụng focus hiện có; collection chỉ nhận focus chuyển từ tour nếu cần.

**Tech Stack:** React Router, Mantine, R3F/Three.js, TanStack Query, Playwright có sẵn.

Task: [tour-2d-fallback.md](../tasks/tour-2d-fallback.md).

## Global Constraints

- Base `a78a30e`, nhánh đã tạo; cần người dùng duyệt trước commit/code.
- Một commit/task sau tests/gates; không push/PR trước yêu cầu và duyệt mô tả.
- Không redirect khi lỗi, không dùng fallback data; renderer failure khác GLB asset failure/API failure.
- Chỉ tạo URL từ detail/selectedDisplay của room hiện tại; path encodeURIComponent, query URLSearchParams.
- Giữ DOM catalogue/selection và anchor `#museum-catalogue`; không redesign/bỏ luồng đọc tại chỗ.
- Không sửa backend/database/dependency hoặc global ErrorBoundary interface.
- Không state mutation/setState trong render, không callback errors trong renderer draw loop.

## Files và interface dự kiến

| File | Thay đổi |
|---|---|
| `front-end/src/pages/MuseumPage.tsx` | URL ngữ cảnh, panel/fallback props, state lỗi theo room và tháo scene |
| `front-end/src/components/museum/ExhibitDetailPanel.tsx` | Prop `detail2dHref: string`, Link Đọc chi tiết 2D |
| `front-end/src/components/museum/SceneFallback.tsx` | Task 03 thêm `read2dHref: string`; task 04 thêm `onUnavailable: () => void`, effect báo lỗi/focus |
| `front-end/src/components/MuseumScene.tsx` | Prop `fallback: ReactNode`, dùng cho context lost và Canvas fallback |
| `front-end/src/pages/client/CollectionPage.tsx` | Focus h1 khi navigation state từ fallback, không cho mọi refetch |
| `front-end/tests/tour-2d-fallback.spec.ts` | Groups F02/F03/F04 fixtures/failure/lifecycle |
| `front-end/tests/tour-2d-fallback-live.spec.ts` | Opt-in API thật và simulated WebGL error |
| `front-end/README.md`, task/plan | Hướng dẫn/evidence/ledger |

Các prop thêm phải cập nhật toàn bộ caller; kiểm tra caller trước sửa. Không tạo URL helper/config chung mới cho vài biểu thức. `fallback` ở scene là ReactNode, không import model/schema chỉ để route.

## FALLBACK-01 — Tài liệu trước code

- [x] Người dùng duyệt task/plan và yêu cầu triển khai.
- [x] Review status/diff/log, stage hai tài liệu cho commit task 01.

## FALLBACK-02 — Panel link

- [ ] Viết test F02 trước: chọn exhibit 2 bằng catalogue DOM, mong link `Đọc chi tiết 2D` đúng route; Enter tới detail/name/h1 focused. Chọn item khác và đổi phòng không giữ link ID cũ. Dùng fixture API hiện có, không production sample fallback.

```ts
await page.goto('/tour?room=sculpture');
await page.getByRole('button', { name: 'Xem chi tiết Hiện vật 2', exact: true }).click();
await expect(page.getByRole('link', { name: 'Đọc chi tiết 2D', exact: true }))
  .toHaveAttribute('href', `/collection/sculpture/exhibits/${roomA.exhibits[1].id}`);
```

- [ ] Run `npm.cmd test -- tour-2d-fallback.spec.ts --grep F02`, ghi RED do thiếu link.
- [ ] MuseumPage tạo detail href từ `detail.slug` + `selectedDisplay.id` rồi truyền panel prop. Panel dùng Link native, không bọc toàn panel/không onClose trước navigate gây mất focus đích.
- [ ] F02 + interaction/detail regression GREEN, typecheck/lint/build; update task và commit task 02.

## FALLBACK-03 — URL chung cho ba fallback

- [ ] Viết F03 tests: WebGL null, context lost và scene-chunk abort; trước lỗi chọn item hoặc không chọn. Mong link đích chính xác, không auto navigate, list DOM vẫn còn. Dùng tests trước changes.
- [ ] MuseumPage tính fallback URL mỗi render:

```ts
const read2dHref = selectedDisplay
  ? `/collection/${encodeURIComponent(detail.slug)}/exhibits/${encodeURIComponent(selectedDisplay.id)}`
  : `/collection?${new URLSearchParams({ room: detail.slug })}`;
```

Biểu thức chỉ thực hiện trong nhánh có validated detail. Không tạo đường dẫn tới detail từ selection.roomId của phòng khác.

- [ ] SceneFallback có Link “Tiếp tục đọc trong giao diện 2D” và giữ Anchor cũ. Fallback element của page truyền qua scene prop `fallback` và đặt vào ErrorBoundary; scene dùng cùng node khi context lost và Canvas fallback. `SceneLifecycle` tiếp tục phát sự kiện như cũ.
- [ ] Callback/effect props sẽ bổ sung hoàn chỉnh lifecycle ở task 04; task 03 vẫn giữ cleanup hiện có khi route unmount, không tạo hành vi renderer mới chỉ để trì hoãn task.
- [ ] Test đóng/chọn item sau khi renderer lỗi: link phải cập nhật, lỗi API phải ẩn fallback khi detail không hợp lệ. Test route slug encode. F03 GREEN + gates, commit task 03.

## FALLBACK-04 — Tháo scene và focus

- [x] Tests pending/context teardown và back không auto Canvas đạt; GLB thật thiếu asset nên 2 tests skip theo điều kiện.
- [x] Canvas fallback inert khi renderer khỏe; fallback thực sự dùng qua ErrorBoundary/context state, owner cleanup giữ abort.
- [x] Không loop callback/remount; GLB asset error giữ ModelLoadingStatus/placeholder.
- [x] Focus/reflow/error retry/links đạt; commit F04 đang hoàn tất.

## FALLBACK-05 — Kiểm chứng cuối và live

- [x] Live test 1/1 đạt: lấy item theo API thật/schema và link panel sang detail; không mock API/ghi DB. F02–F04 fixture đã kiểm tra context/chunk/WebGL/GLB failure.
- [x] GLB lỗi riêng lẻ giữ retry/placeholder trong regression; live không phá GPU thật.

```powershell
npm.cmd test -- tour-2d-fallback.spec.ts exhibit-detail.spec.ts museum-tour.spec.ts museum-lifecycle.spec.ts museum-glb.spec.ts museum-interaction.spec.ts
npm.cmd run test:unit
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:MUSEUM_LIVE_TEST='1'
try { npm.cmd test -- tour-2d-fallback-live.spec.ts } finally { Remove-Item Env:MUSEUM_LIVE_TEST }
```

- [x] Các task runtime trước chạy focused gates/tests; F05 chỉ thêm live test/docs sau F04 runtime, không có failure mới.
- [x] README/task cập nhật giới hạn/evidence; commit live test/docs theo task 05, không artifacts/.env.
- [ ] Gửi giao diện và mô tả PR trước, chờ người dùng duyệt/yêu cầu push/tạo PR. Không tự merge vào dev.

## Self-review và gate

Phạm vi đã ánh xạ manual panel→02, ba errors→03, cleanup/focus→04, regression/live→05. Asset lỗi riêng không phá renderer, API lỗi không được che nội dung giả. Native Links giữ lựa chọn chủ động; data context là validated room/item hiện hành. Hiện chỉ tạo nhánh và tài liệu; phải dừng chờ duyệt.
