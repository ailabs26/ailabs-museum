# Kế hoạch triển khai V1 — Nguyễn Trọng Thành

**Thành viên:** Nguyễn Trọng Thành  
**Vai trò:** Fullstack / CMS Frontend & QA Lead  
**Thời gian:** 08/10/2026 – 20/11/2026  
**Nguồn yêu cầu:** `docs/requirements.md` v0.1, `AGENTS.md`, `back-end/docs/coding-conventions.md`

---

## Danh sách file kế hoạch

| File | Task | Deadline | Phase |
|:---|:---:|:---:|:---:|
| [task-06-rooms-crud.md](./task-06-rooms-crud.md) | CRUD API + UI Phòng trưng bày | 14/10/2026 | 1 |
| [task-07-exhibits-management.md](./task-07-exhibits-management.md) | Quản lý Hiện vật + Revision + Draft/Publish | 21/10/2026 | 1 |
| [task-08-media-upload.md](./task-08-media-upload.md) | CMS Media + Upload Pipeline bảo mật | 28/10/2026 | 1 |
| [task-09-media-attach-public-api.md](./task-09-media-attach-public-api.md) | Gắn Media vào Hiện vật + API Public Content | 04/11/2026 | 1 |
| [task-10-cms-e2e-checklist.md](./task-10-cms-e2e-checklist.md) | Hoàn thiện luồng CMS End-to-End | 09/11/2026 | 1 |
| [task-28-security-fuzzing.md](./task-28-security-fuzzing.md) | Kiểm thử bảo mật Upload Pipeline | 14/11/2026 | 2 |
| [task-29-load-test-k6.md](./task-29-load-test-k6.md) | Load Test REST API bằng k6 | 20/11/2026 | 2 |
| [coding-rules.md](./coding-rules.md) | Quy tắc coding + bảo mật áp dụng xuyên suốt | — | — |

---

## Lịch trình tổng thể

```
Tuần 1 (08–14/10): Task 6  — CRUD Rooms
Tuần 2 (15–21/10): Task 7  — Exhibits + Revision + Publish
Tuần 3 (22–28/10): Task 8  — Media Upload Pipeline
Tuần 4 (29/10–04/11): Task 9  — Media Attach + Public API
Tuần 5 (05–09/11): Task 10 — E2E Checklist + Bàn giao
Tuần 6 (10–14/11): Task 28 — Security Fuzzing
Tuần 7 (15–20/11): Task 29 — Load Test k6
```

---

## Điều kiện tiên quyết (đọc trước khi code)

- `AGENTS.md` (root): Quy trình nhánh, Quality Gates, quy tắc PR
- `back-end/docs/coding-conventions.md`: Quy chuẩn đặt tên backend
- `docs/requirements.md` Mục 5 + 5.1 + 5.2: Business Rules + Validation
- `plans/content-schema.md`: Quan hệ Room → Exhibit → Media
- [coding-rules.md](./coding-rules.md): Tổng hợp quy tắc áp dụng cho V1

## Phụ thuộc từ thành viên khác

| Cần từ | Nội dung | Dùng cho |
|:---|:---|:---:|
| **Nguyễn Văn Thắng** | DB migration: `rooms`, `exhibits`, `media`, seed 5 hiện vật | Task 6, 7, 8 |
| **Nguyễn Văn Thắng** | Auth API: `POST /auth/login`, `POST /auth/logout`, JWT middleware | Task 6, 7, 8 |
| **Nguyễn Văn Thắng** | RBAC Guard gắn lên Admin routes | Task 6, 7, 8 |
| **Nguyễn Đức Quang** | Thống nhất layout `admin.html` và hash route `#rooms`, `#exhibits`, `#media` | Task 6, 7, 8 |

## Quy trình Git cho mọi task

```bash
git fetch origin
git checkout -b feat/<short-name> origin/dev

# Sau khi hoàn thành
npm run typecheck
npm run lint
npm run build
# Mở PR vào dev — không push thẳng vào dev hoặc main
```

| Task | Tên nhánh |
|:---:|:---|
| 6 | `feat/cms-rooms-crud` |
| 7 | `feat/cms-exhibits-management` |
| 8 | `feat/cms-media-upload` |
| 9 | `feat/cms-media-attach-public-api` |
| 10 | `feat/cms-e2e-flow` |
| 28 | `feat/qa-upload-security-test` |
| 29 | `feat/qa-load-test-k6` |

