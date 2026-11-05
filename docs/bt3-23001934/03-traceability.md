# BT3 VT-078 — Traceability

File test: **H** = `back-end/src/modules/media/tests/upload-jobs-http.spec.ts`,
**S** = `upload-jobs-service.spec.ts`, **R** = `upload-jobs-repository.integration.spec.ts`,
**L** = `tests/load/upload-jobs.load.ts`, **A** = `upload-jobs-audit.spec.ts`,
**C** = `upload-jobs-concurrency.spec.ts`, **T** = `upload-jobs-retention.spec.ts`. Test AC1–NFR3 viết ở commit `cb08073` (đỏ); code ở commit ghi trong bảng.

| AC / Risk | Test case | File | Commit code | Kết quả (evidence) |
|---|---|---|---|---|
| AC1 tạo job 202 | TC01 | H | `ff54c07` | Đỏ: 501 (`01b-red.log`) → xanh (`02b-green-final.log`) |
| AC2 theo dõi tiến trình | TC02, TC10, TC11 | H, S | `ff54c07` | Xanh; TC02 kiểm chuỗi `processing 50 → succeeded 100` |
| AC3 retry không trùng (risk) | TC03, TC04 | H | `477e2b9`, `ff54c07` | Xanh; 20 request đồng thời → 1 lần 202, 1 job, 1 media |
| AC3 trên DB thật (risk) | TC04-DB | R | `7a0aeb8`, `477e2b9` | Đỏ: `NotImplemented` (`01d-red-pg.log`) → xanh 20 lần liên tiếp (`06-flaky.log`) |
| AC4 lỗi pipeline → failed | TC08 (a–c) | H | `ff54c07` | Xanh; giữ nguyên mã `MediaErrorCode` |
| AC4 failure path hạ tầng (risk) | TC09 | S | `ff54c07` | Xanh; retry sau lỗi không chạy lại worker, 0 media |
| AC5 key sai/thiếu/trùng nội dung | TC05, TC06, TC07 | H, S | `ff54c07` | Xanh (sau khi sửa lỗi tham số mặc định của TC06) |
| NFR1 p95 ≤ 2,5 s @ 80 | TC14 | L | `1740d2c` | p95 tệ nhất 1 473 ms (PG, `05b`), 2 068 ms (fake, `05c`); cùng tiến trình lần đầu 2 725 ms (`05a`, không đạt) |
| NFR2 không kẹt job | TC13 | S, R | `477e2b9`, `ff54c07` | Xanh |
| NFR3 không lộ nội bộ | TC10, TC09 | S | `ff54c07` | Xanh |
| Review P2: media đã lưu, ghi `succeeded` lỗi | TC19, TC19b | S | `ac6f842` | Xanh; mutation M3 đưa patch về lại trong `try` → đúng TC19, TC19b fail (`07-review-p2-fix.log`) |
| AC6 audit `media.upload` | TC20, TC20b, TC23, TC24 | A | `e847801` | Đỏ: thiếu bản ghi (`08a-red-audit.log`) → xanh (`08b-green-audit.log`) |
| AC6 qua HTTP | TC25 | H | `e847801` | Đỏ (`08a`) → xanh (`08b`) |
| AC6 lỗi audit, job failed | TC21, TC22 | A | `e847801` | Xanh từ đầu vì là ca chặn; M4, M5 làm đúng hai ca này đỏ (`08c-mutation-audit.log`) |
| AC6 job kẹt `processing` | TC24b | A | `e847801` | Đỏ (`08a`) → xanh (`08b`) |
| AC7 giới hạn, FIFO, mặc định | TC26, TC27, TC33 | C | `f20d8eb` | Đỏ: job thứ 4, 5 chạy vượt giới hạn (`09a-red-concurrency.log`) → xanh (`09b-green-concurrency.log`) |
| AC7 `whenIdle`, trả slot | TC28, TC29, TC29b, TC29c | C | `f20d8eb` | TC29b, TC29c đỏ → xanh. TC28, TC29 xanh từ đầu; M7, M9 làm chúng đỏ (`09c-mutation-concurrency.log`) |
| AC7 giữ bất biến cũ | TC30, TC31, TC32 | C | `f20d8eb` | TC31 đỏ → xanh. TC30, TC32 xanh từ đầu; M9, M10 làm TC30 đỏ. TC32 là ca chặn, chưa có mutation riêng |
| AC7 cấu hình | TC34, TC34b | C | `d99e0f2` | Đỏ (`09a`) → xanh (`09b`) |
| AC8 dọn job | TC35, TC35c, TC35-DB, TC35b-DB, TC36b | T, R | `b111abf` | Đỏ (`10a-red-retention.log`) → xanh (`10b-green-retention.log`) |
| AC8 lỗi khi dọn | TC36 | T | `b111abf` | Xanh từ đầu; M11 làm ca này đỏ (`10c-mutation-retention.log`) |
| AC8 cấu hình | TC37, TC37b | T | `efc4c1c` | Đỏ (`10a`) → xanh (`10b`) |
| Chất lượng test: mutation mapping | M1 `mediaId←job.id`, M2 `errorCode←errorMessage` | H, S | nhánh tạm `a97b196`, `5b23ab9` (đã xóa) | M1 bị 7 test bắt, M2 bị 4 test bắt (`03-mutation.log`) |
| Flaky: time, order/shared state, concurrency | Lặp 20 lần; randomize 5 seed; bỏ `whenIdle` | H, S, R | `57f9e3e` | 20/20 và 5/5 xanh; bỏ `whenIdle` → 4/5 seed fail (`06-flaky.log`) |

## Kết quả sau bản sửa P2 (`07-review-p2-fix.log`)

- `npm run test:upload-jobs`: 37/37 với PostgreSQL, 34/34 không có DB. Toàn back-end 2107/2107, lint và typecheck sạch.
- Coverage file của slice (không tính entity): 99,09% line, 92,31% branch, 96,77% function. Dòng chưa phủ của service đổi thành 81–82.
- Flaky: lặp 20 lần 20/20 và randomize 5 seed 5/5, đều 37/37.
- Số đo tải (`05*`) và mutation M1, M2 (`03-mutation.log`) đo trước bản sửa, không chạy lại vì bản sửa chỉ đổi bước hoàn tất job.

## Rủi ro còn lại sau bản sửa P2

- Job giữ `processing` sau 3 lần ghi lỗi chưa tự kết thúc, phải đối soát thủ công qua log có `mediaId`.
- Nếu server khởi động lại lúc đó, `failInterrupted()` ghi job thành `failed`/`job_interrupted`, `mediaId` null dù media `ready` đã tồn tại. Đây vẫn là tình huống P2 nhưng qua đường restart, chưa có test.
- Giả định một instance API vẫn chưa được xác nhận trên môi trường triển khai.

## Kết quả đợt review 05/11/2026 (`12-final-verification.log`, `12b-flaky.log`)

- `npm run test:upload-jobs`: 65/65 với PostgreSQL, 60/60 không có DB.
- `npm run test:media`: 584/584 không có DB, 653/653 với PostgreSQL (`--test-concurrency=1`).
- `npm run test:rooms`: 446/446. `npm run test:exhibits`: 633/633. Toàn back-end: 2133/2133. Lint và typecheck sạch.
- Flaky: lặp 20 lần 20/20 và randomize 5 seed 5/5, đều 65/65 với PostgreSQL.

### Tải trước và sau hàng đợi (PostgreSQL 16 docker, 80 upload đồng thời, cùng máy)

Trước: code tại `98019ca`, chưa có audit và hàng đợi. Sau: code tại `ad28c69`, giới hạn 3; các commit sau đó chỉ thêm phần dọn job lúc khởi động. Harness dùng `AuditService` giả nên không đo chi phí ghi audit.

| Kịch bản | Chỉ số | Trước | Sau |
|---|---|---|---|
| 2 MB × 5 lần (`11a`, `11c`) | POST p95 tệ nhất | 907 ms | 950 ms |
| | Hoàn tất p95 (thấp–cao) | 876–1 310 ms | 1 850–2 322 ms |
| | RSS đỉnh | 850 MB | 872 MB |
| | `arrayBuffers` đỉnh | 294 MB | 275 MB |
| 8 MB × 3 lần (`11b`, `11d`) | POST p95 tệ nhất | 3 035 ms | 3 004 ms |
| | Hoàn tất p95 (thấp–cao) | 6 587–10 756 ms | 7 140–7 913 ms |
| | RSS đỉnh | 1 464 MB | 1 466 MB |
| | `arrayBuffers` đỉnh | 810 MB | 785 MB |

Đọc kết quả:

- **Hàng đợi không giảm được đỉnh RAM.** Multer đọc hết file vào RAM trước khi vào service, và job chờ vẫn giữ buffer. Với 80 × 8 MB, mức 800 MB vẫn còn nguyên.
- Hàng đợi có giới hạn số pipeline chạy song song (TC26), nhưng file 2 MB hoàn tất chậm hơn khoảng gấp đôi vì job phải xếp hàng.
- NFR1 (2 MB) vẫn đạt. Với 8 MB, lần chạy đầu vượt 2,5 s ở cả trước và sau (3 035 và 3 004 ms), hai lần sau đạt; đây không phải hồi quy. NFR1 không đặt mục tiêu cho 8 MB.
- Mỗi kịch bản chỉ đo một đợt trên một máy, nên chênh lệch vài phần trăm không có ý nghĩa.

## Rủi ro còn lại sau đợt review 05/11/2026

- **RAM chưa được giới hạn.** Muốn giới hạn thật cần chặn độ dài hàng đợi (trả 429/503, đổi contract API) hoặc ghi file tạm ra đĩa thay vì giữ buffer. Cả hai đều chưa làm.
- **Giả định một instance chưa được xác nhận.** `failInterrupted()` đánh dấu `failed` mọi job `queued`/`processing`, kể cả job của instance khác. Rolling deploy có hai bản chạy chồng nhau cũng gặp tình huống này.
- **Cron dọn media có thể lỗi vì FK.** `FK_media_upload_jobs_media` là `ON DELETE RESTRICT` (đã kiểm trên PostgreSQL), còn điều kiện `PURGEABLE` không loại media còn job tham chiếu. Media tạo qua job, bị xóa mềm quá hạn, mà job chưa được dọn sẽ làm câu `DELETE` theo lô lỗi. Chỉ phát sinh khi `MEDIA_ORPHAN_CLEANUP=on`. Mới suy ra từ code và constraint, chưa tái hiện qua cron thật.
- **Dọn job chỉ chạy lúc khởi động.** Server chạy lâu không restart thì bảng không được dọn.
- **Idempotency-Key dùng lại được sau khi job bị dọn.** Client retry cùng key sau N ngày sẽ tạo job và media mới.
- **Job có thể không có audit nếu tiến trình chết** ngay sau khi lưu media, trước khi ghi audit.
- **Job `failed` có audit `media.upload`** khi job kẹt `processing` (TC24b) rồi server khởi động lại. Media vẫn có thật; xem quyết định ở mục 7 của `01-spec-and-plan.md`.
- **Retry 200 vẫn ghi `media.upload_job.create`** vì `AuditInterceptor` chạy ở mọi response thành công. Hành vi này có từ trước, không đổi; `media.upload` không bị ghi lại.
- **Media bị cách ly qua job không có audit**, giống đường upload đồng bộ (pipeline ném lỗi sau khi lưu bản ghi cách ly).
- **Job có thể kẹt `queued`** khi cả patch `processing` và patch `failed` đều lỗi (TC29b), tới lần khởi động sau. Slot vẫn được trả.
