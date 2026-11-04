# Real-device 3D Performance Audit — Implementation Plan

> Thực thi inline theo yêu cầu người dùng, dùng writing-plans, executing-plans và TDD. Spec là yêu cầu “Real-device 3D Performance Audit — Aura Museum” ngày 2026-11-04; người dùng yêu cầu tiếp tục sau plan, không chờ duyệt lại thiết kế.

**Goal:** cung cấp phép đo production có thể tái phân tích, kiểm chứng regression và báo cáo trung thực về GPU/điện thoại thật.

**Base:** `origin/dev` = `3ccdd731b0f04139963fbf68ecb04e5f36eaab77`, fetch ngày 2026-11-04. Cây ban đầu sạch, nhánh cũ `feat/vt080-user-restore` được giữ nguyên. Task branch: `chore/3d-performance-audit` trong checkout người dùng chỉ định.

## Hiện trạng và invariant

- MuseumPage sở hữu API đã validate, URL và immersive lifecycle; MuseumScene là lazy Canvas duy nhất, `frameloop="demand"`.
- MuseumControls là owner camera web, invalidate khi input/transition; MuseumXr dùng cùng renderer, tách camera web khi XR. Không can thiệp các owner này.
- getMuseumQuality: <=4 cores, <=4 GiB hint hoặc coarse + cạnh viewport ngắn <=900 chọn low (DPR1/shadow0/anisotropy2); còn lại balanced (DPR1.5/shadow1024/anisotropy4). Đây là heuristic, không phải GPU benchmark.
- GalleryArchitecture instancing; GallerySurfaces chia sẻ tám texture 512² và vật liệu trong room owner, dispose khi unmount. MuseumLighting dispose PMREM/environment; SceneLifecycle guard render và phục hồi context. GLB validate/checksum → parse → sanitize → normalize, hai lượt tải đồng thời, dedupe checksum trong phòng; abort/dispose khi rời phòng.
- Probe Playwright dùng WeakRef, bọc renderer.render, giữ 300 timestamps và traverse chỉ lúc đọc; regression hiện có đếm calls/triangles/geometries/textures/contexts/heap. Không có UI export trên điện thoại, percentile hoặc schema raw audit.
- Số đo cũ 3.11 FPS, init 2166ms là Edge/SwiftShader + fixture 5 hình khối, không phải physical baseline. GPU resource counts không phải GPU bytes. Heap sau GC vẫn tăng trong báo cáo cũ, chưa chứng minh không leak.

## Quyết định kiến trúc

Tái dùng regression probe; thêm collector nhỏ opt-in `?museumAudit=1`, lazy-load panel và observer từ lifecycle hiện có. Panel có Start/Stop/Export, dùng được trước mở 3D và trong fullscreen. Bọc render hiện có, chỉ ghi sau submission thành công; không dùng rAF độc lập, không invalidate, không takeover R3F render priority. Scalar metadata/resources, không giữ scene/camera/renderer trong export. Snapshot resource tối đa 1 lần/giây tại render thực; không traverse mỗi frame.

Ưu tiên profiler hệ thống cho GPU time, presented frames, GLB parse/decode và texture upload. Không thêm hook sâu vào loader trước baseline. GPU bytes/time mặc định unavailable; ước lượng texture có công thức riêng trong report, không giả làm measured.

Overhead: hai lần đọc clock và append tuple/frame, counters tối đa 1 Hz, PerformanceObserver longtask nếu có; bộ nhớ bị chặn, mất sample phải vô hiệu hóa nghiệm thu. Không timer/rAF mới. Khi tắt: không import observer/panel, không wrapper/listener/collector. Khi đóng/route change: restore render, disconnect observer, remove listeners. Bỏ query param và reload tắt hoàn toàn. So sánh instrumentation on/off về idle bằng probe độc lập; overhead CPU/GPU vật lý cần phép đo A/B cùng workload.

## Tasks / giao diện / proof

- [x] **1 — Plan và discovery.** Đọc source/import graph, docs và tests liên quan; lưu thiết bị/công cụ thực sự quan sát được. Commit tài liệu trước code.
- [x] **2 — Metrics + collector + production opt-in.** `museumAuditMetrics.ts`: schema v1, `analyzeMuseumAudit(unknown)` validate và tổng hợp nearest-rank; `museumAudit.ts`: bounded recorder; `museumAuditBrowser.ts`: render observer + browser observations; `MuseumAuditPanel.tsx`: manual controls; integrate MuseumPage/SceneLifecycle. Viết unit tests RED trước: missing/invalid/nonmonotonic samples, quantile, insufficient duration, idle, truncation, mount segmentation, export. Browser tests: off không import/record, idle on/off bằng nhau, input ghi submission, export schema, cleanup và room switch. Interfaces: JSON v1 là đầu vào CLI và report; không sửa API.
- [x] **3 — Analysis/reproducible benchmark.** Node CLI dùng lại TS metrics (Node >=22.18), nhận JSON files, xuất per-run và variation theo cùng device/scenario/workload. Benchmark fixture production bằng Playwright; chỉ desktop thật nếu renderer/hardware xác nhận, không dùng software FPS nghiệm thu. Warmup10s, capture30s, >=3 run chính; P07 10 phút nếu môi trường phù hợp. Không hard gate FPS trong CI.
- [x] **4 — Verification/report.** Chạy typecheck/lint/unit/build, scene/performance/resource/fullscreen/mobile/fallback/XR regression; lưu command/exit/log và raw evidence thực. Review toàn diff, commit độc lập. Báo cáo P01–P10 và gaps; không push/PR/merge.

## Acceptance

- Metrics từ render submissions, cold/idle/continuous tách riêng; raw JSON bounded có metadata, thời gian, schema; export tái phân tích được.
- Continuous primary run chỉ eligible khi >=30s, >=100 intervals, không mất sample/hidden/context loss, cùng workload ổn định; >=3 run tương đương. Mean FPS là intervals / tổng thời gian giữa submissions; median/p5 là percentile instantaneous FPS. Desktop >=60, mobile >=30 theo mean FPS (sai số cadence công bố); median và p95/p99 pacing báo riêng, không che jank bằng average. Presented FPS/GPU time chỉ kết luận khi profiler hỗ trợ.
- Desktop GPU vật lý + tối thiểu ba cấu hình điện thoại vật lý để nghiệm thu coverage; thiếu máy ghi NOT MEASURED. Không emulation thay thế physical.
- Không thay lighting/materials/quality defaults/camera/XR/backend/database/auth/migrations. Không dependency mới, không telemetry, không secrets/build output.

## Review focus / rủi ro

1. Khoảng idle và khoảng giữa renderer phải không biến thành steady-state FPS: phân đoạn theo renderer, explicit workload kind, duration validation.
2. Context lost/thrown render không thành sample thành công; cleanup không phục hồi wrapper đã bị owner khác thay.
3. Tab hidden, buffer đầy, export invalid không thể PASS; test các điều kiện này.
4. Route/fullscreen/room switch giữ panel điều khiển được và không giữ renderer đã đóng; regression + observer disposal test.
5. Hints/GPU strings không chứng minh model/thermal/refresh rate; không suy đoán thông tin thiếu. Live API/ADB/máy iOS có thể không sẵn có.

## Nhật ký thực thi

- Plan được viết trước thay đổi source. Discovery: ADB không có trong PATH hoặc Android SDK mặc định; không có process ADB hay thiết bị Android/iPhone/WPD được trả về bởi truy vấn thiết bị hiện hữu. API localhost:3001 chưa truy cập được. Cấu hình hệ thống đọc được bằng truy vấn read-only nâng quyền; chi tiết trong evidence.
- Task2 hoàn tất tại `a41878e`: baseline218 unit, sau bổ sung236 unit, production audit6/6 khi chạy lặp. Lỗi quan sát texture trong test được giải quyết bằng đợi Canvas mount trước đếm surfaces; không đổi material/render loop.
- Task3 công cụ hoàn tất tại `7971b44`; CLI thiếu implementation thất bại trước khi viết, sau đó test tái tính/schema/grouping pass. Manual hardware run chỉ bật bằng env rõ ràng, không đặt FPS gate CI.
- Review độc lập read-only trên `3ccdd73..7971b44`: không Critical; ba Important (mixed/unready workload eligibility, route phụ thuộc tốc độ automation, invalid repeats vào aggregate). Cả ba được sửa trong một pass tại `2bb7833`; metrics/CLI regressions RED→GREEN, route có pure elapsed-time test; toàn suite244/244 pass. Hai Minor về headless metadata và scope warm cache đã được xử lý bằng fixture thật và protocol minh bạch.
- Ruling: chỉ sửa test lifecycle có false positive do HomePage có HeroCanvas hợp lệ. Giữ kiểm tra context của renderer bảo tàng đã retire và zero museum Canvas, không sửa renderer/trang chủ. Chi phí nếu scope sai: có thể bỏ sót context ngoài bảo tàng; nằm ngoài nhiệm vụ, museum WeakRef/context và room budgets vẫn được kiểm tra riêng.
- Regression rộng trên production:92 pass/2 fail/2 hardware skips; lỗi lifecycle scope nêu trên, một teleport XR chưa xác định nguyên nhân trong lượt rộng. Sau sửa test lifecycle, nguyên file audit+lifecycle+XR17/17 pass; không đổi XR implementation để che lỗi. Giữ rủi ro timing của ca XR ban đầu trong báo cáo.
- Final review disposition: các Important được verify bằng tests, không có thay đổi engine/backend. Unverified boundaries từ reviewer (physical FPS/10 phút, iOS, overhead, exact first pixel) phải đối chiếu evidence riêng, không coi review source là phép đo.
- Hardware warm-up đầu bị panel collapsed che toolbar: dừng đúng process tree của benchmark, không lấy FPS. Regression pointer-interception RED→GREEN; `d4e1d56` chuyển collapsed audit ra nút44px trên header giữa,3/3 audit tests pass. Không chỉnh camera/controller để né lỗi.
- Hardware tại source `d4e1d56`:2/2 benchmarks pass trong14.5 phút;3 P03 captures30s đều eligible/mean≈90FPS; idle30.012s/0frames; P07 601.269s/54030frames/mean89.867FPS;10 mounts/10 switches/50 selections. Browser ANGLE Intel/D3D11 đối chiếu GPU thật. Chỉ fixture5 minh họa/0GLB, headless; chưa physical phone/live API.
- Post-GC released heap11.43→14.12MB qua10 mounts; contexts retire và reset resource counts bằng nhau không chứng minh leak-free. Long resource residency67→71 geometry/15→16 texture rồi plateau, programs12; report giữ nguyên rủi ro và không nới budget static70.
- CLI optional cần native TS: guard/test tại `03a2990`, RED khi tắt stripping trước sửa, GREEN sau sửa;244/244 unit, typecheck/lint pass. Runtime app không đổi, smoke CLI skip khi runtime cũ thiếu native TS. Không cần build lại app vì chỉ CLI/test thay đổi sau source đo.
- Camera checkpoint cho thấy route input tương đương nhưng pose không pixel-identical (nearest-time maximum0.789m); báo cáo giới hạn, không dùng variance nhỏ để suy GPU headroom. Source/report/evidence đã được self-review; raw schema và hash manifest kiểm tra toàn dataset. Physical mobile, live P05, exact presented frames, GPU timer/memory và A/B overhead vẫn NOT MEASURED.
