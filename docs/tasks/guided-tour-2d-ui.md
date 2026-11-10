# F06 — Guided Tour 2D UI — Task Breakdown & Acceptance

> **Trạng thái:** IMPLEMENTED — toàn bộ 2D acceptance và frontend gates đạt; một test camera 3D trong affected suite chập chờn, xem verification matrix. Chưa push/PR/merge.
>
> **PLAN:** [`../plans/guided-tour-2d-ui-plan.md`](../plans/guided-tour-2d-ui-plan.md)
> **Repository:** `ailabs26/ailabs-museum`
> **Source audit:** `origin/dev` = `7cd44365b0b3801f31d2517edc5fbd4a734731b8` (fetch ngày 10/11/2026).
> **Branch:** `feat/guided-tour-2d-ui` từ `origin/dev`.

## 1. User story, phạm vi và nguyên tắc

Là khách tham quan, tôi muốn bắt đầu Guided Tour trong phòng 2D và đọc các hiện vật theo **thứ tự đã xuất bản**, tự Next/Previous, Pause/Resume, theo dõi tiến độ và Exit mà không mất các chức năng Detail đang có.

- `MuseumProvider`/`useGuidedTour()` hiện hữu là nguồn state duy nhất; không tạo tour reducer mới.
- **2D chuyển bước bằng thao tác người dùng**, không tự Next sau 15 giây hay autoplay. Next/Previous khi paused vẫn theo semantics Core.
- Không thay camera/XR/dwell 3D (F07), không xử lý cross-mode 2D↔3D (F08), không thêm API/DB/migration.
- Các checkbox dưới đây chỉ được đánh dấu sau khi triển khai và có bằng chứng thực tế.

## 2. Tổng quan task và commit

| Task | Mục tiêu | Commit đề xuất |
| --- | --- | --- |
| 00 | Baseline, branch, chốt Plan/Task | `docs(tour): plan guided 2d visitor flow` |
| 01 | Adapter Core ↔ React Router và unit test | `feat(tour): add guided 2d navigation adapter` |
| 02 | Start/Continue/Exit từ Collection | `feat(tour): start guided 2d tours from collection` |
| 03 | Guided Tour 2D controls và progress | `feat(tour): add guided 2d exhibit controls` |
| 04 | Tích hợp Detail, deep link, hoàn thành | `feat(tour): wire exhibit details to guided steps` |
| 05 | Back/Forward, manual route, CMS refresh | `fix(tour): guard guided 2d lifecycle and route drift` |
| 06 | Đa ngôn ngữ, mobile, keyboard, accessibility | `feat(i18n): localize guided 2d controls` |
| 07 | Playwright E2E và regression | `test(tour): cover guided 2d visitor journey` |
| 08 | Full gates, verification và bàn giao PR | `docs(tour): record guided 2d verification` |

Mỗi task là commit riêng khi có thay đổi độc lập đáng review; không tạo commit rỗng. Có thể gộp test cùng code để mỗi commit chạy được.

## 3. Task 00 — Baseline và khóa phạm vi

**File:** `docs/plans/guided-tour-2d-ui-plan.md`, `docs/tasks/guided-tour-2d-ui.md`.

- [x] `git fetch origin`; kiểm tra `git status --short`; tạo `feat/guided-tour-2d-ui` từ `origin/dev` mới nhất và ghi lại SHA thật.
- [x] Đọc `AGENTS.md`, coding conventions, F05/F07 plans, `MuseumContext`/reducer/hooks, route, Collection/Detail và browser fixtures.
- [x] Chạy baseline typecheck, lint, unit, build; chạy regression tối thiểu Collection, Detail, Core và 3D; ghi lỗi có sẵn, exit code và môi trường.
- [x] Chốt: không sửa production 3D, backend, DB, audio autoplay, timer 2D hoặc cross-mode F08.
- [x] Commit plan/task với trạng thái chính xác.

**Acceptance:** nhánh sạch, base chính xác, source và giới hạn nhiệm vụ được đối chiếu.
**Commit:** `docs(tour): plan guided 2d visitor flow`.

## 4. Task 01 — Adapter điều khiển và điều hướng

**File dự kiến:** `front-end/src/hooks/useGuidedTour2D.ts`; nếu cần, `front-end/src/helpers/guidedTour2dNavigation.ts` và `.test.ts`.

- [x] Gọi `useGuidedTour()` hiện hữu; không lưu session, status hay index riêng.
- [x] Tạo Detail URL chuẩn từ `roomSlug`, `exhibitId` hợp lệ, encode slug đúng; không dựng URL theo title bản dịch.
- [x] Thiết kế commands có intent rõ: Start phòng, Start từ hiện vật, Next, Previous, Pause, Resume, Exit, Restart.
- [x] Route chỉ thay đổi khi có **explicit guided action**; không `useEffect` redirect theo `currentStep` trên mọi render.
- [x] Next tại bước cuối chỉ completed; Previous đầu no-op; Resume từ URL lệch bước quay về step hiện tại có chủ đích.
- [x] Chống double click và state snapshot cũ; tránh duplicate navigation/dispatch trong StrictMode.
- [x] Unit test 0/1/N, completed, ID không hợp lệ, slug đặc biệt, rapid navigation.

**Acceptance:** Core step, URL Detail và hành động người dùng nhất quán, không redirect do locale/refetch.
**Commit:** `feat(tour): add guided 2d navigation adapter`.

## 5. Task 02 — Start/Continue/Exit trong Collection

**File:** `front-end/src/pages/client/CollectionPage.tsx` và `.module.css` nếu cần.

- [x] Bổ sung CTA Start trong header của phòng chọn, cạnh link 3D cũ; không xóa/tác động link 3D.
- [x] Phòng rỗng: không cho Start, có lời giải thích dễ hiểu.
- [x] Start đi tới hiện vật đầu theo `sortForTour`/Core, không theo search/favorites/filtered grid.
- [x] Nếu đã có tour đúng phòng: Continue đến step đang giữ, Exit; khác phòng chỉ thay tour khi người dùng chủ động Start mới.
- [x] Không thay search, favorites, comparison, report, global search và room filter.
- [x] Playwright: start 0/1/N, phòng đang chọn, filter, locale cơ bản, URL sau Start.

**Acceptance:** khách vào tour 2D từ Collection mà duyệt bình thường vẫn không đổi hành vi.
**Commit:** `feat(tour): start guided 2d tours from collection`.

## 6. Task 03 — Component điều khiển 2D

**File dự kiến:** `front-end/src/components/museum/GuidedTour2DControls.tsx`, `.module.css`.

- [x] Component chỉ nhận snapshot/handler; không tự gọi API, router hay tự sở hữu session.
- [x] Hiển thị bước `n/N`, tên hiện vật hiện tại, progress, trạng thái idle/running/paused/completed.
- [x] Nút có nhãn đầy đủ: Previous, Pause/Resume, Next, Exit, Restart khi hoàn thành; disabled chính xác tại biên.
- [x] Next tại bước cuối thực hiện completed, không wrap; Previous khi completed phù hợp state Core.
- [x] Có region được đặt tên, `role=status`/`aria-live=polite`, progress có accessible name/giá trị, focus-visible và thứ tự Tab logic.
- [x] Dùng Mantine, Aura CSS tokens, bố cục bình thường không fixed/sticky đè lên audio.

**Acceptance:** controls đọc được, tương tác được bằng chuột, bàn phím và touch; status/progress khớp Core.
**Commit:** `feat(tour): add guided 2d exhibit controls`.

## 7. Task 04 — Tích hợp Exhibit Detail

**File:** `front-end/src/pages/client/ExhibitDetailPage.tsx`, CSS module khi cần.

- [x] Direct link hiện vật public hợp lệ: có hành động **Start từ hiện vật này**; không auto-start khi mở URL.
- [x] Hiển thị Guided Tour controls khi URL khớp step hiện tại của session cùng phòng.
- [x] Next/Previous đổi route Detail, giữ focus heading hiện tại; không phá Media, Transcript, Report, Favorite, Reading Controls.
- [x] Step cuối: completed không đổi sang URL khác, giữ chi tiết cuối; Restart từ đầu chỉ theo click người dùng.
- [x] Khi không có session, Detail vẫn là trang đọc bình thường và không có redirect.

**Acceptance:** thực hiện trọn quy trình tour 2D bằng các trang Detail hiện hữu.
**Commit:** `feat(tour): wire exhibit details to guided steps`.

## 8. Task 05 — Browser history, dữ liệu public và lifecycle

**File:** adapter và các page liên quan, chỉ thêm helper/tests khi thật cần.

- [x] Browser Back/Forward, QR/deep link, click hiện vật ngoài tour không bị tour effect ghi đè.
- [x] Khi URL không trùng step hiện tại: pause khi phù hợp, hiển thị Resume-to-step/Exit; không redirect âm thầm.
- [x] `reconcileRoom()` chỉ cho kết quả public hợp lệ và đúng `roomId`; reorder giữ ID, không reset khi chỉ đổi locale.
- [x] Khi hiện vật hiện tại bị gỡ: dùng fallback của Core, paused, hiển thị phục hồi; không render draft.
- [x] Room không còn public: chỉ invalidate trên kết quả public-list thành công, không trên lỗi mạng/tải lại.
- [x] Kiểm tra rapid clicks, route unmount, StrictMode, request cũ trả chậm, đổi phòng và ranh giới 3D.

**Acceptance:** không có navigation loop, stale ID, mất phiên không chủ đích hoặc auto-select sai phòng.
**Commit:** `fix(tour): guard guided 2d lifecycle and route drift`.

## 9. Task 06 — i18n, accessibility và responsive

**File:** controls/CSS và helper nhãn riêng nếu cần, kèm test.

- [x] Tái sử dụng `GUIDED_TOUR_MESSAGES` cho label chung; nhãn 2D bổ sung fallback **vi/en/fr/zh/ko/ja**, tương thích `t()` và CMS override.
- [x] Khi đổi locale: controls/content thay ngôn ngữ, nhưng session, current ID, index và URL không đổi.
- [x] Test 320×568, 390×844, desktop, zoom 200%: không tràn/che audio dock, button vẫn bấm được.
- [x] Test keyboard: Tab, aria-label, role status/progress, focus heading sau Next/Previous, tương phản theo theme.
- [x] Không thêm hotkey toàn cục; không tự play audio, không ép animation khi reduced-motion.

**Acceptance:** giao diện ổn định, hỗ trợ 6 locale và không gây cản trở đọc/tiếp cận.
**Commit:** `feat(i18n): localize guided 2d controls`.

## 10. Task 07 — Playwright acceptance và regression

**File dự kiến:** `front-end/tests/guided-tour-2d.spec.ts`, fixture có sẵn (chỉ chỉnh nếu thực sự cần).

- [x] Browser test trọn luồng: Start từ Collection → Detail → Next → Previous → Pause/Resume → Completed → Restart/Exit.
- [x] Bổ sung deep-link Start, phòng 0/1, thứ tự CMS khác thứ tự grid, filter, history, URL lệch bước, đổi phòng.
- [x] Kiểm tra CMS reorder/removal, transient error, 6 locale, mobile, React StrictMode, không autoplay.
- [x] Mock API xác định, không POST ra live API; tránh `waitForTimeout`, assert trạng thái/URL và focus thay vì ngủ chờ.
- [x] Chạy affected suites: Collection, Detail, Guided Tour Core, Public Locale, Visitor Journey và 3D Camera.
- [x] Đánh giá CI E2E hiện tại: nếu thêm smoke 2D ngắn mà vẫn giữ timeout 15 phút thì cập nhật; full Guided Tour E2E CI mở rộng nằm trong F09.

**Acceptance:** browser suite PASS với exit code 0, không bỏ test/giảm assertion cho xanh giả; không regress 2D hoặc 3D.
**Commit:** `test(tour): cover guided 2d visitor journey`.

## 11. Task 08 — Full verification và PR handoff

**File:** 2 tài liệu plan/task + chỉ những sửa nhỏ trong phạm vi nếu phát hiện thật.

- [x] Chạy từ `front-end/`: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`.
- [x] Chạy E2E F06 và affected; ghi lệnh/OS/browser/mock-mode/PASS-FAIL-SKIP/exit code rõ ràng, lưu trace khi lỗi.
- [x] Kiểm tra desktop/mobile screenshot và keyboard/focus; ghi rõ giới hạn đối với thiết bị thật/NVDA/VoiceOver.
- [x] Rà `git diff origin/dev...HEAD`, `git diff --check` và staged files; không backend/DB/3D camera/out-of-scope.
- [x] Cập nhật Plan/Task/commit ledger theo bằng chứng; chỉ đánh DONE khi kiểm chứng thực.
- [ ] Chuẩn bị PR title EN + mô tả VN Markdown, base `dev`; push/mở PR khi được yêu cầu và không tự merge.
- [x] Ghi chú phần F08 còn lại: chuyển mode chưa đồng bộ toàn bộ trạng thái/timer/selection.

**Acceptance:** bộ F06 đủ bằng chứng, commit nhỏ và review được, không có kết luận PASS suy đoán.
**Commit:** `docs(tour): record guided 2d verification`.

## 12. Verification matrix (điền khi triển khai)

| Gate | Trạng thái hiện tại | Evidence/lệnh dự kiến |
| --- | --- | --- |
| Baseline trước F06 | PASS | Base `7cd4436`; baseline typecheck/lint/unit/build đã chạy trước code; ghi nhận trong execution record |
| Unit adapter + locale fallback | PASS | `guidedTour2dNavigation.test.ts`, `guidedTour2dMessages.test.ts`; full 55 files / 327 tests |
| Guided Tour 2D E2E | PASS | `npx playwright test tests/guided-tour-2d.spec.ts --reporter=line` — 11/11 |
| CMS order/history/room recovery | PASS | Các case CMS, Back/Forward, transient error/removal trong F06 suite |
| Locale + keyboard/mobile | PASS | 6 locale; 320×568, 390×844, 1440×900; zoom 200%; screenshot đã xem |
| Collection/Detail | PASS | Affected suite: toàn bộ 28 test Collection/Detail passed |
| Core + 3D regression | PARTIAL | Core pass; 12/13 camera test pass. `guided-tour-camera.spec.ts:279` flaky; clean `dev` pass một lần, nhánh feature fail hai lần |
| Public Locale + Visitor Journey | PASS | Toàn bộ 9 test trong affected suite passed |
| Typecheck | PASS | `npm run typecheck` exit 0 sau cập nhật code |
| Lint | PASS | `npm run lint` exit 0 |
| Unit full | PASS | `npm run test:unit` — 55 files / 327 tests |
| Build | PASS | `npm run build` exit 0; có cảnh báo bundle chunk >500 kB |
| Diff scope | PASS | `git diff --check`; chỉ frontend public UI/helper/test và plan/task |

### Execution record — 10/11/2026

- Branch `feat/guided-tour-2d-ui`, base `origin/dev` SHA `7cd44365b0b3801f31d2517edc5fbd4a734731b8`.
- F06 được triển khai bằng `useGuidedTour()` hiện có; Collection order lấy từ public room data, Detail không tự start, URL drift cần thao tác người dùng, và 2D không autoplay/audio timer.
- Affected command `npx playwright test tests/guided-tour-2d.spec.ts tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/guided-tour-core.spec.ts tests/public-locale.spec.ts tests/public-visitor-journey.spec.ts tests/guided-tour-camera.spec.ts --reporter=line` chạy 63 test: 62 pass, 1 fail là camera reset 3D ở ngưỡng movement. Test đó pass một lần trên checkout `dev` sạch và fail trong lần baseline trước đó cùng hai lần feature; được ghi là timing-sensitive. Không sửa file 3D để che kết quả.
- Screenshot 320/390/desktop được xem; browser assertion keyboard, focus heading, progress, horizontal overflow, zoom 200% đạt. Screen reader và thiết bị thật chưa kiểm tra.
- Không có backend/DB/migration; chưa push, tạo PR hoặc merge.

## 13. Commit ledger

| Task | Commit đề xuất | SHA | Trạng thái |
| --- | --- | --- | --- |
| 00 | `docs(tour): plan guided 2d visitor flow` | `2145a8f` | COMMITTED |
| 01 | `feat(tour): add guided 2d navigation adapter` | `60670a1` | COMMITTED; includes route/lifecycle adapter used by Task 05 |
| 02 | `feat(tour): start guided 2d tours from collection` | `9a8436c` | COMMITTED |
| 03 | `feat(tour): add guided 2d exhibit controls` | `61e3b41` | COMMITTED; includes 6-locale fallback inventory |
| 04 | `feat(tour): wire exhibit details to guided steps` | `9ba4fab` | COMMITTED |
| 05 | `fix(tour): guard guided 2d lifecycle and route drift` | `60670a1` | Included in Task 01 adapter; no duplicate commit |
| 06 | `feat(i18n): localize guided 2d controls` | `9a8436c`, `61e3b41`, `9ba4fab` | Implemented across Collection, controls and Detail commits |
| 07 | `test(tour): cover guided 2d visitor journey` | `f46cb1c` | COMMITTED |
| 08 | `docs(tour): record guided 2d verification` | — | This commit records final evidence |

**Định nghĩa DONE:** Guided Tour 2D dùng đúng Core, thứ tự public CMS, hoạt động đầy đủ trên Collection/Detail và có E2E chứng minh. Không đồng nghĩa đã hoàn tất F08 chuyển 2D↔3D hoặc F04 audio đa ngôn ngữ.
