# Dữ liệu, API và CMS

Đây là thiết kế mục tiêu theo [nguồn và phạm vi](README.md), không phải đặc tả endpoint đã triển khai. FE/CMS không truy cập trực tiếp PostgreSQL, Supabase hay Storage. Mọi migration thuộc người phụ trách DB; tài liệu FE không cấp phép tạo/chạy migration.

## Contract hiện có và khoảng trống

Source BE hiện trả danh sách Room và Room kèm `exhibits`; mỗi Exhibit có `name`, `description`, `positionX/Y/Z`, `displayOrder`, `transcript`, placeholder và quan hệ `model`, `image`, `audio`. [Repository](../../../back-end/src/exhibits/repositories/exhibits.repository.ts) mới lọc `roomId`, chưa lọc publication. Chưa có DTO response public tách hoàn toàn entity. Không dùng trạng thái hiện tại làm API production có Draft.

| Nhóm | Hiện có trong source | Hợp đồng cần thống nhất trước tích hợp |
| --- | --- | --- |
| Nội dung public | `GET /rooms`, `GET /rooms/:slug` | DTO Published, shape ID, nullability, detail lookup, hotspot, vi/en, transform đầy đủ, tour order, captions/rights |
| Media | Tuyến media tĩnh minh họa | URL phân phối, loại, dung lượng, metadata, quyền đọc Draft, upload/processing/rejection |
| Auth | Chưa có | Task 2 yêu cầu login/logout/JWT; cần chốt transport, kiểm tra phiên, expiry/refresh và error response |
| CMS core | Chưa có | Đọc/ghi Draft, media/hotspot, preview, publish/unpublish, tour config, lỗi field và concurrency token |
| CMS mở rộng theo task | Chưa có | Room CRUD, revision/moderation, user/role/permission, report/audit, pagination/filter |
| Giai đoạn 3 | Chưa có | API key/scope, bulk import/export, bản dịch thêm và lỗi từng bản ghi |

Ngoài hai route public hiện có, không coi route UI hay tên module trong tài liệu là endpoint BE đã chốt. Bàn giao bằng OpenAPI và response mẫu hợp lệ/lỗi trước khi viết schema FE. Enum trạng thái, transition hợp lệ, pagination và revision token do BE sở hữu; không suy từ text badge trong demo.

## Luồng đọc và validation

```text
Page (route params)
  → useRoom / hook feature (loading, cancel, retry)
  → museumApi / module API tương ứng
  → fetch → kiểm tra HTTP → JSON unknown → Zod parse
  → map view model nếu cần → hook state → DOM và scene
```

- `apis/` sở hữu parse response, kể cả mutation response; `validations/` sở hữu schema. Dùng `z.infer` cho type schema để không duy trì hai bản contract.
- `helpers/` chỉ chuyển DTO sang view model khi có khác biệt thực; không làm dữ liệu sai thành hợp lệ bằng default tùy tiện.
- Validate nested arrays/media, ID, số hữu hạn, scale dương và quan hệ hotspot theo contract. Không ép JSON bằng `as Exhibit[]` rồi render. Với contract Published mà thiếu nội dung bắt buộc, báo lỗi dữ liệu; không tự tạo bản dịch hoặc hiện vật giả.
- GLB lỗi là lỗi asset sau khi metadata hợp lệ, xử lý placeholder cục bộ; API sai schema là lỗi nội dung và không đưa response đó vào scene.
- `useRoom` hủy request cũ khi đổi phòng/unmount bằng `AbortController`; bỏ kết quả đến muộn theo request identity. React StrictMode chạy setup/cleanup lặp không được gây request/state rò rỉ hoặc mutation hai lần. Mutation chỉ phát từ hành động người dùng, không đặt trong effect mount.
- Timeout đọc nội dung là **15 giây** theo FR-92. Abort do navigation không hiện toast lỗi. Upload có timeout/cancel theo contract riêng, không mặc nhiên dùng ngưỡng tải metadata.
- Trạng thái tải gồm `idle/loading/success/empty/error`; Retry là hành động rõ ràng. Empty chỉ dùng khi response hợp lệ rỗng, không thay cho lỗi API.
- Public metadata không có cache bền trong localStorage/service worker ở thiết kế ban đầu. Một phiên được giữ snapshot hợp lệ; khi tải lại phải lấy trạng thái mới. BE/CDN đảm bảo BR-22, không dựa riêng vào TTL 60 giây.

## Quyền sở hữu state

| State | Nơi giữ | Lifecycle |
| --- | --- | --- |
| Response phòng/hiện vật hợp lệ | Hook/provider phiên museum | Request mới thay snapshot sau validation; không trộn Draft |
| ID hiện vật, ngôn ngữ, view mode, bước tour | Context/reducer museum | Dùng chung DOM/scene, giữ khi chuyển 3D → 2D |
| Form chưa lưu, lỗi field, file chọn | State editor/upload trong Admin | Giữ khi request lỗi; xóa khi logout chủ động |
| Thông tin phiên/capability | Auth provider của Admin | Xác minh từ BE; không tin role tự lưu |
| Draft Preview | State riêng của page Preview | Load authenticated, clear khi đóng/logout; không chèn cache public |
| Camera, mesh, audio element, request controller | Ref/effect thuộc hook/component chủ quản | Không đưa vào reducer JSON, cleanup khi hết owner |

Không đưa mọi form hoặc tọa độ mỗi frame vào global context. API modules không tự tạo React state. Dữ liệu server thành công và dữ liệu form đang sửa phải tách để lỗi Save không xóa nội dung người dùng.

## Lỗi và thao tác ghi

| Kết quả | Hành vi FE |
| --- | --- |
| Network, timeout, 5xx, sai schema | Dừng loading, thông báo dễ hiểu, Retry phù hợp; không log raw response/credential |
| 400/422 theo contract | Gắn lỗi vào field, summary có thể focus; giữ input |
| 401 | Khóa thao tác CMS, yêu cầu đăng nhập lại; không lặp refresh vô hạn |
| 403 | Thông báo không có quyền, cập nhật capability nếu cần; không gửi lại liên tục |
| 404 | Thông báo dữ liệu không còn khả dụng và link về danh sách |
| 409 | Giữ bản đang nhập, thông báo server đã đổi, cho tải bản mới/đối chiếu; không âm thầm ghi đè |
| 429 | Hiển thị thời gian thử lại từ `Retry-After` nếu có; không coi debounce client là rate limit bảo mật |
| Mất phản hồi sau Save/Upload/Publish | Trạng thái **chưa xác định**; tra cứu kết quả server trước thử lại, không báo thành công/thất bại chắc chắn |

Chỉ hiện thành công sau xác nhận BE. Disable submit khi đang gửi để giảm nhấn đúp, nhưng BE vẫn cần kiểm soát đồng thời/idempotency. Contract mutation phải cung cấp version/ETag hoặc cơ chế tương đương cho task 25, và operation ID/idempotency key hoặc lookup tương đương cho FR-93. Không tự retry POST hoặc tạo key giả mà backend không hỗ trợ. GET retry do người dùng khởi phát là đủ cho bản đầu.

## Media pipeline

Luồng task 8–10: **chọn file → kiểm tra nhanh FE → upload NestJS → BE kiểm tra/xử lý/quarantine → trả metadata hợp lệ → chọn media ID → Save Draft → Preview → Publish**. Nếu xử lý bất đồng bộ, contract phải có trạng thái và cách kiểm tra kết quả; FE không gắn file còn quarantine/rejected vào nội dung public.

| Loại | Giới hạn baseline SRS 5.2, 1 MB = 1.000.000 byte |
| --- | --- |
| Model | GLB `model/gltf-binary`, ≤ 10 MB, tài nguyên nhúng, parse được |
| Ảnh | JPEG/PNG/WebP, ≤ 2 MB, decode được; alt vi/en khi ảnh có nội dung |
| Audio | MP3 `audio/mpeg`, ≤ 10 MB mỗi ngôn ngữ |
| Transcript | ≤ 20.000 ký tự mỗi ngôn ngữ; bắt buộc khi Publish audio |
| Captions | WebVTT UTF-8 ≤ 1 MB, cue hợp lệ trong thời lượng audio, cùng ngôn ngữ |

Giới hạn demo không áp dụng cho production. FE kiểm MIME/size để phản hồi sớm; BE phải kiểm nội dung thật, quyền và kích thước. Chỉ dùng URL HTTPS từ tuyến media BE quản lý (HTTP cho local); helper resolve relative URL theo base đã chốt, kiểm protocol/origin theo deployment contract. Không nhận `javascript:`/URL Storage tùy ý từ form. Object URL chỉ phục vụ preview file local có owner và `revokeObjectURL` khi thay/đóng.

Form metadata có nguồn, tác giả/chủ sở hữu, giấy phép/căn cứ quyền sử dụng. Save Draft có thể thiếu phần bắt buộc Publish; Publish phải kiểm toàn bộ quan hệ ở BE. Không ghi đè/xóa file đang dùng bởi Published. Tháo media khỏi Draft không xóa file dùng chung. File upload thất bại không thay media cũ. UI hiển thị tiến trình thật nếu có API hỗ trợ, nếu không chỉ hiện trạng thái đang tải, không giả phần trăm.

## Auth, quyền và dữ liệu nhạy cảm

Task 2 đề cập JWT nhưng chưa có contract. Đề xuất để BE review: refresh/session cookie `HttpOnly`, `Secure`, `SameSite` phù hợp; nếu cần access JWT thì chỉ giữ trong memory. Không lưu token/password trong localStorage/sessionStorage hoặc biến `VITE_*`. Cookie auth cần chốt CSRF và CORS/credentials theo topology FE/BE trước triển khai; JWT không tự giải quyết các vấn đề đó.

Baseline phiên: **30 phút không hoạt động, tối đa 8 giờ**, logout làm phiên BE mất hiệu lực (NFR-17). FE có thể hiển thị hết phiên nhưng BE quyết định. Khi tự hết hạn, form chỉ giữ trong memory tab, ẩn đến khi xác thực lại; logout chủ động xóa Draft/Preview/cache và audio/scene quản trị. Không lưu form nhạy cảm bền trong browser.

Nếu triển khai refresh rotation, task 2/4 phải chốt cách xử lý nhiều tab và reuse detection ở BE; FE phối hợp một refresh đang chạy trong phạm vi cần thiết, không phát tán secret qua storage hoặc tự đăng xuất các tab vì response cũ. Không triển khai cơ chế này từ demo.

RBAC task 3–5 nhận capability/action/scope từ BE; UI ẩn/disable và giải thích quyền thiếu. Request trực tiếp vẫn phải bị BE chặn. Ma trận quyền không tự mở quyền sửa chính nó. API key task 36/44: chỉ hiện secret tại thời điểm server cho phép, không log/cache hoặc đưa vào URL; scope, thu hồi và quyền tạo key do BE xác nhận.

## Publication và Preview

**Baseline SRS:**

```text
Create → Draft → Publish → Published
           ↑                 |
           +--- Unpublish ---+
Draft: Edit / Save / Preview / Delete (có xác nhận)
Published: View / Unpublish
```

Preview đọc **Draft đã lưu** qua API xác thực, dùng chính `MuseumScene`/renderer nội dung public bằng props; không có fetch public tự động trong renderer. Đánh dấu Preview, tách cache/session, không công khai media riêng của Draft. Unpublish trước Edit/Delete; không tự duy trì bản Published song song. Save Draft không làm public; Publish/Unpublish thành công mới cập nhật state từ response và invalidate dữ liệu quản trị liên quan.

**Workflow mở rộng task 7/22:** cần contract revision bất biến, revision hiện hành, snapshot published, version token và các transition submit/approve/reject/publish/hide. Đây là nhu cầu thiết kế, chưa phải enum API. UI history/diff hiển thị version và tác giả/thời gian từ server; hành động gửi đúng revision/version mong đợi. Reject/hide yêu cầu lý do theo task. Có thay đổi đồng thời thì 409 và tải lại/đối chiếu, không publish nhầm revision vừa bị thay.

Không chạy cả hai workflow như thể tương đương. Nhóm phải cập nhật SRS/schema trước khi workflow revision thay baseline. Audit task 24 là dữ liệu append-only do BE ghi, FE chỉ đọc/lọc; không tự tạo log để chứng minh mutation thành công.

## Report và mở rộng

Task 20 là ngoại lệ ghi công khai chuyên biệt: khi được triển khai, report dùng exhibit ID và revision/version của **snapshot người dùng đang xem**, không tự đổi sang bản mới nhất. FE cần contract ID phiên bản từ BE trước khi bật gửi. Validate lý do/nội dung, trạng thái pending/success/error/429; không bắt cung cấp dữ liệu cá nhân nếu task không yêu cầu. Rate limit thực thi ở BE. Public content endpoints vẫn read-only.

Task 23 hiển thị phiên bản bị báo cáo cùng bản hiện tại để xử lý; không mất tham chiếu snapshot khi hiện vật đổi. Task 38 import/export hiển thị lỗi theo dòng, kết quả thành công/thất bại từ BE; không giả định cả lô thành công. Task 39/43/44 giữ nội dung, audio, transcript/captions theo locale; thiếu nội dung tùy chọn thì fallback vi có nhãn, không tự phát audio ngôn ngữ khác. Retention analytics task 37 do BE sở hữu, không tự thêm thu thập sự kiện FE.

## Cấu hình và bàn giao FE–BE

`VITE_API_BASE_URL` là cấu hình public lúc build, chỉ chứa API origin/base path. Hiện Vite chưa proxy API; triển khai phải chốt dùng reverse proxy cùng origin hay base URL khác origin có CORS. Không mặc nhiên dùng cổng Vite làm API. Production FE/API/media dùng HTTPS.

Checklist bàn giao contract: OpenAPI/version, response mẫu success/error, ID/nullability/enum, paging/filter, quyền và phiên, field errors, version/idempotency, publication freshness, media routes/protection, trace/request ID an toàn để chẩn đoán. Public DTO không lộ entity nội bộ, credential, Draft hoặc audit dữ liệu quản trị. Những mục chưa chốt là phụ thuộc triển khai, không được lấp bằng kiểu `any` hay dữ liệu demo trong production.
