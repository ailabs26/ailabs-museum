# CMS: Bản dịch đa ngôn ngữ song song & API Key đối tác + nâng cấp cổng thông tin

**Nhánh:** `feature/portal-polish-cms-i18n-apikeys` (từ `dev`).
**Phạm vi:** mở rộng CMS (i18n + API key) và làm sinh động trang cổng thông tin công khai.

## Nâng cấp cổng thông tin (public)

- **Hero 3D (react-three-fiber):** thay orb tĩnh trong showcase trang chủ bằng cảnh WebGL thật —
  khối di sản đa diện phát sáng + trường ~620 hạt tông Aura, xoay nhẹ và dịch chuyển thị sai theo con trỏ.
  - `components/home/HeroCanvas.tsx` tách chunk riêng (`React.lazy`), chỉ tải khi có WebGL.
  - `helpers/webglSupport.ts` dò khả năng WebGL (an toàn khi không có DOM).
  - Đóng băng chuyển động + `frameloop="demand"` khi `prefers-reduced-motion`; fallback 2D (orb) khi thiếu WebGL.
- **Khử tông "giấy cũ":** `ExhibitPreview` (placeholder "chưa có ảnh" trên card hiện vật) đổi nền beige
  `#efe9de` sang nền surface Aura + quầng accent emerald, lưới chấm mờ và khối hình nổi — nhất quán light/dark.

## Bản dịch đa ngôn ngữ (CMS i18n)

- Trang `/admin/translations` (`pages/admin/TranslationsPage.tsx`): nhập bản dịch **song song** giữa ngôn ngữ
  nguồn (Tiếng Việt) và ngôn ngữ đích (en/fr/ja/zh).
  - Chọn ngôn ngữ đích, lọc theo phân loại (hiện vật/phòng/giao diện/thuyết minh) và tìm kiếm.
  - Soạn cạnh nội dung nguồn theo từng chuỗi, lưu khi rời ô (`onBlur`); vòng tiến độ (%) cho từng ngôn ngữ.
  - Drawer thêm chuỗi mới, validate `namespace` dạng khóa.
- `services/translations.service.ts`: danh mục ngôn ngữ, CRUD mục dịch, hàm `localeProgress`, seed nội dung mẫu.

## API Key đối tác

- Trang `/admin/api-keys` (`pages/admin/ApiKeysPage.tsx`): quản lý danh sách khóa đối tác.
  - Bảng: khóa (che), scope, trạng thái, ngày tạo/hết hạn/dùng gần nhất; thẻ thống kê tổng/hoạt động/thu hồi.
  - Tạo khóa với scope + tùy chọn hết hạn; modal hiển thị **khóa thô đúng một lần** kèm nút sao chép và cảnh báo.
  - Thu hồi / xóa có xác nhận.
- `services/apiKeys.service.ts`: sinh khóa (`crypto.getRandomValues`), chỉ lưu tiền tố + 4 ký tự cuối, seed đối tác mẫu.

## RBAC & điều hướng

- Thêm permission `translation:read/manage`, `apikey:read/manage` vào hằng số của **cả BE và FE**; role ADMIN
  seed theo `ALL_PERMISSIONS` nên tự nhận quyền mới sau khi chạy lại `npm run seed`.
- `router` + `adminNav`: 2 mục mới, gate bằng `RequirePermission` kèm quyền dự phòng (`exhibit:read` / `user:read`)
  để admin hiện tại truy cập được ngay cả khi chưa reseed.

## Kiểm chứng

| Phần | Kết quả |
|---|---|
| Front-end `typecheck` | Sạch |
| Front-end `lint` | 0 lỗi (1 cảnh báo có sẵn ở `CollectionPage.tsx`, không thuộc phạm vi) |
| Front-end `build` | Thành công; `HeroCanvas` tách chunk, three tải theo yêu cầu |
| Back-end `typecheck` | Sạch |

## Backend thật (bổ sung — thay localStorage)

- **Module `translations`** (bảng `translations`): entity (namespace unique, category CHECK, `values` jsonb theo
  locale), repository/service/controller; endpoint `/translations` GET (`translation:read`),
  POST/PATCH/DELETE (`translation:manage`). `sanitizeValues` lọc locale hợp lệ trước khi lưu jsonb.
- **Module `partner-api-keys`** (bảng `partner_api_keys`): sinh khóa bằng `crypto.randomBytes`, lưu **SHA-256
  hash** (unique) + prefix/last4, **không lưu khóa thô**; trả `plaintext` đúng một lần khi tạo. Endpoint
  `/partner-api-keys` GET (`apikey:read`), POST/`:id/revoke`/DELETE (`apikey:manage`); mọi thao tác ghi có `@Audit`.
- **Migration** `1793300000000-AddTranslationsAndPartnerApiKeys` tạo 2 bảng + unique index; entity đăng ký trong
  `data-source.ts`, module nối vào `AppModule`.
- **Seed** idempotent thêm 4 chuỗi dịch mẫu + 2 API key đối tác mẫu khi bảng trống.
- **FE** đổi `translations.service` / `apiKeys.service` sang gọi `http.*`; xóa `services/clientStore.ts`.

## Vận hành

Để tính năng chạy trên DB đang có, chạy trong `back-end/`:

```
npm run migration:run   # tạo 2 bảng mới
npm run seed            # cấp quyền translation:* / apikey:* cho role + seed dữ liệu mẫu
```

(Quyền đọc/ghi đều chốt ở BE; admin nhận quyền mới sau khi seed vì ADMIN = ALL_PERMISSIONS.)
