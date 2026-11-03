# Bằng chứng kiểm chứng

## Baseline (trước source edits)

- Working tree sạch; nhánh ban đầu dev; remote SSH `git@github.com:ailabs26/ailabs-museum.git`.
- Fetch origin/dev thành công; base a9591858d77312a36efb5b6e891ea400d55ac94f. Nhánh mới feat/visitor-experience-toolkit.
- `npm run ...` bị PowerShell ExecutionPolicy chặn npm.ps1, exit 1; dùng npm.cmd như README, không thay policy/config.
- `npm.cmd run typecheck`: PASS exit 0.
- `npm.cmd run lint`: PASS exit 0, 1 warning CollectionPage:29 exhaustive-deps vì exhibits được tạo lại.
- `npm.cmd run test:unit`: PASS exit 0, 33 files / 179 tests.
- `npm.cmd run build`: PASS exit 0; main 1.008,73 kB (gzip 305,25 kB), CSS 253,45 kB; cảnh báo chunks >500 kB đã có sẵn.
- Đã đọc Playwright config: fixtures + Edge Windows, port 4173, workers 1; live tests opt-in, không tự khởi động API/database.

## Nhật ký thực thi

### Triển khai theo phần

| Phần | Bằng chứng hiện tại |
|---|---|
| Persistence | Lần đầu test báo thiếu module (không tính behavioral RED); sau code 12/12 unit PASS. Typecheck phát hiện generic Zod envelope, đã sửa parse envelope/value riêng và PASS. |
| Favorites | Browser RED thiếu nút yêu thích; GREEN 3/3: keyboard toggle, detail/reload, filter + search, removed exhibit, corrupt/quota. Lần RED đầu Windows teardown không kết thúc, đã ngắt sau khi test báo FAIL; các lần GREEN exit 0. |
| Recent | Browser RED thiếu region; GREEN 2/2: đúng phòng/link/order, dedupe/reload/clear, invalid URL không ghi, hidden room không hiển thị. |
| Comparison | Browser RED thiếu nút; GREEN 2/2: giới hạn3, deselect/remove/clear, đổi phòng, Escape/return focus, ref bị gỡ sau refresh. |
| Reading | Browser RED thiếu toggle; GREEN 1/1: keyboard, scale100–150%, reload/reset, semantic content. |
| Notes | Browser RED thiếu textbox; GREEN 2/2: plain text/create/edit/delete/isolation/reload/maxlength/quota/retry/no HTTP writes. |
| Memo | `npx.cmd eslint src/pages/client/CollectionPage.tsx --max-warnings 0`: RED exit1 do exhaustive-deps; sau useMemo([detail]) GREEN exit0. Browser sort tiebreak ID + search/favorite/refetch PASS. Browser test bảo vệ hành vi, lint trực tiếp bảo vệ dependency. |
| Cross-feature | 6/6 browser đầu PASS: sort/refetch, two-tab sync, stale hide, 320/768/1280 light-dark, CSS zoom2 ở1280, reduced-motion/mobile compare/focus trap, room back/forward. |

### Review độc lập và sửa lỗi

Reviewer read-only khảo sát toàn diff + spec, xác nhận 2 Important và 1 Minor. Không có backend/CMS/XR/dependency changes.

1. Retry quota ghi đè mục khác từ tab B: unit test tạo/sửa/xóa và nhiều lần fail → RED, patch merge delta `base/local/remote` → GREEN. Base được cập nhật sau mỗi lần merge+write fail để không nhận remote record thành local edit. Browser quota hai tab PASS.
2. Cached success khi detail stale đang refetch lỗi vẫn ghi recent: browser RED (storage đã có ref dù kết thúc h1 lỗi); patch chỉ record khi list/detail success và không fetching → GREEN.
3. Bỏ thích card cuối trong filter mất focus về BODY: browser RED; callback đưa focus tới h1 ổn định → GREEN. Ruling: xử lý ngay vì tác động trực tiếp tới keyboard/a11y thuộc acceptance.
4. Re-review xác nhận cả3 fix; phát hiện thêm recent merge phục hồi refs không thay đổi vừa bị tab khác clear. Unit RED; patch chỉ merge prefix mới/moved, tôn trọng remote deletion của suffix cũ → GREEN. Ruling: sửa ngay vì ý nghĩa xóa lịch sử riêng tư cần được bảo toàn.

Reviewer xác nhận không còn Important/Critical trong patch trước bước4; patch bước4 có unit regression. Không tạo reviewer thứ hai hoặc review ngoài phạm vi.

### Lượt hồi quy rộng đầu (dev server)

`npm.cmd test -- collection.spec.ts exhibit-detail.spec.ts home-featured.spec.ts public-visitor-journey.spec.ts public-report-modal.spec.ts public-tour-navigation.spec.ts public-image-audio.spec.ts public-audio.spec.ts tour-2d-fallback.spec.ts tour-exhibit-deep-link.spec.ts visitor-favorites.spec.ts visitor-recent.spec.ts visitor-comparison.spec.ts visitor-reading.spec.ts visitor-notes.spec.ts visitor-regression.spec.ts`

**97 tests: 93 PASS, 4 FAIL**, exit1 (5,2 phút):

- Collection background refresh: assertion tổng 2 status nay nhận3 vì thêm live region so sánh. Đã thay bằng assertion từng region có tên (loading singleton + comparison rỗng), giữ observer chống thông báo tải lặp và kiểm focus; focused rerun PASS.
- Home featured first3: test kỳ vọng toàn trang không Canvas, homepage hiện có HeroCanvas (file không sửa).
- Public image `/`: naturalWidth vẫn0 trong timeout fixture ở home.
- Tour deep link opening3D: nút catalogue không xuất hiện theo locator cũ khi immersive mở.

**Đối chiếu baseline có thực thi:** trích nguyên `git archive origin/dev front-end` (SHA a959185) vào thư mục tạm, dùng dependency có sẵn và port4174 riêng, chạy đúng 3 bài cuối. **Cả3 cùng FAIL với cùng assertion**. Không sửa tests hoặc production để che các lỗi này; homepage HeroCanvas và 3D lifecycle ngoài phần triển khai. Windows teardown của baseline treo sau khi cả3 báo FAIL; ngắt teardown, error-context/trace đủ bằng chứng. Bản đối chiếu giữ trong `.claude/worktrees/visitor-baseline-261030/` (ignored), không phải nhánh/worktree Git mới.

### Các lượt kiểm tra bổ sung

- `npm.cmd run test:unit`: 35 files /191 PASS ở lượt đầu sau5 features. Sau fixes: focused persistence/state 15/15 PASS; sẽ ghi full final dưới đây.
- Focused review fixes: 3/3 browser PASS; notes/regression/storage 13/13 PASS trước tách memo test.
- Build sau5 features: PASS; main1.024,97kB/gzip310,24kB so baseline1.008,73/gzip305,25 (+~5kB gzip), CSS254,24kB so253,45. Không dependency mới; scene/three chunks giữ kích thước cũ. Cần build lại sau review fixes.
- Lint chạy song song Playwright gặp ENOENT khi Playwright dọn test-results; đây là race công cụ, không lỗi source. Gate cuối sẽ chạy lint tuần tự khi không có browser suite khởi động.
- Khôi phục dependency: PowerShell Move-Item đi theo junction của snapshot làm chuyển dependency; đã copy ngược từ chính bản local bằng robocopy, không đổi lockfile/package hoặc cài dependency. Sẽ xác minh bằng gates cuối.

## Gate cuối

| Gate | Kết quả thực tế cuối |
|---|---|
| `npm.cmd run typecheck` | PASS, exit0 |
| `npm.cmd run lint` | PASS, exit0, không errors/warnings |
| `npm.cmd run test:unit` | PASS, exit0, 35 files /194 tests (179 cũ +15 mới) |
| `npm.cmd run build` | PASS, exit0; main1.025,76kB/gzip310,53kB, CSS254,24kB/gzip39,24; cảnh báo chunks>500kB có sẵn. Tăng khoảng5,28kB gzip main so baseline. |
| Production Playwright | **99/99 PASS**, exit0, 2,9 phút; 21 bài mới +78 bài hiện có. Loại riêng3 bài baseline đã xác nhận cùng fail; không skip bí mật hoặc sửa assertion của3 bài đó. |
| Dev recovery smoke | `npm.cmd run dev -- --host 127.0.0.1 --port 4176 --strictPort --force` rồi `npm.cmd test -- --config tmp/dev-recovery.config.ts collection-memo.spec.ts`: **1/1 PASS**, exit0, sau forced re-optimization. Hai lần smoke dev trước khi làm mới cache đã fail (invalid-hook cache / page.goto timeout), không sửa source để che. |
| Git | diff --check/cached --check PASS trước từng commit; fetch cuối vẫn a959185, không upstream commits mới; không merge/rebase/push. |

Lệnh production chính xác (chạy từ front-end, đã khởi động `npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort` riêng để Playwright reuse đúng preview; dừng server sau test):

```powershell
$env:PLAYWRIGHT_PREVIEW = '1'
npm.cmd test -- collection.spec.ts collection-memo.spec.ts exhibit-detail.spec.ts home-featured.spec.ts public-visitor-journey.spec.ts public-report-modal.spec.ts public-tour-navigation.spec.ts public-image-audio.spec.ts public-audio.spec.ts tour-2d-fallback.spec.ts tour-exhibit-deep-link.spec.ts visitor-favorites.spec.ts visitor-recent.spec.ts visitor-comparison.spec.ts visitor-reading.spec.ts visitor-notes.spec.ts visitor-regression.spec.ts visitor-storage.spec.ts --grep-invert 'homepage shows the first three|API image decodes in /$|opening 3D from a deep link keeps'
```

## Accessibility và UI evidence

- Keyboard Enter/Space cho favorite, controls và notes; aria-pressed/labels, maxlength, live statuses có tên; Modal trap/return focus/Escape; filtered card removal focus h1.
- 320/768/1280px light/dark; reading font150%; CSS zoom2 tại1280px không overflow; reduced-motion comparison. Đây là kiểm tra layout tự động, **không** là đo screen reader hoặc native browser zoom trên thiết bị thật.
- Đã xem trực quan ảnh mobile dark, desktop light, comparison mobile; không thấy clip/overflow ở controls; comparison dùng vùng cuộn ngang có tên, focusable.
- Evidence đã lưu: [detail dark/mobile](evidence/detail-dark-mobile.png), [detail light/desktop](evidence/detail-light-desktop.png), [comparison mobile](evidence/comparison-mobile.png). Ảnh là fixtures test, không phải nội dung giả production.
- Existing suite PASS bảo vệ public report, image/audio/transcript/lifecycle, invalid IDs, public schema/loading/error/retry, home featured (trừ baseline nêu trên), tour links/fallback/WebGL-disabled, deep linking (trừ baseline catalogue immersive).

## Giới hạn và rủi ro còn lại

- Không chạy backend checks vì không sửa backend; không DB/seed/migration/live API hoặc live headset. Chỉ chứng minh contracts/luồng bằng fixtures validated.
- Không full repository/admin/3D performance suite; không screen reader audit, không xác minh native zoom200% hoặc headset/GPU thật. Cần người phụ trách review UI thực tế trước phát hành.
- localStorage dùng last-write-wins cho cùng mục; không có transaction đa tab. Đọc latest và merge retry bảo vệ các trường hợp xen kẽ đã test, không cam kết serializable khi hai tab ghi đúng cùng thời điểm. Không gửi notes lên server.
- Khi storage bị chặn/quota, UI vẫn dùng RAM và cảnh báo mất dữ liệu sau reload; không thể đảm bảo persistence khi browser từ chối ghi.
- Ba tests baseline còn FAIL cần task riêng; không tuyên bố toàn browser suite PASS hoặc sẵn sàng merge khi chưa review.

## Ledger

T1 complete cc634a0; T2 b900c75 (12 focused unit PASS); T3 2ecaa81 (3 browser PASS); T4 bff8252 (2 browser PASS); T5 8c60411 (2 browser PASS); T6 47c6361 (1 browser PASS); T7 a95bd58 (2 browser PASS); T8 e7ba8fe (lint RED/GREEN + collection memo PASS); review fixes98252e6 (15 focused unit, browser regression PASS); extra storage tests957d495 (3 browser PASS). Whole final proof: unit194 + production99, all selected PASS. Final review: independent read-only reviewer + author whole diff; no remaining known Important/Critical in changed behavior.
