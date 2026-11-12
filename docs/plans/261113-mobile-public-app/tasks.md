# App mobile Public — Task Breakdown & Acceptance

> **PLAN:** [`plan.md`](plan.md) · **Phạm vi:** chỉ public, Expo/React Native.
>
> Mỗi task là một checkpoint; commit nhỏ, có test đi kèm mỗi hành vi. Trạng thái ban đầu
> là `TODO`; chỉ đánh PASS sau khi chạy thực tế trên thiết bị/CI.

## Nguyên tắc thực thi

- Dùng chung **một API/back-end** với web; không tạo backend riêng, không đổi schema DB.
- Code chia sẻ (types, zod, service, i18n, guided-tour logic) viết **thuần TS**, không phụ
  thuộc DOM/Mantine để dễ tách `packages/shared` về sau.
- Test trên **thiết bị thật** iOS + Android cho các luồng P1, không chỉ simulator.
- Không nới lỏng assertion để test xanh; sửa theo gốc.

## Task 00 — Khởi tạo dự án & quyết định

**Mục tiêu:** có app Expo chạy được khung trống trên iOS + Android, pipeline cơ bản.

- [ ] Khởi tạo app Expo (TypeScript) tại `mobile/` (monorepo) hoặc repo riêng — chốt vị trí.
- [ ] Cấu hình ESLint/Prettier/TypeScript theo convention FE hiện có.
- [ ] Thiết lập `app.json`/`app.config.ts`: tên, bundle id (iOS), package (Android), scheme deep link.
- [ ] Env đa môi trường (`dev`/`staging`/`prod`): base URL API + media/CDN.
- [ ] Tài khoản **EAS**; build dev client chạy được trên 2 nền tảng.
- [ ] CI khởi đầu: typecheck + lint + test rỗng (mở rộng ở Task 08).

**Acceptance:** app trống mở trên iOS + Android (thiết bị thật), đọc được env, EAS build dev OK.

## Task 01 — Nền tảng chia sẻ (API, types, i18n, storage)

**Mục tiêu:** tầng dữ liệu dùng chung sẵn sàng cho UI.

- [ ] Viết HTTP client cho RN (axios hoặc fetch wrapper) đọc base URL từ env; chuẩn hóa
      response/lỗi theo `api-response.ts`/`api-error.ts` của web.
- [ ] Port **zod schema** (`validations/*`) và types hiện vật/phòng — giữ nguyên cấu trúc.
- [ ] Port **service layer** public (`rooms`, `exhibits`, `museum`, `media`, `reports`,
      `translations`) — giữ chữ ký hàm, thay HTTP client.
- [ ] Thiết lập **TanStack Query** (query client + keys) như web.
- [ ] Port **i18n** `public-locale` (6 locale + `t()` + fallback).
- [ ] **Lớp storage trừu tượng** (`getItem/setItem/remove`) trên AsyncStorage/SecureStore —
      thay cho `localStorage` của web.
- [ ] Unit test: parse schema, build query keys, i18n fallback, storage adapter.

**Acceptance:** gọi được API thật (list phòng/hiện vật) và parse bằng zod; i18n + storage chạy.

## Task 02 — Khung điều hướng & theme

**Mục tiêu:** vỏ ứng dụng điều hướng được, đổi theme/ngôn ngữ.

- [ ] Expo Router (hoặc React Navigation): tab chính (Trang chủ, Bộ sưu tập, Tìm kiếm, Yêu thích)
      + stack chi tiết.
- [ ] Theme sáng/tối; token màu/typography nhất quán với nhận diện web.
- [ ] Bộ chọn ngôn ngữ (6 locale) lưu lựa chọn qua storage.
- [ ] Khung loading/error/empty dùng lại toàn app (tương đương `shared/components`).
- [ ] Cấu hình **deep link** cơ bản (scheme) để test ở Task 03.

**Acceptance:** điều hướng tab/stack mượt; đổi theme + ngôn ngữ áp dụng toàn app.

## Task 03 — Duyệt public (Home, Collection, Detail, Search, Deep link)

**Mục tiêu:** luồng tham quan cốt lõi hoạt động bằng dữ liệu thật.

- [ ] Trang chủ + hiện vật nổi bật.
- [ ] Danh sách phòng / bộ sưu tập (ảnh, tên, mô tả) + điều hướng vào phòng.
- [ ] Chi tiết hiện vật: ảnh/mô tả/media/phụ đề; điều khiển đọc cơ bản.
- [ ] **Tìm kiếm** hiện vật toàn hệ thống (debounce, trạng thái rỗng/không kết quả).
- [ ] **Deep link / short link** QR mở thẳng chi tiết hiện vật vào app (Universal/App Links).
- [ ] Xử lý ảnh/media qua CDN; cache ảnh; placeholder khi tải.

**Acceptance:** duyệt Home → phòng → hiện vật → search chạy trên 2 nền tảng; quét QR mở đúng hiện vật.

## Task 04 — Tiện ích khách (offline storage)

**Mục tiêu:** các tính năng cá nhân hóa lưu cục bộ trên máy.

- [ ] **Yêu thích**: thêm/bỏ, danh sách yêu thích (tab), lưu qua storage adapter.
- [ ] **Xem gần đây**: ghi lại hiện vật đã mở, danh sách, giới hạn số lượng.
- [ ] **Ghi chú khách**: tạo/sửa/xóa ghi chú theo hiện vật.
- [ ] **Điều khiển đọc**: cỡ chữ/độ tương phản khi đọc chi tiết.
- [ ] **So sánh hiện vật**: chọn 2 hiện vật, xem cạnh nhau.
- [ ] **Báo nội dung**: gửi report qua `reports.service` (modal/sheet native).
- [ ] Trạng thái lưu trữ cục bộ + xóa dữ liệu (quyền riêng tư).
- [ ] Test: thêm/xóa favorite, giới hạn recently-viewed, CRUD note, gửi report.

**Acceptance:** tiện ích khách hoạt động offline (phần cục bộ); report gửi tới API thật.

## Task 05 — Phòng 3D (r3f/native + expo-gl)

**Mục tiêu:** vào phòng 3D render trên thiết bị. Xem [`3d-on-mobile.md`](3d-on-mobile.md).

- [ ] **Spike kỹ thuật sớm**: dựng cảnh tối thiểu `@react-three/fiber/native` + `expo-gl`,
      tải 1 GLB thật bằng `expo-three` loader — chốt khả thi/hiệu năng trước khi làm tiếp.
- [ ] Tải phòng + danh sách hiện vật 3D từ API; đặt mô hình/điểm nhìn.
- [ ] Camera điều khiển cảm ứng (xoay/zoom/di chuyển) phù hợp mobile.
- [ ] **Tối ưu GLB**: nén Draco/giảm LOD; giới hạn kích thước tải; cache file.
- [ ] **Fallback**: thiết bị không đủ khả năng → chuyển sang đọc 2D (tư duy `SceneFallback`).
- [ ] Quản lý vòng đời GL context (mất context/app nền) không rò bộ nhớ.
- [ ] Test hiệu năng trên **máy yếu thật** (không chỉ máy cao cấp).

**Acceptance:** mở phòng 3D, xoay/xem hiện vật mượt ở mức chấp nhận trên máy phổ thông; có fallback.

## Task 06 — Guided Tour 2D ↔ 3D

**Mục tiêu:** hành trình có hướng dẫn đồng bộ như web (kế thừa PR #180).

- [ ] Port **reducer** guided tour + **dwell clock** + selectors (thuần TS) sang mobile.
- [ ] Guided Tour 2D: điều khiển bước, pause/resume, tiến độ, hoàn thành.
- [ ] Guided Tour 3D: camera tới hiện vật, dwell 15s, auto-next khi running + arrived.
- [ ] **Chuyển mode 2D ↔ 3D** giữ bước/currentStep/remaining, Resume do người dùng.
- [ ] Đồng bộ deep link/state điều hướng của app với phiên tour.
- [ ] Test: chuyển mode nhiều lượt, giữ dwell, không auto-resume, hoàn thành không wrap.

**Acceptance:** chuyển 2D↔3D không mất phiên/bước; dwell bảo toàn; khớp hành vi web PR #180.

## Task 07 — i18n, accessibility, hiệu năng

- [ ] Đủ nhãn 6 locale (vi/en/fr/zh/ko/ja); không thiếu key.
- [ ] Accessibility: nhãn/aria native, vùng chạm đủ lớn, hỗ trợ screen reader (VoiceOver/TalkBack).
- [ ] Giảm chuyển động (reduce motion) tôn trọng cài đặt hệ thống.
- [ ] Tối ưu tải: ảnh/GLB theo mạng; skeleton; tránh re-render thừa.
- [ ] Kiểm thử nhiều kích thước màn hình + xoay ngang/dọc.

**Acceptance:** app dùng được bằng screen reader cơ bản; 6 locale đủ; mượt trên máy phổ thông.

## Task 08 — Kiểm thử & CI

- [ ] Unit test logic chia sẻ (zod, service, dwell clock, storage adapter).
- [ ] E2E luồng P1 bằng **Maestro** (hoặc Detox): duyệt, search, deep link, guided tour.
- [ ] Pipeline **EAS Build** cho iOS + Android (internal distribution).
- [ ] Kiểm thử trên tập thiết bị thật tối thiểu (1 iOS, 1 Android phổ thông).
- [ ] Tài liệu kết quả: lệnh, thiết bị/OS, pass/fail, giới hạn.

**Acceptance:** CI build 2 nền tảng xanh; E2E P1 pass; có bằng chứng thiết bị thật.

## Task 09 — Phát hành

- [ ] Store assets: icon, splash, screenshots, mô tả 6 ngôn ngữ.
- [ ] Chính sách quyền riêng tư + khai báo dữ liệu (Apple Privacy / Google Data Safety).
- [ ] Tài khoản **Apple Developer** + **Google Play Console**; chứng chỉ ký.
- [ ] **EAS Submit** nộp TestFlight / Play Internal → closed test → production.
- [ ] Cơ chế **OTA update** (EAS Update) để vá nhanh phần JS.
- [ ] Checklist go-live: version, release notes, rollback/OTA.

**Acceptance:** app lên được kênh thử nghiệm (TestFlight/Play Internal) và sẵn sàng nộp production.

## Câu hỏi còn mở

1. Mã nguồn mobile đặt trong **monorepo** (`mobile/`) hay **repo riêng**?
2. Có cần đăng nhập cho khách (lưu favorites/notes theo tài khoản, đồng bộ đa thiết bị) hay chỉ cục bộ?
3. Tài khoản **Apple Developer / Google Play** đã có chưa (ai sở hữu, chi phí/năm)?
4. Mức thiết bị tối thiểu hỗ trợ (iOS/Android version, máy yếu nhất cần chạy 3D)?
5. Có cần **push notification** cho sự kiện/triển lãm ở bản đầu không?
