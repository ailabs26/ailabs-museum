# Nâng cấp AudioPlayer — Tua âm thanh và bố cục

**Trạng thái:** Người dùng đã duyệt; đang triển khai, chưa push/PR/merge.
**Ngày:** 23/10/2026 (Asia/Bangkok).
**Plan:** [audio-player-seek-ui-plan.md](../plans/audio-player-seek-ui-plan.md).
**Base khảo sát:** `dev` tại `75df3ea6728d5d44bdc3891723fdaccdc0a14557` (đã merge PR #70).
**Nhánh dự kiến:** `fix/audio-player-seek-ui` → PR vào `dev` (refresh `origin/dev` trước khi thực thi).
**Execution gate:** Người dùng đã duyệt hai tài liệu và yêu cầu tạo nhánh, triển khai. Thực thi inline trên nhánh nhiệm vụ; chưa push/PR/merge theo phạm vi task mới.

## 1. Mục tiêu và hiện trạng

`AudioPlayer` đang phát audio từ API trong trang chi tiết hiện vật 2D và panel tour 3D; CMS Draft Preview cũng dùng panel chung. Component hiện có Phát/Tạm dừng/Tiếp tục/Phát lại/Dừng, âm lượng, WebVTT, trạng thái lỗi/Thử lại, cleanup và quy tắc chỉ một guide phát trong cùng document. Tuy nhiên:

- **Chưa có thanh tiến trình, hiển thị thời lượng hoặc thao tác tua.** Thanh `input[type=range]` đang thấy là **Âm lượng**, không phải timeline.
- Header đẩy các nút ra xa nhau; âm lượng chiếm cả chiều ngang; toggle và cue phụ đề tách rời nhau, làm bố cục thiếu trọng tâm.
- Tất cả consumer dùng chung `front-end/src/shared/components/media/AudioPlayer.tsx`, vì vậy cần sửa **một component** thay vì viết lại từng trang.

**Kết quả mong muốn:** Một player gọn, có timeline dễ thao tác, nhóm controls hợp lý, không mất các tính năng và bảo đảm truy cập (accessibility) đã có.

## 2. Thiết kế đề xuất để review

### 2.1 Bố cục đã được chọn

```text
┌────────────────────────────────────────────────────────┐
│ 🎧 Thuyết minh audio                      ● Đang phát   │
│                                                        │
│ ━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 01:14                                             03:15 │
│                                                        │
│ [Tạm dừng] [Dừng]                     🔊 [━━━━●━━]     │
│ ────────────────────────────────────────────────────── │
│ Phụ đề WebVTT                          [Tắt phụ đề]    │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Nội dung cue phụ đề tại thời điểm phát             │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

- **Hàng 1:** tên audio bên trái, trạng thái bên phải; trạng thái giữ đúng `role="status"`, riêng lỗi dùng `role="alert"` (không có live region thứ hai).
- **Hàng 2:** seek slider toàn chiều ngang có tên truy cập **Tua âm thanh**; dòng `thời gian hiện tại / tổng thời lượng` ngay bên dưới, canh hai đầu.
- **Hàng 3:** nút **Phát/Tạm dừng/Tiếp tục/Thử lại** đặt sát **Dừng** ở bên trái; icon loa và thanh **Âm lượng** ngắn khoảng 100–140 px bên phải khi đủ rộng.
- **Hàng 4:** đường phân cách, nút **Bật/Tắt phụ đề** cùng hàng với nhãn WebVTT; cue hiện tại ở nền nhẹ, chỉ render khung cue khi có chữ. Lỗi phụ đề hiện thông báo riêng, không che controls.
- **Responsive:** container dưới 480 px tự xuống dòng, thứ tự đọc hợp lý và không tràn ngang ở viewport 320 px/panel tour hẹp. Tất cả nút và hit area slider hướng tới tối thiểu 44 px.
- Dùng Mantine, Tabler icons và CSS Module đồng hành; không hardcode nền/text chỉ phù hợp light mode.

### 2.2 Quy tắc seek, duration và playback

| Tình huống | Hành vi bắt buộc |
|---|---|
| Chưa bấm Phát, `preload="none"` | Không tải audio chỉ để lấy thời lượng; hiện `00:00` và `--:--`, khóa seek đến khi metadata sẵn sàng. |
| Native `duration` hợp lệ (`finite`, `> 0`) | Hiển thị `mm:ss`; từ 1 giờ trở lên dùng `hh:mm:ss`. Seek mở và theo `currentTime` thực tế. |
| `duration` bằng `NaN`, `Infinity`, `0`, âm hoặc thiếu | Hiển thị `--:--`; seek disabled, không ghi `currentTime` giá trị sai. |
| Click/kéo thanh hoặc dùng Arrow/Home/End | Cập nhật `audio.currentTime` có clamp vào `[0, duration]`; mặc định mỗi bước 1 giây. |
| Đang phát rồi tua | Tiếp tục phát từ vị trí mới nếu media/browser hỗ trợ; không chủ động gọi `play()` lần hai. |
| Đang tạm dừng rồi tua | Giữ paused, không tự phát; nhấn **Tiếp tục** để nghe từ vị trí mới. |
| Đã phát xong rồi tua về trước điểm kết thúc | Đưa UI về trạng thái tạm dừng/tiếp tục; **không** tự phát. |
| Nhấn **Dừng** | `pause()`, đưa `currentTime` và seek về 0, xóa cue cũ, chuyển về trạng thái sẵn sàng; giữ tổng thời lượng nếu còn metadata. |
| Seek khi WebVTT đang có | Sau `seeked`/`cuechange`, cue DOM phản ánh thời điểm mới ngay cả khi paused; không để phụ đề cũ. |
| Không có source hoặc audio lỗi | Không gửi request URL rỗng; seek disabled; giữ `Thử lại` và thông báo lỗi như cũ. |
| Thay `src`/`subtitleUrl`/`locale`/hiện vật hoặc unmount | Reset timeline/duration/caption của owner mới; pause + tháo nguồn cũ; promise/listener cũ không cập nhật UI mới. |

`HTMLAudioElement` là **nguồn sự thật**: đọc `currentTime`/`duration`, nghe `loadedmetadata`, `durationchange`, `timeupdate`, `seeking`/`seeked`, `ended`, `emptied`, `error`. Không timer hay requestAnimationFrame. Không dự đoán duration từ response API.

### 2.3 Accessibility và bảo toàn chức năng

- Giữ `AudioPlayerProps { src?: string | null; label?: string; subtitleUrl?: string | null; locale?: 'vi' | 'en' }`, named export và accessible region mang nhãn player.
- Seek có `aria-label="Tua âm thanh"`, `aria-valuetext` đọc được dạng thời gian; volume có tên **Âm lượng**. Không đổi các tên nút đang được test nhận diện.
- Thời gian liên tục thay đổi **không** nằm trong `aria-live`; chỉ trạng thái phát/lỗi được thông báo.
- Giữ **không autoplay**, `preload="none"`, one-guide-at-a-time, retry thủ công, transcript (render ở consumer) và phụ đề hiển thị bằng text an toàn.
- Không thêm UI audio vào headset XR, transcript karaoke/click-to-seek, speed, playlist, waveform, bước tua nhanh, backend/API/DB/storage hay dependency mới.

### 2.4 Phương án đã cân nhắc

| Phương án | Đánh đổi | Quyết định |
|---|---|---|
| Đổi sang `<audio controls>` mặc định | Seek có sẵn nhưng khác UI Mantine, khó bảo toàn cách hiển thị caption/error hiện tại | Không chọn |
| Thay player bằng thư viện/store mới | Thêm dependency, phá ranh giới ownership đã test | Không chọn |
| **Mở rộng shared `AudioPlayer` dùng native `<audio>`** | Bổ sung state timeline và CSS nhỏ, ít tác động các consumer | **Đề xuất phù hợp bố cục đã duyệt** |

## 3. Ràng buộc triển khai

- Chỉ frontend, tests và docs. Không sửa backend, upload/media delivery, Supabase, schema, auth, RBAC, database/migration/seed, GLB/WebXR.
- Mọi consumer public/CMS tiếp tục truyền URL có sẵn; không dựng URL Storage, không thêm API call, không thay `AudioPlayerProps`.
- Không viết player riêng cho trang 2D, tour hoặc CMS preview; không tạo abstraction chưa cần.
- Bắt đầu từ `origin/dev` mới nhất, một branch/PR theo `AGENTS.md`; không push trực tiếp vào `dev`.
- Theo conventions thực tại `docs/architecture/fe/coding-conventions.md`.
- Mỗi task runtime có chu kỳ test RED → GREEN → review; chỉ commit khi các gate liên quan đạt. Không ghi `passed` nếu chưa có output thực.

## 4. Task breakdown & nghiệm thu

| Task | Phụ thuộc | Deliverable | Commit dự kiến |
|---|---|---|---|
| **Task 0** | Review | Chốt PLAN/TASK, branch riêng | `docs(audio): plan seek and player layout` |
| **Task 1** | 0 | Helper định dạng thời gian/validate duration | `feat(audio): add playback time helpers` |
| **Task 2** | 1 | Timeline, seek và đồng bộ native playback | `feat(audio): enable timeline seeking` |
| **Task 3** | 2 | Bố cục responsive, âm lượng gọn, WebVTT polish | `fix(audio): polish responsive player layout` |
| **Task 4** | 3 | Regression, README, evidence và bàn giao | `test(audio): verify seek UI integration` |

### Task 0 — Review và tạo nhánh

**File:** `docs/plans/audio-player-seek-ui-plan.md`, `docs/tasks/audio-player-seek-ui.md`.

- [ ] Người dùng duyệt cả PLAN/TASK, gồm chính sách `preload="none"` và seek khi paused/ended.
- [ ] Refresh `origin/dev` và xác minh đã có PR #70; tạo `fix/audio-player-seek-ui` từ HEAD mới nhất; working tree không có thay đổi ngoài nhiệm vụ.
- [ ] Đặt đúng hai file dưới `docs/plans/` và `docs/tasks/`; rà links chéo, path code/test, `git diff --check`.
- [ ] Commit tài liệu, không triển khai code trước khi duyệt.

**Acceptance:** Không có file runtime nào bị sửa; plan/task nhất quán, chưa push/PR/merge.

### Task 1 — Helpers thời gian và giới hạn seek (TDD)

**Files:** `front-end/src/helpers/audioTime.ts` (new), `front-end/src/helpers/audioTime.test.ts` (new).

**Interfaces dự kiến:**

```ts
export function formatAudioTime(seconds: number): string;
export function getSeekDuration(duration: number): number | null;
export function clampAudioTime(seconds: number, duration: number): number;
```

- [ ] Viết test RED: `0 → 00:00`, `74.9 → 01:14`, `3601 → 01:00:01`; `NaN/Infinity` không tạo chữ số lỗi.
- [ ] Viết test duration: `NaN`, `Infinity`, `0`, số âm → `null`; `180` → `180`.
- [ ] Viết test clamp: dưới 0 → 0, vượt duration → duration, số không hợp lệ → 0; không cho ra `NaN`.
- [ ] Chạy `npm run test:unit -- src/helpers/audioTime.test.ts`; xác nhận RED có nguyên nhân hợp lệ, sau đó implement tối thiểu.
- [ ] Chạy lại unit/typecheck đạt, review diff và commit đúng files.

**Acceptance:** Helper thuần, không phụ thuộc React/DOM; output ổn định và xử lý số không hữu hạn an toàn.

### Task 2 — Seek timeline và đồng bộ trạng thái (TDD)

**Files:** `front-end/src/shared/components/media/AudioPlayer.tsx`, `front-end/tests/audio-player.spec.ts`.

- [ ] RED browser test: source có `preload="none"`, trước metadata hiển thị `00:00 / --:--` và slider **Tua âm thanh** disabled; không request audio khi chỉ mount.
- [ ] RED browser test: sau khi bấm Phát, duration từ WAV fixture xuất hiện, `currentTime` tăng, slider tiến theo native event.
- [ ] RED browser test: tua khi playing vẫn phát; tua khi paused vẫn paused; thao tác bằng Arrow/Home/End; Stop về 0.
- [ ] RED browser test: ended→tua về giữa không autoplay; source đổi/unmount reset timeline và không nhận sự kiện muộn của source cũ.
- [ ] RED browser test: source thiếu, HTTP 404/bytes hỏng, duration không hữu hạn → seek disabled, UI không có NaN; Retry vẫn dùng được.
- [ ] Implement state `currentTime`, `duration` theo native media events; `onChange` seek có guard/clamp, không gọi `play()`; `onSeeked` đồng bộ phụ đề kể cả khi paused.
- [ ] Chạy lại focused Playwright, helper Vitest và typecheck; review diff, commit.

**Acceptance:** Native `audio.currentTime` phản ánh thời điểm đã tua (không chỉ đổi slider); không phá Play/Pause/Resume/Stop/Retry/ended, pending promises và caption.

### Task 3 — Bố cục responsive và phụ đề (TDD)

**Files:** `front-end/src/shared/components/media/AudioPlayer.tsx`, `front-end/src/shared/components/media/AudioPlayer.module.css` (new), `front-end/tests/audio-player.spec.ts`.

- [ ] RED browser test: kiểm thứ tự hiển thị title/status → timeline/time → controls/volume → captions; nút Phát và Dừng nằm cùng nhóm.
- [ ] RED browser test: volume chỉ chiếm vùng gọn 100–140 px khi đủ rộng; seek full width không bị nhầm với volume.
- [ ] RED browser test: 320/375/768/1440 px ở light/dark không overflow; controls/slider keyboard, focus ring và hit area tối thiểu 44 px.
- [ ] RED browser test: tua qua cue VTT khi đang paused cập nhật phụ đề đúng; cue rỗng không chiếm hộp lớn; VTT 404 vẫn phát audio và hiện warning.
- [ ] Thực hiện layout bằng Mantine + CSS Module, spacing gọn và theme-aware; chỉ một vùng status live, error là alert.
- [ ] Chạy lại focused tests, fixture typecheck, lint, build; review diff và commit.

**Acceptance:** UI thống nhất ở 2D/panel tour/CMS preview do dùng cùng component; visual responsive, không thay public props và playback behavior.

### Task 4 — Regression, tài liệu và bàn giao

**Files:** `front-end/tests/public-audio.spec.ts` (chỉ khi cần assertion bổ sung), `front-end/README.md`, PLAN/TASK (ghi evidence thật).

- [ ] Chạy focused regression AudioPlayer, public audio và public image/audio; kiểm playback, VTT, lỗi media, one-guide policy và cleanup khi chuyển hiện vật/phòng.
- [ ] Chạy `npm run test:unit`, `npm run typecheck`, `npx tsc -p tsconfig.audio-fixture.json --pretty false`, `npm run lint`, `npm run build`; ghi đầy đủ passed/failed/skipped và warnings nếu có.
- [ ] Nếu sẵn backend/media live, chạy **read-only** live test; test hiện tại không tự chứng minh seek live — chỉ ghi seek live đã kiểm khi thật sự có assertion/tương tác và kết quả.
- [ ] Cập nhật README hướng dẫn seek, hiển thị duration khi `preload="none"`, keyboard, điều khiển âm lượng; không quảng cáo tính năng chưa làm.
- [ ] Review diff so với `dev`, `git diff --check`, cập nhật task evidence và commit (chỉ commit files thay đổi; không commit rỗng).
- [ ] Chuẩn bị mô tả PR vào `dev`; dừng trước push/PR/merge nếu chưa được yêu cầu.

**Acceptance:** Hành vi đã triển khai khớp tất cả tiêu chí ở mục 2; không có regression đã biết hoặc test bắt buộc đang fail. Báo cáo rõ những phần chưa test (nếu có).

## 5. Review focus / trường hợp dễ lỗi

1. Native `duration` chưa biết/Infinity → slider disabled, không ghi `currentTime` sai (Task 1–2).
2. Seek lúc paused/ended và VTT cue → đúng state, không autoplay, không kẹt phụ đề cũ (Task 2–3).
3. Nguồn audio đổi giữa lúc `play()` pending hoặc `seeked` chưa về → owner mới không bị ghi đè (Task 2).
4. Slider âm lượng và slider tua phải có tên độc lập, bàn phím/focus/hit-area hoạt động trên panel hẹp (Task 3).
5. Server không hỗ trợ Range/seek thật hoặc response lỗi → không giả vờ đã tua thành công; test live riêng nếu sẵn môi trường (Task 4).

## 6. Evidence sau triển khai

### Execution ledger

- Setup: fetch `origin/dev` thành công, HEAD vẫn `75df3ea`; hai tài liệu mới untracked thuộc nhiệm vụ được bảo toàn trên nhánh `fix/audio-player-seek-ui`.
- Pre-flight: Task 1 xuất ba helper thuần cùng chữ ký Task 2 cần; Task 3 chỉ đổi layout, props/caller không đổi. Task 4 regression chung xác nhận 2D/tour. Không có xung đột interface.
- Ruling: dùng checkout và nhánh riêng người dùng đã yêu cầu; ledger nằm ngay trong task theo mẫu repo, không tạo worktree hoặc Unix bookkeeping scripts thứ hai.
- CodeGraph transport đã đóng; đọc source trực tiếp khi công cụ không phản hồi. Không thay đổi/index lại graph.
