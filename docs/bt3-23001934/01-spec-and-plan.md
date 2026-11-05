# BT3 VT-078 — Specification và AI-assisted plan

Sinh viên: Nguyễn Trọng Thành (23001934) · Nhóm SE2026-T20 · Đề tài 3D-WEB-03.
Baseline: `4c2a6d0cf89bbe52e76bb0e8509b5d0338178600` (origin/dev, 31/10/2026).

## 1. Problem statement

`POST /admin/media/upload` xử lý toàn bộ pipeline (nhận diện định dạng, kiểm tra dung lượng,
parse cấu trúc GLB/ảnh/âm thanh, lưu storage, ghi DB) trong cùng một request. Với mô hình 3D tới
10 MB lưu qua Supabase Storage, biên tập viên phải chờ cả quá trình, không biết tiến độ, và khi mạng
chập chờn thì client (axios retry, bấm lại) gửi lại request — mỗi lần tạo thêm một bản ghi `media`
và một file mới. Cần cho upload chạy bất đồng bộ, trả về ngay một job có trạng thái theo dõi được,
và bảo đảm retry không tạo bản ghi trùng.

## 2. Acceptance criteria

| ID | Tiêu chí (kiểm thử được) |
|---|---|
| AC1 | `POST /admin/media/upload-jobs` với file hợp lệ và header `Idempotency-Key` mới trả **202** kèm `{ id, status: "queued", progress: 0 }` mà không chờ pipeline xử lý xong. |
| AC2 | `GET /admin/media/upload-jobs/:id` trả trạng thái hiện tại; job hợp lệ đi tới `succeeded`, `progress = 100`, `mediaId` trỏ tới media `ready`. Chỉ người tạo job xem được (người khác nhận 404). |
| AC3 | Gửi lại cùng `Idempotency-Key` với cùng nội dung — tuần tự hoặc đồng thời — trả **200** với **đúng job cũ**; tổng số job = 1 và số media tạo ra ≤ 1. |
| AC4 | File bị pipeline từ chối (sai định dạng, quá dung lượng theo định dạng, hỏng cấu trúc, lỗi storage) làm job chuyển `failed` với `errorCode` của pipeline; không có media `ready` nào được tạo. |
| AC5 | Cùng `Idempotency-Key` nhưng nội dung khác trả **409** `idempotency_key_reused`; thiếu hoặc sai định dạng key trả **400**. |

## 3. Non-functional constraints

- **NFR1 – Hiệu năng:** p95 thời gian phản hồi của `POST /upload-jobs` ≤ 2,5 s với 80 tác vụ đồng thời.
- **NFR2 – Không kẹt job:** khi ứng dụng khởi động lại, job còn `queued/processing` (mất buffer trong RAM) được đánh dấu `failed` với `job_interrupted`, client không phải chờ vô hạn.
- **NFR3 – Không lộ chi tiết nội bộ:** response job không chứa `storageKey`, `requestChecksum`.

## 4. Invariant / contract quan trọng nhất

> Với mỗi cặp `(created_by, idempotency_key)` tồn tại **đúng một** job, và job đó tạo **nhiều nhất một** media.

Invariant được giữ ở database bằng unique constraint `UQ_media_upload_jobs_actor_key`, không dựa vào
kiểm tra "tìm trước rồi insert" trong code (hai request đồng thời đều thấy "chưa có"). Khi insert vi
phạm constraint (`23505`), repository đọc lại job đã có. Worker chỉ được khởi chạy bởi request **tạo
mới** job, nên retry không chạy lại pipeline.

## 5. AI-assisted implementation plan

**Công cụ:** Claude Code (Claude Opus 5.5) trong VS Code, có quyền đọc repo.

**Prompt lập plan (nguyên văn, người dùng gửi kèm toàn văn đề bài):**

```
lên plan làm bài tập này cho tôi
```

Trước đó agent đã được yêu cầu "phân tích yêu cầu làm bài tập này" và tự khảo sát repo
(`ls back-end/src/modules`, grep `queue|job|progress|idempoten`, đọc `media.service.ts`,
`media.entity.ts`, `admin-media-http.spec.ts`). Plan được lưu ở
`~/.claude/plans/l-n-plan-l-m-b-i-enchanted-waterfall.md`.

**Assumptions agent đưa ra:**
1. Tác vụ dài phù hợp nhất là upload media (GLB ≤ 10 MB), pipeline có sẵn trong `MediaService.upload()`.
2. Repo không có queue nên dùng worker in-process; trạng thái job lưu bảng DB (người dùng chọn thay vì in-memory).
3. Chống trùng bằng header `Idempotency-Key` + unique index `(created_by_id, idempotency_key)`.
4. Chỉ làm back-end; E2E ở mức API (người dùng chọn).

**File agent dự định thay đổi:** mới `entities/media-upload-job.entity.ts`,
`repositories/media-upload-job.repository.ts`, `services/media-upload-job.service.ts`,
`controllers/admin-upload-jobs.controller.ts`, `dto/upload-job-response.dto.ts`, migration
`AddMediaUploadJobs`, tests `upload-jobs-*.spec.ts`, `scripts/load/upload-jobs-load.ts`; sửa
`media.module.ts`, `media-test-doubles.ts`, `package.json`.

## 6. Review plan bằng repository thật

| # | Điểm trong plan của AI | Quyết định | Evidence trong repo |
|---|---|---|---|
| R1 | Job lỗi có `errorCode: UNSUPPORTED_FORMAT` | **Sửa** | Mã lỗi thật là enum `MediaErrorCode` dạng snake_case, vd `media_unsupported_type` (`inspection/media-format.error.ts`; `admin-media-http.spec.ts` assert `errors[0].code === 'media_unsupported_type'`). Job tái dùng nguyên mã của pipeline, không đặt mã mới. |
| R2 | Unique `(created_by_id, idempotency_key)` | **Sửa** | Cột `created_by` của `media` là `nullable: true` (`media.entity.ts`). Trong PostgreSQL, `NULL` không bằng nhau nên unique index không chặn được hai job có `created_by` NULL. Bảng job đặt `created_by` **NOT NULL**; route luôn có user đã đăng nhập. |
| R3 | `@Audit('media.upload_job', 'media')` | **Sửa** | `AuditInterceptor.resolveResourceIds()` lấy `data.id` của response làm `resource_id`. Với resource type `media`, audit sẽ ghi id **của job** như thể là id media. Đổi resource type thành `media_upload_job` (cột `resource_type varchar(40)` không có CHECK). |
| R4 | Kiểm tra flaky bằng `--test-shuffle` | **Bác bỏ** | `node --help` (v26.3.0) không có `--test-shuffle`; cờ đúng là `--test-randomize` kèm `--test-random-seed`. |
| R5 | Harness tải ở `back-end/scripts/load/` chạy bằng `ts-node` | **Sửa** | `tsconfig.json` có `rootDir: ./src`, `include: ["src/**/*.ts"]`; thư mục `scripts/` không thuộc project và `npm run typecheck` không kiểm tra nó. Đặt harness ở `src/modules/media/tests/load/` (không phải `*.spec.ts` nên không chạy cùng test). |
| R6 | Danh sách file không có `config/data-source.ts` | **Bổ sung** | `data-source.ts` khai báo entity tường minh và `DatabaseModule` đặt `autoLoadEntities: false`; thiếu entity mới thì migration và repository lỗi lúc chạy thật. |

## 7. Bổ sung sau đợt review (05/11/2026)

| ID | Yêu cầu | Cách làm |
|---|---|---|
| AC6 | Media tạo qua upload-jobs có audit `media.upload`, resource là media, actor là người tạo job. Không ghi khi job `failed`, không ghi lại khi retry cùng key. Lỗi ghi audit không làm hỏng job. | Worker gọi `AuditService.recordSafely()` sau `markSucceeded()`. Controller truyền `auditClientInfo(req)` để giữ `requestId`, IP, User-Agent của request gốc. |
| AC7 | Tối đa `MEDIA_UPLOAD_JOB_CONCURRENCY` job (mặc định 3) chạy cùng lúc, thứ tự FIFO. Job chờ giữ `queued`, `progress = 0`. `whenIdle()` chờ cả job trong hàng đợi. Job ném lỗi vẫn trả slot. | `queue` + `drain()` trong `MediaUploadJobService`; slot trả ở `finally`. |
| AC8 | Job đã kết thúc cũ hơn N ngày (mặc định 7) bị xóa khi khởi động, không thêm scheduler. | `deleteFinishedBefore()` gọi sau `failInterrupted()` trong `onApplicationBootstrap`. Không cần migration. |

**Quyết định cần người review xác nhận.** AC6 ghi "khi job chuyển sang `succeeded`", nhưng code ghi audit cả khi media đã lưu mà 3 lần ghi `succeeded` đều lỗi (job giữ `processing`, TC24b). Lý do: lúc đó media `ready` có thật, bỏ audit thì đúng lỗi đang sửa lại xuất hiện. Hệ quả: nếu server khởi động lại, job đó thành `failed` trong khi audit `media.upload` đã có.

**Giả định một instance:** hàng đợi và buffer chỉ nằm trong tiến trình, và `failInterrupted()` không phân biệt instance. Chạy nhiều instance sẽ làm job của instance khác bị đánh dấu `failed`.
