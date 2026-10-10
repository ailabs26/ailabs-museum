# Aura Museum — WebXR Interactive Museum Software Requirements Specification

**Document:** `requirements.md`  
**Project:** Aura Museum — WebXR Interactive Museum  
**Vietnamese name:** Bảo tàng WebXR có hướng dẫn tương tác  
**Version:** v0.2  
**Status:** Requirements Baseline
**Date:** 2026-10-10  
**Repository path:** `/docs/requirements.md`  

---

## 1. Introduction

### 1.1 Purpose

Tài liệu Software Requirements Specification (SRS) này mô tả các yêu cầu của hệ thống **Aura Museum — WebXR Interactive Museum**.

Các nội dung dưới đây là yêu cầu của sản phẩm mục tiêu, không phải báo cáo tính năng đã triển khai hoặc kết quả kiểm thử. Bản v0.2 là Revised Draft dùng để review thay đổi scope trước khi chốt baseline mới; các ngưỡng kỹ thuật vẫn phải được kiểm chứng bằng Test/Performance Plan.

Hệ thống cung cấp một môi trường bảo tàng số trên nền web, cho phép Visitor:

- tham quan không gian bảo tàng 3D;
- khám phá hiện vật;
- xem thông tin chi tiết;
- tương tác với hotspot;
- nghe audio guide;
- tham gia guided tour;
- sử dụng giao diện 2D fallback khi trải nghiệm 3D không khả dụng;
- sẵn sàng mở rộng WebXR trong tương lai mà không xem immersive VR/headset là điều kiện nghiệm thu của MVP hiện tại.

Hệ thống đồng thời cung cấp **Admin Portal** gồm Content Management, Content Governance và System Administration. Người dùng quản trị được phân quyền theo vai trò để quản lý nội dung, kiểm duyệt/xuất bản, tài khoản, vai trò, quyền và nhật ký hệ thống.

Tài liệu này là cơ sở cho:

- thiết kế kiến trúc hệ thống;
- lập kế hoạch phát triển;
- thiết kế chi tiết;
- xây dựng test case;
- nghiệm thu sản phẩm;
- quản lý thay đổi yêu cầu.

---

### 1.2 Product Name

**Aura Museum — WebXR Interactive Museum**

Tên tiếng Việt:

**Hệ thống Bảo tàng WebXR có hướng dẫn tương tác**

---

### 1.3 Intended Audience

Tài liệu này dành cho:

- Project Supervisor / Product Owner;
- Business Analyst;
- Software Architect;
- Software Developer;
- UI/UX Designer;
- Tester;
- Content Administrator;
- các thành viên trong nhóm phát triển.

---

### 1.4 Product Scope

WebXR Interactive Museum là một hệ thống triển lãm số cho phép Visitor truy cập bảo tàng thông qua trình duyệt.

Hệ thống gồm hai khu vực lớn: **Public Museum** và **Admin Portal**.

#### Public Museum

Dành cho Visitor, bao gồm:

- trải nghiệm bảo tàng 3D;
- xem hiện vật;
- hotspot;
- audio guide;
- guided tour;
- giao diện 2D fallback;
- WebXR capability detection/extension point cho giai đoạn sau MVP.

#### Admin Portal — Content Management

Dành cho người dùng quản trị có permission phù hợp, bao gồm:

- quản lý metadata phòng trưng bày;
- quản lý hiện vật và revision nội dung;
- quản lý nội dung song ngữ;
- quản lý model 3D, image, audio và captions;
- quản lý hotspot;
- cấu hình transform;
- Draft/Preview;
- gửi revision để duyệt;
- Publish/Reject/Hide theo quyền;
- cấu hình thứ tự guided tour.

#### Admin Portal — System Administration

Dành chủ yếu cho vai trò `admin`, bao gồm:

- quản lý tài khoản quản trị;
- kích hoạt/vô hiệu hóa tài khoản;
- quản lý role;
- quản lý permission và permission matrix;
- xem audit log;
- xem dashboard/trạng thái quản trị.

#### Content Governance

MVP sử dụng workflow biên tập tối thiểu:

```text
Editor → tạo/sửa Draft Revision → Submit Review
Moderator/Admin → Review → Publish hoặc Reject
```

Một revision đang được biên tập hoặc review không được tự động thay thế revision đang công khai. Public Museum chỉ đọc revision đã được publish hiện hành.

### 1.5 Product Objectives

**OBJ-01 — Remote museum access**  
Cho phép người dùng tham quan triển lãm từ xa mà không cần đến trực tiếp bảo tàng.

**OBJ-02 — Interactive experience**  
Tạo trải nghiệm trực quan hơn so với website bảo tàng chỉ sử dụng văn bản và hình ảnh.

**OBJ-03 — Rich exhibit exploration**  
Cho phép người dùng khám phá hiện vật thông qua model 3D, hotspot và audio guide.

**OBJ-04 — Multi-device experience**  
Cung cấp trải nghiệm phù hợp trên desktop và mobile; kiến trúc không được cản trở việc bổ sung WebXR/VR trong giai đoạn sau.

**OBJ-05 — Progressive access**  
Đảm bảo nội dung chính vẫn có thể tiếp cận khi thiết bị không hỗ trợ hoặc không thể sử dụng trải nghiệm 3D.

**OBJ-06 — CMS-driven content**  
Cho phép Admin cập nhật nội dung triển lãm thông qua CMS mà không cần can thiệp trực tiếp vào source code frontend.

---

### 1.6 Definitions and Acronyms

| Term | Definition |
|---|---|
| WebXR | Web API hỗ trợ trải nghiệm XR trên trình duyệt; trong MVP hiện tại chỉ là extension point/capability detection, không phải hạng mục nghiệm thu bằng headset |
| VR | Virtual Reality |
| XR | Extended Reality |
| CMS | Content Management System |
| Admin Portal | Khu vực web dành cho người dùng quản trị đã xác thực |
| Visitor | Người sử dụng khu vực tham quan công khai |
| Administrative User | Tài khoản nội bộ dùng Admin Portal và chịu kiểm soát RBAC |
| Editor | Vai trò mặc định tạo/sửa nội dung, media và revision, sau đó gửi duyệt |
| Moderator | Vai trò mặc định duyệt/reject/publish revision, xử lý report và có quyền đọc audit theo cấu hình |
| Admin | Vai trò quản trị hệ thống mặc định; quản lý user/role/permission và có quyền quản trị nội dung theo permission matrix |
| RBAC | Role-Based Access Control — phân quyền dựa trên role và permission |
| Role | Tập hợp các permission có thể gán cho user |
| Permission | Quyền thao tác ở mức nghiệp vụ, biểu diễn logic theo resource/action trong thiết kế triển khai |
| Exhibit | Hiện vật trong bảo tàng |
| Revision | Một phiên bản nội dung của Exhibit phục vụ biên tập/kiểm duyệt/lịch sử |
| Draft Revision | Revision đang được biên tập, chưa công khai |
| In Review | Revision đã gửi kiểm duyệt, chờ Moderator/Admin quyết định |
| Published Revision | Revision hiện hành được Public Museum sử dụng |
| Rejected Revision | Revision bị từ chối và cần chỉnh sửa lại trước khi submit tiếp |
| Hotspot | Điểm tương tác gắn với một vị trí trên hiện vật 3D |
| Guided Tour | Chế độ hướng dẫn theo thứ tự định trước, có lựa chọn tự động hoặc điều khiển từng bước |
| Preview | Thao tác cho người có quyền xem trước revision chưa publish; không tự làm nội dung công khai |
| Audit Log | Nhật ký append-only ghi vết hành động quản trị quan trọng |
| Content Report | Báo cáo do Visitor gửi về nội dung cần xem xét |
| Transcript | Văn bản đầy đủ tương đương với nội dung audio |
| Captions | Phụ đề đồng bộ theo thời gian của audio, theo ngôn ngữ đang phát |
| Transform | Position, Rotation và Scale của object 3D |
| Fallback | Trải nghiệm thay thế khi capability chính không khả dụng |
| WCAG | Web Content Accessibility Guidelines |
| MVP | Minimum Viable Product |
| FPS | Frames Per Second |

## 2. Overall Description

### 2.1 Product Perspective

WebXR Interactive Museum là một ứng dụng web client-server.

```text
Visitor
   |
   v
Public Web Application
   |
   +-- 2D UI
   +-- 3D Museum
   +-- WebXR Capability Detection
   |
   v
NestJS API / Backend-managed Media
   |
   +-- Published Content
   +-- Tour Data
   +-- Media Metadata
   |
   v
PostgreSQL / Object Storage


Editor / Moderator / Admin
   |
   v
Admin Portal
   |
   +-- Content Management
   +-- Moderation
   +-- System Administration
   |
   v
Authentication + RBAC + Audit
   |
   v
NestJS API
```

Public Museum và Admin Portal sử dụng chung domain data nhưng khác trust boundary: public chỉ được đọc nội dung Published; mọi thao tác quản trị phải qua authentication và authorization ở backend.

### 2.2 Product Functions

#### Visitor Functions

- truy cập bảo tàng không cần đăng nhập;
- tham quan không gian 3D;
- khám phá hiện vật;
- xem nội dung song ngữ;
- tương tác hotspot;
- nghe audio guide;
- tham gia guided tour;
- sử dụng teleport;
- sử dụng 2D fallback;
- gửi content report;
- phát hiện capability WebXR để hỗ trợ mở rộng sau MVP.

#### Content Management Functions

Người có permission phù hợp có thể:

- quản lý metadata phòng;
- tạo/sửa hiện vật và revision;
- quản lý model 3D, image, audio, captions;
- quản lý nội dung tiếng Việt và tiếng Anh;
- quản lý hotspot;
- cấu hình Position / Rotation / Scale;
- Save Draft;
- Preview Draft;
- submit revision để review;
- cấu hình thứ tự guided tour.

#### Moderation Functions

Moderator/Admin có permission phù hợp có thể:

- xem queue revision chờ duyệt;
- xem revision cần review;
- Publish hoặc Reject revision;
- hide/unhide nội dung công khai khi được phép;
- xem/xử lý content report;
- xem audit log theo permission.

#### System Administration Functions

Admin có permission phù hợp có thể:

- tạo/xem/cập nhật/vô hiệu hóa tài khoản quản trị;
- gán/bỏ role;
- quản lý role;
- xem danh mục permission;
- cập nhật permission matrix;
- xem audit log;
- truy cập dashboard quản trị.

### 2.3 User Classes

#### Visitor

- không yêu cầu tài khoản;
- có thể không có kiến thức kỹ thuật;
- sử dụng desktop hoặc mobile trong phạm vi MVP;
- có thể có nhu cầu accessibility;
- có thể lựa chọn tiếng Việt hoặc tiếng Anh.

#### Editor

- có tài khoản xác thực;
- quản lý nội dung, media và revision theo permission;
- có thể submit revision để Moderator/Admin review;
- không mặc định có quyền quản lý user/role/permission hoặc tự publish.

#### Moderator

- có tài khoản xác thực;
- review/publish/reject revision theo permission;
- xử lý content report;
- có thể đọc audit theo permission;
- không mặc định có quyền quản lý cấu hình RBAC.

#### Admin

- có tài khoản xác thực;
- quản lý user/role/permission;
- có thể có toàn bộ permission nội dung/moderation;
- chịu trách nhiệm bootstrap/quản trị phân hệ hệ thống;
- không có public self-registration.

### 2.4 Operating Environment

#### Client

- desktop browser;
- mobile browser;
- browser hiện đại trên desktop/mobile;
- WebXR-capable environment chỉ phục vụ kiểm tra extension point khi có điều kiện, không bắt buộc headset trong MVP.

#### Server

- web application hosting;
- backend/CMS server;
- database;
- object/media storage.

---

### 2.5 High-level MVP Scope

MVP bao gồm:

- một không gian 3D chính được xây dựng trước; không có editor sửa mesh/geometry phòng;
- dữ liệu metadata phòng có thể được quản lý qua CMS;
- tối thiểu 5 hiện vật;
- Visitor không cần tài khoản;
- Admin Portal có RBAC với ba role mặc định `admin`, `moderator`, `editor`;
- quản lý user, role, permission và permission matrix;
- audit log cho hành động quản trị quan trọng;
- revision + moderation workflow cho nội dung;
- content report và xử lý report;
- desktop/mobile: tham quan 3D;
- WebXR/VR không phải điều kiện nghiệm thu của MVP; chỉ giữ capability detection/extension point;
- hotspot, thông tin và audio;
- tiếng Việt và tiếng Anh;
- một guided tour tuyến tính, có chế độ Auto/Manual;
- chỉ dẫn đường và teleport;
- CMS quản lý nội dung, media, hotspot, transform, tour và room metadata;
- Preview revision chưa publish;
- Public Museum chỉ dùng revision đã được publish;
- fallback 3D → 2D;
- accessibility trên giao diện web MVP đáp ứng WCAG 2.1 A/AA theo phạm vi đã xác định, hỗ trợ transcript, captions và reduced motion.

Bộ nội dung nghiệm thu gồm ít nhất 5 hiện vật Published, mỗi hiện vật có model 3D thật, hình ảnh đại diện, ít nhất một hotspot, nội dung tiếng Việt/Anh và audio kèm transcript/phụ đề cho cả hai ngôn ngữ. Dữ liệu placeholder hiện có không thay thế bộ nội dung nghiệm thu.

## 3. External Interface Requirements

### 3.1 User Interface Requirements

#### 3.1.1 Public Landing Interface

Trang public phải cung cấp tối thiểu:

- tên hoặc nhận diện bảo tàng;
- nút bắt đầu tham quan;
- tùy chọn ngôn ngữ;
- tùy chọn accessible/2D khi phù hợp.

#### 3.1.2 3D Museum Interface

Giao diện 3D phải cung cấp:

- viewport 3D;
- navigation controls;
- exhibit interaction controls;
- guided tour controls;
- language selector;
- audio controls;
- tùy chọn thoát khỏi 3D.

#### 3.1.3 Exhibit Information Interface

Khi chọn hiện vật, giao diện phải có khả năng hiển thị:

- tên;
- mô tả;
- hình ảnh;
- audio control;
- transcript và phụ đề đồng bộ khi có audio;
- hotspot information;
- nội dung theo ngôn ngữ được chọn.

#### 3.1.4 Guided Tour Interface

Trong guided tour phải hiển thị tối thiểu:

- hiện vật hiện tại;
- tiến trình tour;
- Next;
- Previous;
- Exit Tour;
- lựa chọn Auto / Manual và Pause / Resume cho Auto;
- chỉ dẫn hướng;
- tùy chọn teleport.

#### 3.1.5 WebXR Extension Interface — Outside MVP

Immersive VR/headset interaction không phải điều kiện nghiệm thu của MVP hiện tại.

Nếu WebXR được triển khai trong giai đoạn sau, interaction XR phải sử dụng cơ chế input phù hợp với thiết bị và không được phụ thuộc vào chuột truyền thống cho các chức năng cốt lõi.

#### 3.1.6 2D Fallback Interface

Giao diện 2D phải cung cấp:

- danh sách hiện vật Published;
- trang hoặc panel chi tiết hiện vật;
- hình ảnh;
- mô tả;
- hotspot content ở dạng phi 3D;
- audio;
- transcript;
- language switcher.

Transcript phải đọc được ngay cả khi audio không phát; khi phát audio, Visitor có thể bật/tắt phụ đề đồng bộ.

#### 3.1.7 Admin Portal Interface

Admin Portal phải cung cấp tối thiểu các màn hình/chức năng tương ứng với permission của người dùng:

- login;
- dashboard;
- room metadata management;
- exhibit/revision management;
- media management;
- hotspot management;
- transform configuration;
- Draft Preview;
- moderation queue;
- Publish/Reject/Hide theo quyền;
- guided-tour configuration;
- user/account management;
- role management;
- permission list/matrix;
- content reports;
- audit log.

Ẩn/disable control theo permission chỉ hỗ trợ UX; backend vẫn phải là lớp enforcement thực sự.

### 3.2 Hardware Interfaces

#### Desktop

Input có thể bao gồm:

- keyboard;
- mouse;
- trackpad.

#### Mobile

Input có thể bao gồm:

- touchscreen;
- virtual joystick;
- touch gesture.

#### WebXR / VR — Future Extension

Không yêu cầu thiết bị VR để nghiệm thu MVP.

Trong giai đoạn mở rộng WebXR sau này, input có thể bao gồm controller, headset orientation và pointer/ray interaction tùy thiết bị.

---

### 3.3 Software Interfaces

#### CMS / Backend Interface

Frontend phải có khả năng lấy dữ liệu về:

- exhibit;
- hotspot;
- tour order;
- localization;
- publication status;
- asset reference.

Frontend và giao diện CMS chỉ giao tiếp với NestJS API; không kết nối trực tiếp PostgreSQL, Supabase hoặc dịch vụ Storage. Phản hồi API phải được kiểm tra bằng Zod schema trước khi dùng; phản hồi sai schema được xử lý như lỗi dữ liệu theo FR-92. API public chỉ trả nội dung Published; quyền đọc Draft/Preview và quyền ghi được kiểm tra tại backend.

#### Asset Storage Interface

Ứng dụng phải có khả năng truy cập:

- 3D model;
- image;
- audio.

Backend chịu trách nhiệm truy cập Storage và cung cấp nội dung media qua API hoặc tuyến phân phối được quản lý bởi backend. Frontend không dùng Storage SDK hoặc credential để truy cập trực tiếp Storage.

#### Browser Capability Interface

Ứng dụng phải sử dụng browser capability detection để xác định khả năng:

- render 3D;
- phát hiện WebXR capability để xác định khả năng mở rộng XR trong tương lai.

---

### 3.4 Communication Interfaces

- Mọi communication giữa production client và server phải sử dụng HTTPS.
- Dữ liệu trao đổi giữa frontend và backend phải sử dụng định dạng machine-readable phù hợp, ví dụ JSON.
- Media asset trong production phải được phân phối qua HTTPS bằng API hoặc tuyến CDN của backend; HTTP chỉ được dùng ở môi trường local.

---

## 4. Stakeholder Requirements

### 4.1 Visitor Requirements

**SR-01 — Access without account**  
Visitor phải có thể truy cập và tham quan bảo tàng mà không cần đăng ký hoặc đăng nhập.

**SR-02 — Explore the museum environment**  
Visitor phải có thể khám phá không gian bảo tàng trên desktop và mobile thông qua giao diện 3D.

**SR-03 — View exhibit information**  
Visitor phải có thể lựa chọn một hiện vật và xem thông tin liên quan.

**SR-04 — Interact with exhibits**  
Visitor phải có thể tương tác với hotspot được gắn trên hiện vật.

**SR-05 — Listen to audio guides**  
Visitor phải có thể nghe audio guide của từng hiện vật.

**SR-06 — Select language**  
Visitor phải có thể sử dụng nội dung bằng tiếng Việt hoặc tiếng Anh.

**SR-07 — Participate in guided tour**  
Visitor phải có thể tham gia một tour hướng dẫn theo thứ tự được định nghĩa trước.

**SR-08 — Receive navigation assistance**  
Trong guided tour, Visitor phải nhận được chỉ dẫn tới hiện vật tiếp theo và có tùy chọn teleport.

**SR-09 — WebXR extension readiness**  
Hệ thống phải có khả năng nhận biết WebXR capability để hỗ trợ mở rộng immersive XR trong tương lai; triển khai và nghiệm thu bằng headset không thuộc MVP hiện tại.

**SR-10 — Core experience without XR**  
Visitor phải sử dụng được toàn bộ chức năng cốt lõi của MVP mà không cần WebXR hoặc thiết bị VR.

**SR-11 — Accessible alternative**  
Visitor không thể hoặc không muốn sử dụng giao diện 3D phải có khả năng truy cập nội dung thông qua giao diện 2D accessible.

---

### 4.2 Administrative Requirements

**SR-12 — Secure administration access**  
Administrative User phải đăng nhập trước khi truy cập Admin Portal.

**SR-13 — Manage exhibit content**  
Editor/Admin có permission phù hợp phải có thể tạo, xem và chỉnh sửa nội dung hiện vật thông qua revision.

**SR-14 — Manage multilingual content**  
Người có quyền biên tập phải có thể quản lý nội dung tiếng Việt và tiếng Anh.

**SR-15 — Manage exhibit media**  
Người có quyền biên tập phải có thể quản lý model 3D, hình ảnh, audio và captions.

**SR-16 — Configure exhibit placement**  
Người có quyền biên tập phải có thể cấu hình vị trí, hướng xoay và kích thước của hiện vật.

**SR-17 — Manage hotspots**  
Người có quyền biên tập phải có thể thêm, chỉnh sửa và xóa hotspot trong revision chưa publish.

**SR-18 — Manage publication state**  
Moderator/Admin có permission phù hợp phải có thể review, publish, reject hoặc hide nội dung theo workflow được phép.

**SR-19 — Preview draft content**  
Người có permission đọc Draft phải có thể xem trước revision chưa publish trong môi trường Preview.

**SR-20 — Manage guided-tour sequence**  
Người có permission phù hợp phải có thể xác định thứ tự hiện vật trong guided tour.

**SR-21 — Manage administrative users**  
Admin có permission phù hợp phải có thể tạo, xem, cập nhật, kích hoạt/vô hiệu hóa tài khoản quản trị.

**SR-22 — Manage roles and permissions**  
Admin có permission phù hợp phải có thể quản lý role và permission matrix dùng cho RBAC.

**SR-23 — Review content revisions**  
Moderator/Admin phải có thể xem revision được submit, Publish hoặc Reject revision và lưu quyết định kiểm duyệt.

**SR-24 — Audit administrative actions**  
Người có permission đọc audit phải có thể truy vết các hành động quản trị quan trọng.

**SR-25 — Manage room metadata**  
Người có permission phù hợp phải có thể quản lý metadata phòng; việc chỉnh mesh/geometry phòng 3D không thuộc MVP.

**SR-26 — Handle content reports**  
Visitor phải có thể gửi báo cáo nội dung; Moderator/Admin có permission phù hợp phải có thể xem và xử lý báo cáo.

## 5. Business Rules

**BR-01 — Visitor authentication**  
Visitor không cần tài khoản để truy cập bảo tàng.

**BR-02 — Administrative authentication and authorization**  
Chỉ Administrative User có phiên xác thực hợp lệ mới được truy cập Admin Portal. Mỗi thao tác còn phải được backend kiểm tra permission tương ứng.

**BR-03 — Role-based administrative permissions**  
MVP sử dụng RBAC. Ba role mặc định là `admin`, `moderator`, `editor`.

- `editor`: biên tập content/media/hotspot/revision và submit review theo permission;
- `moderator`: review/publish/reject/hide revision, xử lý report và đọc audit theo permission;
- `admin`: quản lý user/role/permission và có thể được cấp toàn bộ permission hệ thống.

Role chỉ là tập hợp permission; backend authorization dựa trên permission thực tế, không dựa vào việc frontend ẩn/hiện nút.

**BR-04 — Publication visibility**  
Visitor chỉ nhìn thấy revision hiện hành đã được Publish của Exhibit còn public. Draft/In Review/Rejected revision phải bị loại khỏi mọi phản hồi public, kể cả truy vấn trực tiếp bằng ID. Preview và media chỉ gắn với revision chưa publish phải yêu cầu authorization phù hợp.

**BR-05 — Draft preview**  
Administrative User có permission phù hợp được phép Preview revision chưa publish. Preview không làm revision trở nên công khai.

**BR-06 — Exhibit count**  
MVP phải hỗ trợ tối thiểu 5 hiện vật hoàn chỉnh.

**BR-07 — Fixed 3D environment with manageable room metadata**  
Không gian/geometry phòng 3D được xây dựng trước và không chỉnh mesh/layout bằng CMS trong MVP. CMS được phép CRUD metadata/record phòng phục vụ tổ chức nội dung và API.

**BR-08 — Exhibit placement**  
Editor/Admin có permission phù hợp được phép cấu hình Position, Rotation và Scale của hiện vật trong revision editable.

**BR-09 — Exhibit language**  
Mỗi revision được Publish phải có nội dung cơ bản bằng tiếng Việt và tiếng Anh.

**BR-10 — Audio language**  
Audio guide có thể được lưu riêng theo từng ngôn ngữ; có audio thì phải có transcript và captions đồng bộ cùng ngôn ngữ trước khi Publish. Không tự phát audio của ngôn ngữ khác khi thiếu audio locale hiện tại.

**BR-11 — Hotspot association**  
Mỗi hotspot thuộc đúng một revision/exhibit context hợp lệ; một hiện vật có thể có từ 0 đến nhiều hotspot.

**BR-12 — Hotspot placement**  
Mỗi hotspot phải có thông tin xác định vị trí tương đối với model 3D.

**BR-13 — Guided-tour structure**  
Trong MVP chỉ tồn tại một guided tour chính theo thứ tự tuyến tính.

**BR-14 — Guided-tour navigation**  
Guided tour phải hỗ trợ chỉ dẫn hướng, Next, Previous, Exit Tour và teleport trong 3D. Visitor chọn Auto hoặc Manual; Auto được mô tả tại FR-98. Trong 2D, tour dùng danh sách/nội dung hiện vật. Hành vi tour trong XR là future extension.

**BR-15 — WebXR outside MVP acceptance**  
Immersive VR không phải chức năng bắt buộc của MVP và không được dùng làm điều kiện chặn nghiệm thu. Capability detection vẫn thuộc MVP.

**BR-16 — Progressive fallback**  
Trong MVP, hệ thống áp dụng thứ tự trải nghiệm: **Standard 3D → Accessible 2D**. WebXR/VR là extension ngoài chuỗi fallback bắt buộc.

**BR-17 — Core-content availability**  
Thông tin cốt lõi của hiện vật không được tồn tại độc quyền trong tương tác 3D/XR.

**BR-18 — Accessibility scope**  
Public-facing UI thuộc MVP phải đáp ứng phạm vi WCAG 2.1 A/AA áp dụng được. CMS phải hỗ trợ tối thiểu keyboard navigation, visible focus, semantic controls/labels và không tạo keyboard trap.

**BR-19 — Content update independence**  
Nội dung/metadata thông thường phải được cập nhật qua CMS không cần sửa/build lại source frontend.

**BR-20 — Deletion protection**  
Thao tác xóa phải có xác nhận. Draft revision có thể bị xóa theo quyền nếu không phải revision đang public. Xóa Exhibit đang có revision Published phải tuân theo hành động hide/unpublish/archival được thiết kế; không được làm mất media đang được tài nguyên khác tham chiếu hoặc phá tour bằng reference mồ côi.

**BR-21 — Published revision immutability**  
Revision đã Published không được sửa tại chỗ. Khi cần cập nhật, Editor tạo/chỉnh một Draft Revision mới; revision đang Published có thể tiếp tục phục vụ public cho tới khi Moderator/Admin Publish revision mới hoặc Hide/Unpublish exhibit. Media được revision Published tham chiếu không được overwrite trực tiếp.

**BR-22 — Public session consistency**  
Publish, thay revision Published, Hide/Unpublish hoặc xóa thành công phải có hiệu lực với các request public bắt đầu sau khi backend xác nhận thành công, kể cả qua cache. Phiên đã tải snapshot có thể giữ dữ liệu đến khi reload; không yêu cầu realtime.

**BR-23 — Server-side authorization**  
Authentication và permission phải được backend enforce trên từng protected operation. Frontend route guard/RequirePermission chỉ hỗ trợ UX.

**BR-24 — Privilege protection**  
User không được tự cấp permission/role vượt quá quyền quản trị của mình. Chỉ user có permission quản trị RBAC mới được thay đổi role/permission assignment.

**BR-25 — Append-only audit**  
Audit Log của hành động quản trị quan trọng là append-only ở mức ứng dụng; không có chức năng CMS sửa/xóa audit record.

**BR-26 — Revision moderation**  
Editor submit revision để review. Moderator/Admin có permission review có thể Publish hoặc Reject. Reject phải giữ revision/history và lý do đủ để Editor biết cần chỉnh gì; Publish thay revision public hiện hành một cách nhất quán.

**BR-27 — Content report separation**  
Content Report do Visitor gửi không tự thay đổi trạng thái/publication của Exhibit. Chỉ Moderator/Admin có permission phù hợp được xử lý report và quyết định hành động nội dung.

### 5.1 Revision and Publication Workflow

MVP sử dụng revision để tách biên tập khỏi snapshot đang công khai.

```text
Create Exhibit
     |
     v
Draft Revision
     |
     +-- Save / Preview / Delete Draft
     |
     v
Submit Review
     |
     v
In Review
   /     \
Reject   Publish
  |         |
  v         v
Draft    Published Revision
            |
            +-- Public Museum dùng revision này
            |
            +-- Editor có thể tạo Draft Revision mới
```

Các nguyên tắc:

- `Preview` không thay đổi publication.
- `Submit Review` không làm nội dung công khai.
- Revision đang Published là immutable.
- Có thể tồn tại một Draft/In Review revision mới trong khi revision cũ vẫn Published.
- Publish phải atomically thay revision public hiện hành của Exhibit.
- Reject không xóa revision; revision có thể được chỉnh sửa/submit lại theo workflow.
- Hide/Unpublish loại Exhibit khỏi request public mới nhưng không xóa lịch sử revision.
- Public API không bao giờ trả Draft/In Review/Rejected revision.

### 5.2 Content Validation Rules

> **Engineering target status:** Các giới hạn định lượng trong mục này (ví dụ kích thước file, timeout, độ dài trường) là mục tiêu kỹ thuật do nhóm đề xuất, không được xem là ràng buộc bên ngoài trừ khi có nguồn yêu cầu riêng. Chúng chỉ trở thành tiêu chí nghiệm thu bắt buộc sau khi Requirement Baseline được nhóm phê duyệt. Việc thay đổi các ngưỡng trước baseline không làm thay đổi mục tiêu nghiệp vụ; sau baseline phải được quản lý như Change Request nếu ảnh hưởng phạm vi hoặc acceptance criteria.

Các giới hạn dưới đây được kiểm tra tại backend trước khi lưu/upload. Save Draft được phép thiếu trường bắt buộc cho Publish, nhưng mọi trường đã nhập vẫn phải đúng kiểu, giới hạn và quan hệ dữ liệu. Publish phải kiểm tra toàn bộ hiện vật, hotspot và media liên quan, không chỉ dữ liệu trên form frontend.

| Dữ liệu | Khi Save Draft / Upload | Khi Publish |
|---|---|---|
| Tên hiện vật | Chuỗi tối đa 200 ký tự sau khi trim, theo từng ngôn ngữ | Bắt buộc 1–200 ký tự không rỗng cho cả `vi` và `en` |
| Mô tả hiện vật | Chuỗi tối đa 10.000 ký tự theo từng ngôn ngữ | Bắt buộc 1–10.000 ký tự không rỗng cho cả `vi` và `en` |
| Model 3D | Nếu có: GLB (`model/gltf-binary`), tối đa 10 MB, tài nguyên nhúng và file phải parse được | Tùy chọn ngoài bộ nội dung nghiệm thu; nếu thiếu dùng placeholder, nếu có phải là media loại model hợp lệ |
| Hình ảnh | Nếu có: JPEG, PNG hoặc WebP, tối đa 2 MB, file phải decode được | Tùy chọn ngoài bộ nội dung nghiệm thu; hình ảnh có nội dung phải có alt text tiếng Việt/Anh |
| Audio | Nếu có: MP3 (`audio/mpeg`), tối đa 10 MB cho mỗi ngôn ngữ, file phải decode được | Tùy chọn ngoài bộ nội dung nghiệm thu; mỗi audio được gắn phải có transcript và phụ đề cùng ngôn ngữ |
| Transcript / phụ đề | Transcript tối đa 20.000 ký tự/ngôn ngữ; phụ đề WebVTT UTF-8 tối đa 1 MB, các cue có thời gian hợp lệ trong audio | Với audio có tồn tại: transcript không rỗng và phụ đề tương đương, đồng bộ với audio |
| Position / Rotation / Scale | Các giá trị phải hữu hạn; Position theo mét, Y hướng lên; Rotation theo radian, thứ tự Euler XYZ; Scale từng trục > 0 | Đủ ba trục cho mỗi transform; mặc định Position/Rotation `(0,0,0)`, Scale `(1,1,1)` |
| Hotspot | Thuộc đúng một hiện vật còn tồn tại; vị trí XYZ hữu hạn trong hệ tọa độ local của model, trước transform của hiện vật; chuỗi đã nhập không vượt giới hạn ở cột Publish | Có tiêu đề 1–200 ký tự và nội dung 1–5.000 ký tự cho cả `vi`/`en`; tọa độ được xác nhận lại nếu thay model |
| Media metadata | Khi có media: lưu nguồn, tác giả/chủ sở hữu và giấy phép hoặc căn cứ quyền sử dụng | Mọi media được sử dụng phải có đủ thông tin quyền sử dụng; Admin chịu trách nhiệm xác nhận quyền |
| Tour order | Danh sách ID hiện vật còn tồn tại, không trùng lặp, thứ tự xác định | API public loại Draft và hiện vật bị xóa; giữ thứ tự tương đối của các hiện vật còn lại |

`MB` trong tài liệu này bằng 1.000.000 byte. Backend phải kiểm tra nội dung file và kích thước thực tế, không chỉ extension hoặc MIME do client khai báo. Media reference phải tồn tại, đúng loại và chỉ được phân phối qua tuyến media được backend quản lý; API quản trị không nhận URL Storage tùy ý để bỏ qua quy trình upload/validation. Khi mới Save Draft, transcript/phụ đề và metadata quyền sử dụng có thể chưa đầy đủ; chúng phải đạt quy tắc Publish trước khi công khai.

---

## 6. Functional Requirements

### 6.1 Visitor Access & General Navigation

**FR-01 — Access museum without authentication**  
Hệ thống phải cho phép Visitor truy cập khu vực tham quan mà không yêu cầu đăng ký hoặc đăng nhập.

**FR-02 — Load museum experience**  
Khi Visitor truy cập bảo tàng, hệ thống phải tải không gian triển lãm và dữ liệu cần thiết để bắt đầu phiên tham quan.

**FR-03 — Navigate in 3D environment**  
Hệ thống phải cho phép Visitor di chuyển và thay đổi góc nhìn trong không gian 3D trên desktop và mobile.

**FR-04 — Provide device-appropriate controls**  
Hệ thống phải cung cấp cơ chế điều khiển phù hợp với loại thiết bị.

**FR-05 — Return to starting area**  
Visitor phải có thể quay trở lại vị trí bắt đầu hoặc khu vực chính.

**FR-06 — Exit 3D experience**  
Visitor phải có thể rời chế độ tham quan 3D để quay về giao diện web thông thường; hệ thống phải dừng tour và audio của tour, giải phóng input controls để giao diện web tiếp tục hoạt động.

---

### 6.2 Exhibit Discovery & Information

**FR-07 — Display published exhibits**  
Hệ thống phải hiển thị các hiện vật Published trong không gian triển lãm.

**FR-08 — Select an exhibit**  
Visitor phải có thể lựa chọn một hiện vật để xem thông tin chi tiết.

**FR-09 — Display exhibit information**  
Hệ thống phải hiển thị tối thiểu tên, mô tả, hình ảnh đại diện nếu có và thông tin liên quan.

**FR-10 — Close exhibit information**  
Visitor phải có thể đóng bảng thông tin và tiếp tục tham quan.

**FR-11 — Switch exhibit language**  
Visitor phải có thể chuyển nội dung giữa tiếng Việt và tiếng Anh.

**FR-12 — Preserve selected language**  
Hệ thống phải duy trì lựa chọn ngôn ngữ trong cùng phiên sử dụng.

---

### 6.3 Hotspot Interaction

**FR-13 — Display exhibit hotspots**  
Hệ thống phải hiển thị các hotspot đã được cấu hình cho hiện vật.

**FR-14 — Select hotspot**  
Visitor phải có thể lựa chọn hotspot để xem nội dung chi tiết.

**FR-15 — Display hotspot information**  
Hệ thống phải hiển thị nội dung hotspot bằng ngôn ngữ hiện tại.

**FR-16 — Associate hotspot with exhibit**  
Hệ thống chỉ được hiển thị hotspot thuộc về hiện vật tương ứng.

**FR-17 — Hide unavailable hotspots**  
Hotspot bị xóa hoặc không hợp lệ không được hiển thị công khai.

---

### 6.4 Audio Guide

**FR-18 — Play exhibit audio**  
Visitor phải có thể phát audio guide khi audio tương ứng tồn tại.

**FR-19 — Control audio playback**  
Visitor phải có thể phát, tạm dừng, tiếp tục, dừng và điều chỉnh âm lượng; Stop đưa playback về đầu audio.

**FR-20 — Play audio by language**  
Hệ thống phải phát audio theo ngôn ngữ hiện tại nếu tồn tại.

**FR-21 — Handle missing audio**  
Nếu thiếu audio, hệ thống vẫn phải hiển thị nội dung văn bản tương ứng.

**FR-22 — Prevent unintended overlapping audio**  
Khi bắt đầu audio khác, hệ thống phải dừng hoặc tạm dừng audio hiện đang phát.

---

### 6.5 Guided Tour

**FR-23 — Start guided tour**  
Visitor phải có thể bắt đầu guided tour.

**FR-24 — Follow predefined sequence**  
Hệ thống phải hướng dẫn Visitor qua các hiện vật Published theo thứ tự đã cấu hình, trong cả chế độ Manual và Auto. Auto tuân theo FR-98.

**FR-25 — Display current tour step**  
Hệ thống phải hiển thị vị trí hiện tại của Visitor trong tiến trình tour.

**FR-26 — Navigate to next exhibit**  
Visitor phải có thể chuyển tới bước tiếp theo bằng Next; trong 3D, hệ thống hiển thị chỉ dẫn và Visitor chọn teleport hoặc tự di chuyển. Thao tác Next/Previous khi đang Auto chuyển tour về Manual để tránh tự chuyển bước ngoài ý muốn.

**FR-27 — Navigate to previous exhibit**  
Visitor phải có thể quay về bước trước bằng Previous khi có.

**FR-28 — Provide directional guidance**  
Hệ thống phải cung cấp chỉ dẫn trực quan tới hiện vật kế tiếp.

**FR-29 — Teleport to exhibit**  
Visitor phải có thể teleport tới vị trí phù hợp gần hiện vật.

**FR-30 — Exit guided tour**  
Visitor phải có thể thoát guided tour tại bất kỳ bước nào.

**FR-31 — Complete guided tour**  
Sau hiện vật cuối cùng, hệ thống phải thông báo hoàn thành và cho phép tiếp tục khám phá tự do.

---

### 6.6 WebXR Extension Readiness

**FR-32 — Detect WebXR capability**  
Hệ thống phải có khả năng phát hiện WebXR capability của browser để hỗ trợ quyết định mở rộng XR trong tương lai. Việc cung cấp immersive VR session, controller interaction hoặc headset-specific UI không phải requirement bắt buộc của MVP hiện tại.

> **Reserved IDs:** `FR-33` → `FR-38` được giữ trống trong Draft v0.1 để bảo toàn traceability của các requirement đã đánh số sau đó. Các hành vi immersive VR tương ứng được chuyển sang **Future Enhancements — Outside MVP**.

---

### 6.7 Progressive Fallback

**FR-39 — Provide standard 3D as the primary immersive web experience**  
Visitor phải có thể sử dụng trải nghiệm 3D desktop/mobile mà không phụ thuộc WebXR. Nếu 3D không khả dụng thì áp dụng FR-40.

**FR-40 — Provide 2D fallback**  
Hệ thống phải cung cấp giao diện 2D khi 3D không khả dụng hoặc Visitor chủ động chọn.

**FR-41 — Display exhibit list in 2D mode**  
Trong chế độ 2D, hệ thống phải hiển thị danh sách hiện vật Published.

**FR-42 — Display core exhibit content in 2D**  
Trong 2D, Visitor phải xem được tên, mô tả, hình ảnh, hotspot content phù hợp và audio nếu có.

**FR-43 — Allow language switching in 2D mode**  
Chế độ 2D phải hỗ trợ tiếng Việt và tiếng Anh.

---

### 6.8 Administrative Authentication & Authorization

**FR-44 — Administrative user login**  
Administrative User phải có thể đăng nhập Admin Portal bằng email và mật khẩu hợp lệ.

**FR-45 — Reject invalid login**  
Hệ thống phải từ chối credential không hợp lệ hoặc tài khoản disabled/deleted.

**FR-46 — Maintain authenticated session**  
Administrative User phải có thể sử dụng Admin Portal trong phiên/credential hợp lệ theo NFR-17.

**FR-47 — Administrative logout**  
Administrative User phải có thể logout; backend phải revoke refresh/session tương ứng và frontend xóa credential/cache quản trị nhạy cảm thuộc phiên.

**FR-48 — Protect administrative functions**  
Backend phải phân biệt:
- chưa xác thực / credential hết hạn → `401`;
- đã xác thực nhưng thiếu permission → `403`.

Không thao tác bị từ chối nào được làm thay đổi dữ liệu.

### 6.9 Exhibit Management

**FR-49 — View exhibit list**  
Administrative User có permission phù hợp phải có thể xem danh sách hiện vật trong CMS.

**FR-50 — Create exhibit**  
Editor/Admin có permission phù hợp phải có thể tạo hiện vật và Draft Revision đầu tiên.

**FR-51 — Edit exhibit revision**  
Editor/Admin có permission phù hợp phải có thể chỉnh sửa Draft Revision. Revision đã Published không được sửa tại chỗ; khi cần cập nhật nội dung đang public, hệ thống tạo/sử dụng Draft Revision mới theo BR-21.

**FR-52 — Delete draft/exhibit safely**  
Administrative User có permission phù hợp phải có thể xóa Draft Revision hoặc Exhibit đủ điều kiện sau xác nhận, tuân theo BR-20 và không phá media dùng chung, tour hoặc revision Published.

**FR-53 — Manage Vietnamese content**  
Admin phải có thể nhập và chỉnh sửa nội dung tiếng Việt.

**FR-54 — Manage English content**  
Admin phải có thể nhập và chỉnh sửa nội dung tiếng Anh.

**FR-55 — Manage exhibit image**  
Admin phải có thể thêm, thay đổi hoặc xóa hình ảnh.

**FR-56 — Manage 3D model**  
Admin phải có thể chỉ định hoặc cập nhật model 3D.

**FR-57 — Manage audio guides**  
Admin phải có thể thêm, thay đổi hoặc tháo audio guide tiếng Việt và tiếng Anh trên Draft, đồng thời nhập/chỉnh sửa transcript và upload/thay phụ đề tương ứng; validation theo mục 5.2.

---

### 6.10 Exhibit Placement

**FR-58 — Configure exhibit position**  
Admin phải có thể cấu hình Position.

**FR-59 — Configure exhibit rotation**  
Admin phải có thể cấu hình Rotation.

**FR-60 — Configure exhibit scale**  
Admin phải có thể cấu hình Scale.

**FR-61 — Load configured transform**  
Hệ thống phải đặt hiện vật theo transform đã lưu.

---

### 6.11 Hotspot Management

**FR-62 — Create hotspot**  
Admin phải có thể thêm hotspot mới.

**FR-63 — Edit hotspot**  
Admin phải có thể chỉnh sửa hotspot.

**FR-64 — Delete hotspot**  
Admin phải có thể xóa hotspot.

**FR-65 — Configure hotspot position**  
Admin phải có thể xác định vị trí hotspot trên model.

**FR-66 — Manage multilingual hotspot content**  
Admin phải có thể nhập nội dung hotspot bằng tiếng Việt và tiếng Anh.

---

### 6.12 Draft, Preview, Review & Publishing

**FR-67 — Save Draft Revision**  
Editor/Admin có permission phù hợp phải có thể lưu một revision ở trạng thái Draft.

**FR-68 — Exclude non-published revisions from public museum**  
Draft/In Review/Rejected revision và hotspot/media chỉ thuộc các revision đó không được trả về qua API public. Preview phải yêu cầu authentication + permission.

**FR-69 — Preview Draft Revision**  
Administrative User có permission phù hợp phải có thể xem Draft Revision trong môi trường 3D Preview.

**FR-70 — Preview configured placement**  
Preview phải hiển thị transform của revision đang xem.

**FR-71 — Preview hotspots and media**  
Preview phải cho phép kiểm tra hotspot, nội dung song ngữ, image/model/audio/captions của revision.

**FR-72 — Publish reviewed revision**  
Moderator/Admin có permission `publish` tương ứng phải có thể Publish một revision hợp lệ sau review.

**FR-73 — Make Published revision publicly available**  
Sau Publish thành công, revision mới phải trở thành revision public hiện hành trong các request mới theo BR-22, không cần build lại frontend.

**FR-74 — Hide or unpublish exhibit**  
Moderator/Admin có permission phù hợp phải có thể loại Exhibit khỏi public mà không xóa lịch sử revision.

**FR-75 — Remove hidden/unpublished exhibit from public museum**  
Sau Hide/Unpublish thành công, Exhibit không được trả về trong request public mới; phiên đã tải snapshot không bắt buộc cập nhật realtime.

### 6.13 Guided Tour Management

**FR-76 — View tour sequence**  
Admin phải có thể xem thứ tự hiện vật trong guided tour.

**FR-77 — Configure tour order**  
Admin phải có thể thay đổi thứ tự guided tour.

**FR-78 — Prevent unpublished tour item**  
Hệ thống không được đưa Draft vào guided tour công khai.

**FR-79 — Persist tour configuration**  
Thứ tự tour được lưu phải được sử dụng trong các phiên tour tiếp theo.

---

### 6.14 Accessibility Functions

**FR-80 — Keyboard-operable web interface**  
Các chức năng chính thuộc MVP phải có thể thao tác bằng bàn phím.

**FR-81 — Visible keyboard focus**  
Các thành phần tương tác phải có focus state rõ ràng.

**FR-82 — Provide text alternatives**  
Hình ảnh mang nội dung phải có text alternative phù hợp.

**FR-83 — Provide audio transcript**  
Audio guide phải có transcript tương ứng.

**FR-84 — Provide assistive-technology labels**  
Các control quan trọng phải có tên hoặc nhãn phù hợp cho assistive technology.

**FR-85 — Preserve accessibility in 2D fallback**  
Các chức năng chính trong 2D phải sử dụng thành phần giao diện có thể truy cập bằng assistive technology.

---

### 6.15 Error Handling

**FR-86 — Handle model loading failure**  
Nếu model không tải được, hệ thống phải dùng placeholder trong scene, thông báo phù hợp và vẫn cho phép truy cập nội dung văn bản. Model bị thiếu được phép dùng placeholder theo mục 5.2, ngoài bộ nội dung nghiệm thu bắt buộc.

**FR-87 — Handle audio loading failure**  
Nếu audio không tải được, hệ thống phải giữ nội dung văn bản tương ứng.

**FR-88 — Handle museum 3D failure**  
Nếu trải nghiệm 3D không thể khởi tạo, hệ thống phải cung cấp đường chuyển sang 2D fallback.

**FR-89 — Reserved for future WebXR failure handling**  
Không áp dụng cho MVP hiện tại. Requirement xử lý lỗi immersive XR sẽ được xác định khi WebXR được đưa vào scope triển khai.

**FR-90 — Validate CMS input**  
Backend phải kiểm tra dữ liệu theo mục 5.2 khi Save Draft, upload và Publish. Draft được phép chưa đủ nội dung để Publish; chỉ Publish được thực hiện khi mọi quy tắc bắt buộc đã đạt.

**FR-91 — Report CMS validation errors**  
Khi dữ liệu không hợp lệ, hệ thống phải chỉ rõ trường cần sửa.

**FR-92 — Handle content API failure**  
Khi API không khả dụng, request quá hạn 15 giây hoặc phản hồi sai schema, hệ thống phải hiển thị lỗi dễ hiểu và cho phép thử lại. Chỉ dữ liệu đã kiểm tra hợp lệ mới được dùng; giao diện 2D vẫn có thể hiển thị trạng thái lỗi nhưng không được giả vờ có nội dung khi API thất bại.

**FR-93 — Handle CMS operation failure**  
Khi Save, Publish hoặc Upload thất bại, CMS phải giữ dữ liệu đang nhập trong form, hiển thị lỗi và cho phép thử lại; không hiển thị thành công trước khi backend xác nhận. Nếu mất phản hồi sau khi gửi, CMS phải kiểm tra trạng thái đã lưu trước khi gửi lại để tránh tạo bản ghi/upload trùng; trạng thái chưa xác định phải được thông báo rõ.

---

### 6.16 Captions, Motion, Quality & Media Metadata

**FR-94 — Provide synchronized captions**  
Khi phát audio guide, Visitor phải có thể bật/tắt phụ đề đồng bộ theo thời gian và ngôn ngữ audio trong 2D và 3D; transcript đầy đủ vẫn đọc được khi audio không phát hoặc tải lỗi. Việc hiển thị captions trong XR là future extension.

**FR-95 — Respect reduced motion**  
Giao diện web thuộc MVP phải tôn trọng `prefers-reduced-motion: reduce`: tắt animation không thiết yếu và mọi chuyển động camera tự động liên tục, dùng chuyển vị trí tức thời cho teleport hoặc Auto thay cho animation camera. Visitor vẫn có thể dùng tour, hotspot, audio và teleport chủ động. Thay đổi tùy chọn trong phiên phải được áp dụng.

**FR-96 — Adapt 3D rendering quality when needed**  
Ở chế độ 3D, khi hiệu năng rendering duy trì dưới ngưỡng chấp nhận trên thiết bị được hỗ trợ, hệ thống phải tự động giảm chất lượng của các yếu tố hiển thị không thiết yếu mà không làm mất nội dung hoặc chức năng cốt lõi. Nếu trải nghiệm vẫn không đạt ngưỡng chấp nhận ở mức chất lượng thấp nhất, hệ thống phải thông báo cho Visitor và cung cấp lựa chọn chuyển sang giao diện 2D. Cơ chế phát hiện, số mức chất lượng và kỹ thuật giảm tải được xác định trong Architecture/Test Plan.

**FR-97 — Manage media rights metadata**  
Admin phải có thể nhập, lưu và xem nguồn, tác giả/chủ sở hữu và giấy phép/căn cứ quyền sử dụng của media; thông tin ghi công hoặc giấy phép cần công khai phải truy cập được từ nội dung hiện vật ở cả 2D và 3D. Publish bị từ chối nếu thiếu metadata bắt buộc theo mục 5.2.

---

### 6.17 Automatic Guided Tour

**FR-98 — Automatically guide visitors through the tour**  
Visitor phải có thể chọn Auto / Manual và Pause / Resume. Auto đưa Visitor tới điểm xem hiện vật theo thứ tự đã lưu bằng teleport tức thời, mở nội dung rồi phát audio sau khi Visitor đã cho phép; chuyển bước khi audio kết thúc hoặc sau 15 giây nếu không có audio hoặc audio lỗi. Nếu trình duyệt chặn playback, tour phải tạm dừng và chờ Visitor Play hoặc chọn Next. Pause tạm dừng cả bộ đếm và audio; Resume tiếp tục bước hiện tại; Next/Previous hoặc đổi sang Manual dừng bộ đếm và audio của Auto. Exit dừng mọi thao tác tự động và audio của tour. Trong 2D, Auto chuyển nội dung hiện vật thay cho vị trí. Không dùng chuyển động camera liên tục. Hành vi Auto Tour trong XR là future extension.

---

### 6.18 System Administration, RBAC & Governance

**FR-99 — Enforce RBAC permissions**  
Backend phải kiểm tra permission cho mọi protected administrative operation; frontend không được là lớp enforcement duy nhất.

**FR-100 — View administrative users**  
Admin có permission `user:read` hoặc tương đương phải có thể xem danh sách/chi tiết Administrative User.

**FR-101 — Create and update administrative users**  
Admin có permission phù hợp phải có thể tạo và cập nhật Administrative User, bao gồm thông tin hiển thị và credential reset/change theo policy.

**FR-102 — Activate or disable administrative users**  
Admin có permission phù hợp phải có thể kích hoạt/vô hiệu hóa user; user disabled không được login/refresh.

**FR-103 — Assign and remove roles**  
Admin có permission phù hợp phải có thể gán/bỏ role của user.

**FR-104 — Manage roles**  
Admin có permission phù hợp phải có thể xem/tạo/cập nhật/xóa role theo ràng buộc role hệ thống.

**FR-105 — Manage permission matrix**  
Admin có permission phù hợp phải có thể xem danh mục permission và cập nhật tập permission của role.

**FR-106 — Record administrative audit events**  
Hệ thống phải ghi Audit Log cho các hành động quản trị quan trọng theo policy, tối thiểu gồm actor, action, resource, thời điểm và request identity phù hợp; không ghi password/token plaintext.

**FR-107 — View and filter audit log**  
User có permission `audit:read` hoặc tương đương phải có thể xem audit log và lọc theo actor/action/resource/thời gian.

**FR-108 — Manage room metadata**  
User có permission phù hợp phải có thể CRUD metadata phòng. Chức năng này không bao gồm chỉnh mesh/geometry/layout 3D.

**FR-109 — Submit revision for review**  
Editor/Admin có permission phù hợp phải có thể submit Draft Revision để Moderator/Admin review.

**FR-110 — Review and decide revision**  
Moderator/Admin có permission phù hợp phải có thể xem revision chờ duyệt và quyết định Publish hoặc Reject; Reject phải có lý do/feedback.

**FR-111 — Preserve revision history**  
Hệ thống phải giữ lịch sử revision đủ để truy vết revision đã tạo/review/publish/reject. MVP không bắt buộc rollback tự động.

**FR-112 — Submit content report**  
Visitor phải có thể gửi báo cáo về nội dung công khai qua endpoint/form chuyên biệt có validation và rate-limit phù hợp.

**FR-113 — Manage content reports**  
Moderator/Admin có permission phù hợp phải có thể xem, phân loại và resolve/dismiss Content Report; xử lý report phải được audit khi policy yêu cầu.

---

## 7. Non-functional Requirements

### 7.0 Status of Quantitative Targets

Các ngưỡng định lượng trong phần NFR (bao gồm nhưng không giới hạn ở thời gian tải, FPS, response time, asset budget, concurrent visitors, availability và thời hạn session) là **engineering targets của Draft v0.1**. Chúng được dùng để định hướng Architecture và lập Test Plan, nhưng chỉ trở thành cam kết nghiệm thu bắt buộc sau khi nhóm review và phê duyệt Requirement Baseline. Nếu đề bài hoặc stakeholder cung cấp một ngưỡng bắt buộc khác, ngưỡng bên ngoài đó được ưu tiên và phải được ghi nguồn.

Chi tiết cách đo, network profile, số lần lặp, thiết bị cụ thể và công cụ đo thuộc **Test/Performance Plan**, không phải yêu cầu sản phẩm.

### 7.1 Performance

**NFR-01 — Initial page load**  
Trong điều kiện nghiệm thu sẽ được chốt trong Test/Performance Plan, trang public ban đầu phải hiển thị tên bảo tàng, nút bắt đầu tham quan, chọn ngôn ngữ và lựa chọn 2D hoạt động trong vòng **5 giây** từ navigation start. Đây không phải thời gian scene 3D tải xong; thời gian scene sẵn sàng phải được đo và báo cáo riêng.

**NFR-02 — Progressive asset loading**  
Model 3D, texture và audio dung lượng lớn phải được tải theo nhu cầu hoặc theo giai đoạn.

**NFR-03 — 3D frame rate**  
Trên từng thiết bị desktop/mobile được chọn để hỗ trợ 3D trong device matrix, trải nghiệm 3D phải duy trì tối thiểu **30 FPS** trong kịch bản tham quan chuẩn sau khi asset đã tải; 60 FPS là mục tiêu khuyến nghị. Không áp dụng ngưỡng này cho thiết bị không hỗ trợ WebGL. Hiệu năng VR không thuộc tiêu chí nghiệm thu MVP.

**NFR-04 — Interaction response**  
Độ trễ từ input đến thay đổi trực quan đầu tiên phải đạt **p95 ≤ 500 ms** cho mở/đóng panel, đổi ngôn ngữ, Next/Previous và audio controls trong điều kiện nghiệm thu đã chốt. Feedback loading được xem là phản hồi khi thao tác cần network; thời gian tải asset và hoàn tất thao tác phải được báo cáo riêng.

**NFR-05 — CMS response**  
List, Save Draft, Publish và Unpublish phải hoàn tất với **p95 ≤ 2 giây** trong điều kiện nghiệm thu đã chốt, tính từ khi gửi request đến khi giao diện nhận kết quả đã được backend xác nhận. Upload và xử lý media không thuộc ngưỡng này; thời gian của chúng được báo cáo riêng.

**NFR-06 — 3D asset optimization**  
Model và texture phải được tối ưu cho môi trường web bằng các kỹ thuật phù hợp như compression, lazy loading, caching hoặc giảm polygon khi cần.

**NFR-07 — Initial asset budget**  
Tổng transfer size với cache rỗng từ tải trang public đến khi scene 3D mẫu sẵn sàng di chuyển/chọn hiện vật phải **≤ 20 MB**, gồm HTML, JS, CSS, font, API data, model và texture cần cho trạng thái ban đầu. Không gồm media chỉ tải sau tương tác; các tài nguyên đó vẫn được kiểm kê riêng.

### 7.1.1 Measurement and Evidence

Chi tiết về thiết bị cụ thể, network throttling, số lượt đo, kịch bản FPS 3D, cách tính percentile, load test và biểu mẫu bằng chứng sẽ được chốt trong Test/Performance Plan trước nghiệm thu. [`plans/performance-audit.md`](../plans/performance-audit.md) và [`plans/device-matrix.md`](../plans/device-matrix.md) là tài liệu tham khảo hiện có, chưa phải profile nghiệm thu đã phê duyệt cho Draft v0.1. SRS chỉ quy định **mức chất lượng cần đạt**; Test/Performance Plan quy định **cách chứng minh mức đó đã đạt**. Đo hiệu năng immersive VR thuộc kế hoạch mở rộng sau MVP.

Không được tuyên bố đạt hiệu năng cho một nhóm thiết bị khi chưa có model/version và bằng chứng đo tương ứng.

---

### 7.2 Scalability

**NFR-08 — Concurrent visitors**  
API nội dung công khai phải hỗ trợ tối thiểu **100 phiên Visitor đồng thời** trong workload nghiệm thu đã chốt mà không gây lỗi chức năng; request nội dung hợp lệ phải duy trì response đúng schema và **p95 ≤ 2 giây**. Chi tiết ramp-up, thời lượng giữ tải, tần suất request và trạng thái cache sẽ được chốt trong Load Test Plan trước nghiệm thu.

**NFR-09 — Content extensibility**  
Kiến trúc dữ liệu không được giới hạn cứng hệ thống chỉ có đúng 5 hiện vật.

---

### 7.3 Availability & Reliability

**NFR-10 — Public museum availability**  
Mục tiêu vận hành sau triển khai là availability **≥ 99% trong cửa sổ 30 ngày liên tục**, không tính thời gian bảo trì đã thông báo trước. Phương pháp probe và cách tính availability sẽ được chốt trong Operations/Monitoring Plan trước triển khai. Thiếu dữ liệu giám sát thì chưa đủ bằng chứng kết luận. Đây là mục tiêu vận hành, không phải điều kiện chặn nghiệm thu demo MVP trước khi có đủ 30 ngày giám sát.

**NFR-11 — Graceful degradation**  
Lỗi của một thành phần không thiết yếu không được làm toàn bộ phiên tham quan ngừng hoạt động.

**NFR-12 — Content consistency**  
Request public mới phải nhận trạng thái Published có hiệu lực theo BR-22; cache không được trả bản đã Unpublish/xóa sau khi backend xác nhận thao tác thành công. Phiên đã tải dữ liệu có thể giữ snapshot tới khi tải lại; MVP không yêu cầu lưu lịch sử phiên bản hoặc rollback.

**NFR-13 — Data persistence**  
Các thay đổi CMS được lưu thành công phải tồn tại sau logout hoặc restart.

---

### 7.4 Security

**NFR-14 — HTTPS**  
Mọi giao tiếp production client-server phải sử dụng HTTPS.

**NFR-15 — Password storage**  
Mật khẩu Administrative User không được lưu plaintext và phải được hash bằng cơ chế phù hợp như bcrypt/Argon2 với cấu hình được review.

**NFR-16 — Authentication and authorization protection**  
Admin Portal phải yêu cầu authentication hợp lệ; protected API phải enforce RBAC permission ở backend.

**NFR-17 — Access/refresh credential lifetime and revocation**  
Baseline auth hiện tại sử dụng access credential ngắn hạn và refresh session có thể revoke/rotate. Mục tiêu triển khai:
- access token TTL khoảng **15 phút**;
- refresh session TTL tối đa khoảng **7 ngày**;
- logout revoke refresh session/family tương ứng;
- refresh-token reuse detection phải revoke family;
- user disabled/deleted bị từ chối login/refresh;
- thay đổi permission/role phải có hiệu lực không muộn hơn lần cấp access token kế tiếp và không vượt quá access-token TTL hiện hành.

Các giá trị định lượng này là engineering target của v0.2 và có thể điều chỉnh qua Change Request nếu nhóm đổi auth strategy.

**NFR-18 — Input validation**  
Dữ liệu do Administrative User gửi phải được kiểm tra phía backend trước khi lưu, review hoặc publish.

**NFR-19 — File upload validation**  
Backend phải kiểm tra định dạng/nội dung, MIME và dung lượng thực tế theo mục 5.2; upload thất bại không được thay thế media hợp lệ đang dùng.

**NFR-20 — Unauthorized/forbidden API access**  
Protected API phải trả `401` khi chưa xác thực/credential hết hạn và `403` khi đã xác thực nhưng thiếu permission. Request bị từ chối không được thay đổi dữ liệu.

**NFR-21 — Sensitive information exposure**  
Không được gửi password/passwordHash, raw refresh token, secret key hoặc server credential trong API response/log/frontend bundle ngoài nơi bắt buộc theo auth protocol.

### 7.5 Usability

**NFR-22 — Learnability**  
Visitor mới phải có thể hiểu thao tác cơ bản mà không cần tài liệu hướng dẫn riêng.

**NFR-23 — Navigation instructions**  
Khi bắt đầu 3D lần đầu, hệ thống phải cung cấp hướng dẫn ngắn về di chuyển, xoay góc nhìn, chọn hiện vật và guided tour.

**NFR-24 — Consistent controls**  
Các control cùng chức năng phải có cách trình bày và hành vi nhất quán.

**NFR-25 — User feedback**  
Hệ thống phải cung cấp feedback rõ ràng cho trạng thái loading, upload, publish và lỗi.

**NFR-26 — Destructive action confirmation**  
Các thao tác có thể gây mất dữ liệu phải yêu cầu xác nhận.

---

### 7.6 Accessibility

**NFR-27 — WCAG target**  
Toàn bộ giao diện public và CMS thuộc MVP phải đáp ứng các tiêu chí WCAG 2.1 Level A và AA áp dụng được. Checklist nghiệm thu phải ghi từng tiêu chí, bằng chứng hoặc lý do không áp dụng; chỉ kết quả quét tự động không đủ để kết luận đáp ứng.

**NFR-28 — Keyboard accessibility**  
Mọi chức năng chính trên giao diện 2D phải có thể sử dụng không cần chuột.

**NFR-29 — Focus visibility**  
Phần tử đang focus phải có dấu hiệu trực quan rõ ràng.

**NFR-30 — Text contrast**  
Văn bản và UI component phải có độ tương phản phù hợp với WCAG AA.

**NFR-31 — Text resizing**  
Giao diện phải duy trì khả năng sử dụng khi zoom văn bản tới **200%**.

**NFR-32 — Audio alternative**  
Mọi audio guide phải có transcript tương đương và phụ đề đồng bộ cùng ngôn ngữ theo FR-83/FR-94; transcript vẫn truy cập được nếu playback thất bại.

**NFR-33 — Non-3D content access**  
Thông tin cốt lõi của hiện vật phải có thể truy cập mà không bắt buộc điều khiển môi trường 3D.

---

### 7.7 Compatibility

**NFR-34 — Desktop browser support**  
Hệ thống phải được kiểm thử tối thiểu trên phiên bản hiện hành của Chrome, Edge và Firefox.

**NFR-35 — Mobile browser support**  
Hệ thống phải được kiểm thử tối thiểu trên Chrome Android và Safari iOS.

**NFR-36 — WebXR extension compatibility**  
MVP không yêu cầu kiểm thử trên headset thật. Kiến trúc/frontend không được phụ thuộc vào giả định ngăn cản việc bổ sung WebXR sau này; capability detection phải được kiểm thử theo FR-32/AC-13 bằng browser/dev tooling phù hợp, nhưng kết quả đó không được tuyên bố là kiểm thử VR headset.

**NFR-37 — Responsive interface**  
Giao diện web thuộc MVP phải hoạt động trên desktop, tablet và smartphone.

**NFR-38 — Unsupported feature handling**  
Nếu một capability không được hỗ trợ, hệ thống phải phát hiện và cung cấp fallback phù hợp khi có.

---

### 7.8 Maintainability

**NFR-39 — Separation of concerns**  
Hệ thống phải tách biệt hợp lý rendering 3D, UI, content management, authentication, data access và asset storage.

**NFR-40 — CMS-driven content**  
Các thay đổi nội dung thông thường không được yêu cầu thay đổi source code frontend.

**NFR-41 — Configurable content model**  
Tên, mô tả, audio, model, hotspot, transform và publication status phải được quản lý dưới dạng dữ liệu cấu hình.

**NFR-42 — Code quality**  
Frontend chính phải sử dụng TypeScript và quy ước coding thống nhất; module quan trọng phải có type/interface rõ ràng.

**NFR-43 — Error logging**  
Các lỗi quan trọng phải được ghi log đủ để hỗ trợ chẩn đoán mà không làm lộ thông tin nhạy cảm.

---

### 7.9 Testability

**NFR-44 — Requirement traceability**  
Các chức năng quan trọng phải truy vết được theo chuỗi Requirement → Use Case/User Story → Test Case.

**NFR-45 — Functional testing**  
Các flow chính phải có test case.

**NFR-46 — Device matrix testing**  
Hệ thống phải được kiểm thử trên device matrix đã xác định.

**NFR-47 — Fallback testing**  
Phải có test cho 3D available/unavailable, WebXR capability detection ở mức extension readiness, model/audio failure, API timeout/sai schema và Save/Publish/Upload thất bại; mỗi test phải ghi trạng thái và bằng chứng. Không yêu cầu test immersive VR/headset trong MVP.

**NFR-48 — Performance audit**  
Trước nghiệm thu phải audit initial load, asset size, frame rate, model loading behavior và network requests.

---

### 7.10 Localization

**NFR-49 — UTF-8 support**  
Hệ thống phải hỗ trợ Unicode/UTF-8.

**NFR-50 — Language consistency**  
Khi Visitor chọn ngôn ngữ, các phần được hỗ trợ phải ưu tiên hiển thị nhất quán theo ngôn ngữ đó.

**NFR-51 — Missing translation handling**  
Tên/mô tả hiện vật và hotspot thiếu `vi` hoặc `en` phải bị chặn Publish theo mục 5.2. Nếu nội dung tùy chọn hoặc nhãn UI thiếu bản dịch trong runtime, hệ thống dùng tiếng Việt làm ngôn ngữ mặc định và chỉ rõ khi nội dung khác ngôn ngữ đã chọn; thiếu audio không được tự phát audio của ngôn ngữ khác.

---

### 7.11 Privacy

**NFR-52 — Minimal visitor data**  
Visitor không phải cung cấp dữ liệu cá nhân để sử dụng chức năng tham quan cơ bản.

**NFR-53 — Admin data protection**  
Thông tin tài khoản Admin chỉ được sử dụng cho xác thực và quản trị.

**NFR-54 — Client-side data minimization**  
Không được lưu thông tin xác thực nhạy cảm của Admin trong client storage dưới dạng plaintext.

---

### 7.12 RBAC, Audit & Administrative Reliability

**NFR-55 — Server-side permission enforcement**  
Mọi permission quan trọng phải được kiểm tra tại backend; UI permission check chỉ hỗ trợ UX.

**NFR-56 — Audit integrity**  
Audit log phải append-only qua các chức năng ứng dụng thông thường, có timestamp/request identity phù hợp và không chứa credential bí mật.

**NFR-57 — Authentication abuse protection**  
Login/refresh và endpoint public report phải có biện pháp rate-limit/abuse protection phù hợp trước production.

---

## 8. Constraints

### 8.1 Existing Technical / Organizational Constraints

**CON-01 — Frontend 3D technology**  
Không gian bảo tàng 3D của MVP phải được xây dựng bằng Three.js/React Three Fiber. WebXR được giữ như extension point cho giai đoạn sau.

**CON-02 — Programming language**  
Frontend React/Vite và backend NestJS phải sử dụng TypeScript; tích hợp Three.js qua React Three Fiber theo frontend README.

**CON-03 — Web-based deployment**  
Visitor phải có thể truy cập hệ thống bằng trình duyệt mà không cần cài app desktop riêng.

**CON-04 — CMS-based content management**  
Nội dung hiện vật phải được quản lý thông qua CMS hoặc hệ thống quản trị nội dung tương đương.

**CON-05 — WebXR extension dependency**  
Nếu immersive XR được bổ sung sau MVP, chức năng đó sẽ phụ thuộc vào WebXR capability của browser, OS và thiết bị. Dependency này không áp dụng cho nghiệm thu MVP desktop/mobile.

---

### 8.2 Project Scope Constraints

**CON-06 — MVP exhibit count**  
MVP phải triển khai tối thiểu 5 hiện vật hoàn chỉnh.

**CON-07 — Fixed museum environment**  
MVP sử dụng một không gian triển lãm được xây dựng trước.

**CON-08 — Single guided tour**  
MVP chỉ yêu cầu một guided tour tuyến tính.

**CON-09 — Supported languages**  
MVP hỗ trợ tiếng Việt và tiếng Anh.

**CON-10 — XR scope**  
Immersive VR và AR đều nằm ngoài phạm vi nghiệm thu MVP hiện tại. MVP chỉ yêu cầu kiến trúc sẵn sàng mở rộng WebXR và capability detection ở mức cơ bản.

---

### 8.3 Administrative Constraints

**CON-11 — RBAC administration**  
MVP triển khai RBAC cho Admin Portal. Ba role mặc định là `admin`, `moderator`, `editor`; hệ thống có mô hình user-role và role-permission để hỗ trợ permission matrix.

**CON-12 — Revision/moderation workflow**  
MVP hỗ trợ Draft Revision → In Review → Publish/Reject. Revision Published là immutable; Draft/In Review mới có thể tồn tại song song với revision đang public. Preview là thao tác đọc revision chưa publish và không tự thay đổi publication.

Workflow tùy biến nhiều tầng ngoài Editor→Moderator/Admin, rollback tự động và approval engine tổng quát nằm ngoài MVP.

### 8.4 Accessibility Constraints

**CON-13 — Accessibility scope**  
WCAG 2.1 AA áp dụng cho giao diện web thuộc MVP. Accessibility bên trong XR tương lai nằm ngoài phạm vi hiện tại.

---

### 8.5 Resource Constraints

**CON-14 — Browser resource limitations**  
Model 3D, texture, audio và tài nguyên phải được tối ưu cho giới hạn tài nguyên của browser.

**CON-15 — Device variation**  
Nghiệm thu hiệu năng phải dựa trên device matrix được xác định.

**CON-16 — API and storage boundary**  
Frontend/CMS chỉ gọi NestJS API và tuyến media do backend quản lý; không truy cập trực tiếp PostgreSQL/Supabase/Storage. API response phải được kiểm tra Zod schema trước khi dùng; public API chỉ đọc nội dung Published, API quản trị yêu cầu xác thực backend.

---

## 9. Assumptions and Dependencies

### 9.1 Assumptions

**ASM-01 — Modern browser**  
Visitor sử dụng trình duyệt hiện đại.

**ASM-02 — JavaScript enabled**  
JavaScript được bật.

**ASM-03 — Network connectivity**  
Visitor có kết nối Internet để tải ứng dụng và tài nguyên chưa cache.

**ASM-04 — Suitable hardware**  
Thiết bị muốn sử dụng 3D phải có khả năng render phù hợp.

**ASM-05 — No mandatory VR hardware for MVP**  
Nhóm không giả định có sẵn VR headset để phát triển hoặc nghiệm thu MVP. Nếu WebXR được đưa vào scope ở giai đoạn sau, thiết bị và môi trường kiểm thử phù hợp phải được bổ sung vào device matrix.

**ASM-06 — Content ownership**  
Admin chịu trách nhiệm về quyền sử dụng model, ảnh, audio và nội dung upload.

**ASM-07 — Prepared assets**  
Model 3D đưa vào hệ thống phải được chuẩn bị ở định dạng/chất lượng phù hợp cho web theo mục 5.2.

**ASM-08 — Initial administrator provisioning**  
Ít nhất một tài khoản `admin` đầu tiên được bootstrap bằng seed/deployment process an toàn; không có public Admin registration. Sau bootstrap, user/role/permission được quản lý qua System Administration theo RBAC.

**ASM-09 — Default administrative roles**  
Môi trường nghiệm thu có ít nhất một tài khoản cho mỗi role mặc định `admin`, `moderator`, `editor` để kiểm tra permission matrix và 401/403.

---

### 9.2 External Dependencies

**DEP-01 — Browser capabilities**  
Khả năng render 3D phụ thuộc vào capability của browser/device.

**DEP-02 — Future WebXR platform**  
WebXR platform chỉ là dependency của future XR extension, không phải dependency bắt buộc để MVP desktop/mobile hoạt động.

**DEP-03 — Content storage**  
Hệ thống phụ thuộc dịch vụ lưu trữ/backend để cung cấp media và metadata.

**DEP-04 — CMS/backend availability**  
Các thao tác quản trị phụ thuộc CMS/backend hoạt động.

**DEP-05 — Network**  
Thời gian tải phụ thuộc một phần vào chất lượng mạng của người dùng.

---

## 10. System Acceptance Criteria

**AC-01 — Public access**  
**Requirements:** FR-01, SR-01.  
Given Visitor chưa đăng nhập, when Visitor truy cập website, then Visitor có thể bắt đầu tham quan mà không cần tạo tài khoản.

**AC-02 — Museum 3D**  
**Requirements:** FR-02, FR-03, FR-04.  
Given thiết bị thuộc device matrix hỗ trợ 3D, when Visitor mở chế độ tham quan, then không gian 3D được hiển thị và Visitor có thể di chuyển/thay đổi góc nhìn.

**AC-03 — Five exhibits**  
**Requirements:** FR-07, BR-06, CON-06.  
Given bộ nội dung nghiệm thu theo mục 2.5 đã được cấu hình, when Visitor tham quan, then ít nhất 5 hiện vật Published có model/hình ảnh thật, hotspot và nội dung/audio/transcript/phụ đề tiếng Việt/Anh được khám phá; các hiện vật Draft không xuất hiện.

**AC-04 — Exhibit information**  
**Requirements:** FR-08, FR-09, FR-10.  
Given Visitor đang trong bảo tàng, when chọn một hiện vật, then hệ thống hiển thị tên/mô tả và hình ảnh nếu có; when đóng bảng bằng control đóng hoặc Esc thuộc MVP, then Visitor tiếp tục tham quan và focus trở lại control đã mở bảng.

**AC-05 — Bilingual content**  
**Requirements:** FR-11, FR-15, FR-43, NFR-50, NFR-51.  
Given Visitor đang xem hiện vật, when chuyển Vietnamese/English, then nội dung được cập nhật theo ngôn ngữ tương ứng.

**AC-06 — Hotspot interaction**  
**Requirements:** FR-13, FR-14, FR-15, FR-16, FR-17.  
Given hiện vật Published có hotspot hợp lệ, when Visitor chọn hotspot, then hệ thống hiển thị đúng nội dung của hotspot thuộc hiện vật đó bằng ngôn ngữ hiện tại; hotspot không có trạng thái xuất bản riêng và đi theo trạng thái hiện vật.

**AC-07 — Audio guide**  
**Requirements:** FR-18, FR-19, FR-20.  
Given hiện vật có audio theo ngôn ngữ hiện tại, when Visitor nhấn Play, then audio được phát và có playback controls.

**AC-08 — Missing audio fallback**  
**Requirements:** FR-21, FR-87, NFR-32, NFR-51.  
Given hiện vật thiếu audio theo ngôn ngữ hiện tại hoặc file audio tải lỗi, when Visitor xem hiện vật/thử phát, then tên/mô tả và transcript đã có vẫn truy cập được; hệ thống thông báo audio không khả dụng, không tự phát audio ngôn ngữ khác.

**AC-09 — Guided tour start**  
**Requirements:** FR-23, FR-25.  
Given Visitor đang tham quan, when chọn Start Tour, then guided tour bắt đầu ở bước đầu tiên.

**AC-10 — Guided tour sequence**  
**Requirements:** FR-24, FR-25, FR-26, FR-27.  
Given Visitor đang trong tour, when dùng Next/Previous, then hệ thống chuyển đúng bước theo thứ tự và cập nhật tiến trình; Previous không chuyển trước bước đầu, Next không vượt qua bước cuối. Trong Manual, chuyển bước chỉ cung cấp chỉ dẫn, không ép Visitor teleport.

**AC-11 — Tour navigation assistance**  
**Requirements:** FR-28, FR-29.  
Given có hiện vật kế tiếp trong tour 3D, when bước đó được chọn và Visitor dùng Teleport, then hệ thống hiển thị chỉ dẫn và chuyển tới điểm xem gần hiện vật không nằm trong vật thể; 2D hiển thị nội dung bước tương ứng.

**AC-12 — Tour completion**  
**Requirements:** FR-30, FR-31, FR-98.  
Given Visitor ở hiện vật cuối, when hoàn thành bước cuối, then hệ thống thông báo hoàn tất và cho phép khám phá tự do.

**AC-13 — WebXR capability detection**  
**Requirements:** FR-32.  
Given browser có hoặc không có WebXR capability, when ứng dụng thực hiện capability detection, then hệ thống nhận biết được trạng thái capability mà không làm ảnh hưởng tới luồng 3D/2D của MVP. Không yêu cầu khởi tạo immersive VR session hoặc headset thật.

**AC-14 — Core experience independent of WebXR**  
**Requirements:** FR-39, SR-10, CON-10.  
Given browser không hỗ trợ WebXR nhưng hỗ trợ 3D, when tải ứng dụng, then Visitor vẫn sử dụng đầy đủ trải nghiệm 3D của MVP; việc thiếu WebXR không tạo lỗi hoặc chặn chức năng cốt lõi.

**AC-15 — 2D fallback**  
**Requirements:** FR-40, FR-41, FR-42, FR-43, FR-88.  
Given API nội dung hoạt động và 3D không khả dụng hoặc Visitor chọn 2D, when mở fallback, then Visitor truy cập được danh sách Published, tên/mô tả, hình ảnh nếu có, hotspot dạng văn bản, audio/transcript/phụ đề nếu có và đổi ngôn ngữ. Nếu API lỗi, hệ thống hiển thị trạng thái lỗi theo AC-40, không suy ra fallback 2D tự có nội dung.

**AC-16 — Administrative authentication**  
**Requirements:** FR-44, FR-45, FR-46, BR-02, ASM-08, ASM-09.  
Given tài khoản `admin`, `moderator` hoặc `editor` hợp lệ, when nhập đúng email/password, then user được vào Admin Portal với capability phản ánh permission của mình. Credential sai hoặc user disabled/deleted bị từ chối.

**AC-17 — Unauthorized and forbidden Admin access**  
**Requirements:** FR-48, FR-99, NFR-16, NFR-20, CON-11, CON-16.  
Given request chưa xác thực, when gọi protected API, then backend trả `401`. Given user đã xác thực nhưng thiếu permission, when gọi trực tiếp cùng API, then backend trả `403`. Cả hai trường hợp đều không thay đổi dữ liệu kể cả khi bỏ qua frontend.

**AC-18 — Create Draft Revision**  
**Requirements:** FR-49, FR-50, FR-67, FR-68, FR-90.  
Given Editor/Admin có permission biên tập, when tạo Exhibit/Draft Revision và Save với dữ liệu đúng kiểu nhưng chưa đủ điều kiện Publish, then revision được lưu trong CMS và không được API public trả về.

**AC-19 — Draft Preview**  
**Requirements:** FR-69, FR-70, FR-71.  
Given hiện vật là Draft đã lưu, when Admin chọn Preview, then Admin xem được transform, hotspot, nội dung song ngữ và media đã gắn; model còn thiếu được hiển thị bằng placeholder. Preview không đổi trạng thái hoặc làm dữ liệu công khai.

**AC-20 — Publish reviewed revision**  
**Requirements:** FR-72, FR-73, FR-109, FR-110, BR-26.  
Given revision hợp lệ đã được submit review và user có permission publish, when Moderator/Admin chọn Publish, then revision đó trở thành revision public hiện hành atomically; request public mới nhận nội dung mới.

**AC-21 — Publish validation**  
**Requirements:** FR-90, FR-91, NFR-18, NFR-51.  
Given Draft thiếu một trong các trường bắt buộc hoặc quan hệ/media/transform không hợp lệ theo mục 5.2, when Admin Publish, then backend từ chối, trạng thái vẫn là Draft và CMS chỉ rõ lỗi. Kiểm tra ít nhất tên/mô tả thiếu một ngôn ngữ, audio thiếu transcript/phụ đề, scale không dương và media sai loại; Save Draft được phép thiếu nội dung nhưng không được lưu giá trị sai kiểu/giới hạn.

**AC-22 — Hide / Unpublish**  
**Requirements:** FR-74, FR-75, BR-22, NFR-12.  
Given Exhibit đang public, when Moderator/Admin có permission Hide/Unpublish và backend xác nhận thành công, then Exhibit không còn xuất hiện trong request public mới; lịch sử revision vẫn được giữ.

**AC-23 — 3D placement**  
**Requirements:** FR-58, FR-59, FR-60, FR-61.  
Given hiện vật Draft, when Admin lưu Position/Rotation/Scale hợp lệ rồi Publish, then hiện vật hiển thị đúng tọa độ mét, góc radian Euler XYZ và scale đã lưu mà không sửa source code. Kiểm tra Preview và public với transform khác mặc định.

**AC-24 — Hotspot management**  
**Requirements:** FR-62, FR-63, FR-64, FR-65, FR-66.  
Given hiện vật Draft, when Admin thêm/sửa/xóa hotspot và lưu, then Preview phản ánh đúng nội dung/vị trí local và public chưa nhận thay đổi; sau Publish, request public mới phản ánh đúng. Hotspot thiếu một ngôn ngữ bị chặn Publish, hotspot đã xóa không còn xuất hiện.

**AC-25 — Tour management**  
**Requirements:** FR-76, FR-77, FR-78, FR-79.  
Given Admin xem cấu hình tour, when thay đổi và lưu thứ tự các ID hiện vật hợp lệ, then các phiên tour mới dùng thứ tự đã lưu sau khi loại Draft; danh sách có ID trùng hoặc không tồn tại phải bị từ chối.

**AC-26 — Accessibility**  
**Requirements:** FR-80, FR-81, FR-82, FR-84, FR-85, NFR-27 → NFR-33.  
Given giao diện public/CMS thuộc MVP, when kiểm tra checklist WCAG 2.1 A/AA bằng công cụ và thủ công, then các tiêu chí áp dụng phải đạt và có bằng chứng. Tối thiểu kiểm tra keyboard-only, focus/không kẹt focus, screen reader, alt/label, contrast, zoom 200% và nội dung không phụ thuộc canvas; transcript/phụ đề và reduced motion kiểm chứng thêm ở AC-42/AC-43.

**AC-27 — Performance**  
**Requirements:** NFR-01 → NFR-04, NFR-06, NFR-07, NFR-48.  
Given production build, device matrix và điều kiện đo đã được phê duyệt trong Test/Performance Plan, when thực hiện performance audit, then:
- trang public ban đầu có thể tương tác trong ≤ 5 giây;
- tài nguyên từ navigation đến khi scene 3D sẵn sàng có transfer size ≤ 20 MB;
- FPS thuộc MVP đạt ≥ 30 trong kịch bản tham quan chuẩn trên thiết bị hỗ trợ 3D;
- UI response p95 ≤ 500 ms;
- thời gian scene sẵn sàng, tải media, cấu hình máy/mạng, mức chất lượng và manifest asset được báo cáo riêng trong performance audit.

**AC-28 — Model failure**  
**Requirements:** FR-86, NFR-11.  
Given model thiếu hoặc không tải được nhưng API nội dung hoạt động, when mở hiện vật, then hệ thống dùng placeholder trong scene, thông báo khi tải lỗi và vẫn cho phép mở nội dung văn bản.

**AC-29 — Reserved for future WebXR failure acceptance**  
Không áp dụng cho MVP hiện tại. Acceptance criterion này chỉ được kích hoạt khi immersive WebXR được đưa vào scope triển khai.

**AC-30 — CMS-driven revision update**  
**Requirements:** BR-19, BR-21, FR-51, FR-73, FR-109, FR-110, NFR-40.  
Given Editor tạo/sửa Draft Revision mới trong CMS và Moderator/Admin Publish thành công, when mở request public mới, then frontend dùng revision mới mà không cần developer sửa/build lại source; revision cũ không bị sửa tại chỗ.

**AC-31 — WebXR extension readiness**  
**Requirements:** FR-32, NFR-36, CON-10.  
Given codebase MVP đã hoàn thành, when review kiến trúc/frontend boundary, then không có dependency bắt buộc khiến 3D/2D phải chạy qua WebXR và capability detection được cô lập đủ để bổ sung XR sau này. Không yêu cầu headset hoặc VR performance evidence.

**AC-32 — Media management**  
**Requirements:** FR-55, FR-56, FR-57, FR-90, NFR-19.  
Given Admin đang sửa Draft, when upload/gắn/thay/tháo image, model và audio `vi`/`en` hợp lệ, then Save và tải lại CMS giữ đúng tham chiếu; Preview sử dụng media mới và public chỉ sử dụng sau Publish. Tháo media không tự xóa file dùng chung hoặc làm hỏng hiện vật khác.

**AC-33 — Invalid uploads**  
**Requirements:** FR-90, FR-91, NFR-19.  
Given file sai định dạng, nội dung không parse/decode được, MIME giả, dung lượng vượt giới hạn hoặc phụ đề có cue sai thời gian theo mục 5.2, when upload/Publish, then backend từ chối tương ứng, chỉ rõ lỗi và không thay thế media hợp lệ đang dùng. Kiểm tra trực tiếp API ngoài form frontend.

**AC-34 — CMS bilingual content**  
**Requirements:** FR-53, FR-54, FR-66, NFR-49.  
Given Admin sửa Draft, when nhập tên/mô tả/hotspot có dấu tiếng Việt và tiếng Anh rồi lưu/tải lại, then dữ liệu UTF-8 được giữ chính xác, Preview đổi ngôn ngữ đúng; thiếu một bản dịch bắt buộc thì Save Draft được phép nhưng Publish bị chặn.

**AC-35 — Published revision immutability**  
**Requirements:** FR-51, BR-21, CON-12.  
Given revision đang Published, when Editor/Admin thử sửa trực tiếp content/hotspot hoặc overwrite media của chính revision đó, then backend từ chối. Hệ thống cho phép tạo/chỉnh Draft Revision mới trong khi revision Published cũ tiếp tục public cho tới khi revision mới được Publish hoặc Exhibit bị Hide/Unpublish.

**AC-36 — Draft API protection**  
**Requirements:** FR-68, FR-69, BR-04, BR-05.  
Given hiện vật Draft có ID đã biết, when người chưa xác thực truy vấn API public theo ID, danh sách phòng, API Preview hoặc media chỉ gắn với Draft, then phản hồi không chứa dữ liệu Draft/hotspot và từ chối Preview/media riêng của Draft. Admin có phiên hợp lệ được đọc Preview; media dùng chung với Published vẫn được công khai, public không nhận Draft kể cả frontend bị bỏ qua.

**AC-37 — Safe deletion**  
**Requirements:** FR-52, FR-64, BR-20, NFR-26.  
Given Draft Revision đủ điều kiện xóa, when user hủy xác nhận, then không có dữ liệu thay đổi; when user có permission xác nhận và backend báo thành công, then revision/hotspot liên quan được xử lý nhất quán. Media dùng chung và revision Published không bị xóa ngoài workflow cho phép.

**AC-38 — Logout, token expiry and refresh revocation**  
**Requirements:** FR-46, FR-47, NFR-17.  
Given user có access/refresh credential hợp lệ, when access token hết hạn, frontend chỉ tiếp tục sau refresh hợp lệ. When logout hoặc refresh-token reuse bị phát hiện, refresh session/family tương ứng bị revoke và credential cũ không thể tiếp tục cấp access token mới. User disabled/deleted bị từ chối login/refresh. Frontend không lưu password/raw refresh token vào client storage.

**AC-39 — Audio playback controls**  
**Requirements:** FR-18, FR-19, FR-20, FR-22.  
Given audio đã tải, when Visitor Play/Pause/Resume/Stop hoặc đổi volume, then playback phản ánh đúng thao tác; Stop đưa về đầu audio. Phát audio khác phải dừng/tạm dừng audio cũ; đổi ngôn ngữ dừng audio cũ và chỉ phát audio ngôn ngữ mới sau thao tác của Visitor hoặc Auto đã được cho phép.

**AC-40 — Content API errors**  
**Requirements:** FR-92, CON-16, NFR-47.  
Given API trả lỗi, không phản hồi trong 15 giây hoặc trả sai schema, when ứng dụng tải nội dung, then trạng thái loading kết thúc bằng thông báo lỗi và nút thử lại; không dùng dữ liệu chưa kiểm tra hoặc tạo nội dung giả. Khi API phục hồi và Visitor thử lại, nội dung hợp lệ được tải mà không cần reload toàn trang.

**AC-41 — CMS operation failures**  
**Requirements:** FR-93, NFR-13, NFR-19, NFR-25.  
Given form đã nhập dữ liệu, when Save/Publish/Upload lỗi hoặc phản hồi bị mất, then CMS giữ nội dung đang nhập trong tab, hiển thị thất bại/trạng thái chưa xác định và không báo thành công. Sau kiểm tra trạng thái server, thử lại không tạo hiện vật/upload trùng; media và trạng thái xuất bản đã lưu hợp lệ không bị thay thế bởi kết quả thất bại.

**AC-42 — Transcripts and captions**  
**Requirements:** FR-83, FR-94, NFR-32.  
Given audio tiếng Việt/Anh có transcript và phụ đề, when Visitor bật phụ đề rồi Play/Pause/Resume/Stop audio trong 2D hoặc 3D, then cue hiện tại đúng thời gian/ngôn ngữ; tắt phụ đề không dừng audio. Transcript vẫn đọc được khi audio dừng hoặc tải lỗi; Publish audio thiếu transcript/phụ đề bị chặn.

**AC-43 — Reduced motion**  
**Requirements:** FR-95, NFR-27.  
Given hệ điều hành bật hoặc đổi sang reduced motion trong phiên thuộc MVP, when dùng UI và tour, then animation không thiết yếu/chuyển động camera tự động liên tục bị tắt; teleport/Auto dùng chuyển vị trí tức thời, các chức năng cốt lõi vẫn hoạt động.

**AC-44 — Adaptive 3D quality**  
**Requirements:** FR-96, NFR-03, NFR-11.  
Given scene thuộc MVP đã tải, when hiệu năng duy trì dưới ngưỡng chấp nhận theo Test/Performance Plan, then hệ thống tự động giảm chất lượng rendering không thiết yếu mà không làm mất nội dung hoặc chức năng cốt lõi. Nếu vẫn không đạt ngưỡng ở mức chất lượng thấp nhất, hệ thống thông báo và cung cấp lựa chọn chuyển sang 2D. Ghi bằng chứng mức chất lượng trước/sau.

**AC-45 — Media rights metadata**  
**Requirements:** FR-97, ASM-06.  
Given Draft dùng media, when thiếu nguồn/tác giả/giấy phép hoặc căn cứ quyền sử dụng và Admin Publish, then backend từ chối; sau khi bổ sung và Publish, các thông tin ghi công/giấy phép phải công khai truy cập được ở 2D và 3D.

**AC-46 — Automatic and manual tour**  
**Requirements:** FR-23 → FR-31, FR-98.  
Given tour có nhiều hiện vật, when Visitor chọn Auto và cho phép audio, then tour lần lượt chuyển điểm xem/nội dung, phát audio rồi chuyển bước khi audio kết thúc; không có audio/audio lỗi thì chờ 15 giây. Playback bị chặn phải tạm dừng chờ Play/Next. Kiểm tra Pause/Resume giữ bước/bộ đếm, Next/Previous chuyển về Manual và Exit dừng audio/tự chuyển bước. Manual không tự chuyển bước. Hành vi XR không thuộc AC của MVP.

**AC-47 — Tour filtering and empty state**  
**Requirements:** FR-17, FR-78, BR-22.  
Given tour có hiện vật vừa Unpublish hoặc xóa, when tải tour public mới, then chỉ các hiện vật Published còn tồn tại được trả về theo thứ tự tương đối đã lưu. Nếu không còn hiện vật, Start Tour bị vô hiệu hóa kèm thông báo; phiên có snapshot cũ được phép giữ dữ liệu đến khi tải lại.

**AC-48 — CMS response time**  
**Requirements:** NFR-05.  
Given điều kiện đo đã được chốt trong Test/Performance Plan, when đo các thao tác List/Save Draft/Publish/Unpublish, then p95 từ gửi request đến xác nhận trên UI ≤ 2 giây; upload/media processing được báo cáo riêng.

**AC-49 — Concurrent API visitors**  
**Requirements:** NFR-08.  
Given cấu hình triển khai, bộ dữ liệu và Load Test Plan đã được ghi nhận, when chạy workload với 100 phiên Visitor đồng thời, then request nội dung hợp lệ không phát sinh lỗi chức năng, trả đúng schema và đạt p95 đã quy định. Báo cáo tải API không được dùng làm bằng chứng FPS hoặc tải media client.

**AC-50 — Compatibility matrix**  
**Requirements:** NFR-34, NFR-35, NFR-37, NFR-38, NFR-46, CON-15.  
Given device matrix đã chốt model/version, when chạy flow public chính trên Chrome/Edge/Firefox desktop, Chrome Android, Safari iOS và cấu hình không WebGL, then mỗi nhóm đạt chức năng/fallback tương ứng. Ghi ngày, browser/version, thiết bị, chế độ mạng và bằng chứng; xoay màn hình/resize không làm mất control cốt lõi.

**AC-51 — Public request freshness**  
**Requirements:** FR-73, FR-75, BR-22, NFR-12.  
Given cache đã được làm nóng, when Publish/Unpublish/xóa thành công rồi gửi request public mới, then kết quả đúng trạng thái mới, không lộ Draft hoặc bản đã bị loại khỏi public. Phiên đã tải snapshot không phải thay đổi realtime; tải lại phải nhận kết quả mới.

**AC-52 — Navigation, return and exit**  
**Requirements:** FR-03, FR-04, FR-05, FR-06.  
Given Visitor đang ở 3D desktop/mobile, when dùng keyboard/mouse hoặc touch controls theo device matrix, then di chuyển/xoay nhìn/chọn hiện vật hoạt động. Return đưa về điểm bắt đầu; Exit 3D đưa về giao diện web, không khóa input hoặc để tour/audio tiếp tục tự chạy.

**AC-53 — Language preference persistence**  
**Requirements:** FR-12, NFR-49 → NFR-51.  
Given Visitor chọn English hoặc Vietnamese, when đổi hiện vật hoặc chuyển giữa 2D/3D trong cùng phiên, then lựa chọn ngôn ngữ được giữ; nội dung tùy chọn thiếu bản dịch được fallback theo NFR-51.

**AC-54 — Persisted CMS data**  
**Requirements:** NFR-13, FR-67, FR-77.  
Given Admin đã Save Draft hoặc lưu cấu hình tour và backend xác nhận thành công, when Admin logout/đăng nhập lại hoặc backend restart, then dữ liệu đã xác nhận lưu vẫn tồn tại và giữ đúng giá trị.

---

**AC-55 — Default RBAC roles**  
**Requirements:** FR-99, CON-11, ASM-09.  
Given seed/deployment hoàn tất, when kiểm tra role mặc định, then tồn tại `admin`, `moderator`, `editor` với permission matrix được cấu hình; API authorization sử dụng permission chứ không chỉ tên role.

**AC-56 — Permission enforcement**  
**Requirements:** FR-99, FR-103 → FR-105, BR-23, BR-24, NFR-55.  
Given Editor thiếu `user:create`, when gọi trực tiếp API tạo user, then backend trả `403` và không tạo dữ liệu. Given Admin có permission tương ứng, cùng operation thành công.

**AC-57 — Administrative user management**  
**Requirements:** FR-100 → FR-103.  
Given Admin có permission quản lý user, when tạo user mới, gán role và sau đó disable user, then dữ liệu được lưu đúng; user disabled không login/refresh được và passwordHash không xuất hiện trong response.

**AC-58 — Role and permission matrix**  
**Requirements:** FR-104, FR-105.  
Given Admin có permission quản lý RBAC, when cập nhật permission matrix của một role bằng tập permission hợp lệ, then đọc lại phản ánh đúng tập mới; code permission không tồn tại bị từ chối.

**AC-59 — Revision moderation**  
**Requirements:** FR-109, FR-110, BR-26, CON-12.  
Given Editor submit một Draft Revision hợp lệ, when Moderator Reject, then revision không public và lưu feedback; when revision hợp lệ được Publish, then nó trở thành revision public hiện hành.

**AC-60 — Revision history preservation**  
**Requirements:** FR-111, BR-21.  
Given Exhibit đã có revision Published và Editor tạo revision mới, when xem lịch sử, then revision cũ vẫn truy vết được; sửa Draft mới không mutate snapshot Published trước đó.

**AC-61 — Audit trail**  
**Requirements:** FR-106, FR-107, BR-25, NFR-56.  
Given hành động quản trị được audit thành công, when user có `audit:read` lọc theo actor/action/resource/thời gian, then bản ghi tương ứng xuất hiện. API không cung cấp chức năng sửa/xóa Audit Log qua CMS và log không chứa password/token plaintext.

**AC-62 — Room metadata management**  
**Requirements:** FR-108, BR-07.  
Given user có permission room management, when CRUD metadata phòng hợp lệ, then API/CMS phản ánh thay đổi; thao tác này không chỉnh mesh/geometry/layout 3D của không gian cố định.

**AC-63 — Visitor content report**  
**Requirements:** FR-112, BR-27, NFR-57.  
Given Visitor đang xem nội dung public, when gửi report hợp lệ, then hệ thống ghi nhận report mà không yêu cầu Visitor account và không tự Hide/Unpublish content.

**AC-64 — Report moderation**  
**Requirements:** FR-113, BR-27.  
Given Moderator/Admin có permission xử lý report, when resolve/dismiss report, then trạng thái report được cập nhật và hành động được audit theo policy; user thiếu permission bị `403`.

---

## 11. Requirement Traceability Matrix

### 11.1 Traceability Strategy

```text
Stakeholder Requirement
        |
        v
Functional / Non-functional Requirement
        |
        v
Use Case / User Story
        |
        v
Test Case
        |
        v
Acceptance Result
```

---

### 11.2 High-Level Traceability

| Stakeholder Requirement | Related Requirements | Acceptance Criteria |
|---|---|---|
| SR-01 Access without account | FR-01 | AC-01 |
| SR-02 Explore museum | FR-02 → FR-06, FR-96 | AC-02, AC-44, AC-52 |
| SR-03 View exhibit | FR-07 → FR-12 | AC-03, AC-04, AC-05, AC-53 |
| SR-04 Interact with exhibits | FR-13 → FR-17 | AC-06, AC-47 |
| SR-05 Audio guide | FR-18 → FR-22, FR-83, FR-94 | AC-07, AC-08, AC-39, AC-42 |
| SR-06 Language selection | FR-11, FR-12, FR-43 | AC-05, AC-15, AC-53 |
| SR-07 Guided tour | FR-23 → FR-31, FR-98 | AC-09 → AC-12, AC-46, AC-47 |
| SR-08 Navigation assistance | FR-28, FR-29 | AC-11 |
| SR-09 WebXR extension readiness | FR-32 | AC-13, AC-31 |
| SR-10 Core experience without XR | FR-39 | AC-14 |
| SR-11 Accessible alternative | FR-40 → FR-43, FR-80 → FR-85, FR-94, FR-95 | AC-15, AC-26, AC-42, AC-43 |
| SR-12 Secure admin access | FR-44 → FR-48, FR-68 | AC-16, AC-17, AC-36, AC-38 |
| SR-13 Manage exhibit | FR-49 → FR-57 | AC-18, AC-30, AC-32, AC-34, AC-35, AC-37 |
| SR-14 Multilingual content | FR-53, FR-54, FR-66 | AC-24, AC-34 |
| SR-15 Manage media | FR-55 → FR-57, FR-97 | AC-32, AC-33, AC-45 |
| SR-16 Placement | FR-58 → FR-61 | AC-23 |
| SR-17 Hotspot management | FR-62 → FR-66 | AC-24 |
| SR-18 Publication state | FR-67 → FR-75 | AC-18 → AC-22, AC-35, AC-36, AC-51 |
| SR-19 Draft preview | FR-69 → FR-71 | AC-19 |
| SR-20 Tour management | FR-76 → FR-79 | AC-25, AC-47, AC-54 |
| SR-21 Manage administrative users | FR-100 → FR-103 | AC-57 |
| SR-22 Manage roles and permissions | FR-99, FR-103 → FR-105 | AC-55, AC-56, AC-58 |
| SR-23 Review content revisions | FR-109 → FR-111 | AC-20, AC-59, AC-60 |
| SR-24 Audit administrative actions | FR-106, FR-107 | AC-61 |
| SR-25 Manage room metadata | FR-108 | AC-62 |
| SR-26 Handle content reports | FR-112, FR-113 | AC-63, AC-64 |

---

### 11.3 NFR Traceability Examples

| Quality Goal | NFR | Verification |
|---|---|---|
| Fast initial experience / asset budget | NFR-01, NFR-02, NFR-06, NFR-07 | AC-27; performance audit |
| Smooth 3D / UI response | NFR-03, NFR-04 | AC-27, AC-44; FPS/frametime/input measurement |
| CMS response / concurrency | NFR-05, NFR-08 | AC-48, AC-49; timing/load test |
| Availability | NFR-10 | Báo cáo probe trong 30 ngày theo NFR-10; mục tiêu vận hành sau triển khai |
| Content consistency / persistence | NFR-12, NFR-13 | AC-41, AC-51, AC-54 |
| Secure CMS / RBAC | NFR-14 → NFR-21, NFR-55, NFR-57 | AC-16, AC-17, AC-38, AC-55 → AC-58; kiểm tra HTTPS, password hashing, token lifecycle và permission enforcement |
| Accessible UI | NFR-27 → NFR-33 | AC-26, AC-42, AC-43; WCAG checklist/manual test |
| Cross-device usage | NFR-34, NFR-35, NFR-37, NFR-38 | AC-50; device matrix test |
| WebXR extension readiness | NFR-36, FR-32 | AC-13, AC-31; capability test/architecture review, không nghiệm thu headset |
| Maintainable content | NFR-39 → NFR-43 | Architecture/code review |
| Reliable fallback | NFR-11, NFR-47 | AC-08, AC-13, AC-14, AC-15, AC-28, AC-40, AC-41 |
| Vietnamese/English | NFR-49 → NFR-51 | AC-05, AC-34, AC-53; localization test |
| Privacy | NFR-52 → NFR-54 | Review dữ liệu/request/client storage; xác nhận không thu dữ liệu Visitor bắt buộc hoặc lộ credential |
| Audit integrity | NFR-56 | AC-61; review append-only behavior và secret redaction |

### 11.4 Cross-Cutting Requirements

| Concern | Related Requirements | Acceptance Criteria |
|---|---|---|
| Asset/rendering errors | FR-86 → FR-88 | AC-08, AC-15, AC-28 |
| CMS validation / failed operations | FR-90, FR-91, FR-93 | AC-21, AC-33, AC-41 |
| API trust boundary | FR-92, CON-16 | AC-17, AC-36, AC-40 |
| RBAC / System Administration | FR-99 → FR-107, CON-11 | AC-55 → AC-58, AC-61 |
| Revision governance | FR-109 → FR-111, CON-12 | AC-20, AC-35, AC-59, AC-60 |
| Content reports | FR-112, FR-113 | AC-63, AC-64 |

Bảng trên và mục 11.2 ánh xạ các nhóm requirement chính của MVP tới AC, bao gồm phần System Administration/RBAC/Governance mới ở FR-99 → FR-113; `FR-33` → `FR-38`, `FR-89` và `AC-29` vẫn reserved cho XR tương lai. Bảng không thay thế test case chi tiết. Mỗi test case phải ghi mã FR/NFR/AC liên quan, thiết bị/môi trường, ngày chạy, kết quả và bằng chứng. Các NFR chưa có AC riêng vẫn phải có bước kiểm chứng phù hợp, như review kiến trúc hoặc checklist bảo mật; không được suy ra đạt chỉ từ chức năng hoạt động.

---

## 12. Out of Scope

Các chức năng sau không thuộc MVP:

- Augmented Reality;
- Visitor account;
- social login;
- favorite exhibit;
- visit history;
- lưu tiến trình tour giữa nhiều phiên;
- recommendation engine;
- AI chatbot/AI guide;
- nhiều guided tour;
- multiplayer;
- realtime visitor interaction;
- payment;
- ticketing;
- e-commerce;
- workflow approval tùy biến nhiều tầng ngoài `Editor → Moderator/Admin`;
- Curator role riêng ngoài ba role mặc định;
- Super Admin role riêng ngoài `admin`;
- rollback content tự động;
- chỉnh sửa trực tiếp revision đã Published;
- 3D room geometry/mesh/layout editor;
- tự động tạo model 3D;
- chỉnh sửa mesh/model hiện vật trực tiếp trong CMS;
- immersive VR/headset implementation và nghiệm thu trong MVP hiện tại;
- full WCAG compliance bên trong immersive XR tương lai;
- partner API key/scopes;
- analytics retention subsystem;
- bulk import/export và ngôn ngữ ngoài vi/en nếu chưa được Change Request đưa vào MVP.

## 13. Requirement Prioritization

Mọi FR/BR/CON/NFR có từ “phải” và đang áp dụng cho MVP thuộc Must Have. Các mã reserved/future extension không thuộc nghiệm thu MVP. Các ngưỡng định lượng áp dụng theo mục 5.2 và 7.0; thay đổi auth/media/performance target sau baseline phải truy vết qua Change Request.

### Must Have

- Museum 3D;
- tối thiểu 5 exhibits;
- navigation desktop/mobile;
- exhibit information;
- hotspot;
- Vietnamese/English;
- audio guide, transcript và captions;
- guided tour Manual/Auto, chỉ dẫn và teleport;
- WebXR capability detection ở mức extension readiness;
- progressive fallback 3D → 2D;
- reduced motion và adaptive 3D quality;
- schema validation, xử lý lỗi API/CMS và giới hạn upload;
- metadata quyền sử dụng media;
- Admin authentication;
- RBAC server-side;
- default roles `admin` / `moderator` / `editor`;
- user management;
- role management;
- permission matrix;
- audit log;
- room metadata management;
- exhibit/revision management;
- Draft Revision + Preview;
- submit/review/publish/reject revision;
- Published revision immutability;
- hotspot/media/transform management;
- guided-tour configuration;
- Visitor content report + report moderation;
- public freshness sau publish/hide/unpublish.

### Should Have

- feedback loading chi tiết theo tiến độ từng asset, ngoài trạng thái loading/error bắt buộc;
- dashboard thống kê phong phú ngoài số liệu tối thiểu cần điều hướng;
- tinh chỉnh mobile controls vượt ngoài khả năng di chuyển/chọn hiện vật bắt buộc.

### Could Have

- richer animations;
- environmental audio;
- exhibit search;
- minimap.

### Won't Have in MVP

- AR;
- visitor account;
- AI guide;
- payment;
- multiplayer;
- multiple tours;
- arbitrary multi-stage approval workflow;
- automatic rollback;
- 3D room geometry editor;
- immersive headset VR implementation.

### Future Enhancements — Outside MVP

- Immersive WebXR/VR trên headset thật.
- Nhiều guided tour.
- Partner API key/scopes và analytics.
- Bulk import/export.
- Locale ngoài tiếng Việt/Anh.
- Workflow governance nhiều tầng hơn.

## 14. Definition of MVP Completion

MVP được coi là hoàn thành khi:

1. Có một không gian bảo tàng 3D hoàn chỉnh trên desktop/mobile.
2. Có tối thiểu 5 hiện vật Published đáp ứng bộ asset nghiệm thu.
3. Visitor truy cập không cần account và có 2D fallback.
4. Có hotspot, audio, transcript, captions và nội dung vi/en.
5. Guided Tour tuyến tính hỗ trợ Manual/Auto, Pause/Resume, chỉ dẫn và teleport.
6. Core MVP hoạt động độc lập WebXR; capability detection không làm lỗi 2D/3D.
7. Admin Portal có authentication và RBAC server-side.
8. Có ít nhất một tài khoản nghiệm thu cho mỗi role mặc định `admin`, `moderator`, `editor`.
9. Admin có thể quản lý user/role/permission matrix theo permission.
10. Audit Log ghi được các hành động quản trị bắt buộc và xem/lọc được theo permission.
11. CMS hỗ trợ room metadata, Exhibit/Revision, Position/Rotation/Scale, hotspot, media và tour.
12. Editor có thể Save Draft Revision, Preview và Submit Review.
13. Moderator/Admin có thể Review, Publish hoặc Reject revision.
14. Revision Published không bị sửa tại chỗ; revision history vẫn truy vết được.
15. Public API/media không lộ Draft/In Review/Rejected revision.
16. Publish/Hide/Unpublish có hiệu lực với request public mới theo BR-22.
17. Visitor có thể gửi Content Report; Moderator/Admin có thể xử lý theo permission.
18. Media validation/rights metadata, error handling, idempotency/concurrency và persistence đạt AC liên quan.
19. Public-facing UI đạt phạm vi WCAG 2.1 A/AA đã xác định; CMS đạt accessibility cơ bản theo BR-18.
20. Performance audit, compatibility, fallback, load, security/RBAC và E2E acceptance chính có bằng chứng truy vết FR/NFR/AC.
