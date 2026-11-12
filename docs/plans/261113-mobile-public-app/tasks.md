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
