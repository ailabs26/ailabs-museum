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
