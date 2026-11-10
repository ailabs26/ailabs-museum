# Hướng dẫn sử dụng CMS — Aura Museum

Tài liệu dành cho **người dùng quản trị** (Admin Portal) của Aura Museum: cách đăng
nhập, phân quyền, và thao tác trên từng màn hình để quản lý nội dung bảo tàng số.

> Đối tượng: quản trị viên, kiểm duyệt viên, biên tập viên. Không cần kiến thức lập trình.
> Thuật ngữ kỹ thuật (room, exhibit, revision, media…) giữ nguyên tiếng Anh cho nhất quán với giao diện.

**Mục lục**

1. [Tổng quan & đăng nhập](#1-tổng-quan--đăng-nhập)
2. [Vai trò và quyền (RBAC)](#2-vai-trò-và-quyền-rbac)
3. [Luồng nội dung: biên tập → kiểm duyệt → xuất bản](#3-luồng-nội-dung-biên-tập--kiểm-duyệt--xuất-bản)
4. [Hướng dẫn từng màn hình](#4-hướng-dẫn-từng-màn-hình)
5. [Cài đặt tài khoản & bảo mật](#5-cài-đặt-tài-khoản--bảo-mật)
6. [Xử lý sự cố thường gặp](#6-xử-lý-sự-cố-thường-gặp)

---

## 1. Tổng quan & đăng nhập

Admin Portal là khu vực `/admin` của ứng dụng front-end, tách biệt hoàn toàn với giao
diện Visitor công khai. Mọi thao tác đều gọi API back-end và được kiểm soát quyền ở
máy chủ (RBAC), nên giao diện chỉ là lớp tiện lợi — không thể "lách" quyền bằng cách
sửa URL.

**Đăng nhập**

1. Mở `/admin/login`.
2. Nhập email + mật khẩu (tài khoản do quản trị viên tạo; tài khoản admin đầu tiên
   sinh từ seed — xem tài liệu bàn giao).
3. Nếu tài khoản bật **2FA**, nhập thêm mã OTP 6 số từ ứng dụng Authenticator.
4. Đăng nhập thành công sẽ vào **Dashboard**.

Phiên đăng nhập dùng JWT access token (ngắn hạn) + refresh token (cookie `httpOnly`),
tự gia hạn khi còn hoạt động. Hết hạn hoặc đăng xuất ở tất cả thiết bị sẽ phải đăng nhập lại.

---

## 2. Vai trò và quyền (RBAC)

Hệ thống seed sẵn **3 vai trò**. Quyền được gán theo vai trò; một tài khoản có thể có
nhiều vai trò (quyền là hợp của các vai trò).

| Vai trò | Mã | Phạm vi chính |
| --- | --- | --- |
| **Quản trị viên** | `admin` | Toàn quyền: nội dung, kiểm duyệt, người dùng, vai trò, quyền, API key, bản dịch, nhật ký. |
| **Biên tập viên** | `editor` | Tạo/sửa room & exhibit, upload & gắn media, gửi duyệt (submit revision). Không tự xuất bản. |
| **Kiểm duyệt viên** | `moderator` | Xuất bản/từ chối/ẩn revision, xử lý báo cáo nội dung, xem nhật ký. Không sửa nội dung trực tiếp. |

**Quyền chi tiết theo vai trò (mặc định khi seed):**

- **Biên tập viên:** `room:read/create/update/delete`, `exhibit:read/create/update`,
  `revision:create/submit`, `media:upload/attach`.
- **Kiểm duyệt viên:** `room:read`, `exhibit:read`, `revision:publish/reject/hide`,
  `report:read/resolve`, `audit:read`, `permission:read`.
- **Quản trị viên:** tất cả quyền trên **cộng** `user:*`, `role:read/update/assign`,
  `permission:read`, `translation:read/manage`, `apikey:read/manage`.

> Nguyên tắc tách bạch: người **viết** nội dung (editor) khác người **duyệt** (moderator)
> để đảm bảo kiểm soát chất lượng. Quản trị viên có cả hai nhưng nên tuân thủ quy trình.

Khi thiếu quyền, màn hình tương ứng hiện thông báo **"Không có quyền truy cập"** thay vì nội dung.

---

## 3. Luồng nội dung: biên tập → kiểm duyệt → xuất bản

Nội dung hiển thị cho Visitor luôn là **bản đã xuất bản** (published revision). Mọi thay
đổi đi qua vòng đời revision:

```
Editor tạo/sửa exhibit  ──▶  Bản nháp (draft revision)
        │  gửi duyệt (submit)
        ▼
Chờ duyệt (pending)      ──▶  Moderator xem xét
        │                         ├─ Xuất bản (publish)  ─▶ Hiển thị công khai
        │                         └─ Từ chối (reject)    ─▶ Trả editor sửa lại
        ▼
Đã xuất bản (published)  ──▶  Moderator có thể Ẩn (hide) nếu phát hiện vấn đề
```

**Các bước điển hình**

1. **Biên tập viên** mở **Rooms**, tạo/chọn phòng; mở **Exhibits**, tạo/sửa hiện vật
   (tên, mô tả, vị trí, hotspot, bản dịch), **upload media** (ảnh/audio/model 3D) và
   gắn vào hiện vật.
2. Biên tập viên **xem trước** (Preview) rồi **gửi duyệt** revision.
3. **Kiểm duyệt viên** mở **Moderation**, xem từng revision đang chờ, so sánh nội dung
   và **Xuất bản** hoặc **Từ chối** (kèm lý do).
4. Nếu Visitor **báo cáo** nội dung sai, kiểm duyệt viên xử lý ở **Reports** và có thể
   **Ẩn** hiện vật cho tới khi sửa xong.

Mọi hành động nhạy cảm (publish, reject, hide, xóa, đổi quyền…) đều được ghi vào
**Audit log**.

---

## 4. Hướng dẫn từng màn hình

Thanh điều hướng bên trái hiện các mục theo quyền của bạn. Đường dẫn dưới đây tính từ `/admin`.

### 4.1. Dashboard (`/admin`)
Trang chủ sau đăng nhập: tổng quan số liệu (phòng, hiện vật, revision chờ duyệt, báo
cáo mở…) và lối tắt tới các khu vực. Mọi tài khoản đăng nhập đều xem được.

### 4.2. Rooms — Phòng trưng bày (`/admin/rooms`) · cần `room:read`
- Danh sách phòng, tạo/sửa/xóa (editor có `room:create/update/delete`).
- Mỗi phòng có tên, slug, mô tả, thứ tự; chứa nhiều hiện vật theo `displayOrder`.
- **In mã QR phòng** (`/admin/rooms/:id/qr`, cần `room:read` + `exhibit:read`): sinh QR
  trỏ tới phòng trên giao diện công khai để dán tại hiện trường.

### 4.3. Exhibits — Hiện vật (`/admin/exhibits`) · cần `exhibit:read`
- Danh sách và bộ lọc hiện vật theo phòng.
- Tạo/sửa (editor): tên, mô tả, vị trí 3D (x/y/z), placeholder (hình khối/màu khi chưa
  có model), **hotspot** (điểm chú thích), **bản dịch** 6 ngôn ngữ (vi/en/fr/zh/ko/ja).
- Gắn **media** (ảnh, audio guide, model 3D GLB) đã upload.
- **Xem trước** (`/admin/exhibits/:id/preview`): xem hiện vật như Visitor thấy trước khi
  gửi duyệt.
- Sau khi sửa, **gửi duyệt** (submit revision) để chuyển cho kiểm duyệt viên.

### 4.4. Media — Thư viện media (`/admin/media`) · cần `media:upload`
- Upload ảnh/audio/model; theo dõi **upload job** (hàng đợi xử lý bất đồng bộ).
- Quản lý **quyền/nguồn** media (source, author, license) hiển thị công khai.
- **Thùng rác**: media xóa mềm còn giữ một số ngày trước khi xóa vĩnh viễn; job dọn
  media mồ côi chạy hằng đêm (cấu hình ở back-end).

### 4.5. Moderation — Kiểm duyệt (`/admin/moderation`) · cần `revision:publish`
- Danh sách revision đang chờ duyệt.
- Với mỗi revision: xem chi tiết/so sánh, **Xuất bản** (`revision:publish`), **Từ chối**
  kèm lý do (`revision:reject`), hoặc **Ẩn** bản đã xuất bản (`revision:hide`).
- Đây là nơi quyết định nội dung nào lên công khai.

### 4.6. Reports — Báo cáo nội dung (`/admin/reports`) · cần `report:read`
- Danh sách báo cáo do Visitor gửi (nội dung sai, không phù hợp…).
- Nhận xử lý (assign), **Giải quyết** (`report:resolve`), ghi chú kết quả.
- Có giới hạn tần suất gửi báo cáo theo IP để chống spam (cấu hình back-end).

### 4.7. Translations — Bản dịch giao diện (`/admin/translations`) · cần `translation:read`
- Quản lý chuỗi dịch UI công khai theo khóa, 6 ngôn ngữ.
- Chỉnh sửa/ghi đè (cần `translation:manage`); chuỗi trống rơi về tiếng Việt.

### 4.8. API Keys — Khóa API đối tác (`/admin/api-keys`) · cần `apikey:read`
- Tạo/thu hồi **partner API key** cho đối tác gọi nhóm API `partner/v1` (cần `apikey:manage`).
- Khóa chỉ hiện **một lần** khi tạo — sao chép và lưu ngay, hệ thống không lưu bản rõ.

### 4.9. Users — Người dùng (`/admin/users`) · cần `user:read`
- Tạo/sửa/khóa tài khoản (`user:create/update/delete`), **gán vai trò** (`role:assign`).
- Không bao giờ hiển thị mật khẩu/hash; đặt lại mật khẩu theo quy trình an toàn.

### 4.10. Roles — Vai trò (`/admin/roles`) · cần `role:read`
- Xem/sửa vai trò và tập quyền của vai trò (`role:update`).
- 3 vai trò hệ thống (admin/moderator/editor) được seed; tránh thu hồi quyền của `admin`.

### 4.11. Permissions & Permission Matrix (`/admin/permissions`, `/admin/permission-matrix`)
- **Permissions** (cần `permission:read`): danh mục toàn bộ quyền `resource:action`.
- **Permission Matrix** (cần `permission:read` + `role:read`): bảng chéo vai trò × quyền
  để xem nhanh ai được làm gì.

### 4.12. Audit — Nhật ký hệ thống (`/admin/audit`) · cần `audit:read`
- Nhật ký bất biến mọi hành động nhạy cảm: ai, làm gì, trên đối tượng nào, khi nào.
- Lọc theo người dùng/hành động/thời gian; **xuất** phục vụ đối soát và nghiệm thu.

---

## 5. Cài đặt tài khoản & bảo mật

Trang **Settings** (`/admin/settings/...`) — mọi tài khoản đăng nhập đều dùng được cho
chính mình:

- **Profile** (`/admin/settings/profile`): cập nhật thông tin cá nhân.
- **Password** (`/admin/settings/password`): đổi mật khẩu (cần mật khẩu hiện tại).
- **Sessions** (`/admin/settings/sessions`): xem các phiên đang đăng nhập, **đăng xuất
  từ xa** một phiên hoặc tất cả.
- **2FA** (`/admin/settings/...`): bật/tắt xác thực hai lớp bằng TOTP; khi bật, lưu
  **recovery codes** ở nơi an toàn để khôi phục khi mất thiết bị.

**Khuyến nghị:** bật 2FA cho mọi tài khoản admin/moderator; không chia sẻ tài khoản;
đăng xuất khi dùng máy chung.

---

## 6. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
| --- | --- |
| Màn hình báo "Không có quyền truy cập" | Vai trò của bạn thiếu quyền tương ứng. Liên hệ quản trị viên để gán thêm. |
| Sửa xong nhưng Visitor chưa thấy | Thay đổi còn ở dạng revision chờ duyệt — cần kiểm duyệt viên **Xuất bản**. |
| Hiện vật biến mất khỏi công khai | Có thể bị **Ẩn** do báo cáo, hoặc phòng/hiện vật bị gỡ xuất bản. Kiểm tra Moderation/Reports. |
| Không đăng nhập được, mất thiết bị 2FA | Dùng **recovery code**; nếu hết, nhờ quản trị viên hỗ trợ khôi phục. |
| Partner không gọi được API | Kiểm tra API key còn hiệu lực (chưa bị thu hồi) và đúng header; xem Audit. |
| Bị đăng xuất liên tục | Phiên hết hạn hoặc bị đăng xuất từ xa; đăng nhập lại. Kiểm tra mục Sessions. |

**Tài liệu liên quan**

- API: [`docs/api/README.md`](../api/README.md) và Swagger UI tại `/api/docs`.
- Vận hành/triển khai: [`docs/handover/system-handover.md`](../handover/system-handover.md).
- Yêu cầu & nghiệm thu: [`docs/requirements.md`](../requirements.md),
  [`docs/handover/acceptance-report.md`](../handover/acceptance-report.md).
