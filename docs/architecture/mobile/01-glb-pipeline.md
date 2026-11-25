# 01 — Pipeline tải GLB (MOB-E6-02)

Code: `mobile/src/features/scene3d/{glbSchema,glbValidation,glbCache,glbLoader}.ts`.

Mục tiêu: tải **một** hiện vật GLB từ API công khai, chỉ tải qua mạng **một lần**, và không bao giờ
đưa tệp hỏng/độc hại vào `GLTFLoader` hay GPU.

## 1. Hợp đồng metadata (`glbSchema.ts`)

`publicModelSchema` (Zod) khớp với `front-end/src/validations/roomSchema.ts` và controller
`exhibits.controller.ts` ở back-end:

| Trường | Ràng buộc |
|---|---|
| `id` | UUID |
| `storageKey` | `^[a-zA-Z0-9_/-]+\.glb$`, ≤ 512 ký tự, không có đoạn rỗng, `.` hay `..` |
| `sizeBytes` | số nguyên dương, ≤ `MAX_GLB_BYTES` = **128 MB** |
| `checksumSha256` | 64 ký tự hex thường |
| `url` | đúng mẫu `/rooms/<slug>/exhibits/<id>/model?version=<sha256>` |
| `rights` | tuỳ chọn (thông tin bản quyền media) |

`resolvePublicModelUrl(apiBaseUrl, url)` ghép URL tuyệt đối và **từ chối** khi:

- base không phải `http(s)`;
- đường dẫn không bắt đầu bằng `/rooms/`, bắt đầu bằng `//` hoặc chứa `..`;
- origin sau khi ghép khác origin của API.

Nhờ vậy dữ liệu CMS không thể khiến app tải file từ máy chủ lạ.

## 2. Kiểm tra nhị phân (`glbValidation.ts`)

Port từ `front-end/src/helpers/{glbAsset,sanitizeModel,modelNormalization}.ts`.

### `validateGlb(buffer)` — trước khi parse

Mọi vi phạm đều ném cùng một lỗi chung "GLB bị hỏng hoặc dùng định dạng chưa hỗ trợ" (không lộ chi
tiết cho người dùng):

1. Kích thước trong khoảng 28 B … 128 MB.
2. Header: magic `glTF`, version `2`, tổng độ dài khớp buffer, chunk đầu là `JSON`.
3. JSON chunk: độ dài chia hết cho 4, ≤ 16 MB, không tràn buffer.
4. Các chunk sau: căn 4 byte, không tràn, không có JSON chunk thứ hai, tối đa **một** `BIN` chunk.
5. JSON parse được và là object.
6. `buffers[]` và `images[]` **không được có `uri`** → GLB phải tự chứa, không tải tài nguyên ngoài.
7. `extensionsRequired` chỉ thuộc danh sách hỗ trợ (KHR_materials_*, KHR_mesh_quantization,
   KHR_texture_transform, EXT_texture_webp, EXT_mesh_gpu_instancing, KHR_draco_mesh_compression…).
8. `extensionsUsed` không chứa `EXT_meshopt_compression`, `KHR_texture_basisu` (chưa có decoder).
9. Nếu dùng Draco thì phải khai báo trong `extensionsUsed`; trả `{ usesDraco }`.

### `sanitizeModel(scene)` — sau khi parse

Duyệt cây, **cách ly** (tách khỏi scene) mesh có attribute chứa NaN/Infinity hoặc index trỏ ra
ngoài. Trả `{ quarantined }` để loader vẫn giải phóng được chúng.

### `normalizeModel(scene, verifiedScale?)`

Đưa mô hình vừa khung trưng bày **1.8 × 2.2 × 1.8 m** (X × Y × Z), tâm XZ = 0, đáy y = 0.
Không sửa geometry gốc — chỉ trả số liệu để component tự áp:

```ts
interface ModelNormalization {
  scale: number;                     // min(1.8/sx, 2.2/sy, 1.8/sz)
  offset: [number, number, number];  // [-center.x, -min.y, -center.z]
  size: [number, number, number];    // kích thước sau scale
  center: [number, number, number];  // [0, size.y/2, 0]
  radius: number;                    // nửa đường chéo — dùng cho camera/hotspot
}
```

Ném lỗi nếu bounding box rỗng/không hữu hạn hoặc scale ngoài `[1e-6, 1e6]`.
AR (E9-02) dùng lại chính `normalization` này để thu nhỏ mô hình xuống kích thước bàn.

### `disposeModel(scenes)`

Giải phóng **đúng một lần** geometry, material, texture, ImageBitmap — gọi khi rời phòng, khi huỷ
giữa chừng, hoặc khi bước sau parse thất bại.

## 3. Cache (`glbCache.ts`)

Interface `GlbCacheAdapter` (`getBuffer`, `putBuffer`, `remove`, `clear`, `getStats`) tách riêng để
có thể cắm dịch vụ File Cache chung MOB-E3-05 của TV2.

`ExpoFileSystemGlbCache`:

- Thư mục `<cacheDirectory>/aura-glb-cache/`, mỗi file tên `<sha256>.glb`.
- Chỉ mục `index.v1.json` lưu kích thước + thời điểm truy cập; chỉ mục hỏng → coi như rỗng.
- Giới hạn mặc định **150 MB**; vượt thì xoá theo **LRU** (ít dùng gần đây nhất trước).
- Khoá theo checksum nên khi CMS xuất bản bản mới (checksum đổi) cache cũ tự bị bỏ qua.

`InMemoryGlbCache` dùng cho test và khi thiết bị không có `cacheDirectory`.

## 4. Pipeline `loadGlbModel(options)` (`glbLoader.ts`)

```text
validate_meta ─► cache ─┬─(hit, hash + size khớp)──────────────► parse ─► mesh ─► normalize ─► LoadedGlbAsset
                        └─(miss / hash sai → xoá)─► download ─► verify ─┘
```

1. **validate_meta** — `publicModelSchema.safeParse` + `resolvePublicModelUrl`.
2. **cache** — đọc theo checksum, tính lại SHA-256 và so `sizeBytes`, chạy `validateGlb`.
   Sai bất kỳ điều gì → xoá entry và tải lại (tự chữa cache hỏng).
3. **download** — `fetch` có timeout mặc định **25 s**, nhận `AbortSignal`, báo `onProgress`.
4. **verify** — SHA-256 khớp `checksumSha256` rồi `validateGlb`; lưu cache (lỗi ổ đầy bị bỏ qua,
   không chặn hiển thị).
5. **parse** — `GLTFLoader` trên buffer tự chứa.
6. **mesh / normalize** — `sanitizeModel` rồi `normalizeModel`; lỗi ở đây → `disposeModel` ngay.

SHA-256 dùng WebCrypto khi có, nếu không thì `expo-crypto`. `configureExpoGlContext` chặn các lời
gọi `pixelStorei` mà driver `expo-gl` không hỗ trợ để tránh spam cảnh báo khi tải texture.

Kết quả `LoadedGlbAsset` gồm `scene`, `scenes` (để dispose), `normalization`,
`quarantinedMeshCount`, `source: 'cache' | 'network'`, `sizeBytes`, `loadDurationMs`.

## 5. Mã lỗi `GlbLoadError`

Mỗi lỗi mang `stage` (bước hỏng) và `category` (loại lỗi) để UI chọn thông báo/hành động:

| HTTP / tình huống | `stage` | `category` |
|---|---|---|
| Metadata/URL sai | `validate_meta` | `format` |
| 404 | `download` | `missing` |
| 401, 403 | `download` | `permission` |
| 429 (kèm `retryAfterSeconds` từ header `Retry-After`) | `download` | `rate_limit` |
| ≥ 500 | `download` | `server` |
| Vượt dung lượng / độ dài sai | `download` | `format` |
| Hết 25 s | `download` | `timeout` |
| Người dùng rời màn hình | `download` / `parse` | `aborted` |
| Mất mạng | `download` | `network` |
| SHA-256 không khớp | `verify` | `checksum` |
| Cấu trúc GLB sai | `verify` / `parse` | `format` |
| Mesh hỏng | `mesh` | `mesh` |

## Kiểm thử

- `glbValidation.test.ts` — schema từ chối path traversal / URL giả mạo; `validateGlb` chạy trên
  GLB thật trong `back-end/public/media/uploads/models` và payload tấn công (URI ngoài, nén chưa hỗ
  trợ, header hỏng); `sanitizeModel` cách ly mesh NaN/Infinity; `normalizeModel` từ chối model
  rỗng/quá khổ; `disposeModel` giải phóng đúng 1 lần.
- `glbCache.test.ts` — Base64 bảo toàn byte, lưu/đọc/dọn LRU/xoá sạch, từ chối checksum sai định
  dạng (chống path traversal qua tên file).
- `glbLoader.integration.test.ts` — HTTP server thật + cache đĩa: lần 1 tải mạng, lần 2 đọc cache
  (0 request); cache hỏng tự xoá và tải lại; phân loại 404, 429 + `Retry-After`, 500, hash bị sửa
  và huỷ giữa chừng; dọn LRU khi vượt dung lượng.

Chưa có test riêng cho nhánh timeout 25 s và GLB dùng Draco.
