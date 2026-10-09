# 08 — Use-case tổng thể & các sơ đồ chính

## 8.1 Use-case toàn hệ thống

```mermaid
graph LR
    visitor((Visitor))
    editor((Editor))
    mod((Moderator))
    admin((Admin))

    %% Client
    visitor --- c1[Xem collection 2D]
    visitor --- c2[Xem chi tiết hiện vật]
    visitor --- c3[Tham quan 3D / VR]
    visitor --- c4[Nghe audio + transcript]
    visitor --- c5[Guided tour]
    visitor --- c6[Gửi báo cáo nội dung sai]

    %% Editor
    editor --- e1[Quản lý phòng]
    editor --- e2[Tạo/sửa hiện vật + revision]
    editor --- e3[Upload & gắn media]
    editor --- e4[Gửi duyệt]

    %% Moderator
    mod --- m1[Duyệt / từ chối revision]
    mod --- m2[So sánh phiên bản]
    mod --- m3[Tạm ẩn hiện vật]
    mod --- m4[Xử lý báo cáo]

    %% Admin
    admin --- a1[Quản lý user/role/permission]
    admin --- a2[Xem audit log]
    admin --- a3[Xem dashboard]
    admin -.kế thừa.-> mod
    mod -.kế thừa.-> editor
```

## 8.2 Luồng xuất bản nội dung (Editor → Moderator → Client)

```mermaid
sequenceDiagram
    participant E as Editor (CMS)
    participant M as Moderator (CMS)
    participant API as NestJS API
    participant DB as DB
    participant V as Visitor (Client)

    E->>API: POST /exhibits/:id/revisions (draft)
    API->>DB: lưu revision status=draft
    E->>API: POST /revisions/:id/submit
    API->>DB: status=pending
    M->>API: GET /moderation/queue
    API->>DB: list pending
    M->>API: GET /moderation/revisions/:id/diff
    M->>API: POST /revisions/:id/publish
    API->>DB: transaction: status=published,<br/>exhibit.currentRevisionId=:id, audit
    Note over V: nội dung mới xuất hiện (cache TTL<=60s)
    V->>API: GET /public/exhibits/:id
    API->>DB: chỉ đọc currentRevision (published)
    API-->>V: ExhibitResponseDto
```

## 8.3 Luồng client đọc nội dung + fallback render

```mermaid
sequenceDiagram
    participant V as Visitor
    participant FE as React App
    participant API as Public API
    participant ST as Media Storage

    V->>FE: mở /tour/:slug
    FE->>API: GET /public/rooms/:slug
    API-->>FE: room + exhibits (published)
    FE->>FE: render 2D (Mantine) — luôn có nội dung
    FE->>FE: kiểm WebGL
    alt có WebGL
      FE->>ST: tải GLB/ảnh
      alt GLB lỗi
        FE->>FE: placeholder 3D (không crash)
      else ok
        FE->>FE: scene 3D + hotspot
      end
      FE->>FE: kiểm WebXR -> nút Enter VR
    else không WebGL
      FE->>FE: ở lại 2D + thông báo
    end
```

## 8.4 Luồng gửi & xử lý báo cáo vi phạm

```mermaid
sequenceDiagram
    participant V as Visitor
    participant FE as Report Modal
    participant API as ReportsController
    participant M as Moderator
    participant DB as DB

    V->>FE: mở form báo cáo trên 1 hiện vật
    FE->>API: POST /public/reports {revisionId, reason, detail} (rate-limited)
    API->>DB: lưu report status=open (gắn revision bị báo cáo)
    API-->>FE: 201 (thông báo đã nhận)
    M->>API: GET /reports?status=open
    M->>API: POST /reports/:id/resolve | dismiss (kèm lý do bắt buộc)
    API->>DB: cập nhật + audit
```

## 8.5 Sơ đồ triển khai (deployment, MVP)

```mermaid
graph TB
    subgraph dev[Máy dev / CI]
      viteb[Vite build -> static]
      nestb[Nest build -> node]
    end
    subgraph host[Hosting]
      cdn[Static host / CDN<br/>FE build]
      node[Node server<br/>NestJS API :3001]
      media[Media storage<br/>public/ hoặc Supabase Storage]
    end
    sup[(Supabase PostgreSQL)]

    viteb --> cdn
    nestb --> node
    cdn -->|/api| node
    node --> sup
    node --> media
    cdn -->|GET media| media
```

> Các sequence/flow phân hệ quản trị chi tiết: xem [07-admin-subsystem.md](07-admin-subsystem.md).
