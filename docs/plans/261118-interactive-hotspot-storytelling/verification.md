# Kiểm chứng Interactive Hotspot Storytelling

## Môi trường và quality gates

Windows, Node.js `24.8.0`, npm `11.6.0`, Edge headless `157.0.4341.60` với SwiftShader. Các lệnh chạy từ `front-end/` ngày 18/11/2026. Browser tests dùng API fixture và WebXR mô phỏng.

| Kiểm tra | PASS / FAIL / SKIP | Exit |
| --- | --- | --- |
| Baseline `npm run test:unit` tại `cd0155d` | 420 / 0 / 0, 66 file | 0 |
| `npm run typecheck` | Passed | 0 |
| `npm run lint` | Passed, gồm lượt sau chỉnh CSS và tests | 0 |
| `npm run test:unit` | 425 / 0 / 0, 67 file | 0 |
| `npm run build` | Passed | 0 |
| `npm run build -- --outDir tmp/hotspot-final-preview` | Passed trên nguồn cuối | 0 |
| Playwright Storytelling trên production preview cuối | 12 / 0 / 0 | 0 |
| Guided Tour Core trên Vite dev server | 2 / 0 / 0 | 0 |
| Playwright hồi quy rộng, production preview trước chỉnh bố cục nút trên mobile | 165 / 4 / 1 | 1 |
| Chạy lại fullscreen, GLB, WebGL recovery và preview hiện vật trên bản build cuối | 7 / 0 / 0 | 0 |
| Tái hiện hai lỗi còn lại trên bản build `cd0155d` | 0 / 2 / 0 | 1 mỗi lượt |

Build hoàn tất với cảnh báo kích thước chunk của Vite. So với baseline, JavaScript thô của `main` tăng 4.830 byte và `MuseumScene` tăng 3.138 byte.

## Lệnh Playwright

```powershell
# Storytelling, dùng cấu hình mặc định khi cổng 4173 rảnh
npm run build
$env:PLAYWRIGHT_PREVIEW = '1'
npx playwright test tests/museum-hotspot-storytelling.spec.ts --workers=1

# Các ca tải fixture HTML trực tiếp từ thư mục tests
$env:PLAYWRIGHT_PREVIEW = '0'
npx playwright test tests/guided-tour-core.spec.ts --workers=1
```

Lượt Storytelling cuối chạy lại trên một Vite preview ở `127.0.0.1:4185` trỏ tới `tmp/hotspot-final-preview`. Cấu hình cục bộ `tmp/hotspot-final.config.ts` kế thừa `playwright.config.ts` và đổi `baseURL`/thư mục output. Report của lượt này ở `front-end/tmp/hotspot-story-final-proof.json`.

## Hồi quy trình duyệt

```powershell
$env:PLAYWRIGHT_PREVIEW = '1'
node node_modules/@playwright/test/cli.js test 'tests/(museum-(camera|fullscreen|glb|hotspots|hotspots-live|immersive-ui|interaction|lifecycle|navigation|performance|session|switching|xr|xr-disconnect)|guided-tour-(2d|camera|locale|mode-sync)|tour-(2d-fallback|exhibit-deep-link))\.spec\.ts$' --workers=1 --output=tmp/hotspot-production-results --reporter=line,json
```

Report ở `front-end/tmp/hotspot-production-regressions.json`. Ca live GLB được skip theo cấu hình mặc định. Lượt hồi quy rộng chạy trước chỉnh bố cục hai nút chương trên mobile. Lượt Storytelling cuối kiểm tra lại bố cục và toàn bộ luồng mới trên bản build cuối.

- `museum-switching.spec.ts:52` qua bước xác nhận hủy request, sau đó fail ở heading trang chủ. Cả baseline và nhánh tính năng đều hiển thị `Chạm vào di sản. Khám phá theo cách của bạn.` trong khi test dùng mẫu phân biệt hoa thường `/Chạm vào Di sản/`. Report baseline ở `front-end/tmp/hotspot-baseline-switching.json`.
- `tour-exhibit-deep-link.spec.ts:46` giữ đúng hiện vật được chọn và dock có trạng thái pressed. Test tìm một nút trong catalogue đang đóng, nên locator theo role không thấy nút. Cùng lỗi tại cùng assertion trên `cd0155d`. Report baseline ở `front-end/tmp/hotspot-baseline-deep-link.json`.
- `museum-fullscreen.spec.ts:42` hết ngân sách 30 giây. `museum-glb.spec.ts:13` rơi vào WebGL fallback trước bước kiểm tra lỗi mô hình khi chạy đồng thời các lượt SwiftShader. Cả hai qua khi chạy lại trên bản build cuối. Guided Tour recovery cũng qua trên production preview cuối. Lượt dev thử trước đó từng timeout khi chờ Resume mở khóa trước bước thứ hai.

Lệnh chạy lại qua production preview cuối ở cổng 4173, cùng build `tmp/hotspot-final-preview`:

```powershell
node node_modules/@playwright/test/cli.js test tests/museum-fullscreen.spec.ts tests/museum-glb.spec.ts tests/guided-tour-mode-sync.spec.ts tests/exhibit-preview.spec.ts --grep 'three open/close|permission failures and corrupt GLBs|repeated WebGL loss|preview' --reporter=line,json --output=tmp/hotspot-final-regression-replay
```

Report ở `front-end/tmp/hotspot-final-regression-replay.json`. Hai kiểm thử baseline dùng cùng Playwright fixture và duy nhất bản build `tmp/hotspot-baseline` tại `cd0155d`.

## Bằng chứng

- [390×844](evidence/story-390x844.png), [768×1024](evidence/story-768x1024.png), [1280×720](evidence/story-1280x720.png). Đã xem ảnh và kiểm tra trực tiếp cả hai nút chuyển chương, joystick và nút thoát có thể nhận thao tác. Hai nút chuyển chương có chiều cao tối thiểu 44 px.
- [Dữ liệu camera](evidence/story-camera-samples.json) gồm 90 frame, mỗi frame lưu vị trí và quaternion. Các đoạn giữa frame liên tiếp đạt kiểm tra collider proxy và biên phòng. Bước tịnh tiến lớn nhất khoảng `0,0542` đơn vị cảnh và bước xoay lớn nhất `0,065` rad. Marker kết thúc tại NDC `(0, 0, 0,9300)`, camera đạt `inspect` và renderer ngừng vẽ khi rảnh.
- Ca GLB lỗi 404 giữ được story, giữ UUID của bốn mô hình khỏe và ghi nhận đúng một request cho mỗi mô hình. Ca refresh giữ chương khi ID còn tồn tại, cập nhật nội dung và xóa chương khi API rút hotspot.
- Hồi quy renderer ghi nhận không tăng frame khi rảnh, mỗi lần mở có một renderer hoạt động và mỗi lần thoát giải phóng renderer qua bốn chu kỳ. Report profiler ở `front-end/tmp/hotspot-production-results/museum-performance-product-3872d-ource-and-lifecycle-profile/profile.json`.
- Các ca Guided Tour kiểm tra lúc moving, dwell, paused và completed. Ca XR kiểm tra cả controller lẫn gaze đi tới đúng marker, nội dung thực tế vẽ vào panel trong kính, gốc XR giữ nguyên và tư thế camera web khôi phục khi thoát.

## RED và tự review

- RED trên baseline ghi nhận nút hotspot mất focus khi mở điều hướng nội dung. Unit RED chứng minh phép tìm góc nhìn cũ nhắm tâm hiện vật. Các ca tương ứng chạy qua sau triển khai.
- Đã rà diff so với base theo luồng chọn, tái dùng tài nguyên, tọa độ world, camera duy nhất, keyboard, Guided Tour, XR và cleanup. Lượt chạy đầu trên cổng phụ phát hiện CORS hardcode trong fixture GLB. Chỉnh fixture theo origin của request. Với XR, test đặt đường ngắm ở phía hiện vật và xác nhận reticle trước thao tác để panel spawn không chặn ray.
- Phạm vi đo camera dùng collider proxy hiện có. Điều khiển, hiển thị stereo và vòng đời XR được kiểm tra bằng phiên mô phỏng. Headset vật lý, GPU vật lý và API thực chưa được kiểm chứng trong lượt này.
