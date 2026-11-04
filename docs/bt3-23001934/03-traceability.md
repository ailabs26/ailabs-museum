# BT3 VT-078 — Traceability

File test: **H** = `back-end/src/modules/media/tests/upload-jobs-http.spec.ts`,
**S** = `upload-jobs-service.spec.ts`, **R** = `upload-jobs-repository.integration.spec.ts`,
**L** = `tests/load/upload-jobs.load.ts`. Test viết ở commit `cb08073` (đỏ); code ở commit ghi trong bảng.

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
