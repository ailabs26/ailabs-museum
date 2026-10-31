# BT3 VT-078 — Test strategy dựa trên risk

Risk trọng tâm: **retry tạo bản ghi/thông báo trùng**. Kỹ thuật bắt buộc: **equivalence partitioning (EP)**.

## 1. Phân bổ theo level

| Level | Phạm vi | File | Vì sao |
|---|---|---|---|
| Unit | Service với repository fake + pipeline thật; mapper; repository với TypeORM giả lập lỗi 23505 | `upload-jobs-service.spec.ts` | Dựng được failure path hiếm (storage lỗi, khởi động lại, lỗi 23505) mà không cần hạ tầng |
| Integration (DB thật) | Repository + migration trên PostgreSQL 16 | `upload-jobs-repository.integration.spec.ts` (opt-in `MEDIA_TEST_DATABASE_URL`) | Fake không chứng minh được unique index thật chặn race; chỉ DB thật mới chứng minh |
| API | Multipart thật → controller → guard → service → pipeline thật → storage đĩa tạm | `upload-jobs-http.spec.ts` | Kiểm contract HTTP: mã 202/200/400/404/409/413, envelope `ApiResponse`, header |
| E2E (mức API) | Tạo job → poll → `succeeded` → `GET /admin/media/:id` | TC02 trong `upload-jobs-http.spec.ts` | Một luồng người dùng đầy đủ qua 2 controller |
| Load | 80 tác vụ đồng thời, p95 | `tests/load/upload-jobs.load.ts` | NFR1 |

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
| Hạ tầng khi xử lý | H1 bình thường | H2 storage ném lỗi · H3 tiến trình khởi động lại giữa chừng | H2 dùng `FailingStorage` có sẵn; H3 gọi `onApplicationBootstrap()` |
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

Negative test: TC05, TC06, TC07 (cùng TC08, TC11, TC12). Failure-path gắn risk riêng: **TC09** (lỗi hạ tầng + retry không tạo trùng) và TC13.
