# Performance Audit Report — Aura Museum

Ngày audit: **2026-11-04**, Asia/Saigon. Phạm vi: đo đạc, instrumentation opt-in, regression và handoff; không tối ưu/redesign engine.

## 1. Executive Summary

Đã bổ sung công cụ đo production và tái phân tích JSON, kiểm chứng logic/lifecycle, thu ba baseline desktop trên GPU vật lý Intel Iris Xe. **P03 fixture PASS mục tiêu 60 submission FPS**: ba run eligible đạt mean 90.0019–90.0040 FPS. Phiên dài 601.27 giây đạt mean 89.87 FPS, P95 12.3 ms. Idle 30.01 giây có 0 submissions, đúng demand loop.

**Memory còn rủi ro mở:** 10 lần đóng/mở đều trả context live về 0 và giữ resource cùng góc nhìn bằng nhau, nhưng JS heap sau GC tăng 11.43→14.12 MB. Chưa xác định retained objects, không kết luận leak-free. Hardware benchmark 2/2 pass; các phép đo dùng GPU thật nhưng browser headless, workload chỉ là fixture.

**Chưa đủ nghiệm thu toàn nhiệm vụ:** không có ba cấu hình điện thoại vật lý truy cập được, thiếu iPhone/Safari và API local không hoạt động. Fixture5 hình khối/0 GLB không đại diện phòng live nhiều GLB. GPU memory chính xác, GPU frametime và presented display FPS hiện unavailable. Không dùng SwiftShader hoặc mobile emulation làm bằng chứng thay thế thiết bị thật.

## 2. Build & Environment

- Base `origin/dev`: `3ccdd731b0f04139963fbf68ecb04e5f36eaab77`, fetch trước chỉnh sửa. Branch `chore/3d-performance-audit`; cây ban đầu sạch, giữ nguyên nhánh cũ.
- Source build đo: `d4e1d5647a271cdae808ece9e8210ef6fcad2cef`. Vite production preview, Node 24.8.0, Edge 156.0.4314.58, WebGL2. Manual hardware mode không ép software ANGLE; CI/regression vẫn mặc định SwiftShader.
- D01: ASUS Vivobook X1405VA; i5-13500H/16 logical processors; Iris Xe driver 32.0.101.7076; RAM 16786575360 bytes; Windows 11/10.0.26200. Browser renderer đối chiếu với CIM: `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
- Browser **headless hardware-rendered**, không certify presented frames trên màn hình. Viewport1280×720, DPR1; balanced, DPR cap1.5/shadow1024/anisotropy4. Refresh rate vật lý không quan sát được, không suy từ 90 FPS.
- Workload `tests/fixtures/museumContent.ts` roomA: 5 hình khối minh họa, 0 GLB, gallery textures512², dữ liệu intercept qua validation API. Network loopback. Pin/AC lúc chạy trong raw conditions; Balanced power plan. Thermal/battery-saver unavailable. Browser memory/concurrency chỉ là hints.
- ADB không có trong PATH/SDK mặc định/process; PnP present không trả về Android/iPhone/WPD. Không có mobile debug session truy cập được. TCP localhost:3001 thất bại; không tự seed/migrate/sửa backend để có dữ liệu.

## 3. Methodology

Observer lazy-load chỉ khi `?museumAudit=1`, bọc `renderer.render` sau guard hiện có. Chỉ ghi khi lời gọi thành công, frame counter tăng và context chưa lost. Timestamp là **bắt đầu render submission**; elapsed là CPU đồng bộ của lời gọi render. Không có rAF benchmark độc lập, không thêm invalidate, không takeover render priority hoặc thay camera/XR.

Mean FPS = số interval hợp lệ×1000/tổng interval, không phải trung bình FPS tức thời. Median/P5 FPS: nearest-rank trên1000/interval; median/P95/P99 frametime: nearest-rank trên interval. 1% low =1000/trung bình1% interval chậm nhất, chỉ khi>=100 interval. Không nối interval qua renderer lifetimes.

Primary continuous: warmup 10s, Home/reset + settle 500 ms, capture 30 s, lặp 3. Key direction và sinusoidal look cùng dựa trên monotonic elapsed time; camera checkpoints1 Hz để đối chiếu tuyến. Eligible yêu cầu>=30 s,>=100 interval, không dropped samples/hidden/context error/resize, workload/quality ổn định và đủ GLB thành công. CLI chỉ tính variance/đủ 3 lần từ **run eligible**; vẫn giữ run lỗi dưới dạng diagnostic. Eligible không tự chứng nhận thiết bị vật lý.

Đối chiếu mục tiêu bằng **mean submission FPS chưa làm tròn của từng run eligible**: desktop>=60, mobile>=30; yêu cầu>=3 run tương đương. Median/P5 và pacing báo riêng: FPS trung bình cao không chứng minh khung hình ổn định. Exceedance >16.67/>33.33 ms là vượt budget, **không** phải confirmed displayed drops; jitter quanh VSync có thể vượt ngưỡng. Không nới/round ngưỡng để biến FAIL thành PASS.

Idle30 s đo riêng sau settled: không có submissions là demand loop đúng, FPS N/A. Profiler trace10s thu riêng sau primary runs. P07 dùng 10 đoạn60 s nối nhau, không remount/reset mỗi phút; raw giữ input-release gaps ngắn giữa đoạn. Không build/chạy test nặng đồng thời với capture.

P01/P02: click mark→Canvas visible và→interaction đã xác minh; mốc sau gồm idle check1s và automation nên là **upper bound**, không phải exact first presented/usable frame. Observer attach bất đồng bộ có thể bỏ lỡ frame đầu. Playwright routing tắt HTTP cache: warm-reopen chỉ là cùng JS/process, không chứng minh warm HTTP-cache performance. GLB transfer/parse/decode và texture-decode duration cần cold/live trace, không suy từ fixture 0 GLB hoặc network bytes.

Overhead: clock reads, scalar state checks, tuple append/frame; resource và pose snapshot tối đa1 Hz, workload event khi đổi props/dimensions. Không traverse scene mỗi frame. Cap120000 frames,1200 resources,4000 events; dropped observations làm run không eligible. Chưa định lượng A/B overhead, không giả định bằng0. Export/validation cấp phát bản sao sau Stop. Collector chỉ giữ JSON/scalars, không giữ renderer/scene/camera. Stop disconnect longtask/visibility/resize/pagehide; unmount restore render/remove context listeners. Bỏ query và reload tắt hoàn toàn; off regression xác nhận không tải audit chunk và không tăng idle frames.

## 4. Device Matrix

| Device | Cấu hình/coverage | Trạng thái |
| --- | --- | --- |
| D01 desktop | Iris Xe vật lý + Edge headless hardware, fixture 5 hình khối/0 GLB | Có baseline submission; không certify displayed FPS/live room |
| A01 Android thấp | Model/SoC/RAM/OS/browser N/A — chưa có thiết bị | BLOCKED — PHYSICAL DEVICE REQUIRED |
| A02 Android trung | N/A — chưa có thiết bị | BLOCKED — PHYSICAL DEVICE REQUIRED |
| A03 Android cao | N/A — chưa có thiết bị | BLOCKED — PHYSICAL DEVICE REQUIRED |
| I01 iPhone/Safari | N/A — thiếu thiết bị/macOS inspector | NOT MEASURED — iOS coverage gap |

Chi tiết metadata bắt buộc và ma trận P01–P10: [device-matrix.md](device-matrix.md).

## 5. Benchmark Results

| Device | Scenario | Run count | Median FPS | P5 FPS | P95 Frametime | GPU Memory | Evidence | Status |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| D01 Iris Xe | P03 fixture continuous |3|90.09 mỗi run|77.52–81.97|12.2–12.9 ms|unavailable|[raw + analysis](evidence/desktop/analysis.json)|PASS submission target; 3/3 eligible |
| D01 Iris Xe | P07 fixture 601.27s |1|90.09|81.30|12.3 ms|unavailable|[raw10min](evidence/desktop/desktop-P07-10min.json)|PASS thời lượng; chưa có 3 long runs |
| D01 Iris Xe | Idle30.01s |1|N/A|N/A|N/A|unavailable|[idle raw](evidence/desktop/desktop-idle.json)|PASS demand idle,0 submissions |
| D01 Iris Xe | P06/P08 lifecycle |10 switch/10 mount|N/A|N/A|N/A|unavailable|[lifecycle](evidence/desktop/desktop-lifecycle.json)|Context/resource PASS; heap risk OPEN |
| Android thấp/trung/cao | P01–P10 |0|N/A|N/A|N/A|unavailable|environment discovery|BLOCKED — PHYSICAL DEVICE REQUIRED |
| iPhone/Safari | P01–P10 |0|N/A|N/A|N/A|unavailable|environment discovery|NOT MEASURED — thiếu thiết bị/inspector |

### Frame details

| Run | Duration | Frames/intervals | Mean FPS | 1% low FPS | Median/P95/P99 ms | >16.67 ms | >33.33 ms | CPU render median/P95 ms |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| P03-1 |30.096s|2705/2704|90.0040|63.90|11.1/12.9/14.8|2 (0.074%)|0|2.7/4.9|
| P03-2 |30.079s|2704/2703|90.0022|62.94|11.1/12.6/14.6|7 (0.259%)|0|2.8/5.1|
| P03-3 |30.065s|2703/2702|90.0019|71.03|11.1/12.2/13.5|0|0|2.3/3.3|
| P07 |601.269s|54030/54029|89.8670|63.52|11.1/12.3/13.6|110 (0.204%)|3 (0.0056%)|2.0/4.2|

Ba run P03 cùng workload/quality/source/build, đều eligible, droppedSamples0; mean giữa runs90.0027, sample SD0.00116 FPS, CV0.00129%. Median FPS90.09 phản ánh nearest-rank/clock precision, không phải refresh vật lý90 Hz. P5 theo từng run77.52/79.37/81.97. Browser longtask observer ghi0 tasks>50 ms trong cả ba run và P07; không đồng nghĩa CPU hoàn toàn rảnh hoặc không có GPU stalls.

Đối chiếu30 pose checkpoints/run theo elapsed time cho sai lệch vị trí tối đa0.789m so run1. Đây là cùng time-indexed input/room/quality, **không phải pixel-identical camera replay**; dispatch, integration và collision gây drift. Không diễn giải variance FPS rất nhỏ thành bằng chứng workload ảnh hoàn toàn giống nhau hoặc số đo headroom GPU. Chi tiết có trong `derived-trends.json#replayComparability`.

P07 có interval dài nhất37 ms; mean theo cửa sổ60 s nằm88.87–90.00 FPS, P99 cao nhất19.2 ms ở phút5. Chưa có bằng chứng giảm tốc kéo dài trong workload này, nhưng không đo thermal nên không loại trừ throttling. [Derived trends](evidence/desktop/derived-trends.json) dùng cùng hàm phân tích cho từng cửa sổ; khoảng1.27s cuối vẫn có trong whole-run analysis.

Trace riêng có 907 `FireAnimationFrame` trong span10078.104 ms và 906 commit/draw compositor events, phù hợp cadence xấp xỉ90 submissions/s. Đây là corroboration browser scheduling, **không** xác nhận physical presentation, GPU duration hoặc một dropped frame từ chênh lệch count.

### Initialization, interaction và lifecycle

First mount sau clear browser cache: click→Canvas visible619.2 ms; click→verified interaction upper bound3012.6 ms. GPU/process đã được dùng bởi benchmark trước, nên không gọi đây là cold GPU-driver initialization. Chín warm-process reopen: Canvas visible635.8–1311.2 ms, median691.9 ms; verified-interaction2397.5–3032.1 ms, median2924.2 ms. Không so cold/warm HTTP cache vì routing tắt cache; không trộn proxy này vào FPS steady-state.

P04 hoàn tất 50 lượt chọn/đóng detail (5 hiện vật×10 vòng); đây là correctness coverage, chưa phải3 steady interaction performance runs. P06 chuyển 10 lần giữa ceramics/sculpture: settled current context live1. P08 đóng/mở 10 lần: context live0 sau mỗi close. Resource cùng phòng/cùng góc nhìn bằng nhau: sculpture57 calls/10112 triangles/61 geometries/14 textures; ceramics41 calls/41 geometries/12 textures. [Lifecycle raw](evidence/desktop/desktop-lifecycle.json) lưu toàn bộ checkpoints.

| Scenario | Phạm vi có thể kiểm chứng | Giới hạn |
| --- | --- | --- |
| P01/P02 | First mount và warm-process reopen, click→DOM/interaction proxies | Chưa có exact first presented frame/HTTP cache/GLB decode live |
| P03 | Desktop hardware fixture cùng tuyến input | Không đại diện phone/live room |
| P04 | Selection/focus/detail qua regression và lifecycle experiment | Chưa có 3 performance traces live interaction tương đương |
| P05 | Chưa có API inventory để xác định phòng phức tạp nhất hợp lệ | NOT MEASURED; fixture không thay thế |
| P06/P08 | Context/resource/heap checkpoints switch/remount | Counters/GC trend không đủ loại trừ mọi leak |
| P07 | Desktop fixture 601.27s hoàn tất,54030 frames | Mobile/live long-session/thermal NOT MEASURED |
| P09 | Emulated touch và viewport portrait/landscape | Không gọi emulated resize là xoay phone thật |
| P10 | No-WebGL, chunk/model failure, context loss/recovery, XR simulation regression | Không certify driver/headset vật lý |

## 6. GPU/Memory Analysis

| Chỉ số | Phân loại | Diễn giải |
| --- | --- | --- |
| Calls/triangles/geometries/textures/programs | measured | Counter Three sau submission; không phải MB hoặc tổng mọi shadow/offscreen pass |
| Browser JS heap/forced-GC heap | measured, browser-specific | JS domain, có thể làm tròn; không phải VRAM |
| Buffer/texture/target inventory | measured dimensions/formats; estimated bytes nếu đủ thông tin | Không chuyển số counts thành MB tùy ý |
| GPU memory usage chính xác | unavailable | WebGL không có portable tab/process VRAM counter; AdapterRAM không phải usage |
| GPU frame duration | unavailable | Chưa có timer/system evidence đáng tin cậy |
| Confirmed displayed drops | unavailable | Submission intervals không xác nhận presented frames |

Tám texture512² RGBA8 đủ mip chain có texel-storage lý thuyết8×4×(512²+256²+…+1)=11184800 bytes≈10.67 MiB, **estimated**. Chưa gồm labels/sign, PMREM, shadow/depth, framebuffer/MSAA, GLB hoặc driver padding. Không phải tổng GPU memory. Buffer-array bytes là CPU data và chỉ ước lượng GPU tương đương nếu được upload.

[Inventory thực](evidence/desktop/desktop-lifecycle.json) và [ước lượng có assumptions](evidence/desktop/estimated-footprint.json):16 referenced textures có tổng texel-storage lý thuyết25.0000 MiB nếu upload tất cả. Trong đó PMREM768×1024 RGBA16F không mip≈6 MiB; shadow color1024² RGBA8≈4 MiB, depth attachment chưa tính. Geometry/instance attribute arrays352416 bytes≈0.336 MiB chỉ là GPU buffer-equivalent estimate. Backbuffer1280×720, antialias true, samples4; một RGBA8 color surface giả định3.516 MiB hoặc14.063 MiB ở4 samples, **không** cộng thành tổng allocation vì format/resolve/swapchain/depth/driver chưa đo.

P07 resident counters tăng 67→71 geometries,15→16 textures, programs giữ 12. Texture 16 lần đầu ở362.43s; geometry 71 ở421.86s rồi giữ71 đến cuối. Reset-view context mới chỉ upload 61 geometries/14 textures; việc khám phá thêm góc nhìn phù hợp với lazy residency, nhưng chưa chứng minh mọi tăng là vô hại. Static budget test70 geometries chỉ kiểm góc reset, không phủ full-route peak71; không nới budget để che số liệu này. Draw calls/triangles thay đổi theo camera, không phải workload contents đổi.

P07 JS heap quan sát18.38→29.63 MB, peak35.49 MB; raw recorder cũng tăng54030 tuples nên trend này không cô lập retained leaks. P08 dedicated forced-GC experiment (không lưu FPS raw trong page đó) vẫn tăng11429800→14121912 bytes, delta2692112 bytes≈2.57 MiB qua10 vòng. Đây là bằng chứng **chưa loại trừ JS retention**; cần heap retainers, thời gian chờ cleanup dài hơn và A/B probe để xác định owner. GPU context retirement/resource reset không chứng minh JS heap leak-free.

Three r170 gọi shadow pass trước `info.reset()` rồi mới main scene:57 calls ở bảng là main-render counter, không bao gồm toàn bộ draw calls của shadow. CPU wrapper elapsed bao quanh lời gọi render nhưng vẫn không đo GPU execution time.

## 7. Bottleneck Analysis

MuseumPage sở hữu validated API/selection/fullscreen; MuseumScene là lazy Canvas demand duy nhất. MuseumControls là camera owner web, XR dùng cùng renderer và tạm ngắt web input. RoomModelAssets dedupe checksum trong phòng,2 tải đồng thời, abort/dispose khi rời; loadMuseumModel kiểm bytes/hash rồi parse/sanitize/normalize. Model clone chia sẻ geometry/material do room owner dispose, skeleton instance cleanup riêng. GallerySurfaces chia sẻ texture/material theo room; labels/sign dispose CanvasTexture; MuseumLighting dispose PMREM/generator/environment. SceneLifecycle guard/context recovery, R3F retire renderer bất đồng bộ.

Quality:<=4 cores hoặc<=4 GiB hint hoặc coarse pointer+cạnh ngắn<=900 chọn low (DPR1/shadow0/anisotropy2); còn lại balanced (cap1.5/shadow1024/anisotropy4). Cạnh ngắn giữ tier ổn định khi đổi orientation. Phone cao vẫn có thể low; Safari thiếu memory hint vẫn theo viewport/pointer. Đây là heuristic, chưa chứng minh phù hợp từng SoC; không thêm adaptive FPS policy khi chưa có số liệu phone.

Chưa có controlled comparison/GPU timer để kết luận CPU-bound hay GPU-bound. CPU synchronous render nhỏ không loại trừ collision/React work trước render hoặc GPU queuing; cadence cao không tự chứng minh saturation. Không mặc định mobile GPU-bound.

Cost candidates cần live profiling: GLB hash/parse/embedded-image decode; raycast/collision nhiều hiện vật; mesh/material/program counts; shadow pass; DPR/framebuffer/MSAA/preserveDrawingBuffer; PMREM initialization; bandwidth/overdraw. Đây là giả thuyết, không phải bottleneck đã xác nhận. Validator đang từ chối Draco/Meshopt/KTX2; follow-up nén asset cần compatibility của loader/pipeline, không chỉ thay file.

## 8. Risk & Recommendations

| Mức | Hành động | Lợi ích/điều kiện |
| --- | --- | --- |
| P0 nghiệm thu | Thu>=3 Android vật lý, desktop live P05, iOS nếu có; cùng build/workload | Lấp coverage gap; không dùng emulation thay thế |
| P1 đo | Cold/live traces cho GLB/texture loading, main-thread/collision/picking; GPU timer/system memory khi hỗ trợ | Chọn tối ưu sau khi xác định bottleneck; lợi ích tốc độ chưa xác định |
| P1 pacing | Đối chiếu submission tails với Frames/compositor trên headed desktop/phone | Xác nhận jank/drop thực |
| P1 lifecycle | Reproduce post-GC growth11.43→14.12 MB, retained-heap analysis/A-B probe, sau đó phòng GLB | Đã có trend tăng thực; chưa rõ owner. Không suy leak-free từ context/resource reset |
| P1 test stability | Theo dõi ca teleport XR từng fail trong lượt rộng rồi pass khi chạy lại nguyên file | Chưa xác định nguyên nhân lần fail đầu; không sửa XR để che audit |
| P2 | A/B overhead, refresh/thermal/power logging và headset thật | Định lượng nhiễu/coverage; chưa certify comfort/tracking |

Không thay lighting/materials/LOD/quality defaults để tăng điểm. Không dependency mới, telemetry backend, API/database/migration/auth/RBAC changes.

## 9. Regression & Quality Gates

| Gate | Kết quả |
| --- | --- |
| `npm.cmd run typecheck` |PASS,exit0|
| `npm.cmd run lint` |PASS,exit0|
| `npm.cmd run test:unit` |PASS,43 files/244 tests; baseline39/218|
| `npm.cmd run build` |PASS,exit0; còn cảnh báo chunk>500kB|
| Production rộng15 files/96 cases |92 pass,2 fail,2 manual-hardware skips;10.3 phút; không phải96/96 xanh|
| Production audit+lifecycle+XR sau review |17/17 pass;4.4 phút|
| Production audit sau sửa collapsed toolbar |3/3 pass;47.1s|
| Manual Iris Xe hardware benchmark |2/2 pass;14.5 phút;3 primary runs,10min,30 s idle,10 mount/switch|

CLI analysis yêu cầu native TypeScript (Node 22.18+/24+), có guard báo lỗi rõ trước import. Smoke CLI skip trên runtime thiếu tính năng để không phá app/tests Node 20 hiện có; pure metric/collector tests vẫn chạy. Máy audit Node 24.8 chạy đầy đủ244 tests, không skip unit; thêm reproduction tắt native TS bằng flag trước sửa guard rồi GREEN. Đây là giới hạn của công cụ phân tích tùy chọn, không nâng runtime mặc định app.

Lượt rộng lỗi lifecycle vì đếm mọi Canvas trên HomePage (HeroCanvas hợp lệ); test nay kiểm museum Canvas và context đã retire riêng. Teleport XR expected z4, quan sát5.8 lần đầu; nguyên file pass khi chạy lại, chưa xác nhận căn nguyên timing. Fullscreen/Escape/focus/scroll, touch joystick/look, gallery/resources, GLB/fallback và context recovery chạy trên production SwiftShader, không certify physical FPS.

Review độc lập read-only phát hiện3 Important: thiếu stable/ready workload eligibility, route phụ thuộc tốc độ automation, aggregate chứa invalid runs. Đã sửa với RED→GREEN tests; whole unit244/244. Headless metadata và cache scope được làm rõ. Warm-up hardware đầu sau đó phát hiện panel collapsed che reset; regression thất bại đúng pointer interception, chỉ sửa UI audit và action timeout;3/3 pass. Lượt bị chặn không có raw30 s/FPS, không dùng nghiệm thu.

## 10. Evidence Index

- [Environment discovery](evidence/environment-discovery.json): CIM/PnP/ADB/API, browser hardware preflight và power.
- [Evidence README](evidence/README.md): cấu trúc raw, CLI và log quality gates.
- [Protocol/handoff Android và iOS](measurement-protocol.md): ADB reverse, LAN/HTTPS/CORS, Safari Mac, UI và CLI.
- [Atomic commits](commit-plan.md): trách nhiệm/SHA và source build đo.
- Analysis CLI/runtime guard tại `03a2990`; không thay application bundle/source đo `d4e1d56`.
- `evidence/desktop/aborted-at-reset-environment.json`: hardware warm-up ban đầu, không phải primary FPS run.
- [Hardware environment](evidence/desktop/desktop-environment.json): battery91%/AC online/charging trước capture, quality/browser/build metadata.
- [P03 run1](evidence/desktop/desktop-P03-run1.json), [run2](evidence/desktop/desktop-P03-run2.json), [run3](evidence/desktop/desktop-P03-run3.json), [P07](evidence/desktop/desktop-P07-10min.json), [idle](evidence/desktop/desktop-idle.json), [analysis](evidence/desktop/analysis.json).
- [Lifecycle/inventory](evidence/desktop/desktop-lifecycle.json), [trends](evidence/desktop/derived-trends.json), [footprint estimate](evidence/desktop/estimated-footprint.json).
- [Browser trace gzip](evidence/desktop/desktop-P03-profiler-trace.json.gz), [ảnh scene đã kiểm tra](evidence/desktop/desktop-fixture.png): fixture minh họa và panel collapsed ngoài toolbar, không phải GLB live.
- [Quality gates](evidence/quality-gates.json), logs trong `evidence/logs/`, gồm lượt fail ban đầu và các lượt recheck xanh, hardware log và RED proofs.
- Số cũ `../261026-immersive-museum-redesign/evidence/after-profile.json`: SwiftShader fixture,3.11 observed drag FPS/2166ms init; chỉ lịch sử, không so tốc độ với hardware mới.

## 11. Final Acceptance

| Tiêu chí | Trạng thái | Phạm vi |
| --- | --- | --- |
| Desktop>=60 submission FPS |PASS,3/3 eligible|Chỉ Iris Xe/Edge headless/fixture 5 minh họa/0 GLB |
| Idle không ép render |PASS|0 frames/30.01s, audit không tăng loop |
| Steady pacing được đo |PASS đo đạc|P95/P99/budget counts có raw; displayed drops/GPU duration unavailable |
| Phiên>=10 phút |PASS đo đạc|601.27s trên desktop fixture; chưa mobile/live |
| GPU resource/context lifecycle |PASS observed checkpoints|10 close live0,10 switch settled live1; không chứng nhận mọi pose/driver |
| Không có memory leak |NOT PROVEN|Post-GC heap tăng; GPU memory chính xác unavailable |
| Desktop live/complex P05 |NOT MEASURED|API không sẵn có, không có room inventory hợp lệ |
| Mobile>=30 trên>=3 cấu hình thật |NOT MEASURED / BLOCKED|Không có phone truy cập được |
| Safari/iOS/headset vật lý |NOT MEASURED|Coverage gap |

**Nghiệm thu tổng thể thiết bị thật: chưa đạt đủ phạm vi.** Bàn giao đầy đủ phần có thể thực hiện và protocol để nhóm hoàn tất device matrix. Không push, tạo PR hoặc merge; PR URL/merge result:N/A theo yêu cầu.
