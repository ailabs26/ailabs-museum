# Báo cáo WebGL và WebXR fallback

Ngày kiểm chứng 6/11/2026, múi giờ Asia/Saigon.

## 1. Tổng quan

**AUTOMATED TESTS COMPLETE — PHYSICAL DEVICE VALIDATION PENDING**

Gate cuối PASS 75/75 trên Edge production preview, không skip hoặc flaky. Unit PASS 261/261. Typecheck, lint và build PASS. Ba ca chọn lọc trên GPU Intel Iris Xe thật cũng PASS 3/3. WebXR dùng API simulation với WebXRManager thật. Headset vật lý, Android và iOS/Safari chờ QA thiết bị.

## 2. Repository và build

- Nhánh `chore/webgl-xr-fallback-matrix`, tạo từ `origin/dev` vừa fetch tại `c10ffa9884f54e45203522e1b57d8bd01a1cf0f8`.
- Runtime build gồm source base trên và bản sửa F17 tại `MuseumXr.attach`. Guard kiểm tra Canvas còn connected trước khi thay camera/input/bind renderer. Các thay đổi còn lại nằm trong tests, fixture và tài liệu.
- Build dùng `npm.cmd run build`. Playwright dùng Vite production preview, `CI=1`, `PLAYWRIGHT_PREVIEW=1`, một worker và SwiftShader theo cấu hình có sẵn. `CI=1` yêu cầu tạo preview mới, tránh dùng nhầm dev server.
- Runtime source commit `875b3b72029e87c0a703d4fe405d196f92d6cb02`, revision tests cuối `ec3c090f84cb2008246bae6707b7ad32687d0147`. Manifest lưu hash source, test và bundles. Commit tài liệu cuối cập nhật báo cáo/bằng chứng.

## 3. Coverage cũ và mới

Baseline có 255 unit tests. Coverage browser hiện có đã gồm WebGL unavailable, restore/timeout/budget, XR unavailable/refusal, controller-free gaze, parser/accessor rejection, optional mesh quarantine, model render/construction boundary, GLB isolation/retry và fullscreen/UI.

Phần mới gồm 14 browser tests XR, năm biến thể GLB mới và sáu unit tests. Coverage browser chọn lọc tăng từ 56 lên 75 cases. Các ca mới kiểm tra native headset termination, availability/devicechange theo hai thứ tự, explicit reconnect với session mới, visibility, compatibility/binding pending, request trả về sau đóng/chuyển phòng, WebGL/XR race và renderer reset exhaustion. Bổ sung checksum mismatch, truncated GLB, HTTP 401/500 và timed-out network abort trong bảng GLB isolation hiện có. Unit bổ sung capability response lỗi thứ tự, late reference/binding, duplicate end/rejection và restore sau deadline.

Danh mục F01–F18 và test owner nằm trong [test matrix](test-matrix.md). Các nhãn F cũ trong tour-2d-fallback.spec.ts có ý nghĩa khác theo tài liệu lịch sử.

## 4. Fault injection

- WebGL browser tests dùng `WEBGL_lose_context` của context đang render. Unit EventTarget và fake timers chỉ chứng minh state machine và deadline.
- GLB happy path dùng `createMuseumGlb` có header/checksum hợp lệ, GLTFLoader thật và mesh render được. Invalid header, truncation và checksum đổi byte được inject riêng. HTTP/network faults chỉ ảnh hưởng một URL model.
- Headset termination phát native end trực tiếp, tách khỏi application session.end(), controller disconnect và inputsourceschange. Availability thay đổi qua XRSystem devicechange.
- Controllable promises xác định request, makeXRCompatible và setSession boundaries. Không đổi timeout 8000 ms, recovery budget hoặc application retries.

## 5. WebGL context recovery

Test được tăng assertion để ghi đủ `ready → recovering → verifying → ready`, cùng Canvas identity, tăng số frame, triangles, selection và số request model. Unit giữ deadline gốc khi restore đến ở 7999 ms, chuyển failed ở 8000 ms và bỏ qua restore/frame muộn.

Existing browser tests kiểm chứng timeout, hai lần tự khôi phục rồi fallback ở loss thứ ba, abort model pending và đường dẫn đọc 2D đúng hiện vật. New races dùng extension thật khi XR active và khi native binding pending.

Lượt cuối ghi đủ bốn transition, frame count 39 → 78 và 5166 triangles sau phục hồi, request model giữ `[1, 1, 1, 1, 1]`. Bốn processed-order races active/binding đều PASS. GPU Iris Xe cũng PASS ca context loss/restore qua extension thật.

## 6. GLB failure isolation

Bảng lỗi mở rộng giữ bốn model khỏe theo cùng UUID, một placeholder tương tác được, nội dung hiện vật đọc được và retry thành công. Request counts kỳ vọng `[1, 2, 1, 1, 1]`. Existing tests kiểm chứng ba manual retries/backoff, parser failure, optional mesh quarantine, clone/render exception và hủy queue khi đổi phòng.

Cả 10 biến thể isolation PASS. Hai ca delayed-download dùng GLB verified đã có trong `back-end/tmp/glb-assets/` đều chạy và PASS, không skip. Đây là local cached asset integration, còn live API/Storage cần môi trường riêng.

Timed-out abort là fault injection của browser request. Chưa đo server timeout hoặc mạng di động thật. Rendering exception hiện có nằm ở model clone/construction trong React boundary. GPU-driver draw failures cần kiểm thử phần cứng.

## 7. WebXR refusal và unsupported

Chạy lại existing tests cho missing navigator.xr, unsupported capability và request bị từ chối. Refusal giữ Canvas identity, selection và cho phép retry. Unit capability kiểm tra secure context và capability checks trả về lỗi thứ tự.

## 8. Headset disconnect giữa phiên

Hai test event-order load đủ năm GLB, chọn hiện vật 2 rồi vào active. Ba chu kỳ chọn lần lượt hiện vật 5, 3 và 5 bằng native XR ray tới nhãn đang render, rồi kết thúc native session và thay đổi availability. Mỗi test có ba chu kỳ disconnect/reconnect và một explicit entry cuối với session mới. Camera transform, selection, GLB cache, Canvas identity và resource counts được đối chiếu. Các signal cũ được gửi lại khi session mới active để kiểm tra ownership. ArrowRight sau mỗi disconnect phải thay quaternion và tạo frame web mới, Home trả camera về góc ban đầu.

Evidence gồm timeline, application/native end counts, listener counts, camera snapshot, model requests, renderer/context counts, page errors và unhandled rejections. Test cuối đóng tour và kiểm tra không còn context sống.

Kết quả hai thứ tự giống nhau. Mỗi ca tạo bốn session riêng biệt, có bốn termination và một application end chủ động cuối cùng. Cả bốn session có zero listeners sau release, page errors/unhandled rejections rỗng. Ba snapshot web đều có một renderer sống, 69 geometries và 16 textures, request model luôn `[1, 1, 1, 1, 1]`. Sau đóng tour, probe live về 0. Ảnh viewport đã được xem, scene và panel hiện vật 5 hiển thị sau phục hồi.

## 9. Race conditions và cleanup

Pending request sau đóng/chuyển phòng phải do ứng dụng kết thúc, không được fixture kết thúc trước. Native end trong compatibility/binding, duplicate end và late rejection đều có regression. Healthy native termination phải dọn toàn bộ session listeners. Partial binding failure theo policy retire Canvas, không ép reuse manager đã lỗi.

Đối với failed partial manager, fixture giữ strong references tới session để chẩn đoán, nên các native listeners bị adapter vô hiệu hóa có thể còn trong diagnostic registry cho tới khi page được hủy. Điều này được tách khỏi zero-listener invariant của healthy termination. Resource assertions ở đây chứng minh context và geometry/texture counts hữu hạn trong số chu kỳ test. Chưa chứng minh mọi heap retention hoặc timer của runtime thiết bị vật lý.

## 10. Ma trận thiết bị

[Device matrix](device-matrix.md) phân biệt simulated, real browser và physical headset. Host là ASUS Vivobook X1405VA/A1405VA, Windows 11 10.0.26200. Gate chính dùng Edge 156.0.4314.58 và SwiftShader. Chrome 156.0.8078.80 PASS hai existing readiness/picking checks, final headset fixture trên Chrome còn NOT RUN.

GPU desktop Edge được chạy thêm bằng `MUSEUM_HARDWARE_AUDIT=1`, dùng cấu hình không thêm launch args. Ba ca checksum isolation, refused VR và actual context restore PASS 3/3. Probe độc lập cùng browser/context options ghi `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11 vs_5_0 ps_5_0, D3D11)`, khớp GPU/driver CIM. Đây là headless GPU validation. Các phép đo presented FPS thuộc performance audit riêng.

Android thấp/trung/cao, iPhone/iPad Safari, standalone và tethered headset còn BLOCKED. Discovery không trả về thiết bị headset/mobile phù hợp đang kết nối.

QA phần cứng làm theo [headset protocol](headset-disconnect-protocol.md). Phép đo GPU/performance trước đó nằm trong [performance audit](../261104-real-device-3d-performance-audit/performance-audit-report.md), có SHA và workload riêng.

## 11. Phát hiện và xử lý

- Initial room-switch assertion kỳ vọng không có Canvas. Implementation hợp lệ dựng Canvas mới cho phòng rỗng. Đổi assertion sang retire Canvas cũ, không bind session cũ vào phòng mới.
- Fixture cũ cho phép requestReferenceSpace trên session đã ended. Sửa để reject InvalidStateError khi tạo request mới sau native termination.
- Existing floor teleport test có thể phát synthetic trigger trước khi React input effect đăng ký. Thêm gate chờ hai select listeners thực tế, giữ nguyên assertion teleport.
- Review độc lập phát hiện F17 pre-ended session làm yếu bằng chứng application cleanup, và reconnect cycles giữ sẵn selection 5. Đã làm chặt assertions để kiểm tra cleanup ứng dụng và một thay đổi selection thật trong từng session.
- **F17 là lỗi production đã tái hiện.** Khi tour đóng, DOM Canvas đã bị tháo nhưng R3F custom reconciler chưa commit cleanup. `mounted` vẫn true, nên request XR trả về muộn có thể bind vào renderer cũ. Timeline RED là `request → binding:start → app:end → native:end`. Bổ sung `!gl.domElement.isConnected` vào guard hiện có tại `MuseumXr.attach`, trước mọi camera/input/renderer mutation. Reviewer độc lập xác nhận sửa đúng owner và giữ nguyên generation guards.
- Assertion frame sau keyboard được sửa thành poll vì demand rendering là bất đồng bộ. Test reset dùng readiness gate 15 giây đã có ở existing XR suite, thay cho default 5 giây. Snapshot lượt lỗi cho thấy renderer thứ hai đã được tạo sau deadline assertion. Hai test nhiều chu kỳ dùng browser budget 60 giây tương ứng existing XR suite. Deadline production 8000 ms và recovery/reset budgets giữ nguyên.
- Lượt Edge trên build đã sửa đạt 72/75, với ba lỗi timing tại fullscreen room loading, test pick/focus năm hiện vật và một test reconnect ba chu kỳ. Probe host ghi CPU 60%, RAM trống khoảng 2 GB. Đây là bằng chứng resource pressure, chưa xác lập nguyên nhân duy nhất của mọi timeout. Áp dụng readiness 15 giây cho hai cold Canvas checks của ca fullscreen, và local budget 60 giây cho ca pick/focus năm hiện vật. Không thay cấu hình timeout toàn suite hoặc bỏ assertions. Hai ca existing này sau đó PASS trên Chrome.
- Các thử nghiệm tối ưu test reconnect dùng raw hotspot target phía sau đã gặp occlusion bởi mô hình/panel. Bản cuối lấy world position của nhãn hiện vật thực và dùng native raycast/select. Selection vẫn phải đổi 5 → 3 → 5 trong mỗi session mới. Bỏ setup catalogue/focus lặp, giữ đủ ba chu kỳ, web keyboard/frame checks và toàn bộ resource/teardown assertions. Cả hai thứ tự sự kiện đã PASS trên Edge sau sửa test.
- Gate trước cuối đạt 73/75, hai ca GLB cũ đo fault UI trước khi Canvas cold-start xong. Bổ sung precondition Canvas-ready cho ca download isolation, và dùng cùng readiness 15 giây cho ca clone/render injection. Toàn bộ fault assertions được giữ. Gate cuối PASS 75/75 trên cùng runtime build đã sửa F17.

## 12. Giới hạn

Headset thật, tracking, optics, standby behavior và thực tế devicechange cần QA vật lý. Mobile viewport coverage của existing UI suite không thay cho Android/iOS. Live GLB suite đã được đọc nhưng nhiệm vụ dùng fixture, không tuyên bố live API/Storage validation. Build có cảnh báo bundle chunks lớn hơn 500 kB như cấu hình hiện tại.

## 13. Evidence và nghiệm thu

| Gate | Kết quả |
| --- | --- |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd run test:unit` | PASS 261/261, 45 files |
| `npm.cmd run build` | PASS, cảnh báo chunks lớn hơn 500 kB |
| Edge production-preview regression | PASS 75/75, 0 skipped, 0 flaky, 7.8 phút |
| Edge Intel GPU subset | PASS 3/3, 0 skipped |
| Headset/mobile vật lý | BLOCKED, cần QA thiết bị |

Browser gate gồm fullscreen 8, GLB 5, hotspots 21, immersive UI 5, native disconnect/races 14, existing XR 12 và 2D fallback 10. Bản build có runtime source giống commit `875b3b7`, đã đối chiếu diff và bundle hashes.

Evidence chính nằm trong [index](evidence/README.md), [75 case results và decoded timelines](evidence/results.json), [hardware results](evidence/hardware-results.json), [GPU identity](evidence/hardware-capabilities.json), [build manifest](evidence/build-manifest.json), [RED F17](evidence/f17-red-lifecycle.json) và [GREEN F17](evidence/f17-green-lifecycle.json). Hai ảnh phục hồi là [end-first](evidence/headset-end-first-recovered.png) và [device-first](evidence/headset-device-first-recovered.png).

Nghiệm thu tự động đã đạt. Nghiệm thu vật lý tiếp tục theo headset protocol, với thực tế native event order, standby/wake, controller disconnect riêng và explicit re-entry sau reconnect. Trạng thái bàn giao là **AUTOMATED TESTS COMPLETE — PHYSICAL DEVICE VALIDATION PENDING**.

## Tái hiện

Chạy tại `D:\CNPM\ailabs-museum\front-end` với Node/dependencies và Edge có sẵn.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
$env:PLAYWRIGHT_PREVIEW = '1'
$env:CI = '1'
$env:MUSEUM_HARDWARE_AUDIT = '0'
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = 'tmp/fallback-repro.json'
npm.cmd test -- museum-xr.spec.ts museum-xr-disconnect.spec.ts museum-glb.spec.ts museum-hotspots.spec.ts tour-2d-fallback.spec.ts museum-fullscreen.spec.ts museum-immersive-ui.spec.ts --reporter=list,json --output=tmp/fallback-repro
```

Để chạy riêng disconnect, dùng cùng env và `npm.cmd test -- museum-xr-disconnect.spec.ts --reporter=list,json --output=tmp/disconnect-repro`. Để kiểm tra helper races, dùng `npm.cmd run test:unit -- src/helpers/xrSession.test.ts src/helpers/xrRendererBinding.test.ts src/helpers/webglRecovery.test.ts`.

Tái hiện desktop GPU subset trên Edge đã cài và GPU driver hoạt động.

```powershell
$env:MUSEUM_HARDWARE_AUDIT = '1'
npm.cmd test -- museum-xr.spec.ts museum-hotspots.spec.ts --grep 'actual context restores|supported but refused|one checksum GLB' --reporter=list,json --output=tmp/hardware-repro
$env:MUSEUM_HARDWARE_AUDIT = '0'
```

## Lịch sử commit

| Commit | Thay đổi |
| --- | --- |
| `1ba4140` | Kế hoạch, source inventory và commit plan |
| `20eaa23` | Native headset simulation, race regressions và F17 RED |
| `875b3b7` | Guard Canvas detached tại XR attach, F17 GREEN 2/2 |
| `8e3041f` | GLB fault variants, recovery deadline và successful-frame evidence |
| `8b5a2fb` | Target selection theo nhãn render, local cold-scene và multi-cycle readiness gates |
| `ec3c090` | Precondition Canvas-ready cho hai ca GLB, gate cuối 75/75 |

Các commit ở local. PR và merge chưa thực hiện theo yêu cầu nhiệm vụ.
