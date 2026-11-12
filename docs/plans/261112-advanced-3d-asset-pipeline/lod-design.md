# Thiết kế LOD

## Artifact độc lập

Sinh ba GLB riêng. LOD0 giữ topology nguồn, LOD1/2 chạy simplification với ratio/error config riêng và kiểm actual counts. Tỷ lệ chỉ là thông số thử nghiệm theo model. Dataset mỏng, hard edges, transparent material, non-manifold, animated hoặc skinned cần phân loại hỗ trợ trước. Master bounds, node transforms, material assignment, UV và normal phải có gate. Không đạt thì ghi `LOD_NOT_GENERATED` hoặc `REJECTED` và giữ candidate nguồn.

Package ban đầu dùng tên `lod0.glb`, `lod1.glb`, `lod2.glb`, thử LOD1 ratio 0,8/error 0,0005 và LOD2 ratio 0,5/error 0,001 với meshopt lockBorder. Alpha/double-sided/open/non-manifold được dự kiến giữ LOD0 và ghi lý do bỏ lower LOD. Actual ratio có thể cao hơn target khi error/border constraint cần giữ geometry. Config riêng và evidence phải được curator duyệt trước sử dụng.

Mỗi variant có checksum, bytes, vertices/triangles, bounds và source checksum trong manifest. Tải LOD2 chỉ tải file LOD2. Mọi level cùng wrapper normalization lấy từ master đã xác minh, cùng placement và hotspot frame.

## Chọn mức theo màn hình

Dùng projected sphere diameter từ radius master ở world space, camera FOV, viewport height và khoảng cách. DPR/quality chỉ đưa vào khi đơn vị threshold được định nghĩa nhất quán. Với perspective camera, ước lượng pixels có dạng `2 × radius × viewportHeight / (2 × distance × tan(FOV / 2))`, clamp/LOD0 khi camera ở trong hoặc quá gần bounds. Với camera đặc thù hoặc XR chưa xác minh, dùng lựa chọn bảo toàn chất lượng và ghi coverage cần test.

Mỗi family có thresholds pixel đã được reviewer duyệt. Hysteresis dùng hai biên khác nhau cho upgrade/downgrade và giữ mức hiện tại trong vùng giữa. Selection/focus ưu tiên LOD0, guided và WebXR sử dụng cùng bounds/hotspot frame. Unit tests phủ ba mức, FOV/viewport/radius khác nhau, rapid oscillation, invalid values và missing levels.

## Ownership và chuyển mức

`ModelLodSet` tùy chọn là input fixture đáng tin cho scene, có usage literal `fixture`, source checksum, master normalization, pixel thresholds và level descriptors theo `PublicModel`. Descriptor đi qua API route pattern hiện có được mocked trong fixture test với checksum thật của GLB. Usage fixture thể hiện phạm vi test. Runtime production vẫn đi theo descriptor hiện hành cho đến khi backend variant contract được duyệt.

`RoomModelLods` điều phối `RoomModelAssets.request()` idempotent theo checksum. Owner duy trì hai download cùng lúc, abort cùng room và retry/failure state theo asset. Một family giữ visible asset khi desired variant đang tải. Chỉ đổi model primitive sau khi ready, parent exhibit/pedestal/label/selection giữ cùng identity. Tải thất bại giữ visible fallback hoặc dùng LOD0 hiện có theo khả năng thực tế.

Cache ban đầu giữ tối đa một inactive variant mỗi family và bốn inactive toàn room. Eviction chỉ tác động asset ready đã hết consumers, sau React detach. Shared checksum dùng bởi nhiều display có usage accounting, tránh dispose geometry đang gắn scene. Đóng room abort queued/in-flight và dispose resources một lần, late parse success cũng cleanup.

## Kiểm chứng behavior

Browser fixture phải hiển thị GLB sinh thật qua scene hiện có, đếm request từng URL, đổi camera/selection để chứng minh độc lập levels. So sánh normalization, hotspot coordinates, selected picking, focus camera và resource counters trước/sau nhiều lượt switching. Kiểm tra model load failure, room exit giữa parse, StrictMode, context restore và XR simulation. GPU/heap leak-free và headset thật cần evidence tương ứng trước nghiệm thu.
