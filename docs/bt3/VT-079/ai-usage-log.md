# AI Usage Log · BT3 VT-079

Công cụ dùng xuyên suốt: **Claude Code** (CLI agent, model Claude Opus 5.5) chạy trong repo local. Sinh viên giữ quyền quyết định cuối cùng: mọi output đều được đối chiếu với repo và kết quả chạy test trước khi dùng.

## #1 · Implementation plan (trước khi code)

**Prompt (nguyên văn):**

> Bạn là coding agent. Repository ở …/ailabs-museum (NestJS 10 + TypeORM + PostgreSQL back-end; React 18 + Mantine + TanStack Query front-end). CHỈ ĐỌC, không sửa file.
> Change request: "Thêm cơ chế lưu nháp tự động cho form sửa hiện vật trong CMS admin; dữ liệu mới hơn không được bị bản lưu cũ ghi đè."
> Mini-spec:
> - Goal: form sửa hiện vật (admin) tự lưu bản nháp sau khi người dùng ngừng gõ; một lần lưu cũ (gửi muộn, retry, tab khác) không được ghi đè dữ liệu mới hơn đã lưu.
> - Constraints: giữ workflow Draft → In Review → Published hiện có; không thêm dependency mới; patch nhỏ, review được; làm test-first.
> - Evidence mong muốn: unit + integration (PostgreSQL thật) + 1 E2E Playwright.
>
> Hãy tạo implementation plan TRƯỚC KHI code, gồm: 1. Assumptions; 2. Danh sách file dự định tạo/sửa; 3. Cơ chế chống ghi đè; 4. Test ở từng mức và thứ tự test-first; 5. Rủi ro. Giữ plan gọn (≤ 60 dòng).

**Output (tóm tắt trung thực, các ý giữ nguyên):**
- A1: Bản nháp autosave là revision DRAFT trên server, dùng `PATCH /admin/exhibits/:id`; không dùng localStorage.
- A2: Chỉ autosave khi sửa; form tạo mới vẫn lưu thủ công.
- A3: Chỉ autosave khi state là draft/rejected/approved và form hợp lệ; tắt khi in_review; approved thì lần đầu fork revision (BR-21).
- A4: Debounce 1500 ms bằng `useDebouncedCallback` của `@mantine/hooks`.
- A5: **`expectedVersion` là tham số tùy chọn ở BE để tương thích với test và client cũ**; FE luôn gửi.
- A6: Mọi thao tác tăng version (submit, hide/unhide, approve) đều là thay đổi mới hơn, nên autosave cũ phải nhận 409.
- A7: Có PostgreSQL cục bộ theo mẫu `MEDIA_TEST_DATABASE_URL`, không có thì skip.
- File dự kiến: `update-exhibit.dto.ts` (thêm `@IsOptional() expectedVersion`), `exhibits.service.ts` (sau `findForUpdate`, `if (dto.expectedVersion !== undefined && …) throw Conflict`), `front-end/src/services/exhibits.service.ts`, `front-end/src/helpers/exhibitAutosave.ts` (queue 1 in-flight, giữ snapshot mới nhất), `ExhibitsPage.tsx`, `tests/fixtures/exhibitEditApi.ts`.
- Test: DTO; service với repo giả, gồm cả case **"không gửi → giữ hành vi cũ"**; FE helper (vitest); integration PG (replay, song song, sau submit); E2E Playwright.
- Rủi ro: xung đột giả do hide/approve tăng version; mỗi autosave sinh một audit log; fork ngay khi sửa bản approved; hotspots bị delete+insert mỗi lần lưu; ExhibitsPage dài 1666 dòng; retry sau khi server đã commit sẽ nhận 409.

**Review bằng repo thật:**

| Điểm của AI | Quyết định | Evidence |
|---|---|---|
| A5 `expectedVersion` optional | **Bác bỏ** | Optional thì client/bundle cũ không gửi version vẫn ghi đè được, tức invariant bị bypass ngay ở boundary. Thay bằng: bắt buộc ở DTO (400) và fail-closed ở service. |
| Test "không gửi version → giữ hành vi cũ" | **Bác bỏ** | Test này bám implementation (đúng risk VT-079) và khóa luôn lỗ hổng. Thay bằng các rule R1–R8, oracle lấy từ AC. |
| A4 dùng `useDebouncedCallback` cho logic | **Sửa** | Hook có trong `@mantine/hooks@7.17.8` (`lib/index.d.ts`). Nhưng vitest chạy env `node`, chỉ `src/**/*.test.ts` (`vitest.config.ts`), nên queue phải là hàm thuần, test bằng fake timers; hook chỉ dùng ở lớp wiring. |
| A6 submit tăng version | Chấp nhận | `submitDraftForReview` có `currentExhibit.version = … + 1`. |
| Fixture cần trả 409 | Chấp nhận | `exhibitEditApi.ts:72` `record.version++` không kiểm tra version. |
| Rủi ro audit log | Chấp nhận, thêm NFR3 | `admin-exhibits.controller.ts`: `@Audit('exhibit.update','exhibit')` trên `@Patch(':id')`. |
| Rủi ro retry sau commit → 409 | Chấp nhận, ghi residual risk | Không làm trong slice này; xem reflection. |

## #2 · Sinh test và patch (Claude Code, có review diff)

| Output AI | Dùng / sửa / bác bỏ | Evidence |
|---|---|---|
| Spec BE TC01–TC10 và integration TC06–TC09 | Dùng sau khi sửa 2 test: **TC05** so `name` với `{vi}` trong khi mapper trả thêm `en: undefined`; **TC09** gọi `submitDraftForReview` nên bị publish gate chặn (422) | `00-red-first-run-wrong-reason.log`: fail vì setup, không phải hành vi. Đã sửa oracle/fixture, không sửa sản phẩm |
| Commit contract `ddbcf91` | Lỗi: thêm field làm `tsc` hỏng `revision-media.spec.ts` (union class không còn gộp được) | Phát hiện khi chạy `tsc --noEmit`; sửa ở `f3e0548`, không amend |
| E2E chung bị crash trên dev | AI chẩn đoán là thiếu route `/admin/stats/overview`; vá fixture dùng chung | 13/13 fail → 13/13 pass (`00-baseline-*`) |
| Guard BE (15 dòng) và DTO | Dùng; review diff từng dòng | `86acaa3`; full suite 2052/2052 |
| `createDraftAutosaver` và wiring `ExhibitsPage` | Dùng, sau đó **phải sửa** theo review (#3 bên dưới) | `d67fdff` → `e5e546d` |

## #3 · AI review patch SAU khi test đã pass (ràng buộc VT-079)

**Prompt (rút gọn):** "Bạn là reviewer… xem `git diff 4c2a6d0..HEAD -- back-end/src front-end/src front-end/tests`… tác giả báo BE 2052/2052, FE unit 201/201, E2E 15/15. Liệt kê ≤ 8 nhận xét theo mức nghiêm trọng, mỗi nhận xét: file:dòng, vấn đề, kịch bản, đã kiểm chứng thế nào hoặc 'chưa kiểm chứng'."

| # | Nhận xét của AI | Đánh giá | Evidence |
|---|---|---|---|
| 1 | Bấm Lưu trong cửa sổ debounce khi mạng chậm → autosave và lưu tay cùng gửi version V → 409 giả | **Đúng** | E2E mới RED: nhận **2 PATCH cùng `expectedVersion: 1`** (`05-review-fix-red-e2e.log`). Sửa bằng `pause()`/`resume()`, GREEN 16/16 |
| 3 | Lỗi vĩnh viễn (403/404/422) bị retry mãi mỗi 5 s | **Đúng** | TC13c RED: 2 request thay vì 1 (`05-review-fix-red-unit.log`). Chỉ retry lỗi mạng/429/5xx |
| 6 | Kiểu TS ở FE để optional, lệch với BE; là breaking change cho client khác | Đúng một phần | Kiểu đã thành bắt buộc. Grep: chỉ FE gọi PATCH exhibits; `scripts/e2e-cms-workflow.mjs` chỉ PATCH `/admin/rooms`. Rủi ro client ngoài repo chưa đánh giá được |
| 7 | "2052/2052 có thể đã gồm test bị skip" | **Không đủ evidence** (và sai) | Reviewer không mở log. `02-green-backend-full-suite.log` ghi `skipped 0`; `02-green-backend.log` có TC06–TC09 chạy kèm thời gian; `04-coverage-backend.log` cũng `skipped 0` |
| 4 | Đóng rồi mở lại drawer ngay khi autosave đang bay → GET đọc trước commit → 409 giả | Chưa đủ evidence (AI tự ghi "chưa kiểm chứng") | Không tái hiện; ghi vào residual risk, không sửa dựa trên suy đoán |
| 2 | "Hủy bỏ" không còn hủy; mất ≤ 1.5 s nhập liệu cuối khi đóng | Đúng về hành vi, là quyết định sản phẩm | Ghi vào giới hạn; cần PO xác nhận |
| 5, 8 | Thoát conflict phải tải lại (không có merge); mỗi lần autosave delete+insert hotspots | Hợp lý, ngoài slice | Residual risk / việc tiếp theo |

## #4 · Hai điểm AI-generated trông hợp lý nhưng không đáng tin ngay

1. **TC07 (test concurrency do AI viết):** tên và assert đều đúng với AC3, nhưng test **pass ngay trên baseline**, và khi bỏ guard version (M1) chỉ fail **3/30** lần (`03-mutation-tc07-repeat-30x.log`). Nó chỉ mạnh với M2 (bỏ khóa dòng, 30/30). Nếu tin TC07 làm bằng chứng chính cho AC2 thì sẽ sai; bằng chứng tất định thật sự là TC03/04/06/08.
2. **Wiring autosave đầu tiên (`d67fdff`):** typecheck, lint, unit 201/201 và E2E 15/15 đều xanh, nhưng vẫn có race lưu tay ↔ autosave. Chỉ lộ ra khi AI review nêu kịch bản và một E2E mới có fixture "mạng chậm" chứng minh được. "Test xanh" ở đây không bằng "đúng".

## #5 · Review người (dinhtienn, PR #135) — lỗi AI review đã bỏ sót

| Nhận xét | Đánh giá | Evidence |
|---|---|---|
| [P2] `PUT /admin/exhibits/rooms/:roomId/reorder` đổi `displayOrder` qua `updateDisplayOrder()` mà không tăng `version`; autosave (payload luôn mang `displayOrder` lúc mở drawer) vẫn qua guard và ghi đè thứ tự mới | **Đúng**. Kiểm thêm thấy `markRestored` (khôi phục từ thùng rác) cùng lỗi | RED `de52d11`: TC17, TC18 fail vì thiếu 409 (`08-red-review-reorder.log`). Fix `7f0b0ce`, GREEN 15/15, BE 1957/1957 |

Dùng Claude Code để kiểm chứng nhận xét trên code, viết test RED và patch. **Quyết định của tôi:** chỉ tăng version cho hiện vật thật sự đổi vị trí (không tăng hàng loạt), vì tăng cho cả phòng sẽ làm mọi người đang sửa hiện vật khác trong phòng nhận 409 giả. TC17b khóa quyết định này; mutation M5 (luôn tăng) bị TC17b bắt (`08-mutation-M5-unconditional-bump.log`).

**Bài học:** AI review (#3) chỉ xem diff của patch nên không thấy các đường ghi khác vào cùng bảng (`reorder`, `restore`) nằm ngoài diff. Invariant "mọi lần ghi dựa trên version mới nhất" phải được kiểm trên **mọi** đường ghi vào `exhibits`, không chỉ đường được sửa.
