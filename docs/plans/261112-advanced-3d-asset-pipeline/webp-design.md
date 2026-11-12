# Thiết kế WebP

## Ảnh nội dung 2D

sharp nhận diện và decode JPEG/PNG/WebP từ bytes với input-byte cap và pixel limit. Kiểm signature, metadata dimensions, pages/animation policy và malformed input trước encode. Auto-orient giữ hướng nhìn, giữ nguyên kích thước nội dung đã định hướng, alpha và thông tin màu theo policy đã kiểm chứng. Output không crop hoặc downscale mặc định.

Ảnh chụp có thể thử high-quality lossy WebP khi operator chọn role phù hợp. Ảnh alpha, chữ/chi tiết chính xác dùng lossless hoặc giữ source. So kích thước candidate với master, bỏ candidate tăng bytes nếu chưa có lý do được duyệt. Source/author/license phải đi cùng manifest và được nhập lại vào metadata media khi upload theo workflow hiện có.

## Embedded GLB textures

Phân loại theo texture slot glTF trước khi encode. Base color/emissive có dữ liệu màu, normal/metallic/roughness/occlusion có dữ liệu phi màu. Texture dùng chung nhiều role cần policy chặt nhất hoặc dừng tự động. Lossless là chế độ bảo toàn giá trị dữ liệu ưu tiên cho alpha masks và maps phi màu. Việc chuyển profile màu cho ảnh màu cần kiểm riêng, data maps phải giữ byte semantics và linear sampling.

Sử dụng `EXT_texture_webp` cho embedded WebP, giữ ảnh/buffer nhúng nội bộ. Extension đã có trong frontend whitelist base nhưng browser decode WebP và output thực cần integration test. PNG/JPEG master vẫn giữ làm fallback nguồn. Candidate GLB chỉ kích hoạt sau review đúng browser support target.

Policy package ban đầu chỉ thử embedded PNG → lossless WebP khi bật `embeddedWebp`, yêu cầu decoded pixels bằng nhau và bytes nhỏ hơn. Embedded JPEG giữ nguồn. Ảnh 2D `photo` thử WebP quality 95 cho JPEG không alpha, `detail`/`data` dùng PNG lossless với alpha exactness gate. Khi candidate lớn hơn nguồn, manifest ghi fallback. Policy này còn được thắt chặt theo integration tests, report phải ghi đúng nhánh thực đã chạy.

## Gate

| Role | Gate cần kiểm |
| --- | --- |
| Photo | Color/orientation, chi tiết hiện vật, bytes savings, human QA |
| Alpha/mask | Alpha exactness hoặc sai khác được duyệt, silhouette và edge |
| Normal | Pixel/channel preservation, lighting không đổi ở cùng renderer |
| ORM | Pixel/channel preservation, không áp dụng sRGB transform |
| Base-color hoa văn/chữ | Close-up, màu, UV seams, human QA |

Unit/integration tests gồm JPEG→WebP, PNG alpha lossless, output lớn hơn nguồn, ICC/orientation, malformed/oversized input và maps dùng nhiều roles. Kết quả chạy được cập nhật trong `verification.md`. WebP giảm transfer bytes cần được đo, decoded texture allocation cần phương pháp GPU riêng.
