# Giao thức đo tái lập

## Chuẩn bị

1. Checkout đúng audit commit, `cd front-end`, Node >=22.18 cho analysis CLI. Chạy `npm.cmd run build`, ghi SHA bằng `git rev-parse HEAD`; chỉ dùng preview của build đó. Backend NestJS phải do nhóm cấu hình sẵn; không seed/migrate hoặc tự sửa CORS/database.
2. Desktop/USB: terminal riêng `npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort`. Android: cài Android platform-tools chính thức, bật Developer options/USB debugging, kết nối và chấp nhận RSA; `adb devices -l` phải có trạng thái `device`. Không commit serial. `adb reverse tcp:4173 tcp:4173` và `adb reverse tcp:3001 tcp:3001`; mở `http://localhost:4173/tour?museumAudit=1`. API origin 4173 phải đã được backend cho phép; nhờ người phụ trách cấu hình nếu không, không bypass CORS.
3. Chrome desktop `chrome://inspect/#devices` → Inspect tab điện thoại. Tắt CPU/network throttling, không bật screencast khi đo chính. LAN dùng `--host 0.0.0.0`; API build phải trỏ host NestJS truy cập được (localhost trên phone là phone). Không đổi/commit `.env`. HTTPS đáng tin cậy cần cho WebXR/crypto GLB trên LAN; USB reverse localhost là secure context. Xác nhận firewall/CORS theo cấu hình nhóm.
4. iPhone: dùng cùng Wi-Fi và HTTPS có certificate được máy tin cậy; Settings → Safari → Advanced → Web Inspector; kết nối Mac, Safari → Develop → iPhone → tab. Safari Windows không có Web Inspector iOS. Không giả lập iPhone để nghiệm thu.
5. Ghi đầy đủ các trường device-matrix; refresh rate dùng OS setting + profiler display cadence, không suy ra từ rAF riêng. Đóng tab/app nặng, battery >=30%, power saver tắt, ghi cắm điện/thermal; nghỉ giữa runs nếu throttling. Không so các điều kiện khác nhau.

## Thu mẫu

- Bật query `museumAudit=1` từ lúc mở trang. Panel trước 3D và trong fullscreen có Start/Stop/Export JSON. Cung cấp SHA build 40 ký tự, device/điều kiện, scenario, loại workload và nguồn dữ liệu. Trường chưa quan sát phải ghi unavailable, không đoán.
- P01: clear cache bằng browser tooling, Start loại startup trước nhấn Mở phòng 3D. Đo click→first submission qua Performance trace/user timing riêng; first submission chưa chắc usable. Ghi mốc DOM `Đã tải n/n`, gallery textures decoded và interaction thành công để xác nhận usable. Không đưa cold intervals vào steady FPS. P02 cache giữ nguyên, đóng/mở; GLB owner chủ động tải lại, HTTP cache tùy response; không gọi đây là GLB cache RAM.
- P03: mở phòng, đợi GLB thành công + texture đủ và warmup10s. Start continuous, điều hướng liên tục30–60s cùng tuyến (desktop WASD + drag; phone joystick + look), Stop. Lặp3 lần. Không đứng ép vào tường trong cả run hoặc giữ một góc ít hình học; lưu route/camera trace/screenshots theo checkpoint.
- P04: cùng room, chọn từng hiện vật theo thứ tự, focus và đóng detail; lặp chu kỳ30–60s x3; khoảng dừng có chủ ý dùng loại lifecycle, không kết luận FPS liên tục trên khoảng idle. Trace tương tác để đo INP/raycast/focus.
- P05: chọn phòng phức tạp nhất từ API hợp lệ sau inventory read-only (model count, bytes, geometry/texture counters); ghi expected/ready/error GLB. Không tuyên bố fixture là live complex room. Chạy P03 route tương đương x3.
- P06/P08: loại lifecycle, đổi phòng/mở đóng10 lần, chờ settled mỗi lượt, ghi counts/context tại checkpoint bằng probe/regression hoặc inspector. Không gộp intervals qua context thành FPS.
- P07: >=600s, cùng tuyến theo chu kỳ, capture liên tục bounded; checkpoint mỗi60s về heap/counters/thermal. Có thể tách run60s liên tiếp kèm wall-clock timestamps để tránh cap; phải chứng minh đủ10 phút, không dùng run ngắn đại diện. Heap timeline không force-GC trong FPS run chính; dedicated leak experiment chụp heap sau GC sau mỗi close.
- P09: xoay portrait/landscape3 vòng; ghi viewport, DPR, tier, render size trước/sau và touch còn hoạt động. Đo performance riêng từng orientation, tránh trộn resize hitch vào steady-state.
- P10: regression no-WebGL/model-failure; context loss chỉ local test bằng WEBGL_lose_context, restore có kiểm soát, kiểm tra fallback và exit; không chạy gây mất context trên phiên người dùng đang làm việc.
- Idle: riêng loại idle, đợi settled, giữ30s; frame submissions phải ngừng. FPS null/N/A là đúng demand loop, không phải FAIL.

## Độ tin cậy và công cụ

Raw ghi timestamp của render submission (clock monotonic), CPU elapsed của lời gọi renderer, resource scalars và lifecycle. Không phải GPU duration hoặc presented FPS; driver queue, VSync, compositor và XR multi-view làm các đại lượng khác nhau. Không có rAF benchmark riêng. Nearest-rank percentiles trên interval giữa submissions cùng renderer; không nối renderer lifetimes. Ngưỡng >16.67/>33.33ms là budget exceedances, không phải số dropped frames được xác nhận; chỉ dùng profiler Frames để kết luận displayed drops. Clock jitter quanh60Hz làm mean hơi dưới60: báo raw/độ biến thiên, không round trước phân loại hoặc âm thầm nới ngưỡng.

Chrome Performance: record riêng10–15s với Frames/Main/GPU tracks nếu có, memory và screenshots tùy cần; save trace. CPU main/render submission không tương đương GPU-bound. GPU timer extension chỉ dùng nếu công cụ hỗ trợ và loại disjoint; tool không có ghi unavailable. System GPU process memory có thể gồm tab khác, phải ghi scope; không dùng heap hoặc renderer count làm GPU MB. Safari Timelines/Web Inspector dùng tương tự, ghi các metric không hỗ trợ. Network timing GLB không tách decode/parse; CPU trace và embedded-image decode cần kiểm tra riêng.

Không mở profiler nặng trong run chính; so A/B cùng tuyến opt-in on/off x3 để đánh giá overhead khi có GPU thật. Harness không invalidate hoặc thêm loop, nhưng instrumentation vẫn có overhead clock/array/counters. Bỏ query và reload tắt toàn bộ observer/panel; không có backend telemetry.

## Phân tích và lưu bằng chứng

Export raw sau Stop, đặt tên `<device>-<scenario>-<orientation>-run<n>.json`. Không sửa raw; nếu metadata sai chạy lại hoặc ghi correction riêng. JSON chỉ có counters/metadata, không model URLs/token/binary; notes do operator nhập cần kiểm tra trước commit. Lưu trace/ảnh profiler thật kèm build SHA. Dùng CLI được mô tả trong README evidence để tái tính; không hard gate60/30 trên SwiftShader/CI. So sánh median/min/max/CV giữa >=3 runs cùng device/scenario/scene/quality/orientation/network; không gộp workload khác.
