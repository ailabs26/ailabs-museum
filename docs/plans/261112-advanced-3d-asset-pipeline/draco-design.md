# Thiết kế Draco

## Encoder offline

glTF Transform đọc/ghi GLB với extension registry được giới hạn, draco3dgltf encode và decode roundtrip. Pin package versions và config trong manifest. LOD0 dùng geometry master với compression conservative, simplification dành cho mức LOD thấp hơn. Bản 1 cung cấp profile conservative cố định. Profile balanced/aggressive cần benchmark và quality review riêng trước triển khai.

Quantization positions/normals/UV/color phải có cấu hình rõ và bounds-error gate. Bit depth cao giảm sai số tọa độ nhưng kết quả cần đo trên từng asset. Ghi vertices/triangles, scene hierarchy, transforms, material/PBR, texture role và bounds trước/sau decode. Từ chối features thiếu bảo đảm như skinning/morph/animation nếu pipeline chưa có test chứng minh bảo toàn. Candidate failed/unsupported giữ master và reason.

Cấu hình triển khai ban đầu được chọn là position 20 bits, normal/UV/color/generic 16 bits. Bounds tolerance và relative surface tolerance mặc định 0,005, ghi rõ phương pháp tính trong manifest/code. Đây là ngưỡng candidate tự động ban đầu, vẫn cần review từng asset. Input core glTF static là tập hỗ trợ đầu tiên. Input đã có extensions, sparse accessors, morph, skin, animation hoặc cameras được báo `UNSUPPORTED` theo policy package ban đầu. Recompression source đã nén bị phát hiện từ extensions.

Draco giảm geometry transfer bytes. Sau decode cùng topology vẫn cần geometry GPU tương ứng. Báo riêng download, worker initialization, decode và parse để lượng hóa chi phí CPU.

## Parser runtime dùng chung

Tách cấu hình GLTFLoader/LoadingManager vào shared helper được public loader và Preview cùng gọi. Module quản lý một DRACOLoader dùng tài nguyên decoder self-hosted khớp bản Three.js đã cài, giới hạn worker và giải phóng loader theo lifecycle ứng dụng phù hợp. Decoder files phải có trong build và license đi kèm. WASM và JS fallback cần ca browser thực với resource bị chặn để chứng minh đường dự phòng.

Thêm `KHR_draco_mesh_compression` đúng whitelist sau khi parser đã cấu hình. `EXT_meshopt_compression` và `KHR_texture_basisu` tiếp tục theo policy chưa có decoder tương ứng. Buffer/image URI vẫn bị chặn trước parse. LoadingManager chỉ cho image blob nội bộ và decoder ứng dụng đã định danh, tránh mở fetch tùy ý từ GLB.

Public loader giữ download abort, byte count, SHA-256 và sanitize/normalization. Parse thành công đến muộn sau abort phải dispose toàn bộ scenes/quarantine trước trả về. Preview giữ abort và ownership riêng, dùng cùng parser/validation để tránh lệch khả năng hỗ trợ.

## Ma trận kiểm chứng

| Ca | Điều cần quan sát |
| --- | --- |
| Legacy GLB | Load, sanitize, normalize như base |
| Draco hợp lệ | Decode bytes thật, Preview và public tour render được |
| Draco hỏng | Error cục bộ, fallback/cleanup, model khác còn hoạt động |
| Required extension lạ | Bị từ chối trước parse |
| External buffer/image | Bị từ chối trước request ngoài |
| SHA-256 sai | Public loader dừng trước decode |
| Abort fetch/parse | Request hủy hoặc late resources được dispose |
| WASM/decoder thiếu | Lỗi rõ, đường fallback đã test, không treo room |
| Repeated mount/teardown | Worker/resource ownership có giới hạn |

Trạng thái thực thi từng ca nằm trong `verification.md`.
