# 04 — Mô hình dữ liệu & ERD

> Đề xuất schema cho MVP + chỗ mở rộng phase 2/3. Người phụ trách DB (Thắng) chốt bản cuối;
> tài liệu này là điểm khởi đầu đã khớp với base code hiện có (`Room`, `Exhibit`, `Media`).

## 4.1 Nguyên tắc

- **Tách identity ↔ content qua Revision:** `Exhibit` giữ vị trí/thứ tự ổn định; nội dung (tên, mô tả,
  transcript, media) nằm trong `ExhibitRevision` có trạng thái `draft → pending → published → archived`.
  `Exhibit.currentRevisionId` trỏ bản **đang xuất bản** → API public chỉ đọc bản này.
- **Draft không lọt public:** query public luôn join theo `currentRevisionId` (published).
- **Audit append-only:** `AuditLog` chỉ insert, không update/delete.
- **UUID** khóa chính; `createdAt/updatedAt` mọi bảng; JSONB cho metadata/translations mở rộng.

## 4.2 ERD

```mermaid
erDiagram
    ROOM ||--o{ EXHIBIT : "chứa"
    EXHIBIT ||--o{ EXHIBIT_REVISION : "có lịch sử"
    EXHIBIT_REVISION }o--|| EXHIBIT : "current (published)"
    EXHIBIT_REVISION }o--o| MEDIA : "model (GLB)"
    EXHIBIT_REVISION }o--o| MEDIA : "image"
    EXHIBIT_REVISION }o--o| MEDIA : "audio vi / audio en"
    EXHIBIT_REVISION }o--o| MEDIA : "subtitle vi / subtitle en (WebVTT)"
    EXHIBIT_REVISION ||--o{ REPORT : "bị báo cáo"
    USER ||--o{ USER_ROLE : ""
    ROLE ||--o{ USER_ROLE : ""
    ROLE ||--o{ ROLE_PERMISSION : ""
    PERMISSION ||--o{ ROLE_PERMISSION : ""
    USER ||--o{ AUDIT_LOG : "thực hiện"
    USER ||--o{ EXHIBIT_REVISION : "tạo/sửa"
    USER ||--o{ REPORT : "xử lý"

    ROOM {
      uuid id PK
      string slug UK
      string name
      text description
      int displayOrder
      timestamptz createdAt
      timestamptz updatedAt
    }
    EXHIBIT {
      uuid id PK
      uuid roomId FK
      uuid currentRevisionId FK "revision đang published, nullable"
      float positionX
      float positionY
      float positionZ
      int displayOrder
      string status "visible | hidden"
      timestamptz createdAt
      timestamptz updatedAt
    }
    EXHIBIT_REVISION {
      uuid id PK
      uuid exhibitId FK
      int version
      string status "draft|pending|published|rejected|archived"
      string name
      text description
      text transcript
      uuid modelId FK "Media, nullable"
      uuid imageId FK "Media, nullable"
      uuid audioId FK "Media, nullable — audio tiếng Việt"
      uuid audioEnId FK "Media, nullable (Task 9)"
      uuid subtitleViId FK "Media, nullable (Task 9)"
      uuid subtitleEnId FK "Media, nullable (Task 9)"
      jsonb translations "i18n phase 3"
      uuid createdBy FK
      uuid reviewedBy FK "nullable"
      text reviewNote "lý do reject/hide"
      timestamptz createdAt
      timestamptz publishedAt
    }
    MEDIA {
      uuid id PK
      string kind "model|image|audio|subtitle"
      text url
      string mimeType
      bigint sizeBytes
      string altText "nullable"
      string status "quarantine|ready"
      string checksum "sha256"
      uuid uploadedBy FK
      timestamptz createdAt
    }
    USER {
      uuid id PK
      string email UK
      string passwordHash
      string displayName
      boolean isActive
      timestamptz lastLoginAt
      timestamptz createdAt
      timestamptz updatedAt
    }
    ROLE {
      uuid id PK
      string key UK "admin|moderator|editor"
      string name
      text description
      boolean isSystem "không cho xóa"
    }
    PERMISSION {
      uuid id PK
      string key UK "exhibit:update, media:upload, report:resolve..."
      string resource
      string action
      string description
    }
    USER_ROLE {
      uuid userId FK
      uuid roleId FK
    }
    ROLE_PERMISSION {
      uuid roleId FK
      uuid permissionId FK
    }
    REPORT {
      uuid id PK
      uuid revisionId FK "phiên bản bị báo cáo"
      string reason
      text detail
      string reporterContact "nullable"
      string status "open|reviewing|resolved|dismissed"
      uuid handledBy FK "nullable"
      text resolutionNote
      timestamptz createdAt
      timestamptz resolvedAt
    }
    AUDIT_LOG {
      uuid id PK
      uuid actorId FK
      string action "login|exhibit.publish|user.create..."
      string entityType
      uuid entityId
      jsonb before "nullable"
      jsonb after "nullable"
      string ip
      timestamptz createdAt
    }
```

## 4.3 Bảng mở rộng (phase 3 — để trước chỗ, chưa làm MVP)

| Bảng | Mục đích |
|---|---|
| `API_KEY` | key đối tác: `hashedKey`, `scopes[]`, `rateLimit`, `revokedAt` |
| `TRANSLATION` | bản dịch hiện vật (en/zh/ko/ja) — hoặc dùng cột `translations` JSONB trong revision |
| `ANALYTICS_EVENT` | sự kiện truy cập để báo cáo + scheduled cleanup |

## 4.4 Trạng thái Revision (state machine)

```mermaid
stateDiagram-v2
    [*] --> draft: Editor tạo
    draft --> pending: gửi duyệt
    pending --> published: Moderator duyệt
    pending --> rejected: Moderator từ chối (kèm lý do)
    rejected --> draft: Editor sửa lại
    published --> archived: xuất bản revision mới hơn
    published --> hidden: tạm ẩn (vi phạm)
    hidden --> published: gỡ ẩn
```

## 4.5 Khác biệt với base hiện tại (cần migrate)

| Hiện tại | Đề xuất | Lý do |
|---|---|---|
| `Exhibit` chứa thẳng name/description/transcript/media | tách sang `ExhibitRevision` | cần lịch sử phiên bản + draft/published |
| chưa có | `User/Role/Permission/UserRole/RolePermission` | RBAC phân hệ quản trị |
| chưa có | `Report`, `AuditLog` | báo cáo vi phạm + nhật ký |
| `Media` tối giản | thêm `sizeBytes/status/checksum/uploadedBy` | upload pipeline + quarantine |

> Migration & seed 5 hiện vật mẫu: `database/migrations`, `database/seeds` (task #1 của Thắng).
