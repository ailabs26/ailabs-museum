# Kế hoạch benchmark

Áp dụng giao thức của `../261104-real-device-3d-performance-audit/measurement-protocol.md`. Audit cũ có fixture 0 GLB và unresolved post-GC heap growth, các số cũ là ngữ cảnh lịch sử. Task này cần before/after cùng asset và cùng điều kiện.

## Hai cấp đo

1. Offline ghi source/candidate bytes, geometry bytes, embedded texture bytes, vertices/triangles, bounds/surface errors, processing time và versions. Decode roundtrip chứng minh file có thể đọc bằng decoder thật. Tính savings từ byte count thực.
2. Browser fixture đi qua scene/Preview thực ghi HTTP bytes/request identity, download timing, GLB parse/decode timing nếu tách được bằng instrumentation, first visible/full-detail mốc được quan sát, renderer counters và switching/lifecycle. Ghi rõ routing/caching và browser GPU software/hardware.

## Thiết kế A/B

Cùng commit/build, asset source, viewport/DPR, camera pose/tuyến, lighting/exposure, tier và network. Ghi cold/warm semantics, preload decoder và worker initialization. Mỗi capture steady ít nhất 30 giây sau warmup 10 giây, ba run tương đương cho hardware performance. Idle demand-loop, startup và switching hitches là captures riêng. Không build/test nặng đồng thời capture.

| Metric | Baseline/optimized cần lưu |
| --- | --- |
| Transfer | GLB/geometry/texture bytes và request timing |
| Decode | Worker init, Draco decode, parse, embedded-image decode khi tách được |
| Display | First visible proxy và full-detail proxy, mô tả observer |
| Workload | Triangles, draw calls, texture/geometry/program counts, LOD hiện tại |
| Frame pacing | Submission intervals P50/P95/P99, mean submission FPS và profiler scope |
| Memory | JS heap khi browser hỗ trợ, resource counts, GPU bytes estimated với công thức hoặc unavailable |

GPU execution time, VRAM và presented FPS yêu cầu phép đo chuyên biệt. Resource counts chỉ chứng minh counters quan sát được. WebP/Draco transfer savings và LOD triangle reduction được báo riêng.

## Lifecycle

Đổi LOD gần/xa và select/focus lặp lại, rời phòng khi download/parse, đóng/mở scene, đổi room mười lần, context loss/restore test, cache budget và idle. Đối chiếu settled counters ở cùng view. Chỉ kết luận leak-free sau khi có retained-heap/resource analysis đủ phạm vi.

## Trạng thái

Số liệu offline và Chromium/SwiftShader fixture đã được thu trong `performance-report.md` và raw JSON evidence. Mục tiêu desktop 60 FPS/mobile 30 FPS cần thiết bị thật và ba run đúng protocol. Mobile emulation và XR simulation có coverage riêng trong regression logs. Physical GPU/VRAM/heap retention và live controlled-network benchmark còn chờ thiết bị/dataset.
