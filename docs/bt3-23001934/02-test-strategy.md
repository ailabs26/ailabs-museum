# BT3 VT-078 — Test strategy dựa trên risk

Risk trọng tâm: **retry tạo bản ghi/thông báo trùng**. Kỹ thuật bắt buộc: **equivalence partitioning (EP)**.

## 1. Phân bổ theo level

| Level | Phạm vi | File | Vì sao |
|---|---|---|---|
| Unit | Service với repository fake + pipeline thật; mapper; repository với TypeORM giả lập lỗi 23505 | `upload-jobs-service.spec.ts` | Dựng được failure path hiếm (storage lỗi, khởi động lại, lỗi 23505) mà không cần hạ tầng |
| Integration (DB thật) | Repository + migration trên PostgreSQL 16 | `upload-jobs-repository.integration.spec.ts` (opt-in `MEDIA_TEST_DATABASE_URL`) | Fake không chứng minh được unique index thật chặn race; chỉ DB thật mới chứng minh |
| API | Multipart thật → controller → guard → service → pipeline thật → storage đĩa tạm | `upload-jobs-http.spec.ts` | Kiểm contract HTTP: mã 202/200/400/404/409/413, envelope `ApiResponse`, header |
| E2E (mức API) | Tạo job → poll → `succeeded` → `GET /admin/media/:id` | TC02 trong `upload-jobs-http.spec.ts` | Một luồng người dùng đầy đủ qua 2 controller |
| Load | 80 tác vụ đồng thời, p95, đỉnh RSS/`arrayBuffers` | `tests/load/upload-jobs.load.ts` | NFR1, đo tác động của hàng đợi |
| Unit (audit) | Worker + `AuditService` thật trên repository fake | `upload-jobs-audit.spec.ts` | Chạy đúng đường `recordSafely`, dựng được lỗi ghi audit |
| Unit (concurrency) | Worker + `GatedMediaService` do test tự mở từng job | `upload-jobs-concurrency.spec.ts` | Xác định được thứ tự, không dùng sleep |
| Unit (dọn job) | `onApplicationBootstrap` với đồng hồ giả (`mock.timers`) | `upload-jobs-retention.spec.ts` | Kiểm đúng mốc thời gian mà không phụ thuộc giờ máy |

**Không cần:**
- *E2E trình duyệt (Playwright):* slice không có UI; thêm UI chỉ để test là ngoài phạm vi.
- *Test Supabase Storage thật:* driver đã có `supabase-storage-driver.spec.ts`; job service phụ thuộc `MediaStorageService`, không phụ thuộc driver.
- *Test lại từng định dạng media (PNG/JPEG/MP3/VTT):* pipeline `MediaService.upload()` đã có ~500 test; job service chỉ cần một đại diện cho mỗi lớp lỗi.

## 2. Equivalence partitioning

Mỗi lớp lấy **một đại diện**; với lớp có biên (độ dài key) lấy thêm giá trị ngay tại và ngay ngoài biên.

| Input | Lớp hợp lệ | Lớp không hợp lệ | Đại diện / lý do chọn |
|---|---|---|---|
| `Idempotency-Key` (cú pháp) | V1: 1–128 ký tự `[A-Za-z0-9_-]` | I1 thiếu header · I2 chuỗi rỗng · I3 > 128 ký tự · I4 có khoảng trắng · I5 có ký tự ngoài tập (`/`, `khóa`) | V1: `k` (biên dưới), 128×`b` (biên trên), UUID (dạng client hay dùng). I3: 129 ký tự (ngay ngoài biên). Đã kiểm: Node HTTP client chặn ký tự > U+00FF (`ERR_INVALID_CHAR`) nhưng gửi được Latin-1 như `ó`, nên `khóa` là đại diện cho ký tự ngoài ASCII tới được server |
| `Idempotency-Key` (trạng thái) | S1 chưa dùng · S2 đã dùng + cùng nội dung · S3 cùng key nhưng người tạo khác | S4 đã dùng + nội dung khác (file khác, hoặc cùng file khác `altText`) | S2 gửi tuần tự và gửi đồng thời (20 request) — vì risk nằm ở đồng thời |
| File | F1 GLB hợp lệ | F2 sai định dạng (EXE đổi đuôi) · F3 vượt giới hạn theo định dạng (PNG 2 MB + 1 byte) · F4 hỏng cấu trúc (GLB JSON cắt cụt) · F5 thiếu file · F6 vượt giới hạn multipart (> 10 MB) | F2–F4 đi vào job rồi `failed` (lỗi của tác vụ dài); F5–F6 bị chặn đồng bộ (400/413, không tạo job) — hai nhóm hành vi khác nhau nên là hai lớp |
| Hạ tầng khi xử lý | H1 bình thường | H2 storage ném lỗi · H3 tiến trình khởi động lại giữa chừng · H4 ghi audit lỗi · H5 ghi job lỗi | H2 dùng `FailingStorage` có sẵn; H3 gọi `onApplicationBootstrap()`; H4 dùng `FakeAuditRepository.saveError`; H5 dùng `patchError` |
| Vị trí job trong hàng đợi | Q1 còn slot → chạy ngay · Q2 hết slot → chờ `queued` | Q3 job đang giữ slot bị lỗi (pipeline, ghi job, lỗi ngoài dự kiến) | Giới hạn 1 để thấy rõ thứ tự; giới hạn 3 cho mặc định |
| `MEDIA_UPLOAD_JOB_CONCURRENCY` | 1 (biên dưới), 3 (mặc định), 50 (biên trên) | 0, -1, 1.5, `abc`, 51 | 0 là lớp nguy hiểm nhất: hàng đợi không bao giờ chạy |
| `MEDIA_UPLOAD_JOB_RETENTION_DAYS` | 1, 7 (mặc định), 3650 | 0, -1, 1.5, `abc`, 3651 | Job ngay tại mốc được giữ (so sánh `<`) |
| `jobId` (GET) | J1 UUID tồn tại, của mình | J2 UUID không tồn tại · J3 UUID của người khác · J4 không phải UUID | J3 trả 404 như J2 để không lộ sự tồn tại |

## 3. Bảng test case

| ID | AC / Risk | Level | Precondition / input | Expected | P |
|---|---|---|---|---|---|
| TC01 | AC1 | API | GLB hợp lệ (F1), key mới (V1, S1) | 202, `status=queued`, `progress=0`, `mediaId=null`, 1 job | P1 |
| TC02 | AC2 | E2E API | TC01 rồi poll GET | `succeeded`, `progress=100`, `mediaId` → media `ready`; chuỗi patch `processing 50 → succeeded 100` | P1 |
| TC03 | AC3 · Risk | API | Gửi lại tuần tự cùng key + file (S2) | 200, cùng `id`; 1 job, 1 media | P1 |
| TC04 | AC3 · Risk | API (đồng thời) | 20 request đồng thời cùng key | Đúng 1 lần 202, 19 lần 200, 1 `id`; 1 job, 1 media | P1 |
| TC04-DB | AC3 · Risk | Integration PG | 20 `insertOrFindExisting` đồng thời trên DB thật | 1 `created`, 1 dòng trong bảng | P1 |
| TC05 | AC5 · **negative** | API | Cùng key, file khác (S4) | 409 `idempotency_key_reused`, vẫn 1 job | P1 |
| TC06 | AC5 · **negative** | API | Không gửi header (I1) / header rỗng (I2) | 400 `idempotency_key_required`, field `Idempotency-Key`, 0 job | P1 |
| TC07 | AC5 · **negative** | API | Key 129 ký tự (I3), `abc def` (I4), `a/b`, `khóa` (I5) | 400 `idempotency_key_invalid`, 0 job | P2 |
| TC08 | AC4 · negative | API | EXE (F2) / PNG quá cỡ (F3) / GLB hỏng (F4) | 202 rồi `failed` với `media_unsupported_type` / `media_too_large` / `media_corrupted`; không media `ready` | P1 |
| TC09 | AC4 · Risk · **failure path** | Unit | Storage ném lỗi (H2); client retry cùng key khi hạ tầng đã hồi phục | Job `failed`, `internal_error`, message không lộ đường dẫn; retry trả job cũ, **không** chạy lại worker, 0 media; key mới thì `succeeded` | P1 |
| TC10 | AC2 · NFR3 | Unit | Mapper với job `succeeded` và job `failed` | Đúng từng field; không có `requestChecksum`, `idempotencyKey`, `createdById` | P1 (bắt mutation) |
| TC11 | AC2 · negative | API | GET UUID không tồn tại (J2) / của người khác (J3) | 404 | P2 |
| TC12 | negative | API | GET `khong-phai-uuid` (J4) | 400 | P3 |
| TC13 | NFR2 | Unit + Integration PG | Job `queued`/`processing` khi khởi động lại (H3) | `failed`, `job_interrupted`; job `succeeded` giữ nguyên | P2 |
| TC14 | NFR1 | Load | 80 POST đồng thời, GLB 2 MB, 5 lần | p95 POST ≤ 2 500 ms; 80 retry cùng key → 1 job | P2 |
| TC19 | Review P2 · **failure path** | Unit | Media đã lưu; ghi `succeeded` lỗi DB 2 lần rồi thành công | Thử 3 lần; `succeeded` có `mediaId`; không có patch `failed` | P1 |
| TC19b | Review P2 · **failure path** | Unit | Media đã lưu; ghi `succeeded` lỗi liên tục, rồi retry cùng key | Media còn, file không bị xóa; job giữ `processing`, không có patch `failed`; retry không chạy lại worker, không tạo media thứ hai | P1 |
| TC20 | AC6 | Unit | Job `succeeded` kèm client info | Đúng 1 audit `media.upload`, resource là media, actor là người tạo, giữ `requestId`/IP/User-Agent | P1 |
| TC20b | AC6 | Unit | Gọi `enqueue` không có client info | Vẫn ghi audit, `requestId` sinh mới | P3 |
| TC21 | AC6 · **failure path** | Unit | Ghi audit lỗi (H4) | Job vẫn `succeeded` có `mediaId`, không có patch `failed` | P1 |
| TC22 | AC6 · **negative** | Unit | Job `failed` do file bị từ chối và do storage lỗi | Không có audit `media.upload` | P1 |
| TC23 | AC6 · Risk | Unit | 20 request đồng thời cùng key, rồi retry tuần tự | 1 media, 1 audit | P1 |
| TC24 | AC6 | Unit | Ghi `succeeded` lỗi 2 lần rồi được | 1 audit, không ghi theo số lần thử | P2 |
| TC24b | AC6 · **failure path** | Unit | Ghi `succeeded` lỗi liên tục | Job giữ `processing`, media có thật nên vẫn có 1 audit | P2 |
| TC25 | AC6 | E2E API | Tạo job qua HTTP với `x-request-id`, chờ xong | Audit `media.upload` trỏ tới media, cùng actor, cùng request-id, User-Agent, có IP | P1 |
| TC26 | AC7 | Unit | 5 job, giới hạn 3 | Chỉ 3 job chạy; job chờ `queued`, `progress = 0`, không có patch; xong 1 thì job kế mới `processing`; đỉnh 3 | P1 |
| TC27 | AC7 | Unit | 4 job, giới hạn 1 | Chạy đúng thứ tự enqueue, từng job một | P1 |
| TC28 | AC7 | Unit | `whenIdle()` khi còn job chờ | Chỉ resolve sau khi job cuối xong | P1 |
| TC29 | AC7 · **failure path** | Unit | Job đầu lỗi pipeline | Job đó `failed`, job sau vẫn `succeeded` | P1 |
| TC29b | AC7 · **failure path** | Unit | Patch `processing` và patch `failed` đều lỗi (H5) | Slot được trả, job sau `succeeded` | P1 |
| TC29c | AC7 · **failure path** | Unit | Worker ném lỗi ngoài dự kiến sau khi media đã lưu | Slot được trả, không có unhandled rejection | P1 |
| TC30 | AC3 · AC7 · Risk | Unit | Retry cùng key khi job còn trong hàng đợi | Trả job `queued` cũ, pipeline chạy đúng 1 lần | P1 |
| TC31 | Review P2 · AC7 | Unit | Media đã lưu, ghi `succeeded` lỗi liên tục, có job chờ | Job giữ `processing`, không ghi `failed`, job sau vẫn chạy | P1 |
| TC32 | NFR2 · AC7 | Unit | Khởi động lại khi còn job `processing` và `queued` | Cả hai `job_interrupted` | P2 |
| TC33 | AC7 | Unit | Không cấu hình, 4 job | Đỉnh 3 job chạy cùng lúc | P2 |
| TC34 | AC7 | Unit | `media.config` có và không có env | Mặc định 3, đọc được env | P3 |
| TC34b | AC7 · negative | Unit | Env 0, -1, 1.5, `abc`, 51 / 1, 50 | Từ chối / nhận | P2 |
| TC35 | AC8 | Unit | Job cũ, job tại mốc, job mới, job vừa gián đoạn | Chỉ xóa job đã kết thúc cũ hơn mốc 7 ngày | P2 |
| TC35c | AC8 | Unit | Cấu hình 30 ngày | Mốc xóa là 30 ngày | P3 |
| TC35-DB | AC8 | Integration PG | Job ở 4 trạng thái, cũ và mới | Chỉ xóa `succeeded`/`failed` cũ | P2 |
| TC35b-DB | AC8 · NFR2 | Integration PG | Job `queued` cũ 30 ngày, khởi động | `failInterrupted` đặt lại `updated_at`, job không bị xóa ngay | P2 |
| TC36 | AC8 · **failure path** | Unit | Dọn job lỗi | Khởi động không hỏng, `failInterrupted` vẫn đã chạy | P2 |
| TC36b | AC8 · **failure path** | Unit | `failInterrupted` lỗi | Vẫn dọn job cũ, khởi động không hỏng | P3 |
| TC37 | AC8 | Unit | `media.config` có và không có env | Mặc định 7, đọc được env | P3 |
| TC37b | AC8 · negative | Unit | Env 0, -1, 1.5, `abc`, 3651 / 1, 3650 | Từ chối / nhận | P3 |

Test concurrency không dùng sleep: `GatedMediaService` giữ từng upload tới khi test mở cổng, `settle()` chỉ nhường event loop để khẳng định không có job nào khác chạy. Mỗi test có timeout 2 giây để job kẹt làm đúng test đó đỏ.

Negative test: TC05, TC06, TC07 (cùng TC08, TC11, TC12). Failure-path gắn risk riêng: **TC09** (lỗi hạ tầng + retry không tạo trùng), TC13 và **TC19/TC19b** (thêm sau review PR #133), **TC21, TC24b, TC29–TC29c, TC36, TC36b** (đợt review 05/11).
