# Kiểm chứng MOB-E7-01

**AC parity — PASS.** Cả 9 case gốc và 29 assertions có đối chiếu giữa Vitest và Jest. Hai helper tái sử dụng `MuseumDisplay`, `ARTIFACT_BASE_Y`, `MUSEUM_ROOM_SIZE`, mapper và normalization mobile đã có trên base `97f4b9a9af2bbe5cf9ab439671f17b78d984dec5`.

## Ma trận parity

Các case giữ nguyên tên và thứ tự từ hai file `front-end/src/helpers/*.test.ts` sang hai file cùng tên trong `mobile/src/features/scene3d/`.

| Web | Mobile | Điều được kiểm tra | Vitest / Jest |
| --- | --- | --- | --- |
| `hotspotStory.test.ts` · 1 | `hotspotStory.test.ts` · 1 | Khớp identity phòng, hiện vật, hotspot và trả đúng index | PASS / PASS |
| `hotspotStory.test.ts` · 2 | `hotspotStory.test.ts` · 2 | Đọc nội dung mới, trả `null` cho annotation thiếu hoặc tổng hợp | PASS / PASS |
| `artifactHotspots.test.ts` · 1 | `artifactHotspots.test.ts` · 1 | ID, metadata mới nhất và fallback bounds của marker mặc định | PASS / PASS |
| `artifactHotspots.test.ts` · 2 | `artifactHotspots.test.ts` · 2 | Marker phía trên model đã normalize bằng `Group`, `Mesh` và `BoxGeometry` thật | PASS / PASS |
| `artifactHotspots.test.ts` · 3 | `artifactHotspots.test.ts` · 3 | Transform pivot/scale ở tọa độ nguồn, fallback khi thiếu bounds và giới hạn trần | PASS / PASS |
| `artifactHotspots.test.ts` · 4 | `artifactHotspots.test.ts` · 4 | Tọa độ primitive và marker riêng cho annotation thiếu tọa độ | PASS / PASS |
| `artifactHotspots.test.ts` · 5 | `artifactHotspots.test.ts` · 5 | World target cộng vị trí gallery sau normalization | PASS / PASS |
| `artifactHotspots.test.ts` · 6 | `artifactHotspots.test.ts` · 6 | Target tổng hợp hoặc authored không hợp lệ trả `null`, fallback marker vẫn hữu hạn | PASS / PASS |
| `artifactHotspots.test.ts` · 7 | `artifactHotspots.test.ts` · 7 | Mapper mobile thật giữ `revisionId` và tọa độ API. `gallerySlots.test.ts` kiểm tra thứ tự nhiều hotspot. | PASS / PASS |

`SelectHotspot` nhận hai ID theo contract native. TypeScript mobile bật `noUncheckedIndexedAccess`, nên port ghi rõ tuple tọa độ và xác nhận các phần tử đã biết trong fixtures. Test mapper dùng shape payload mobile. Phép tính marker, focus bounds và world target giữ giá trị kỳ vọng của web.

## Lệnh đã chạy

Môi trường Windows, Node `24.8.0`, npm `11.6.0`. Các lệnh npm chạy bằng `npm.cmd` trong PowerShell.

| Nơi chạy | Lệnh | Kết quả |
| --- | --- | --- |
| `front-end/` | `npm ci` | PASS |
| `front-end/` | `npm run test:unit -- src/helpers/hotspotStory.test.ts src/helpers/artifactHotspots.test.ts` | 2 suite, 9 PASS / 0 FAIL / 0 SKIP |
| `mobile/` | `npm ci` | PASS |
| `mobile/` | `npm test -- --runInBand hotspotStory.test.ts` | 1 suite, 2 PASS / 0 FAIL / 0 SKIP |
| `mobile/` | `npm test -- --runInBand artifactHotspots.test.ts gallerySlots.test.ts` | 2 suite, 13 PASS / 0 FAIL / 0 SKIP |
| `mobile/` | `npm test -- --runInBand hotspotStory.test.ts artifactHotspots.test.ts` | 2 suite, 9 PASS / 0 FAIL / 0 SKIP |
| `mobile/` | `npm run typecheck` và `npm run lint` | PASS cho từng implementation commit và kiểm chứng cuối |
| `mobile/` | `npm test -- --ci --runInBand` | PASS khi có quyền loopback. 47 suite pass, 1 suite skip. 216 PASS / 0 FAIL / 2 SKIP. |
| `mobile/` | `npm run perf:bundle` | Lệnh gốc dừng trên Windows với `spawnSync npx ENOENT` trong `scripts/bundle-size.mjs:15`. |
| `mobile/` | `node node_modules/expo/bin/cli export --platform <android\|ios> --dump-sourcemap --output-dir <temp-dir> --max-workers 2` | PASS theo `scripts/bundle-budget.json`. Android 3.593.000 bytes, iOS 3.594.364 bytes, giới hạn 4.194.304 bytes mỗi nền tảng. |
| Repo root | `git diff --check origin/dev...HEAD` | PASS. Diff đã được review theo từng commit và toàn nhánh. |

- Lần chạy full Jest trong sandbox có 213 PASS / 3 FAIL / 2 SKIP. Ba case trong `glbLoader.integration.test.ts` là tải/cache GLB qua HTTP, tải lại cache hỏng và phân loại HTTP 404/429/500. Hai case báo `GlbLoadError: Không thể kết nối mạng để tải mô hình 3D.`. Case phân loại trả `network` thay vì `missing` tại assertion 404. Cả ba pass khi chạy lại cùng lệnh với quyền loopback `127.0.0.1`.
- Hai case skip có sẵn là kiểm tra GLB thật trong `glbValidation.test.ts` và đặt hiện vật AR từ GLB thật trong `ArArtifactPlacementView.test.tsx`. Cả hai dùng chung điều kiện có file `.glb` trong `back-end/public/media/uploads/models`, thư mục vắng trong checkout này.
- Kiểm tra bundle gọi Expo CLI cục bộ ở chế độ offline, tắt telemetry và cộng kích thước `.hbc` như script gốc. Lần gọi CLI đầu tiên trong sandbox dừng khi Expo cố tạo `~/.expo` (`EPERM`). Lần chạy có quyền và thiết lập offline hoàn tất cho cả hai nền tảng.
- **Native runtime — NOT VERIFIED.** Môi trường không có Android ADB hoặc iOS simulator để kiểm tra trên thiết bị.

## Commit ledger

| Commit SHA | Commit message | Mục đích | Files changed | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| `da466517f2a7071f2b5465abaddb5eb83b9b8fa2` | `docs(mob): plan hotspot helper port [MOB-E7-01]` | Audit base, dependency, source và ma trận test | `plan.md`, `commit-plan.md` | Đối chiếu source, 9 case trên base và staged diff | PASS |
| `9a4e0d2181108e4e7ee67badfd2e10cac820136c` | `feat(mob): port hotspot story resolution [MOB-E7-01]` | Selection identity và nội dung story hiện tại | `hotspotStory.ts`, `hotspotStory.test.ts` | 2 Jest PASS, typecheck, lint, staged diff | PASS |
| `6806129fa2d4524579acbcfba833adf962f05fb7` | `feat(mob): port artifact hotspot calculations [MOB-E7-01]` | Transform, fallback, focus bounds và world target | `artifactHotspots.ts`, `artifactHotspots.test.ts` | 7 artifact + 6 mapper Jest PASS, typecheck, lint, staged diff | PASS |

Hai helper độc lập về runtime. Mỗi helper và suite tương ứng nằm cùng commit để review, kiểm chứng và revert theo từng hành vi. Tài liệu kế hoạch và bằng chứng kiểm chứng có commit riêng. SHA của commit báo cáo được ghi trong phần bàn giao.
