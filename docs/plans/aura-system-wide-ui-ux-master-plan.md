# Kế Hoạch Tổng Thể Nâng Cấp Giao Diện & Trải Nghiệm Người Dùng Toàn Diện Hệ Thống (Aura System-Wide UI/UX Master Plan)
**Dự án:** Bảo tàng Số Trực quan — Aura Museum  
**Phạm vi:** Toàn bộ hệ sinh thái Aura Museum (Cổng thông tin Public Client, Không gian 3D WebXR, và Hệ thống Quản trị CMS Admin)  
**Ngày lập kế hoạch:** 24/10/2026  
**Nhánh triển khai đề xuất:** `feat/system-wide-ui-ux-overhaul` (tạo từ `dev`)  
**Tài liệu tham chiếu:** `docs/plans/accessibility-checklist.md`, `docs/plans/giai-doan-1-mvp-audit-and-enhancement-plan.md`

---

## 1. Tầm Nhìn & Chiến Lược Đổi Mới Toàn Diện (Systemic Vision)

### 1.1 Vấn đề cốt lõi của giao diện hiện tại
1. **Thiếu sự đồng nhất và ngôn ngữ thiết kế chung:**
   - Phía **Public Client** đang dùng màu vàng be/bùn đất xỉn cũ kỹ (`#f7f5ef`, `#d5c6aa`), font chữ Times New Roman thô cứng, các khối đồ họa vẽ bằng thẻ div thủ công khiến trang web trông giống một trang tài liệu lưu trữ cũ thay vì một nền tảng bảo tàng số công nghệ cao.
   - Phía **Admin CMS** đang mang giao diện mặc định phẳng (flat UI), các bảng dữ liệu đơn điệu, các nút bấm và form dài dòng, thiếu tính trực quan cho các thao tác chuyên sâu như duyệt phiên bản, ghim tọa độ 3D hay kiểm tra media.
2. **Thiếu chuyển động và phản hồi xúc giác số (Micro-interactions & Physics):**
   - Toàn hệ thống thiếu vắng các hiệu ứng chuyển cảnh mượt mà (transitions), không có hiệu ứng phát quang (glows), không có hiệu ứng kính mờ đa tầng (glassmorphism), và thiếu phản hồi trạng thái nhấp nháy/hover sống động.
3. **Chưa khai thác tối đa tiềm năng của 3D và WebXR:**
   - Không gian 3D còn thiếu các công cụ điều hướng trực quan phụ trợ (như Mini-map radar, Camera Cinematic intro, Dock thanh chọn hiện vật kiểu macOS, chế độ chụp ảnh Photo Mode).

### 1.2 Định vị ngôn ngữ thiết kế mới: **Aura Design System 2.0 (Aura DS 2.0)**
- **Triết lý:** *"Contemporary Luxury Digital Heritage & Immersive Spatial Experience"*  
  (Di sản số sang trọng đương đại kết hợp không gian thực tế ảo tương tác đa chiều).
- **Trụ cột 1 — Visual Hierarchy & Depth (Chiều sâu thị giác đa tầng):** Sử dụng Dark mode chủ đạo (Deep Obsidian & Midnight Slate) làm nổi bật cổ vật như ánh đèn spotlight trong bảo tàng thật, kết hợp viền sáng gradient và kính mờ `backdrop-filter: blur()`.
- **Trụ cột 2 — Fluid 60fps Motion (Chuyển động mượt mà):** Áp dụng đường cong chuyển động tự nhiên `cubic-bezier(0.16, 1, 0.3, 1)`, hiệu ứng xuất hiện tuần tự (staggered entrance) và skeleton shimmer thay thế chữ "Đang tải...".
- **Trụ cột 3 — Seamless Spatial Integration (Tích hợp không gian thông minh):** Kết nối liền mạch giữa trải nghiệm 2D (đọc câu chuyện, nghe audio) và 3D WebXR (bước vào phòng, chạm hiện vật).

---

## 2. Hệ Thống Design Tokens & Bảng Màu Toàn Cục (Universal Design Tokens)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 AURA DESIGN SYSTEM 2.0                                 │
├────────────────────────────────────────┬───────────────────────────────────────────────┤
│          PUBLIC CLIENT TOKENS          │                ADMIN CMS TOKENS               │
├────────────────────────────────────────┼───────────────────────────────────────────────┤
│ --aura-bg-deep: #0A0E17 (Obsidian)     │ --cms-bg-canvas: #0F172A (Midnight Slate)     │
│ --aura-surface-glass: rgba(30,41,59,.7)│ --cms-surface-card: #1E293B (Card Elevated)   │
│ --aura-accent-emerald: #10B981 (Teal)  │ --cms-accent-primary: #3B82F6 (Royal Blue)    │
│ --aura-accent-gold: #F59E0B (Imperial) │ --cms-status-success: #10B981 / warn: #F59E0B │
│ --aura-glow: 0 0 24px rgba(16,185,129) │ --cms-border: rgba(255, 255, 255, 0.08)       │
│ Typography: Plus Jakarta Sans / Inter  │ Typography: Inter / JetBrains Mono (Code/Diff)│
└────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### 2.1 Bảng màu đồng bộ (Universal Color Palette)
- **Deep Obsidian (`#0A0E17`) & Midnight Blue (`#0F172A`):** Tông nền vũ trụ sang trọng, khử hoàn toàn cảm giác vàng nhạt ố màu.
- **Aurora Emerald (`#10B981` / `#0D9488`):** Màu nhận diện thương hiệu chủ đạo — tượng trưng cho ngọc bích di sản và công nghệ số tươi mới.
- **Imperial Gold (`#F59E0B` / `#D97706`):** Màu nhấn vương giả — dùng cho cổ vật đặc biệt, huy hiệu bảo vật quốc gia và các hành động quan trọng.
- **Glass Surfaces:** `background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08)`.

### 2.2 Typography hiện đại
- **Loại bỏ 100%:** `Times New Roman` và `Georgia` đơn điệu.
- **Tiêu đề (Display Headings):** **Plus Jakarta Sans** hoặc **Inter Display** nét đậm 700–800, kết hợp hiệu ứng chữ kim loại/ngọc bích gradient (`linear-gradient(135deg, #FFF 20%, #94A3B8 100%)`).
- **Nội dung (Body text):** **Inter** sắc nét, line-height 1.7, cỡ chữ 15–16px, tối ưu hoàn hảo cho việc đọc trên mọi độ phân giải.
- **Số liệu & Mã (Data & Code):** **JetBrains Mono** sắc nét cho Diff so sánh phiên bản, ID hiện vật và ngày tháng hệ thống.

---

## 3. Nâng Cấp Chi Tiết Phân Hệ Cổng Thông Tin Public (Client Subsystem)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PUBLIC PORTAL ARCHITECTURE                      │
│                                                                        │
│  [ Sticky Glass Navbar ] ──► Logo Aura Glow + VR Quick Launch + Switch │
│  [ Modern Hero Section ] ──► Gradient Title + 3D Card + Dual CTAs      │
│  [ Quick Stats Counter ] ──► 5+ Rooms · 100% WebXR · Audio Bilingual   │
│  [ Bento Grid Showcase ] ──► WebXR · Soundwave Audio · Heritage · A11y │
│  [ Featured Exhibits   ] ──► 3D Jump Button + Audio Mini Wave + Hover  │
│  [ Multi-column Footer ] ──► Mission Statement + Fast Links + CMS Gate │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Khung trang chung & Header (`PublicLayout.tsx`)
- **Sticky Glass Header:** Thanh điều hướng nổi với hiệu ứng kính mờ `backdrop-filter: blur(16px)`, tự thu gọn nhẹ khi cuộn trang (scroll shrink).
- **Logo Aura Phát Sáng:** Logo bảo tàng phát hào quang xanh ngọc (Aura Glow) khi rê chuột.
- **Navigation Active Indicator:** Thanh trượt mềm mại chạy dưới tab đang hoạt động.
- **Nút CTA Nhanh:** Nút **"Vào Không Gian 3D Ngay"** viền phát sáng nằm ngay trên Header.
- **Bộ chuyển đổi Dark/Light mode:** Switch chuyển đổi giao diện tinh tế với hoạt ảnh icon Mặt trời / Mặt trăng xoay 360 độ.

### 3.2 Trang Chủ (`HomePage.tsx`)
- **Hero Banner Đỉnh Cao (Xóa bỏ hoàn toàn hình vòm `.arch` thô cũ):**
  - *Eyebrow Badge:* `● BẢO TÀNG SỐ 3D WEBXR THẾ HỆ MỚI` có viền pulse xanh ngọc.
  - *Tiêu đề:* **"Chạm vào Di sản.<br />Khám phá Không giới hạn."** (Gradient Text phát quang).
  - *Mô tả:* Truyền cảm hứng kết nối văn hóa và công nghệ tương lai.
  - *Bộ đôi nút hành động (Dual CTAs):*
    - Nút 1: **"Tham quan Không gian 3D (WebXR)"** kèm icon kính thực tế ảo, hiệu ứng hào quang lấp lánh.
    - Nút 2: **"Xem Danh mục Bộ sưu tập 2D"** với viền kính mờ sang trọng.
  - *Hero Visual 3D Showcase:* Thẻ hiện vật 3D nổi bật lơ lửng (Floating Card 3D Perspective Tilt), hiển thị mô hình hiện vật tiêu biểu sắc nét kèm nhãn thông tin và nút nghe nhanh thuyết minh.
  - *Thanh thống kê nhanh (Quick Stats Bar):* 4 chỉ số nổi bật (5+ Phòng ảo, 100% WebXR, Thuyết minh song ngữ, 0s cài đặt).
- **Bento Grid Đa Năng (Về Aura Museum):**
  - Thay thế 2 cột văn bản bằng 4 ô Bento Grid trực quan:
    1. *Ô Lớn:* Trải nghiệm không gian 3D thực tế ảo WebXR (hỗ trợ Quest, HTC Vive, Pico, WASD/Touch).
    2. *Ô 2:* Thuyết minh âm thanh thông minh với hoạt ảnh cột sóng âm (Animated Soundwave).
    3. *Ô 3:* Tái hiện di sản chi tiết cao & câu chuyện lịch sử.
    4. *Ô 4:* Chuẩn tiếp cận toàn dân (WCAG 2.2 AA, 100% điều hướng bàn phím).
- **Hiện Vật Nổi Bật (`HomeFeaturedExhibits.tsx`):**
  - Thẻ hiện vật bo góc 16px, hiệu ứng zoom ảnh mượt mà khi hover (`scale(1.04)`).
  - Huy hiệu phân loại cổ vật (Bảo vật quốc gia, Cổ vật quý).
  - Tích hợp nút **"Nghe thuyết minh ngay"** và nút **"Xem trong không gian 3D"**.

### 3.3 Trang Bộ Sưu Tập 2D (`CollectionPage.tsx`)
- **Thanh Tìm Kiếm Nhanh Thời Gian Thực (Live Search Bar):** Khách gõ tên hiện vật/từ khóa, kết quả hiển thị tức thì với highlight từ khóa.
- **Bộ Lọc Bằng Chip (Filter Pills):** Thay thế dropdown `NativeSelect` bằng hàng nút bấm dạng chip (Tất cả, Phòng Cổ vật, Phòng Điêu khắc...) chuyển đổi mượt mà.
- **Chế Độ Xem Linh Hoạt (View Mode Toggle):** Cho phép người dùng chuyển đổi giữa dạng **Lưới thẻ (Grid Cards)** và dạng **Danh sách chi tiết (Detailed List)**.
- **Shimmer Skeleton Loading:** Thay thế hoàn toàn dòng chữ "Đang tải hiện vật…" bằng các khung xương thẻ phát sáng ánh bạc lung linh.

### 3.4 Trang Chi Tiết Hiện Vật 2D (`ExhibitDetailPage.tsx`)
- **Thanh Điều Khiển Âm Thanh Nổi (Floating Sticky Audio Bar):** Khi người dùng cuộn xuống đọc bài viết, thanh Audio Player tự động ghim đáy màn hình với visualizer sóng nhạc mini, giúp trải nghiệm nghe không bị gián đoạn.
- **Interactive Hotspot Carousel:** Các điểm chú thích (hotspots) hiển thị dưới dạng thẻ trượt ngang trực quan thay vì danh sách gạch đầu dòng khô khan.
- **Nút "Bay Vào Không Gian 3D" (Jump into 3D Spot):** Nhấn một chạm để mở Scene 3D và tự động đưa góc nhìn camera đến đúng vị trí của hiện vật này trong phòng trưng bày.

### 3.5 Không Gian Tham Quan 3D & WebXR (`MuseumPage.tsx`)
- **Spatial HUD (Giao diện Không gian Hiện đại):**
  - **Mini-map / Radar 2D ở góc màn hình:** Hiển thị sơ đồ mặt bằng phòng trưng bày và chấm sáng biểu thị vị trí/hướng nhìn của người tham quan.
  - **Dock Chọn Hiện Vật (macOS-style Bottom Dock):** Dải icon hiện vật nổi dưới đáy màn hình với hiệu ứng phóng to mượt mà khi rê chuột (magnification effect), click vào sẽ lia camera thẳng đến hiện vật đó.
  - **Cinematic Camera Intro:** Khi vừa vào phòng, camera từ từ lượn từ góc toàn cảnh trên cao xuống vị trí xuất phát trong 2 giây đầu, tạo cảm giác choáng ngợp và chân thực.
  - **Hotspot 3D Phát Hào Quang (Pulsing 3D Markers):** Điểm chú ý 3D nhấp nháy ánh sáng dịu, rê chuột vào hiện thumbnail xem nhanh.
  - **Chế Độ Chụp Ảnh Kỷ Niệm (Photo Mode):** Nút chụp ảnh không gian 3D, tự động đóng các menu HUD và tạo bức ảnh kỷ niệm gắn watermark nghệ thuật Aura Museum để người dùng tải về máy.

---

## 4. Nâng Cấp Chi Tiết Phân Hệ Quản Trị Admin CMS (Admin Subsystem)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ADMIN CMS ARCHITECTURE                          │
│                                                                        │
│  [ Collapsible Studio Sidebar ] ──► Icon-only or Expanded + Badge     │
│  [ Global Command Bar (Ctrl+K)] ──► Tìm kiếm nhanh hiện vật, phòng, user│
│  [ Notification Center Bell   ] ──► Thông báo báo cáo mới & duyệt nháp │
│  [ Bento Dashboard Metrics    ] ──► Sparkline charts + Tăng trưởng %   │
│  [ Visual 3D Hotspot Editor   ] ──► Click trực tiếp lên mô hình để ghim│
│  [ Side-by-side Revision Diff ] ──► So sánh trực quan bản cũ vs bản mới│
│  [ Media Drag-and-Drop Hub    ] ──► Upload hiện đại + 3D/Audio Preview │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Khung Quản Trị Chung (`AdminLayout.tsx`)
- **Sidebar Thu Gọn Thông Minh (Collapsible Modern Sidebar):**
  - Có thể thu nhỏ thành thanh icon gọn gàng để tối đa hóa không gian làm việc với 3D và dữ liệu.
  - Phân nhóm chức năng rõ ràng: *Tổng quan · Quản lý Nội dung · Kiểm duyệt & Báo cáo · Quản trị Hệ thống*.
  - Huy hiệu số lượng đếm động (Live Badges): Hiển thị số bản ghi chờ duyệt (VD: `3`) và báo cáo vi phạm mới (VD: `5`).
- **Global Command Palette (`Ctrl + K` / `Cmd + K`):**
  - Hộp tìm kiếm thông minh mở nhanh bằng phím tắt, cho phép quản trị viên tìm nhanh bất kỳ phòng, hiện vật, tài khoản, hoặc nhảy đến chức năng mong muốn chỉ trong tích tắc.
- **Notification Center (Trung Tâm Thông Báo):**
  - Biểu tượng chuông thông báo trên Header kèm popover liệt kê các sự kiện nóng: khách vừa gửi báo cáo vi phạm, kiểm duyệt viên vừa từ chối phiên bản.

### 4.2 Bảng Điều Khiển Tổng Quan (`DashboardPage.tsx`)
- **Thẻ Thống Kê Dạng Bento (Bento Metric Cards):**
  - Thẻ số liệu có màu sắc phân loại: Xanh ngọc (Phòng), Xanh dương (Hiện vật), Vàng hổ phách (Bản nháp), Đỏ hồng (Báo cáo vi phạm).
  - Tích hợp biểu đồ xu hướng mini (Sparklines) và chỉ số phần trăm biến động so với tuần trước.
- **Biểu Đồ Tương Tác Sống Động (Interactive ApexCharts):**
  - Biểu đồ đường cong uốn lượn mượt mà (Smooth Spline Area) thể hiện lưu lượng hoạt động 14 ngày gần nhất với hiệu ứng gradient bóng bẩy.
  - Biểu đồ Donut phân bố trạng thái có hiệu ứng phóng to lát cắt khi hover.
- **Dòng Hoạt Động Trực Tiếp (Live Activity Stream):**
  - Danh sách dòng thời gian hiển thị 5 hoạt động mới nhất của các quản trị viên (ai vừa xuất bản, ai vừa xử lý báo cáo) cập nhật tự động.
- **Khối Cảnh Báo Khẩn (Urgent Action Center):**
  - Thẻ nổi bật cảnh báo các vấn đề cần ưu tiên xử lý ngay: Báo cáo vi phạm chưa gán người phụ trách, phiên bản chờ duyệt quá hạn.

### 4.3 Quản Lý Hiện Vật & Trình Biên Tập 3D (`ExhibitsPage.tsx`)
- **Chế Độ Xem Kép (Dual View):**
  - Chuyển đổi giữa chế độ **Bảng dữ liệu chi tiết (Table View)** và chế độ **Lưới thẻ trực quan (Card Grid View)** hiển thị ảnh thumbnail lớn của hiện vật.
- **Visual Drag & Drop Sắp Xếp Thứ Tự Trưng Bày (Tour Order Modal):**
  - Kéo thả thẻ hiện vật trực quan để thay đổi thứ tự tham quan trong phòng, kèm sơ đồ tọa độ 3D mô phỏng.
- **Trình Chỉnh Sửa Hotspot 3D Tương Tác (`HotspotEditor.tsx`):**
  - Cho phép quản trị viên xoay mô hình 3D trong cửa sổ xem trước và click chuột trực tiếp lên bề mặt vật thể để ghim điểm Hotspot chính xác 100%, không cần phải nhập tay các tọa độ x, y, z phức tạp.
- **Visual Revision Tree & Side-by-side Diff:**
  - Cây lịch sử phiên bản trực quan.
  - Bảng so sánh 2 phiên bản đặt cạnh nhau (Side-by-side Diff): Tô màu xanh lá cho nội dung mới bổ sung, màu đỏ cho nội dung bị xóa, giúp kiểm duyệt viên nhận biết ngay sự thay đổi.

### 4.4 Trung Tâm Quản Lý Media (`MediaPage.tsx`)
- **Vùng Kéo Thả Upload Đỉnh Cao (Modern Drag & Drop Zone):**
  - Khu vực thả file rộng rãi với hiệu ứng viền nét đứt chuyển động (animated dashed border).
  - Thanh tiến trình tải lên (Upload Progress Bar) mượt mà có chỉ số tốc độ và thời gian còn lại.
- **Trình Soi & Kiểm Tra Media Tích Hợp (In-app Media Inspector):**
  - File GLB: Cửa sổ xoay thử 3D tức thì, kiểm tra số lượng đỉnh (vertices), kích thước byte và trạng thái quét an toàn (quarantine/ready).
  - File Audio: Bộ phát âm thanh tích hợp sóng nhạc và xem trước nội dung phụ đề WebVTT đồng bộ.
  - File Hình ảnh: Trình xem ảnh phóng to chi tiết cao (Lightroom viewer).
- **Thanh Đo Dung Lượng Lưu Trữ (Storage Quota Bar):**
  - Hiển thị trực quan dung lượng đã sử dụng trên kho lưu trữ Supabase Storage theo từng loại tệp (Models, Audio, Images).

### 4.5 Kiểm Duyệt Nội Dung & Xử Lý Báo Cáo (`ModerationPage.tsx`, `ReportsPage.tsx`)
- **Giao Diện Kiểm Duyệt Toàn Màn Hình (Focus Moderation Mode):**
  - Thiết kế màn hình chia đôi (Split-view): Bên trái là phiên bản đang xuất bản công khai, bên phải là phiên bản mới chờ duyệt.
  - Phím tắt tiện lợi: `A` để Duyệt nhanh (Approve), `R` để Mở form từ chối (Reject), `Esc` để đóng.
- **Xử Lý Báo Cáo Thông Minh (Smart Reports Triage):**
  - Thẻ báo cáo hiển thị trực tiếp đoạn trích dẫn sai sót mà khách tham quan phản ánh, kèm liên kết mở nhanh đến chính xác phiên bản bị khiếu nại.
  - Các mẫu phản hồi nhanh (Canned Response Templates) giúp quản trị viên phản hồi hoặc ghi chú lý do xử lý chỉ với một click.

### 4.6 Nhật Ký Hệ Thống & Quản Trị Phân Quyền (`AuditPage.tsx`, `RolesPage.tsx`, `UsersPage.tsx`)
- **Dòng Thời Gian Ghi Vết Trực Quan (Visual Audit Timeline):**
  - Mỗi bản ghi audit là một nút mốc thời gian có icon và màu sắc tương ứng với loại hành động (Tạo mới: Xanh lá, Sửa đổi: Vàng, Xóa/Ẩn: Đỏ, Xuất bản: Tím).
  - Trích xuất lý do quản trị nổi bật trên từng thẻ.
- **Ma Trận Phân Quyền Tương Tác (Interactive Permissions Matrix):**
  - Nâng cấp các checkbox thành switch toggle hiện đại có animation mượt mà.
  - Tự động highlight hàng và cột khi rê chuột để tránh tích nhầm quyền.

---

## 5. Lộ Trình Triển Khai Toàn Diện (Phased Implementation Roadmap)

```mermaid
flowchart TD
    subgraph GIAI ĐOẠN A: NỀN TẢNG THIẾT KẾ & PUBLIC PORTAL
        A1["feat/system-wide-ui-ux (Branch)"] --> A2["Task 1: Xây dựng Hệ Tokens Aura DS 2.0 & Global CSS"]
        A2 --> A3["Task 2: Tái thiết kế PublicLayout (Glass Header, Dark/Light Switch, Footer)"]
        A3 --> A4["Task 3: Nâng cấp Toàn diện HomePage (Hero 3D Card, Stats Bar, Bento Grid)"]
        A4 --> A5["Task 4: Nâng cấp CollectionPage & ExhibitDetailPage (Search, Pills, Floating Audio)"]
    end

    subgraph GIAI ĐOẠN B: KHÔNG GIAN 3D WEBXR TƯƠNG TÁC
        A5 --> B1["Task 5: Tích hợp Spatial HUD (Mini-map radar, macOS Dock carousel)"]
        B1 --> B2["Task 6: Bổ sung Cinematic Camera intro & Chế độ chụp ảnh Photo Mode"]
    end

    subgraph GIAI ĐOẠN C: HỆ THỐNG QUẢN TRỊ ADMIN CMS STUDIO
        B2 --> C1["Task 7: Nâng cấp AdminLayout (Collapsible Sidebar, Command Palette Ctrl+K, Bell)"]
        C1 --> C2["Task 8: Nâng cấp Dashboard Bento Metrics & Live Activity Feed"]
        C2 --> C3["Task 9: Nâng cấp Exhibits, Hotspot 3D Click Editor & Side-by-side Diff"]
        C3 --> C4["Task 10: Nâng cấp Media Hub (Drag-and-drop, In-app 3D/Audio Inspector)"]
    end

    subgraph GIAI ĐOẠN D: KIỂM THỬ, TỐI ƯU & NGHIỆM THU
        C4 --> D1["Task 11: Audit WCAG 2.2 AA, Tối ưu 60fps & Responsive đa màn hình"]
        D1 --> D2["Task 12: Chạy bộ E2E CMS & Vitest, Tạo PR sáp nhập vào dev"]
    end
```

### Chi tiết các giai đoạn:
1. **Giai đoạn 1 (Tuần 1): Hoàn thiện Design System 2.0 & Cổng Thông Tin Public (Trang chủ & 2D)**
   - Khởi tạo branch `feat/system-wide-ui-ux`.
   - Cập nhật biến CSS, màu sắc sang trọng Deep Obsidian / Aurora Emerald, bỏ Times New Roman.
   - Viết lại Hero Section, Floating 3D Showcase Card, Quick Stats, Bento Grid và thẻ hiện vật nổi bật.
   - Thêm Live Search, Filter Chips dạng Pill và Shimmer Skeleton cho trang Bộ sưu tập.
2. **Giai đoạn 2 (Tuần 2): Nâng cấp Không Gian Trải Nghiệm 3D WebXR**
   - Bổ sung Radar/Mini-map 2D ở góc màn hình tour 3D.
   - Thêm Dock chọn hiện vật kiểu macOS lướt mượt mà dưới đáy màn hình.
   - Tích hợp Cinematic Camera Orbit khi mới bước vào phòng và công cụ chụp ảnh kỷ niệm Photo Mode.
3. **Giai đoạn 3 (Tuần 3): Hiện Đại Hóa Toàn Diện Hệ Thống Quản Trị CMS Admin**
   - Thiết kế lại AdminLayout: Sidebar thu gọn thông minh, Command Palette (`Ctrl+K`), Notification Bell.
   - Nâng cấp Dashboard với Bento Cards có tỷ lệ tăng trưởng %, biểu đồ gradient tương tác.
   - Trình chỉnh sửa Hotspot 3D click trực tiếp và so sánh Diff phiên bản Side-by-side.
   - Vùng kéo thả upload media hiện đại và thanh Storage Quota.
4. **Giai đoạn 4 (Tuần 4): Kiểm Thử, Tối Ưu Hiệu Năng & Bàn Giao**
   - Kiểm tra hiệu năng đạt 60fps chuyển động, Lighthouse Performance >= 90.
   - Bảo đảm 100% khả năng tiếp cận WCAG 2.2 AA (100% phím Tab/Enter/Esc).
   - Kiểm thử hồi quy toàn bộ 26 suites Vitest và 15 kịch bản E2E CMS.
   - Mở PR hợp nhất vào `dev`.

---

## 6. Tiêu Chuẩn Nghiệm Thu & Đánh Giá Đạt Chuẩn (Acceptance Criteria)

| Hạng mục | Tiêu chuẩn nghiệm thu định lượng & định tính |
|---|---|
| **Thẩm mỹ & Nhận diện** | - Giao diện toát lên vẻ sang trọng, chiều sâu không gian số, không còn màu nhạt ố vàng.<br>- 100% loại bỏ font Times New Roman trên toàn bộ các trang.<br>- Hiệu ứng kính mờ Glassmorphism và viền phát sáng gradient hoạt động tinh tế. |
| **Hiệu năng (Performance)** | - Tốc độ khung hình duy trì ổn định **60fps** trên tất cả các chuyển động và hoạt ảnh.<br>- Điểm số Google Lighthouse Performance cho Public Portal đạt **>= 90 điểm**.<br>- Thời gian phản hồi giao diện không vượt quá 100ms cho mọi thao tác click/hover. |
| **Khả năng tiếp cận (A11y)** | - Đạt **100% tiêu chuẩn WCAG 2.2 AA** theo đúng tài liệu `docs/plans/accessibility-checklist.md`.<br>- Bàn phím điều hướng được toàn bộ mọi nút bấm, modal, form và phím tắt không bị kẹt. |
| **Kiểm thử tự động** | - Toàn bộ 26/26 unit test suites Vitest frontend đạt 100% PASS.<br>- Toàn bộ 15/15 test cases E2E CMS Workflow đạt 100% PASS.<br>- TypeScript compilation không phát sinh bất kỳ lỗi cảnh báo nào (`0 errors`). |

