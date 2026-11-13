# Truy vết task và kế hoạch kiểm chứng FE

Nguồn: [bảng task nhóm, gid=0](https://docs.google.com/spreadsheets/d/1xmQzsXLrDOCqoDdtb4oRs7Pqmvie8yAShbVhiFLjUHU/edit?gid=0#gid=0), snapshot 08/10/2026. Bảng dưới bao phủ **đúng 45 task**, giữ người phụ trách/giai đoạn theo sheet, rút gọn mô tả để chỉ rõ tác động FE. Không thay trạng thái hoặc deadline trên sheet.

Tên rút gọn: **Thắng** = Nguyễn Văn Thắng; **Thành** = Nguyễn Trọng Thành; **Thi** = Đinh Bá Thi; **Tiến** = Đinh Quang Tiến; **Quang** = Nguyễn Đức Quang.

Các mã liên kết kiến trúc: [API/CMS](data-api-and-cms.md), [Màn hình](screens-and-demo.md), [Trải nghiệm](museum-experience.md). Ký hiệu “lệch SRS” trỏ tới [bảng khác biệt phạm vi](README.md), không có nghĩa task bị bỏ. Cột kiểm chứng là **bằng chứng cần có khi triển khai**, chưa phải kết quả đã chạy.

## Giai đoạn 1: MVP theo lịch nhóm, 08/10–09/11/2026

| Task | Người | Công việc và phần FE / kiến trúc | Phụ thuộc và bằng chứng bàn giao |
| --- | --- | --- | --- |
| 1 | Thắng | Schema/ERD/seed, revision/report → [API/CMS](data-api-and-cms.md) | FE nhận schema spec, DTO mẫu/ID/version và ít nhất 5 exhibits; DB/migration do phụ trách DB. Revision lệch SRS |
| 2 | Thắng | Login/logout/JWT, `LoginPage` → [API/CMS](data-api-and-cms.md) | Contract phiên; kiểm login sai/đúng, logout/expiry và deep link; AC-16/17/38 |
| 3 | Thắng | Accounts CRUD/role → [Màn hình](screens-and-demo.md) | API user/role, auth; request bị từ chối không đổi UI thành thành công; lệch SRS Admin cùng quyền |
| 4 | Thắng | Permissions/permission matrix → [Màn hình](screens-and-demo.md) | Mã quyền/action/scope và quyền sửa ma trận từ BE; nhiều tab refresh cần phối hợp task 2, không dùng role local |
| 5 | Thắng | RBAC guard → [API/CMS](data-api-and-cms.md) | Chủ yếu BE; FE xử lý 403/ẩn controls; bằng chứng gọi API trực tiếp vẫn bị chặn |
| 6 | Thành | Room CRUD → [Màn hình](screens-and-demo.md) | Room DTO, validation chuỗi rỗng, xác nhận xóa và lỗi; chốt lệch SRS phòng cố định |
| 7 | Thành | Exhibit form, revision/history, submit → [API/CMS](data-api-and-cms.md) | Schema task 1, auth task 2/5, concurrency; Draft/transform và lịch sử đúng revision; workflow lệch SRS |
| 8 | Thành | CMS media/upload/quarantine → [API/CMS](data-api-and-cms.md) | Endpoint upload và trạng thái xử lý; kiểm MIME/size/error không thay media cũ; AC-32/33 |
| 9 | Thành | Gắn media, public published API → [API/CMS](data-api-and-cms.md) | Task 7/8; FE chỉ nhận DTO validated, BE lọc Draft và bảo vệ media; AC-32/36 |
| 10 | Thành | Upload → metadata → gắn exhibit → Preview → [API/CMS](data-api-and-cms.md) | Task 7–9 và renderer task 11–13; cùng renderer public; kiểm freshness, TTL không đủ AC-51 |
| 11 | Thi | R3F Canvas, light/camera/room, API → [Trải nghiệm](museum-experience.md) | Room contract task 1/9; DOM loading/error tồn tại trước scene; AC-02/40 |
| 12 | Thi | GLB, scale/pivot, raycast/camera, 5 exhibits → [Trải nghiệm](museum-experience.md) | Media/transform spec, task 11; dùng GLB thật, selection ID và Preview/public trùng tọa độ; AC-23/28 |
| 13 | Thi | Hotspot và model fallback → [Trải nghiệm](museum-experience.md) | Task 12 và hotspot contract; lỗi mesh lẻ không sập scene, hotspot DOM tương đương; AC-06/24/28 |
| 14 | Thi | WASD/mouse/touch/joystick → [Trải nghiệm](museum-experience.md) | Task 11/12; desktop/mobile, blur/pointercancel và modal không kẹt input; AC-52 |
| 15 | Thi | WebXR session/controller/fallback → [Trải nghiệm](museum-experience.md) | Task 11–14, HTTPS và thiết bị; detection AC-13/31, XR session/headset ngoài baseline SRS |
| 16 | Tiến | Home/collection nối API → [Màn hình](screens-and-demo.md) | Task 9, DTO mẫu; ít nhất 5 Published, DOM không cần WebGL; AC-01/03/15 |
| 17 | Tiến | Chi tiết 2D và chuyển từ 3D → [Trải nghiệm](museum-experience.md) | Task 16, selection dùng chung task 12/13; giữ ID/locale, xử lý schema lỗi; AC-15/40/53 |
| 18 | Tiến | Audio player/transcript → [Trải nghiệm](museum-experience.md) | Media task 8/9, captions/locale contract; không phát chồng, seek và cleanup; AC-07/08/39/42 |
| 19 | Tiến | Keyboard/modal/WCAG 2.2 AA → [Trải nghiệm](museum-experience.md) | Task 16–18; checklist theo tiêu chí, focus trap/return/zoom/contrast; AC-26/43 và phần 2.2 bổ sung |
| 20 | Tiến | Public Report Modal và API tiếp nhận → [API/CMS](data-api-and-cms.md) | Revision snapshot task 1/9; report đúng version đang xem, lỗi/429/retry; task mở rộng chưa có AC SRS |
| 21 | Quang | Dashboard Admin → [Màn hình](screens-and-demo.md) | Auth task 2/5, API thống kê; phân biệt draft/published, empty/error; không dùng số demo |
| 22 | Quang | Moderation/history/diff/publish/reject/hide → [API/CMS](data-api-and-cms.md) | Task 7/10, revision/transition API; Preview renderer chung, lý do bắt buộc, 409; workflow lệch SRS |
| 23 | Quang | Xử lý report → [API/CMS](data-api-and-cms.md) | Task 20/22; hiển thị snapshot bị report, transition server và lý do; kiểm public không đọc report quản trị |
| 24 | Quang | Audit UI/API → [API/CMS](data-api-and-cms.md) | Mutation server task 6–10/22/23; nhật ký append-only, filter/paging; không tự ghi log FE làm bằng chứng |
| 25 | Quang | Tích hợp CMS, 409/lỗi → [API/CMS](data-api-and-cms.md) | Các API quản trị, version/idempotency; giữ form, tải lại/đối chiếu, không retry ghi mù; AC-41 |

## Giai đoạn 2: kiểm thử, tối ưu, Production v1, 10/11–20/11/2026

| Task | Người | Công việc và phần FE / kiến trúc | Phụ thuộc và bằng chứng bàn giao |
| --- | --- | --- | --- |
| 26 | Thắng | Unit/integration NestJS, transaction/RBAC ≥ 80% coverage → [API/CMS](data-api-and-cms.md) | BE sở hữu coverage; FE cần contract/error fixtures ổn định. Không dùng coverage BE để tuyên bố test FE |
| 27 | Thắng | Backup/restore/RPO/RTO/DB config → [API/CMS](data-api-and-cms.md) | BE/DB thực hiện; FE xử lý API gián đoạn/Retry. Không chạy DB migration/restore trong task FE |
| 28 | Thành | Fuzz upload → [API/CMS](data-api-and-cms.md) | Task 8; bằng chứng API từ chối MIME giả/file quá cỡ/nội dung độc hại, FE giữ media cũ; AC-33 |
| 29 | Thành | k6 API 100–200 CCU, p95 ≤ 500 ms, error < 1% → [API/CMS](data-api-and-cms.md) | Task 9, workload/version/cấu hình rõ; báo cáo riêng AC-49 baseline và target sheet, không thay FPS FE |
| 30 | Thi | Audit 3D desktop ≥ 60/mobile ≥ 30 FPS → [Trải nghiệm](museum-experience.md) | Task 11–14, model thật; FPS/frametime/memory/quality, tải và asset budget; AC-27/44 |
| 31 | Thi | Device matrix/context lost/GLB/VR reject → [Trải nghiệm](museum-experience.md) | Task 13/15/17; ghi thiết bị/version/bằng chứng; XR giả lập không thay headset thật; AC-13/15/28/50 |
| 32 | Tiến | Audit NVDA/VoiceOver/keyboard/WCAG 2.2 → [Trải nghiệm](museum-experience.md) | Task 19; bảng tiêu chí, kết quả thủ công và issue; AC-26/42/43, không kết luận từ scan đơn lẻ |
| 33 | Tiến | Playwright public 2D/audio/transcript/report → [Trải nghiệm](museum-experience.md) | Task 16–20, test runner/fixtures cần cài ở task này; tránh sleep cố định, chờ UI readiness |
| 34 | Quang | E2E CMS tạo nội dung/upload/duyệt/report → [API/CMS](data-api-and-cms.md) | Task 2–10/21–25; API/DB test riêng; kiểm Draft isolation, mutation failure, 409 và freshness |
| 35 | Quang | Bug log/triage/fix sprint Production v1 → [kiểm chứng](#kiem-chung-va-definition-of-done) | Task 26–34; log Blocker/Critical/Minor, owner/retest evidence; không xác nhận v1 khi gate bắt buộc thất bại |

## Giai đoạn 3: mở rộng nếu còn thời gian, 21/11–08/12/2026

| Task | Người | Công việc và phần FE / kiến trúc | Phụ thuộc và bằng chứng bàn giao |
| --- | --- | --- | --- |
| 36 | Thắng | API key/scopes/rate limit/revoke → [API/CMS](data-api-and-cms.md) | BE quản key; FE task 44 nhận contract hiển thị secret/quyền, không log/cache key |
| 37 | Thắng | Analytics retention/aggregation job → [API/CMS](data-api-and-cms.md) | Thuộc BE; chưa có yêu cầu UI/telemetry FE, không tự thêm tracking |
| 38 | Thành | Bulk import/export JSON/CSV → [API/CMS](data-api-and-cms.md) | API validation theo dòng; FE upload/xem kết quả/đọc lỗi, phân biệt partial success |
| 39 | Thành | i18n nội dung Anh/Trung/Hàn/Nhật, fallback vi → [API/CMS](data-api-and-cms.md) | Locale/publication contract; vi/en đã thuộc baseline MVP; không phát nhầm audio fallback |
| 40 | Thi | Guided tour camera theo thứ tự → [Trải nghiệm](museum-experience.md) | Tour order/điểm xem, task 42; baseline dùng teleport Auto, yêu cầu camera mượt/lịch triển khai cần chốt |
| 41 | Thi | Draco/LOD/WebP pipeline → [Trải nghiệm](museum-experience.md) | Asset thực, API metadata/decoder nếu cần; so sánh tải/FPS/chất lượng/fallback trước và sau |
| 42 | Tiến | Tour controls đồng bộ 2D/3D → [Trải nghiệm](museum-experience.md) | Task 40, audio task 18; Manual/Auto/Pause/Resume/Next/Previous/Exit, chống timer cũ; AC-46/47 |
| 43 | Tiến | UI locale/transcript/captions đa ngôn ngữ → [Trải nghiệm](museum-experience.md) | Task 39/18; font Unicode, audio/cue cùng locale; vi/en không được hoãn khỏi MVP SRS |
| 44 | Quang | CMS bản dịch song song/API keys → [Màn hình](screens-and-demo.md) | Task 36/39, quyền từ BE; editor giữ trạng thái locale, secret không lộ qua cache/log |
| 45 | Quang | Nghiệm thu/API docs/hướng dẫn CMS → [kiểm chứng](#kiem-chung-va-definition-of-done) | Tổng hợp contract thực, test report, giới hạn chưa đạt và manual theo workflow đã duyệt; Swagger từ BE |

## Thứ tự tích hợp đề xuất

Đây là thứ tự kỹ thuật để tránh chờ/rework, không tự thay deadline hay người phụ trách trên sheet.

1. Chốt các lệch SRS và contract dữ liệu/auth: task 1/2 cùng người phụ trách 7/9/22; cung cấp response fixture đã validate. Fixtures chỉ dùng phát triển/test, không làm fallback production khi API lỗi.
2. Dựng API boundary/DOM collection-detail (16/17), scene base (11) và CMS auth shell (2/21) trên cùng schema. Component renderer nhận props để public/Preview tái sử dụng.
3. Tích hợp nội dung/media/Preview (7–13/18), controls/fallback (14/15/17), sau đó moderation/report/audit và concurrency (20/22–25). Không nối FE vào Storage để vượt API còn thiếu.
4. Bổ sung hotspot CMS, captions/rights, vi/en và tour Manual/Auto nếu nghiệm thu theo SRS. Task 40/42 không thể vừa “tùy chọn giai đoạn 3” vừa là Must Have chưa làm của MVP.
5. Chạy test/audit theo 26–34, xử lý bug 35, rồi mở rộng 36–44 và bàn giao 45. Chỉ triển khai phần scope đã được nhóm thống nhất.

## Phạm vi nghiệm thu và test case

Mỗi test case ghi task, FR/NFR/AC (nếu có), commit, môi trường, dữ liệu, bước chạy, expected/actual và bằng chứng. Task ngoài SRS dùng tiêu chí riêng từ sheet, không gán mã AC không tồn tại. Một task fullstack cần cả bằng chứng BE và FE; UI hoạt động không chứng minh authorization hay persistence.

| Nhóm test | Nội dung tối thiểu | Tham chiếu |
| --- | --- | --- |
| Contract/request | Response đúng/sai nested schema, API > 15 giây, Retry, request cũ về muộn, dữ liệu rỗng | AC-40; task 9/11/17/25 |
| Public DOM | 5 Published thực, chi tiết/hotspot/text/rights, locale giữ qua 2D/3D | AC-03/15/45/53; task 16/17 |
| 3D/fallback | Transform không mặc định, GLB hỏng riêng lẻ, no WebGL, context loss, Return/Exit và input cleanup | AC-23/28/44/52; task 12–15/31 |
| Audio/captions | Play/Pause/Resume/Stop/seek/volume, đóng/đổi exhibit/locale, playback bị chặn, transcript khi audio lỗi | AC-08/39/42; task 18/33 |
| Guided tour | Manual/Auto, empty/filter Published, Pause thời gian còn lại, Next về Manual, completion, Exit, timer đến muộn | AC-09–12/46/47; task 40/42 |
| CMS | Draft save/preview, Publish validation, Unpublish trước sửa, xóa có xác nhận, giữ media dùng chung, persistence | AC-18–25/30/32–37/54; task 7–10/22/34 |
| Failure/concurrency | 401/403/409/429, mất response mutation, kiểm server trước retry, không tạo duplicate, giữ form | AC-38/41; task 2/5/20/25/34 |
| Visibility/freshness | Truy API/media Draft không xác thực, cache nóng rồi publish/unpublish/xóa, public request mới nhận đúng trạng thái | AC-17/36/51; task 5/9/10/34 |
| Revision/report/RBAC | Version đang xem được giữ, conflict không xử lý nhầm revision, quyền thay đổi không bỏ qua được từ API | Tiêu chí task 3–5/7/20/22–25 sau chốt contract |
| Accessibility | Keyboard, modal focus/return, screen reader, contrast, zoom 200%, captions và reduced motion đổi trong phiên | AC-26/42/43; task 19/32 |
| Performance | Load/scene-ready/transfer budget/FPS/frametime/UI latency; CMS timing và API workload đo riêng | AC-27/44/48/49; task 29/30 |

Device matrix tối thiểu theo SRS: Chrome/Edge/Firefox desktop, Chrome Android, Safari iOS và không WebGL; tablet/responsive và xoay màn hình. Ghi model máy, OS/browser/version, mạng, ngày, asset set và mức chất lượng. XR thêm thiết bị/runtime thật khi task 15 thuộc scope đã chốt. Kế hoạch hiện có ở `plans/` là nơi tham khảo, không điền PASS khi chưa chạy.

Chọn test runner ở task kiểm thử; hiện repo **chưa cài**. Unit test tập trung schema/reducer/mapper có ràng buộc; integration tập trung request race, auth và mutation lifecycle; Playwright cho luồng public/CMS. Dùng dữ liệu test tách môi trường thật, không chạy mutation E2E vào production. Test đợi role/label/trạng thái UI hoặc response xác định, không đợi số giây giả định GLB đã tải. Test giả lập không thay kiểm thiết bị và screen reader thật.

<a id="kiem-chung-va-definition-of-done"></a>

## Kiểm chứng và Definition of Done

Với PR frontend, chạy từ `front-end/` theo AGENTS.md:

```sh
npm run typecheck
npm run lint
npm run build
```

Ba lệnh kiểm tra source/build, không chứng minh runtime, browser, accessibility, FPS hoặc coverage. Với PR tài liệu này còn kiểm link nội bộ, task 1–45 không thiếu/trùng, tên 10 trang demo, đối chiếu source/SRS và diff chỉ trong phạm vi. Không chạy backend test hoặc DB migration khi chỉ đổi tài liệu FE.

Feature hoàn thành khi tiêu chí task/scope đã thống nhất có bằng chứng, quality gates ứng dụng bị ảnh hưởng đạt, lỗi quan trọng đã xử lý hoặc được ghi rõ theo quy trình nhóm, toàn bộ diff đã review. PR tài liệu cần review các quyết định và điểm lệch phạm vi, không nhận là sản phẩm MVP đã hoàn thành.

Quy trình nhánh: bắt đầu từ `origin/dev` mới nhất, một nhánh/task, một PR base `dev`; tài liệu dùng `docs/<ten-ngan>`. Không push thẳng `dev`, không merge vào `main`. Yêu cầu hiện tại của task này là **chỉ tạo PR vào dev, không merge**. Báo cáo bàn giao gồm branch, commit, PR URL, thay đổi, kết quả kiểm chứng và điểm còn thiếu.
