# AUDIO-01 — Basic Audio Player Implementation Plan

> **For agentic workers:** Kế hoạch đã được duyệt và triển khai trên `feat/audio-player-01` theo [task breakdown](../tasks/audio-player-01.md). Người dùng yêu cầu mỗi task hoàn thành/kiểm chứng có một commit riêng; chưa push hoặc tạo PR.

**Goal:** Tạo reusable React component nhận `src`, phát/tạm dừng/tiếp tục audio bằng HTMLAudioElement, độc lập backend và trang hiện vật.

**Architecture:** Một component sở hữu một `<audio>` qua React ref; sự kiện media là nguồn sự thật cho trạng thái phát. UI Mantine gọi `play()`/`pause()`, không tạo service, global store hoặc media abstraction. Browser fixture mount component trực tiếp để kiểm thử media thật mà không thêm route sản phẩm.

**Tech Stack:** React 18, TypeScript, HTMLAudioElement, Mantine 7, Tabler icons, CSS Modules nếu cần và Playwright hiện có.

## 1. Trạng thái và căn cứ source

- Trạng thái tài liệu: **Implemented trên `feat/audio-player-01`; chưa push/PR**.
- Đã đọc `AGENTS.md`, `front-end/docs/coding-conventions.md`, `front-end/README.md`, `package.json`, theme/provider, shared components và cấu hình test/build.
- Đã fetch `origin/dev`; `dev` đồng bộ tại `8ffd808`. Nhánh chung cho tài liệu và code AUDIO-01: `feat/audio-player-01`.
- `src/shared/components/` đang nhóm theo loại; AUDIO-01 bổ sung nhóm `media/` với `AudioPlayer`, còn trước triển khai chưa có `<audio>` hoặc `HTMLAudioElement` trong source.
- `src/validations/roomSchema.ts` vẫn yêu cầu `audio: null`; không đổi contract trong AUDIO-01.
- `src/app/theme.ts` cung cấp primary color `aura`, radius `md`; `AppProviders.tsx` dùng MantineProvider với auto light/dark. Public layout có token xanh/ấm cục bộ, không phải token global.
- `vitest.config.ts` chỉ chạy `.test.ts` trên Node, chưa có môi trường DOM/component testing. Playwright có sẵn Chromium/Edge và Vite web server; không cần thêm jsdom hoặc React Testing Library.
- README có các đoạn lịch sử chưa đồng nhất về tiến độ. Thiết kế dựa trên source hiện tại, không suy diễn audio đã tồn tại từ tài liệu.

## 2. Global constraints

- Giai đoạn lập kế hoạch chỉ viết hai tài liệu này; code triển khai sau khi người dùng duyệt phải giữ đúng phạm vi bên dưới.
- Implementation chỉ thuộc frontend. Không sửa backend/API/database/migration/schema public.
- Chưa tích hợp vào trang chi tiết hiện vật, collection hoặc tour; không thêm route demo trong router sản phẩm.
- Không thêm thư viện. Không tự phát, preload toàn bộ, loop hoặc phát lại tự động sau khi đổi nguồn.
- Chưa làm seek, progress/duration UI, volume, playback speed, playlist, audio manager hoặc đồng bộ nhiều player.
- Named export khớp tên file; `import type`, alias `@/` qua thư mục khác; không tạo barrel chỉ để rút ngắn import.
- Kiểm chứng frontend khi triển khai: `npm run typecheck`, `npm run lint`, `npm run build` và focused Playwright test. Các lệnh này **chưa chạy ở giai đoạn lập kế hoạch**.

## 3. Lựa chọn thiết kế

| Cách | Đánh giá |
|---|---|
| `<audio controls>` mặc định | Ít code nhất nhưng UI có thêm seek/volume/duration, giao diện khác nhau giữa browser và không theo Mantine; không chọn. |
| **`<audio>` + một nút Mantine Play/Pause** | Chọn: UI đúng phạm vi, giữ native media lifecycle, dễ mở rộng trên cùng element. |
| `new Audio()` + hook/provider riêng | Thêm lifecycle và abstraction chưa cần; chỉ cân nhắc khi có consumer/headless hoặc phối hợp nhiều player thực tế. |

### Public interface đề xuất

```ts
export interface AudioPlayerProps {
  src?: string | null;
  label?: string;
}
// Named export: AudioPlayer; label mặc định: "Thuyết minh audio".
```

- `src` là URL media browser có thể đọc (ví dụ URL local do fixture cung cấp). Component không fetch API, dựng URL, gắn token hoặc đọc entity hiện vật.
- Chuẩn hóa `src?.trim()`; undefined/null/chuỗi rỗng/chỉ khoảng trắng là không có nguồn. Khi thiếu nguồn, không gán `src=""` để tránh request trang hiện tại.
- `label` định danh player cho người dùng và accessible group; không nhận object API hoặc trạng thái phát controlled.
- Caller tương lai chỉ cần truyền URL từ contract đã validate. URL cần Bearer/refresh hoặc private media cần giải quyết ở tầng tích hợp riêng; AUDIO-01 không cam kết hỗ trợ contract đó.

### UI và accessibility

- Wrapper có tên truy cập từ `label`, dùng `Paper`, `Stack`/`Group`, `Text`, `Button`; dùng theme Mantine mặc định, không phụ thuộc ancestor PublicLayout.
- Một nút có icon Tabler trang trí (`aria-hidden`) và chữ rõ nghĩa: **Phát**, **Tạm dừng**, **Tiếp tục**; sau kết thúc quay về **Phát**.
- Vùng `role="status"`/live polite hiển thị: **Sẵn sàng phát**, **Đang phát**, **Đã tạm dừng**, **Đã phát xong**, **Chưa có audio**, **Đang mở audio…** theo trạng thái tương ứng.
- Thiếu nguồn: nút disabled, thông báo vẫn đọc được. Lỗi: thông báo inline `role="alert"`, không toast liên tục; nút **Phát** cho phép thử lại thủ công.
- Nút native dùng Tab/Enter/Space; giữ focus ring, target cao tối thiểu 44px, không tự giành focus hoặc bắt phím toàn trang. Không dựa vào màu để báo trạng thái.
- Light/dark, 320px và chữ dài không tràn ngang. Ưu tiên Mantine props; CSS Module chỉ cho wrapping/kích thước cần thiết.

## 4. Media lifecycle và hành vi

| Đầu vào/sự kiện | Kết quả bắt buộc |
|---|---|
| Mount có `src` | `<audio preload="none">`, không autoplay; nút Phát. |
| Bấm Phát | Gọi `audio.play()` trực tiếp trong user gesture; đánh dấu request pending, chặn bấm lặp trong lúc promise chưa settle. |
| `playing` | Hiển thị Đang phát và nút Tạm dừng; không đổi sang playing chỉ vì đã bấm nút. |
| Bấm Tạm dừng | Gọi `pause()`, giữ `currentTime`; sự kiện `pause` cập nhật trạng thái. |
| Bấm Tiếp tục | Gọi `play()` trên cùng element, không `load()`/reset `currentTime`; tiếp tục từ vị trí cũ. |
| `ended` | Đã phát xong, nút Phát; click tiếp theo phát lại từ đầu. |
| Promise `play()` reject hoặc media `error` | Không hiện trạng thái đang phát giả; bỏ pending, báo Không phát được audio. Vui lòng thử lại.; catch rejection để không có unhandled promise. |
| Thử lại sau lỗi | Chỉ theo click: nếu media đã có error thì `load()` rồi gọi `play()`; không tự retry. |
| `src` thay đổi/bị xóa | Pause nguồn cũ, reset về đầu và xóa lỗi/trạng thái cũ, không autoplay nguồn mới; thiếu nguồn hiện Chưa có audio. |
| Unmount | Pause element, tháo nguồn và `load()` để ngừng tải/phát; gỡ listener nếu dùng listener thủ công. |
| Promise nguồn cũ settle muộn | Không cập nhật UI/error của nguồn mới hoặc component đã unmount. |

### Cách giữ implementation nhỏ và đúng

- Dùng ref tới DOM `<audio>` và event props React (`onPlaying`, `onPause`, `onEnded`, `onError`); không polling, timer hoặc mirror `currentTime` vào state ở AUDIO-01.
- State nội bộ tối thiểu: trạng thái hiển thị và pending request; thiếu nguồn suy ra từ props. Không có hai owner cùng điều khiển playback.
- Khi đổi nguồn, remount phần nội bộ sở hữu audio theo giá trị nguồn chuẩn hóa bằng `key`; cleanup pause/clear/load instance cũ. Đây là chi tiết trong cùng file, không xuất thêm public component.
- Mỗi play request có token/ref hiệu lực; cleanup vô hiệu token trước khi dừng audio. `catch/finally` chỉ thay state khi token còn hiệu lực; media error không bị `finally` ghi đè. `onPause` do `ended`/error không được đổi nhãn cuối thành Đã tạm dừng.
- Cho phép nhiều instance hoạt động độc lập; không thêm chính sách chỉ một player được phát.
- Sau này thêm seek/duration/volume bằng native `currentTime`, `duration`, `volume`, `timeupdate`/`loadedmetadata` ngay trên element hiện có. Đây là hướng mở rộng, chưa thêm props hoặc controls dự phòng.

## 5. File map dự kiến khi triển khai

| File | Trách nhiệm |
|---|---|
| `front-end/src/shared/components/media/AudioPlayer.tsx` | Component, props, media ref/events và cleanup. |
| `front-end/src/shared/components/media/AudioPlayer.module.css` | Chỉ tạo nếu Mantine props không đủ cho reflow/target size. |
| `front-end/docs/coding-conventions.md` | Ghi nhận nhóm shared `media/` trước khi sử dụng; không thêm layer cấp src mới. |
| `front-end/tests/fixtures/audio-player.html` | HTML mount fixture riêng, không route sản phẩm. |
| `front-end/tests/fixtures/audio-player.tsx` | Mount bằng React + MantineProvider/theme thực tế; controls đổi/xóa nguồn và mount/unmount chỉ dành cho test. |
| `front-end/tests/fixtures/audioFixture.ts` | Tạo Buffer WAV PCM nhỏ, xác định và có thời lượng đủ quan sát pause/resume; không tải mạng hoặc lưu binary mới. |
| `front-end/tests/audio-player.spec.ts` | Browser tests playback, fallback, lỗi, lifecycle, accessibility và reflow. |
| `front-end/tsconfig.audio-fixture.json` | Kế thừa app config để typecheck TSX harness ngoài src, không đổi build inputs. |
| `front-end/README.md` | Ví dụ import/props và cách chạy fixture, nêu giới hạn chưa tích hợp API/trang. |
| Hai tài liệu AUDIO-01 | Cập nhật trạng thái/bằng chứng chỉ sau triển khai và kiểm chứng. |

Không sửa router, pages, AppProviders, roomSchema, service, package manifest/lock hoặc Vite/Vitest/Playwright config để thêm player.

## 6. Test strategy

- Browser fixture tại `/tests/fixtures/audio-player.html`, Vite dev transform TSX theo cấu hình hiện có. Chỉ bọc MantineProvider với theme thật, không AppProviders/AuthProvider để không gọi API.
- Test route `**/audio-fixture.wav` trả WAV PCM mono 16-bit do helper tạo (ví dụ 8kHz, 8 giây tone nhỏ), content-type `audio/wav`. Nguồn lỗi trả 404 hoặc byte không phải audio. Fixture không cần backend/file media thật.
- Dùng media thật để xác nhận `paused`, `currentTime` tăng khi phát, giữ khi pause và tiếp tục từ mốc cũ. Dùng polling, không chờ hết toàn bộ file cho mỗi case.
- Một case ended dùng native element đặt gần cuối **chỉ trong test**, chờ `ended` thật rồi kiểm tra phát lại.
- Chỉ mock `play()` có kiểm soát cho rejection/pending race; ghi rõ đó không phải bằng chứng decode/playback thật. Kiểm tra nguồn bị đổi/unmount trong lúc promise pending, không unhandled rejection.
- Nút harness đổi URL giữa hai fixture, xóa nguồn, tháo component; giữ reference tới element cũ trong test để xác nhận đã pause và nguồn đã tháo.
- Browser test không mock WebGL/API vì player không dùng chúng. Chặn/ghi nhận request `/api/` để xác nhận fixture không phụ thuộc backend.
- Fixture HTML/TSX nằm dưới `tests/`, được Vite phục vụ trong dev; **không nằm trong production Rollup inputs**. Focused test chạy dev, không đặt `PLAYWRIGHT_PREVIEW=1`. `npm run build` kiểm tra component production compile, không được ghi là đã browser-test fixture trên preview.
- TSX fixture nằm ngoài `tsconfig.app.json`; tạo `tsconfig.audio-fixture.json` kế thừa app config, include đúng TSX harness, noEmit. JSX/module/alias và Vite CSS types được kế thừa; component/theme được TypeScript theo dõi qua import. Không coi Vite transpile là typecheck fixture.

Lệnh dự kiến, từ `front-end/` (PowerShell dùng `npm.cmd` nếu `npm.ps1` bị chặn):

```powershell
npm run typecheck
npx tsc -p tsconfig.audio-fixture.json --pretty false
npm run lint
npm run build
# PLAYWRIGHT_PREVIEW và MUSEUM_LIVE_TEST phải unset; server Vite test cổng 4173.
npm test -- audio-player.spec.ts
```

## 7. Acceptance và task mapping

| Yêu cầu | Task | Bằng chứng dự kiến |
|---|---|---|
| Reusable component nhận src, độc lập API | AUDIO-01.1 | Mount standalone, không request API, public props/typecheck. |
| Play/Pause/Resume | AUDIO-01.1 | Native currentTime/paused assertions; resume không về 0. |
| Trạng thái phát/dừng, thiếu nguồn | AUDIO-01.1 | Nhãn/nút đúng; undefined/null/blank không request media. |
| Lỗi, ended/replay và pending | AUDIO-01.2 | Media failure + rejection/replay tests. |
| Đổi nguồn, cleanup và stale promise | AUDIO-01.3 | Race tests, element cũ pause/tháo nguồn và StrictMode. |
| Mantine/theme và accessibility | AUDIO-01.4 | Keyboard, light/dark, reflow 320/768/1440px. |
| Fixture local, không dependency mới | AUDIO-01.1–4 | WAV fixture + focused browser test; diff manifest không đổi. |
| Mở rộng sau này và hướng dẫn | AUDIO-01.5 | Review native ownership, hướng dẫn props, không gắn API/domain. |

### Mốc commit theo task

| Task | Phạm vi commit | Commit message dự kiến |
|---|---|---|
| AUDIO-01.0 | PLAN/TASK đã duyệt | `docs(audio): plan basic player implementation` |
| AUDIO-01.1 | Component + fixture + happy-path tests | `feat(audio): add basic play pause and resume player` |
| AUDIO-01.2 | Lỗi/pending/ended + tests | `fix(audio): handle playback errors and replay` |
| AUDIO-01.3 | Source lifecycle/cleanup + tests | `fix(audio): clean up playback on source changes and unmount` |
| AUDIO-01.4 | Accessibility/theme/multiple instances + fixture typecheck | `test(audio): verify keyboard theme and isolated instances` |
| AUDIO-01.5 | README và bằng chứng nghiệm thu | `docs(audio): document usage and verification evidence` |

Mỗi commit chỉ stage file thuộc task, đi kèm test liên quan và bằng chứng gate đạt. Review status/diff/recent log và secrets trước commit; không commit RED, không squash các task, không tạo commit rỗng. Các task đã triển khai và commit riêng trên `feat/audio-player-01`.

## 8. Tự review kế hoạch

- [x] Đã đối chiếu source và ghi rõ public audio đang null; không đưa việc sửa contract vào task.
- [x] Đủ Play/Pause/Resume, ended/replay, missing src, media error, play rejection, đổi nguồn và unmount.
- [x] Resume không gọi load/reset; retry sau lỗi là luồng khác và chỉ chạy theo click.
- [x] Không optimistic playing; pending request và lỗi nguồn cũ có quy tắc xử lý cụ thể.
- [x] Có đường test media thật bằng fixture, phân biệt rõ mock promise và decode thật.
- [x] Không thêm production demo route, dependency, audio API, backend hoặc player trên trang chi tiết.
- [x] Chỉ thiết kế một component sở hữu native element, không xây abstraction cho tính năng tương lai.
- [x] Tài liệu và task có file/test/acceptance cụ thể; bằng chứng test thực tế được ghi ở phần Verification evidence.
- [x] Người dùng review và duyệt trước triển khai.

### Verification evidence

- `npm.cmd test -- audio-player.spec.ts --reporter=line`: **10 passed**.
- `npm.cmd run typecheck`: **passed**.
- `npx.cmd tsc -p tsconfig.audio-fixture.json --pretty false`: **passed**.
- `npm.cmd run lint`: **passed**.
- `npm.cmd run build`: **passed**; Vite vẫn báo cảnh báo bundle hiện hữu cho các chunk trên 500 kB.
- Chưa chạy full Playwright suite, live API test hoặc kiểm thử thiết bị/GPU thật; AUDIO-01 không tích hợp API và không thay backend.
