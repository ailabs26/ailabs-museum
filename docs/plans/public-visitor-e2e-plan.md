# PUBLIC-E2E — Implementation Plan: Visitor Journey 2D → Audio → Transcript → Report

> **Trạng thái:** Người dùng đã duyệt ngày 28/10/2026; đang triển khai trên `test/public-visitor-e2e`. Kết quả thực thi được ghi trong TASK và báo cáo bàn giao; chưa push/PR/merge.
>
> **Source audit:** `ailabs26/ailabs-museum`, `origin/dev` / GitHub `dev` tại `702aeb75d20ceae7c1cd5ef4e909c4eae77e2d19` (28/10/2026). **Fetch lại `origin/dev` và kiểm tra diff khi triển khai.**
>
> **Đề xuất nhánh:** `test/public-visitor-e2e` → PR vào `dev`. Một nhiệm vụ = một nhánh/PR; chỉ push/PR/merge sau yêu cầu cụ thể của người dùng.

**Goal:** Bàn giao **bộ Playwright E2E dành cho khách tham quan public** có một kịch bản nối liền `/collection` → chọn hiện vật → trang 2D → nghe audio → đọc transcript/WebVTT → gửi báo cáo nội dung, đồng thời bảo toàn các spec đã có và có báo cáo kiểm thử tái lập được.

**Không phải goal:** viết lại chức năng, xác nhận toàn website đạt WCAG 2.2 AA, thực hiện NVDA/VoiceOver, xây hệ thống CI hoặc tạo dữ liệu/báo cáo trên DB thật. Task accessibility audit đã được người dùng **tạm hoãn**, không kéo vào PR này.

**Kiến trúc kiểm thử:** Browser thật bằng Playwright + Vite (ưu tiên **production preview**); mock *API rooms, auth, ảnh/audio/VTT và POST report* bằng fixture đã có. Audio phải phát bằng `HTMLAudioElement.play()` thực qua WAV fixture, không mock `play` hoặc set `currentTime` để giả thành công. UI là runtime thật; API/media là mocked. Kiểm đúng payload report của **revision khách đã xem**, không gửi request ghi vào backend.

**Spec/Task:** [`../tasks/public-visitor-e2e.md`](../tasks/public-visitor-e2e.md).

---

## 1. Audit code hiện tại (đã xác minh)

| Thành phần | Hiện trạng trên `dev` | Quyết định |
|---|---|---|
| `front-end/tests/collection.spec.ts` | 14 bài: rooms, filter pills, search, loading, error/retry, focus, responsive | **Giữ nguyên**; chạy regression |
| `front-end/tests/exhibit-detail.spec.ts` | Điều hướng 2D/URL, transcript, fallback, content/schema guards, focus | **Giữ nguyên**; chạy regression |
| `front-end/tests/public-audio.spec.ts` | Audio thật qua WAV mock; currentTime tiến triển, WebVTT, Stop/cleanup, lỗi media | **Giữ nguyên**; chạy regression |
| `front-end/tests/audio-player.spec.ts` | Component-level browser tests cho playback/seek/pause/captions | **Tái dùng**, không sao chép các test điều khiển đơn vị |
| `front-end/tests/public-report-modal.spec.ts` | Collection submit `POST /api/public/reports`, validate category/message, `exhibitId`/`reportedRevisionId`, 429; detail/tour có modal | **Giữ nguyên**; hành trình mới submit từ **Detail** thay vì card Collection |
| `front-end/tests/public-image-audio-live.spec.ts` | Opt-in `MUSEUM_LIVE_TEST=1`, đọc media từ API thực; không ghi DB. Ledger cũ ghi live 1/1 PASS ngày 23/10 | **Tùy chọn**, tách khỏi bộ mocked; không dùng làm bằng chứng submit report live |
| `front-end/tests/fixtures/publicMediaApi.ts` | `installMedia(page)` tạo room từ `publicRoomWithMediaResponse`, route `**/api/rooms**`, auth, WAV/VTT/image | **Dùng lại**; không thêm mock media trùng lặp |
| `front-end/tests/fixtures/publicRoomWithMedia.ts` | Một room và exhibit `Bình gốm` với UUID exhibit/revision và transcript tiếng Việt | **Đọc ID/slug/name từ fixture**, không hardcode |
| `ExhibitGrid.tsx` | Link có accessible name `Xem chi tiết ${exhibit.name}`; card `<li>` trong list tên `Hiện vật trong bộ sưu tập` | Locator theo `role/name`, scope vào card |
| `ExhibitDetailPage.tsx` | Route thật `/collection/:roomSlug/exhibits/:exhibitId`; heading H1, `AudioPlayer`, section `Bản thuyết minh`, nút `Báo nội dung` | Bám giao diện hiện tại, không assert route cũ |
| `PublicReportModal.tsx` | Dialog `Báo cáo nội dung`; `NativeSelect` `Danh mục`, `Textarea` `Nội dung bổ sung`, `Gửi báo cáo`; trim + validation; success toast | Test submit qua UI, chờ 201 mocked, dialog đóng/toast hiện |
| `reports.service.ts` | `http.post('/public/reports', { exhibitId, reportedRevisionId, category, message })` | Bắt request `**/api/public/reports` và kiểm chính xác nội dung |
| `front-end/playwright.config.ts` | Base `http://127.0.0.1:4173`; `PLAYWRIGHT_PREVIEW=1` → `npm run preview`; Windows `msedge`; 1 worker, SwiftShader; trace failure | Không sửa config trong scope; dùng đúng lệnh trong phần 5 |

**Gap thực tế:** test các mắt xích **đã tồn tại**, nhưng chưa thấy một spec đi từ **Collection 2D tới Detail**, phát audio, kiểm transcript/caption rồi **gửi report trong một browser session**; cũng chưa thấy báo cáo bàn giao độc lập cho chính visitor journey này. Không được viết rằng các spec cũ “chưa kiểm giao diện”: chúng là Playwright browser tests với API mocks; trước đây người dùng cũng đã test UI thật.

---

## 2. Scope, boundary và phương án

### Trong phạm vi

1. Thêm **một spec** `front-end/tests/public-visitor-journey.spec.ts` (primary happy-path journey; chỉ thêm negative/lifecycle case nếu có khoảng trống thực sự, không copy toàn bộ tests cũ).
2. Dùng `installMedia(page)` và `fulfillMuseum` có sẵn. Route duy nhất mới của journey là `POST **/api/public/reports`; bảo đảm không lọt request ghi ngoài mock.
3. Chạy focused spec, affected public specs, quality gates frontend; ghi count/exit code/commit/OS/browser thực tế vào **`docs/plans/reports/public-visitor-e2e-report.md`** khi triển khai.
4. Tài liệu chạy test/bàn giao: lệnh, fixture, mocked vs live, evidence, coverage matrix, limitations, runbook lỗi.
5. Chỉnh cực nhỏ trong fixture/test nếu có repro rõ ràng; nếu cần sửa production code, ghi issue và xin duyệt thay đổi scope trước.

### Ngoài phạm vi

- WCAG audit thực địa, NVDA, VoiceOver hoặc tuyên bố WCAG 2.2 AA.
- Backend, database, migrations, seed, auth, RBAC, Admin CMS, publishing, content-report workflow của Admin.
- Thực hiện `POST /public/reports` trên backend/dev DB thật; không tạo test report persistent hoặc tự cleanup dữ liệu ngoài phạm vi.
- Sửa Hero 3D/Canvas, tour XR, audio renderer, refactor shared modules; không thêm dependencies, video automation, `waitForTimeout`/sleep tùy tiện.
- Xây CI/CD mới; không giả định GitHub Actions đã có.

### Điều kiện mở rộng

Chỉ sửa runtime khi test có bằng chứng lỗi sản phẩm, không phải selector drift/timing, và người dùng phê duyệt riêng. Nếu browser không hỗ trợ audio, phân biệt lỗi môi trường/codec với lỗi sản phẩm, tái chạy theo matrix tối thiểu trước khi quyết định sửa.

---

## 3. Thiết kế visitor journey

**Tổ hợp chính:** Playwright Chromium / Edge hiện có, route test tại `127.0.0.1:4173`, cùng context/page, mocked GET rooms+media và POST report; không bật `MUSEUM_LIVE_TEST`.

### Trình tự và assertion

| Step | Hành động người dùng | Assertions quan trọng | Evidence |
|---|---|---|---|
| E2E-01 | `installMedia(page)`, gắn POST interceptor rồi `page.goto('/collection')` | H1 `Bộ sưu tập`; tên room có, đúng card `Bình gốm` lấy từ fixture; không phải fallback demo | `getByRole('list', { name: 'Hiện vật trong bộ sưu tập' })` |
| E2E-02 | Chọn link `Xem chi tiết ${exhibit.name}` ở card, ưu tiên `focus()` + `press('Enter')` nếu hợp lý | URL `/collection/${encodeURIComponent(room.slug)}/exhibits/${exhibit.id}`, H1 exhibit đúng, nội dung mô tả; không mount Tour/WebGL | `toHaveURL`, `heading` |
| E2E-03 | Khảo sát `Thuyết minh audio`; click `Phát` | Trước click audio paused; request WAV chỉ xảy ra sau tương tác; `HTMLAudioElement.currentTime > 0` theo `expect.poll` (KHÔNG giả `playing`) | media request log, `expect.poll` |
| E2E-04 | Kiểm WebVTT | Hiển thị `Phụ đề hiện tại` = `Thuyết minh đồng bộ` từ fixture; không lệ thuộc timeouts cứng | `getByLabel('Phụ đề hiện tại')` |
| E2E-05 | Đọc transcript trong section có heading `Bản thuyết minh` | Text khớp `exhibit.audio?.vi?.transcript` (fixture là `Thuyết minh`), DOM vẫn hiện khi audio pause/stop | scope section/region, không `getByText` global dễ trùng |
| E2E-06 | Pause audio nếu cần, bấm nút `Báo nội dung` ở **Detail** | Dialog `Báo cáo nội dung` hiện, category/message có nhãn đúng | scoped modal locators |
| E2E-07 | Chọn `wrong_info`, nhập `'  Sai niên đại  '`, submit bằng nút `Gửi báo cáo` | Mock nhận **đúng một** POST; `exhibitId`, `reportedRevisionId` đúng của exhibit đang hiển thị; `category=wrong_info`; `message='Sai niên đại'` (trim) | `route.request().method()`, `postDataJSON()`, count |
| E2E-08 | Response 201 giả lập | Modal đóng, toast `Đã gửi báo cáo nội dung` hiện; vẫn đang ở trang Detail, heading đúng | `expect(dialog).toHaveCount(0)`, toast, URL |

**Tránh test mỏng:** không chỉ assert nút/audio tồn tại; phải kiểm tiến trình âm thanh > 0, transcript riêng với WebVTT và payload của revision hiện tại. **Tránh test quá rộng:** lỗi 429, invalid form, source cleanup, report từ Collection/tour đã có spec độc lập; đưa vào regression chứ không viết lại.

### Cách setup an toàn

- `const room = await installMedia(page); const exhibit = room.exhibits[0];`
- **Trước `page.goto`:** đăng ký `page.route('**/api/public/reports', async route => { ... })`. Trong handler kiểm method `POST` và ghi `postDataJSON()`, phản hồi qua `fulfillMuseum(route, {success:true,data:{id:<UUID>,status:'open'},message:null}, 201)`; có thể dùng `envelope` giống test report hiện tại.
- Dùng recorder **mảng các requests** thay vì biến payload đơn để kiểm không gửi trùng. Có thể `expect.poll(() => calls.length).toBe(1)` sau submit, nhưng không dùng sleep để chứng minh không duplicate. Sử dụng route handler/assertion yêu cầu thực tế và chặn mọi request report ngoài handler.
- Dựa vào `room.slug`, `exhibit.id`, `exhibit.revisionId`, `exhibit.name`; không hardcode slug `sculpture` trong fixture media (slug hiện tại `e2e-1792074612`).
- Screenshot/trace của test lưu trong `test-results`/`tmp` bị ignore, không commit artifact nhạy cảm. Test có thể sử dụng reporter JSON/HTML ở thư mục tạm nếu cần, nhưng không đổi `playwright.config.ts` chỉ để tạo report.

### Ghi chú về tính deterministic

- `installMedia` mock WAV thật bằng `createWavFixture` (8 giây), VTT một cue `00:00.000 --> 00:08.000`, image PNG; không yêu cầu database hay người dùng đăng nhập.
- Không mock `HTMLMediaElement.play()` trong happy path; browser thực sự phải decode/play. `expect.poll` thay cho `waitForTimeout`.
- Khi test cần mở Report trước khi audio kết thúc, **pause** sau khi kiểm playback/cue để giữ kết quả ổn định. Đừng assert audio bị dừng khi report mở nếu chưa có requirement như vậy.
- Trên DOM, `Bản thuyết minh` và `Thuyết minh audio` là hai khu vực khác nhau; phải scope locator. `CollectionPage` có nhiều status roles, đừng dùng `page.getByRole('status')` toàn trang một cách mơ hồ.
- Có thể chạy `PLAYWRIGHT_PREVIEW=1` **sau** build; không bật `MUSEUM_LIVE_TEST=1` cho test gửi report.

---

## 4. Coverage và acceptance criteria

| ID | Acceptance | Điều kiện PASS |
|---|---|---|
| AC-01 | Đúng hành trình người dùng | Bắt đầu từ Collection bằng tương tác UI, không `page.goto` thẳng Detail trong test chính |
| AC-02 | Đúng exhibit và route | Card, URL, H1 và nội dung khớp fixture; không load Tour 3D |
| AC-03 | Playback thật của browser | Audio không autoplay; `currentTime` tiến triển sau click Phát; controls readable |
| AC-04 | Captions + transcript độc lập | VTT cue hiển thị, section transcript đúng text, không nhầm hai vùng |
| AC-05 | Report từ trang Detail | Dialog mở được, chọn category và nhập message, đúng form public |
| AC-06 | Revision integrity | Bắt POST chính xác một lần và payload dùng `exhibit.id`/`exhibit.revisionId` của nội dung đã xem |
| AC-07 | UX sau submit | Mock 201 → modal đóng, toast thành công, route/heading không đổi |
| AC-08 | Không ghi dữ liệu thật | Mọi GET/media và `POST /api/public/reports` trong primary spec được intercept; không bật live env |
| AC-09 | Regression không suy giảm | Focused journey và affected suites PASS trên cùng code; failures phân loại reproducible |
| AC-10 | Quality gates | `typecheck`, lint, unit, build, targeted ESLint và `git diff --check` đạt hoặc ghi lỗi thật kèm quyết định xử lý |
| AC-11 | Handoff | Báo cáo có SHA/branch, exact commands, environment, pass/fail/skip, coverage, mocked/live disclaimer, limitations |
| AC-12 | Scope | Chỉ test/docs/fixture thật sự liên quan; không đổi production runtime hoặc API contract khi chưa được duyệt |

**Exit rule:** Chỉ gọi **E2E journey DONE** khi AC-01→AC-12 đã xác nhận với execution evidence. Status nếu chưa chạy: **NOT RUN**, không thay bằng kết quả của PR cũ.

---

## 5. Verification runbook (chạy từ `front-end/`)

Đầu tiên: `git fetch origin`, tạo branch từ `origin/dev` mới nhất, `npm ci` nếu cần; xác nhận Node/npm và browser Playwright đã cài theo môi trường. Chọn một shell nhất quán (PowerShell có thể dùng `$env:PLAYWRIGHT_PREVIEW='1'`).

```bash
# Focused new journey — fixture/test trên Vite dev
npx playwright test tests/public-visitor-journey.spec.ts --reporter=line

# Regression targeted trong cùng app
npx playwright test tests/collection.spec.ts tests/exhibit-detail.spec.ts tests/public-audio.spec.ts tests/public-report-modal.spec.ts tests/audio-player.spec.ts tests/accessibility-keyboard.spec.ts --reporter=line

# Quality gates
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx eslint tests/public-visitor-journey.spec.ts

# Production preview: sau khi npm run build (Unix shell)
PLAYWRIGHT_PREVIEW=1 npx playwright test tests/public-visitor-journey.spec.ts tests/public-report-modal.spec.ts tests/public-audio.spec.ts --reporter=line
```

**Windows PowerShell:** `$env:PLAYWRIGHT_PREVIEW='1'; npx playwright test tests/public-visitor-journey.spec.ts tests/public-report-modal.spec.ts tests/public-audio.spec.ts --reporter=line; Remove-Item Env:PLAYWRIGHT_PREVIEW` (xóa biến sau lượt chạy để tránh nhiễm môi trường). **Không** đặt `MUSEUM_LIVE_TEST=1` trong các lệnh ghi báo cáo; nếu env này có sẵn, unset trước.

**Optional read-only live evidence:** `public-image-audio-live.spec.ts` đã có, cần backend/content thật và biến `MUSEUM_LIVE_TEST=1`. Nếu không có môi trường, ghi **NOT TESTED**; nếu bị `skip` do thiếu media, ghi **SKIPPED/BLOCKED**, không gọi PASS. Không bổ sung live report submission khi chưa có yêu cầu về DB test/teardown an toàn.

**Regression nền cần ghi tách biệt:** Homepage Hero 3D mới có thể làm assertion `canvas=0` trong `home-featured.spec.ts` lệch khi WebGL khả dụng; đây không phải tiêu chí của visitor journey. Nếu mở rộng run sang homepage và gặp lỗi, ghi issue/test drift riêng, không sửa Hero trong nhánh E2E này nếu không được duyệt.

---

## 6. Deliverables và file map

| File | Action | Mục đích |
|---|---|---|
| `docs/plans/public-visitor-e2e-plan.md` | ADD | Plan thiết kế/boundary, acceptance, runbook |
| `docs/tasks/public-visitor-e2e.md` | ADD | Task chi tiết, checklist, evidence ledger |
| `front-end/tests/public-visitor-journey.spec.ts` | ADD **khi triển khai** | Browser visitor happy path xuyên suốt |
| `front-end/tests/fixtures/publicMediaApi.ts` | REUSE (sửa chỉ khi thực sự cần) | API/media fixture hiện có |
| `front-end/tests/public-report-modal.spec.ts` | REUSE | Validation, report failures, Collection/tour entry |
| `front-end/tests/public-audio.spec.ts` | REUSE | Failure/lifecycle/captions ở public |
| `front-end/tests/collection.spec.ts`, `exhibit-detail.spec.ts`, `audio-player.spec.ts` | RUN | Regression và coverage có sẵn |
| `docs/plans/reports/public-visitor-e2e-report.md` | ADD **sau khi chạy** | Báo cáo kiểm thử và bộ scripts bàn giao |
| Production code / BE / DB | **NO CHANGE** | Chỉ mở scope nếu có bug sản phẩm được duyệt |

---

## 7. Rủi ro, phân loại kết quả, review gate

1. **Mock vs real E2E:** Browser UI là thật và các thao tác chạy end-to-end trong frontend, nhưng API response/media bị mock. Không ghi “đã xác minh báo cáo lưu vào DB” nếu chỉ assert request + 201 mocked.
2. **Audio flakiness:** Auto-play policy? Chỉ gọi play qua click; kiểm `currentTime > 0` bằng poll và track/cue. Nếu môi trường thiếu codec/GPU, thu trace, so lại với `public-audio.spec.ts` đã có trước khi thay test.
3. **Selector drift:** Ưu tiên accessible role/name và scope; không ép UI đổi vì test cũ. Không chờ bằng milliseconds cố định.
4. **Report revision:** Truyền revision đang được xem, không lấy revision latest từ mock ngoài fixture. Không lộ dữ liệu nhạy cảm trong log/report.
5. **Environment contamination:** Base 4173 fixture, 5173 live; đảm bảo `MUSEUM_LIVE_TEST` unset. `PLAYWRIGHT_PREVIEW=1` yêu cầu build mới.
6. **Test-run claims:** PASS/FAIL/SKIP/count/exit code chỉ được điền sau khi đã chạy cùng SHA; không dùng kết quả 51/51 hoặc 89/89 cũ làm kết quả của test mới.
7. **Quy trình Git:** Không tự tạo remote branch, push, PR hay merge. Review scope, diff và run logs trước handoff; PR chỉ vào `dev` theo `AGENTS.md`.

**Định nghĩa bàn giao cuối:** 01 journey spec chạy xanh, các regression liên quan xanh hoặc lỗi ngoài scope được ghi rõ và duyệt, quality gates đạt, có report đủ môi trường/SHA/commands/results, không có DB write thật. Nếu chưa đủ, ghi **PARTIAL / BLOCKED** trung thực.
