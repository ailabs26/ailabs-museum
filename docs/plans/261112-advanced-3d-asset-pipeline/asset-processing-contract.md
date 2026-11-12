# Hợp đồng xử lý asset

Contract schema 1 ngày 12/11/2026, đã đối chiếu với CLI, deterministic manifests và integration evidence trong `verification.md`.

## Input và tính bất biến

CLI nhận một master GLB tự chứa hoặc ảnh JPEG/PNG/WebP từ đường dẫn local do operator chỉ định. Đầu vào được đọc từ bytes, kiểm byte limit, loại nội dung và giới hạn decode trước khi xử lý. Output ở thư mục mới riêng biệt, từ chối output trùng input hoặc ghi đè kết quả đã có. Tính checksum master trước/sau để chứng minh nguồn giữ nguyên. Chạy từ master chuẩn, provenance phải phát hiện nguồn đã có compression/derived khi policy yêu cầu dừng.

CLI được chọn trong triển khai dùng Node 22+ tại `tools/asset-pipeline`.

```powershell
npm.cmd ci
npm.cmd run optimize -- --source D:\assets\master.glb --output D:\assets\candidate-run-01
npm.cmd run optimize -- --source D:\assets\photo.jpg --output D:\assets\photo-run-01 --image-policy photo
```

`--config <JSON-file>` cung cấp cấu hình riêng. `--image-policy` có `photo`, `detail`, `data`, `--embedded-webp` bật chuyển texture lossless. CLI help/invalid arguments/normal entry point đã được kiểm thử. Chọn thư mục output mới với parent đã tồn tại.

Manifest schema version 1 có `status`, `visualQa`, `publicationEligible`, `source`, `config`, `configurationSha256`, tool versions, `artifacts`, `limitations` và unsupported reasons. `source` ghi basename, `sha256`, `bytes`, `metrics` và validation results. Artifact ghi `file`, `lod`, `sha256`, `bytes`, `metrics`, `quality`. `visualQa` là `REVIEW_REQUIRED`, `publicationEligible` là false. Exact examples nằm trong `evidence/offline-benchmark.json`.

## Dữ liệu cần ghi

| Nhóm | Nội dung |
| --- | --- |
| Phiên bản | Schema version, pipeline version, Node/runtime và phiên bản dependency pin từ lockfile |
| Nguồn | Basename, SHA-256, bytes và metrics. Metadata quyền nằm trong master/media record, được operator đối chiếu khi publication |
| Cấu hình | Draco quantization/profile, simplification ratio/error và texture role/policy |
| Geometry | Node/mesh/material count, vertices/triangles, bounds, transforms và extensions |
| Variant | LOD index, relative filename, artifact SHA-256/size, geometry và texture metrics, source checksum |
| Gate | Trạng thái processing, structural/decode results, visual QA status và reviewer evidence |
| Failure | Stage, mã lỗi, thông điệp đã loại secret, quyết định giữ original/không sinh LOD |

Bytes là đơn vị chuẩn. Khi biểu diễn MB phải ghi rõ chia 1.000.000, MiB chia 1.048.576. Metrics chưa tính được ghi unavailable kèm lý do.

## Trạng thái và quality gate

- `REVIEW_REQUIRED` dành cho candidate đã xử lý nhưng cần visual review tại khoảng cách sử dụng.
- `PASS` cần reviewer, thời điểm, checksum candidate/config và evidence đi kèm. Kết quả structural/decode tự động có trường riêng.
- `REJECTED` dành cho candidate vi phạm gate hoặc bị reviewer loại.
- `UNSUPPORTED` dành cho cấu trúc/extension/feature chưa được pipeline chứng minh bảo toàn.
- `LOD_NOT_GENERATED` ghi lý do khi không có mức đơn giản hóa an toàn. Master và LOD0 còn hợp lệ vẫn có thể được review độc lập.

Ghi output tạm trong vùng task, validate và decode lại trước commit kết quả bằng đổi tên/thao tác tạo độc quyền. Lỗi giữa chừng phải dọn output tạm thuộc lần chạy và giữ input nguyên trạng. Test concurrency phải chứng minh hai lần chạy cùng output chỉ có một kết quả hoàn chỉnh.

## Ranh giới publication

Manifest local mô tả file và nguồn gốc. Frontend chỉ nhận descriptor đã validate từ API hoặc fixture test kiểm soát. Production variant cần quan hệ backend original/derived đã được người phụ trách duyệt. Operator có thể đưa một GLB đã duyệt qua upload hiện hành, với giới hạn GLB 10.000.000 bytes. Backend vẫn inspection, tính checksum, cấp media identity và giữ metadata quyền sử dụng theo DTO.

Trước upload, đối chiếu source/author/license và manifest với candidate checksum. Quyết định CMS gắn candidate vào revision cần người quản lý nội dung duyệt theo workflow đang có. Browser chỉ đọc NestJS URL. Signed URLs và credential storage giữ tại backend.
