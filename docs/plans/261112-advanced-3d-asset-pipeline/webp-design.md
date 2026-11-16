# Thiết kế WebP

## Ảnh nội dung 2D

sharp nhận diện và decode JPEG/PNG/WebP từ bytes với input-byte cap và pixel limit. Kiểm signature, metadata dimensions, pages/animation policy và malformed input trước encode. Auto-orient giữ hướng nhìn, giữ nguyên kích thước nội dung đã định hướng, alpha và thông tin màu theo policy đã kiểm chứng. Output không crop hoặc downscale mặc định.

Ảnh chụp có thể thử high-quality lossy WebP khi operator chọn role phù hợp. Ảnh alpha, chữ/chi tiết chính xác dùng lossless hoặc giữ source. So kích thước candidate với master, giữ source khi candidate tăng bytes. Manifest ghi master basename/hash. Operator đối chiếu source/author/license của master và media record khi upload derivative theo workflow hiện có.

## Embedded GLB textures

Base color/emissive có dữ liệu màu, normal/metallic/roughness/occlusion có dữ liệu phi màu. Bản 1 áp dụng lossless và exact decoded-pixel gate cho mọi PNG embedded đủ điều kiện. Texture bindings/sampler settings được giữ, bao gồm texture dùng nhiều role. ICC/high-bit-depth/animated textures giữ source. Policy này bảo toàn giá trị channel của data maps và alpha masks.

Sử dụng `EXT_texture_webp` cho embedded WebP, giữ ảnh/buffer nhúng nội bộ. Extension đã có trong frontend whitelist base nhưng browser decode WebP và output thực cần integration test. PNG/JPEG master vẫn giữ làm fallback nguồn. Candidate GLB chỉ kích hoạt sau review đúng browser support target.

Policy package chỉ thử embedded PNG → lossless WebP khi bật `embeddedWebp`, yêu cầu decoded pixels bằng nhau và bytes nhỏ hơn. Embedded JPEG giữ nguồn. Ảnh 2D `photo` thử WebP quality 95 cho JPEG không alpha, `detail`/`data` dùng WebP lossless với alpha exactness gate. Khi candidate lớn hơn nguồn, manifest ghi fallback. CMS browser đã render GLB có embedded WebP từ pipeline.

## Gate

| Role | Gate cần kiểm |
| --- | --- |
| Photo | Color/orientation, chi tiết hiện vật, bytes savings, human QA |
| Alpha/mask | Alpha exactness hoặc sai khác được duyệt, silhouette và edge |
| Normal | Pixel/channel preservation, lighting không đổi ở cùng renderer |
| ORM | Pixel/channel preservation, không áp dụng sRGB transform |
| Base-color hoa văn/chữ | Close-up, màu, UV seams, human QA |

Unit/integration tests gồm JPEG→WebP, PNG alpha lossless, output lớn hơn nguồn, ICC/orientation, malformed/oversized input và maps dùng nhiều roles. Kết quả chạy được cập nhật trong `verification.md`. WebP giảm transfer bytes cần được đo, decoded texture allocation cần phương pháp GPU riêng.
