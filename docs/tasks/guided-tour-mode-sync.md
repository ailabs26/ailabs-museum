# Guided Tour 2D ↔ 3D — Task Breakdown & Acceptance

> **Trạng thái:** IMPLEMENTED — local gates và các suite hồi quy hoàn tất; xem execution ledger cuối tài liệu để biết kết quả và phần còn thiếu.
>
> **PLAN:** [`../plans/guided-tour-mode-sync-plan.md`](../plans/guided-tour-mode-sync-plan.md)
>
> **Base audit:** `origin/dev` SHA `dcbb814141bef3ed547f0893edb701c4d9407771`, fetch ngày 11/11/2026; branch HEAD khởi tạo cùng SHA.

**Branch:** `feat/guided-tour-mode-sync` → PR vào `dev` khi được yêu cầu; hiện chưa push/tạo PR.
**Mục tiêu:** Một phiên Guided Tour duy nhất có thể chuyển chủ động giữa 2D và 3D, không mất current step, đồng hồ 3D không chạy ở 2D và Resume phải được người dùng quyết định.

## 1. Nguyên tắc thực thi

- Mỗi task là một checkpoint độc lập, giữ commit nhỏ đủ để review; không buộc mỗi task tạo commit nếu không có thay đổi thực.
- Không tạo session/reducer thứ hai; reuse `MuseumProvider` và `useGuidedTour`.
- React Router route chỉ thay đổi do hành động rõ ràng, không dùng effect tự ép URL về Core.
- Tất cả tests là browser fixture trừ khi ghi rõ live API; không ghi database thật.
- **Mọi checkpoint ban đầu là `TODO`; kết quả PASS chỉ điền sau khi chạy thực tế** và lưu command/exit/log.
- Không sửa camera collision/GLB loader/media/backend/CMS nếu không có lỗi liên quan được tái hiện.

## 2. Tasks and acceptance

Checklist bên dưới ghi hợp đồng ban đầu; trạng thái thực thi hiện tại có trong verification matrix và execution ledger ở phần 3–4.

| Task | Checkpoint | Commit gợi ý |
| --- | --- | --- |
| 00 | Fetch, baseline, khóa contract/branch | `docs(tour): plan cross-mode guided journey` |
| 01 | Dwell coordinator và unit tests | `feat(tour): preserve dwell across public routes` |
| 02 | Chuyển mode có intent và helper route | `feat(tour): add explicit mode transition adapter` |
| 03 | Gắn 3D arrival/camera/timer với coordinator | `feat(tour): coordinate guided camera lifecycle` |
| 04 | 2D → 3D flow | `feat(tour): continue guided tour in 3d` |
| 05 | 3D → 2D + renderer fallback | `feat(tour): continue guided tour in 2d` |
| 06 | URL history/CMS/locale/StrictMode hardening | `fix(tour): guard cross-mode transitions` |
| 07 | i18n + responsive/accessibility | `feat(i18n): label guided mode switching` |
| 08 | Browser E2E + regression | `test(tour): cover cross-mode guided journey` |
| 09 | Full verification và PR handoff | `docs(tour): record cross-mode verification` |

## Task 00 — Baseline và hợp đồng thiết kế

**Files:** Plan/Task, source audit; chưa sửa runtime.

- [ ] `git fetch origin`, xác nhận SHA `origin/dev` mới nhất, kiểm tra `git status --short`; tạo branch `feat/guided-tour-mode-sync` từ base sạch.
- [ ] Đọc `AGENTS.md`, FE conventions, Core/2D/3D code, SceneFallback, ExhibitDetailPanel, React Router và Playwright fixtures.
- [ ] Chạy baseline `typecheck`, `lint`, `unit`, `build`; chạy focused 2D/3D/Core tests; ghi pass/fail/skip, browser/OS.
- [ ] Chốt ma trận chuyển mode: chuyển chủ động → Pause trước navigate; Resume không tự động; 2D manual reading; giữ dwell 3D theo currentStep.
- [ ] Ghi kiến trúc final và các điểm code thực sự phải chỉnh trước commit.

**Acceptance:** Có base SHA thực, baseline logs và không ghi nhầm kết quả lịch sử là kết quả hiện tại.

## Task 01 — Dwell owner sống qua public routes

**Files đề xuất:** `front-end/src/helpers/guidedDwellClock.ts` (+ `.test.ts`), `front-end/src/contexts/MuseumContext.tsx` hoặc hook coordinator tương đương.

- [ ] Viết unit RED cho `remainingMs` ban đầu 15.000, snapshot sau elapsed, pause/resume nhiều lần, zero remaining, stale timer và step thay đổi.
- [ ] Thiết lập timer metadata được sở hữu tại một nơi **không unmount khi đổi 2D/3D**.
- [ ] Khóa theo session/step ID; reset khi bước thay đổi; reorder cùng ID không reset; Exit/invalidation hủy.
- [ ] Không đưa deadline/RAF vào render cycle; không dispatch React state mỗi frame.
- [ ] Unit GREEN + typecheck + diff check.

**Acceptance:** Dwell được bảo toàn xuyên route; một timer hợp lệ tại một thời điểm; unmount hoặc token cũ không gọi `next()`.

## Task 02 — Explicit mode-transition contract

**Files đề xuất:** `front-end/src/hooks/useGuidedModeTransition.ts`, helper URL/intent kèm unit tests (nếu có).

- [ ] Viết contract `to3D`/`to2D` chỉ cho session hợp lệ cùng phòng, target ID từ `currentStep`.
- [ ] Dispatch Pause/snapshot dwell **trước** route change, tránh phụ thuộc effect cleanup muộn.
- [ ] URL 3D giữ `?room=<slug>&exhibit=<uuid>`; URL 2D giữ canonical `/collection/:roomSlug/exhibits/:exhibitId`.
- [ ] Không gọi `start()` khi chuyển mode; không auto `resume()` ở destination; không tự fullscreen/XR.
- [ ] Non-tour deep link vẫn hoạt động như cũ; room mismatch và URL drift không bị ép điều hướng.
- [ ] Unit tests cho URL encoding, invalid room/step, double-click/duplicate transition và public navigation.

**Acceptance:** Không mất session và không có auto-redirect loop từ effect.

## Task 03 — 3D camera lifecycle và timer

**Files:** `front-end/src/hooks/useGuidedCameraTour.ts`, chỉ những context/helper cần thiết; tests liên quan.

- [ ] Tích hợp arrival với dwell coordinator; bắt đầu countdown sau `arrived`, không đếm trong `moving`/`blocked`.
- [ ] Pause/hidden/close scene/XR teardown giữ `remainingMs`, không Next sau cleanup.
- [ ] Resume trong 3D chỉ sau thao tác người dùng và camera-ready; nếu cần replan, chờ arrival rồi mới chạy thời gian còn lại.
- [ ] Giữ thời lượng 15 giây khi bước mới; giữ remaining khi cùng currentStep sau đổi locale/reorder.
- [ ] Test clock fake phải cài sau renderer sẵn sàng, không gây flaky baseline.

**Acceptance:** 3D auto-dwell hiện tại không regress; không double-advance, không Next khi ở 2D.

## Task 04 — Chuyển 2D → 3D

**Files:** `front-end/src/pages/client/ExhibitDetailPage.tsx`, `front-end/src/components/museum/GuidedTour2DControls.tsx` (nếu đặt nút tại controls), adapter/hook.

- [ ] Thêm hành động rõ nghĩa **Tiếp tục trong 3D** khi đang có Guided Tour hợp lệ.
- [ ] Giữ generic link `Xem trong không gian 3D` như cũ khi không có tour.
- [ ] Với tour running/paused, Pause trước navigate; link trỏ đúng `currentStep`, không phải URL lệch bước.
- [ ] Trang `/tour` hiển thị phòng và ID đúng, **không tự mở fullscreen/WebXR** hoặc tự chạy camera.
- [ ] Chỉ cho người dùng Resume sau khi scene đã ready; vẫn có đường đọc 2D khi thiếu WebGL.

**Acceptance:** AC-01, AC-07, AC-11 (điều hướng và non-tour path) PASS.

## Task 05 — Chuyển 3D → 2D và fallback

**Files:** `front-end/src/pages/MuseumPage.tsx`, `GuidedTourBar.tsx`, `ExhibitDetailPanel.tsx`, `SceneFallback.tsx` nếu thật sự cần.

- [ ] Thêm hành động **Tiếp tục trong 2D** khi session active; target ID từ `guided.tour.currentStep`.
- [ ] Hủy camera/timer/owner trước navigate; giữ Core session và trạng thái paused.
- [ ] Điều hướng Detail có nội dung công khai; giữ locale; không autoplay audio.
- [ ] Fallback WebGL/scene lỗi: thoát 3D an toàn, giữ session nếu còn phòng/step, mở 2D với focus hợp lý.
- [ ] Đảm bảo luồng mode transfer không gọi `handleSelectDisplay` (vì hiện có `guided.tour.exit()`).

**Acceptance:** AC-02, AC-03 và AC-09 PASS; nếu `idle`, link đọc 2D hiện có vẫn bình thường.

## Task 06 — State/route/CMS/StrictMode hardening

**Files:** adapter(s), coordinator, chỉ sửa reducer nếu phát hiện invariant không thể giữ bằng Core.

- [ ] Browser Back/Forward, direct link, URL mismatched: không ép URL về step, recovery có lựa chọn.
- [ ] Chuyển phòng trong lúc tour active: không gắn currentStep phòng A lên phòng B.
- [ ] CMS reorder giữ ID & remaining; remove bước hiện tại → Core fallback/paused và reset dwell step mới; phòng rỗng → idle.
- [ ] Lỗi API tạm không invalidate session; refresh thành công mới quyết định room removal.
- [ ] StrictMode dev mount/unmount và double-click không nhân đôi timer; hidden-tab pause được covered trong dedicated E2E.
- [ ] Không thay `handleSelectDisplay` manual selection behavior nếu không có test chứng minh cần thay.

**Acceptance:** AC-04, AC-06, AC-07, AC-08 và AC-11 PASS.

## Task 07 — i18n, accessibility và responsive

**Files:** nhãn/chữ dự phòng 6 ngôn ngữ, component CSS nếu cần; cập nhật seed UI keys nếu chọn dùng CMS keys.

- [ ] Các action mode chuyển đổi, trợ giúp và trạng thái có fallback `vi/en/fr/zh/ko/ja` chuẩn.
- [ ] Nếu dùng `t('ui.*')`, bổ sung đủ key vào backend seed và chạy `test:seed`/kiểm tra snapshot; không âm thầm để thiếu translation keys.
- [ ] Keyboard + focus: nhấn link từ 2D tới 3D, mở scene, Resume, quay lại Detail focus hợp lý; không cướp focus khi Back.
- [ ] Kiểm thử 320×568, 390×844, desktop, zoom 200%, theme, reduced motion; không che audio/tour bar.
- [ ] Đổi locale giữa route không tự reset currentStep/dwell.

**Acceptance:** AC-10 PASS; không tuyên bố NVDA/VoiceOver nếu chưa chạy thiết bị thật.

## Task 08 — E2E browser và regression

**Files:** `front-end/tests/guided-tour-mode-sync.spec.ts`, fixtures và các test liên quan nếu thực sự cần.

- [ ] Test 2D → 3D: đúng step, chờ Open 3D/Resume; không tự start 3D từ URL.
- [ ] Test 3D → 2D khi `viewing`, `moving`, `blocked` và `paused`; không mất session, không Next sau navigation.
- [ ] Fake clock: xem 5 giây → chuyển 2D 30 giây → về 3D → camera arrived → còn ~10 giây trước Next.
- [ ] Test Next/Previous, Complete, Exit, reconnect, CMS reorder/removal, locale, history và multiple transfers.
- [ ] Chạy affected `guided-tour-2d`, `guided-tour-camera`, `guided-tour-core`, `museum-immersive-ui`, `museum-xr`, `public-visitor-journey`, `public-locale`, `exhibit-detail`.
- [ ] Dùng API fixture, không ghi DB thật; sửa test theo root cause, không nới assertion để che failure.

**Acceptance:** Dedicated suite PASS; affected suites PASS hoặc có bằng chứng FAIL/SKIP rõ ràng và triage. Không tuyên bố all-regression PASS nếu không chạy đủ.

## Task 09 — Verification & PR handoff

**Files:** Plan/Task verification section, docs evidence nếu cần, đúng scoped source files.

- [ ] Từ `front-end/` chạy `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`.
- [ ] Chạy focused + affected E2E, lưu command, runtime, OS/Edge/Chromium, counts và exit codes.
- [ ] Review screenshots/recordings desktop/mobile, accessibility bằng browser; phân biệt automated và thiết bị thật.
- [ ] `git diff --check`; review diff `origin/dev...HEAD`; bảo đảm không lộ `.env`, secrets, media/test-results hoặc sửa ngoài scope.
- [ ] Update docs status và execution ledger (actual SHA); tách rõ kết quả local vs CI.
- [ ] Chỉ push/tạo PR vào `dev` khi được yêu cầu; không tự merge.

**Acceptance:** Mọi điều kiện được hỗ trợ bằng evidence thật; các giới hạn và future work minh bạch.

## 3. Verification matrix

| Gate | Trạng thái | Bằng chứng cần có |
| --- | --- | --- |
| Source audit và branch | PASS | SHA `dcbb814141bef3ed547f0893edb701c4d9407771`, branch `feat/guided-tour-mode-sync`. |
| Dwell clock unit | PASS | 3 helper tests; unit suite 331/331. |
| 2D→3D | PASS | Route/current step/paused state; scene chờ thao tác mở và Resume. |
| 3D→2D | PASS | Viewing/moving/blocked và WebGL fallback giữ step, paused state. |
| Countdown across modes | PASS | 5s dwell → 30s 2D → 9s chưa Next → sau arrival còn 2s mới sang bước. |
| StrictMode/cancel/late callback | PARTIAL | Cancellation, stale callback và hidden-tab pause có coverage; chưa có E2E riêng cho StrictMode dev double-mount. |
| URL/CMS/locale/data changes | PASS | History, CMS reorder/removal, locale và public regressions qua. |
| Keyboard/mobile/focus | PARTIAL | Keyboard/narrow viewport/reduced-motion qua; chưa kiểm tra zoom 200%, screen reader hoặc thiết bị thật. |
| 2D/3D/Core affected regression | PASS | 68/68 trên Chromium software WebGL. |
| Typecheck / Lint / Unit / Build | PASS | 331 unit tests; build exit 0 với cảnh báo chunk >500 kB. |
| Diff review | PASS | `git diff --check` sạch; FE guided tour/tests/docs. |
| PR | NOT CREATED | URL, target dev, reviewers |

## 4. Execution ledger — 11/11/2026

Các checklist phía trên là tiêu chí ban đầu; bảng này ghi trạng thái chạy thực tế. `git diff --check` sạch và `git merge-base HEAD origin/dev` trả về `dcbb814141bef3ed547f0893edb701c4d9407771`.

| Hạng mục | Kết quả |
| --- | --- |
| Baseline | Typecheck/lint/unit (327 tests)/build qua trước khi sửa; focused Playwright baseline chưa chạy. |
| Typecheck / lint | PASS, exit code 0. |
| Unit | PASS: 56 files, 331 tests. |
| Build | PASS, exit code 0; Vite cảnh báo bundle >500 kB (main 1,109 kB, Three fiber 821 kB, ApexCharts 544 kB). |
| Dedicated cross-mode E2E | PASS: 7/7 trên Chromium software WebGL; gồm current step, pause/resume, moving, blocked, hidden-tab pause, 5s+30s dwell và repeated WebGL fallback. |
| Regression E2E | PASS: 68/68, 9.1 phút trên Chromium software WebGL; 8 suite theo Task 08. |
| Edge | Lượt Edge trước đó gặp lỗi khởi tạo WebGL trong immersive tests; Chromium là browser của lượt PASS đầy đủ. |
| Browser visual review | Preview local mở được nhưng API không kết nối nên trang không có data động; UI state được kiểm tra qua Playwright fixtures. |
| Accessibility | Keyboard/narrow viewport, locale, reduced-motion, hidden-tab và nhiều viewport có regression tự động; chưa kiểm tra zoom 200%, screen reader hoặc thiết bị thật. StrictMode dev double-mount chưa có E2E riêng. |
| PR / push / merge | Chưa thực hiện; chỉ làm khi được yêu cầu. |

Local preview dùng `http://127.0.0.1:4173/collection?room=sculpture`; nó báo API không kết nối được. Không có backend/database nào được thay đổi trong task này.

**Không thuộc phạm vi:** Audio đa ngôn ngữ, autoplay, persistence reload/cross-tab, data migration, backend API, thay thuật toán camera. Chưa push, tạo PR hoặc merge.
