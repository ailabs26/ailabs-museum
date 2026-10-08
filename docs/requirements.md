# Aura Museum — WebXR Interactive Museum Software Requirements Specification

**Document:** `requirements.md`  
**Project:** Aura Museum — WebXR Interactive Museum  
**Vietnamese name:** Bảo tàng WebXR có hướng dẫn tương tác  
**Version:** v0.1  
**Status:** Initial Baseline  
**Date:** 2026-10-08  
**Repository path:** `/docs/requirements.md`  

---

## 1. Introduction

### 1.1 Purpose

Tài liệu Software Requirements Specification (SRS) này mô tả các yêu cầu của hệ thống **Aura Museum — WebXR Interactive Museum**.

Các nội dung dưới đây là yêu cầu của sản phẩm mục tiêu, không phải báo cáo tính năng đã triển khai hoặc kết quả kiểm thử. Tài liệu được chốt làm bản yêu cầu đầu tiên v0.1, dùng làm cơ sở thiết kế và phát triển; khi cần, yêu cầu sẽ được cập nhật ở phiên bản tiếp theo và truy vết qua Git/PR.

Hệ thống cung cấp một môi trường bảo tàng số trên nền web, cho phép Visitor:

- tham quan không gian bảo tàng 3D;
- khám phá hiện vật;
- xem thông tin chi tiết;
- tương tác với hotspot;
- nghe audio guide;
- tham gia guided tour;
- sử dụng giao diện 2D fallback khi trải nghiệm 3D không khả dụng;
- sẵn sàng mở rộng WebXR trong tương lai mà không xem immersive VR/headset là điều kiện nghiệm thu của MVP hiện tại.

Hệ thống đồng thời cung cấp CMS cho Admin để quản lý nội dung triển lãm mà không cần chỉnh sửa source code frontend đối với các thay đổi nội dung thông thường.

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

Hệ thống gồm hai khu vực chính:

#### Public Museum

Dành cho Visitor, bao gồm:

- trải nghiệm bảo tàng 3D;
- xem hiện vật;
- hotspot;
- audio guide;
- guided tour;
- giao diện 2D fallback;
- WebXR extension point cho giai đoạn sau MVP.

#### Content Management System

Dành cho Admin, bao gồm:

- quản lý hiện vật;
- quản lý nội dung song ngữ;
- quản lý model 3D;
- quản lý image/audio;
- quản lý hotspot;
- cấu hình transform;
- Draft;
- Preview;
- Publish/Unpublish;
- cấu hình thứ tự guided tour.

---

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
| WebXR | Web API hỗ trợ trải nghiệm XR trên trình duyệt; trong MVP hiện tại chỉ được xem là extension point, không phải hạng mục nghiệm thu bằng headset |
| VR | Virtual Reality |
| XR | Extended Reality |
| CMS | Content Management System |
| Visitor | Người sử dụng khu vực tham quan công khai |
| Admin | Người quản trị nội dung |
| Exhibit | Hiện vật trong bảo tàng |
| Hotspot | Điểm tương tác gắn với một vị trí trên hiện vật 3D |
| Guided Tour | Chế độ hướng dẫn theo thứ tự định trước, có lựa chọn tự động hoặc điều khiển từng bước |
| Draft | Nội dung chưa được công khai |
| Published | Nội dung đã được công khai |
| Preview | Thao tác cho Admin xem trước Draft; không phải trạng thái xuất bản |
| Transcript | Văn bản đầy đủ tương đương với nội dung audio |
| Captions | Phụ đề đồng bộ theo thời gian của audio, theo ngôn ngữ đang phát |
| Transform | Position, Rotation và Scale của object 3D |
| Fallback | Trải nghiệm thay thế khi capability chính không khả dụng |
| WCAG | Web Content Accessibility Guidelines |
| MVP | Minimum Viable Product |
| FPS | Frames Per Second |

---

### 1.7 References and Document Authority

- [Project README](../README.md): mục tiêu và phạm vi tổng quan của Aura Museum.
- [Repository instructions](../AGENTS.md): quy trình phát triển và ranh giới giao tiếp frontend/backend.
- [Frontend README](../front-end/README.md) và [Backend README](../back-end/README.md): công nghệ, kiến trúc đã chốt và trạng thái triển khai hiện tại.
- [Content schema](../plans/content-schema.md): schema nền tảng hiện có, cần được cập nhật khi thiết kế CMS theo SRS đã duyệt.
- [Device matrix](../plans/device-matrix.md): danh sách nhóm thiết bị và nơi ghi cấu hình kiểm thử thực tế.
- [Fallback tests](../plans/fallback-tests.md): kế hoạch kiểm thử các tình huống không hỗ trợ hoặc gặp lỗi.
- [Performance audit](../plans/performance-audit.md): nơi ghi profile đo và bằng chứng hiệu năng.

SRS v0.1 là nguồn yêu cầu cho phạm vi MVP hiện tại. README và các kế hoạch là tài liệu tham khảo; khi có khác biệt về phạm vi sản phẩm, áp dụng yêu cầu trong SRS này.

---

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
   +-- WebXR Extension Point (future)
   |
   v
Content / API Layer
   |
   +-- Exhibit Data
   +-- Tour Data
   +-- Media Metadata
   |
   v
Database / Asset Storage


Admin
   |
   v
CMS
   |
   v
Content / API Layer
```

Public Museum và CMS sử dụng chung nguồn dữ liệu nội dung đã được quản lý.

---

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
- phát hiện capability WebXR để hỗ trợ mở rộng sau MVP.

#### Admin Functions

- đăng nhập CMS;
- CRUD hiện vật;
- quản lý model 3D;
- quản lý image;
- quản lý audio;
- quản lý nội dung tiếng Việt và tiếng Anh;
- quản lý hotspot;
- cấu hình Position / Rotation / Scale;
- lưu Draft;
- Preview Draft;
- Publish / Unpublish;
- cấu hình thứ tự guided tour.

---

### 2.3 User Classes

#### Visitor

- không yêu cầu tài khoản;
- có thể không có kiến thức kỹ thuật;
- sử dụng desktop hoặc mobile trong phạm vi MVP;
- có thể có nhu cầu accessibility;
- có thể lựa chọn tiếng Việt hoặc tiếng Anh.

#### Admin

- có tài khoản xác thực;
- quản lý nội dung bảo tàng;
- không nhất thiết có kiến thức lập trình;
- sử dụng CMS để quản trị nội dung;
- tất cả Admin trong MVP có cùng quyền.

---

### 2.4 Operating Environment

#### Client

- browser hiện đại trên desktop;
- browser hiện đại trên mobile;
- WebXR-capable environment chỉ phục vụ kiểm tra extension point khi có điều kiện, không bắt buộc headset trong MVP.

#### Server

- web application hosting;
- backend/CMS server;
- database;
- object/media storage.

---

### 2.5 High-level MVP Scope

MVP bao gồm:

- 1 không gian/phòng triển lãm cố định;
- tối thiểu 5 hiện vật;
- Visitor không cần tài khoản;
- nhiều tài khoản Admin, cùng mức quyền;
- desktop/mobile: tham quan 3D;
- WebXR/VR không phải điều kiện nghiệm thu của MVP; chỉ giữ capability detection/extension point;
- hotspot, thông tin và audio;
- tiếng Việt và tiếng Anh;
- một guided tour tuyến tính, có chế độ tự động và điều khiển thủ công;
- chỉ dẫn đường và teleport;
- CMS quản lý nội dung, media, hotspot và transform;
- hai trạng thái Draft / Published và thao tác Preview;
- fallback 3D → 2D;
- accessibility trên giao diện web MVP đáp ứng WCAG 2.1 AA, hỗ trợ transcript, phụ đề và giảm chuyển động.

Bộ nội dung nghiệm thu gồm ít nhất 5 hiện vật Published, mỗi hiện vật có model 3D thật, hình ảnh đại diện, ít nhất một hotspot, nội dung tiếng Việt/Anh và audio kèm transcript/phụ đề cho cả hai ngôn ngữ. Các hiện vật khác có thể thiếu media tùy chọn theo mục 5.2; dữ liệu placeholder hiện có không thay thế bộ nội dung nghiệm thu.

---

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

#### 3.1.7 CMS Interface

CMS phải cung cấp tối thiểu:

- login;
- dashboard/list hiện vật;
- create/edit form;
- media management;
- hotspot management;
- transform configuration;
- Draft/Published status;
- Preview;
- Publish/Unpublish.

---

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

### 4.2 Admin Requirements

**SR-12 — Secure administration access**  
Admin phải đăng nhập trước khi truy cập các chức năng quản trị.

**SR-13 — Manage exhibit content**  
Admin phải có thể tạo, xem, chỉnh sửa và xóa nội dung hiện vật.

**SR-14 — Manage multilingual content**  
Admin phải có thể quản lý nội dung tiếng Việt và tiếng Anh cho từng hiện vật.

**SR-15 — Manage exhibit media**  
Admin phải có thể quản lý model 3D, hình ảnh và audio.

**SR-16 — Configure exhibit placement**  
Admin phải có thể cấu hình vị trí, hướng xoay và kích thước của hiện vật.

**SR-17 — Manage hotspots**  
Admin phải có thể thêm, chỉnh sửa và xóa hotspot.

**SR-18 — Manage publication state**  
Admin phải có thể lưu hiện vật ở trạng thái Draft hoặc Published.

**SR-19 — Preview draft content**  
Admin phải có thể xem trước nội dung Draft trong môi trường 3D trước khi publish.

**SR-20 — Manage guided-tour sequence**  
Admin phải có thể xác định thứ tự các hiện vật trong guided tour.

---

## 5. Business Rules

**BR-01 — Visitor authentication**  
Visitor không cần tài khoản để truy cập bảo tàng.

**BR-02 — Administrative authentication**  
Chỉ người dùng đã xác thực với tài khoản Admin hợp lệ mới được truy cập CMS.

**BR-03 — Equal administrator permissions**  
Tất cả tài khoản Admin trong MVP có cùng mức quyền.

**BR-04 — Publication visibility**  
Visitor chỉ nhìn thấy các hiện vật có trạng thái Published. Backend phải loại Draft khỏi mọi phản hồi public, kể cả truy vấn trực tiếp bằng ID; frontend không được là lớp bảo vệ duy nhất. Dữ liệu Preview và media chỉ gắn với Draft phải yêu cầu phiên Admin hợp lệ; media dùng chung với Published được phép công khai.

**BR-05 — Draft preview**  
Admin được phép xem trước hiện vật Draft; Preview không làm nội dung Draft trở nên công khai.

**BR-06 — Exhibit count**  
MVP phải hỗ trợ tối thiểu 5 hiện vật.

**BR-07 — Fixed museum environment**  
Không gian/phòng bảo tàng được định nghĩa trước; Admin không chỉnh sửa cấu trúc phòng thông qua CMS.

**BR-08 — Exhibit placement**  
Admin được phép cấu hình Position, Rotation và Scale của hiện vật.

**BR-09 — Exhibit language**  
Mỗi hiện vật Published phải có nội dung cơ bản bằng tiếng Việt và tiếng Anh.

**BR-10 — Audio language**  
Audio guide có thể được lưu riêng theo từng ngôn ngữ; có audio thì phải có transcript và phụ đề đồng bộ cùng ngôn ngữ trước khi Publish. Nếu thiếu audio thì vẫn phải có tên và mô tả tương ứng, không tự phát audio của ngôn ngữ khác.

**BR-11 — Hotspot association**  
Mỗi hotspot thuộc đúng một hiện vật; một hiện vật có thể có từ 0 đến nhiều hotspot.

**BR-12 — Hotspot placement**  
Mỗi hotspot phải có thông tin xác định vị trí tương đối với model 3D.

**BR-13 — Guided-tour structure**  
Trong MVP chỉ tồn tại một guided tour chính theo thứ tự tuyến tính.

**BR-14 — Guided-tour navigation**  
Guided tour phải hỗ trợ chỉ dẫn hướng, Next, Previous, Exit Tour và teleport trong 3D. Visitor chọn chế độ Auto hoặc Manual khi bắt đầu; Auto được mô tả tại FR-98. Trong 2D, tour dùng danh sách/nội dung hiện vật, không yêu cầu điều hướng không gian hoặc teleport. Hành vi tour trong XR là future extension.

**BR-15 — WebXR outside MVP acceptance**  
Immersive VR không phải chức năng bắt buộc của MVP và không được dùng làm điều kiện chặn nghiệm thu. Nếu triển khai WebXR ở giai đoạn sau, chức năng XR chỉ được cung cấp khi capability detection xác nhận môi trường hỗ trợ.

**BR-16 — Progressive fallback**  
Trong MVP, hệ thống áp dụng thứ tự trải nghiệm: **Standard 3D → Accessible 2D**. WebXR/VR là extension ngoài MVP và không nằm trong chuỗi fallback bắt buộc.

**BR-17 — Core-content availability**  
Thông tin cốt lõi của hiện vật không được tồn tại độc quyền trong một tương tác 3D hoặc bất kỳ extension XR tương lai nào.

**BR-18 — Accessibility scope**  
Các giao diện public-facing thuộc MVP, bao gồm 2D fallback và các UI điều khiển ngoài canvas 3D, phải đáp ứng phạm vi WCAG 2.1 AA đã xác định. CMS không bắt buộc đạt toàn bộ WCAG 2.1 AA trong MVP nhưng phải hỗ trợ tối thiểu keyboard navigation, visible focus, semantic controls/labels và không tạo keyboard trap. Accessibility bên trong immersive XR tương lai nằm ngoài phạm vi baseline hiện tại.

**BR-19 — Content update independence**  
Admin phải có thể cập nhật nội dung thông thường qua CMS mà không cần sửa hoặc build lại source code frontend.

**BR-20 — Deletion protection**  
Thao tác xóa hiện vật phải có bước xác nhận và chỉ thực hiện khi hiện vật là Draft. Xóa thành công phải xóa hotspot liên quan và loại tham chiếu khỏi tour; không tự xóa media đang được hiện vật khác sử dụng.

**BR-21 — Published content editing**  
Trong MVP, hiện vật Published và các hotspot/media được gắn với nó không được sửa trực tiếp. Admin phải Unpublish trước, chỉnh sửa Draft rồi Publish lại; không duy trì đồng thời bản Published và bản nháp của cùng một hiện vật. Media đang được nội dung Published tham chiếu không được ghi đè hoặc xóa; thay thế media phải tạo tham chiếu mới trên Draft.

**BR-22 — Public session consistency**  
Publish, Unpublish và xóa có hiệu lực với các request public bắt đầu sau khi thao tác được backend xác nhận thành công, kể cả dữ liệu đi qua cache. Phiên tham quan đã tải dữ liệu có thể giữ snapshot đến khi tải lại; MVP không yêu cầu cập nhật realtime. Tour public chỉ chứa các hiện vật Published còn tồn tại theo thứ tự đã lưu; nếu không còn hiện vật, nút Start Tour bị vô hiệu hóa kèm thông báo.

### 5.1 Publication Workflow

```text
Create → Draft → Publish → Published
           ↑                 |
           +--- Unpublish ----+

Draft: Edit / Save / Preview / Delete
Published: View / Unpublish
```

Preview không thay đổi trạng thái, không bắt buộc phải mở trước mỗi lần Publish và chỉ dùng dữ liệu Draft đã lưu thành công. Save Draft không xuất bản nội dung; backend phải từ chối sửa trực tiếp Published. Unpublish làm hiện vật vắng mặt khỏi các request public mới trong thời gian chỉnh sửa; quy trình giữ bản cũ công khai trong lúc sửa nằm ngoài MVP.

### 5.2 Content Validation Rules

> **Engineering target status:** Các giới hạn định lượng trong mục này là mục tiêu kỹ thuật của baseline v0.1, không phải ràng buộc từ bên ngoài trừ khi có nguồn yêu cầu riêng. Chúng được áp dụng cho validation và nghiệm thu theo yêu cầu tương ứng; khi cần điều chỉnh, cập nhật phiên bản tài liệu và ghi lý do/tác động qua Git/PR.

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

> **Reserved IDs:** `FR-33` → `FR-38` được giữ trống trong baseline v0.1 để bảo toàn traceability của các requirement đã đánh số sau đó. Các hành vi immersive VR tương ứng được chuyển sang **Future Enhancements — Outside MVP**.

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

### 6.8 Admin Authentication

**FR-44 — Admin login**  
Admin phải có thể đăng nhập CMS bằng email và mật khẩu hợp lệ.

**FR-45 — Reject invalid login**  
Hệ thống phải từ chối thông tin xác thực không hợp lệ.

**FR-46 — Maintain authenticated session**  
Admin phải có thể sử dụng CMS trong phiên xác thực hợp lệ.

**FR-47 — Admin logout**  
Admin phải có thể đăng xuất khỏi CMS; logout làm phiên backend hết hiệu lực và xóa dữ liệu Draft/Preview khỏi bộ nhớ/cache của giao diện quản trị. Việc giữ form khi phiên tự hết hạn được mô tả tại AC-38.

**FR-48 — Protect CMS functions**  
Người dùng chưa xác thực không được truy cập chức năng quản trị.

---

### 6.9 Exhibit Management

**FR-49 — View exhibit list**  
Admin phải có thể xem danh sách hiện vật trong CMS.

**FR-50 — Create exhibit**  
Admin phải có thể tạo hiện vật mới.

**FR-51 — Edit exhibit**  
Admin phải có thể chỉnh sửa hiện vật Draft. Với Published, CMS hướng dẫn Unpublish trước khi sửa; backend phải từ chối request sửa hiện vật, hotspot hoặc media liên quan nếu bỏ qua bước này.

**FR-52 — Delete exhibit**  
Admin phải có thể xóa hiện vật Draft sau bước xác nhận, với xử lý hotspot, tour và media theo BR-20. Published phải được Unpublish trước khi xóa.

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

### 6.12 Draft, Preview & Publishing

**FR-67 — Save exhibit as Draft**  
Admin phải có thể lưu hiện vật ở trạng thái Draft.

**FR-68 — Exclude Draft from public museum**  
Hiện vật Draft và dữ liệu hotspot của nó không được trả về bởi API public hoặc xuất hiện trong phiên tham quan công khai. API Preview phải yêu cầu xác thực Admin, kể cả khi người gọi biết ID hoặc URL của Draft.

**FR-69 — Preview Draft exhibit**  
Admin phải có thể xem hiện vật Draft trong môi trường 3D Preview.

**FR-70 — Preview configured placement**  
Preview phải hiển thị transform hiện tại của Draft.

**FR-71 — Preview hotspots and media**  
Preview phải cho phép kiểm tra hotspot, nội dung song ngữ và audio.

**FR-72 — Publish exhibit**  
Admin phải có thể chuyển Draft sang Published.

**FR-73 — Make Published content publicly available**  
Sau publish thành công, hiện vật phải trở thành nội dung công khai trong các request mới theo BR-22, không cần sửa hoặc build lại frontend.

**FR-74 — Unpublish exhibit**  
Admin phải có thể chuyển Published trở lại Draft.

**FR-75 — Remove unpublished exhibit from public museum**  
Sau unpublish thành công, hiện vật không được trả về trong request public mới hoặc các phiên công khai mới theo BR-22; phiên đã tải dữ liệu không phải cập nhật realtime.

---

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
Visitor phải có thể chọn Auto / Manual và Pause / Resume. Auto đưa Visitor tới điểm xem hiện vật theo thứ tự đã lưu bằng teleport tức thời, mở nội dung rồi phát audio sau khi Visitor đã cho phép; chuyển bước khi audio kết thúc hoặc sau một **dwell time cấu hình được** nếu không có audio hoặc audio lỗi. Giá trị mặc định trong v0.1 là **15 giây**. Nếu trình duyệt chặn playback, tour phải tạm dừng và chờ Visitor Play hoặc chọn Next. Pause tạm dừng cả bộ đếm và audio; Resume tiếp tục bước hiện tại; Next/Previous hoặc đổi sang Manual dừng bộ đếm và audio của Auto. Exit dừng mọi thao tác tự động và audio của tour. Trong 2D, Auto chuyển nội dung hiện vật thay cho vị trí. Không dùng chuyển động camera liên tục. Hành vi Auto Tour trong XR là future extension.

---

## 7. Non-functional Requirements

### 7.0 Status of Quantitative Targets

Các ngưỡng định lượng trong phần NFR (bao gồm nhưng không giới hạn ở thời gian tải, FPS, response time, asset budget, concurrent visitors, availability và thời hạn session) là **engineering targets của baseline v0.1**. Chúng được dùng để định hướng Architecture, lập Test Plan và nghiệm thu theo NFR/AC tương ứng; NFR-10 là mục tiêu vận hành sau triển khai. Nếu đề bài hoặc stakeholder cung cấp một ngưỡng bắt buộc khác, ghi nguồn và cập nhật yêu cầu ở phiên bản tiếp theo.

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

Chi tiết về thiết bị cụ thể, network throttling, số lượt đo, kịch bản FPS 3D, cách tính percentile, load test và biểu mẫu bằng chứng sẽ được chốt trong Test/Performance Plan trước nghiệm thu. [`plans/performance-audit.md`](../plans/performance-audit.md) và [`plans/device-matrix.md`](../plans/device-matrix.md) là tài liệu tham khảo hiện có, chưa phải profile nghiệm thu cho baseline v0.1. SRS chỉ quy định **mức chất lượng cần đạt**; Test/Performance Plan quy định **cách chứng minh mức đó đã đạt**. Đo hiệu năng immersive VR thuộc kế hoạch mở rộng sau MVP.

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
Mật khẩu Admin không được lưu plaintext và phải được hash bằng cơ chế phù hợp.

**NFR-16 — Authentication protection**  
Chức năng quản trị phải yêu cầu phiên xác thực hợp lệ.

**NFR-17 — Session expiration**  
Phiên Admin phải hết hiệu lực sau **30 phút không hoạt động**, tối đa **8 giờ từ lúc đăng nhập**, hoặc ngay sau logout; backend phải từ chối request của phiên đã hết hiệu lực. Các thời hạn này là engineering target áp dụng trong baseline v0.1.

**NFR-18 — Input validation**  
Dữ liệu do Admin gửi vào phải được kiểm tra phía hệ thống trước khi lưu hoặc publish.

**NFR-19 — File upload validation**  
Backend phải kiểm tra định dạng/nội dung, MIME và dung lượng thực tế theo mục 5.2; file bị từ chối không được gắn vào nội dung và upload thất bại không được thay thế media đang dùng.

**NFR-20 — Unauthorized API access**  
Các thao tác quản trị create/edit/delete/upload/publish/unpublish/cấu hình tour và đọc Draft/Preview phải từ chối request chưa xác thực hoặc có phiên hết hiệu lực.

**NFR-21 — Sensitive information exposure**  
Không được gửi password, password hash, secret key hoặc server credential tới Visitor hoặc frontend bundle công khai.

---

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
Các giao diện public-facing thuộc MVP phải đáp ứng các tiêu chí WCAG 2.1 Level A và AA áp dụng được. Checklist nghiệm thu phải ghi từng tiêu chí, bằng chứng hoặc lý do không áp dụng; chỉ kết quả quét tự động không đủ để kết luận đáp ứng. CMS không bắt buộc đạt toàn bộ WCAG 2.1 AA trong MVP nhưng phải hỗ trợ keyboard navigation, visible focus, semantic controls/labels và không tạo keyboard trap.

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

**CON-11 — Admin roles**  
MVP không triển khai phân quyền nhiều cấp.

**CON-12 — Publication workflow**  
Trạng thái nội dung chỉ gồm Draft và Published; Preview là thao tác đọc Draft được bảo vệ, không phải trạng thái hoặc bước bắt buộc. Chỉnh sửa Published phải Unpublish trước theo mục 5.1; không duy trì bản nháp song song với bản đang công khai.

---

### 8.4 Accessibility Constraints

**CON-13 — Accessibility scope**  
WCAG 2.1 AA áp dụng cho các giao diện public-facing thuộc MVP. CMS chỉ bắt buộc mức accessibility cơ bản theo BR-18/NFR-27. Accessibility bên trong XR tương lai nằm ngoài phạm vi hiện tại.

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

**ASM-08 — Administrator provisioning**  
Tài khoản Admin được người phụ trách hệ thống cấp và vô hiệu hóa ngoài giao diện CMS MVP; không có đăng ký Admin công khai. Bộ nghiệm thu có ít nhất hai tài khoản Admin khác nhau để kiểm tra cùng mức quyền.

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
Given Visitor đang trong bảo tàng, when chọn một hiện vật, then hệ thống hiển thị tên/mô tả và hình ảnh nếu có; when đóng bảng bằng control đóng hoặc phím Esc, then Visitor tiếp tục tham quan và focus trở lại control đã mở bảng.

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

**AC-16 — Admin authentication**  
**Requirements:** FR-44, FR-45, FR-46, BR-03, ASM-08.  
Given tài khoản Admin hợp lệ, when nhập đúng email/password, then Admin được truy cập CMS.

Kiểm tra với ít nhất hai tài khoản có cùng quyền; email/password sai hoặc tài khoản đã bị vô hiệu hóa phải bị từ chối.

**AC-17 — Unauthorized CMS access**  
**Requirements:** FR-48, NFR-16, NFR-20, CON-16.  
Given người dùng chưa đăng nhập, when truy cập CMS hoặc gọi trực tiếp API create/edit/delete/upload/publish/unpublish/tour management, then backend từ chối và không thay đổi dữ liệu, kể cả khi bỏ qua frontend.

**AC-18 — Create Draft**  
**Requirements:** FR-49, FR-50, FR-67, FR-68, FR-90.  
Given Admin đã đăng nhập, when tạo hiện vật và Save Draft với dữ liệu đúng kiểu nhưng chưa đủ nội dung Publish, then dữ liệu được lưu, hiện trong danh sách CMS ở trạng thái Draft và không được API public trả về.

**AC-19 — Draft Preview**  
**Requirements:** FR-69, FR-70, FR-71.  
Given hiện vật là Draft đã lưu, when Admin chọn Preview, then Admin xem được transform, hotspot, nội dung song ngữ và media đã gắn; model còn thiếu được hiển thị bằng placeholder. Preview không đổi trạng thái hoặc làm dữ liệu công khai.

**AC-20 — Publish**  
**Requirements:** FR-72, FR-73.  
Given Draft hợp lệ, when Admin chọn Publish, then trạng thái chuyển thành Published và nội dung trở thành công khai.

**AC-21 — Publish validation**  
**Requirements:** FR-90, FR-91, NFR-18, NFR-51.  
Given Draft thiếu một trong các trường bắt buộc hoặc quan hệ/media/transform không hợp lệ theo mục 5.2, when Admin Publish, then backend từ chối, trạng thái vẫn là Draft và CMS chỉ rõ lỗi. Kiểm tra ít nhất tên/mô tả thiếu một ngôn ngữ, audio thiếu transcript/phụ đề, scale không dương và media sai loại; Save Draft được phép thiếu nội dung nhưng không được lưu giá trị sai kiểu/giới hạn.

**AC-22 — Unpublish**  
**Requirements:** FR-74, FR-75, BR-22, NFR-12.  
Given hiện vật Published, when Admin Unpublish, then hiện vật chuyển về Draft và không còn xuất hiện trong phiên public mới.

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
Given giao diện public-facing thuộc MVP, when kiểm tra checklist WCAG 2.1 A/AA bằng công cụ và thủ công, then các tiêu chí áp dụng phải đạt và có bằng chứng. Tối thiểu kiểm tra keyboard-only, focus/không kẹt focus, screen reader, alt/label, contrast, zoom 200% và nội dung không phụ thuộc canvas; transcript/phụ đề và reduced motion kiểm chứng thêm ở AC-42/AC-43. Với CMS, kiểm tra tối thiểu keyboard navigation, visible focus, semantic controls/labels và không có keyboard trap.

**AC-27 — Performance**  
**Requirements:** NFR-01 → NFR-04, NFR-06, NFR-07, NFR-48.  
Given production build, device matrix và điều kiện đo đã được phê duyệt trong Test/Performance Plan, when thực hiện performance audit, then:
- trang public ban đầu có thể tương tác trong ≤ 5 giây;
- tài nguyên từ navigation đến khi scene 3D sẵn sàng có transfer size ≤ 20 MB;
- FPS của trải nghiệm 3D đạt ≥ 30 trong kịch bản tham quan chuẩn trên thiết bị hỗ trợ 3D;
- UI response p95 ≤ 500 ms;
- thời gian scene sẵn sàng, tải media, cấu hình máy/mạng, mức chất lượng và manifest asset được báo cáo riêng trong performance audit.

**AC-28 — Model failure**  
**Requirements:** FR-86, NFR-11.  
Given model thiếu hoặc không tải được nhưng API nội dung hoạt động, when mở hiện vật, then hệ thống dùng placeholder trong scene, thông báo khi tải lỗi và vẫn cho phép mở nội dung văn bản.

**AC-29 — Reserved for future WebXR failure acceptance**  
Không áp dụng cho MVP hiện tại. Acceptance criterion này chỉ được kích hoạt khi immersive WebXR được đưa vào scope triển khai.

**AC-30 — CMS-driven update**  
**Requirements:** BR-19, FR-51, FR-73, NFR-40.  
Given Admin đã Unpublish, sửa Draft và Publish thành công, when mở phiên public mới, then frontend dùng nội dung mới mà không cần developer sửa hoặc build lại source code frontend.

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

**AC-35 — Published editing protection**  
**Requirements:** FR-51, BR-21, CON-12.  
Given hiện vật Published, when Admin thử sửa hiện vật/hotspot hoặc ghi đè/xóa media đang được nó tham chiếu bằng API, then backend từ chối; sau Unpublish, chỉnh sửa Draft được phép và chỉ công khai trở lại sau Publish.

**AC-36 — Draft API protection**  
**Requirements:** FR-68, FR-69, BR-04, BR-05.  
Given hiện vật Draft có ID đã biết, when người chưa xác thực truy vấn API public theo ID, danh sách phòng, API Preview hoặc media chỉ gắn với Draft, then phản hồi không chứa dữ liệu Draft/hotspot và từ chối Preview/media riêng của Draft. Admin có phiên hợp lệ được đọc Preview; media dùng chung với Published vẫn được công khai, public không nhận Draft kể cả frontend bị bỏ qua.

**AC-37 — Exhibit deletion**  
**Requirements:** FR-52, FR-64, BR-20, NFR-26.  
Given Draft có hotspot và tham chiếu trong tour, when Admin hủy xác nhận xóa, then không có dữ liệu thay đổi; when xác nhận và backend báo thành công, then Draft/hotspot bị xóa và tour không còn tham chiếu đó. Media dùng chung và các hiện vật khác không bị xóa; Published không thể xóa trực tiếp.

**AC-38 — Logout and session expiration**  
**Requirements:** FR-46, FR-47, NFR-17.  
Given phiên Admin hợp lệ, when logout, không hoạt động 30 phút hoặc đạt thời hạn 8 giờ, then request tiếp theo của phiên cũ bị backend từ chối, gồm cả API Preview. Khi tự hết hạn, form chưa lưu chỉ giữ trong bộ nhớ của tab và chỉ hiện lại sau khi đăng nhập, không ghi credential hoặc nội dung nhạy cảm vào client storage; logout chủ động xóa dữ liệu Draft/Preview khỏi bộ nhớ/cache giao diện.

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
Given hệ điều hành bật hoặc đổi sang reduced motion trong phiên sử dụng giao diện web, when dùng UI và tour, then animation không thiết yếu/chuyển động camera tự động liên tục bị tắt; teleport/Auto dùng chuyển vị trí tức thời, các chức năng cốt lõi vẫn hoạt động.

**AC-44 — Adaptive 3D quality**  
**Requirements:** FR-96, NFR-03, NFR-11.  
Given scene 3D đã tải, when hiệu năng duy trì dưới ngưỡng chấp nhận theo Test/Performance Plan, then hệ thống tự động giảm chất lượng rendering không thiết yếu mà không làm mất nội dung hoặc chức năng cốt lõi. Nếu vẫn không đạt ngưỡng ở mức chất lượng thấp nhất, hệ thống thông báo và cung cấp lựa chọn chuyển sang 2D. Ghi bằng chứng mức chất lượng trước/sau.

**AC-45 — Media rights metadata**  
**Requirements:** FR-97, ASM-06.  
Given Draft dùng media, when thiếu nguồn/tác giả/giấy phép hoặc căn cứ quyền sử dụng và Admin Publish, then backend từ chối; sau khi bổ sung và Publish, các thông tin ghi công/giấy phép phải công khai truy cập được ở 2D và 3D.

**AC-46 — Automatic and manual tour**  
**Requirements:** FR-23 → FR-31, FR-98.  
Given tour có nhiều hiện vật, when Visitor chọn Auto và cho phép audio, then tour lần lượt chuyển điểm xem/nội dung, phát audio rồi chuyển bước khi audio kết thúc; nếu không có audio hoặc audio lỗi thì chuyển bước sau dwell time đang được cấu hình. Playback bị chặn phải tạm dừng chờ Play/Next. Kiểm tra Pause/Resume giữ bước/bộ đếm, Next/Previous chuyển về Manual và Exit dừng audio/tự chuyển bước. Manual không tự chuyển bước. Hành vi XR không thuộc AC của MVP.

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

---

### 11.3 NFR Traceability Examples

| Quality Goal | NFR | Verification |
|---|---|---|
| Fast initial experience / asset budget | NFR-01, NFR-02, NFR-06, NFR-07 | AC-27; performance audit |
| Smooth 3D / UI response | NFR-03, NFR-04 | AC-27, AC-44; FPS/frametime/input measurement |
| CMS response / concurrency | NFR-05, NFR-08 | AC-48, AC-49; timing/load test |
| Availability | NFR-10 | Báo cáo probe trong 30 ngày theo NFR-10; mục tiêu vận hành sau triển khai |
| Content consistency / persistence | NFR-12, NFR-13 | AC-41, AC-51, AC-54 |
| Secure CMS | NFR-14 → NFR-21 | AC-17, AC-21, AC-33, AC-36, AC-38; kiểm tra HTTPS, password hashing và secret exposure |
| Accessible UI | NFR-27 → NFR-33 | AC-26, AC-42, AC-43; WCAG checklist/manual test |
| Cross-device usage | NFR-34, NFR-35, NFR-37, NFR-38 | AC-50; device matrix test |
| WebXR extension readiness | NFR-36, FR-32 | AC-13, AC-31; capability test/architecture review, không nghiệm thu headset |
| Maintainable content | NFR-39 → NFR-43 | Architecture/code review |
| Reliable fallback | NFR-11, NFR-47 | AC-08, AC-13, AC-14, AC-15, AC-28, AC-40, AC-41 |
| Vietnamese/English | NFR-49 → NFR-51 | AC-05, AC-34, AC-53; localization test |
| Privacy | NFR-52 → NFR-54 | Review dữ liệu/request/client storage; xác nhận không thu dữ liệu Visitor bắt buộc hoặc lộ credential |

### 11.4 Cross-Cutting Requirements

| Concern | Related Requirements | Acceptance Criteria |
|---|---|---|
| Asset/rendering errors | FR-86 → FR-88 | AC-08, AC-15, AC-28 |
| CMS validation / failed operations | FR-90, FR-91, FR-93 | AC-21, AC-33, AC-41 |
| API trust boundary | FR-92, CON-16 | AC-17, AC-36, AC-40 |

Bảng trên và mục 11.2 ánh xạ toàn bộ FR đang áp dụng cho MVP tới AC, không bao gồm `FR-33` → `FR-38`, `FR-89` và `AC-29` được reserved cho XR tương lai. Bảng không thay thế test case chi tiết. Mỗi test case phải ghi mã FR/NFR/AC liên quan, thiết bị/môi trường, ngày chạy, kết quả và bằng chứng. Các NFR chưa có AC riêng vẫn phải có bước kiểm chứng phù hợp, như review kiến trúc hoặc checklist bảo mật; không được suy ra đạt chỉ từ chức năng hoạt động.

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
- multi-level content approval;
- Curator role;
- Super Admin role;
- version history;
- rollback content;
- giữ bản Published công khai đồng thời chỉnh sửa một bản Draft song song;
- CMS room editor;
- tự động tạo model 3D;
- chỉnh sửa mesh/model trực tiếp trong CMS;
- immersive VR/headset implementation và nghiệm thu trong MVP hiện tại;
- full WCAG compliance bên trong immersive XR tương lai.

---

## 13. Requirement Prioritization

Mọi FR, BR, CON và NFR có từ “phải” và đang áp dụng cho MVP thuộc Must Have; các mã reserved hoặc yêu cầu có điều kiện dành cho future extension không thuộc nghiệm thu MVP. Các ngưỡng định lượng áp dụng theo mục 5.2 và 7.0; NFR-10 là mục tiêu vận hành sau triển khai. Should/Could bên dưới chỉ là phần nâng cao không thay thế điều kiện nghiệm thu bắt buộc; không có tính năng vừa ngoài MVP vừa là điều kiện hoàn thành MVP.

### Must Have

- Museum 3D;
- tối thiểu 5 exhibits;
- navigation desktop/mobile;
- exhibit information;
- hotspot;
- Vietnamese/English;
- audio guide, transcript và phụ đề đồng bộ;
- guided tour Manual/Auto, chỉ dẫn và teleport;
- WebXR capability detection ở mức extension readiness, không bao gồm immersive VR/headset;
- progressive fallback;
- 2D accessible interface;
- giảm chuyển động và tự động hạ chất lượng 3D khi cần;
- schema validation, xử lý lỗi API/CMS và giới hạn upload;
- tối ưu asset để đạt ngân sách/hiệu năng bắt buộc;
- Admin login;
- CRUD exhibit;
- transform configuration;
- hotspot management;
- Draft;
- Preview;
- Publish/Unpublish và bảo vệ Draft tại API;
- metadata quyền sử dụng media.

### Should Have

- feedback loading chi tiết theo tiến độ từng asset, ngoài trạng thái loading/error bắt buộc;
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
- complex CMS workflow và bản nháp song song;
- multiple tours.

### Future Enhancements — Outside MVP

- Immersive WebXR/VR trên headset thật, gồm controller/teleport, XR UI và performance validation.
- Nhiều guided tour có cấu hình độc lập.
- Workflow chỉnh sửa bản nháp trong khi giữ bản Published, khi có nhu cầu biên tập liên tục.

---

## 14. Definition of MVP Completion

MVP được coi là hoàn thành khi:

1. Có một không gian bảo tàng 3D hoàn chỉnh.
2. Có tối thiểu 5 hiện vật Published.
3. Visitor tham quan được trên desktop và mobile.
4. Bộ 5 hiện vật nghiệm thu đáp ứng mục 2.5, không chỉ dùng placeholder.
5. Có audio guide kèm transcript và phụ đề đồng bộ.
6. Hỗ trợ tiếng Việt và tiếng Anh.
7. Có một guided tour tuyến tính hoàn chỉnh, hỗ trợ Manual/Auto và Pause/Resume.
8. Guided tour hỗ trợ chỉ dẫn và teleport.
9. Core MVP hoạt động độc lập với WebXR; capability detection không làm lỗi luồng desktop/mobile.
10. Có fallback 3D → 2D.
11. Có CMS với ít nhất hai tài khoản Admin được cấp trước, cùng quyền, có logout/hết hạn phiên.
12. CMS hỗ trợ CRUD hiện vật.
13. CMS hỗ trợ Position / Rotation / Scale.
14. CMS hỗ trợ hotspot và media.
15. Có Draft/Published, Preview được bảo vệ tại API và workflow Unpublish trước khi sửa.
16. Giao diện public-facing thuộc MVP đáp ứng phạm vi WCAG 2.1 A/AA và reduced motion đã đặt ra; CMS đáp ứng mức accessibility cơ bản theo BR-18/NFR-27.
17. Các test case chính vượt qua, có mapping FR/NFR/AC và bằng chứng.
18. Performance audit, compatibility và fallback test đạt các AC tương ứng, gồm tải đồng thời, xử lý lỗi API/CMS và hạ chất lượng 3D. Availability 30 ngày là mục tiêu vận hành sau triển khai, không chặn demo MVP.
