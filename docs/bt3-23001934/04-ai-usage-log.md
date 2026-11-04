# BT3 VT-078 — AI Usage Log

| Mục | Nội dung |
|---|---|
| Công cụ | Claude Code (model Claude Opus 5.5), chạy trong VS Code, có quyền đọc/ghi repo và chạy lệnh trong worktree `feat/bt3-async-upload-jobs` |
| Thời gian | 31/10/2026 |
| Ràng buộc VT-078 | AI viết test **trước** implementation; sinh viên phải kiểm test fail **đúng lý do** trước khi sửa code |

## Prompt chính

1. *Phân tích:* "phân tích yêu cầu làm bài tập này" (kèm toàn văn đề).
2. *Lập plan:* "lên plan làm bài tập này cho tôi" → agent hỏi 2 lựa chọn (lưu job bằng bảng DB hay in-memory; có làm UI không), sinh viên chọn **bảng DB + migration** và **chỉ BE + E2E mức API**.
3. *Thực hiện:* "làm cho tôi yêu cầu đó của thầy cho tôi tương tự như bài tập trước". Agent được yêu cầu: viết test + stub trước, chạy và đọc lý do fail, rồi mới viết implementation.

## Output được dùng, sửa, bác bỏ

| Output của AI | Quyết định | Evidence |
|---|---|---|
| Plan: slice upload media bất đồng bộ, `Idempotency-Key`, unique index | Dùng | `01-spec-and-plan.md` |
| Plan: `errorCode: UNSUPPORTED_FORMAT`; unique trên cột nullable; `@Audit(..., 'media')`; `--test-shuffle`; harness ở `scripts/`; thiếu `data-source.ts` | Sửa / bác bỏ (R1–R6) | Bảng mục 6 của `01-spec-and-plan.md` |
| Stub ném `NotImplementedException` ở `onApplicationBootstrap` | Sửa | `evidence/01a-red-wrong-reason.log` dòng 180: cả suite HTTP fail ở hook `before`, chưa test nào chạy tới assertion → đổi stub thành no-op, chạy lại (`01b-red.log`) |
| Test integration PG: `insert(row)` hai lần cùng object để thử unique | Sửa | `01c-red-pg-test-bug.log`: lỗi là `PK_media_upload_jobs` chứ không phải `UQ_..._actor_key` — TypeORM gắn `id` vào object sau lần insert đầu |
| Helper `createJob(buffer, key = randomUUID())` và TC06 gọi `createJob(buf, undefined)` | Sửa | `02a-green-attempt-test-bugs.log` dòng 85: TC06 nhận 202 — `undefined` rơi vào giá trị mặc định nên request vẫn có key. Lúc đỏ, TC06 "fail" với 501 nên trông như đúng lý do |
| TC04 dùng `request(app.getHttpServer())` cho 20 request đồng thời | Sửa | `01b-red.log` dòng 171: `ECONNRESET` — server chưa listen nên supertest tự `listen(0)` mỗi request. Lần review đỏ đầu tiên đã **bỏ sót** lý do này |
| Patch service/repository/mapper | Dùng sau review diff | Commit `477e2b9`, `ff54c07`; 1973/1973 test back-end pass, lint/typecheck sạch |
| Câu "ký tự Unicode bị Node chặn nên không kiểm được" trong test strategy | Sửa | Kiểm bằng `http.request().setHeader()`: `khóa` gửi được, chỉ ký tự > U+00FF bị `ERR_INVALID_CHAR` → thêm ca TC07 `khóa` |
| Harness tải v1: client và server chung tiến trình | Sửa | `05a-load-same-process.json`: lần 1 p95 2 725 ms; client dựng 80 form 2 MB trên cùng event loop với server → tách server sang tiến trình con (`05b`, `05c`) |

## Hai điểm AI-generated code/test "có vẻ hợp lý nhưng không đáng tin ngay"

1. **Test đỏ "đúng kiểu" nhưng sai lý do.** 29/31 test đỏ đều báo 501 hoặc assertion, nhìn đúng như mong đợi. Nhưng TC04 thực ra fail vì `ECONNRESET` của hạ tầng test, và TC06 fail với 501 trong khi request vẫn gửi key — nếu implementation bỏ quên kiểm tra thiếu header, TC06 vẫn có thể xanh với lý do sai. Chỉ đọc từng message lỗi, không đếm số test đỏ, mới phát hiện.
2. **Fake repository làm unique constraint "luôn đúng".** `FakeUploadJobRepository` kiểm tra rồi ghi trong cùng một tick JavaScript nên không bao giờ có race. TC04 xanh trên fake không chứng minh được gì về PostgreSQL. Phải có `upload-jobs-repository.integration.spec.ts` chạy 20 insert đồng thời trên PG thật (pool 25 connection) mới chứng minh invariant.

Tôi chịu trách nhiệm kiểm chứng mọi nội dung AI tạo ra được dùng trong bài; không dùng "AI nói đúng" làm bằng chứng.
