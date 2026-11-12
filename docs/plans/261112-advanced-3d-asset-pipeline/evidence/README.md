# Evidence index

Ngày 12/11/2026. Base source `dcbb814141bef3ed547f0893edb701c4d9407771`. Evidence được thu từ implementation task trước các commit bàn giao, với dependency versions/config/checksums nằm trong JSON. Synthetic inputs được tạo bởi `tools/asset-pipeline/test/fixture.mjs` và `test/benchmark.mjs`, quyền CC0 do task sinh.

Các logs có prefix `asset-pipeline-sync-` kiểm chứng frontend sau tích hợp Gallery Slots tại `446bba7` qua merge `4388274`. Merge `12155b1` nhận tiếp backend/docs từ `dev` tại `2a245d0`, frontend giống `4388274`. Bộ logs `*-final.log` và 51-case regression thuộc giai đoạn trước Gallery Slots. Backend counts trước PR #185 được giữ như lịch sử.

| Evidence sau đồng bộ | Nội dung và phạm vi |
| --- | --- |
| `asset-pipeline-sync-typecheck.log`, `asset-pipeline-sync-lint.log`, `asset-pipeline-sync-build.log` | Frontend gates exit 0 |
| `asset-pipeline-sync-unit.log` | 383 tests, 61 files, exit 0 |
| `asset-pipeline-sync-browser.log` | 7 dev asset cases, bao gồm slotted LOD, CMS WebP và native corrupt Draco, exit 0 |
| `asset-pipeline-sync-production.log` | 24/26 production cases, hai Gallery Slots failures, exit 1 |
| `asset-pipeline-sync-gallery-retry.log` | Hai Gallery Slots failures khi chạy riêng trên task |
| `asset-pipeline-stock-gallery-check.log` | Hai ca cùng lỗi trên archive sạch stock dev tại `446bba7` |
| `stock-dev-snapshot-integrity.json` | 483 tracked frontend files khớp stock dev Git blobs, text có chuẩn hóa CRLF → LF |
| `browser-fixed-camera-after-gallery-sync.json` | Samples mới sau đồng bộ, PNGs có SHA-256 giống bộ renders đã commit |
| `optimizer-handoff-tests.log` | Chạy lại 17/17 optimizer tests trên merge `12155b1` |
| `asset-pipeline-handoff-typecheck.log`, `asset-pipeline-handoff-lint.log`, `asset-pipeline-handoff-build.log` | Chạy lại frontend gates trên merge `12155b1`, exit 0, build có large-chunk warning |
| `asset-pipeline-handoff-test-unit.log` | Chạy lại 383/383 units trên merge `12155b1` |
| `asset-pipeline-handoff-browser.log`, `asset-pipeline-handoff-public.log` | Chạy lại 7/7 dev và 2/2 production asset browser cases trên merge `12155b1`, Chromium ngoài sandbox |

Hai ca stock lỗi ở movement camera Z khoảng 5,701 thay vì < 5 và texture count 9 → 17 sau reopening. Ca resource/idle trên task có thêm lần frames đổi 36 → 37. Nghiệm thu production giữ `REVIEW_REQUIRED`.

Các log copies bổ sung khi bàn giao đã bỏ trailing whitespace và blank lines cuối file để qua Git whitespace gate. Nội dung kết quả và assertions được giữ trong bản lưu.

| File | Nội dung và phạm vi |
| --- | --- |
| `offline-benchmark.json` | Actual master/LOD/WebP manifests, SHA/config/native tool versions, CPU environment và 5 NodeIO decode samples |
| `browser-fixed-camera.json` | Chromium 156/SwiftShader, scene counters, master normalization/hotspots, 3 fetch+parse samples mỗi asset |
| `public-wasm.json`, `public-js.json` | Production Public Museum dùng generated Draco qua mock API, decoder responses cùng origin và DOM-ready observation |
| `renders/*-fixed-camera.png` | Original/LOD0/LOD1/LOD2, cùng camera/light/renderer, đã chờ texture decode |
| `renders/contact-sheet.png` | Contact sheet 2×2, original/LOD0 trên, LOD1/LOD2 dưới |
| `renders/render-comparison.json` | Full-frame RGB error/PSNR, background tham gia aggregate, human QA giữ REVIEW_REQUIRED |
| `optimizer-tests.log` | 17 package tests, encode/decode thật, deterministic metadata, original unchanged, WebP/APNG và failures |
| `asset-pipeline-typecheck-final.log` | Frontend typecheck exit 0 |
| `asset-pipeline-lint-final.log` | Frontend lint exit 0, generated artifacts được ignore |
| `asset-pipeline-unit-final.log` | Frontend 359 tests/59 files, exit 0 |
| `asset-pipeline-build-final.log` | Production build exit 0, emitted self-hosted decoder files, existing large-chunk warning |
| `asset-pipeline-browser-verified.log` | 5 dev fixture browser cases, exit 0 |
| `asset-pipeline-public-verified.log` | 2 production WASM/JS browser cases, exit 0 |
| `asset-pipeline-regression.log` | 51 production GLB/hotspot/Guided Tour/XR regressions, exit 0 |
| `asset-pipeline-webp-preview.log` | CMS legacy/Draco/embedded WebP, 1 case/3 inputs, exit 0 |
| `asset-pipeline-corrupt-draco.log` | Payload Draco thực bị phá, checksum tính lại đúng, native decoder lỗi an toàn và fallback, exit 0 |
| `backend-generated-inspection.json` | 7 generated candidates qua actual backend identification/size/structure checks |
| `check-backend-inspection.cjs` | Script tái tạo inspection, chạy từ back-end với ts-node |
| `renders/cms-*.png`, `renders/public-draco-*.png` | Giao diện thật CMS và production Public Museum, binary/API mocked |
| `asset-pipeline-media-final.log` | Backend media 592 tests/72 suites, exit 0 |
| `asset-pipeline-models-final.log` | Backend public models 10 tests, exit 0 |

Renderer counters có phạm vi scene tổng hợp gồm display/pedestal. Download timers dùng request interception trên loopback. Browser parse timers gồm worker initialization và embedded image decode, mỗi kết quả bổ sung được dispose. GPU physical memory, hardware FPS, GC heap leak proof, iOS/mobile/headset và curator review cần evidence riêng.

Các lần thử trước đã giúp tìm lỗi fixture chặn nhầm Vite WASM URL module và dùng texture probe của full room cho một exhibit. Đã sửa fixture để chặn actual decoder fetch và chờ đúng texture đang hiển thị. Vite watcher bỏ qua HTML trace artifacts để tránh reload khi test đang ghi evidence. Các logs verified là kết quả sau sửa.

Tái tạo capture và comparison theo `../verification.md`. Human museum QA vẫn `REVIEW_REQUIRED`, chờ dataset có quyền và reviewer/curator ký theo `../visual-quality-protocol.md`.
