# Task 28 — Kiểm thử bảo mật Upload Pipeline (Fuzzing)

**Deadline:** 14/11/2026  
**Nhánh:** `feat/qa-upload-security-test`  
**Bắt đầu từ:** `origin/dev`  
**Yêu cầu:** AC-33, NFR-19 (SRS docs/requirements.md)

---

## Mục tiêu

Xác minh Upload Pipeline từ chối **toàn bộ** file độc hại và trường hợp biên. Bộ test này kiểm thử **trực tiếp API** (không qua form frontend) để đảm bảo backend là tuyến phòng thủ cuối cùng.

---

## Chuẩn bị bộ payload mẫu

Tạo thư mục `back-end/docs/plans/v1/fuzzing-payloads/` chứa các file sau:

```
fuzzing-payloads/
├── exec-fake-glb.glb         # File .exe đổi tên (magic bytes không phải glTF)
├── html-fake-png.png         # File HTML đổi extension .png
├── php-fake-jpg.jpg          # File PHP đổi extension .jpg
├── zip-fake-mp3.mp3          # File ZIP đổi extension .mp3
├── valid-glb-fake-mime.glb   # GLB thật nhưng test khai báo image/png
├── xss-script.svg            # <svg><script>alert(1)</script></svg>
├── xss-onload.svg            # SVG với onload="fetch('evil.com')"
├── xss-as-png.png            # File SVG đổi tên thành .png
├── oversized-glb.glb         # GLB > 10 MB
├── oversized-png.png         # PNG > 2 MB
├── oversized-mp3.mp3         # MP3 > 10 MB
├── corrupt-glb.glb           # Magic bytes glTF đúng nhưng nội dung bị cắt
├── truncated-png.png         # Chỉ có PNG header, không có data
├── empty-mp3.mp3             # File rỗng 0 bytes
└── bad-timestamp.vtt         # WebVTT với timestamp âm hoặc sai thứ tự
```

---

## Bộ test case bảo mật

### Nhóm 1 — Giả mạo MIME type (MIME Spoofing)

| ID | File gửi lên | Content-Type khai báo | HTTP Expected |
|:---:|:---|:---|:---:|
| SEC-01 | `exec-fake-glb.glb` | `model/gltf-binary` | `422` |
| SEC-02 | `html-fake-png.png` | `image/png` | `422` |
| SEC-03 | `php-fake-jpg.jpg` | `image/jpeg` | `422` |
| SEC-04 | `zip-fake-mp3.mp3` | `audio/mpeg` | `422` |
| SEC-05 | `valid-glb-fake-mime.glb` | `image/png` | `422` |

### Nhóm 2 — SVG XSS

| ID | File | Nội dung nguy hiểm | HTTP Expected |
|:---:|:---|:---|:---:|
| SEC-06 | `xss-script.svg` | `<svg><script>alert(1)</script></svg>` | `422` |
| SEC-07 | `xss-onload.svg` | SVG với `onload="fetch(...)"` | `422` |
| SEC-08 | `xss-as-png.png` | Nội dung SVG, extension `.png` | `422` |

### Nhóm 3 — File vượt dung lượng

| ID | File | Giới hạn | HTTP Expected |
|:---:|:---|:---:|:---:|
| SEC-09 | `oversized-glb.glb` | 10 MB | `413` |
| SEC-10 | `oversized-png.png` | 2 MB | `413` |
| SEC-11 | `oversized-mp3.mp3` | 10 MB | `413` |

### Nhóm 4 — File corrupt / không parse được

| ID | File | Vấn đề | HTTP Expected |
|:---:|:---|:---|:---:|
| SEC-12 | `corrupt-glb.glb` | Magic bytes GLB đúng, nội dung lỗi | `422` |
| SEC-13 | `truncated-png.png` | Chỉ có header PNG | `422` |
| SEC-14 | `empty-mp3.mp3` | File rỗng 0 bytes | `422` |
| SEC-15 | `bad-timestamp.vtt` | Cue timestamp âm hoặc sai thứ tự | `422` |

### Nhóm 5 — Bypass qua URL và type mismatch

| ID | Hành động | HTTP Expected |
|:---:|:---|:---:|
| SEC-16 | `PATCH /admin/exhibits/:id/media` với `imageId` là Storage URL bên ngoài | `422` |
| SEC-17 | Gắn media `kind='audio'` vào `imageId` field | `422` |

---

## Cách chạy test với curl

```bash
BASE=http://localhost:3001
TOKEN="Bearer <jwt-token>"

# SEC-01: File exe giả glb
curl -X POST $BASE/admin/media/upload \
  -H "Authorization: $TOKEN" \
  -F "file=@fuzzing-payloads/exec-fake-glb.glb;type=model/gltf-binary" \
  -w "\nHTTP: %{http_code}\n"

# SEC-06: SVG XSS
curl -X POST $BASE/admin/media/upload \
  -H "Authorization: $TOKEN" \
  -F "file=@fuzzing-payloads/xss-script.svg;type=image/svg+xml" \
  -w "\nHTTP: %{http_code}\n"
```

---

## Bàn giao

Tạo file `back-end/docs/plans/v1/security-upload-report.md` với nội dung:

```markdown
# Báo cáo kiểm thử bảo mật Upload Pipeline

**Ngày thực hiện:** DD/MM/YYYY  
**Môi trường:** local / staging  
**Endpoint:** POST /admin/media/upload  

| ID | File | Content-Type | Expected | Actual | Pass/Fail | Ghi chú |
|:---:|:---|:---|:---:|:---:|:---:|:---|
| SEC-01 | exec-fake-glb.glb | model/gltf-binary | 422 | ... | ... | |
...

## Kết luận
```

