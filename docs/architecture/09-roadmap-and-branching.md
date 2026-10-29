# 09 — Lộ trình & chiến lược nhánh

## 9.1 Ánh xạ plan nhóm (45 task / 3 phase) vào component kiến trúc

### Phase 1 — MVP (08/10 → 09/11/2026)

| Mảng | Task (STT plan) | Component kiến trúc |
|---|---|---|
| **Core BE + DB** | 1 | `core/*`, `common/*`, entities, migration, seed 5 hiện vật |
| **Auth + RBAC** (Thắng) | 2,3,4,5 | `modules/auth`, `users`, `roles`, `PermissionsGuard`, `JwtAuthGuard` |
| **CMS nội dung** (Thành) | 6,7,8,9,10 | `modules/rooms`, `exhibits`+revision, `media` upload pipeline |
| **3D/XR** (Thi) | 11,12,13,14,15 | `features/scene/*`, controls, xr, fallback |
| **Client 2D + a11y** (Tiến) | 16,17,18,19,20 | `features/client/*`, `audio-player`, `report-modal` |
| **Admin dashboard/duyệt** (Quang) | 21,22,23,24,25 | `modules/moderation`, `reports`, `audit`, `features/admin/*` |

### Phase 2 — Kiểm thử & hoàn thiện (10/11 → 20/11/2026)
Unit/Integration (coverage ≥80%), security upload fuzzing, k6 load (p95≤500ms), 3D perf audit,
device matrix & fallback tests, a11y audit (NVDA/VoiceOver), Playwright E2E, bug sprint.

### Phase 3 — Mở rộng (21/11 → 08/12/2026)
API Key đối tác, scheduled analytics cleanup, bulk import/export, i18n (en/zh/ko/ja), guided tour
nâng cao, Draco/LOD/WebP pipeline, API Docs & user guide.

## 9.2 Chiến lược nhánh (theo quy ước nhóm)

```
main        ← chỉ release ổn định (KHÔNG merge trực tiếp)
 └─ dev     ← nhánh tích hợp; mọi PR merge vào đây sau review
     ├─ feat/<scope>-<mô-tả>     vd feat/be-core-foundation, feat/admin-users-ui
     ├─ fix/<scope>-<mô-tả>      vd fix/auth-refresh-rotation
     └─ docs/<mô-tả>            vd docs/architecture-foundation (PR này)
```

**Quy tắc:**
1. Rẽ nhánh từ `dev`. Có bug → `fix/...`. Xong → PR vào `dev`, **chờ review, không tự merge**.
2. Commit nhỏ, thông điệp chi tiết (conventional commits: `feat/fix/chore/docs/test/refactor`).
3. Không merge vào `main`.

## 9.3 Thứ tự PR đề xuất cho phần dựng khung (foundation)

| PR | Nhánh | Nội dung | Phụ thuộc |
|---|---|---|---|
| **#A** | `docs/architecture-foundation` | Bộ tài liệu kiến trúc này | — |
| **#B** | `feat/be-core-foundation` | `core/` (BaseRepository, ApiResponse, filter, interceptor, guards), `common/` (enums, dto), `main.ts` nâng cấp, Swagger | #A |
| **#C** | `feat/be-admin-entities` | entities + migration User/Role/Permission/Audit, seed admin + 5 hiện vật | #B |
| **#D** | `feat/be-auth-rbac` | AuthModule, UsersModule, RolesModule, AuditModule, guards áp route | #C |
| **#E** | `feat/fe-foundation` | Mantine setup, `core/api`, `core/auth`, `shared/components`, `AdminLayout`, router | #A |
| **#F** | `feat/fe-admin-skeleton` | Login, Dashboard, Users, Roles, PermissionMatrix, Audit (nối API #D) | #D,#E |

> Mỗi PR kèm mô tả: mục tiêu, phạm vi, cách chạy/kiểm thử, ảnh/screenshot nếu có UI.

## 9.4 Definition of Done (mỗi PR)

- [ ] **CI xanh** (GitHub Actions `.github/workflows/ci.yml`, tự chạy trên mọi PR vào `dev`/`main` và mỗi lần push `dev`):
  back-end typecheck → lint → build → `npm test` (PostgreSQL 16 tạm của runner) → `test:coverage` (≥ 80%);
  front-end typecheck → lint → `test:unit` → build. CI đỏ → xem log ở tab Checks của PR, sửa trước khi merge.
- [ ] Biên dịch/lint sạch (`typecheck`, `lint`).
- [ ] Theo đúng cấu trúc thư mục & quy ước trong tài liệu này.
- [ ] DTO tách Entity; endpoint trả `ApiResponse`.
- [ ] Có migration nếu đổi schema; không `synchronize` production.
- [ ] Mô tả PR rõ ràng; commit chi tiết; không commit secret.
- [ ] (Khi có logic) kèm test tối thiểu cho happy-path + 1 nhánh lỗi.
