---
phase: 0
title: "Baseline, xác minh & chốt quyết định"
status: completed
priority: P1
effort: "2h"
dependencies: []
---

# Phase 0: Baseline, xác minh & chốt quyết định

## Overview
Đảm bảo bắt đầu từ nền xanh, xác minh các giả định G6/G7 bằng dữ liệu thật, chốt D1–D7 trước khi viết code.

## Requirements
- Nền test hiện tại xanh, ghi lại số test làm baseline.
- Mọi quyết định ảnh hưởng contract (D1, D2, D3) được nhóm đồng ý (Tiến – FE public, Quang – moderation, Thi – GLB loader).

## Implementation Steps
1. **Nhánh**
   - Nếu PR Task 8 (`feat/cms-media-upload`) đã merge: `git checkout dev && git pull && git checkout -b feat/cms-media-attach`.
   - Nếu chưa: tách từ `feat/cms-media-upload`, ghi trong PR "depends on #<PR Task 8>"; rebase lên `dev` sau khi Task 8 merge.
2. **Baseline** (trong `back-end/`): `npm ci && npm run typecheck && npm run lint && npm test && npm run test:exhibits && npm run test:moderation`. Ghi số pass vào phần Kiểm thử của PR.
3. **DB test cục bộ**: `docker run -d --name media-testdb -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=t -p 127.0.0.1:55432:5432 postgres:16-alpine`; chạy `migration:run` + `seed` + `seed:demo`.
4. **Xác minh G6/G7** bằng app thật:
   - Tạo exhibit qua `POST /api/admin/exhibits` với `name: {vi,en}` và 1 hotspot `label: {vi,en}`, submit, publish qua moderation.
   - `GET /api/rooms/<slug>` → ghi lại `name` (object?) và hotspot `label` (chuỗi JSON?). `SELECT label FROM hotspots` để xem dạng lưu thật.
   - Kết quả quyết định hàm chuẩn hóa ở Phase 4 (`resolveBilingual`) phải xử lý: chuỗi thuần, object `{vi,en}`, chuỗi JSON `'{"vi":..}'`.
5. **Chốt quyết định** D1–D7 (xem `plan.md`), ghi kết quả vào mục "Quyết định đã chốt" bên dưới; nếu đổi D1 sang bảng nối → cập nhật Phase 1/2/4/5.
6. **Kiểm tra env**: thêm vào `env.validation.ts` + `.env.example` (Phase 5 dùng):
   - `MEDIA_PUBLIC_BASE_URL` (vd `http://localhost:3001`) — để build URL tuyệt đối (G8).
   - `MEDIA_URL_SIGNING_SECRET` (≥ 32 ký tự, khác JWT secret) và `MEDIA_SIGNED_URL_TTL_SECONDS` (mặc định 900).

## Quyết định đã chốt
- Dùng phương án đề xuất (người dùng giao triển khai, chưa phản hồi câu hỏi chốt): D1 3 cột FK · D2 giữ chuỗi vi + `i18n` · D3 route kiểm tra + URL ký HMAC (TTL 900s) · D4 `no-cache` + ETag · D5 Save chỉ kiểm tham chiếu, Submit/Publish kiểm đủ · D6 mã lỗi như bảng · D7 cổng dùng chung, sửa moderation tối thiểu.

## Success Criteria
- [ ] Baseline xanh, số test được ghi.
- [ ] Dạng lưu thật của name/description/transcript/altText/hotspot được ghi lại kèm ví dụ JSON.
- [ ] D1–D7 có quyết định + người đồng ý.

## Risk Assessment
- Task 8 chưa merge → conflict khi rebase: giữ commit Task 9 không chạm file pipeline upload (chỉ `media.repository.ts countUsage`, `media-storage.service.ts toPublicUrl`, `main.ts`).
