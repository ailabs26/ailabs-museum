# BT3 VT-078 — Upload media bất đồng bộ + chống trùng khi retry

Nguyễn Trọng Thành (23001934) · SE2026-T20 · 3D-WEB-03.
Nhánh `feat/bt3-async-upload-jobs`, tách từ `origin/dev` tại baseline
**`4c2a6d0cf89bbe52e76bb0e8509b5d0338178600`**. PR vào `dev`, **chưa merge** (chờ nhóm review).

## Hash commit sau rebase

Nhánh đã rebase lên `dev` ngày 03/11/2026 nên hash đổi. Tài liệu dùng hash mới; log gốc trong `evidence/` giữ nguyên hash cũ.

| Cũ | Mới | Nội dung |
|---|---|---|
| `7b076d8` | `b652d4d` | Spec, AC, invariant, review plan |
| `f5ccfab` | `cb08073` | Test trước + stub (đỏ) |
| `3636842` | `7a0aeb8` | Entity, migration, đăng ký module |
| `0e4514a` | `477e2b9` | Repository |
| `f8be5ab` | `ff54c07` | Service, worker, mapper |
| `068a783` | `57f9e3e` | Evidence coverage, flaky |
| `e3d5e12` | `1740d2c` | Harness tải |
| `2ab9c9d` | `8688456` | Test strategy, ca key Latin-1 |

## Thay đổi

- `POST /api/admin/media/upload-jobs` (multipart `file` + header `Idempotency-Key`) → 202 `{ id, status, progress, ... }`; retry cùng key + cùng nội dung → 200 job cũ; khác nội dung → 409.
- `GET /api/admin/media/upload-jobs/:id` → trạng thái `queued → processing → succeeded | failed`, `progress`, `mediaId`, `errorCode`.
- Bảng `media_upload_jobs` với unique `(created_by, idempotency_key)` — migration `1793800000000-AddMediaUploadJobs.ts`.

Code: `back-end/src/modules/media/{controllers/admin-upload-jobs.controller.ts, services/media-upload-job.service.ts, repositories/media-upload-job.repository.ts, entities/media-upload-job.entity.ts, dto/upload-job-response.dto.ts}`.

## Chạy test (trong `back-end/`)

```bash
npm ci
npm run test:upload-jobs          # unit + API + E2E API (integration PG tự skip nếu không có DB)
npm run test                      # toàn bộ back-end
npm run lint && npm run typecheck
```

Integration test và harness tải trên PostgreSQL thật (chỉ chấp nhận DB ở localhost):

```bash
docker run -d --name bt3-pg -e POSTGRES_PASSWORD=bt3 -e POSTGRES_DB=bt3 -p 127.0.0.1:55432:5432 postgres:16-alpine
export MEDIA_TEST_DATABASE_URL=postgres://postgres:bt3@127.0.0.1:55432/bt3
npm run test:upload-jobs          # thêm 3 test PG thật (migration chạy tự động)
npm run load:upload-jobs          # 80 upload đồng thời × 5 lần, in p50/p95/max
LOAD_OUTPUT=out.json LOAD_CONCURRENCY=80 LOAD_RUNS=5 LOAD_FILE_BYTES=2000000 npm run load:upload-jobs
docker rm -f bt3-pg
```

Coverage cho các file của slice:

```bash
node -r reflect-metadata -r ts-node/register --enable-source-maps --test --experimental-test-coverage \
  --test-coverage-include='src/modules/media/services/media-upload-job.service.ts' \
  --test-coverage-include='src/modules/media/repositories/media-upload-job.repository.ts' \
  --test-coverage-include='src/modules/media/dto/upload-job-response.dto.ts' \
  --test-coverage-include='src/modules/media/controllers/admin-upload-jobs.controller.ts' \
  src/modules/media/tests/upload-jobs-*.spec.ts
```

Kiểm flaky theo thứ tự ngẫu nhiên: thêm `--test-randomize --test-random-seed=<n>` vào lệnh `node --test`.

## Tài liệu

| File | Nội dung |
|---|---|
| `01-spec-and-plan.md` | Problem statement, AC1–AC5, NFR, invariant, plan AI và review R1–R6 |
| `02-test-strategy.md` | Phân bổ level, phân lớp tương đương, bảng 17 test case |
| `03-traceability.md` | AC/Risk → test → file → commit → kết quả |
| `04-ai-usage-log.md` | Prompt, output dùng/sửa/bác bỏ, 2 điểm AI chưa đáng tin |
| `evidence/` | Log baseline, đỏ (cả lần sai lý do), xanh, mutation, coverage, flaky, kết quả tải |
