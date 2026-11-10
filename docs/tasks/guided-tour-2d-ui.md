# F06 — Guided Tour 2D UI — Task Breakdown & Acceptance

> **Trạng thái:** PROPOSED / NOT STARTED — chưa sửa code, chạy test, commit, push hay tạo PR.
>
> **PLAN:** [`../plans/guided-tour-2d-ui-plan.md`](../plans/guided-tour-2d-ui-plan.md)  
> **Repository:** `ailabs26/ailabs-museum`  
> **Source audit:** `origin/dev` = `7cd44365b0b3801f31d2517edc5fbd4a734731b8` (10/11/2026), phải fetch lại khi bắt đầu.  
> **Branch đề xuất:** `feat/guided-tour-2d-ui` → `dev`.

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

- [ ] `git fetch origin`; kiểm tra `git status --short`; tạo `feat/guided-tour-2d-ui` từ `origin/dev` mới nhất và ghi lại SHA thật.
- [ ] Đọc `AGENTS.md`, coding conventions, F05/F07 plans, `MuseumContext`/reducer/hooks, route, Collection/Detail và browser fixtures.
- [ ] Chạy baseline typecheck, lint, unit, build; chạy regression tối thiểu Collection, Detail, Core và 3D; ghi lỗi có sẵn, exit code và môi trường.
- [ ] Chốt: không sửa production 3D, backend, DB, audio autoplay, timer 2D hoặc cross-mode F08.
- [ ] Commit plan/task với trạng thái chính xác.

**Acceptance:** nhánh sạch, base chính xác, source và giới hạn nhiệm vụ được đối chiếu.  
**Commit:** `docs(tour): plan guided 2d visitor flow`.

## 4. Task 01 — Adapter điều khiển và điều hướng

**File dự kiến:** `front-end/src/hooks/useGuidedTour2D.ts`; nếu cần, `front-end/src/helpers/guidedTour2dNavigation.ts` và `.test.ts`.

- [ ] Gọi `useGuidedTour()` hiện hữu; không lưu session, status hay index riêng.
- [ ] Tạo Detail URL chuẩn từ `roomSlug`, `exhibitId` hợp lệ, encode slug đúng; không dựng URL theo title bản dịch.
- [ ] Thiết kế commands có intent rõ: Start phòng, Start từ hiện vật, Next, Previous, Pause, Resume, Exit, Restart.
- [ ] Route chỉ thay đổi khi có **explicit guided action**; không `useEffect` redirect theo `currentStep` trên mọi render.
- [ ] Next tại bước cuối chỉ completed; Previous đầu no-op; Resume từ URL lệch bước quay về step hiện tại có chủ đích.
- [ ] Chống double click và state snapshot cũ; tránh duplicate navigation/dispatch trong StrictMode.
- [ ] Unit test 0/1/N, completed, ID không hợp lệ, slug đặc biệt, rapid navigation.

**Acceptance:** Core step, URL Detail và hành động người dùng nhất quán, không redirect do locale/refetch.  
**Commit:** `feat(tour): add guided 2d navigation adapter`.

## 5. Task 02 — Start/Continue/Exit trong Collection

**File:** `front-end/src/pages/client/CollectionPage.tsx` và `.module.css` nếu cần.

- [ ] Bổ sung CTA Start trong header của phòng chọn, cạnh link 3D cũ; không xóa/tác động link 3D.
- [ ] Phòng rỗng: không cho Start, có lời giải thích dễ hiểu.
- [ ] Start đi tới hiện vật đầu theo `sortForTour`/Core, không theo search/favorites/filtered grid.
- [ ] Nếu đã có tour đúng phòng: Continue đến step đang giữ, Exit; khác phòng chỉ thay tour khi người dùng chủ động Start mới.
- [ ] Không thay search, favorites, comparison, report, global search và room filter.
- [ ] Playwright: start 0/1/N, phòng đang chọn, filter, locale cơ bản, URL sau Start.

**Acceptance:** khách vào tour 2D từ Collection mà duyệt bình thường vẫn không đổi hành vi.  
**Commit:** `feat(tour): start guided 2d tours from collection`.

## 6. Task 03 — Component điều khiển 2D

**File dự kiến:** `front-end/src/components/museum/GuidedTour2DControls.tsx`, `.module.css`.

- [ ] Component chỉ nhận snapshot/handler; không tự gọi API, router hay tự sở hữu session.
- [ ] Hiển thị bước `n/N`, tên hiện vật hiện tại, progress, trạng thái idle/running/paused/completed.
- [ ] Nút có nhãn đầy đủ: Previous, Pause/Resume, Next, Exit, Restart khi hoàn thành; disabled chính xác tại biên.
- [ ] Next tại bước cuối thực hiện completed, không wrap; Previous khi completed phù hợp state Core.
- [ ] Có region được đặt tên, `role=status`/`aria-live=polite`, progress có accessible name/giá trị, focus-visible và thứ tự Tab logic.
- [ ] Dùng Mantine, Aura CSS tokens, bố cục bình thường không fixed/sticky đè lên audio.

**Acceptance:** controls đọc được, tương tác được bằng chuột, bàn phím và touch; status/progress khớp Core.  
**Commit:** `feat(tour): add guided 2d exhibit controls`.

## 7. Task 04 — Tích hợp Exhibit Detail

**File:** `front-end/src/pages/client/ExhibitDetailPage.tsx`, CSS module khi cần.

- [ ] Direct link hiện vật public hợp lệ: có hành động **Start từ hiện vật này**; không auto-start khi mở URL.
- [ ] Hiển thị Guided Tour controls khi URL khớp step hiện tại của session cùng phòng.
- [ ] Next/Previous đổi route Detail, giữ focus heading hiện tại; không phá Media, Transcript, Report, Favorite, Reading Controls.
- [ ] Step cuối: completed không đổi sang URL khác, giữ chi tiết cuối; Restart từ đầu chỉ theo click người dùng.
- [ ] Khi không có session, Detail vẫn là trang đọc bình thường và không có redirect.

**Acceptance:** thực hiện trọn quy trình tour 2D bằng các trang Detail hiện hữu.  
**Commit:** `feat(tour): wire exhibit details to guided steps`.

## 8. Task 05 — Browser history, dữ liệu public và lifecycle

**File:** adapter và các page liên quan, chỉ thêm helper/tests khi thật cần.

- [ ] Browser Back/Forward, QR/deep link, click hiện vật ngoài tour không bị tour effect ghi đè.
- [ ] Khi URL không trùng step hiện tại: pause khi phù hợp, hiển thị Resume-to-step/Exit; không redirect âm thầm.
- [ ] `reconcileRoom()` chỉ cho kết quả public hợp lệ và đúng `roomId`; reorder giữ ID, không reset khi chỉ đổi locale.
- [ ] Khi hiện vật hiện tại bị gỡ: dùng fallback của Core, paused, hiển thị phục hồi; không render draft.
- [ ] Room không còn public: chỉ invalidate trên kết quả public-list thành công, không trên lỗi mạng/tải lại.
- [ ] Kiểm tra rapid clicks, route unmount, StrictMode, request cũ trả chậm, đổi phòng và ranh giới 3D.

**Acceptance:** không có navigation loop, stale ID, mất phiên không chủ đích hoặc auto-select sai phòng.  
**Commit:** `fix(tour): guard guided 2d lifecycle and route drift`.

## 9. Task 06 — i18n, accessibility và responsive

**File:** controls/CSS và helper nhãn riêng nếu cần, kèm test.

- [ ] Tái sử dụng `GUIDED_TOUR_MESSAGES` cho label chung; nhãn 2D bổ sung fallback **vi/en/fr/zh/ko/ja**, tương thích `t()` và CMS override.
- [ ] Khi đổi locale: controls/content thay ngôn ngữ, nhưng session, current ID, index và URL không đổi.
- [ ] Test 320×568, 390×844, desktop, zoom 200%: không tràn/che audio dock, button vẫn bấm được.
- [ ] Test keyboard: Tab, aria-label, role status/progress, focus heading sau Next/Previous, tương phản theo theme.
- [ ] Không thêm hotkey toàn cục; không tự play audio, không ép animation khi reduced-motion.

**Acceptance:** giao diện ổn định, hỗ trợ 6 locale và không gây cản trở đọc/tiếp cận.  
**Commit:** `feat(i18n): localize guided 2d controls`.

## 10. Task 07 — Playwright acceptance và regression

**File dự kiến:** `front-end/tests/guided-tour-2d.spec.ts`, fixture có sẵn (chỉ chỉnh nếu thực sự cần).

- [ ] Browser test trọn luồng: Start từ Collection → Detail → Next → Previous → Pause/Resume → Completed → Restart/Exit.
- [ ] Bổ sung deep-link Start, phòng 0/1, thứ tự CMS khác thứ tự grid, filter, history, URL lệch bước, đổi phòng.
- [ ] Kiểm tra CMS reorder/removal, transient error, 6 locale, mobile, React StrictMode, không autoplay.
- [ ] Mock API xác định, không POST ra live API; tránh `waitForTimeout`, assert trạng thái/URL và focus thay vì ngủ chờ.
- [ ] Chạy affected suites: Collection, Detail, Guided Tour Core, Public Locale, Visitor Journey và 3D Camera.
- [ ] Đánh giá CI E2E hiện tại: nếu thêm smoke 2D ngắn mà vẫn giữ timeout 15 phút thì cập nhật; full Guided Tour E2E CI mở rộng nằm trong F09.

**Acceptance:** browser suite PASS với exit code 0, không bỏ test/giảm assertion cho xanh giả; không regress 2D hoặc 3D.  
**Commit:** `test(tour): cover guided 2d visitor journey`.

## 11. Task 08 — Full verification và PR handoff

**File:** 2 tài liệu plan/task + chỉ những sửa nhỏ trong phạm vi nếu phát hiện thật.

- [ ] Chạy từ `front-end/`: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`.
- [ ] Chạy E2E F06 và affected; ghi lệnh/OS/browser/mock-mode/PASS-FAIL-SKIP/exit code rõ ràng, lưu trace khi lỗi.
- [ ] Kiểm tra desktop/mobile screenshot và keyboard/focus; ghi rõ giới hạn đối với thiết bị thật/NVDA/VoiceOver.
- [ ] Rà `git diff origin/dev...HEAD`, `git diff --check` và staged files; không backend/DB/3D camera/out-of-scope.
- [ ] Cập nhật Plan/Task/commit ledger theo bằng chứng; chỉ đánh DONE khi kiểm chứng thực.
- [ ] Chuẩn bị PR title EN + mô tả VN Markdown, base `dev`; push/mở PR khi được yêu cầu và không tự merge.
- [ ] Ghi chú phần F08 còn lại: chuyển mode chưa đồng bộ toàn bộ trạng thái/timer/selection.

**Acceptance:** bộ F06 đủ bằng chứng, commit nhỏ và review được, không có kết luận PASS suy đoán.  
**Commit:** `docs(tour): record guided 2d verification`.

## 12. Verification matrix (điền khi triển khai)

| Gate | Trạng thái hiện tại | Evidence/lệnh dự kiến |
| --- | --- | --- |
| Baseline trước F06 | NOT RUN | Ghi trong Task 00 |
| Unit adapter | NOT RUN | Focused Vitest |
| Guided Tour 2D E2E | NOT RUN | `npx playwright test tests/guided-tour-2d.spec.ts --reporter=line` |
| CMS order/history/room recovery | NOT RUN | Browser cases và traces |
| Locale + keyboard/mobile | NOT RUN | Playwright + screenshot; real AT riêng |
| Collection/Detail | NOT RUN | `npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts --reporter=line` |
| Core + 3D regression | NOT RUN | `npx playwright test tests/guided-tour-core.spec.ts tests/guided-tour-camera.spec.ts --reporter=line` |
| Public Locale + Visitor Journey | NOT RUN | `npx playwright test tests/public-locale.spec.ts tests/public-visitor-journey.spec.ts --reporter=line` |
| Typecheck | NOT RUN | `npm run typecheck` |
| Lint | NOT RUN | `npm run lint` |
| Unit full | NOT RUN | `npm run test:unit` |
| Build | NOT RUN | `npm run build` |
| Diff scope | NOT RUN | `git diff --check`; `git diff origin/dev...HEAD` |

## 13. Commit ledger

| Task | Commit đề xuất | SHA | Trạng thái |
| --- | --- | --- | --- |
| 00 | `docs(tour): plan guided 2d visitor flow` | — | NOT STARTED |
| 01 | `feat(tour): add guided 2d navigation adapter` | — | NOT STARTED |
| 02 | `feat(tour): start guided 2d tours from collection` | — | NOT STARTED |
| 03 | `feat(tour): add guided 2d exhibit controls` | — | NOT STARTED |
| 04 | `feat(tour): wire exhibit details to guided steps` | — | NOT STARTED |
| 05 | `fix(tour): guard guided 2d lifecycle and route drift` | — | NOT STARTED |
| 06 | `feat(i18n): localize guided 2d controls` | — | NOT STARTED |
| 07 | `test(tour): cover guided 2d visitor journey` | — | NOT STARTED |
| 08 | `docs(tour): record guided 2d verification` | — | NOT STARTED |

**Định nghĩa DONE:** Guided Tour 2D dùng đúng Core, thứ tự public CMS, hoạt động đầy đủ trên Collection/Detail và có E2E chứng minh. Không đồng nghĩa đã hoàn tất F08 chuyển 2D↔3D hoặc F04 audio đa ngôn ngữ.
