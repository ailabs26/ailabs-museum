# 03 — Luồng xác thực (login / refresh rotation)

Access token JWT ngắn hạn (~15 phút) gửi qua `Authorization: Bearer`.
Refresh token dài hạn (~7 ngày) chỉ lưu **hash** trong `refresh_sessions`, trao đổi qua
**httpOnly cookie**, **xoay vòng** mỗi lần refresh.

## Đăng nhập + gọi API + refresh

```mermaid
sequenceDiagram
    participant U as FE
    participant A as AuthController
    participant S as AuthService/TokenService
    participant DB as DB (users, refresh_sessions)

    U->>A: POST /auth/login {email, password}
    A->>S: login()
    S->>DB: nạp user + so khớp bcrypt, chặn disabled
    S-->>A: accessToken + refresh(raw) [issueRefresh: lưu sha256]
    A-->>U: 200 { accessToken, user } + Set-Cookie httpOnly refresh

    U->>A: GET /api/... (Authorization: Bearer access)
    Note over U,A: access hết hạn -> 401
    U->>A: POST /auth/refresh (cookie refresh)
    A->>S: rotate(raw)
    S->>DB: tra session theo hash
    alt token hợp lệ, chưa dùng
        S->>DB: tạo session mới cùng family + markUsed(cũ)
        S-->>A: accessToken mới + refresh(raw) mới
        A-->>U: 200 { accessToken } + Set-Cookie refresh mới
    else token đã dùng/thu hồi (nghi đánh cắp)
        S->>DB: revokeFamily(family_id)
        S-->>A: 401
        A-->>U: 401 (buộc đăng nhập lại)
    end
```

## Xoay vòng & phát hiện tái dùng (reuse-detection)

```mermaid
stateDiagram-v2
    [*] --> Active: issueRefresh
    Active --> Rotated: refresh hợp lệ (markUsed + tạo session mới cùng family)
    Rotated --> Revoked: dùng lại token đã rotate -> revokeFamily
    Active --> Revoked: logout / revoke
    Active --> Expired: quá expires_at
    Revoked --> [*]
    Expired --> [*]
```

- Mỗi lần refresh tạo session mới cùng `family_id`, đánh dấu session cũ `used_at` + `replaced_by_id`.
- Nếu một token đã `used`/`revoked` lại được dùng để refresh → **thu hồi cả family** và trả 401.
- FE dùng single-flight: nhiều request 401 đồng thời chỉ gọi `/auth/refresh` một lần.
