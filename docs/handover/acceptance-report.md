# Biên bản nghiệm thu dự án — Aura Museum (WebXR 3D-WEB-03)

Biên bản đối soát sản phẩm với **Requirements Baseline v0.2** ([`docs/requirements.md`](../requirements.md)),
phục vụ nghiệm thu MVP và bàn giao.

- **Ngày lập:** 2026-11-11 · **Nhánh chốt:** `dev`.
- **Cơ sở nghiệm thu:** 107 Functional Requirements (FR-01…), Non-Functional Requirements
  (NFR), Business Rules (BR) trong requirements.md v0.2.
- **Phương pháp:** đối chiếu từng nhóm chức năng với (a) endpoint/giao diện đã triển khai,
  (b) bộ kiểm thử tự động (98 file spec back-end, 142 file test front-end), (c) cổng CI.

> **Trạng thái:** cột "Tình trạng" phản ánh mức **triển khai + có bằng chứng kiểm thử** tại
> thời điểm lập biên bản. Chữ ký nghiệm thu chính thức của các bên ở §5 là bước xác nhận cuối,
> thực hiện sau khi chạy lại đầy đủ cổng chất lượng (§4) trên môi trường nghiệm thu.

---

## 1. Phạm vi nghiệm thu

**Trong phạm vi (MVP):**

- Trải nghiệm Visitor: bảo tàng 3D, khám phá hiện vật, hotspot, audio guide, guided tour,
  giao diện 2D fallback, đa ngôn ngữ (vi/en/fr/zh/ko/ja), accessibility WCAG 2.1 A/AA.
- Admin Portal: quản lý nội dung (rooms/exhibits/media), vòng đời revision & kiểm duyệt,
  quản trị hệ thống (users/roles/permissions/audit), bản dịch, partner API key.
- Nền tảng: API NestJS có tài liệu OpenAPI, RBAC, rate limit, bảo mật phiên/secret.

**Ngoài phạm vi MVP (future extension):**

- Immersive VR/headset WebXR (chỉ yêu cầu *readiness*, không phải điều kiện nghiệm thu MVP).
- Các hạng mục được requirements.md đánh dấu "Outside MVP".

---

## 2. Đối soát theo nhóm chức năng (FR §6)

| # | Nhóm chức năng (requirements §6) | Tình trạng | Bằng chứng chính |
| --- | --- | --- | --- |
| 6.1 | Visitor Access & General Navigation | Đạt | Giao diện công khai + 3D scene; không cần đăng nhập (route `@Public()`) |
| 6.2 | Exhibit Discovery & Information | Đạt | `public/exhibits`, `public/rooms`; FE pages Collection/ExhibitDetail; test exhibits/public |
| 6.3 | Hotspot Interaction | Đạt | Hotspot trong exhibit + i18n; module exhibits |
| 6.4 | Audio Guide | Đạt | Media audio + AudioPlayer; `media` module; metadata/nguồn media |
| 6.5 | Guided Tour | Đạt | Guided Tour 2D (PR #178) + 3D camera tour; `guided-tour-2d.spec.ts`, `guided-tour-camera.spec.ts` |
| 6.6 | WebXR Extension Readiness | Đạt (readiness) | Hạ tầng 3D sẵn sàng mở rộng; immersive VR ngoài MVP |
| 6.7 | Progressive Fallback | Đạt | Giao diện 2D fallback khi 3D không khả dụng; test public-visitor-journey |
| 6.8 | Administrative Authentication & Authorization | Đạt | `auth` module: JWT access+refresh, 2FA TOTP, RBAC guard toàn cục; test auth/roles/rbac-http |
| 6.9 | Exhibit Management | Đạt | `admin/exhibits` + `exhibit:create/update`; test admin-exhibits |
| 6.10 | Exhibit Placement | Đạt | Vị trí 3D (x/y/z), placeholder; exhibits module |
| 6.11 | Hotspot Management | Đạt | CRUD hotspot trong revision nội dung |
| 6.12 | Draft, Preview, Review & Publishing | Đạt | `moderation`/`revisions`: submit→publish/reject/hide; test moderation/revisions |
| 6.13 | Guided Tour Management | Đạt | Thứ tự hiện vật theo CMS; buildGuidedTourSteps |
| 6.14 | Accessibility Functions | Đạt | ARIA/focus/role=status, reduced motion, keyboard; test a11y/public-a11y-loading |
| 6.15 | Error Handling | Đạt | `AllExceptionsFilter`, ResponseInterceptor, Zod validate ở FE; test common/filters |
| 6.16 | Captions, Motion, Quality & Media Metadata | Đạt | Transcript/subtitle, media rights (source/author/license); test media-rights |
| 6.17 | Automatic Guided Tour | Đạt | Tour 3D có dwell tự chuyển bước; useGuidedCameraTour |
| 6.18 | System Administration, RBAC & Governance | Đạt | users/roles/permissions/audit, partner-api-keys, translations; test tương ứng |

> Chi tiết từng FR nằm trong requirements.md và nhật ký task (`docs/tasks/`, `docs/bt3*`).
> Mỗi module back-end có thư mục `tests/` kèm theo; front-end có `tests/*.spec.ts` + unit test.

---

## 3. Non-Functional & Business Rules (tóm tắt)

| Hạng mục | Tình trạng | Bằng chứng |
| --- | --- | --- |
| Bảo mật xác thực | Đạt | JWT access ngắn hạn + refresh cookie httpOnly, bcrypt, 2FA TOTP mã hóa AES-256-GCM |
| Phân quyền (RBAC) | Đạt | Guard toàn cục `@Permissions`, `DEFAULT_ROLE_PERMISSIONS` 3 vai trò; test rbac-http integration |
| Audit/Governance | Đạt | `@Audit` ghi vết hành động nhạy cảm; audit module + export |
| Rate limiting | Đạt | Throttler cho auth/refresh và API/media/report công khai (biến env cấu hình) |
| Chỉ trả nội dung Published công khai | Đạt | API public lọc Published; Draft/Preview chặn ở backend |
| Đa ngôn ngữ | Đạt | 6 locale; translations module + fallback tiếng Việt |
| Bảo mật header/CORS | Đạt | Helmet + CORS theo `FRONTEND_ORIGIN` |
| Tài liệu API | Đạt | Swagger `/api/docs` + spec tĩnh `docs/api/openapi.json` (96 path) |
| Vận hành | Đạt | Health `/api/health[/ready]`, shutdown hooks, migration (synchronize tắt) |

---

## 4. Cổng chất lượng (chạy lại khi nghiệm thu)

Chạy trên môi trường nghiệm thu và đính kèm log vào biên bản:

```bash
# Back-end (trong back-end/)
npm run typecheck && npm run lint && npm run build && npm test && npm run test:coverage
npm run openapi:export        # xác nhận spec đồng bộ với code

# Front-end (trong front-end/)
npm run typecheck && npm run lint && npm run test:unit && npm run build
npm test                      # Playwright E2E
```

| Cổng | Kết quả | Ghi chú |
| --- | --- | --- |
| BE typecheck / lint / build | ☐ | |
| BE test / coverage | ☐ | |
| FE typecheck / lint / unit / build | ☐ | |
| FE E2E (Playwright) | ☐ | |
| CI `.github/workflows/ci.yml` xanh trên `dev` | ☐ | |

> Các ô ☐ do bên nghiệm thu tick khi chạy. (CI của dự án đang chạy đủ các cổng này trên mỗi PR.)

---

## 5. Hạn chế đã biết & khuyến nghị

- **Immersive VR/headset**: ngoài MVP; mới ở mức readiness.
- **Kiểm thử thiết bị thật / screen reader (NVDA/VoiceOver)**: tự động hóa trình duyệt không
  thay thế được; nên có một vòng QA thủ công trên thiết bị/đọc màn hình thật trước go-live.
- **Secret production**: bắt buộc xoay toàn bộ khóa mẫu và đặt secret ≥ 32 ký tự trước khi
  lên production (xem bàn giao §3).
- **Đồng bộ tài liệu API**: chạy `npm run openapi:export` và commit mỗi khi đổi endpoint/DTO.

---

## 6. Xác nhận nghiệm thu

| Vai trò | Họ tên | Kết luận (Đạt/Không đạt) | Ngày | Ký |
| --- | --- | --- | --- | --- |
| Đại diện phát triển | | | | |
| Quản lý dự án | | | | |
| Đại diện nghiệm thu / khách hàng | | | | |

**Tài liệu kèm theo:** [`requirements.md`](../requirements.md),
[bàn giao hệ thống](./system-handover.md), [hướng dẫn CMS](../guides/cms-user-guide.md),
[tài liệu API](../api/README.md).
