# 01 — ERD 13 bảng MVP

Phản ánh đúng entity TypeORM + migration `AlignMuseumMvpSchema`. Mọi khóa chính là `uuid`;
thời điểm dùng `timestamptz`. Soft-delete (`is_deleted` + `deleted_at`) ở `rooms`, `exhibits`,
`media`, `users`. Mọi FK dùng `ON DELETE RESTRICT`.

```mermaid
erDiagram
    rooms ||--o{ exhibits : "chứa"
    exhibits ||--o{ exhibit_revisions : "có phiên bản"
    exhibits }o--o| exhibit_revisions : "published_revision_id"
    exhibit_revisions ||--o{ hotspots : "có"
    exhibit_revisions }o--o| media : "model/image/audio"
    exhibit_revisions }o--|| users : "created_by"
    exhibit_revisions }o--o| users : "reviewed_by"
    media }o--o| users : "created_by"
    content_reports }o--|| exhibits : "exhibit_id"
    content_reports }o--o| exhibit_revisions : "reported_revision_id"
    content_reports }o--o| users : "assigned_to"
    audit_logs }o--o| users : "actor_id"
    audit_logs }o--o| exhibit_revisions : "revision_id"
    users ||--o{ user_roles : ""
    roles ||--o{ user_roles : ""
    roles ||--o{ role_permissions : ""
    permissions ||--o{ role_permissions : ""
    users ||--o{ refresh_sessions : ""
    refresh_sessions }o--o| refresh_sessions : "replaced_by_id"

    rooms {
        uuid id PK
        varchar slug UK
        varchar name
        text description
        varchar status "active|archived"
        boolean is_deleted
        timestamptz deleted_at
    }
    exhibits {
        uuid id PK
        uuid room_id FK
        uuid published_revision_id FK "null"
        varchar visibility "visible|hidden"
        integer version ">=0 (optimistic lock)"
        integer display_order ">=0"
        timestamptz archived_at
        boolean is_deleted
    }
    exhibit_revisions {
        uuid id PK
        uuid exhibit_id FK
        integer revision_no "UK(exhibit_id,revision_no) >=1"
        varchar state "draft|in_review|approved|rejected"
        jsonb content
        uuid model_media_id FK "null"
        uuid image_media_id FK "null"
        uuid audio_media_id FK "null"
        uuid created_by FK
        uuid reviewed_by FK "null"
        timestamptz created_at
    }
    hotspots {
        uuid id PK
        uuid revision_id FK
        varchar label
        text body
        numeric position_x
        numeric position_y
        numeric position_z
        integer display_order ">=0"
    }
    media {
        uuid id PK
        varchar kind "model|image|audio"
        text storage_key UK
        varchar mime_type
        bigint size_bytes ">0"
        char checksum_sha256
        varchar processing_state "pending|ready|failed"
        uuid created_by FK "null"
        boolean is_deleted
    }
    users {
        uuid id PK
        citext email UK
        text password_hash
        varchar display_name
        varchar status "active|disabled"
        boolean is_deleted
        timestamptz created_at
    }
    roles {
        uuid id PK
        varchar code UK
        varchar name
    }
    permissions {
        uuid id PK
        varchar code UK "resource:action"
        varchar description "null"
    }
    user_roles {
        uuid user_id PK_FK
        uuid role_id PK_FK
        timestamptz assigned_at
    }
    role_permissions {
        uuid role_id PK_FK
        uuid permission_id PK_FK
    }
    refresh_sessions {
        uuid id PK
        uuid user_id FK
        uuid family_id
        char token_hash UK "sha256"
        uuid replaced_by_id FK "null, self"
        timestamptz used_at
        timestamptz revoked_at
        timestamptz expires_at
    }
    content_reports {
        uuid id PK
        uuid exhibit_id FK
        uuid reported_revision_id FK "null"
        varchar category
        text message
        varchar status "open|in_progress|resolved|dismissed"
        uuid assigned_to FK "null"
        timestamptz created_at
    }
    audit_logs {
        uuid id PK
        uuid actor_id FK "null"
        varchar action
        varchar resource_type
        uuid resource_id
        uuid revision_id FK "null"
        varchar request_id
        timestamptz occurred_at
    }
```

## Chỉ mục & ràng buộc chính

- `UNIQUE(exhibit_id, revision_no)` trên `exhibit_revisions`.
- `INDEX exhibits(room_id, display_order, id)`, `content_reports(status, created_at)`,
  `audit_logs(resource_type, resource_id, occurred_at)`, `refresh_sessions(user_id, family_id)`.
- `CHECK (is_deleted = (deleted_at IS NOT NULL))` cho các bảng soft-delete.
- FK vòng `exhibits.published_revision_id ↔ exhibit_revisions.exhibit_id` thêm bằng
  `ADD CONSTRAINT` sau khi tạo cả hai bảng.
