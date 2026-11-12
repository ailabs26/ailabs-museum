# Evidence index

Ngày 12/11/2026. Base source `dcbb814141bef3ed547f0893edb701c4d9407771`. Evidence được thu từ implementation task trước các commit bàn giao, với dependency versions/config/checksums nằm trong JSON. Synthetic inputs được tạo bởi `tools/asset-pipeline/test/fixture.mjs` và `test/benchmark.mjs`, quyền CC0 do task sinh.

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
