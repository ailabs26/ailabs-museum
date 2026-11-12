# Kiểm chứng

Ngày 12/11/2026, base `dcbb814141bef3ed547f0893edb701c4d9407771`. Các số dưới đây đến từ source của nhánh nhiệm vụ. Logs lưu trong `evidence/`.

## Automated gates

| CWD | Lệnh | Kết quả | Evidence |
| --- | --- | --- | --- |
| `tools/asset-pipeline` | `npm.cmd test` | 17/17, exit 0 | `optimizer-tests.log` |
| `front-end` | `npm.cmd run typecheck` | Exit 0 | `asset-pipeline-typecheck-final.log` |
| `front-end` | `npm.cmd run lint` | Exit 0 | `asset-pipeline-lint-final.log` |
| `front-end` | `npm.cmd run test:unit` | 359/359, 59 files, exit 0 | `asset-pipeline-unit-final.log` |
| `front-end` | `npm.cmd run build` | Exit 0, Vite 1m26s | `asset-pipeline-build-final.log` |
| `front-end` | Asset Playwright dev fixture, grep-invert public cases | 5/5, exit 0 | `asset-pipeline-browser-verified.log` |
| `front-end` | Asset Playwright production, grep public cases | 2/2, exit 0 | `asset-pipeline-public-verified.log` |
| `front-end` | Legacy GLB/hotspots/Guided Tour/XR production regression | 51/51, exit 0 | `asset-pipeline-regression.log` |
| `front-end` | CMS Preview bổ sung legacy/Draco/embedded WebP | 1/1, exit 0 | `asset-pipeline-webp-preview.log` |
| `front-end` | Corrupt Draco native payload, checksum hợp lệ | 1/1, exit 0 | `asset-pipeline-corrupt-draco.log` |
| `back-end` | `npm.cmd run test:media` | 592/592, exit 0 | `asset-pipeline-media-final.log` |
| `back-end` | `npm.cmd run test:models` | 10/10, exit 0 | `asset-pipeline-models-final.log` |
| `back-end` | Generated artifact inspection script | 7/7 candidates được chấp nhận | `backend-generated-inspection.json` |

Phạm vi backend được audit read-only và kiểm chứng media/public-model contracts. Đã cài lại dependencies theo lockfile để bổ sung `@nestjs/schedule` bị thiếu trong local node_modules. Lần chạy media trước đó đạt 584 cases và một file compile fail vì dependency thiếu, sau cài lại đạt 592/592.

Lint ban đầu quét checkout cũ trong `tmp/` và trace JS/HTML đang được Playwright ghi/xóa, dẫn tới lỗi local và ENOENT. ESLint và Vite watcher hiện bỏ qua các thư mục generated đã được Git ignore, gồm tmp/temp/test-results/playwright-report. Maintained source tiếp tục được lint bằng lệnh chuẩn.

## Browser reproduction

Chạy từ `front-end/`, sau `npm ci`. Cài dependencies package offline bằng `npm ci` từ `tools/asset-pipeline/` trước khi chạy asset tests. Browser dùng Chromium đã cài và SwiftShader theo config hiện hành.

```powershell
$env:CI = '1'
$env:PLAYWRIGHT_CHANNEL = 'chromium'
Remove-Item Env:PLAYWRIGHT_PREVIEW -ErrorAction SilentlyContinue
npm.cmd test -- asset-pipeline.spec.ts --grep-invert 'generated Draco loads' --output=tmp/asset-pipeline-browser --reporter=line
npm.cmd run build
$env:PLAYWRIGHT_PREVIEW = '1'
npm.cmd test -- asset-pipeline.spec.ts --grep 'generated Draco loads' --output=tmp/asset-pipeline-public --reporter=line
npm.cmd test -- museum-glb.spec.ts museum-hotspots.spec.ts guided-tour-camera.spec.ts museum-xr.spec.ts --output=tmp/asset-pipeline-regression --reporter=line
```

Hai lệnh asset tests chạy tuần tự, cùng port 4173. Fixture HTML phục vụ trong dev. Production Public Museum dùng build thật và API mock chỉ cung cấp descriptors/binary có SHA-256 thật. Network interception giữ dữ liệu kiểm thử độc lập với storage và production DB.

Tạo contact sheet và RGB errors từ repository root, chọn output directory mới.

```powershell
node tools/asset-pipeline/test/compare-renders.mjs front-end/tmp/asset-pipeline-browser/asset-pipeline-fixed-camer-67c47-retain-shared-normalization docs/plans/261112-advanced-3d-asset-pipeline/evidence/new-render-analysis
```

## Acceptance matrix

| Điều kiện | Evidence | Trạng thái |
| --- | --- | --- |
| Offline Draco và ba LOD độc lập | Native encode/decode, Khronos checks, SHA và deterministic manifests | Đã kiểm chứng fixture |
| Legacy và compressed GLB trong CMS/Public | Browser native loaders, WASM/JS, unit failures | Đã kiểm chứng mock API |
| Screen selection/hysteresis/missing level | Unit selector/owner, requests từng checksum | Đã kiểm chứng fixture |
| Upgrade fallback/picking/hotspots | Delayed upgrade, original fallback, unchanged normalization/annotation | Đã kiểm chứng fixture |
| Cache/abort/disposal/shared consumers | Unit refs/budget + browser teardown/remount | Đã kiểm chứng phạm vi tests |
| WebP role/alpha/orientation/animation | 17 package tests, lossless pixel checks, APNG rejection | Đã kiểm chứng offline |
| Embedded WebP browser support | GLB Draco + EXT_texture_webp render trong CMS Preview | Đã kiểm chứng Chromium |
| Geometry fidelity | Bounds/surface/normal/UV/material/scene gates | Đã kiểm chứng fixture |
| Render comparison | 4 PNGs, contact sheet, RGB metrics cùng camera | Đã capture và xem |
| Curator museum visual QA | Dataset được cấp quyền, detail/silhouette/material review nhiều góc | REVIEW_REQUIRED |
| Live upload/storage/Published optimized model | Workflow CMS với credentials và nội dung được duyệt | Chưa xác minh live |
| Production multi-variant authorization | Source/derived relation và backend/database approval | Chờ review contract |
| Physical FPS/VRAM/heap/mobile/iOS/headset | Protocol 261104, ba runs cùng workload | Chưa xác minh |

## Review regressions

Independent review đã phát hiện Draco decoded count khác accessor declaration và APNG bị Sharp đọc như ảnh tĩnh. Đã có test tái hiện trước fix và kiểm tra sau fix. Root bổ sung fallback về original khi LOD0 lỗi, refcount bảo vệ tài nguyên qua R3F root, first-demand sau remount và ready-state identity để giữ camera Guided Tour trong lúc tải. Không còn confirmed P1/P2 sau review. Native WASM allocation trước admission check vẫn là giới hạn được ghi trong report.


## Generated artifact inspection

Chạy từ `back-end`, thay đường dẫn bằng generated manifest mới của CLI.

```powershell
node -r reflect-metadata -r ts-node/register ../docs/plans/261112-advanced-3d-asset-pipeline/evidence/check-backend-inspection.cjs <draco-manifest.json> <embedded-webp-manifest.json> <image-manifest.json>
```

Seven accepted records gồm ba Draco LOD, ba GLB có embedded WebP và một ảnh WebP. Đây là identification/size/structure gate, publication cần curator và workflow Published. Script không truy cập database.
