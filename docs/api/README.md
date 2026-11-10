# Aura Museum API — Tài liệu OpenAPI

Tài liệu API của back-end (NestJS) được xuất bản ở hai dạng:

| Dạng | Vị trí | Dùng khi |
| --- | --- | --- |
| **Swagger UI động** | `GET /api/docs` trên server đang chạy | Thử API trực tiếp, có ô **Authorize** nhập Bearer token |
| **Spec tĩnh (OpenAPI 3.0)** | [`openapi.json`](./openapi.json) | Chia sẻ, import vào công cụ, bản chốt theo commit |
| **Trang xem tĩnh (Redoc)** | [`index.html`](./index.html) | Đọc tài liệu không cần chạy back-end |

Spec hiện tại: **OpenAPI 3.0.0**, title `Aura Museum API`, version `0.1.0`, 96 path, 32 schema.

## Xem tài liệu

### 1. Swagger UI (server đang chạy)

```bash
cd back-end
npm run dev            # server mặc định http://localhost:3001
# Mở http://localhost:3001/api/docs
```

Admin API cần đăng nhập: bấm **Authorize** và nhập `Bearer <access_token>` (lấy từ
`POST /auth/login`). Nhóm `partner` dùng partner API key theo header riêng.

### 2. Trang Redoc tĩnh (không cần back-end)

`index.html` đọc `./openapi.json`. Vì trình duyệt chặn `fetch` qua `file://`, hãy
chạy qua một web server tĩnh:

```bash
cd docs/api
npx http-server .      # rồi mở http://localhost:8080
# hoặc dùng "Live Server" của VS Code
```

### 3. Công cụ ngoài

Import [`openapi.json`](./openapi.json) vào:

- **Swagger Editor** — https://editor.swagger.io (File → Import file)
- **Redocly / Postman / Insomnia** — tạo collection từ OpenAPI
- Sinh client SDK bằng `openapi-generator`

## Sinh lại spec

Spec được sinh từ chính mã nguồn (decorator `@ApiTags`/`@ApiOperation`/`@ApiProperty`
và DTO), dùng chung cấu hình với Swagger UI tại [`back-end/src/config/swagger.config.ts`](../../back-end/src/config/swagger.config.ts):

```bash
cd back-end
npm run openapi:export
```

Script [`back-end/scripts/export-openapi.ts`](../../back-end/scripts/export-openapi.ts)
chạy ở **Nest preview mode** nên không khởi tạo provider và **không kết nối database** —
chạy được trong CI hoặc máy không có DB. Kết quả ghi đè `docs/api/openapi.json`.

> **Lưu ý đồng bộ:** chạy lại lệnh trên sau khi thêm/sửa endpoint hay DTO, rồi commit
> `openapi.json` kèm thay đổi code để tài liệu không lệch với API.
