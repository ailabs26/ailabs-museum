# BT3 VT-078 — Traceability

File test: **H** = `back-end/src/modules/media/tests/upload-jobs-http.spec.ts`,
**S** = `upload-jobs-service.spec.ts`, **R** = `upload-jobs-repository.integration.spec.ts`,
**L** = `tests/load/upload-jobs.load.ts`. Test viết ở commit `f5ccfab` (đỏ); code ở commit ghi trong bảng.

| AC / Risk | Test case | File | Commit code | Kết quả (evidence) |
|---|---|---|---|---|
| AC1 tạo job 202 | TC01 | H | `f8be5ab` | Đỏ: 501 (`01b-red.log`) → xanh (`02b-green-final.log`) |
| AC2 theo dõi tiến trình | TC02, TC10, TC11 | H, S | `f8be5ab` | Xanh; TC02 kiểm chuỗi `processing 50 → succeeded 100` |
| AC3 retry không trùng (risk) | TC03, TC04 | H | `0e4514a`, `f8be5ab` | Xanh; 20 request đồng thời → 1 lần 202, 1 job, 1 media |
| AC3 trên DB thật (risk) | TC04-DB | R | `3636842`, `0e4514a` | Đỏ: `NotImplemented` (`01d-red-pg.log`) → xanh 20 lần liên tiếp (`06-flaky.log`) |
| AC4 lỗi pipeline → failed | TC08 (a–c) | H | `f8be5ab` | Xanh; giữ nguyên mã `MediaErrorCode` |
| AC4 failure path hạ tầng (risk) | TC09 | S | `f8be5ab` | Xanh; retry sau lỗi không chạy lại worker, 0 media |
| AC5 key sai/thiếu/trùng nội dung | TC05, TC06, TC07 | H, S | `f8be5ab` | Xanh (sau khi sửa lỗi tham số mặc định của TC06) |
| NFR1 p95 ≤ 2,5 s @ 80 | TC14 | L | `e3d5e12` | p95 tệ nhất 1 473 ms (PG, `05b`), 2 068 ms (fake, `05c`); cùng tiến trình lần đầu 2 725 ms (`05a`, không đạt) |
| NFR2 không kẹt job | TC13 | S, R | `0e4514a`, `f8be5ab` | Xanh |
| NFR3 không lộ nội bộ | TC10, TC09 | S | `f8be5ab` | Xanh |
| Chất lượng test: mutation mapping | M1 `mediaId←job.id`, M2 `errorCode←errorMessage` | H, S | nhánh tạm `a97b196`, `5b23ab9` (đã xóa) | M1 bị 7 test bắt, M2 bị 4 test bắt (`03-mutation.log`) |
| Flaky: time, order/shared state, concurrency | Lặp 20 lần; randomize 5 seed; bỏ `whenIdle` | H, S, R | `068a783` | 20/20 và 5/5 xanh; bỏ `whenIdle` → 4/5 seed fail (`06-flaky.log`) |
