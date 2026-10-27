# Báo cáo triển khai và kiểm chứng immersive museum

Ngày bàn giao: 2026-10-27. Nhánh: `feat/immersive-museum`. Nhiệm vụ bắt đầu từ bản `origin/dev` đã fetch, `5eba476`, với working tree sạch. Đây là phần tiếp tục của cùng nhiệm vụ; không đổi base hoặc tạo nhánh thứ hai.

Kế hoạch được commit trước source code tại `ea06204`: [plan.md](plan.md), sáu tài liệu phase và [commit-plan.md](commit-plan.md). Quy ước frontend thực tế nằm ở `docs/architecture/fe/coding-conventions.md`; đường dẫn `front-end/docs/coding-conventions.md` trong AGENTS không tồn tại.

## Thay đổi theo trách nhiệm

| File/module | Thay đổi và lý do |
| --- | --- |
| `hooks/useImmersiveTour.ts`, `museum/ImmersiveTour.tsx` và CSS | Portal toàn viewport, native fullscreen trong user gesture, fallback khi thiếu/từ chối API, xử lý grant muộn, khóa nền/scroll và khôi phục focus. |
| `pages/MuseumPage.tsx` và CSS | Giữ data/selection/URL ở owner hiện có; room selector trong tour; chi tiết overlay, catalogue thu gọn, trạng thái loading/error/retry có lối thoát. |
| `components/MuseumScene.tsx` và CSS, `ArtifactDock`, `NavigationHud`, `SpatialMinimap` | Một Canvas phủ viewport; HUD nhỏ, dải hiện vật theo thứ tự CMS, minimap/hướng dẫn và secondary controls có thể thu gọn. |
| `shared/components/feedback/PublicReportModal.tsx` | Cho phép portal modal vào subtree fullscreen để modal vẫn hiển thị và giữ quyền xử lý Escape. |
| `GalleryArchitecture`, `MuseumRoom`, `GallerySurfaces`, `GallerySign` | Sàn đá, plaster, walnut fluting/display bays, bronze trim, trần có ô đèn và bảng nhận diện; instancing và material dùng chung theo phòng. |
| `ExhibitionDisplay`, `ExhibitPlaceholder` | Bục thống nhất, contact occlusion mềm, hình minh họa có cạnh bo/hình học mượt hơn. Giữ nguyên footprint/collider và nhận dạng shape. |
| `MuseumLighting`, `ArtifactModel`, `PhotoCapture` | PBR environment, ánh sáng triển lãm, một shadow map giới hạn, mesh GLB cast/receive shadow; chặn chụp khi context mất. |
| `MuseumControls`, `helpers/cinematicIntro.ts`, `helpers/museumCamera.ts` | Một camera owner; entrance an toàn 700 ms, hủy ngay bởi input/focus, reduced motion; FOV portrait tối đa 82°. |
| `useMuseumQuality`, `helpers/museumQuality.ts` | Tier low/balanced theo capability; DPR, shadow và anisotropy có giới hạn. |
| `MuseumXr`, `SceneLifecycle`, `helpers/webglRenderGuard.ts` | Giải phóng XR owner khi scene unmount; teleport dùng head pose của select frame; bỏ qua chi tiết sàn; xử lý lỗi driver trong khoảng context mất. |
| `public/textures/gallery/`, `scripts/generate-gallery-textures.py` | Tám ảnh 512 px tự tạo CC0, tổng 440,113 bytes, có generator/provenance; không thêm runtime dependency hoặc tải texture bên ngoài. |
| `tests/fixtures/museumUi.ts`, `museumProbe.ts` và các museum specs | Thao tác qua UI đang hoạt động trong portal; kiểm chứng fullscreen, model, navigation, fallback, accessibility, XR, ảnh PNG, idle và resource lifecycle. |

## Fullscreen, Escape và cleanup

`flushSync` mount portal trước `requestFullscreen()` ngay trong thao tác mở. API thiếu, throw hoặc reject vẫn giữ fixed overlay. `fullscreenchange` đồng bộ trạng thái khi browser tự thoát; promise resolve sau khi tour đóng chỉ thoát element thuộc tour, không mở lại giao diện. Canvas tự resize theo viewport.

Escape ưu tiên modal thực → phiên XR → chi tiết hiện vật → tour. Event path gốc ngăn một Escape đóng cả modal lẫn chi tiết khi Mantine unmount modal trong capture phase. Browser có thể giữ riêng Escape để kết thúc native fullscreen trực tiếp; khi đó tour đồng bộ theo sự kiện native. Escape vẫn hoạt động khi canvas/XR button bị gỡ trong lúc đổi phòng.

Tour giữ nền inert, trap Tab và khóa body scroll. Cleanup khôi phục giá trị overflow/inert/focus/scroll cũ. Navigation input giữ owner hiện có để giải phóng key/pointer capture; renderer cũ được retire trước renderer mới. Selection trên URL được giữ khi thoát và nội dung 2D tiếp tục đọc được.

## Kiến trúc, vật liệu và rendering

Room vẫn là 14 × 16 × 5 m. Không đổi tọa độ CMS, navigation proxy, normalization, label bounds hoặc API validation. GLB thật có ưu tiên; trường hợp loading/lỗi vẫn giữ retry, fallback và identity từng hiện vật.

Palette là ivory/limestone, walnut, bronze và charcoal. Tường có bay đá, fluting và chân tường; trần có light well, đường viền và phân nhịp. Bục dùng cùng ngôn ngữ vật liệu với kiến trúc. Chi tiết lặp được instancing; texture/material thuộc một room owner và dispose khi kết thúc. Texture decode cập nhật committed consumers và yêu cầu demand frame; màu PBR dự phòng vẫn đọc được nếu ảnh tải lỗi.

Renderer giữ `frameloop="demand"`, antialiasing, sRGB, ACES và exposure 0.96. PMREM `RoomEnvironment` thuộc renderer, được tái tạo sau context restore. Hai spotlight rộng, ambient/hemisphere và fill tạo phân cấp; tối đa một PCF shadow map. Low tier giữ contact occlusion nhưng bỏ shadow map. Không thêm postprocessing/bloom/reflection pass hoặc continuous idle rendering.

| Tier | DPR tối đa | Shadow map | Anisotropy tối đa |
| --- | ---: | ---: | ---: |
| balanced | 1.5 | 1024 | 4 |
| low | 1 | không | 2 |

## Kiểm chứng thực tế

Tất cả lệnh chạy từ `front-end/`. Các browser checks dùng production preview, Edge `156.0.4314.42` với SwiftShader và một worker. Mobile/touch là emulation.

| Gate | Kết quả |
| --- | --- |
| `npm.cmd run typecheck` | Pass, exit 0. |
| `npm.cmd run test:unit` | 30 files, 168/168 pass. |
| `npm.cmd run build` | Pass, exit 0; Vite còn cảnh báo chunk >500 kB. Main JS 963.99 kB, scene JS 73.01 kB trước gzip. |
| `npm.cmd run lint` | 37 errors và 1 warning có sẵn trong các file không thay đổi, liệt kê bên dưới. |
| ESLint trên 51 TS/TSX thay đổi | Pass; live-hotspot test được kiểm tra lại sau sửa selector mở menu. |
| Browser diện rộng trước các sửa cuối | 118 ca: 114 pass, 4 fail; không coi đây là 118/118 pass. |
| Đợt tích hợp cuối trên build bàn giao | 26 ca: 25 pass; scroll test lấy mốc trước keyboard activation lệch 12 px. Trace ghi nhận vị trí thay đổi trong bước mở; test chuyển sang lấy mốc trong click event như lifecycle owner, vẫn giữ so sánh pixel chính xác. |
| Gallery/resource chạy lặp ba lần | 18/18 pass, gồm decoded textures và bảy lần chuyển phòng mỗi ca lifecycle. |
| Bổ sung texture tải muộn, profile và XR | 4/4 pass; PNG trước/sau tải texture thay đổi mà không thao tác camera; teleport qua central aisle và stereo/select/snap-turn/restore. |
| Fullscreen suite sau sửa mốc đo | 16/16 pass (`museum-fullscreen.spec.ts --repeat-each=2`); ca mở/đóng ba lần cũng đã qua 8/8 lượt chẩn đoán trước đó. |

Log lệnh và kết quả đầy đủ trên máy chạy: `front-end/tmp/immersive-unit-final.log`, `immersive-build-delivery.log`, `immersive-lint-final.log`, `immersive-surfaces-verified.log`, `immersive-final-proof.log`, `immersive-delivery-final.log` và `immersive-fullscreen-verified.log`. Không cộng các lượt lặp/trùng thành số ca độc lập hoặc tuyên bố toàn bộ suite diện rộng đã chạy xanh sau cùng.

Các lỗi trong lượt diện rộng đã dẫn tới sửa/kiểm chứng: đợi renderer thật sự idle khi đo; material readiness trong demand mode; catalogue không che nút retry khi mất detail; chụp web camera sau intro trước khi so sánh XR restore. Chỉ loại trừ timing không xác định của test sau khi kiểm tra invariant tương ứng, không tăng budget để che resource leak.

Lint nền nằm ở `scripts/e2e-cms-workflow.mjs` (Node globals), `tests/fixtures/cmsExhibitsApi.ts`, `tests/fixtures/cmsReportsWorkflowApi.ts` (`prefer-const`) và `src/pages/client/CollectionPage.tsx` (hook warning). Diff với `origin/dev` của cả bốn file rỗng. Không sửa CMS ngoài phạm vi để làm xanh lint toàn app.

Lệnh tái hiện nhóm liên quan:

```powershell
npm.cmd run build
# Terminal riêng: npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort
$env:CI = ''
$env:PLAYWRIGHT_PREVIEW = '1'
npm.cmd test -- museum-fullscreen.spec.ts museum-immersive-ui.spec.ts museum-gallery.spec.ts museum-resource-budget.spec.ts museum-performance.spec.ts museum-xr.spec.ts --reporter=line
```

Preview thủ công được reuse vì teardown webServer do Playwright quản lý từng bị treo trên Windows. Không build lại `dist` khi tests đang chạy. Live API checks không chạy vì backend localhost:3001 không hoạt động; không seed/chỉnh database để tạo dữ liệu kiểm thử.

## Visual QA và số đo

- [Trước: gallery thật sau reset camera](evidence/before-gallery-reset.png), chụp từ archive `origin/dev` trong thư mục tạm; đây là ảnh so sánh chính, tránh chỉ dùng first-frame lỗi của bản cũ.
- [Trước: first-frame bị hướng xuống sàn](evidence/before-initial-view.png), bằng chứng riêng cho lỗi camera mở đầu.
- [Sau: desktop 1440 × 900](evidence/after-desktop.png).
- [Sau: portrait 390 × 844](evidence/after-mobile.png).
- [Sau: landscape 844 × 390 và detail overlay](evidence/after-landscape-detail.png).

Đã mở và xem trực tiếp cả ba ảnh sau trên bản build cuối: room có phân nhịp walnut/stone, bronze trim, ceiling wells, biến thiên đá và bóng tiếp xúc; HUD thu gọn, portrait thấy được room, landscape panel phủ trên scene. Cũng kiểm tra touch target 44 px và controls không bị che tại 320 × 568. Chất lượng hình khối fixture vẫn là minh họa; không xem đây là mô hình lịch sử hoặc chứng nhận photorealism của hiện vật thật.

| Chỉ số | Baseline snapshot | Sau, phòng đã tải đủ texture |
| --- | ---: | ---: |
| Draw calls | 58 | 57 |
| Geometries | 54 | 61 |
| Materials | 58 | 35 |
| Textures GPU | 5 | 14 |
| Triangles | 6,272 | 10,112 |

[Baseline renderer JSON](evidence/before-renderer.json) và [profile production cuối](evidence/after-profile.json). Baseline canvas khoảng 1246 × 374; sau là fullscreen 1280 × 720. Baseline ban đầu còn chịu ảnh hưởng intro và không phải phép đo steady-state cùng số pixel; bảng chỉ mô tả resource, không chứng minh FPS tăng.

Profile sau: initialization 2,166 ms; drag quan sát khoảng 3.11 FPS trên software renderer. Đây không phải GPU vật lý; chưa xác nhận mục tiêu 60 FPS trên thiết bị đủ khả năng. Balanced tier đo 57 calls, 61 geometries, 35 materials, 14 textures, nằm trong budget 70/70/45/18; 10,112 triangles dưới 25,000. Khi idle frame count dừng. Bốn chu kỳ mở/đóng kiểm tra một renderer live khi mở và không còn renderer live sau đóng; chuyển phòng lặp giữ resource bằng nhau cho cùng phòng.

JS heap sau GC qua bốn lượt vẫn tăng khoảng 10.49 → 12.10 MB; chưa có bằng chứng heap hoàn toàn phẳng hoặc loại trừ mọi leak. Tám texture RGBA+mips có trần lý thuyết khoảng 10.7 MiB, chưa bao gồm environment/shadow/model. GPU/context lifecycle được kiểm chứng riêng với heap.

## Giới hạn và trạng thái Git

- Chưa kiểm chứng GPU thật, Safari/iOS, điện thoại vật lý hoặc headset WebXR. XR simulation kiểm chứng logic và renderer session, không thay thế comfort/tracking/input vật lý.
- Chưa certify CMS/storage đang chạy thật. Fixture tests vẫn đi qua API validation, tải/parse GLB, normalization và error/retry pipeline hiện có.
- Hiện vật thiếu GLB vẫn là hình minh họa trung thực. Độ chân thực cuối phụ thuộc nội dung model/texture được xuất bản từ CMS.
- Lint toàn frontend còn lỗi nền nêu trên và build còn cảnh báo chunk lớn; các file của nhiệm vụ không có lỗi lint mới.
- Không thay backend, API, migration, database hoặc `.env`. Không thêm dependency runtime.
- Không push, tạo PR hoặc merge theo chỉ dẫn trực tiếp của người dùng. URL PR và kết quả merge: không có.

Danh sách commit theo thứ tự và mục đích nằm trong [commit-plan.md](commit-plan.md). Commit tài liệu cuối và working-tree status được cung cấp cùng thông báo bàn giao để không phải tự tham chiếu SHA của chính commit này.
