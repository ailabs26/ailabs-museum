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

- [ ] **1 — Plan và discovery.** Đọc source/import graph, docs và tests liên quan; lưu thiết bị/công cụ thực sự quan sát được. Commit tài liệu trước code.
- [ ] **2 — Metrics + collector + production opt-in.** `museumAuditMetrics.ts`: schema v1, `analyzeMuseumAudit(unknown)` validate và tổng hợp nearest-rank; `museumAudit.ts`: bounded recorder; `museumAuditBrowser.ts`: render observer + browser observations; `MuseumAuditPanel.tsx`: manual controls; integrate MuseumPage/SceneLifecycle. Viết unit tests RED trước: missing/invalid/nonmonotonic samples, quantile, insufficient duration, idle, truncation, mount segmentation, export. Browser tests: off không import/record, idle on/off bằng nhau, input ghi submission, export schema, cleanup và room switch. Interfaces: JSON v1 là đầu vào CLI và report; không sửa API.
- [ ] **3 — Analysis/reproducible benchmark.** Node CLI dùng lại TS metrics (Node >=22.18), nhận JSON files, xuất per-run và variation theo cùng device/scenario/workload. Benchmark fixture production bằng Playwright; chỉ desktop thật nếu renderer/hardware xác nhận, không dùng software FPS nghiệm thu. Warmup10s, capture30s, >=3 run chính; P07 10 phút nếu môi trường phù hợp. Không hard gate FPS trong CI.
- [ ] **4 — Verification/report.** Chạy typecheck/lint/unit/build, scene/performance/resource/fullscreen/mobile/fallback/XR regression; lưu command/exit/log và raw evidence thực. Review toàn diff, commit độc lập. Báo cáo P01–P10 và gaps; không push/PR/merge.

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
