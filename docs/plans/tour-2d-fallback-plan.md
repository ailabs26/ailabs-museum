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

- [ ] Test trước model pending cancellation và context teardown khi renderer fail; back navigation không remount scene tự động. Assert DOM và owner probes theo pattern tests lifecycle/GLB hiện có, không dựa process memory hoặc ảnh GPU.
- [ ] Page giữ `failedRoomId` thay vì global boolean; khi fallback mount, effect gọi stable callback của room để đánh dấu lỗi. Page render fallback thay scene khi room đó failed. Không đặt lại `isSceneOpen=false` theo cách làm focus effect cũ kéo focus về nút Mở 3D và che thông báo lỗi.
- [ ] Tránh callback/state loop và remount/focus lại khi chỉ selection đổi: state failed room giữ nguyên, callback ổn định theo room ID, fallback effect chỉ chạy khi mount/callback thật sự đổi. Render lỗi vẫn giữ chọn item/panel/catalogue, ngừng owner useRoomModels bằng unmount (dispose/abort có sẵn).
- [ ] Panel link/fallback Link unmount toàn tour khi navigate; không thêm dispose thủ công lặp với cleanup owner. GLB asset error vẫn nằm trong ModelLoadingStatus/placeholder, không gọi onUnavailable.
- [ ] Detail h1 focus tái sử dụng có sẵn. Fallback→collection dùng Link state `{ fromTourFallback: true }`; CollectionPage kiểm tra location state, focus h1 một lần cho location.key khi nội dung hoặc thông báo lỗi/rỗng sẵn sàng, không focus lại background refetch. Dùng ref/effect tối thiểu tại page này, không sửa global router/focus.
- [ ] Tests F04: Tab/Enter, fallback status focus, link giữ room/item, content title focus, back không auto Canvas; no WebGL/chunk/context đều tới DOM route. Light/dark bốn viewport, error/retry giữ ngữ cảnh; cache reuse không được coi là lý do dùng dữ liệu khi query error.
- [ ] Gates và regressions phù hợp, commit task 04.

## FALLBACK-05 — Kiểm chứng cuối và live

- [ ] Live test opt-in: lấy first populated item theo API thật/schema; chủ động chọn item trong tour rồi link panel sang detail; quay tour và chặn WebGL trước mở scene để test link collection cùng phòng. Không mock API hoặc ghi DB. Nếu dữ liệu rỗng annotate rõ chưa chứng minh populated flow.
- [ ] Fixture tests riêng cho context loss/chunk/GLB fail, live không cần phá context GPU thật. Chứng minh GLB failed không tạo renderer fallback và retry còn khả dụng.

```powershell
npm.cmd test -- tour-2d-fallback.spec.ts exhibit-detail.spec.ts museum-tour.spec.ts museum-lifecycle.spec.ts museum-glb.spec.ts museum-interaction.spec.ts
npm.cmd run test:unit
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:MUSEUM_LIVE_TEST='1'
try { npm.cmd test -- tour-2d-fallback-live.spec.ts } finally { Remove-Item Env:MUSEUM_LIVE_TEST }
```

- [ ] Các task runtime trước cũng chạy gates/tests focused tương ứng trước commit; không tạo commit khi failure chưa giải quyết.
- [ ] README/task ghi chính xác versions/count/skip/warnings/giới hạn visual và GLB. Commit live tests/docs theo task 05, không artifacts hoặc .env.
- [ ] Gửi giao diện và mô tả PR trước, chờ người dùng duyệt/yêu cầu push/tạo PR. Không tự merge vào dev.

## Self-review và gate

Phạm vi đã ánh xạ manual panel→02, ba errors→03, cleanup/focus→04, regression/live→05. Asset lỗi riêng không phá renderer, API lỗi không được che nội dung giả. Native Links giữ lựa chọn chủ động; data context là validated room/item hiện hành. Hiện chỉ tạo nhánh và tài liệu; phải dừng chờ duyệt.
