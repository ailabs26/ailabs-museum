# AudioPlayer — Seek & Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (hoặc `superpowers:subagent-driven-development` nếu có) sau khi PLAN/TASK được duyệt. Triển khai task-by-task, test RED → GREEN, review diff và commit theo task. Checklist `[ ]` là kế hoạch, không phải bằng chứng đã chạy.

**Goal:** Thêm khả năng tua audio có hiển thị thời gian và tổ chức lại bố cục trình phát thuyết minh gọn, responsive, không phá các luồng API/WebVTT/playback hiện có.

**Architecture:** Giữ **một** shared `AudioPlayer` sở hữu native `HTMLAudioElement`. Đồng bộ timeline theo native media events, dùng thanh range có nhãn khác với volume, và CSS Module nhỏ cho header/controls/captions. Không sửa caller trừ khi phát hiện regression thực tế; test fixture/browser cho semantics và lifecycle.

**Tech Stack:** React 18, TypeScript, Mantine 7, Tabler icons, `HTMLAudioElement`/`TextTrack`, CSS Modules, Vitest, Playwright hiện có.

**Spec / task:** [audio-player-seek-ui.md — Thiết kế đề xuất để review](../tasks/audio-player-seek-ui.md#2-thiết-kế-đề-xuất-để-review).

**Base:** `dev` tại `75df3ea6728d5d44bdc3891723fdaccdc0a14557` lúc khảo sát (PR #70 đã merge). **Khi triển khai phải fetch lại** `origin/dev` và dùng HEAD mới nhất.

**Branch đề xuất:** `fix/audio-player-seek-ui` → PR vào `dev`.

**Status:** Đã triển khai và kiểm chứng ngày 23/10/2026 trên `fix/audio-player-seek-ui` từ `origin/dev` tại `75df3ea`. Giữ nhánh local, chưa push/PR/merge; xem execution ledger trong TASK.

## 1. Source map và quyết định thiết kế

| Source trên `dev` | Hiện trạng | Trách nhiệm thay đổi |
|---|---|---|
| `front-end/src/shared/components/media/AudioPlayer.tsx` | 160 dòng; Play/Pause/Resume/Stop, volume full width, VTT, cleanup, **chưa seek/duration** | State/time native + seek slider + layout chung |
| `front-end/tests/audio-player.spec.ts` | Playwright dùng WAV fixture, kiểm error/StrictMode/keyboard/Stop/volume/captions | Thêm metadata, seek, timing, layout và edge cases |
| `front-end/tests/fixtures/audio-player.tsx` | Mount StrictMode, đổi source, thêm player, bật VTT | Tận dụng; chỉ sửa nếu cần state/fixture mới |
| `front-end/tests/fixtures/audioFixture.ts` | Sinh WAV thật cho browser test | Giữ, không thêm file media binary |
| `front-end/tests/public-audio.spec.ts` | Kiểm 2D/tour, VTT, cleanup, 404/retry | Regression; chỉ thêm test nếu cần |
| `front-end/src/pages/client/ExhibitDetailPage.tsx` | Truyền URL audio/subtitle vi vào player | Không đổi props/API |
| `front-end/src/components/museum/ExhibitDetailPanel.tsx` | Player cho tour và CMS Preview dùng chung | Không đổi props/API |
| `front-end/src/app/theme.ts` | Primary `aura`, light/dark Mantine | Dùng token hiện có, không sửa theme |
| `docs/architecture/fe/coding-conventions.md` | Conventions thật của repo | Tuân thủ, không chép sang path khác |

**Phương án:** Mở rộng component hiện có (chọn). `<audio controls>` native không đáp ứng thiết kế và trạng thái/captions; thư viện media/store mới tăng rủi ro, không cần thiết.

## 2. Global Constraints

- Giữ `AudioPlayerProps`: `src?: string | null`, `label?: string`, `subtitleUrl?: string | null`, `locale?: 'vi' | 'en'` và named export; không thêm callback/service API mới.
- Giữ `preload="none"`, không autoplay, không eager-fetch metadata; duration chưa sẵn thì `--:--`, seek disabled.
- Native `audio.currentTime`/`duration` là nguồn sự thật; không set timer, RAF, Zustand/global playback store hoặc đưa số thời gian qua DTO API.
- Giữ one-guide-at-a-time, retry thủ công, transcript ở consumer, WebVTT text an toàn, ký URL của CMS preview và lifecycle key theo source/subtitle/locale.
- Không sửa backend, Storage, CORS, database/migrations/seed, RBAC, WebXR/headset, model/camera/3D, public locale, media rights hoặc thêm dependency.
- Không làm playback speed, playlist, skip buttons, spatial audio, timeline buffered/waveform hoặc transcript tương tác.
- Chỉ commit sau khi tests/gates của task đạt; không làm thay đổi không liên quan, không merge/push `dev` trực tiếp.

## 3. Review Focus

1. **Metadata unknown:** `duration=NaN/Infinity/0`, metadata trễ → không hiện `NaN`, slider disabled; test Task 1–2.
2. **Seek state:** playing/paused/ended/Stop → audio không autoplay ngoài ý muốn và đồng bộ đúng vị trí; test Task 2.
3. **Caption race:** seek khi paused, Stop rồi Replay, VTT lỗi hoặc `cuechange` tới muộn → cue không sai; test Task 2–3.
4. **Unmount/source race:** đổi exhibit khi play promise pending hoặc native event trễ → không rò listener/time/cue của nguồn cũ; test Task 2 + regression Task 4.
5. **Responsive/assistive:** 320px, panel hẹp, light/dark, tab focus, hai slider có tên khác nhau; test Task 3.

## 4. File map và interfaces

| File | Task | Hành động |
|---|---|---|
| `docs/plans/audio-player-seek-ui-plan.md` | 0, 4 | PLAN và evidence |
| `docs/tasks/audio-player-seek-ui.md` | 0, 4 | Spec, checklist, acceptance và execution ledger |
| `front-end/src/helpers/audioTime.ts` | 1 | New: `formatAudioTime`, `getSeekDuration`, `clampAudioTime` |
| `front-end/src/helpers/audioTime.test.ts` | 1 | New: Vitest helper tests |
| `front-end/src/shared/components/media/AudioPlayer.tsx` | 2–3 | Native event/seek control, bố cục |
| `front-end/src/shared/components/media/AudioPlayer.module.css` | 3 | New: responsive spacing, vùng tương tác, phụ đề |
| `front-end/tests/audio-player.spec.ts` | 2–3 | Browser behavior/a11y/visual structure |
| `front-end/tests/audio-player-layout.spec.ts` | 3 | New: layout, theme, panel hẹp và paused VTT |
| `front-end/tests/fixtures/audio-player.tsx` | 2–3 | Theme auto và CSS Mantine thật cho visual tests |
| `front-end/tests/fixtures/audioFixture.ts` | 2 | WAV fixture hỗ trợ Range/206 để kiểm native seek |
| `front-end/tests/public-audio.spec.ts` | 4 | Regression; chỉ sửa nếu thiếu coverage |
| `front-end/tests/public-image-audio-live.spec.ts` | 4 | Assertion tua paused và Resume với media/API thật |
| `front-end/README.md` | 4 | Hướng dẫn controls + verification |

**Interfaces thống nhất cho Task 1–3:**

```ts
export function formatAudioTime(seconds: number): string;
export function getSeekDuration(duration: number): number | null;
export function clampAudioTime(seconds: number, duration: number): number;
```

`formatAudioTime` trả `00:00`, `01:14`, `01:00:01` từ `0`, `74.9`, `3601` tương ứng; thời lượng chưa biết được render `--:--` **ở component** khi `getSeekDuration()` trả `null`. `getSeekDuration` chỉ trả `number` khi finite và dương. `clampAudioTime` xử lý giá trị input thành `[0,duration]`, luôn finite. Không dùng `0` làm duration hợp lệ.

**Cấu trúc UI:** header (`label`, status); timeline (`range` tên **Tua âm thanh**, time left/right); controls (`Phát/Tạm dừng/Tiếp tục/Thử lại`, `Dừng`, volume nhỏ tên **Âm lượng**); captions (nhãn, toggle, cue nếu có). Trên <480px cho phép wrap nhưng giữ thứ tự DOM; status duy nhất `aria-live`, số thời gian không live.

## 5. Task execution plan

### Task 0 — Chốt kế hoạch và branch

**Files:** Hai file Markdown này.

- [x] **0.1 Review:** Người dùng duyệt PLAN/TASK, bao gồm seek không autoplay, `preload="none"` và layout đã chọn.
- [x] **0.2 Branch:** `git fetch origin dev`, kiểm `git status`, tạo `fix/audio-player-seek-ui` từ latest `origin/dev`; không ghi đè thay đổi người khác.
- [x] **0.3 Document:** Chép đúng `docs/plans/...` và `docs/tasks/...` vào nhánh; rà links/file paths và `git diff --check`.
- [x] **0.4 Commit:** Stage đúng hai file rồi commit `docs(audio): plan seek and player layout`. Không code runtime ở task này.

**Acceptance:** PLAN ↔ TASK link đúng, branch riêng và diff chỉ docs, chưa push/PR nếu chưa được yêu cầu.

### Task 1 — Helpers thời gian (TDD)

**Files:** Create `front-end/src/helpers/audioTime.ts`, `front-end/src/helpers/audioTime.test.ts`.

**Produces:** Ba functions như mục 4, thuần TypeScript; Task 2 import chúng.

- [x] **1.1 RED:** Test `formatAudioTime(0)==='00:00'`, `(74.9)==='01:14'`, `(3601)==='01:00:01'`, invalid → `'00:00'`.
- [x] **1.2 RED:** Test `getSeekDuration(0/NaN/Infinity/-1)===null`, `(180)===180`; clamp âm/vượt/invalid và không bao giờ NaN.
- [x] **1.3 Run RED:** `cd front-end && npm run test:unit -- src/helpers/audioTime.test.ts` → FAIL do implementation chưa có, không chấp nhận fail môi trường làm bằng chứng RED.
- [x] **1.4 GREEN:** Implement 3 pure functions với `Number.isFinite`, `Math.floor`, `Math.min/Math.max`; duration phải finite & >0.
- [x] **1.5 Verify:** Cùng unit command PASS; `npm run typecheck` PASS; review diff.
- [x] **1.6 Commit:** `feat(audio): add playback time helpers` với đúng 2 files.

**Acceptance:** Helper test đạt, không thêm React/DOM/global state.

### Task 2 — Seek timeline theo native media (TDD)

**Files:** Modify `front-end/src/shared/components/media/AudioPlayer.tsx`, `front-end/tests/audio-player.spec.ts`.

**Consumes:** `formatAudioTime`, `getSeekDuration`, `clampAudioTime`, refs/status/events hiện tại.
**Produces:** `getByRole('slider', { name: 'Tua âm thanh' })`, thời gian thật, seek giữ đúng trạng thái.

- [x] **2.1 RED — unknown:** StrictMode fixture `preload="none"`; sau mount không request media, slider disabled, `00:00 / --:--`.
- [x] **2.2 RED — metadata:** Click Phát; WAV fixture có duration hữu hạn, slider mở, `currentTime`/nhãn thời gian tăng theo native event.
- [x] **2.3 RED — seek:** Seek tới mốc 4s bằng slider + bàn phím, assert `HTMLAudioElement.currentTime≈4` và vẫn playing; pause, seek 2s, vẫn paused; Stop trả 0.
- [x] **2.4 RED — ended/race/error:** Ended rồi seek về 2s không tự phát; đổi source reset timeline, event/promise cũ không ghi state; 404/corrupt/NaN/Infinity disable slider, Retry vẫn đúng.
- [x] **2.5 Implement:** State time/duration nằm trong keyed instance; đồng bộ theo `loadedmetadata`, `durationchange`, `timeupdate`, `seeking`/`seeked`, `ended`, `emptied`/`error` của `<audio>`. Seek `onChange` guard `source`, status/error, valid duration rồi `audio.currentTime=clampAudioTime(value,duration)`; **không gọi `play()`**. Trong `onSeeked`, đồng bộ `activeCues` khi đang paused.
- [x] **2.6 Verify:** `npm test -- audio-player.spec.ts`, `npm run test:unit -- src/helpers/audioTime.test.ts`, `npm run typecheck` đều PASS; review diff.
- [x] **2.7 Commit:** `feat(audio): enable timeline seeking` (component + browser tests).

**Acceptance:** Seek tác động thật lên native player; các luồng Play/Pause/Stop/Retry/cleanup cũ vẫn đúng. Không giả vờ seek thành công khi native resource từ chối.

### Task 3 — UI responsive + WebVTT polish (TDD)

**Files:** Modify `AudioPlayer.tsx`, `front-end/tests/fixtures/audio-player.tsx`; create `front-end/src/shared/components/media/AudioPlayer.module.css`, `front-end/tests/audio-player-layout.spec.ts`. Regression Stop/contrast trong `front-end/tests/public-audio.spec.ts`.

**Consumes:** Seek hoàn chỉnh từ Task 2; không đổi `AudioPlayerProps`.
**Produces:** Visual hierarchy theo task spec, accessible/cue behavior.

- [x] **3.1 RED — hierarchy:** Browser kiểm header label/status, timeline và time row, controls + volume compact, captions ở section dưới divider; nút play/Stop gần nhau.
- [x] **3.2 RED — responsive:** Viewports 320/375/768/1440, light/dark, long label, panel hẹp: không horizontal scroll; thanh volume gọn ~100–140px khi rộng, controls wrap khi hẹp. Nút và hit-area slider ≥44px, focus keyboard rõ.
- [x] **3.3 RED — captions:** Seek tới cue mới lúc đang pause, cue đồng bộ; subtitleUrl 404 báo lỗi mà player vẫn chạy; cue rỗng không tạo box cao cố định.
- [x] **3.4 Implement:** Dùng Mantine components hiện có, `@tabler/icons-react` icon loa, CSS Module cho grid/flex/gap/wrap/breakpoint. Một status live trong header; không có thêm announcer tại timeline. Giữ tên nút/toggle như tests cũ.
- [x] **3.5 Verify:** `npm test -- audio-player.spec.ts audio-player-layout.spec.ts public-audio.spec.ts`; `npx tsc -p tsconfig.audio-fixture.json --pretty false`; `npm run typecheck`, `npm run lint`, `npm run build`; review diff.
- [x] **3.6 Commit:** `fix(audio): polish responsive player layout` (component/CSS/tests liên quan).

**Acceptance:** Không overflow/khó thao tác trên mobile hoặc panel 3D; captions và keyboard không regression.

### Task 4 — Regression, docs, handoff

**Files:** Modify `front-end/README.md`, `docs/plans/audio-player-seek-ui-plan.md`, `docs/tasks/audio-player-seek-ui.md`, `front-end/tests/audio-player.spec.ts` (pointer assertions), `front-end/tests/public-image-audio-live.spec.ts` (seek live). Stop/contrast regression đã đi cùng Task 3.

- [x] **4.1 Browser regression:** `cd front-end && npm test -- audio-player.spec.ts audio-player-layout.spec.ts public-audio.spec.ts public-image-audio.spec.ts` và case chuyển hiện vật cùng URL, single-guide, Stop/VTT/retry.
- [x] **4.2 Quality:** `npm run test:unit`, `npm run typecheck`, `npx tsc -p tsconfig.audio-fixture.json --pretty false`, `npm run lint`, `npm run build`. Ghi **output thực**, failed/skipped/warnings; không dùng số pass cũ làm evidence mới.
- [x] **4.3 Live tùy điều kiện:** Chạy read-only khi API/media local sẵn sàng; baseline chưa assert seek, đã bổ sung tua paused + Resume và đạt với backend/media thật. Không seed/upload/publish; evidence nằm trong TASK.
- [x] **4.4 Docs:** README hướng dẫn timeline, thời gian `--:--` trước metadata, keyboard/volume/captions. Task ghi commit SHAs và test evidence; plan cập nhật trạng thái phù hợp.
- [x] **4.5 Review:** `git diff --check`, toàn diff so với `dev`, kiểm secrets và không sửa backend/API/deps; commit `test(audio): verify seek UI integration` (nếu chỉ docs, dùng `docs(audio): document seek UI verification`; không tạo commit rỗng).
- [x] **4.6 Handoff:** Chuẩn bị PR vào `dev`, dừng trước push/PR/merge nếu chưa có yêu cầu; mô tả số test/giới hạn đã thực sự chạy.

**Acceptance:** Kiểm thử liên quan đạt và ghi nhận trung thực; feature không làm hỏng 2D/tour/CMS preview; branch độc lập, sạch, không có thay đổi ngoài phạm vi.

## 6. Verification commands

Chạy trong `front-end/` (PowerShell có thể dùng `npm.cmd` nếu chặn `npm.ps1`):

```bash
npm run test:unit -- src/helpers/audioTime.test.ts
npm test -- audio-player.spec.ts
npm test -- audio-player.spec.ts audio-player-layout.spec.ts public-audio.spec.ts public-image-audio.spec.ts
npm run test:unit
npm run typecheck
npx tsc -p tsconfig.audio-fixture.json --pretty false
npm run lint
npm run build
```

**Live opt-in:** Test đã bổ sung assertion tua native khi paused và Resume, không mock hay ghi dữ liệu. Đặt `CI` unset nếu chủ động dùng dev server local sẵn có; cổng live là 5173 (CORS backend), fixture là 4173.

```powershell
$env:MUSEUM_LIVE_TEST = '1'
$env:PLAYWRIGHT_PREVIEW = '1'
npm.cmd test -- public-image-audio-live.spec.ts
Remove-Item Env:MUSEUM_LIVE_TEST
Remove-Item Env:PLAYWRIGHT_PREVIEW
```

## 7. Self-review — coverage

- UI chính + responsive (spec 2.1) → Task 3.
- Duration/format/guard (spec 2.2) → Task 1–2.
- Seek playing/paused/ended/Stop, captions và owner races → Task 2–3.
- A11y/keyboard/status, CSS dark mode → Task 3.
- Không phá integrations public/CMS, single-guide cleanup và errors → Task 4.
- Không có backend/dependency/API/3D work → Global Constraints + review diff.

**Verification evidence:** Unit 146/146, browser regression 37/37, pointer assertion bổ sung 1/1 và live API/media với paused seek + Resume 1/1 (không skip). App/fixture typecheck, lint, build và diff check đạt; warning bundle >500 kB hiện hữu. Findings review (contrast dark panel, Stop-caption race) đã tái hiện RED và xác nhận GREEN. SHA/lệnh/kết quả/giới hạn và mô tả PR chuẩn bị nằm trong [TASK](../tasks/audio-player-seek-ui.md#6-evidence-sau-triển-khai). Không push/PR/merge.
