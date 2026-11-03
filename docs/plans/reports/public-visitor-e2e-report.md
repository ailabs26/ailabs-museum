# PUBLIC-E2E — Visitor journey execution report

Ngày: 28/10/2026 (Asia/Bangkok). Thực hiện: Codex. **Verdict: DONE** — AC-01→12 đạt trong phạm vi frontend E2E với API mock.

Repo: `ailabs26/ailabs-museum`; nhánh `test/public-visitor-e2e`; base `702aeb75d20ceae7c1cd5ef4e909c4eae77e2d19`.
Journey được commit tại `f8b92f9`; D06 được commit tại `e402ae6`. Affected run kiểm tree `f8b92f9` + D06 (nội dung test tương đương `e402ae6`); preview kiểm `e402ae6`.
Không có thay đổi runtime/config/dependency/backend/database.

## Môi trường và fixture

Windows NT `10.0.19045.0`, Node `v22.23.2`, npm `10.9.8`, Playwright `1.64.0`, Microsoft Edge `156.0.4314.42` (Chromium), một worker.
Base URL `http://127.0.0.1:4173`; baseline/focused/affected dùng Vite dev, preview subset dùng production build mới.
`MUSEUM_LIVE_TEST` unset; affected đặt `CI=1`, preview đặt `PLAYWRIGHT_PREVIEW=1`, `CI` unset để tái sử dụng preview server do chính task quản lý. SwiftShader theo config hiện có.

Browser/UI chạy thật. [`installMedia`](../../../front-end/tests/fixtures/publicMediaApi.ts) intercept rooms/auth/image/audio/subtitle;
WAV hợp lệ dài 8 giây được browser decode và phát sau click, không mock `play()` hoặc gán `currentTime`.
WebVTT chứa cue `Thuyết minh đồng bộ`; transcript fixture là `Thuyết minh`.
Journey gắn interceptor report trước điều hướng; POST được trả envelope HTTP 201 tại browser.
Payload phải đúng exhibit/revision đã xem, category `wrong_info`, message trim thành `Sai niên đại`, đúng một POST.
Các phương thức report khác bị abort. Test không gửi report vào backend/DB thật.

## Kết quả thực thi

| Lượt | Kết quả | Exit | Bằng chứng |
|---|---|---|---|
| Baseline dev, 4 suites | 41 pass / 1 fail / 0 skip; D06 false positive | 1 | `baseline.json`, `baseline.log` |
| Focused dev, journey + D06 | 4/4 pass, 0 skip; 23.7s | 0 | `focused-dev.log` |
| Affected dev, 7 suites | 69/69 pass, 0 skip/flaky; 6.2m | 0 | `affected-dev.json`, `affected-dev.log` |
| Production preview, journey/audio/report | 15/15 pass, 0 skip/flaky; 36.0s | 0 | `preview.json`, `preview.log` |
| Typecheck | PASS | 0 | `typecheck.log` |
| Full lint | 0 errors, 1 existing warning | 0 | `lint.log` |
| Unit | 31 files / 170 tests pass | 0 | `unit.log` |
| Production build | PASS; chunk-size warning >500 kB | 0 | `build.log` |
| Targeted ESLint, journey + detail | PASS | 0 | `targeted-lint.log` |
| Diff check | PASS | 0 | `git diff --check` |

Logs gốc được tạo ở `.superpowers/sdd/public-visitor-e2e-plan/`; sau bàn giao được giữ tại `front-end/tmp/public-visitor-e2e-evidence/` (ignored), không nằm trong commit.
Kết quả và lệnh tái chạy được lưu trong tài liệu này để người nhận tái lập.

Baseline bắt đầu `2026-10-28T10:47:05.994Z`, duration 468783ms (7.8m), JSON xác nhận 41 pass, 1 fail, 0 flaky.
Runner chậm ở bước cleanup; đã dừng đúng Vite server do lượt baseline tạo để nhận kết quả cuối. Không dùng baseline làm kết quả PASS.
Affected bắt đầu `2026-10-28T10:58:22.752Z`, duration 372131.856ms; cũng cần dừng đúng server của lượt chạy sau test cuối để giải phóng cleanup; JSON xác nhận 69 pass, process exit 0.
Preview khởi động server riêng rồi để Playwright reuse, tránh bước cleanup đó mà không đổi config.
Preview bắt đầu `2026-10-28T11:05:09.942Z`, duration 35975.475ms, kết thúc khoảng `11:05:45.918Z` (18:05:45.918 Asia/Bangkok).
Per-suite preview: public-audio 11/11, public-report-modal 3/3, visitor journey 1/1; toàn bộ 0 fail/skip.
Gates ngày 28/10 (Asia/Bangkok): typecheck 17:47:51→17:48:26; full lint 17:48:26→17:49:25;
unit rerun 17:50:12, duration 7.26s; build 17:49:26→17:50:38. Cả bốn exit 0.
Full lint/typecheck/unit/build kiểm runtime không đổi; targeted lint kiểm thêm hai file test sau khi viết/sửa.
Lượt preview ban đầu đã đưa cả `audio-player.spec.ts` vào ngoài matrix đã duyệt và được hủy (exit 1).
Trang `/tests/fixtures/audio-player.html` chỉ có ở dev; build hiện tại chỉ có entry `index.html`/`tour.html`, nên các assertion component gặp trang 404.
Đây là lỗi chọn môi trường chạy test, không phải 404 khi tải API audio. Đã trở lại matrix của plan, không thêm entry test vào production build.

## Điều tra D06

`exhibit-detail.spec.ts` từng dùng `request.url().includes('/media/')` để bắt tải media ngoài ý muốn.
Trên Vite dev, phép kiểm này bắt nhầm `/src/shared/components/media/AudioPlayer.tsx`, `ExhibitImage.tsx` và CSS/module khác (42 URL), gây assertion `[]` fail.
Sửa duy nhất bộ lọc thành `new URL(request.url()).pathname.startsWith('/media/')`; vẫn bắt media endpoint thật.
D06 cùng hai bài focus liên quan và journey mới đều pass trong focused rerun. Không sửa tải media của sản phẩm.

### Số liệu từng suite (affected dev)

| Suite | PASS | FAIL | SKIP |
|---|---:|---:|---:|
| accessibility-keyboard | 10 | 0 | 0 |
| audio-player | 16 | 0 | 0 |
| collection | 14 | 0 | 0 |
| exhibit-detail | 14 | 0 | 0 |
| public-audio | 11 | 0 | 0 |
| public-report-modal | 3 | 0 | 0 |
| public-visitor-journey | 1 | 0 | 0 |

## Coverage và acceptance

| Step / AC | Assertion | Kết quả |
|---|---|---|
| E2E-01/02, AC-01/02 | Collection card theo fixture → Enter → đúng URL/H1/mô tả, không canvas | PASS dev + preview |
| E2E-03, AC-03 | Paused/no audio request trước click; WAV request và currentTime > 0 sau Phát | PASS dev + preview |
| E2E-04/05, AC-04 | Cue VTT và transcript trong hai region riêng; transcript vẫn đọc được khi pause | PASS dev + preview |
| E2E-06/07, AC-05/06/08 | Form Detail, đúng một POST với exhibit/revision/category/message, hoàn toàn mocked | PASS dev + preview |
| E2E-08, AC-07 | 201 → đóng dialog, toast, giữ URL/H1 Detail | PASS dev + preview |
| AC-09/10 | Regression và quality gates | PASS 69/69 dev + 15/15 preview, gates PASS |
| AC-11 | Lệnh, môi trường, coverage và giới hạn bàn giao | PASS — báo cáo này |
| AC-12 | Chỉ test/docs; D06 sửa assertion có repro | PASS diff review |

Journey source: [`public-visitor-journey.spec.ts`](../../../front-end/tests/public-visitor-journey.spec.ts).
Coverage có sẵn tiếp tục được dùng: [`collection`](../../../front-end/tests/collection.spec.ts),
[`exhibit-detail`](../../../front-end/tests/exhibit-detail.spec.ts), [`public-audio`](../../../front-end/tests/public-audio.spec.ts),
[`audio-player`](../../../front-end/tests/audio-player.spec.ts), [`public-report-modal`](../../../front-end/tests/public-report-modal.spec.ts),
[`accessibility-keyboard`](../../../front-end/tests/accessibility-keyboard.spec.ts).
Validation/429/lỗi media/cleanup đã có tests riêng; journey không sao chép các case đó.

## Tái chạy

Từ `front-end/`, dùng Node 20+; `npm.cmd ci` nếu chưa có dependencies. Windows dùng Edge đã cài; Linux/macOS cần `npx playwright install chromium`.
Dừng server cũ trên 4173 trước khi chuyển dev/preview. Không thay đổi server của công việc khác.

```powershell
$env:MUSEUM_LIVE_TEST = $null
$env:PLAYWRIGHT_PREVIEW = $null
$env:CI = '1'
# Baseline đã chạy trước khi thêm test:
npx.cmd playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/public-audio.spec.ts tests/public-report-modal.spec.ts --reporter=json
# Focused sau khi thêm journey và sửa D06:
$env:CI = $null
npx.cmd playwright test tests/public-visitor-journey.spec.ts tests/exhibit-detail.spec.ts --grep 'visitor follows|D06' --reporter=line
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npx.cmd eslint tests/public-visitor-journey.spec.ts tests/exhibit-detail.spec.ts
# Affected regression chạy trên dev (audio-player dùng HTML fixture chỉ có ở dev):
$env:CI = '1'
$env:PLAYWRIGHT_PREVIEW = $null
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = '../.superpowers/sdd/public-visitor-e2e-plan/affected-dev.json'
npx.cmd playwright test tests/public-visitor-journey.spec.ts tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/public-audio.spec.ts tests/public-report-modal.spec.ts tests/audio-player.spec.ts tests/accessibility-keyboard.spec.ts --reporter=line,json --output=tmp/visitor-e2e-dev
# Production preview: ba suite theo matrix của plan.
# Terminal riêng: npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort
# Sau khi server sẵn sàng, terminal chạy test dùng CI unset để reuse server đó:
$env:CI = $null
$env:PLAYWRIGHT_PREVIEW = '1'
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = '../.superpowers/sdd/public-visitor-e2e-plan/preview.json'
npx.cmd playwright test tests/public-visitor-journey.spec.ts tests/public-audio.spec.ts tests/public-report-modal.spec.ts --reporter=line,json --output=tmp/visitor-e2e-preview
Remove-Item Env:PLAYWRIGHT_PREVIEW, Env:CI, Env:PLAYWRIGHT_JSON_OUTPUT_NAME -ErrorAction SilentlyContinue
git diff --check
```

Nếu lưu JSON ở đường dẫn trên, tạo thư mục log trước bằng `New-Item -ItemType Directory -Force ../.superpowers/sdd/public-visitor-e2e-plan`.
Khi media timeout, giữ trace trong `tmp/visitor-e2e-dev` hoặc `tmp/visitor-e2e-preview`, kiểm request WAV/VTT và response trước khi so với `public-audio.spec.ts`.
Không thêm sleep hoặc giả playback để làm xanh test.

## Giới hạn và bàn giao

**Nghiệm thu DB thật — USER-REPORTED PASS (28/10/2026):** người dùng xác nhận “Đã test chạy trên db thật, mọi thứ cũng đã ok rồi” và duyệt chốt nhiệm vụ để push nhánh, chưa tạo PR. Đây là kết quả kiểm thử do người dùng xác nhận; không quy thành lượt automated live do Codex chạy hoặc suy diễn thêm môi trường/các bước kiểm tra chưa được cung cấp.

Live media [`public-image-audio-live.spec.ts`](../../../front-end/tests/public-image-audio-live.spec.ts): **NOT RUN BY CODEX** trong task này; độc lập với nghiệm thu DB thật của người dùng.
Các automated suites ở trên dùng API mock, không chứng minh ghi report vào DB. Loa vật lý, GPU/điện thoại thật hoặc WCAG 2.2 AA/NVDA/VoiceOver không được xác minh trong các lượt automated này.
Các manual checks cũ của người dùng là historical evidence; không dùng làm kết quả run mới, không yêu cầu kiểm tra lại chung.
Không chạy `home-featured.spec.ts`, nên không khẳng định có lỗi homepage mới. Cảnh báo chunk size và hook dependency có từ trước, ngoài phạm vi test/docs.

Quyết định thực thi: dùng checkout hiện có trên nhánh riêng để giữ tài liệu người dùng; gộp T1–T3 thành một spec commit theo plan;
test thêm coverage cho hành vi đã có nên không tạo lỗi runtime giả để lấy RED; D06 có RED thực tế rồi focused GREEN.
Giới hạn: cùng checkout có thể chịu thay đổi từ công việc khác; prefix media đổi trong tương lai thì assertion D06 cần cập nhật.
Reviewer độc lập rà code journey và D06 theo plan: không có finding cần xử lý. Live DB/loa vật lý/screen reader nằm ngoài scope được duyệt; tác giả đối chiếu báo cáo cuối với JSON/log.
Không có minor finding bị hoãn. Lượt preview sai matrix được ghi rõ và thay bằng hai lượt đúng môi trường, không thay đổi phạm vi sản phẩm.

**Chốt bàn giao:** DONE; người dùng đã nghiệm thu DB thật và yêu cầu push `test/public-visitor-e2e`. Chưa tạo PR hoặc merge. Trạng thái push thực tế được xác nhận bằng remote branch sau khi push.

Commits theo task: T0 `df13494`; T1–T3 `f8b92f9`; T4 `e402ae6`; T5 là commit chứa báo cáo này (xem `git log -1 -- docs/plans/reports/public-visitor-e2e-report.md`).
