# AUDIO-01 — Task breakdown: Audio Player cơ bản

**Trạng thái:** Implemented — các task đã commit riêng trên `feat/audio-player-01`; chưa push/PR.
**Plan:** [audio-player-01-plan.md](../plans/audio-player-01-plan.md).
**Source đã khảo sát:** `dev` / `origin/dev` tại `8ffd808`; nhánh chung cho tài liệu và code `feat/audio-player-01`.
**Execution gate:** Dừng để người dùng review. Sau duyệt, kiểm tra lại origin/dev và tiếp tục trên chính nhánh `feat/audio-player-01`. Mỗi task hoàn thành và kiểm chứng đạt phải có một commit riêng theo yêu cầu người dùng; chưa push/PR.

Các checkbox trong từng task bên dưới là checklist thực thi được giữ lại để truy nguyên kế hoạch; trạng thái nghiệm thu cuối cùng và bằng chứng thực tế nằm ở phần **Evidence sau triển khai** và các commit tương ứng.

## Quy tắc chung

- Chỉ frontend: reusable `AudioPlayer({ src, label })`, native `<audio>`, Mantine/theme sẵn có.
- Không API/backend/schema/database/migration, không tích hợp trang hiện vật/tour, không thêm dependency.
- Chưa seek/duration/volume, autoplay, playlist, global playback policy hoặc hook/service dự phòng.
- Các task chạy tuần tự: **AUDIO-01.0 → AUDIO-01.1 → AUDIO-01.2 → AUDIO-01.3 → AUDIO-01.4 → AUDIO-01.5**; mỗi task đã hoàn thành và có commit riêng.
- Không copy AppProviders vào fixture vì sẽ kéo theo auth/API; chỉ dùng MantineProvider/theme.
- Mỗi task là một commit gồm thay đổi và test liên quan. Trước commit: xem `git status`, `git diff`, `git log --oneline -10`; review diff, kiểm tra secrets và chỉ stage file thuộc task. Không commit test đang fail, không squash các task hoặc tạo commit rỗng.
- Với mỗi task sửa frontend, chạy focused tests cùng typecheck/lint/build trước commit; từ khi có fixture config, chạy thêm typecheck fixture. Ghi bằng chứng vào task cùng commit; SHA có thể tra bằng git log, không amend để chèn SHA vào chính commit.

## AUDIO-01.0 — Chốt tài liệu thiết kế và task

**File:** `docs/plans/audio-player-01-plan.md`, `docs/tasks/audio-player-01.md`.
**Các bước:**
- [ ] Người dùng duyệt PLAN/TASK trước triển khai.
- [ ] Đối chiếu task mapping, public props và phạm vi; kiểm tra whitespace bằng `git diff --check` (file chưa track dùng `git diff --no-index --check -- NUL <file>` trên Windows).
- [ ] Review/stage đúng hai file và commit `docs(audio): plan basic player implementation`.
**Test:** Review tài liệu và whitespace; chưa cần chạy frontend vì chỉ thay Markdown.
**Acceptance:** Hai tài liệu nhất quán, không task thiếu file/test/acceptance; commit tài liệu ở cùng nhánh feature.

## AUDIO-01.1 — Component và happy path có media thật

**Mục tiêu:** Player độc lập phát/tạm dừng/tiếp tục và có trạng thái khi thiếu nguồn, kiểm thử được trên browser.

### File tác động

- Tạo `front-end/src/shared/components/media/AudioPlayer.tsx`.
- Tạo CSS Module cùng tên chỉ nếu cần reflow/target size ngoài Mantine props.
- Sửa `front-end/docs/coding-conventions.md`: bổ sung nhóm shared `media/`.
- Tạo `front-end/tests/fixtures/audio-player.html`, `audio-player.tsx`, `audioFixture.ts`.
- Tạo `front-end/tests/audio-player.spec.ts`.

### Interface

- Input: `AudioPlayerProps { src?: string | null; label?: string }`, default label **Thuyết minh audio**.
- Output: named export `AudioPlayer`; group có accessible name từ label, một nút Phát/Tạm dừng/Tiếp tục và status text; không callback hoặc ref public chưa có consumer.
- Fixture: mount player + nút test đổi/xóa nguồn và mount/unmount, không đăng ký route sản phẩm.

### Các bước thực hiện

- [ ] Đọc lại constraints/plan; thêm `media/` vào conventions, không tạo barrel.
- [ ] Tạo HTML/React fixture bằng MantineProvider/theme. Fixture nhận nguồn từ controls test, không dựng URL API.
- [ ] Tạo WAV helper bằng Buffer: RIFF/WAVE PCM mono 16-bit, sample rate 8000, 8 giây tone nhỏ; header có kích thước data và RIFF đúng. Playwright route trả Buffer với `audio/wav`.
- [ ] Viết test happy path trước: thiếu src disabled; có src không autoplay; click Phát làm native `paused === false` và `currentTime` tăng; Pause giữ mốc; Tiếp tục tăng từ mốc đã giữ.
- [ ] Chạy `npm test -- audio-player.spec.ts` từ frontend trên Vite dev; ghi nhận fail vì thiếu export/behavior, không coi lỗi server/fixture là RED hợp lệ.
- [ ] Implement props + `<audio preload="none">` qua ref, event props; `src?.trim()` rỗng không gán src. Chỉ cập nhật Đang phát sau `playing`; catch `play()` rejection ngay từ task này để không để promise nổi.
- [ ] UI Mantine có nhãn, icon trang trí, nút keyboard native cao ít nhất 44px và status text. Không `load()` hoặc `currentTime = 0` trong luồng Resume.
- [ ] Chạy lại focused test; xác nhận không có `/api/` request, không thay pages/router/package manifest.

### Test / acceptance criteria

- [ ] undefined, null, `''`, `'   '` đều hiện **Chưa có audio**, nút disabled, không gửi request URL trống/trang hiện tại.
- [ ] Có nguồn thì **Sẵn sàng phát**, native paused trước tương tác; không tự phát.
- [ ] Click Phát → Đang phát/Tạm dừng; `currentTime` thực tăng trên WAV decode thật.
- [ ] Click Tạm dừng → Đã tạm dừng/Tiếp tục; `currentTime` không tiếp tục tăng sau media pause settle.
- [ ] Click Tiếp tục → Đang phát, giữ mốc cũ rồi tăng; không phát lại từ đầu.
- [ ] Fixture chạy không backend và không cài thư viện mới.
- [ ] Chạy quality gates, review và commit `feat(audio): add basic play pause and resume player`.

## AUDIO-01.2 — Error, pending và ended/replay

**Phụ thuộc:** AUDIO-01.1.
**Mục tiêu:** Player báo lỗi đúng, chống bấm lặp khi pending và phát lại được sau kết thúc.

### File tác động

- Sửa `front-end/src/shared/components/media/AudioPlayer.tsx`.
- Mở rộng `front-end/tests/audio-player.spec.ts` và fixture AUDIO-01.1.

### Interface

- Giữ nguyên `AudioPlayerProps` và named export từ AUDIO-01.1.
- Không thêm exported controller/hook; giữ nguyên cách consumer truyền src.

### Các bước thực hiện

- [ ] Thêm test ended/replay bằng cách đặt native element gần cuối và chờ `ended` thật.
- [ ] Thêm route 404/byte audio hỏng; test báo lỗi inline, không báo đang phát và cho thử lại bằng click sau khi route trả WAV hợp lệ.
- [ ] Mock `HTMLMediaElement.prototype.play` trong các test riêng để trả rejected/pending promise. Kiểm tra không có unhandled rejection, nút không bị kẹt pending và không tạo nhiều request khi click lặp.
- [ ] Chạy focused test và xác nhận từng case fail đúng hành vi còn thiếu.
- [ ] Đồng bộ ended/error/pause để ended/error không bị pause event ghi đè. Retry thủ công sau media error gọi load rồi play; Resume bình thường không load.
- [ ] Chạy focused test và quality gates; review và commit `fix(audio): handle playback errors and replay`.

### Test / acceptance criteria

- [ ] Ended hiện **Đã phát xong**, nút Phát; click tiếp theo phát lại từ đầu.
- [ ] `play()` reject và media error hiện alert rõ nghĩa; không unhandled promise, không trạng thái playing giả.
- [ ] Khi pending, click lặp không khởi động nhiều play request; pending được giải phóng khi resolve/reject/error.
- [ ] Retry chỉ chạy sau click; không retry loop hoặc network fetch riêng.

## AUDIO-01.3 — Đổi nguồn và cleanup vòng đời

**Phụ thuộc:** AUDIO-01.2.
**Mục tiêu:** Ngừng nguồn cũ đúng lúc và bỏ kết quả promise cũ.
**File tác động:** `front-end/src/shared/components/media/AudioPlayer.tsx`, `front-end/tests/audio-player.spec.ts`, `front-end/tests/fixtures/audio-player.tsx`.
**Interface:** Giữ nguyên props; fixture cung cấp hai URL WAV, nút đổi/xóa nguồn và unmount/remount. Owner nội bộ được key theo src chuẩn hóa.

### Các bước thực hiện

- [ ] Viết test đổi/xóa src và unmount khi đang phát; giữ reference element cũ để kiểm tra pause và bỏ nguồn.
- [ ] Viết test resolve/reject play promise cũ sau đổi nguồn/unmount; ghi nhận fail đúng hành vi.
- [ ] Hoàn thiện cleanup pause/remove src/load; vô hiệu request token trước cleanup, bỏ cập nhật từ promise cũ; key owner theo nguồn chuẩn hóa.
- [ ] Test StrictMode setup/cleanup và remount không mất nguồn, không autoplay.
- [ ] Chạy focused test và quality gates; review và commit `fix(audio): clean up playback on source changes and unmount`.

### Test / acceptance criteria

- [ ] Đổi src trong lúc phát dừng nguồn cũ, nguồn mới ở Sẵn sàng phát/paused, không autoplay.
- [ ] Xóa src dừng audio, hiện Chưa có audio; nguồn cũ settle muộn không làm thay UI mới.
- [ ] Unmount dừng phát, tháo nguồn/tải; remount và StrictMode vẫn cho phát bình thường.

## AUDIO-01.4 — Accessibility, theme và fixture typecheck

**Phụ thuộc:** AUDIO-01.3.
**Mục tiêu:** Hoàn thiện kiểm chứng và hướng dẫn sử dụng, giữ đúng phạm vi reusable component.

### File tác động

- Sửa `front-end/tests/audio-player.spec.ts` và fixture nếu cần thêm tình huống long label/multiple instances.
- Sửa `AudioPlayer.tsx`/CSS Module chỉ để xử lý phát hiện liên quan trực tiếp accessibility/theme/lifecycle.
- Cập nhật task này với bằng chứng kiểm chứng thực tế.
- Tạo `front-end/tsconfig.audio-fixture.json` để typecheck TSX harness ngoài src.

### Các bước thực hiện

- [ ] Kiểm tra Tab/Enter/Space, focus ring, nút có tên đúng trạng thái, status live polite, lỗi inline alert và target tối thiểu 44px.
- [ ] Test light/dark ở 320/768/1440px với label dài; assert không overflow ngang và nội dung/nút vẫn nhìn thấy. Không hardcode palette chỉ đọc được trên PublicLayout.
- [ ] Mount hai player trong fixture, xác nhận thao tác một instance không đổi state instance còn lại; không thêm global policy.
- [ ] Tạo `front-end/tsconfig.audio-fixture.json` như dưới đây. App config hiện có noEmit, JSX react-jsx, alias và vite/client types; imports tự kéo component/theme vào typecheck. Không thay build inputs.

```json
{
  "extends": "./tsconfig.app.json",
  "include": ["tests/fixtures/audio-player.tsx"]
}
```
- [ ] Chạy các lệnh dưới đây, lưu output/exit code; sửa lỗi trong phạm vi player nếu có rồi chạy lại gate bị ảnh hưởng.

```powershell
# Working directory: front-end; PLAYWRIGHT_PREVIEW và MUSEUM_LIVE_TEST unset.
npm run typecheck
npx tsc -p tsconfig.audio-fixture.json --pretty false
npm run lint
npm run build
npm test -- audio-player.spec.ts
```

- [ ] Review toàn bộ diff, không sửa API/page/router, không dependency mới, không artifact/fixture audio bản quyền hoặc output build lọt vào diff.
- [ ] Cập nhật bằng chứng, review và commit `test(audio): verify keyboard theme and isolated instances`.

### Test / acceptance criteria

- [ ] Keyboard và status/alert dùng được; không chỉ dựa vào icon/màu.
- [ ] Responsive light/dark không overflow; MantineProvider/theme là dependency UI duy nhất của fixture.
- [ ] Nhiều instance độc lập; không global store hoặc single-playback manager.
- [ ] Typecheck app + fixture, lint, build và focused browser tests đều có output đạt, hoặc báo rõ blocker thay vì đánh dấu hoàn thành.
- [ ] Public interface giữ nguyên; việc thêm duration/seek/volume sau này có thể dùng native element hiện có mà không đổi cách consumer truyền src.

## AUDIO-01.5 — Hướng dẫn sử dụng và báo cáo nghiệm thu

**Phụ thuộc:** AUDIO-01.4.
**File tác động:** `front-end/README.md`, hai tài liệu AUDIO-01.
**Các bước:**
- [ ] README có ví dụ import từ `@/shared/components/media/AudioPlayer`, props src/label và hướng dẫn local file có quyền sử dụng đặt trong public, truyền URL root-relative.
- [ ] Ghi rõ `/audio-fixture.wav` chỉ tồn tại qua Playwright route; fixture chạy dev, không trong production Rollup inputs. Không ghi build pass thành browser-test production.
- [ ] Ghi kết quả thực tế, giới hạn, trạng thái từng task và commit bằng `git log --oneline`; không đánh dấu test chưa chạy là pass.
- [ ] Review toàn diff so với base, đối chiếu đủ yêu cầu và kiểm tra Markdown/whitespace; không chạy lại tests chỉ vì sửa docs nếu không có thay đổi runtime mới.
- [ ] Commit `docs(audio): document usage and verification evidence`, báo cáo rồi dừng; chưa push/PR.
**Test:** Kiểm tra đường dẫn/import/ví dụ khớp source; rà bằng chứng các gate từ AUDIO-01.4; `git diff --check`.
**Acceptance:** README phản ánh standalone component chưa tích hợp API/trang hiện vật; mỗi task có commit riêng và bằng chứng phù hợp, không có commit gộp toàn feature.

## Review gate hiện tại

- [x] Đã đọc AGENTS.md/conventions/source dev và xác định vị trí shared media.
- [x] Đã viết plan và chia task có bước/file/test/acceptance.
- [x] Đã tự review phạm vi và các failure paths trong kế hoạch.
- [x] Người dùng duyệt PLAN/TASK.
- [x] Bắt đầu implementation sau duyệt.

## Evidence sau triển khai

- AUDIO-01.0: `cdcf78e` — `docs(audio): plan basic player implementation`.
- AUDIO-01.1: `0ef7c6d` — `feat(audio): add basic play pause and resume player`; focused test **2 passed**.
- AUDIO-01.2: `011854f` — `fix(audio): handle playback errors and replay`; focused suite **5 passed**.
- AUDIO-01.3: `8a9c99c` — `fix(audio): clean up playback on source changes and unmount`; focused suite **8 passed**.
- AUDIO-01.4: `f8229dd` — `test(audio): verify keyboard theme and isolated instances`; focused suite **10 passed**, app/fixture typecheck, lint và build đạt.
- AUDIO-01.5: README/PLAN/TASK và bằng chứng nghiệm thu; commit docs cuối được tạo sau review diff.
- Build có cảnh báo bundle chunk lớn hơn 500 kB, không phát sinh từ audio player và không chặn build.
- Chưa chạy full Playwright/live API/thiết bị hoặc GPU thật; component chưa tích hợp trang chi tiết hiện vật.

**Kết thúc phiên AUDIO-01:** component và fixture đã triển khai, mỗi task có commit riêng; chưa push/PR/merge.
