# Giao thức bảo toàn chất lượng

## Dataset và nguồn gốc

Ghi asset ID, license/quyền sử dụng, checksum master và vị trí lưu được phép. Fixture tổng hợp do test sinh phù hợp cho geometry/decoder/lifecycle. Dataset museum cần curator chọn mẫu hoa văn, chữ khắc, surface mỏng, texture chi tiết, kim loại/bóng/transparency, high-poly và low-poly. Loại mẫu chưa có được ghi coverage gap.

## Capture chuẩn

Capture master, LOD0, LOD1 và LOD2 với cùng camera pose/FOV/resolution/DPR, lighting/environment, exposure/tone mapping, background, shadow và renderer version. Đợi mọi texture decode và model ready trước ảnh. Ghi config và checksums cùng ảnh, không dùng ảnh khác điều kiện để quy nguyên nhân cho compression.

Góc chụp tối thiểu front, side, back, 3/4, detail close-up, khoảng cách quan sát bình thường và vùng chuyển LOD. Contact sheet cần nhãn artifact/level/camera. Quan sát seam, normal, màu vật liệu, silhouette, chữ/hoa văn, opacity và hotspot overlay.

## Metric và quyết định

| Kiểm tra | Cách đánh giá |
| --- | --- |
| Scene/material structure | So node hierarchy, transforms, assignment/PBR và texture role |
| Geometry | Counts, bounds delta, surface-distance estimate và mesh validation |
| Pivot/normalization | So master frame và wrapper normalization, hotspot projection |
| Image | Pixel errors/PSNR/SSIM nếu có phép tính, cùng color handling |
| Runtime transition | Hai phía threshold, dao động camera, selected/focus, load failure |
| Human review | Curator kiểm chi tiết quan trọng ở khoảng cách áp dụng |

Metric trung bình chỉ hỗ trợ reviewer. Artifact đạt structural/decode gate vẫn `REVIEW_REQUIRED` cho đến review thị giác. Cần lưu reviewer, ngày, checksum/config và lý do `PASS`/`REJECTED`. Với LOD thấp, lưu minimum approved projected pixels và góc nhìn/đặc điểm giới hạn.

## Điều kiện từ chối

Mất chữ/hoa văn nhận diện, silhouette biến dạng, rách mesh, lệch hotspot/scale/pivot, normal/UV seam hoặc material/color khác rõ đều yêu cầu dừng kích hoạt candidate. Sửa cấu hình rồi sinh lại từ master, giữ evidence lần bị loại. Asset đặc biệt chưa hỗ trợ ghi `UNSUPPORTED` và giữ nguồn gốc.

## Ledger review

| Dataset | Automated capture | Human visual review | Trạng thái |
| --- | --- | --- | --- |
| Fixture tổng hợp của task | `evidence/renders/contact-sheet.png`, bốn fixed-camera PNGs và RGB metrics | Đã xem so sánh kỹ thuật, curator review còn mở | REVIEW_REQUIRED |
| Dataset hiện vật được cấp quyền | Chưa xác nhận sẵn có | Pending curator | REVIEW_REQUIRED |

Master fixture SHA-256 là `693c93c57dfda49a63d632bfd3da8b4f6acd2466ba55999aa6cbd33c123786b7`. Config/tool versions và artifact checksums nằm trong `evidence/offline-benchmark.json`. Curator review cần dataset và những chi tiết di sản thực tế.
