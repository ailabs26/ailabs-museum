# Task 10 — Hoàn thiện luồng CMS End-to-End

**Deadline:** 09/11/2026  
**Nhánh:** `feat/cms-e2e-flow`  
**Bắt đầu từ:** `origin/dev`

---

## Mục tiêu

Xác minh toàn bộ luồng hoạt động thông suốt từ đầu đến cuối:

```
[Admin] Chọn file
    → [Backend] Upload & Validate (Task 8)
    → [DB] Lưu Media record
    → [Admin] Gắn Media vào Exhibit Draft (Task 9)
    → [Admin] Save Draft
    → [Admin] Preview Draft (xem nội dung trước khi xuất bản)
    → [Admin] Publish
    → [Client] GET /rooms/:slug → thấy nội dung vừa xuất bản
```

---

## Checklist bàn giao (phải submit cùng PR)

### ✅ Luồng Upload & Gắn Media

- [ ] Upload file GLB hợp lệ (≤ 10 MB) → nhận `mediaId` → gắn vào exhibit Draft thành công.
- [ ] Upload file ảnh hợp lệ (≤ 2 MB) → nhận `mediaId` → gắn vào exhibit Draft thành công.
- [ ] Upload file audio MP3 hợp lệ (≤ 10 MB) → nhận `mediaId` → gắn vào Draft + nhập transcript thành công.
- [ ] Preview Draft tại `GET /admin/exhibits/:id/preview` hiển thị đúng media đã gắn.

### ✅ Luồng Publish & Public API

- [ ] Publish exhibit đủ dữ liệu (vi + en, media hợp lệ) → `200`, exhibit xuất hiện trong `GET /rooms/:slug`.
- [ ] Publish exhibit thiếu `name.en` → `422` kèm thông báo chỉ rõ trường lỗi.
- [ ] Publish exhibit thiếu `description.vi` → `422`.
- [ ] Draft không xuất hiện trong bất kỳ public endpoint nào (`/rooms`, `/rooms/:slug`).
- [ ] Sau Unpublish: exhibit biến mất khỏi `GET /rooms/:slug`; nếu có cache thì trong ≤ 60 giây.

### ✅ Bảo mật

- [ ] Tất cả `/admin/*` routes → `401` khi không có JWT.
- [ ] Tất cả `/admin/*` routes → `401` khi JWT hết hạn.
- [ ] Response không lộ thông tin nhạy cảm (JWT secret, DATABASE_URL, stack trace).
- [ ] `GET /admin/exhibits/:id/preview` → `401` khi không có JWT.

### ✅ Hiệu năng CMS (NFR-05: p95 ≤ 2 giây)

- [ ] `GET /admin/exhibits` — p95 ≤ 2s trong điều kiện local/staging.
- [ ] `PATCH /admin/exhibits/:id` (Save Draft) — p95 ≤ 2s.
- [ ] `POST /admin/exhibits/:id/publish` — p95 ≤ 2s.

### ✅ Chất lượng mã

- [ ] `npm run typecheck` — không có lỗi TypeScript.
- [ ] `npm run lint` — không có lỗi ESLint.
- [ ] `npm run build` — build thành công.

---

## Hướng dẫn kiểm thử E2E thủ công

### Kịch bản 1 — Luồng Happy Path hoàn chỉnh

```
1. Login Admin → nhận JWT
2. POST /admin/exhibits → tạo exhibit mới (status: draft)
3. POST /admin/media/upload → upload .glb → nhận modelId
4. POST /admin/media/upload → upload .png → nhận imageId  
5. POST /admin/media/upload → upload .mp3 → nhận audioId
6. PATCH /admin/exhibits/:id/media → gắn 3 media vào exhibit
7. PATCH /admin/exhibits/:id → nhập name.vi, name.en, description.vi, description.en, transcript
8. GET /admin/exhibits/:id/preview → xác nhận Preview hoạt động
9. POST /admin/exhibits/:id/publish → xác nhận 200
10. GET /rooms/phong-kham-pha → xác nhận exhibit xuất hiện trong danh sách
11. POST /admin/exhibits/:id/unpublish → xác nhận 200
12. GET /rooms/phong-kham-pha → xác nhận exhibit biến mất
```

### Kịch bản 2 — Kiểm tra bảo vệ dữ liệu Draft

```
1. Tạo exhibit → Draft
2. GET /rooms/:slug → xác nhận exhibit KHÔNG xuất hiện
3. GET /admin/exhibits/:id (không có JWT) → xác nhận 401
4. POST /admin/exhibits/:id/publish (thiếu name.en) → xác nhận 422
```

---

## Bàn giao

Tạo file `back-end/docs/plans/v1/e2e-verification-log.md` ghi lại:
- Ngày thực hiện kiểm thử
- Môi trường (local / staging / production)
- Kết quả từng mục trong checklist (Pass / Fail + ghi chú nếu Fail)
- Các vấn đề phát sinh và cách xử lý

